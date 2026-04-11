const crypto = require('node:crypto');
const { z } = require('zod');

const FEATURE_KEY = 'activity-summary';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite-preview';
const MODEL_ALLOWLIST = new Set([
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite-preview',
  'gemini-2.5-flash-lite',
]);

const ACTIVE_STATUSES = new Set(['proposed', 'draft', 'in-progress', 'review']);
const STALE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;   // 2 days — plan hasn't been updated
const ABANDON_THRESHOLD_MS = 4 * 24 * 60 * 60 * 1000; // 4 days — candidate for abandon

const RECOMMENDATION_ITEM_SCHEMA = z.object({
  planId: z.string(),
  slug: z.string(),
  title: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).max(3),
});

const SUMMARY_SCHEMA = z.object({
  headline: z.string().min(1).max(160),
  summaryBullets: z.array(z.string().min(1).max(220)).min(1).max(4),
  riskFlags: z.array(z.string().min(1).max(220)).max(4),
  nextActions: z.array(z.string().min(1).max(220)).max(4),
  confidence: z.number().min(0).max(1),
  agent: z.object({
    mood: z.enum(['focused', 'celebrating', 'worried', 'nudging', 'idle']),
  }),
  recommendations: z.object({
    closeCandidates: z.array(
      RECOMMENDATION_ITEM_SCHEMA.extend({ action: z.enum(['merged', 'abandoned']) })
    ).max(3),
    nextCandidates: z.array(RECOMMENDATION_ITEM_SCHEMA).max(3),
  }),
});

function toMillis(timestamp) {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  return 0;
}

function toIso(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
  if (typeof timestamp.toMillis === 'function') return new Date(timestamp.toMillis()).toISOString();
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000).toISOString();
  if (typeof timestamp === 'string') return timestamp;
  return String(timestamp);
}

function getAiApiKey(env = process.env) {
  return env.GEMINI_API_KEY
    || env.GOOGLE_GENERATIVE_AI_API_KEY
    || env.GOOGLE_API_KEY
    || null;
}

function resolveActivitySummaryModel(env = process.env) {
  const provider = String(env.AI_INSIGHTS_PROVIDER || 'google').trim().toLowerCase();
  const model = String(env.AI_INSIGHTS_ACTIVITY_SUMMARY_MODEL || DEFAULT_MODEL).trim();

  if (provider !== 'google') {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  if (!MODEL_ALLOWLIST.has(model)) {
    throw new Error(`Unsupported activity summary model: ${model}`);
  }

  return { provider, model };
}

function formatAgeLabel(ms) {
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h`;
  return `${(ms / (24 * 60 * 60 * 1000)).toFixed(1)}d`;
}

function normalizePlan(plan) {
  if (!plan) return null;
  return {
    id: plan.id || null,
    slug: String(plan.slug || plan.id || '').trim() || 'untitled',
    status: String(plan.status || 'unknown').trim(),
    author: String(plan.author || 'unknown').trim(),
    summary: String(plan.summary || '').trim(),
    alignment: String(plan.alignment || '').trim(),
    outOfScope: String(plan.outOfScope || '').trim(),
    createdAt: plan.createdAt || null,
    updatedAt: plan.updatedAt || null,
    updates: Array.isArray(plan.updates) ? plan.updates : [],
    touches: Array.isArray(plan.touches) ? plan.touches : [],
    prUrl: plan.prUrl || null,
  };
}

function summarizeRecentUpdates(plan) {
  return plan.updates
    .map((update) => ({
      timestamp: update.timestamp || null,
      author: String(update.author || plan.author || 'unknown').trim(),
      action: 'updated',
      planId: plan.id,
      slug: plan.slug,
      note: String(update.note || '').trim(),
    }))
    .filter((event) => event.timestamp);
}

function computeCloseCandidates(normalizedPlans, nowMs) {
  const candidates = [];
  for (const plan of normalizedPlans) {
    const updatedMs = toMillis(plan.updatedAt);
    const ageMs = updatedMs ? nowMs - updatedMs : null;

    // Merged candidate: has PR url but status hasn't caught up
    if (plan.prUrl && ACTIVE_STATUSES.has(plan.status)) {
      const evidence = [`pr: ${plan.prUrl.replace(/^https?:\/\/[^/]+\//, '')}`];
      if (ageMs !== null) evidence.push(`last updated ${formatAgeLabel(ageMs)} ago`);
      candidates.push({
        planId: plan.id,
        slug: plan.slug,
        title: (plan.summary || plan.slug).slice(0, 80),
        reason: 'Plan has a PR url but status has not been updated to merged',
        confidence: 0.75,
        action: 'merged',
        evidence,
      });
    } else if (ACTIVE_STATUSES.has(plan.status) && ageMs !== null && ageMs > ABANDON_THRESHOLD_MS) {
      // Abandoned candidate: stale active plan
      const evidence = [`stale ${formatAgeLabel(ageMs)}`];
      if (!plan.alignment) evidence.push('no goal alignment');
      candidates.push({
        planId: plan.id,
        slug: plan.slug,
        title: (plan.summary || plan.slug).slice(0, 80),
        reason: 'Active plan with no updates for an extended period',
        confidence: Math.min(0.85, 0.5 + ageMs / (10 * 24 * 60 * 60 * 1000)),
        action: 'abandoned',
        evidence,
      });
    }
  }
  return candidates.slice(0, 3);
}

function computeNextCandidates(normalizedPlans, goals, nowMs) {
  const threeDayGoalText = String(goals.threeDay || '').toLowerCase();
  const twoWeekGoalText = String(goals.twoWeek || '').toLowerCase();
  const candidates = [];

  const workable = normalizedPlans.filter(
    (p) => p.status === 'proposed' || p.status === 'draft' || p.status === 'in-progress'
  );

  for (const plan of workable) {
    const alignLower = plan.alignment.toLowerCase();
    const evidence = [];
    let score = 0;

    // 3-day alignment signals
    if (threeDayGoalText && alignLower && (
      alignLower.includes('3-day') ||
      alignLower.includes('3day') ||
      alignLower.includes('threeday') ||
      (threeDayGoalText.length > 5 && alignLower.includes(threeDayGoalText.slice(0, 15)))
    )) {
      score += 2;
      evidence.push('supports 3-day target');
    }
    // 2-week alignment signals
    if (twoWeekGoalText && alignLower && (
      alignLower.includes('2-week') ||
      alignLower.includes('2week') ||
      alignLower.includes('twoweek') ||
      (twoWeekGoalText.length > 5 && alignLower.includes(twoWeekGoalText.slice(0, 15)))
    )) {
      score += 1;
      evidence.push('supports 2-week goal');
    }
    // Recent activity bonus
    const updatedMs = toMillis(plan.updatedAt);
    if (updatedMs && (nowMs - updatedMs) < 24 * 60 * 60 * 1000) {
      score += 1;
      evidence.push('active in last 24h');
    }

    if (plan.alignment && !evidence.some((e) => e.startsWith('supports'))) {
      evidence.push(`aligned: ${plan.alignment.slice(0, 60)}`);
      score = Math.max(score, 1);
    }

    if (score > 0) {
      candidates.push({
        planId: plan.id,
        slug: plan.slug,
        title: (plan.summary || plan.slug).slice(0, 80),
        reason: 'Plan advances current team goals',
        confidence: Math.min(0.9, 0.4 + score * 0.15),
        evidence,
        _score: score,
      });
    }
  }

  return candidates
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...c }) => c)
    .slice(0, 3);
}

function buildActivitySummarySource({
  teamId,
  teamName = null,
  twoWeekGoal = null,
  threeDayGoal = null,
  plans = [],
  now = new Date(),
}) {
  const normalizedPlans = plans.map(normalizePlan).filter(Boolean);
  const nowMs = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const createdToday = normalizedPlans.filter((plan) => toMillis(plan.createdAt) >= nowMs - dayMs).length;
  const activePlans = normalizedPlans.filter((plan) => ACTIVE_STATUSES.has(plan.status)).length;
  const mergedPlans = normalizedPlans.filter((plan) => plan.status === 'merged').length;
  const contributors = [...new Set(normalizedPlans.map((plan) => plan.author).filter(Boolean))].sort();

  const recentPlans = [...normalizedPlans]
    .sort((left, right) => toMillis(right.updatedAt) - toMillis(left.updatedAt))
    .slice(0, 8)
    .map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      status: plan.status,
      author: plan.author,
      summary: plan.summary,
      updatedAt: toIso(plan.updatedAt),
      createdAt: toIso(plan.createdAt),
      touches: plan.touches.slice(0, 6),
      prUrl: plan.prUrl,
    }));

  const recentActivity = [...normalizedPlans]
    .flatMap((plan) => {
      const events = [];
      if (plan.createdAt) {
        events.push({
          timestamp: plan.createdAt,
          author: plan.author,
          action: 'created',
          planId: plan.id,
          slug: plan.slug,
          note: plan.summary,
        });
      }
      events.push(...summarizeRecentUpdates(plan));
      return events;
    })
    .filter((event) => event.timestamp)
    .sort((left, right) => toMillis(right.timestamp) - toMillis(left.timestamp))
    .slice(0, 12)
    .map((event) => ({
      timestamp: toIso(event.timestamp),
      author: event.author,
      action: event.action,
      planId: event.planId,
      slug: event.slug,
      note: String(event.note || '').slice(0, 180),
    }));

  // PM-agent signals
  const stalePlans = normalizedPlans.filter(
    (p) => ACTIVE_STATUSES.has(p.status) && toMillis(p.updatedAt) && (nowMs - toMillis(p.updatedAt)) > STALE_THRESHOLD_MS
  );
  const reviewQueueCount = normalizedPlans.filter((p) => p.status === 'review').length;
  const recentMerges = normalizedPlans.filter(
    (p) => p.status === 'merged' && toMillis(p.updatedAt) && (nowMs - toMillis(p.updatedAt)) < 48 * 60 * 60 * 1000
  );

  const goals = {
    twoWeek: String(twoWeekGoal || '').trim(),
    threeDay: String(threeDayGoal || '').trim(),
  };
  const closeCandidates = computeCloseCandidates(normalizedPlans, nowMs);
  const nextCandidates = computeNextCandidates(normalizedPlans, goals, nowMs);

  return {
    scope: {
      kind: 'team',
      id: teamId,
      name: teamName,
    },
    goals,
    stats: {
      totalPlans: normalizedPlans.length,
      activePlans,
      mergedPlans,
      createdToday,
      contributors: contributors.length,
      contributorNames: contributors,
    },
    signals: {
      stalePlanCount: stalePlans.length,
      stalePlanSlugs: stalePlans.map((p) => p.slug).slice(0, 5),
      reviewQueueCount,
      recentMergeCount: recentMerges.length,
      recentMergeSlugs: recentMerges.map((p) => p.slug).slice(0, 5),
      goalCoverage: normalizedPlans.filter((p) => p.alignment).length,
    },
    candidates: { closeCandidates, nextCandidates },
    recentPlans,
    recentActivity,
    sourceWindow: {
      planCount: normalizedPlans.length,
      recentPlanCount: recentPlans.length,
      recentActivityCount: recentActivity.length,
    },
  };
}

function buildActivitySummaryPrompt(source) {
  return JSON.stringify({
    feature: FEATURE_KEY,
    scope: source.scope,
    goals: source.goals,
    stats: source.stats,
    signals: source.signals || null,
    candidates: source.candidates || null,
    recentPlans: source.recentPlans,
    recentActivity: source.recentActivity,
    sourceWindow: source.sourceWindow,
    instructions: [
      'Use only the supplied data.',
      'Do not invent plans, events, goals, or risks.',
      'Write for a dashboard above the activity feed.',
      'Keep it concise, direct, and operational.',
      'Mention coordination risk when the recent activity suggests drift or overload.',
      'Prefer exact plan slugs, statuses, and updates from the input.',
      'Set agent.mood to: celebrating if recentMergeCount > 0 and stalePlanCount is 0; worried if stalePlanCount >= 2 or reviewQueueCount >= 3; nudging if closeCandidates or nextCandidates are non-empty; focused otherwise.',
      'For recommendations, use only the plans listed in candidates.closeCandidates and candidates.nextCandidates. Do not invent new ones. You may reorder or reduce the list based on your analysis.',
      'Use advisory language: "consider closing", "likely next", "stale — may need attention".',
      'Explicitly name the recommended terminal action (mark merged / abandon) for close candidates.',
    ],
  }, null, 2);
}

function buildActivitySummaryFingerprint(source) {
  return crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
}

async function generateActivitySummary({ source, env = process.env }) {
  const apiKey = getAiApiKey(env);
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required to generate the activity summary.');
  }

  const { provider, model } = resolveActivitySummaryModel(env);
  if (provider !== 'google') {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const [{ generateObject }, { createGoogleGenerativeAI }] = await Promise.all([
    import('ai'),
    import('@ai-sdk/google'),
  ]);

  const google = createGoogleGenerativeAI({ apiKey });
  const modelHandle = google(model);
  const prompt = buildActivitySummaryPrompt(source);

  const result = await generateObject({
    model: modelHandle,
    schema: SUMMARY_SCHEMA,
    system: [
      'You are writing a concise AI summary for a team coordination dashboard.',
      'The output will be shown above the activity feed.',
      'Use only the data supplied in the prompt.',
      'Return plain operational language, not marketing copy.',
      'If the data is sparse, say so in the headline and keep bullets conservative.',
    ].join(' '),
    prompt,
    temperature: 0.2,
  });

  return {
    model: `${provider}/${model}`,
    output: result.object,
  };
}

function buildActivitySummaryDocument({
  teamId,
  source,
  model,
  output,
  sourceFingerprint,
  now = new Date(),
  previousDocument = null,
}) {
  const payload = {
    featureKey: FEATURE_KEY,
    scope: source.scope,
    status: 'ready',
    model,
    sourceFingerprint,
    sourceWindow: source.sourceWindow,
    stats: source.stats,
    goals: source.goals,
    signals: source.signals || null,
    generatedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    headline: output.headline,
    summaryBullets: output.summaryBullets,
    riskFlags: output.riskFlags,
    nextActions: output.nextActions,
    confidence: output.confidence,
  };

  if (output.agent) {
    payload.agent = output.agent;
  }
  if (output.recommendations) {
    payload.recommendations = output.recommendations;
  }

  if (previousDocument && previousDocument.error) {
    payload.error = null;
  }

  return payload;
}

function buildActivitySummaryErrorDocument({
  teamId,
  source,
  model = null,
  error,
  sourceFingerprint,
  now = new Date(),
  previousDocument = null,
}) {
  return {
    ...(previousDocument || {}),
    featureKey: FEATURE_KEY,
    scope: source.scope,
    status: 'error',
    model,
    sourceFingerprint,
    sourceWindow: source.sourceWindow,
    stats: source.stats,
    goals: source.goals,
    generatedAt: previousDocument?.generatedAt || null,
    updatedAt: now.toISOString(),
    error: error instanceof Error ? error.message : String(error || 'Unknown error'),
  };
}

module.exports = {
  DEFAULT_MODEL,
  FEATURE_KEY,
  MODEL_ALLOWLIST,
  RECOMMENDATION_ITEM_SCHEMA,
  SUMMARY_SCHEMA,
  STALE_THRESHOLD_MS,
  ABANDON_THRESHOLD_MS,
  buildActivitySummaryDocument,
  buildActivitySummaryErrorDocument,
  buildActivitySummaryFingerprint,
  buildActivitySummaryPrompt,
  buildActivitySummarySource,
  computeCloseCandidates,
  computeNextCandidates,
  generateActivitySummary,
  getAiApiKey,
  normalizePlan,
  resolveActivitySummaryModel,
};

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
const SUMMARY_SCHEMA = z.object({
  headline: z.string().min(1).max(160),
  summaryBullets: z.array(z.string().min(1).max(220)).min(1).max(4),
  riskFlags: z.array(z.string().min(1).max(220)).max(4),
  nextActions: z.array(z.string().min(1).max(220)).max(4),
  confidence: z.number().min(0).max(1),
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

function normalizePlan(plan) {
  if (!plan) return null;
  return {
    id: plan.id || null,
    slug: String(plan.slug || plan.id || '').trim() || 'untitled',
    status: String(plan.status || 'unknown').trim(),
    author: String(plan.author || 'unknown').trim(),
    summary: String(plan.summary || '').trim(),
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

  return {
    scope: {
      kind: 'team',
      id: teamId,
      name: teamName,
    },
    goals: {
      twoWeek: String(twoWeekGoal || '').trim(),
      threeDay: String(threeDayGoal || '').trim(),
    },
    stats: {
      totalPlans: normalizedPlans.length,
      activePlans,
      mergedPlans,
      createdToday,
      contributors: contributors.length,
      contributorNames: contributors,
    },
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
    generatedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    headline: output.headline,
    summaryBullets: output.summaryBullets,
    riskFlags: output.riskFlags,
    nextActions: output.nextActions,
    confidence: output.confidence,
  };

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
  SUMMARY_SCHEMA,
  buildActivitySummaryDocument,
  buildActivitySummaryErrorDocument,
  buildActivitySummaryFingerprint,
  buildActivitySummaryPrompt,
  buildActivitySummarySource,
  generateActivitySummary,
  getAiApiKey,
  normalizePlan,
  resolveActivitySummaryModel,
};

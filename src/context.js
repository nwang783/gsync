import { formatRelativeTime } from './format.js';

const DEFAULT_MEMORY_MAX_AGE_HOURS = 72;

export function generateContext(twoWeek, threeDay, activePlans, recentPlans) {
  const now = new Date().toISOString();
  const lines = [];

  lines.push('# gsync Team Context');
  lines.push(`Last synced: ${now}`);
  lines.push('');

  // 2-Week Goal
  lines.push('## 2-Week Goal');
  lines.push(twoWeek?.content || '(not set)');
  lines.push('');

  // 3-Day Target
  lines.push('## 3-Day Target');
  lines.push(threeDay?.content || '(not set)');
  lines.push('');

  // Active Plans
  lines.push('## Active Plans');
  if (activePlans.length === 0) {
    lines.push('(no active plans)');
  } else {
    for (const plan of activePlans) {
      lines.push('');
      const lastUpdate = formatRelativeTime(plan.updatedAt);
      lines.push(`### ${plan.author} — ${plan.slug} (${plan.status}, last update ${lastUpdate})`);
      lines.push(`Summary: ${plan.summary}`);
      lines.push(`Alignment: ${plan.alignment}`);
      lines.push(`Touches: ${Array.isArray(plan.touches) ? plan.touches.join(', ') : plan.touches}`);
      lines.push(`Out of scope: ${plan.outOfScope}`);
      lines.push(`PR: ${plan.prUrl || '—'}`);
      lines.push(`Revision: ${plan.revision || 0}`);
    }
  }
  lines.push('');

  lines.push('## Recent Plans');
  if (recentPlans.length === 0) {
    lines.push('(no recent plans)');
  } else {
    for (const plan of recentPlans) {
      lines.push(`- ${plan.author} — ${plan.slug} (${plan.status}, updated ${formatRelativeTime(plan.updatedAt)}): ${plan.summary}`);
    }
  }
  lines.push('');

  lines.push('## Recent Activity');
  const activities = [];

  for (const plan of recentPlans) {
    const createdMs = toMillis(plan.createdAt);
    if (createdMs) {
      activities.push({
        time: createdMs,
        text: `${plan.author} created ${plan.slug}`,
      });
    }

    if (plan.updates) {
      for (const u of plan.updates) {
        const uMs = toMillis(u.timestamp);
        if (uMs) {
          activities.push({
            time: uMs,
            text: `${u.author} updated ${plan.slug}: "${u.note}"`,
          });
        }
      }
    }
  }

  activities.sort((a, b) => b.time - a.time);

  if (activities.length === 0) {
    lines.push('(no recent activity)');
  } else {
    for (const a of activities) {
      const rel = formatRelativeTime({ seconds: Math.floor(a.time / 1000) });
      lines.push(`- ${rel} — ${a.text}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

export function buildCompiledContextPack({ twoWeek, threeDay, activePlans, recentPlans, memory, now = new Date() }) {
  const memoryStatus = getMemoryCompleteness(memory);
  const compiledAt = now.toISOString();
  const memoryRevision = Number(memory?.revision || 0);
  const staleAfter = new Date(now.getTime() + (DEFAULT_MEMORY_MAX_AGE_HOURS * 60 * 60 * 1000)).toISOString();
  const baseContext = generateContext(twoWeek, threeDay, activePlans, recentPlans);

  if (memoryStatus !== 'ready') {
    return {
      state: 'missing',
      reason: 'Approved company brief and project brief are required before compiling reviewer context.',
      compiledAt,
      staleAfter,
      memoryRevision,
      markdown: '',
    };
  }

  const lines = [
    '# gsync Compiled Context Pack',
    `Compiled at: ${compiledAt}`,
    `Memory revision: ${memoryRevision}`,
    '',
    '## Approved Company Brief',
    memory.companyBrief.content,
    '',
    '## Approved Project Brief',
    memory.projectBrief.content,
    '',
    '## Approved Decision Log',
  ];

  const decisions = Array.isArray(memory.decisionLog?.entries) ? memory.decisionLog.entries : [];
  if (decisions.length === 0) {
    lines.push('(no approved decisions yet)');
  } else {
    for (const entry of decisions) {
      const decidedAt = entry.decidedAt || '(date not set)';
      lines.push(`- [${decidedAt}] ${entry.summary}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(baseContext);

  return {
    state: 'fresh',
    reason: null,
    compiledAt,
    staleAfter,
    memoryRevision,
    markdown: lines.join('\n'),
  };
}

export function buildSyncContextContent({ twoWeek, threeDay, activePlans, recentPlans, memory, now = new Date() }) {
  const compiledPack = buildCompiledContextPack({ twoWeek, threeDay, activePlans, recentPlans, memory, now });
  const contextContent = compiledPack.state === 'fresh'
    ? compiledPack.markdown
    : generateContext(twoWeek, threeDay, activePlans, recentPlans);

  return { contextContent, compiledPack };
}

export function assertReviewerContextReady(compiledPack, latestMemoryUpdatedAt, now = new Date()) {
  if (!compiledPack) {
    throw new Error('Reviewer context unavailable: compiled context pack is missing. Run `gsync sync` after approving memory drafts.');
  }

  if (compiledPack.state !== 'fresh') {
    throw new Error(`Reviewer context unavailable: compiled context pack is ${compiledPack.state}. ${compiledPack.reason || 'Approve memory and recompile.'}`);
  }

  const staleAfterMs = toMillis(compiledPack.staleAfter);
  if (staleAfterMs && staleAfterMs <= now.getTime()) {
    throw new Error('Reviewer context unavailable: compiled context pack is stale (expired). Run `gsync sync` to refresh approved memory.');
  }

  const compiledAtMs = toMillis(compiledPack.compiledAt);
  const latestMemoryMs = toMillis(latestMemoryUpdatedAt);
  if (latestMemoryMs && compiledAtMs && latestMemoryMs > compiledAtMs) {
    throw new Error('Reviewer context unavailable: approved memory changed after the last compile. Run `gsync sync` to recompile.');
  }

  return compiledPack;
}

function getMemoryCompleteness(memory) {
  if (!memory?.companyBrief?.content) return 'missing';
  if (!memory?.projectBrief?.content) return 'missing';
  return 'ready';
}

function toMillis(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toMillis) return timestamp.toMillis();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  if (timestamp instanceof Date) return timestamp.getTime();
  return new Date(timestamp).getTime();
}

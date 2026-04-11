import { formatRelativeTime } from './format.js';

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
  const compiledAt = now.toISOString();
  const memoryRevision = Number(memory?.revision || 0);
  const baseContext = generateContext(twoWeek, threeDay, activePlans, recentPlans);
  const memories = Array.isArray(memory?.memories) ? memory.memories : Array.isArray(memory?.entries) ? memory.entries : [];

  const lines = [
    '# gsync Compiled Context Pack',
    `Compiled at: ${compiledAt}`,
    `Memory revision: ${memoryRevision}`,
    '',
    '## Memories',
  ];

  if (memories.length === 0) {
    lines.push('(no memories yet)');
    lines.push('');
  } else {
    for (const [index, entry] of memories.entries()) {
      const title = entry.title || 'Untitled';
      lines.push(`### Memory ${index + 1}: ${title}`);
      lines.push(`- Created by: ${entry.createdBy || entry.updatedBy || 'unknown'}`);
      const createdAt = formatMemoryTimestamp(entry.createdAt || entry.updatedAt);
      if (createdAt) {
        lines.push(`- Created at: ${createdAt}`);
      }
      if (Array.isArray(entry.tags) && entry.tags.length > 0) {
        lines.push(`- Tags: ${entry.tags.join(', ')}`);
      }
      lines.push('');
      lines.push(entry.content || '(empty memory)');
      lines.push('');
    }
  }

  const latest = memory?.latestMemory || memories.at(-1) || null;
  lines.push('## Latest Memory');
  if (latest) {
    lines.push(`- Title: ${latest.title || 'Untitled'}`);
    lines.push(`- By: ${latest.createdBy || latest.updatedBy || 'unknown'}`);
    const latestAt = formatMemoryTimestamp(latest.createdAt || latest.updatedAt);
    if (latestAt) {
      lines.push(`- At: ${latestAt}`);
    }
  } else {
    lines.push('(no memories yet)');
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(baseContext);

  return {
    state: 'fresh',
    reason: null,
    compiledAt,
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

export function assertReviewerContextReady(compiledPack, memoryState) {
  if (!compiledPack) {
    throw new Error('Reviewer context unavailable: compiled context pack is missing. Run `gsync sync` after updating memory.');
  }

  if (compiledPack.state !== 'fresh') {
    throw new Error(`Reviewer context unavailable: compiled context pack is ${compiledPack.state}. ${compiledPack.reason || 'Update memory and recompile.'}`);
  }

  const compiledRevision = Number(compiledPack.memoryRevision);
  if (!Number.isFinite(compiledRevision)) {
    throw new Error('Reviewer context unavailable: compiled context pack is outdated. Run `gsync sync` to refresh memory.');
  }

  const currentRevision = Number(memoryState?.revision || 0);
  if (compiledRevision !== currentRevision) {
    throw new Error('Reviewer context unavailable: memory changed after the last sync. Run `gsync sync` to refresh memory.');
  }

  return compiledPack;
}

function formatMemoryTimestamp(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
  if (typeof timestamp.toMillis === 'function') return new Date(timestamp.toMillis()).toISOString();
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000).toISOString();
  if (typeof timestamp === 'string') return timestamp;
  return String(timestamp);
}

function toMillis(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toMillis) return timestamp.toMillis();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  if (timestamp instanceof Date) return timestamp.getTime();
  return new Date(timestamp).getTime();
}

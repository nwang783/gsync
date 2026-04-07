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

function toMillis(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toMillis) return timestamp.toMillis();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  if (timestamp instanceof Date) return timestamp.getTime();
  return new Date(timestamp).getTime();
}

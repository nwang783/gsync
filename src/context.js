import { formatRelativeTime } from './format.js';

export function generateContext(twoWeek, threeDay, activePlans, allPlans) {
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
    }
  }
  lines.push('');

  // Recent Activity (last 24h)
  lines.push('## Recent Activity (last 24h)');
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const activities = [];

  for (const plan of allPlans) {
    // Plan creation
    const createdMs = toMillis(plan.createdAt);
    if (createdMs && createdMs > cutoff) {
      activities.push({
        time: createdMs,
        text: `${plan.author} created ${plan.slug}`,
      });
    }

    // Updates
    if (plan.updates) {
      for (const u of plan.updates) {
        const uMs = toMillis(u.timestamp);
        if (uMs && uMs > cutoff) {
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

export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'unknown';

  let ms;
  if (timestamp.toMillis) {
    ms = timestamp.toMillis();
  } else if (timestamp.seconds) {
    ms = timestamp.seconds * 1000;
  } else if (timestamp instanceof Date) {
    ms = timestamp.getTime();
  } else {
    ms = new Date(timestamp).getTime();
  }

  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function formatPlanSummary(plan) {
  const prPart = plan.prUrl ? ` | PR: ${plan.prUrl}` : '';
  const lastUpdate = formatRelativeTime(plan.updatedAt);
  return `${plan.author} — ${plan.slug} (${plan.status}, last update ${lastUpdate})${prPart}`;
}

export function formatPlanDetail(plan) {
  const lines = [];
  lines.push(`Plan: ${plan.slug} [${plan.id}]`);
  lines.push(`Author: ${plan.author}`);
  lines.push(`Status: ${plan.status}`);
  lines.push(`Summary: ${plan.summary}`);
  lines.push(`Alignment: ${plan.alignment}`);
  lines.push(`Touches: ${Array.isArray(plan.touches) ? plan.touches.join(', ') : plan.touches}`);
  lines.push(`Out of scope: ${plan.outOfScope}`);
  lines.push(`PR: ${plan.prUrl || '—'}`);
  lines.push(`Created: ${formatRelativeTime(plan.createdAt)}`);
  lines.push(`Updated: ${formatRelativeTime(plan.updatedAt)}`);

  if (plan.updates && plan.updates.length > 0) {
    lines.push('');
    lines.push('Updates:');
    for (const u of plan.updates) {
      const time = formatRelativeTime(u.timestamp);
      lines.push(`  - ${time} — ${u.author}: "${u.note}"`);
    }
  }

  return lines.join('\n');
}

export function parseDuration(str) {
  if (!str) return 24 * 60 * 60 * 1000; // default 24h

  const match = str.match(/^(\d+)(m|h|d|w)$/);
  if (!match) return 24 * 60 * 60 * 1000;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

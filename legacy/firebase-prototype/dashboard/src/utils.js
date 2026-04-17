export function relativeTime(date) {
  const parsed = toDate(date);
  if (!parsed) return '';
  const now = Date.now();
  const ts = parsed.getTime();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

export function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function isStale(updatedAt) {
  const date = toDate(updatedAt);
  if (!date) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - date.getTime() > sevenDays;
}

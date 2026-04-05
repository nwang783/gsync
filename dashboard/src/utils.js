export function relativeTime(date) {
  if (!date) return '';
  const now = Date.now();
  const ts = date instanceof Date ? date.getTime() : date.toDate?.().getTime?.() ?? date;
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
  return null;
}

export function isStale(updatedAt) {
  const date = toDate(updatedAt);
  if (!date) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - date.getTime() > sevenDays;
}

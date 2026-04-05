import { isStale } from '../utils.js';

export default function StaleBadge({ updatedAt }) {
  if (!isStale(updatedAt)) return null;
  return <span className="stale-badge">⚠ Stale</span>;
}

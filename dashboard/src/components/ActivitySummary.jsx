import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime, toDate } from '../utils.js';
import InsightCard from './InsightCard.jsx';

const FEATURE_KEY = 'activity-summary';

export default function ActivitySummary({ teamId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(
      doc(db, 'teams', teamId, 'insights', FEATURE_KEY),
      (snap) => {
        setSummary(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [teamId]);

  const generatedAt = toDate(summary?.generatedAt || summary?.updatedAt);
  const modelLabel = summary?.model || 'google/gemini-3.1-flash-lite-preview';
  const confidence = typeof summary?.confidence === 'number'
    ? `${Math.round(summary.confidence * 100)}% confidence`
    : null;
  const statusLabel = summary?.status === 'error'
    ? 'stale'
    : summary?.status === 'ready'
      ? 'live'
      : null;

  const metaParts = [];
  if (generatedAt) metaParts.push(`refreshed ${relativeTime(generatedAt)}`);
  if (modelLabel) metaParts.push(modelLabel);
  if (confidence) metaParts.push(confidence);
  if (summary?.sourceWindow?.recentActivityCount != null) {
    metaParts.push(`${summary.sourceWindow.recentActivityCount} events`);
  }
  const meta = metaParts.join(' · ');

  return (
    <InsightCard
      title="## ai summary"
      statusLabel={statusLabel}
      loading={loading}
      error={error || summary?.error || null}
      emptyText="The summary will appear after the first activity update."
      headline={summary?.headline || null}
      bullets={Array.isArray(summary?.summaryBullets) ? summary.summaryBullets : []}
      riskFlags={Array.isArray(summary?.riskFlags) ? summary.riskFlags : []}
      nextActions={Array.isArray(summary?.nextActions) ? summary.nextActions : []}
      meta={meta}
    />
  );
}

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime } from '../utils.js';

export default function MemoryPanel({ teamId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'teams', teamId, 'memory', 'summary'),
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

  return (
    <section className="update-feed" aria-label="memory panel">
      <h2>## company memory</h2>
      {loading && <div className="empty-state">loading memory...</div>}
      {error && <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>}
      {!loading && !error && !summary && (
        <div className="empty-state">No memory summary yet. Approve drafts and run gsync sync.</div>
      )}
      {!loading && !error && summary && (
        <div className="feed-list">
          <div className="feed-item">
            <strong>approved strategy</strong>
            <span>
              company brief: {summary.approved?.companyBrief?.title || 'missing'} · project brief: {summary.approved?.projectBrief?.title || 'missing'} · decisions: {summary.approved?.decisionCount || 0}
            </span>
          </div>
          <div className="feed-item">
            <strong>planning evidence (drafts)</strong>
            <span>{Array.isArray(summary.drafts) ? summary.drafts.filter((item) => item.state === 'draft').length : 0} open draft(s)</span>
          </div>
          <div className="feed-item">
            <strong>compiled context pack</strong>
            <span>
              state: {summary.status?.compiledState || 'missing'}
              {summary.status?.compiledAt && ` · compiled ${relativeTime(summary.status.compiledAt)}`}
            </span>
          </div>
          {Array.isArray(summary.drafts) && summary.drafts.length > 0 && (
            <div className="feed-item" style={{ display: 'block' }}>
              <strong>draft conversations</strong>
              <div style={{ marginTop: '6px' }}>
                {summary.drafts.slice(0, 6).map((item) => (
                  <div key={item.id}>
                    - {item.title} ({item.state}{item.promotedTo ? ` → ${item.promotedTo}` : ''})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

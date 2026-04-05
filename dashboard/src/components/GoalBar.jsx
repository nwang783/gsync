import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime } from '../utils.js';

export default function GoalBar({ teamId }) {
  const [twoWeek, setTwoWeek] = useState(null);
  const [threeDay, setThreeDay] = useState(null);
  const [error, setError] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsub2w = onSnapshot(
      doc(db, 'teams', teamId, 'meta', '2week'),
      (snap) => setTwoWeek(snap.exists() ? snap.data() : null),
      (err) => setError(err.message),
    );
    const unsub3d = onSnapshot(
      doc(db, 'teams', teamId, 'meta', '3day'),
      (snap) => setThreeDay(snap.exists() ? snap.data() : null),
      (err) => setError(err.message),
    );
    return () => {
      unsub2w();
      unsub3d();
    };
  }, [teamId]);

  return (
    <div className="goal-bar">
      {error && <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px' }}>{error}</div>}
      <GoalCard label="## 2-week goal" variant="primary" data={twoWeek} />
      <GoalCard label="## 3-day target" variant="secondary" data={threeDay} />
    </div>
  );
}

function GoalCard({ label, variant, data }) {
  return (
    <div className={`goal-card goal-card--${variant}`}>
      <div className="goal-label">{label}</div>
      {data ? (
        <>
          <div className="goal-content">{data.content}</div>
          <div className="goal-meta">
            Updated {relativeTime(data.updatedAt)}
            {data.updatedBy && ` by ${data.updatedBy}`}
          </div>
        </>
      ) : (
        <div className="goal-content not-set">not set</div>
      )}
    </div>
  );
}

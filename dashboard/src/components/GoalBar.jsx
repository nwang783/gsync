import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime } from '../utils.js';

export default function GoalBar({ teamId }) {
  const [twoWeek, setTwoWeek] = useState(null);
  const [threeDay, setThreeDay] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
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
    <>
      <div className="goal-bar">
        {error && <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px' }}>{error}</div>}
        <GoalCard label="## 2-week goal" variant="primary" data={twoWeek} onClick={() => setSelected({ label: '2-week goal', data: twoWeek })} />
        <GoalCard label="## 3-day target" variant="secondary" data={threeDay} onClick={() => setSelected({ label: '3-day target', data: threeDay })} />
      </div>
      {selected && (
        <GoalDetail label={selected.label} data={selected.data} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function GoalCard({ label, variant, data, onClick }) {
  return (
    <div className={`goal-card goal-card--${variant}`} onClick={onClick}>
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

function GoalDetail({ label, data, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="goal-detail-label">{label}</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        {data ? (
          <>
            <div className="modal-section">
              <div className="section-label">content</div>
              <div className="section-value">{data.content}</div>
            </div>
            <div className="modal-section">
              <div className="section-label">last updated</div>
              <div className="section-value">
                {relativeTime(data.updatedAt)}
                {data.updatedBy && ` by ${data.updatedBy}`}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">no goal set yet</div>
        )}
      </div>
    </div>
  );
}

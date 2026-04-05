import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime } from '../utils.js';
import StaleBadge from './StaleBadge.jsx';

export default function TeamColumns({ teamId, onSelectPlan }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'teams', teamId, 'plans'),
      where('status', 'in', ['draft', 'in-progress', 'review']),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPlans(docs);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return unsub;
  }, [teamId]);

  const byAuthor = {};
  for (const plan of plans) {
    const author = plan.author || 'unknown';
    if (!byAuthor[author]) byAuthor[author] = [];
    byAuthor[author].push(plan);
  }

  const authors = Object.keys(byAuthor).sort();

  if (loading) {
    return <div className="empty-state">Loading plans...</div>;
  }

  if (error) {
    return <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '4px' }}>{error}</div>;
  }

  if (authors.length === 0) {
    return <div className="empty-state">No active plans</div>;
  }

  return (
    <div className="team-columns">
      {authors.map((author) => (
        <div key={author} className="author-column">
          <div className="author-name">{author}</div>
          <div className="plan-cards">
            {byAuthor[author].map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onClick={() => onSelectPlan(plan.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanCard({ plan, onClick }) {
  const statusClass = (plan.status || 'draft').replace(/\s+/g, '-');
  const touches = Array.isArray(plan.touches) ? plan.touches : [];

  return (
    <div className="plan-card" onClick={onClick}>
      <div className="plan-card-header">
        <span className="slug">{plan.slug || plan.id}</span>
        <span className={`status-badge ${statusClass}`}>{plan.status}</span>
        <StaleBadge updatedAt={plan.updatedAt} />
      </div>
      {plan.summary && <div className="summary">{plan.summary}</div>}
      {plan.alignment && <div className="alignment">🎯 {plan.alignment}</div>}
      {touches.length > 0 && (
        <div className="touches">
          {touches.map((t, i) => (
            <span key={i} className="touch-tag">{t}</span>
          ))}
        </div>
      )}
      <div className="card-footer">
        <span>{relativeTime(plan.updatedAt)}</span>
        {plan.prUrl && /^https?:\/\//i.test(plan.prUrl) && (
          <a
            href={plan.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            PR ↗
          </a>
        )}
      </div>
    </div>
  );
}

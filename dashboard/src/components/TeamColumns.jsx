import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime } from '../utils.js';
import { getPlanGoalTags } from '../lib/planTags.js';

function isActivePlanStatus(status) {
  return status !== 'merged' && status !== 'abandoned';
}

function getUpdatedAtMs(updatedAt) {
  if (!updatedAt) return 0;
  if (updatedAt instanceof Date) return updatedAt.getTime();
  if (typeof updatedAt.toDate === 'function') return updatedAt.toDate().getTime();
  if (typeof updatedAt.seconds === 'number') return updatedAt.seconds * 1000;
  if (typeof updatedAt === 'number') return updatedAt;
  return 0;
}

function getLatestUpdate(updates) {
  if (!Array.isArray(updates) || updates.length === 0) return null;
  return [...updates].sort((a, b) => getUpdatedAtMs(b.timestamp) - getUpdatedAtMs(a.timestamp))[0] || null;
}

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
    const plansRef = collection(db, 'teams', teamId, 'plans');
    const unsub = onSnapshot(plansRef, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((plan) => isActivePlanStatus(plan.status));
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

  for (const author of Object.keys(byAuthor)) {
    byAuthor[author].sort((a, b) => getUpdatedAtMs(b.updatedAt) - getUpdatedAtMs(a.updatedAt));
  }

  const authors = Object.keys(byAuthor).sort();
  const showEmptyPartnerSlot = authors.length === 1;

  if (loading) {
    return <div className="empty-state">loading...</div>;
  }

  if (error) {
    return <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '4px' }}>{error}</div>;
  }

  if (authors.length === 0) {
    return <div className="empty-state">no active plans</div>;
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
      {showEmptyPartnerSlot && <EmptyAuthorColumn />}
    </div>
  );
}

function EmptyAuthorColumn() {
  return (
    <div className="author-column author-column--placeholder" aria-hidden="true">
      <div className="author-name">waiting for another teammate</div>
      <div className="empty-author-card">
        <div className="empty-author-copy">
          The next contributor will appear here once they publish an active plan.
        </div>
        <div className="empty-author-skeleton">
          <div className="skeleton-chip" />
          <div className="skeleton-line skeleton-line--long" />
          <div className="skeleton-line skeleton-line--mid" />
          <div className="skeleton-line skeleton-line--short" />
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, onClick }) {
  const goalTags = getPlanGoalTags(plan);
  const latestUpdate = getLatestUpdate(plan.updates);
  const isGoalUpdateCard = goalTags.length > 0 && latestUpdate;

  return (
    <button
      type="button"
      className={`plan-card ${isGoalUpdateCard ? 'plan-card--update' : ''}`}
      onClick={onClick}
    >
      <div className="plan-card-header">
        <span className="slug">{plan.slug || plan.id}</span>
        {isGoalUpdateCard && <span className="plan-update-badge">plan update</span>}
      </div>
      <div className="plan-card-main">
        {goalTags.length > 0 && (
          <div className="plan-goal-tags">
            {goalTags.map((tag) => (
              <span key={tag} className={`plan-goal-tag plan-goal-tag--${tag.startsWith('2') ? '2week' : '3day'}`}>{tag}</span>
            ))}
          </div>
        )}
        {isGoalUpdateCard ? (
          <>
            <div className="plan-update-note">{latestUpdate.note || 'Updated goal-linked plan'}</div>
            <div className="plan-update-meta">
              Updated {relativeTime(latestUpdate.timestamp)}
              {latestUpdate.author && ` by ${latestUpdate.author}`}
            </div>
          </>
        ) : (
          plan.summary && <div className="summary">{plan.summary}</div>
        )}
      </div>
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
    </button>
  );
}

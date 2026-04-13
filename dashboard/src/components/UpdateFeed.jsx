import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime, toDate } from '../utils.js';
import ActivitySummary from './ActivitySummary.jsx';

function isActivePlanStatus(status) {
  return status !== 'merged' && status !== 'abandoned';
}

export default function UpdateFeed({ teamId, onSelectPlan = null }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = collection(db, 'teams', teamId, 'plans');
    const unsub = onSnapshot(q, (snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return unsub;
  }, [teamId]);

  useEffect(() => {
    setVisibleCount(10);
  }, [teamId, plans.length]);

  const events = [];

  for (const plan of plans) {
    if (plan.createdAt) {
      events.push({
        time: toDate(plan.createdAt),
        author: plan.author,
        slug: plan.slug || plan.id,
        planId: plan.id,
        action: 'created',
        note: plan.summary || '',
      });
    }

    if (Array.isArray(plan.updates)) {
      for (const u of plan.updates) {
        events.push({
          time: toDate(u.timestamp),
          author: u.author || plan.author,
          slug: plan.slug || plan.id,
          planId: plan.id,
          action: 'updated',
          note: u.note || '',
        });
      }
    }
  }

  events.sort((a, b) => {
    const ta = a.time?.getTime() ?? 0;
    const tb = b.time?.getTime() ?? 0;
    return tb - ta;
  });

  const display = events.slice(0, visibleCount);
  const hasMore = events.length > display.length;

  const stats = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;
    const createdToday = plans.filter(p => toDate(p.createdAt) > now - DAY).length;
    const active = plans.filter(p => isActivePlanStatus(p.status)).length;
    const merged = plans.filter(p => p.status === 'merged').length;
    const contributors = new Set(plans.map(p => p.author).filter(Boolean)).size;
    return { createdToday, active, merged, contributors };
  }, [plans]);

  if (loading) {
    return (
      <div className="update-feed">
        <h2>## activity</h2>
        <div className="empty-state">loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="update-feed">
        <h2>## activity</h2>
        <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>
      </div>
    );
  }

  if (display.length === 0) {
    return (
      <div className="update-feed">
        <h2>## activity</h2>
        <div className="empty-state">no activity yet</div>
      </div>
    );
  }

  return (
    <div className="update-feed">
      <h2>## activity</h2>

      <div className="activity-stats">
        <span className="stat-chip"><strong>{stats.active}</strong> active</span>
        <span className="stat-chip"><strong>{stats.merged}</strong> merged</span>
        <span className="stat-chip"><strong>{stats.createdToday}</strong> new today</span>
        <span className="stat-chip"><strong>{stats.contributors}</strong> contributor{stats.contributors !== 1 ? 's' : ''}</span>
      </div>

      <ActivitySummary teamId={teamId} />

      <div className="feed-list">
        {display.map((ev, i) => (
          <button key={i} type="button" className="feed-item" onClick={() => onSelectPlan && onSelectPlan(ev.planId)}>
            <span className="feed-time">{relativeTime(ev.time)}</span>
            <span>
              <span className="feed-author">{ev.author}</span>{' '}
              <span className="feed-action">{ev.action}</span>{' '}
              <span className="feed-slug">{ev.slug}</span>
            </span>
          </button>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          className="feed-load-more"
          onClick={() => setVisibleCount((count) => count + 10)}
        >
          load 10 more
        </button>
      )}
    </div>
  );
}

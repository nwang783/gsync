import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime, toDate } from '../utils.js';
import StaleBadge from './StaleBadge.jsx';

export default function PlanDetail({ planId, teamId, onClose }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'teams', teamId, 'plans', planId),
      (snap) => {
        setPlan(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [teamId, planId]);

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="empty-state">Loading plan...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '4px' }}>{error}</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const statusClass = (plan.status || 'draft').replace(/\s+/g, '-');
  const touches = Array.isArray(plan.touches) ? plan.touches : [];
  const updates = [...(plan.updates || [])].sort((a, b) => {
    const ta = toDate(a.timestamp)?.getTime() ?? 0;
    const tb = toDate(b.timestamp)?.getTime() ?? 0;
    return ta - tb;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`status-badge ${statusClass}`}>{plan.status}</span>
            <StaleBadge updatedAt={plan.updatedAt} />
          </div>
          <button className="modal-close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="modal-section">
          <div className="section-label">Author</div>
          <div className="section-value">{plan.author || '—'}</div>
        </div>

        {plan.summary && (
          <div className="modal-section">
            <div className="section-label">Summary</div>
            <div className="section-value">{plan.summary}</div>
          </div>
        )}

        {plan.alignment && (
          <div className="modal-section">
            <div className="section-label">Alignment</div>
            <div className="section-value">{plan.alignment}</div>
          </div>
        )}

        {plan.outOfScope && (
          <div className="modal-section">
            <div className="section-label">Out of Scope</div>
            <div className="section-value">{plan.outOfScope}</div>
          </div>
        )}

        {touches.length > 0 && (
          <div className="modal-section">
            <div className="section-label">Touches</div>
            <div className="section-value">
              <div className="touches">
                {touches.map((t, i) => (
                  <span key={i} className="touch-tag">{t}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {plan.prUrl && /^https?:\/\//i.test(plan.prUrl) && (
          <div className="modal-section">
            <div className="section-label">Pull Request</div>
            <div className="section-value">
              <a href={plan.prUrl} target="_blank" rel="noopener noreferrer">
                {plan.prUrl}
              </a>
            </div>
          </div>
        )}

        <div className="modal-section">
          <div className="section-label">Created</div>
          <div className="section-value">{relativeTime(plan.createdAt)}</div>
        </div>

        <div className="modal-section">
          <div className="section-label">Last Updated</div>
          <div className="section-value">{relativeTime(plan.updatedAt)}</div>
        </div>

        {updates.length > 0 && (
          <div className="modal-updates">
            <h3>Updates ({updates.length})</h3>
            {updates.map((u, i) => (
              <div key={i} className="modal-update-item">
                <div className="update-meta">
                  {relativeTime(u.timestamp)}
                  {u.author && ` · ${u.author}`}
                </div>
                {u.note && <div className="update-note">{u.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

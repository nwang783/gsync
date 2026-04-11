import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime, toDate } from '../utils.js';
import StaleBadge from './StaleBadge.jsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function PlanDetail({ planId, teamId, onClose }) {
  const [plan, setPlan] = useState(null);
  const [content, setContent] = useState(null);
  const [contentError, setContentError] = useState(null);
  const [contentLoading, setContentLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    async function loadContent() {
      setContentLoading(true);
      setContentError(null);
      try {
        const snap = await getDoc(doc(db, 'teams', teamId, 'plans', planId, 'content', 'current'));
        if (!cancelled) {
          setContent(snap.exists() ? snap.data() : null);
          setContentLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setContentError(err.message);
          setContentLoading(false);
        }
      }
    }
    loadContent();
    return () => { cancelled = true; };
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

  const metaPanel = (
    <div className="plan-sidebar">
      <div className="plan-sidebar-section">
        <div className="section-label">Author</div>
        <div className="section-value">{plan.author || '—'}</div>
      </div>

      {plan.summary && (
        <div className="plan-sidebar-section">
          <div className="section-label">Summary</div>
          <div className="section-value">{plan.summary}</div>
        </div>
      )}

      {plan.alignment && (
        <div className="plan-sidebar-section">
          <div className="section-label">Alignment</div>
          <div className="section-value">{plan.alignment}</div>
        </div>
      )}

      {plan.outOfScope && (
        <div className="plan-sidebar-section">
          <div className="section-label">Out of Scope</div>
          <div className="section-value">{plan.outOfScope}</div>
        </div>
      )}

      {touches.length > 0 && (
        <div className="plan-sidebar-section">
          <div className="section-label">Touches</div>
          <div className="touches">
            {touches.map((t, i) => (
              <span key={i} className="touch-tag">{t}</span>
            ))}
          </div>
        </div>
      )}

      {plan.prUrl && /^https?:\/\//i.test(plan.prUrl) && (
        <div className="plan-sidebar-section">
          <div className="section-label">Pull Request</div>
          <div className="section-value">
            <a href={plan.prUrl} target="_blank" rel="noopener noreferrer">{plan.prUrl}</a>
          </div>
        </div>
      )}

      <div className="plan-sidebar-section plan-sidebar-times">
        <div>
          <div className="section-label">Created</div>
          <div className="section-value">{relativeTime(plan.createdAt)}</div>
        </div>
        <div>
          <div className="section-label">Updated</div>
          <div className="section-value">{relativeTime(plan.updatedAt)}</div>
        </div>
      </div>

      {updates.length > 0 && (
        <div className="plan-sidebar-section">
          <div className="section-label">Updates ({updates.length})</div>
          <div className="modal-updates">
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
        </div>
      )}
    </div>
  );

  const markdownPanel = (
    <div className="plan-body">
      {contentLoading && <div className="section-value plan-body-loading">Loading plan…</div>}
      {contentError && <div className="section-value">{contentError}</div>}
      {!contentLoading && !contentError && !content?.markdown && (
        <div className="section-value plan-body-empty">No canonical plan document yet.</div>
      )}
      {!contentLoading && !contentError && content?.markdown && (
        <div className="plan-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content.markdown}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );

  return (
    <div className={`modal-overlay${fullscreen ? ' fullscreen' : ''}`} onClick={fullscreen ? undefined : onClose}>
      <div className={`modal-content${fullscreen ? ' fullscreen' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`status-badge ${statusClass}`}>{plan.status}</span>
            <StaleBadge updatedAt={plan.updatedAt} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="modal-close"
              onClick={() => setFullscreen((f) => !f)}
              title={fullscreen ? 'Exit full screen' : 'Full screen'}
              aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {fullscreen ? '↙' : '⛶'}
            </button>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>

        {fullscreen ? (
          <div className="plan-panels">
            {metaPanel}
            {markdownPanel}
          </div>
        ) : (
          <div className="plan-default-layout">
            {metaPanel}
            {markdownPanel}
          </div>
        )}
      </div>
    </div>
  );
}

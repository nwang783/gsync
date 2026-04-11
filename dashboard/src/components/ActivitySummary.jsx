import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime, toDate } from '../utils.js';
import InsightCard from './InsightCard.jsx';
import PMAgentCompanion from './PMAgentCompanion.jsx';

const FEATURE_KEY = 'activity-summary';

const SAFE_GITHUB_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.\-/@]+$/;

// Render an evidence string — detects "pr: owner/repo/pull/N" and makes it a link
function EvidenceItem({ text }) {
  const prMatch = text.match(/^pr:\s*(.+)$/i);
  if (prMatch) {
    const path = prMatch[1].trim();
    const href = path.startsWith('http') ? path : `https://github.com/${path}`;
    if (!SAFE_GITHUB_URL.test(href)) {
      return <span className="pm-agent-card__rec-evidence">{text}</span>;
    }
    const label = href.replace(/^https:\/\/github\.com\//, '');
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="pm-agent-card__rec-evidence pm-agent-card__rec-evidence--link"
      >
        {label}
      </a>
    );
  }
  return <span className="pm-agent-card__rec-evidence">{text}</span>;
}

function ConfirmMarkDialog({ candidate, onConfirm, onCancel, saving }) {
  const verb = candidate.action === 'merged' ? 'merged' : 'abandoned';
  return (
    <div className="pm-confirm-overlay" onClick={onCancel}>
      <div className="pm-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <p className="pm-confirm-dialog__msg">
          Mark <strong>{candidate.slug}</strong> as {verb}?
        </p>
        <div className="pm-confirm-dialog__actions">
          <button className="pm-confirm-dialog__btn pm-confirm-dialog__btn--cancel" onClick={onCancel} disabled={saving}>
            cancel
          </button>
          <button
            className={`pm-confirm-dialog__btn pm-confirm-dialog__btn--confirm pm-confirm-dialog__btn--${verb}`}
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? 'saving…' : `mark ${verb}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function PMAgentPanel({ summary, meta, statusLabel, teamId }) {
  const mood = summary?.agent?.mood || 'idle';
  const closeCandidates = summary?.recommendations?.closeCandidates || [];
  const nextCandidates = summary?.recommendations?.nextCandidates || [];
  const hasRecs = closeCandidates.length > 0 || nextCandidates.length > 0;

  const [confirming, setConfirming] = useState(null); // { planId, slug, action }
  const [saving, setSaving] = useState(false);

  const VALID_ACTIONS = new Set(['merged', 'abandoned']);

  async function handleConfirm() {
    if (!confirming || !teamId) return;
    if (!VALID_ACTIONS.has(confirming.action)) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'teams', teamId, 'plans', confirming.planId), {
        status: confirming.action,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setSaving(false);
      setConfirming(null);
    }
  }

  return (
    <>
    {confirming && (
      <ConfirmMarkDialog
        candidate={confirming}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
        saving={saving}
      />
    )}
    <section className="pm-agent-card" aria-live="polite">
      <div className="pm-agent-card__header">
        <span className="pm-agent-card__title">## pm agent</span>
        <div className="pm-agent-card__header-right">
          {statusLabel && <span className="insight-card__status">{statusLabel}</span>}
        </div>
      </div>

      {/* 2-column layout: mascot | main content (status + recs stacked) */}
      <div className="pm-agent-card__body">
        <div className="pm-agent-card__mascot">
          <PMAgentCompanion mood={mood} />
          <span className="pm-agent-card__mood-label">{mood}</span>
        </div>

        <div className="pm-agent-card__main">
          <div className="pm-agent-card__status-report">
            {summary.headline && (
              <p className="pm-agent-card__headline">{summary.headline}</p>
            )}
            {Array.isArray(summary.summaryBullets) && summary.summaryBullets.length > 0 && (
              <ul className="pm-agent-card__bullets">
                {summary.summaryBullets.map((bullet, i) => (
                  <li key={`${i}-${bullet}`}>{bullet}</li>
                ))}
              </ul>
            )}
            {Array.isArray(summary.riskFlags) && summary.riskFlags.length > 0 && (
              <div className="pm-agent-card__risks">
                <span className="pm-agent-card__section-label">risks</span>
                <ul className="pm-agent-card__bullets pm-agent-card__bullets--compact">
                  {summary.riskFlags.map((flag, i) => (
                    <li key={`${i}-${flag}`}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {hasRecs && (
            <div className="pm-agent-card__recs">
              {closeCandidates.length > 0 && (
                <div className="pm-agent-card__rec-group">
                  <div className="pm-agent-card__rec-label">consider closing</div>
                  <div className="pm-agent-card__rec-chips">
                    {closeCandidates.map((c, i) => (
                      <div key={`${i}-${c.planId}`} className="pm-agent-card__rec-chip pm-agent-card__rec-chip--close">
                        <span className="pm-agent-card__rec-slug">{c.slug}</span>
                        {c.action && (
                          <div className="pm-agent-card__rec-action-row">
                            <span className={`pm-agent-card__rec-action pm-agent-card__rec-action--${c.action}`}>
                              mark {c.action}
                            </span>
                            <button
                              className={`pm-agent-card__rec-mark-btn pm-agent-card__rec-mark-btn--${c.action}`}
                              title={`Mark as ${c.action}`}
                              onClick={() => setConfirming({ planId: c.planId, slug: c.slug, action: c.action })}
                            >
                              ✓
                            </button>
                          </div>
                        )}
                        {Array.isArray(c.evidence) && c.evidence.slice(0, 2).map((e, j) => (
                          <EvidenceItem key={j} text={e} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {nextCandidates.length > 0 && (
                <div className="pm-agent-card__rec-group">
                  <div className="pm-agent-card__rec-label">likely next</div>
                  <div className="pm-agent-card__rec-chips">
                    {nextCandidates.map((c, i) => (
                      <div key={`${i}-${c.planId}`} className="pm-agent-card__rec-chip pm-agent-card__rec-chip--next">
                        <span className="pm-agent-card__rec-slug">{c.slug}</span>
                        {Array.isArray(c.evidence) && c.evidence.slice(0, 2).map((e, j) => (
                          <EvidenceItem key={j} text={e} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {meta && <div className="insight-card__meta">{meta}</div>}
    </section>
    </>
  );
}

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

  const hasPmAgentFields = summary?.agent?.mood != null;

  if (!hasPmAgentFields) {
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

  if (loading) {
    return (
      <section className="pm-agent-card" aria-live="polite">
        <div className="pm-agent-card__header">
          <span className="pm-agent-card__title">## pm agent</span>
        </div>
        <div className="pm-agent-card__body">
          <div className="pm-agent-card__mascot">
            <PMAgentCompanion mood="idle" />
            <span className="pm-agent-card__mood-label">idle</span>
          </div>
          <div className="pm-agent-card__main">
            <div className="insight-card__loading">warming up...</div>
          </div>
        </div>
      </section>
    );
  }

  if (error && !summary?.headline) {
    return (
      <section className="pm-agent-card" aria-live="polite">
        <div className="pm-agent-card__header">
          <span className="pm-agent-card__title">## pm agent</span>
          {statusLabel && <span className="insight-card__status">{statusLabel}</span>}
        </div>
        <div className="pm-agent-card__body">
          <div className="pm-agent-card__mascot">
            <PMAgentCompanion mood="worried" />
            <span className="pm-agent-card__mood-label">worried</span>
          </div>
          <div className="pm-agent-card__main">
            <div className="insight-card__error">{error}</div>
          </div>
        </div>
      </section>
    );
  }

  if (!summary?.headline) {
    return (
      <section className="pm-agent-card" aria-live="polite">
        <div className="pm-agent-card__header">
          <span className="pm-agent-card__title">## pm agent</span>
        </div>
        <div className="pm-agent-card__body">
          <div className="pm-agent-card__mascot">
            <PMAgentCompanion mood="idle" />
            <span className="pm-agent-card__mood-label">idle</span>
          </div>
          <div className="pm-agent-card__main">
            <div className="insight-card__empty">The agent is warming up — it will appear after the first activity update.</div>
          </div>
        </div>
      </section>
    );
  }

  return <PMAgentPanel summary={summary} meta={meta} statusLabel={statusLabel} teamId={teamId} />;
}

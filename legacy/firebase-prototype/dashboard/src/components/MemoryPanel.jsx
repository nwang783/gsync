import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { db } from '../firebase.js';
import { relativeTime, toDate } from '../utils.js';

const TABS = [
  { id: 'overview', label: 'overview' },
  { id: 'memories', label: 'memories' },
];

function useSnapshotCollection(teamId, collectionName) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'teams', teamId, collectionName),
      (snap) => {
        setEntries(snap.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [teamId, collectionName]);

  return { entries, loading, error };
}

function useSnapshotDoc(teamId, docName) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'teams', teamId, 'memory', docName),
      (snap) => {
        setData(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [teamId, docName]);

  return { data, loading, error };
}

function memoryTimestampMillis(entry) {
  const timestamp = entry?.createdAt || entry?.updatedAt || entry?.approvedAt || entry?.decidedAt || null;
  return timestamp ? toDate(timestamp)?.getTime?.() ?? 0 : 0;
}

function memoryTimestamp(entry) {
  return entry?.createdAt || entry?.updatedAt || entry?.approvedAt || entry?.decidedAt || null;
}

function normalizeMemoryEntry(entry, fallback = {}) {
  if (!entry) return null;
  const content = entry.content ?? entry.body ?? entry.detail ?? entry.summary ?? '';
  if (!String(content || '').trim()) return null;

  return {
    id: fallback.id || entry.id || entry.sourceDraftId || `${fallback.source || 'memory'}-${entry.title || entry.summary || 'untitled'}`,
    title: entry.title || entry.summary || fallback.title || 'Untitled',
    content,
    createdAt: memoryTimestamp(entry),
    createdBy: entry.createdBy || entry.approvedBy || entry.decidedBy || null,
    updatedAt: entry.updatedAt || entry.approvedAt || entry.decidedAt || null,
    updatedBy: entry.updatedBy || entry.approvedBy || entry.decidedBy || null,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    source: fallback.source || entry.source || 'memory',
  };
}

function sortTimeline(entries) {
  return [...entries].sort((left, right) => {
    const delta = memoryTimestampMillis(right) - memoryTimestampMillis(left);
    if (delta !== 0) return delta;
    return String(right.title || '').localeCompare(String(left.title || ''));
  });
}

function memoryEntrySignature(entry) {
  const title = String(entry?.title || '').trim().toLowerCase();
  const content = String(entry?.content || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const tags = Array.isArray(entry?.tags)
    ? [...new Set(entry.tags.map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean))].sort().join('|')
    : '';
  const timestamp = memoryTimestamp(entry);
  const dayKey = timestamp ? toDate(timestamp)?.toISOString?.().slice(0, 10) || '' : '';
  return [title, content, tags, dayKey].join('::');
}

function mergeTimelineEntries(...groups) {
  const merged = new Map();

  for (const group of groups) {
    for (const entry of group.filter(Boolean)) {
      const key = memoryEntrySignature(entry);
      const existing = merged.get(key);
      if (!existing || (existing.source?.startsWith('legacy-') && entry.source === 'memories')) {
        merged.set(key, entry);
      }
    }
  }

  return sortTimeline([...merged.values()]);
}

function pickLatestMemory(summary, timelineEntries) {
  return summary?.memories?.latest
    || timelineEntries[0]
    || null;
}

function OverviewTab({ summary, timelineEntries }) {
  const compiledState = summary?.status?.compiledState || 'missing';
  const syncRequired = Boolean(summary?.status?.syncRequired);
  const compiledAt = toDate(summary?.status?.compiledAt);
  const latestMemory = pickLatestMemory(summary, timelineEntries);
  const latestMemoryUpdatedAt = toDate(summary?.status?.latestMemoryUpdatedAt || latestMemory?.updatedAt || latestMemory?.createdAt);
  const memoryCount = summary?.memories?.count ?? summary?.status?.memoryCount ?? timelineEntries.length ?? 0;
  const latestMemoryAt = toDate(latestMemory?.createdAt || latestMemory?.updatedAt);
  const latestMemoryBy = latestMemory?.createdBy || latestMemory?.updatedBy || 'unknown';

  return (
    <div className="memory-overview">
      <div className="memory-stat-row">
        <span className="memory-stat-label">memories</span>
        <span className="memory-stat-value">
          {memoryCount}
        </span>
      </div>
      <div className="memory-stat-row">
        <span className="memory-stat-label">latest memory</span>
        <span className={`memory-stat-value ${latestMemory ? '' : 'memory-stat-value--empty'}`}>
          {latestMemory
            ? `${latestMemory.title || 'Untitled'} · ${latestMemoryBy}${latestMemoryAt ? ` · ${relativeTime(latestMemoryAt)}` : ''}`
            : 'no memories yet'}
        </span>
      </div>
      <div className="memory-stat-row">
        <span className="memory-stat-label">context pack</span>
        <span className="memory-stat-value">
          {syncRequired ? 'sync required' : compiledState}
          {compiledAt && ` · synced ${relativeTime(compiledAt)}`}
        </span>
      </div>
      {latestMemoryUpdatedAt && (
        <div className="memory-stat-row">
          <span className="memory-stat-label">last updated</span>
          <span className="memory-stat-value">{relativeTime(latestMemoryUpdatedAt)}</span>
        </div>
      )}
    </div>
  );
}

function MemoryEntryModal({ entry, onClose }) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className={`modal-overlay${fullscreen ? ' fullscreen' : ''}`} onClick={fullscreen ? undefined : onClose}>
      <div className={`modal-content${fullscreen ? ' fullscreen' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="memory-modal-title">{entry.title || 'Untitled'}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="modal-close"
              onClick={() => setFullscreen((f) => !f)}
              title={fullscreen ? 'Exit full screen' : 'Full screen'}
              aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {fullscreen ? '↙' : '⛶'}
            </button>
            <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>
        <div className="plan-body">
          <div className="plan-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content || ''}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoryTimelineItem({ entry }) {
  const [showModal, setShowModal] = useState(false);
  const timestamp = toDate(memoryTimestamp(entry));
  const timeLabel = relativeTime(timestamp) || 'unknown';

  return (
    <>
      <button type="button" className="feed-item memory-feed-item" onClick={() => setShowModal(true)}>
        <span className="feed-time">{timeLabel}</span>
        <span className="memory-feed-body">
          <span className="memory-feed-headline">
            <span className="feed-author">{entry.createdBy || entry.updatedBy || 'unknown'}</span>{' '}
            <span className="feed-action">added</span>{' '}
            <span className="feed-slug">{entry.title || 'Untitled'}</span>
          </span>
          {entry.tags.length > 0 && (
            <span className="memory-tag-row" aria-label="memory tags">
              {entry.tags.map((tag) => (
                <span key={tag} className="memory-tag-pill">{tag}</span>
              ))}
            </span>
          )}
        </span>
      </button>
      {showModal && <MemoryEntryModal entry={entry} onClose={() => setShowModal(false)} />}
    </>
  );
}

function MemoryTimelineTab({ entries, loading, error, emptyLabel }) {
  if (loading) return <div className="memory-tab-empty">loading...</div>;
  if (error) return <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>;
  if (!entries.length) return <div className="memory-tab-empty">{emptyLabel}</div>;

  return (
    <div className="feed-list memory-timeline">
      {entries.map((entry) => (
        <MemoryTimelineItem key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export default function MemoryPanel({ teamId, headerRight }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

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

  const newMemories = useSnapshotCollection(teamId, 'memories');
  const legacyEntries = useSnapshotCollection(teamId, 'memoryEntries');
  const legacyCompanyBrief = useSnapshotDoc(teamId, 'companyBrief');
  const legacyProjectBrief = useSnapshotDoc(teamId, 'projectBrief');
  const legacyDecisionLog = useSnapshotDoc(teamId, 'decisionLog');

  const timelineEntries = useMemo(() => {
    const newEntries = newMemories.entries.map((entry) => normalizeMemoryEntry(entry, { id: entry.id, source: 'memories' })).filter(Boolean);
    const legacyEntriesOnly = [
      ...legacyEntries.entries.map((entry) => normalizeMemoryEntry(entry, { id: entry.id, source: 'legacy-memoryEntries' })),
      ...(
        legacyCompanyBrief.data?.content
          ? [normalizeMemoryEntry(legacyCompanyBrief.data, { id: 'legacy-companyBrief', title: 'Company brief', source: 'legacy-companyBrief' })]
          : []
      ),
      ...(
        legacyProjectBrief.data?.content
          ? [normalizeMemoryEntry(legacyProjectBrief.data, { id: 'legacy-projectBrief', title: 'Project brief', source: 'legacy-projectBrief' })]
          : []
      ),
      ...(
        Array.isArray(legacyDecisionLog.data?.entries)
          ? legacyDecisionLog.data.entries.map((entry, index) => normalizeMemoryEntry(entry, {
            id: `legacy-decisionLog-${index}`,
            title: entry.summary || 'Decision',
            source: 'legacy-decisionLog',
          }))
          : []
      ),
    ].filter(Boolean);

    return mergeTimelineEntries(newEntries, legacyEntriesOnly);
  }, [
    newMemories.entries,
    legacyEntries.entries,
    legacyCompanyBrief.data,
    legacyProjectBrief.data,
    legacyDecisionLog.data,
  ]);

  const timelineLoading = newMemories.loading
    || legacyEntries.loading
    || legacyCompanyBrief.loading
    || legacyProjectBrief.loading
    || legacyDecisionLog.loading;
  const timelineError = newMemories.error
    || legacyEntries.error
    || legacyCompanyBrief.error
    || legacyProjectBrief.error
    || legacyDecisionLog.error;

  return (
    <section className="memory-panel" aria-label="memory panel">
      <div className="memory-panel__header">
        <h2>## company memory</h2>
        {headerRight}
      </div>

      <div className="memory-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`memory-tab ${activeTab === tab.id ? 'memory-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(loading || timelineLoading) && <div className="memory-tab-empty">loading memory...</div>}
      {error && <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>}

      {!loading && !error && (
        <div className="memory-tab-content">
          {activeTab === 'overview' && (
            timelineEntries.length > 0 || summary
              ? <OverviewTab summary={summary} timelineEntries={timelineEntries} />
              : <div className="memory-tab-empty">No memory yet. Add a memory to start the timeline.</div>
          )}
          {activeTab === 'memories' && (
            <MemoryTimelineTab
              entries={timelineEntries}
              loading={timelineLoading}
              error={timelineError}
              emptyLabel="No memories yet. Add one with the CLI to start the timeline."
            />
          )}
        </div>
      )}
    </section>
  );
}

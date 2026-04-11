import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime, toDate } from '../utils.js';

const TABS = [
  { id: 'overview', label: 'overview' },
  { id: 'company-brief', label: 'company briefs' },
  { id: 'project-brief', label: 'project briefs' },
  { id: 'decisions', label: 'decisions' },
];

function useMemoryCollection(teamId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'teams', teamId, 'memoryEntries'),
      (snap) => {
        setEntries(snap.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [teamId]);

  return { entries, loading };
}

function useMemoryDoc(teamId, docName) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'teams', teamId, 'memory', docName),
      (snap) => {
        setData(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [teamId, docName]);

  return { data, loading };
}

function sortByApprovedAt(entries) {
  return [...entries].sort((a, b) => {
    const left = toDate(a.approvedAt) || toDate(a.createdAt) || toDate(a.updatedAt) || new Date(0);
    const right = toDate(b.approvedAt) || toDate(b.createdAt) || toDate(b.updatedAt) || new Date(0);
    return left - right;
  });
}

function OverviewTab({ summary }) {
  const compiledState = summary?.status?.compiledState || 'missing';
  const syncRequired = Boolean(summary?.status?.syncRequired);
  const compiledAt = toDate(summary?.status?.compiledAt);
  const latestMemoryUpdatedAt = toDate(summary?.status?.latestMemoryUpdatedAt);

  const companyBriefCount = summary?.approved?.companyBriefCount ?? summary?.approved?.companyBrief?.count ?? 0;
  const projectBriefCount = summary?.approved?.projectBriefCount ?? summary?.approved?.projectBrief?.count ?? 0;
  const companyTitle = summary?.approved?.companyBrief?.title;
  const projectTitle = summary?.approved?.projectBrief?.title;
  const decisionCount = summary?.approved?.decisionCount || 0;
  const draftCount = Array.isArray(summary?.drafts)
    ? summary.drafts.filter((d) => d.state === 'draft').length
    : 0;

  return (
    <div className="memory-overview">
      <div className="memory-stat-row">
        <span className="memory-stat-label">company briefs</span>
        <span className={`memory-stat-value ${companyTitle ? '' : 'memory-stat-value--empty'}`}>
          {companyTitle ? `${companyTitle} (${companyBriefCount})` : 'not set'}
        </span>
      </div>
      <div className="memory-stat-row">
        <span className="memory-stat-label">project briefs</span>
        <span className={`memory-stat-value ${projectTitle ? '' : 'memory-stat-value--empty'}`}>
          {projectTitle ? `${projectTitle} (${projectBriefCount})` : 'not set'}
        </span>
      </div>
      <div className="memory-stat-row">
        <span className="memory-stat-label">decisions</span>
        <span className="memory-stat-value">{decisionCount}</span>
      </div>
      <div className="memory-stat-row">
        <span className="memory-stat-label">open drafts</span>
        <span className="memory-stat-value">{draftCount}</span>
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

function DocumentListTab({ entries, loading, emptyLabel }) {
  if (loading) return <div className="memory-tab-empty">loading...</div>;
  if (!entries.length) return <div className="memory-tab-empty">{emptyLabel}</div>;

  return (
    <div className="memory-decisions">
      {entries.map((entry, index) => (
        <div key={entry.id || index} className="memory-decision-entry">
          <div className="memory-decision-summary">{entry.title || 'Untitled'}</div>
          <div className="memory-document-content">{entry.content}</div>
          {entry.approvedAt && (
            <div className="memory-document-meta">
              approved {relativeTime(toDate(entry.approvedAt))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DecisionsTab({ data, loading }) {
  if (loading) return <div className="memory-tab-empty">loading...</div>;
  if (!data?.entries?.length) return <div className="memory-tab-empty">No decisions recorded yet. Approve a draft as a decision via the CLI.</div>;

  return (
    <div className="memory-decisions">
      {data.entries.map((entry, i) => (
        <div key={i} className="memory-decision-entry">
          <div className="memory-decision-summary">{entry.summary}</div>
          {entry.detail && <div className="memory-decision-detail">{entry.detail}</div>}
          {entry.decidedAt && (
            <div className="memory-document-meta">{relativeTime(toDate(entry.decidedAt))}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function MemoryPanel({ teamId }) {
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

  const memoryEntries = useMemoryCollection(teamId);
  const companyBriefLegacy = useMemoryDoc(teamId, 'companyBrief');
  const projectBriefLegacy = useMemoryDoc(teamId, 'projectBrief');
  const companyBriefs = useMemo(() => {
    const entries = sortByApprovedAt(memoryEntries.entries.filter((entry) => entry.kind === 'companyBrief'));
    if (entries.length > 0) return entries;
    if (!companyBriefLegacy.data?.content) return [];
    return [{
      id: 'legacy-companyBrief',
      kind: 'companyBrief',
      title: companyBriefLegacy.data.title || 'Company brief',
      content: companyBriefLegacy.data.content,
      approvedAt: companyBriefLegacy.data.approvedAt || null,
      approvedBy: companyBriefLegacy.data.approvedBy || null,
    }];
  }, [memoryEntries.entries, companyBriefLegacy.data]);

  const projectBriefs = useMemo(() => {
    const entries = sortByApprovedAt(memoryEntries.entries.filter((entry) => entry.kind === 'projectBrief'));
    if (entries.length > 0) return entries;
    if (!projectBriefLegacy.data?.content) return [];
    return [{
      id: 'legacy-projectBrief',
      kind: 'projectBrief',
      title: projectBriefLegacy.data.title || 'Project brief',
      content: projectBriefLegacy.data.content,
      approvedAt: projectBriefLegacy.data.approvedAt || null,
      approvedBy: projectBriefLegacy.data.approvedBy || null,
    }];
  }, [memoryEntries.entries, projectBriefLegacy.data]);

  const decisionLog = useMemoryDoc(teamId, 'decisionLog');

  return (
    <section className="memory-panel" aria-label="memory panel">
      <h2>## company memory</h2>

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

      {loading && <div className="memory-tab-empty">loading memory...</div>}
      {error && <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>}

      {!loading && !error && (
        <div className="memory-tab-content">
          {activeTab === 'overview' && (
            summary ? <OverviewTab summary={summary} /> : <div className="memory-tab-empty">No memory yet. Approve drafts and run gsync sync.</div>
          )}
          {activeTab === 'company-brief' && (
            <DocumentListTab
              entries={companyBriefs}
              loading={memoryEntries.loading || companyBriefLegacy.loading}
              emptyLabel="No company briefs yet. Approve drafts as company briefs via the CLI."
            />
          )}
          {activeTab === 'project-brief' && (
            <DocumentListTab
              entries={projectBriefs}
              loading={memoryEntries.loading || projectBriefLegacy.loading}
              emptyLabel="No project briefs yet. Approve drafts as project briefs via the CLI."
            />
          )}
          {activeTab === 'decisions' && (
            <DecisionsTab data={decisionLog.data} loading={decisionLog.loading} />
          )}
        </div>
      )}
    </section>
  );
}

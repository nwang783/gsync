import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime, toDate } from '../utils.js';

const TABS = [
  { id: 'overview', label: 'overview' },
  { id: 'company-brief', label: 'company brief' },
  { id: 'project-brief', label: 'project brief' },
  { id: 'decisions', label: 'decisions' },
];

function useMemoryDoc(teamId, docName, active) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'teams', teamId, 'memory', docName),
      (snap) => {
        setData(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [teamId, docName, active]);

  return { data, loading };
}

function OverviewTab({ summary }) {
  const compiledState = summary?.status?.compiledState || 'missing';
  const syncRequired = Boolean(summary?.status?.syncRequired);
  const compiledAt = toDate(summary?.status?.compiledAt);
  const latestMemoryUpdatedAt = toDate(summary?.status?.latestMemoryUpdatedAt);

  const companyTitle = summary?.approved?.companyBrief?.title;
  const projectTitle = summary?.approved?.projectBrief?.title;
  const decisionCount = summary?.approved?.decisionCount || 0;
  const draftCount = Array.isArray(summary?.drafts)
    ? summary.drafts.filter((d) => d.state === 'draft').length
    : 0;

  return (
    <div className="memory-overview">
      <div className="memory-stat-row">
        <span className="memory-stat-label">company brief</span>
        <span className={`memory-stat-value ${companyTitle ? '' : 'memory-stat-value--empty'}`}>
          {companyTitle || 'not set'}
        </span>
      </div>
      <div className="memory-stat-row">
        <span className="memory-stat-label">project brief</span>
        <span className={`memory-stat-value ${projectTitle ? '' : 'memory-stat-value--empty'}`}>
          {projectTitle || 'not set'}
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

function DocumentTab({ data, loading, emptyLabel }) {
  if (loading) return <div className="memory-tab-empty">loading...</div>;
  if (!data?.content) return <div className="memory-tab-empty">{emptyLabel}</div>;

  return (
    <div className="memory-document">
      {data.title && <div className="memory-document-title">{data.title}</div>}
      <div className="memory-document-content">{data.content}</div>
      {data.approvedAt && (
        <div className="memory-document-meta">approved {relativeTime(toDate(data.approvedAt))}</div>
      )}
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

  const companyBrief = useMemoryDoc(teamId, 'companyBrief', activeTab === 'company-brief');
  const projectBrief = useMemoryDoc(teamId, 'projectBrief', activeTab === 'project-brief');
  const decisionLog = useMemoryDoc(teamId, 'decisionLog', activeTab === 'decisions');

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
            <DocumentTab data={companyBrief.data} loading={companyBrief.loading} emptyLabel="No company brief yet. Approve a draft as company brief via the CLI." />
          )}
          {activeTab === 'project-brief' && (
            <DocumentTab data={projectBrief.data} loading={projectBrief.loading} emptyLabel="No project brief yet. Approve a draft as project brief via the CLI." />
          )}
          {activeTab === 'decisions' && (
            <DecisionsTab data={decisionLog.data} loading={decisionLog.loading} />
          )}
        </div>
      )}
    </section>
  );
}

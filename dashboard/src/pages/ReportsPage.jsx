import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase.js';
import { relativeTime, toDate } from '../utils.js';

function reportTimeMs(report) {
  return toDate(report.createdAt)?.getTime() ?? 0;
}

function ReportCard({ report }) {
  const createdAt = toDate(report.createdAt);

  return (
    <article className="report-card">
      <div className="report-card__meta">
        <span className={`report-kind report-kind--${report.kind || 'feature'}`}>{report.kind || 'feature'}</span>
        {report.severity && <span className={`report-severity report-severity--${report.severity}`}>{report.severity}</span>}
        <span className="report-time">{createdAt ? relativeTime(createdAt) : 'unknown'}</span>
      </div>
      <h2 className="report-card__title">{report.title || 'Untitled report'}</h2>
      <p className="report-card__body">{report.body || ''}</p>
      <div className="report-card__footer">
        <span>{report.createdBySeatName || 'unknown seat'}</span>
        <span>{report.source || 'cli'}</span>
      </div>
    </article>
  );
}

export default function ReportsPage({ teamId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const reportsQuery = query(
      collection(db, 'teams', teamId, 'reports'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(
      reportsQuery,
      (snap) => {
        setReports(snap.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [teamId]);

  const sortedReports = useMemo(
    () => [...reports].sort((left, right) => reportTimeMs(right) - reportTimeMs(left)),
    [reports],
  );

  if (loading) {
    return <div className="empty-state">loading reports...</div>;
  }

  if (error) {
    return <div className="error-banner" style={{ color: '#fff', background: '#e53e3e', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>;
  }

  if (sortedReports.length === 0) {
    return (
      <div className="reports-empty">
        <p>No reports yet.</p>
        <p>Use `gsync report bug` or `gsync report feature` to push feedback into this queue.</p>
      </div>
    );
  }

  return (
    <section className="reports-page" aria-label="gsync reports">
      <div className="reports-kicker">Honest, lenient feedback about the gsync product itself.</div>
      <div className="reports-list">
        {sortedReports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </section>
  );
}

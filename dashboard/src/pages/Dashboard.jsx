import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import Sidebar from '../components/Sidebar.jsx';
import GoalBar from '../components/GoalBar.jsx';
import TeamColumns from '../components/TeamColumns.jsx';
import UpdateFeed from '../components/UpdateFeed.jsx';
import PlanDetail from '../components/PlanDetail.jsx';
import MemoryPanel from '../components/MemoryPanel.jsx';

export default function Dashboard() {
  const { teamId, role, seatName, logout, loading } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [activePage, setActivePage] = useState('overview');

  if (loading || !teamId) {
    return (
      <div className="page-placeholder">
        <div className="placeholder-icon">&gt;_</div>
        <div className="placeholder-title">loading workspace...</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar active={activePage} onNavigate={setActivePage} onLogout={logout} seatName={seatName} role={role} />

      <main className="app-main">
        <div className="app-header">
          <h1>{activePage === 'overview' ? '# overview' : activePage === 'me' ? '# me' : '# activity'}</h1>
        </div>

        {activePage === 'overview' && (
          <>
            <GoalBar teamId={teamId} onSelectPlan={setSelectedPlanId} />
            <MemoryPanel teamId={teamId} />
            <UpdateFeed teamId={teamId} />
            <section className="overview-history-section">
              <h2>## individual histories</h2>
              <TeamColumns teamId={teamId} onSelectPlan={setSelectedPlanId} />
            </section>
          </>
        )}

        {activePage === 'me' && (
          <div className="page-placeholder">
            <div className="placeholder-icon">...</div>
            <div className="placeholder-title">coming soon</div>
            <div className="placeholder-desc">Your personal workspace will collect your plans, updates, and recent pushes in one place.</div>
            <div className="coming-soon-card" aria-hidden="true">
              <div className="coming-soon-chip">me</div>
              <div className="coming-soon-line coming-soon-line--long" />
              <div className="coming-soon-line coming-soon-line--mid" />
              <div className="coming-soon-line coming-soon-line--short" />
            </div>
          </div>
        )}

        {activePage === 'activity' && (
          <>
            <UpdateFeed teamId={teamId} />
          </>
        )}

        {selectedPlanId && (
          <PlanDetail planId={selectedPlanId} teamId={teamId} onClose={() => setSelectedPlanId(null)} />
        )}
      </main>
    </div>
  );
}

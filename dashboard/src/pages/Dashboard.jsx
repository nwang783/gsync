import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import Sidebar from '../components/Sidebar.jsx';
import GoalBar from '../components/GoalBar.jsx';
import TeamColumns from '../components/TeamColumns.jsx';
import UpdateFeed from '../components/UpdateFeed.jsx';
import PlanDetail from '../components/PlanDetail.jsx';

export default function Dashboard() {
  const { teamId, role, logout } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [activePage, setActivePage] = useState('overview');

  return (
    <div className="app-shell">
      <Sidebar active={activePage} onNavigate={setActivePage} onLogout={logout} />

      <main className="app-main">
        <div className="app-header">
          <h1>{activePage === 'overview' ? '# overview' : activePage === 'me' ? '# me' : '# activity'}</h1>
          <span className="team-id">{teamId}</span>
          {role && <span className="role-badge">{role}</span>}
        </div>

        {activePage === 'overview' && (
          <>
            <GoalBar teamId={teamId} />
            <TeamColumns teamId={teamId} onSelectPlan={setSelectedPlanId} />
            <UpdateFeed teamId={teamId} />
          </>
        )}

        {activePage === 'me' && (
          <div className="page-placeholder">
            <div className="placeholder-icon">&gt;_</div>
            <div className="placeholder-title">your workspace</div>
            <div className="placeholder-desc">your plans, progress, and personal activity will live here.</div>
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

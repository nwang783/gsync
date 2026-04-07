import { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import GoalBar from './components/GoalBar.jsx';
import TeamColumns from './components/TeamColumns.jsx';
import UpdateFeed from './components/UpdateFeed.jsx';
import PlanDetail from './components/PlanDetail.jsx';

const DEFAULT_TEAM_ID = 'default';

function getTeamId() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const team = params.get('team');
    if (team) return team;
  }
  return DEFAULT_TEAM_ID;
}

export default function App() {
  const teamId = getTeamId();
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [activePage, setActivePage] = useState('overview');

  return (
    <div className="app-shell">
      <Sidebar active={activePage} onNavigate={setActivePage} />

      <main className="app-main">
        <div className="app-header">
          <h1>{activePage === 'overview' ? '# overview' : activePage === 'me' ? '# me' : '# activity'}</h1>
          <span className="team-id">{teamId}</span>
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

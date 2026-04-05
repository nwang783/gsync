import { useState } from 'react';
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

  return (
    <div className="app">
      <div className="app-header">
        <h1>gsync</h1>
        <span className="team-id">{teamId}</span>
      </div>
      <GoalBar teamId={teamId} />
      <TeamColumns teamId={teamId} onSelectPlan={setSelectedPlanId} />
      <UpdateFeed teamId={teamId} />
      {selectedPlanId && (
        <PlanDetail planId={selectedPlanId} teamId={teamId} onClose={() => setSelectedPlanId(null)} />
      )}
    </div>
  );
}

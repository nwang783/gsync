import MemoryPanel from '../components/MemoryPanel.jsx';
import JoinCodePanel from '../components/JoinCodePanel.jsx';

export default function CompanyPage({ teamId, role, user, seatName }) {
  return (
    <MemoryPanel
      teamId={teamId}
      headerRight={<JoinCodePanel role={role} user={user} />}
    />
  );
}

import MemoryPanel from '../components/MemoryPanel.jsx';
import JoinCodePanel from '../components/JoinCodePanel.jsx';

export default function CompanyPage({ teamId, role, user, seatName }) {
  return (
    <>
      <MemoryPanel teamId={teamId} />
      <JoinCodePanel teamId={teamId} role={role} user={user} seatName={seatName} />
    </>
  );
}

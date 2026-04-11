import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function LoginPage() {
  const { login, joinTeam } = useAuth();
  const navigate = useNavigate();
  const [seatKey, setSeatKey] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinSeatName, setJoinSeatName] = useState('');
  const [joinError, setJoinError] = useState(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!seatKey.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await login(seatKey.trim());
      navigate('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim() || !joinSeatName.trim()) return;
    setJoinError(null);
    setJoinLoading(true);
    try {
      await joinTeam(joinCode.trim(), joinSeatName.trim());
      navigate('/app');
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="homepage">
      <nav className="hp-nav">
        <Link to="/" className="hp-nav-brand">gsync</Link>
        <div className="hp-nav-links">
          <a href="https://github.com/nwang783/nomergeconflicts" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </nav>

      <div className="hp-login-page">
        <div className="hp-login-card hp-login-card--split">
          <section className="hp-login-panel">
            <h3>Log in to the dashboard</h3>
            <p>
              Paste the durable seat key created during <code>gsync signup</code> or <code>gsync join</code>.
              This is the path for returning humans and agents.
            </p>
            <form className="hp-login-form" onSubmit={handleLogin}>
              <input
                type="password"
                className="hp-login-input"
                placeholder="paste your seat key..."
                value={seatKey}
                onChange={(e) => setSeatKey(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              <button type="submit" className="hp-btn hp-btn--primary" disabled={loading || !seatKey.trim()}>
                {loading ? 'signing in...' : 'Sign in →'}
              </button>
            </form>
            {error && <div className="hp-login-error">{error}</div>}
          </section>

          <section className="hp-login-panel hp-login-panel--join">
            <h3>Join a team with a code</h3>
            <p>
              New teammates can join with a code from an admin. Agents can do the same in the CLI with <code>gsync join</code>.
            </p>
            <form className="hp-login-form hp-login-form--stacked" onSubmit={handleJoin}>
              <input
                type="text"
                className="hp-login-input"
                placeholder="join code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              <input
                type="text"
                className="hp-login-input"
                placeholder="your seat name"
                value={joinSeatName}
                onChange={(e) => setJoinSeatName(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              <button type="submit" className="hp-btn hp-btn--primary" disabled={joinLoading || !joinCode.trim() || !joinSeatName.trim()}>
                {joinLoading ? 'joining...' : 'Join team →'}
              </button>
            </form>
            {joinError && <div className="hp-login-error">{joinError}</div>}
          </section>
        </div>
      </div>

      <footer className="hp-footer">
        <div className="hp-footer-brand">gsync</div>
        <div className="hp-footer-links">
          <a href="https://github.com/nwang783/nomergeconflicts" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://github.com/nwang783/gsync/blob/main/SKILL.md" target="_blank" rel="noopener noreferrer">SKILL.md</a>
        </div>
        <div className="hp-footer-copy">coordination layer for small engineering teams coding with AI</div>
      </footer>
    </div>
  );
}

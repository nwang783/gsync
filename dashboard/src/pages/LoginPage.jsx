import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [seatKey, setSeatKey] = useState('');
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
        <div className="hp-login-card">
          <h3>Log in to the dashboard</h3>
          <p>
            Paste the durable seat key created during <code>gsync signup</code> or <code>gsync join</code>.
            If you do not have one yet, ask your agent to run the gsync skill so it can create or join the team first.
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

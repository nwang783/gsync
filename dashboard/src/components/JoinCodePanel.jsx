import { useEffect, useState } from 'react';

export default function JoinCodePanel({ teamId, role, user, seatName }) {
  const [joinCode, setJoinCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if ((role || '').toLowerCase() !== 'admin') {
    return null;
  }

  const createJoinCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const authToken = await user.getIdToken();
      const res = await fetch(`${apiBaseUrl}/join-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ role: 'member' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create join code');
      }
      setJoinCode(data.joinCode);
      setCopied(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyJoinCode = async () => {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
    } catch {
      setError('Could not copy the join code to the clipboard.');
    }
  };

  return (
    <section className="join-code-panel" aria-label="team onboarding">
      <div className="join-code-panel__header">
        <div>
          <h2>## team onboarding</h2>
          <p>Generate a fresh join code so another teammate can join the same team.</p>
        </div>
        <button type="button" className="hp-btn hp-btn--primary" onClick={createJoinCode} disabled={loading || !user}>
          {loading ? 'creating...' : 'Create join code'}
        </button>
      </div>

      {error && <div className="error-banner join-code-panel__error">{error}</div>}

      {joinCode ? (
        <div className="join-code-panel__result">
          <div className="join-code-panel__label">share this code</div>
          <div className="join-code-panel__code-row">
            <code className="join-code-panel__code">{joinCode}</code>
            <button type="button" className="hp-btn hp-btn--secondary join-code-panel__copy" onClick={copyJoinCode}>
              {copied ? 'copied' : 'copy'}
            </button>
          </div>
          <div className="join-code-panel__meta">
            {seatName ? `${seatName} created this code` : 'This admin created the code'} · teammates who use it will join team {teamId}
          </div>
        </div>
      ) : (
        <div className="join-code-panel__empty">
          No active code generated yet. Create one when you are ready to onboard someone.
        </div>
      )}
    </section>
  );
}

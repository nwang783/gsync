import { useEffect, useState } from 'react';

export default function JoinCodePanel({ role, user }) {
  const [joinCode, setJoinCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if ((role || '').toLowerCase() !== 'admin') return null;

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
      setError('Could not copy to clipboard.');
    }
  };

  return (
    <div className="join-code-widget">
      {joinCode ? (
        <div className="join-code-widget__code-row">
          <span className="join-code-widget__label">join code</span>
          <code className="join-code-widget__code">{joinCode}</code>
          <button type="button" className="join-code-widget__copy" onClick={copyJoinCode}>
            {copied ? 'copied!' : 'copy'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="join-code-widget__create"
          onClick={createJoinCode}
          disabled={loading || !user}
        >
          {loading ? 'creating...' : '+ invite teammate'}
        </button>
      )}
      {error && <div className="join-code-widget__error">{error}</div>}
    </div>
  );
}

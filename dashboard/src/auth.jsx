import { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { db } from './firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not authed
  const [teamId, setTeamId] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Extract custom claims from the token
        firebaseUser.getIdTokenResult().then((result) => {
          setTeamId(result.claims.teamId || null);
          setRole(result.claims.role || null);
        });
      } else {
        setUser(null);
        setTeamId(null);
        setRole(null);
      }
    });
    return unsub;
  }, []);

  const login = async (seatKey) => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const res = await fetch(`${apiBaseUrl}/agent/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatKey }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }
    const data = await res.json();
    const auth = getAuth();
    await signInWithCustomToken(auth, data.firebaseToken);
    setTeamId(data.teamId);
    setRole(data.role);
    return data;
  };

  const logout = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, teamId, role, login, logout, loading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

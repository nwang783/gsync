import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not authed
  const [teamId, setTeamId] = useState(null);
  const [role, setRole] = useState(null);
  const [seatName, setSeatName] = useState(null);
  const [claimsReady, setClaimsReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setClaimsReady(false);
        // Extract custom claims from the token
        firebaseUser.getIdTokenResult()
          .then(async (result) => {
            const nextTeamId = result.claims.teamId || null;
            const nextRole = result.claims.role || null;
            setTeamId(nextTeamId);
            setRole(nextRole);

            if (nextTeamId && firebaseUser.uid) {
              const membershipSnap = await getDoc(doc(db, 'teams', nextTeamId, 'memberships', firebaseUser.uid));
              setSeatName(membershipSnap.exists() ? membershipSnap.data().seatName || firebaseUser.uid : firebaseUser.uid);
            } else {
              setSeatName(firebaseUser.uid || null);
            }
          })
          .catch(() => {
            setTeamId(null);
            setRole(null);
            setSeatName(null);
          })
          .finally(() => {
            setClaimsReady(true);
          });
      } else {
        setUser(null);
        setTeamId(null);
        setRole(null);
        setSeatName(null);
        setClaimsReady(true);
      }
    });
    return unsub;
  }, []);

  const completeLogin = async (data) => {
    await signInWithCustomToken(auth, data.firebaseToken);
    setTeamId(data.teamId);
    setRole(data.role);
    setSeatName(data.seatName || null);
    return data;
  };

  const login = async (seatKey) => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
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
    return completeLogin(data);
  };

  const joinTeam = async (joinCode, seatName) => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const res = await fetch(`${apiBaseUrl}/teams/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode, seatName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Join failed');
    }
    const data = await res.json();
    return completeLogin(data);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, teamId, role, seatName, login, joinTeam, logout, loading: user === undefined || (Boolean(user) && !claimsReady) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || ''}.firebaseapp.com`,
};

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const firestoreHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const authHost = import.meta.env.VITE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

if (useEmulators) {
  const [firestoreName, firestorePortRaw] = firestoreHost.split(':');
  connectFirestoreEmulator(db, firestoreName, Number.parseInt(firestorePortRaw || '8080', 10));
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
}

export { db, auth };

import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  terminate,
  doc,
  collection,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';

let app = null;
let db = null;

export function initFirebase(config) {
  if (app) return;
  app = initializeApp({
    apiKey: config.apiKey,
    projectId: config.projectId,
  });
  db = getFirestore(app);
}

export function getDb() {
  if (!db) {
    throw new Error('Firebase not initialized. Run `gsync init` first.');
  }
  return db;
}

export async function cleanup() {
  if (db) await terminate(db);
  if (app) await deleteApp(app);
  db = null;
  app = null;
}

// --- Team meta ---

export async function getTeamMeta(teamId, type) {
  const ref = doc(getDb(), 'teams', teamId, 'meta', type);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function setTeamMeta(teamId, type, content, userName) {
  const ref = doc(getDb(), 'teams', teamId, 'meta', type);
  await setDoc(ref, {
    content,
    updatedAt: serverTimestamp(),
    updatedBy: userName,
  });
}

// --- Plans ---

export async function createPlan(teamId, planData) {
  const col = collection(getDb(), 'teams', teamId, 'plans');
  const docRef = await addDoc(col, {
    ...planData,
    status: 'in-progress',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updates: [],
  });
  return docRef.id;
}

export async function getPlan(teamId, planId) {
  const ref = doc(getDb(), 'teams', teamId, 'plans', planId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updatePlanNote(teamId, planId, note, userName) {
  const ref = doc(getDb(), 'teams', teamId, 'plans', planId);
  await updateDoc(ref, {
    updates: arrayUnion({
      note,
      author: userName,
      timestamp: Timestamp.now(),
    }),
    updatedAt: serverTimestamp(),
  });
}

const VALID_TRANSITIONS = {
  'in-progress': ['review', 'abandoned'],
  'review': ['merged', 'abandoned'],
  'merged': ['abandoned'],
};

export async function updatePlanStatus(teamId, planId, status, extraFields = {}) {
  const ref = doc(getDb(), 'teams', teamId, 'plans', planId);
  await runTransaction(getDb(), async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error(`Plan ${planId} not found.`);
    const currentStatus = snap.data().status;
    if (status !== 'abandoned') {
      const allowed = VALID_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(status)) {
        throw new Error(
          `Invalid status transition: ${currentStatus} → ${status}. Allowed: ${(allowed || []).join(', ') || 'none'}`
        );
      }
    }
    transaction.update(ref, { status, updatedAt: serverTimestamp(), ...extraFields });
  });
}

export async function getActivePlans(teamId) {
  const col = collection(getDb(), 'teams', teamId, 'plans');
  const q = query(col, where('status', 'in', ['draft', 'in-progress', 'review']));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllPlans(teamId) {
  const col = collection(getDb(), 'teams', teamId, 'plans');
  const snap = await getDocs(col);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

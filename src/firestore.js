import crypto from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  terminate,
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as limitDocs,
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
  if (config.useEmulators) {
    const [host, portRaw] = String(config.firestoreHost || '127.0.0.1:8080').split(':');
    const port = Number.parseInt(portRaw || '8080', 10);
    connectFirestoreEmulator(db, host, port);
  }
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

export async function getPlanSummary(teamId, planId) {
  const ref = doc(getDb(), 'teams', teamId, 'plans', planId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getPlanContent(teamId, planId) {
  const ref = doc(getDb(), 'teams', teamId, 'plans', planId, 'content', 'current');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function upsertPlanContent(teamId, planId, summaryData, markdown, userName, expectedRevision = null) {
  const plansCol = collection(getDb(), 'teams', teamId, 'plans');
  const summaryRef = planId ? doc(getDb(), 'teams', teamId, 'plans', planId) : doc(plansCol);
  const contentRef = doc(summaryRef, 'content', 'current');
  const hash = crypto.createHash('sha256').update(markdown).digest('hex').slice(0, 16);

  await runTransaction(getDb(), async (transaction) => {
    const summarySnap = await transaction.get(summaryRef);
    const contentSnap = await transaction.get(contentRef);

    if (!summarySnap.exists()) {
      if (planId) {
        throw new Error(`Plan ${planId} not found.`);
      }

      transaction.set(summaryRef, {
        slug: summaryData.slug,
        summary: summaryData.summary,
        alignment: summaryData.alignment || '',
        outOfScope: summaryData.outOfScope || '',
        touches: summaryData.touches || [],
        author: summaryData.author,
        status: summaryData.status || 'in-progress',
        prUrl: summaryData.prUrl || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        revision: 1,
        latestBodyUpdatedAt: serverTimestamp(),
        latestBodyUpdatedBy: userName,
        updates: [],
      });
      transaction.set(contentRef, {
        markdown,
        revision: 1,
        hash,
        updatedAt: serverTimestamp(),
        updatedBy: userName,
      });
      return;
    }

    const currentRevision = contentSnap.exists()
      ? contentSnap.data().revision || 0
      : summarySnap.data().revision || 0;

    if (expectedRevision == null) {
      throw new Error('Updating an existing plan requires a revision. Pull the plan first or pass a file with frontmatter revision.');
    }
    if (expectedRevision !== currentRevision) {
      throw new Error(`Revision conflict: expected ${expectedRevision}, current is ${currentRevision}. Pull the latest plan and retry.`);
    }

    const existing = summarySnap.data();
    const nextRevision = currentRevision + 1;
    transaction.update(summaryRef, {
      slug: summaryData.slug || existing.slug,
      summary: summaryData.summary || existing.summary,
      alignment: summaryData.alignment ?? existing.alignment ?? '',
      outOfScope: summaryData.outOfScope ?? existing.outOfScope ?? '',
      touches: summaryData.touches ?? existing.touches ?? [],
      status: summaryData.status || existing.status || 'in-progress',
      prUrl: summaryData.prUrl ?? existing.prUrl ?? null,
      updatedAt: serverTimestamp(),
      revision: nextRevision,
      latestBodyUpdatedAt: serverTimestamp(),
      latestBodyUpdatedBy: userName,
    });
    transaction.set(contentRef, {
      markdown,
      revision: nextRevision,
      hash,
      updatedAt: serverTimestamp(),
      updatedBy: userName,
    });
  });

  return summaryRef.id;
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
  const q = query(col, where('status', 'in', ['in-progress', 'review']));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
}

export async function getRecentPlans(teamId, count = 20) {
  const col = collection(getDb(), 'teams', teamId, 'plans');
  const q = query(col, orderBy('updatedAt', 'desc'), limitDocs(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function toMillis(timestamp) {
  if (!timestamp) return 0;
  if (timestamp.toMillis) return timestamp.toMillis();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  if (timestamp instanceof Date) return timestamp.getTime();
  return new Date(timestamp).getTime();
}

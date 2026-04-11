import crypto from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  terminate,
  doc,
  collection,
  addDoc,
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

// --- Memory layer ---

function memoryDoc(teamId, docId) {
  return doc(getDb(), 'teams', teamId, 'memory', docId);
}

function memoryEntriesCol(teamId) {
  return collection(getDb(), 'teams', teamId, 'memoryEntries');
}

function conversationDraftsCol(teamId) {
  return collection(getDb(), 'teams', teamId, 'memory', 'conversationDrafts', 'items');
}

function memoryEntryFromData(entry, kind, idPrefix) {
  if (!entry?.content) return null;
  return {
    id: `${idPrefix}`,
    kind,
    title: entry.title || (kind === 'companyBrief' ? 'Company brief' : 'Project brief'),
    content: entry.content,
    approvedAt: entry.approvedAt || null,
    approvedBy: entry.approvedBy || null,
    sourceDraftId: entry.sourceDraftId || null,
    createdAt: entry.createdAt || null,
    createdBy: entry.createdBy || null,
  };
}

function sortMemoryEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftTime = timestampToMillis(left.approvedAt ?? left.createdAt);
    const rightTime = timestampToMillis(right.approvedAt ?? right.createdAt);
    if (leftTime !== rightTime) return leftTime - rightTime;
    return String(left.title || '').localeCompare(String(right.title || ''));
  });
}

function timestampToMillis(timestamp) {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export async function getMemoryState(teamId) {
  const snap = await getDoc(memoryDoc(teamId, 'state'));
  if (!snap.exists()) return { revision: 0, latestMemoryUpdatedAt: null, compiledState: 'missing' };
  return snap.data();
}

export async function getMemorySummary(teamId) {
  const snap = await getDoc(memoryDoc(teamId, 'summary'));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function getCompiledContextPack(teamId) {
  const snap = await getDoc(memoryDoc(teamId, 'compiledContext'));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function createConversationDraft(teamId, { title, body, tags = [] }, userName) {
  const ref = await addDoc(conversationDraftsCol(teamId), {
    title,
    body,
    tags,
    state: 'draft',
    createdAt: serverTimestamp(),
    createdBy: userName,
    updatedAt: serverTimestamp(),
    updatedBy: userName,
    approvedAt: null,
    approvedBy: null,
    promotedTo: null,
  });

  await updateMemorySummary(teamId);
  return ref.id;
}

export async function promoteConversationDraft(teamId, draftId, { target, titleOverride = null }, userName) {
  const draftRef = doc(conversationDraftsCol(teamId), draftId);

  await runTransaction(getDb(), async (transaction) => {
    const draftSnap = await transaction.get(draftRef);
    if (!draftSnap.exists()) {
      throw new Error(`Conversation draft ${draftId} not found.`);
    }

    const draft = draftSnap.data();
    if (draft.state !== 'draft') {
      throw new Error(`Conversation draft ${draftId} is already ${draft.state}.`);
    }

    const stateRef = memoryDoc(teamId, 'state');
    const stateSnap = await transaction.get(stateRef);
    const state = stateSnap.exists() ? stateSnap.data() : { revision: 0 };
    const nextRevision = Number(state.revision || 0) + 1;

    if (target === 'companyBrief') {
      transaction.set(doc(memoryEntriesCol(teamId)), {
        kind: 'companyBrief',
        content: draft.body,
        title: titleOverride || draft.title || 'Company brief',
        approvedAt: serverTimestamp(),
        approvedBy: userName,
        sourceDraftId: draftId,
        createdAt: serverTimestamp(),
        createdBy: userName,
      });
    } else if (target === 'projectBrief') {
      transaction.set(doc(memoryEntriesCol(teamId)), {
        kind: 'projectBrief',
        content: draft.body,
        title: titleOverride || draft.title || 'Project brief',
        approvedAt: serverTimestamp(),
        approvedBy: userName,
        sourceDraftId: draftId,
        createdAt: serverTimestamp(),
        createdBy: userName,
      });
    } else if (target === 'decisionLog') {
      transaction.set(memoryDoc(teamId, 'decisionLog'), {
        entries: arrayUnion({
          summary: titleOverride || draft.title || 'Decision',
          detail: draft.body,
          sourceDraftId: draftId,
          decidedAt: new Date().toISOString().slice(0, 10),
          decidedBy: userName,
        }),
        updatedAt: serverTimestamp(),
        updatedBy: userName,
      }, { merge: true });
    } else {
      throw new Error(`Unsupported promotion target: ${target}`);
    }

    transaction.update(draftRef, {
      state: 'approved',
      approvedAt: serverTimestamp(),
      approvedBy: userName,
      promotedTo: target,
      updatedAt: serverTimestamp(),
      updatedBy: userName,
    });

    transaction.set(stateRef, {
      revision: nextRevision,
      latestMemoryUpdatedAt: serverTimestamp(),
      latestMemoryUpdatedBy: userName,
      compiledState: 'needs-sync',
      compiledAt: state.compiledAt || null,
    }, { merge: true });
  });

  await updateMemorySummary(teamId);
}

export async function saveCompiledContextPack(teamId, pack, userName) {
  const stateRef = memoryDoc(teamId, 'state');
  await runTransaction(getDb(), async (transaction) => {
    const stateSnap = await transaction.get(stateRef);
    const state = stateSnap.exists() ? stateSnap.data() : { revision: 0 };
    const currentRevision = Number(state.revision || 0);
    const compiledRevision = Number(pack.memoryRevision || 0);
    if (currentRevision !== compiledRevision) {
      throw new Error('Approved memory changed during sync. Run `gsync sync` again to refresh reviewer context.');
    }

    transaction.set(memoryDoc(teamId, 'compiledContext'), {
      ...pack,
      updatedAt: serverTimestamp(),
      updatedBy: userName,
    });
    transaction.set(stateRef, {
      revision: currentRevision,
      latestMemoryUpdatedAt: state.latestMemoryUpdatedAt || null,
      latestMemoryUpdatedBy: state.latestMemoryUpdatedBy || null,
      compiledState: pack.state,
      compiledAt: serverTimestamp(),
      compiledBy: userName,
    }, { merge: true });
  });

  await updateMemorySummary(teamId);
}

export async function getApprovedMemory(teamId) {
  const [entriesSnap, legacyCompanySnap, legacyProjectSnap, decisionLogSnap, state] = await Promise.all([
    getDocs(query(memoryEntriesCol(teamId), orderBy('approvedAt', 'asc'))),
    getDoc(memoryDoc(teamId, 'companyBrief')),
    getDoc(memoryDoc(teamId, 'projectBrief')),
    getDoc(memoryDoc(teamId, 'decisionLog')),
    getMemoryState(teamId),
  ]);

  const entries = entriesSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  const companyBriefs = sortMemoryEntries([
    ...entries.filter((entry) => entry.kind === 'companyBrief'),
    ...(legacyCompanySnap.exists() ? [memoryEntryFromData(legacyCompanySnap.data(), 'companyBrief', 'legacy-companyBrief')] : []),
  ].filter(Boolean));
  const projectBriefs = sortMemoryEntries([
    ...entries.filter((entry) => entry.kind === 'projectBrief'),
    ...(legacyProjectSnap.exists() ? [memoryEntryFromData(legacyProjectSnap.data(), 'projectBrief', 'legacy-projectBrief')] : []),
  ].filter(Boolean));

  return {
    revision: Number(state.revision || 0),
    latestMemoryUpdatedAt: state.latestMemoryUpdatedAt || null,
    companyBriefs,
    projectBriefs,
    companyBrief: companyBriefs.at(-1) || null,
    projectBrief: projectBriefs.at(-1) || null,
    decisionLog: decisionLogSnap.exists() ? decisionLogSnap.data() : { entries: [] },
  };
}

async function updateMemorySummary(teamId) {
  const [memoryEntriesSnap, legacyCompanySnap, legacyProjectSnap, decisionLog, state, compiled, draftSnap] = await Promise.all([
    getDocs(query(memoryEntriesCol(teamId), orderBy('approvedAt', 'asc'))),
    getDoc(memoryDoc(teamId, 'companyBrief')),
    getDoc(memoryDoc(teamId, 'projectBrief')),
    getDoc(memoryDoc(teamId, 'decisionLog')),
    getMemoryState(teamId),
    getCompiledContextPack(teamId),
    getDocs(query(conversationDraftsCol(teamId), orderBy('updatedAt', 'desc'))),
  ]);

  const memoryEntries = memoryEntriesSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  const companyBriefs = sortMemoryEntries([
    ...memoryEntries.filter((entry) => entry.kind === 'companyBrief'),
    ...(legacyCompanySnap.exists() ? [memoryEntryFromData(legacyCompanySnap.data(), 'companyBrief', 'legacy-companyBrief')] : []),
  ].filter(Boolean));
  const projectBriefs = sortMemoryEntries([
    ...memoryEntries.filter((entry) => entry.kind === 'projectBrief'),
    ...(legacyProjectSnap.exists() ? [memoryEntryFromData(legacyProjectSnap.data(), 'projectBrief', 'legacy-projectBrief')] : []),
  ].filter(Boolean));
  const latestCompanyBrief = companyBriefs.at(-1) || null;
  const latestProjectBrief = projectBriefs.at(-1) || null;
  const drafts = draftSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const draftCount = drafts.filter((item) => item.state === 'draft').length;
  const stateRevision = Number(state.revision || 0);
  const compiledRevision = compiled?.memoryRevision == null ? null : Number(compiled.memoryRevision || 0);
  const compiledAt = state.compiledAt || compiled?.compiledAt || null;
  const latestMemoryUpdatedAt = state.latestMemoryUpdatedAt || null;
  const syncRequired = state.compiledState === 'needs-sync'
    || (compiledRevision == null ? stateRevision > 0 : compiledRevision !== stateRevision);

  await setDoc(memoryDoc(teamId, 'summary'), {
    approved: {
      companyBrief: latestCompanyBrief ? {
        title: latestCompanyBrief.title || 'Company brief',
        approvedAt: latestCompanyBrief.approvedAt || null,
        count: companyBriefs.length,
      } : null,
      projectBrief: latestProjectBrief ? {
        title: latestProjectBrief.title || 'Project brief',
        approvedAt: latestProjectBrief.approvedAt || null,
        count: projectBriefs.length,
      } : null,
      companyBriefCount: companyBriefs.length,
      projectBriefCount: projectBriefs.length,
      decisionCount: Array.isArray(decisionLog.data()?.entries) ? decisionLog.data().entries.length : 0,
    },
    drafts: drafts.map((item) => ({
      id: item.id,
      title: item.title || '(untitled draft)',
      state: item.state || 'draft',
      promotedTo: item.promotedTo || null,
      updatedAt: item.updatedAt || null,
      createdBy: item.createdBy || 'unknown',
    })),
    status: {
      draftCount,
      memoryRevision: stateRevision,
      compiledState: state.compiledState || compiled?.state || 'missing',
      compiledAt,
      latestMemoryUpdatedAt,
      syncRequired,
    },
    updatedAt: serverTimestamp(),
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

export const VALID_PLAN_STATUS_TRANSITIONS = {
  proposed: ['review', 'abandoned'],
  draft: ['in-progress', 'review', 'abandoned'],
  'in-progress': ['review', 'abandoned'],
  review: ['merged', 'abandoned'],
  merged: ['abandoned'],
};

export function isValidPlanStatusTransition(currentStatus, nextStatus) {
  if (nextStatus === 'abandoned') return true;
  const allowed = VALID_PLAN_STATUS_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(nextStatus));
}

export async function updatePlanStatus(teamId, planId, status, extraFields = {}) {
  const ref = doc(getDb(), 'teams', teamId, 'plans', planId);
  await runTransaction(getDb(), async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error(`Plan ${planId} not found.`);
    const currentStatus = snap.data().status;
    if (!isValidPlanStatusTransition(currentStatus, status)) {
      const allowed = VALID_PLAN_STATUS_TRANSITIONS[currentStatus];
      throw new Error(
        `Invalid status transition: ${currentStatus} → ${status}. Allowed: ${(allowed || []).join(', ') || 'none'}`
      );
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

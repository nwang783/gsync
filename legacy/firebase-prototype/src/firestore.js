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

export async function setTeamMeta(teamId, type, planId, summary, userName) {
  const ref = doc(getDb(), 'teams', teamId, 'meta', type);
  await setDoc(ref, {
    planId,
    summary,
    updatedAt: serverTimestamp(),
    updatedBy: userName,
  });
}

// --- Memory layer ---

function memoryDoc(teamId, docId) {
  return doc(getDb(), 'teams', teamId, 'memory', docId);
}

function memoriesCol(teamId) {
  return collection(getDb(), 'teams', teamId, 'memories');
}

function legacyMemoryEntriesCol(teamId) {
  return collection(getDb(), 'teams', teamId, 'memoryEntries');
}

function conversationDraftsCol(teamId) {
  return collection(getDb(), 'teams', teamId, 'memory', 'conversationDrafts', 'items');
}

function memoryTimestamp(entry) {
  return entry?.createdAt
    ?? entry?.updatedAt
    ?? entry?.approvedAt
    ?? entry?.decidedAt
    ?? null;
}

function memoryEntryFromData(entry, { id, titleFallback = 'Memory', source = 'legacy' } = {}) {
  const content = entry?.content ?? entry?.body ?? entry?.detail ?? entry?.summary ?? '';
  if (!String(content || '').trim()) return null;
  return {
    id,
    source,
    title: entry.title || entry.summary || titleFallback,
    content,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    createdAt: memoryTimestamp(entry),
    createdBy: entry.createdBy || entry.approvedBy || entry.decidedBy || null,
    updatedAt: entry.updatedAt || entry.approvedAt || entry.decidedAt || null,
    updatedBy: entry.updatedBy || entry.approvedBy || entry.decidedBy || null,
  };
}

function buildNewMemoryEntries(snapshot) {
  return snapshot.docs.map((entry) => ({ id: entry.id, source: 'memories', ...entry.data() }));
}

function buildLegacyMemoryEntries(legacyEntriesSnap, legacyCompanySnap, legacyProjectSnap, decisionLogSnap) {
  return [
    ...legacyEntriesSnap.docs.map((entry) => memoryEntryFromData(entry.data(), {
      id: `legacy-memoryEntries-${entry.id}`,
      titleFallback: 'Memory',
      source: 'legacy-memoryEntries',
    })).filter(Boolean),
    ...(legacyCompanySnap.exists() ? [memoryEntryFromData(legacyCompanySnap.data(), {
      id: 'legacy-companyBrief',
      titleFallback: 'Company brief',
      source: 'legacy-companyBrief',
    })] : []).filter(Boolean),
    ...(legacyProjectSnap.exists() ? [memoryEntryFromData(legacyProjectSnap.data(), {
      id: 'legacy-projectBrief',
      titleFallback: 'Project brief',
      source: 'legacy-projectBrief',
    })] : []).filter(Boolean),
    ...(decisionLogSnap.exists() && Array.isArray(decisionLogSnap.data()?.entries)
      ? decisionLogSnap.data().entries.map((entry, index) => memoryEntryFromData(entry, {
        id: `legacy-decisionLog-${index}`,
        titleFallback: 'Decision',
        source: 'legacy-decisionLog',
      })).filter(Boolean)
      : []),
  ].filter(Boolean);
}

function memoryEntrySignature(entry) {
  const title = String(entry?.title || '').trim().toLowerCase();
  const content = String(entry?.content || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const tags = Array.isArray(entry?.tags)
    ? [...new Set(entry.tags.map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean))].sort().join('|')
    : '';
  const timestamp = memoryTimestamp(entry);
  const dayKey = timestamp ? new Date(timestampToMillis(timestamp)).toISOString().slice(0, 10) : '';
  return [title, content, tags, dayKey].join('::');
}

export function mergeMemoryEntries(...entryGroups) {
  const merged = new Map();

  for (const group of entryGroups) {
    for (const entry of group.filter(Boolean)) {
      const key = memoryEntrySignature(entry);
      const existing = merged.get(key);
      if (!existing || (existing.source?.startsWith('legacy-') && entry.source === 'memories')) {
        merged.set(key, entry);
      }
    }
  }

  return sortMemoryEntries([...merged.values()]);
}

async function loadUnifiedMemoryEntries(teamId) {
  const [memoriesSnap, legacyEntriesSnap, legacyCompanySnap, legacyProjectSnap, decisionLogSnap, state] = await Promise.all([
    getDocs(query(memoriesCol(teamId), orderBy('createdAt', 'asc'))),
    getDocs(query(legacyMemoryEntriesCol(teamId), orderBy('approvedAt', 'asc'))),
    getDoc(memoryDoc(teamId, 'companyBrief')),
    getDoc(memoryDoc(teamId, 'projectBrief')),
    getDoc(memoryDoc(teamId, 'decisionLog')),
    getMemoryState(teamId),
  ]);

  const newMemories = buildNewMemoryEntries(memoriesSnap);
  const legacyMemories = buildLegacyMemoryEntries(
    legacyEntriesSnap,
    legacyCompanySnap,
    legacyProjectSnap,
    decisionLogSnap,
  );
  const memories = mergeMemoryEntries(newMemories, legacyMemories);

  return {
    revision: Number(state.revision || 0),
    latestMemoryUpdatedAt: state.latestMemoryUpdatedAt || null,
    memories,
    latestMemory: memories.at(-1) || null,
    memoryCount: memories.length,
  };
}

function sortMemoryEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftTime = timestampToMillis(memoryTimestamp(left));
    const rightTime = timestampToMillis(memoryTimestamp(right));
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

export async function createMemoryEntry(teamId, { title, body, tags = [] }, userName) {
  const stateRef = memoryDoc(teamId, 'state');
  const memoryRef = doc(memoriesCol(teamId));

  await runTransaction(getDb(), async (transaction) => {
    const stateSnap = await transaction.get(stateRef);
    const state = stateSnap.exists() ? stateSnap.data() : { revision: 0 };
    const nextRevision = Number(state.revision || 0) + 1;

    transaction.set(memoryRef, {
      title,
      content: body,
      tags,
      createdAt: serverTimestamp(),
      createdBy: userName,
      updatedAt: serverTimestamp(),
      updatedBy: userName,
      source: 'direct',
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
  return memoryRef.id;
}

export async function saveCompiledContextPack(teamId, pack, userName) {
  const stateRef = memoryDoc(teamId, 'state');
  await runTransaction(getDb(), async (transaction) => {
    const stateSnap = await transaction.get(stateRef);
    const state = stateSnap.exists() ? stateSnap.data() : { revision: 0 };
    const currentRevision = Number(state.revision || 0);
    const compiledRevision = Number(pack.memoryRevision || 0);
    if (currentRevision !== compiledRevision) {
      throw new Error('Memory changed during sync. Run `gsync sync` again to refresh reviewer context.');
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

export async function getMemoryTimeline(teamId) {
  const unified = await loadUnifiedMemoryEntries(teamId);

  return {
    revision: unified.revision,
    latestMemoryUpdatedAt: unified.latestMemoryUpdatedAt,
    memories: unified.memories,
    latestMemory: unified.latestMemory,
    memoryCount: unified.memoryCount,
  };
}

export const getApprovedMemory = getMemoryTimeline;

async function updateMemorySummary(teamId) {
  const [state, compiled, unified] = await Promise.all([
    getMemoryState(teamId),
    getCompiledContextPack(teamId),
    loadUnifiedMemoryEntries(teamId),
  ]);

  const memories = unified.memories;
  const stateRevision = unified.revision;
  const compiledRevision = compiled?.memoryRevision == null ? null : Number(compiled.memoryRevision || 0);
  const compiledAt = state.compiledAt || compiled?.compiledAt || null;
  const latestMemoryUpdatedAt = unified.latestMemoryUpdatedAt || state.latestMemoryUpdatedAt || null;
  const syncRequired = state.compiledState === 'needs-sync'
    || (compiledRevision == null ? stateRevision > 0 : compiledRevision !== stateRevision);
  const latestMemory = memories.at(-1) || null;
  const recentMemories = memories.slice(-10).map((entry) => ({
    id: entry.id,
    title: entry.title || 'Untitled',
    content: entry.content || '',
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    createdAt: entry.createdAt || null,
    createdBy: entry.createdBy || null,
    updatedAt: entry.updatedAt || null,
    updatedBy: entry.updatedBy || null,
    source: entry.source || null,
  }));

  await setDoc(memoryDoc(teamId, 'summary'), {
    memories: {
      count: memories.length,
      latest: latestMemory ? {
        id: latestMemory.id,
        title: latestMemory.title || 'Untitled',
        createdAt: latestMemory.createdAt || null,
        createdBy: latestMemory.createdBy || null,
        updatedAt: latestMemory.updatedAt || null,
        updatedBy: latestMemory.updatedBy || null,
        source: latestMemory.source || null,
      } : null,
      recent: recentMemories,
    },
    status: {
      memoryCount: memories.length,
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
        goalType: summaryData.goalType || null,
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
      goalType: summaryData.goalType ?? existing.goalType ?? null,
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

export function isValidPlanStatus(nextStatus) {
  return typeof nextStatus === 'string' && nextStatus.trim().length > 0;
}

export function isTerminalPlanStatus(status) {
  return status === 'merged' || status === 'abandoned';
}

export async function updatePlanStatus(teamId, planId, status, extraFields = {}) {
  const ref = doc(getDb(), 'teams', teamId, 'plans', planId);
  await runTransaction(getDb(), async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error(`Plan ${planId} not found.`);
    if (!isValidPlanStatus(status)) {
      throw new Error('Plan status must be a non-empty string.');
    }
    transaction.update(ref, { status, updatedAt: serverTimestamp(), ...extraFields });
  });
}

export async function getActivePlans(teamId) {
  const col = collection(getDb(), 'teams', teamId, 'plans');
  const snap = await getDocs(col);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((plan) => !isTerminalPlanStatus(plan.status))
    .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
}

export async function getRecentPlans(teamId, count = 20) {
  const col = collection(getDb(), 'teams', teamId, 'plans');
  const q = query(col, orderBy('updatedAt', 'desc'), limitDocs(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getRecentReports(teamId, count = 20) {
  const col = collection(getDb(), 'teams', teamId, 'reports');
  const q = query(col, orderBy('createdAt', 'desc'), limitDocs(count));
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

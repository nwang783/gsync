const fs = require('node:fs');
const admin = require('firebase-admin');

function loadPullRequestEvent(eventPath) {
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH is required.');
  }

  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const pullRequest = payload.pull_request;
  if (!pullRequest) {
    throw new Error('GitHub event payload is missing pull_request.');
  }

  return {
    action: payload.action || '',
    number: pullRequest.number,
    merged: Boolean(pullRequest.merged),
    url: pullRequest.html_url,
    body: pullRequest.body || '',
    mergeCommitSha: pullRequest.merge_commit_sha || null,
  };
}

function parseReferencedPlanIds(prBody) {
  const body = String(prBody || '');
  const matches = [...body.matchAll(/(?:^|\n)\s*Plan:\s*([A-Za-z0-9_-]+)/gi)];
  return [...new Set(matches.map((match) => match[1]).filter(Boolean))];
}

function initializeFirebaseAdmin() {
  if (admin.apps.length) {
    return admin.app();
  }

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const explicitProjectId = process.env.GSYNC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  if (emulatorHost) {
    const projectId = explicitProjectId || 'nomergeconflicts';
    return admin.initializeApp({ projectId });
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required when FIRESTORE_EMULATOR_HOST is not set.');
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: explicitProjectId || serviceAccount.project_id,
  });
}

function classifyPlanDocs(snapshotDocs) {
  const result = {
    toMerge: [],
    alreadyMerged: [],
    skipped: [],
  };

  for (const planDoc of snapshotDocs) {
    const plan = planDoc.data() || {};
    const record = {
      ref: planDoc.ref,
      id: planDoc.id,
      status: plan.status || 'unknown',
      slug: plan.slug || planDoc.id,
    };

    if (record.status === 'review') {
      result.toMerge.push(record);
      continue;
    }

    if (record.status === 'merged') {
      result.alreadyMerged.push(record);
      continue;
    }

    result.skipped.push(record);
  }

  return result;
}

function summarizeMergeCandidates(records) {
  return {
    matched: records.length,
    merged: records.filter((record) => record.status === 'review').length,
    alreadyMerged: records.filter((record) => record.status === 'merged').length,
    skipped: records.filter((record) => !['review', 'merged'].includes(record.status)).length,
    planIds: records.filter((record) => record.status === 'review').map((record) => record.id),
  };
}

async function findPlansByPullRequest({ db, prUrl, referencedPlanIds = [] }) {
  const byPath = new Map();

  if (prUrl) {
    const prSnapshot = await db.collectionGroup('plans').where('prUrl', '==', prUrl).get();
    for (const doc of prSnapshot.docs) {
      byPath.set(doc.ref.path, doc);
    }
  }

  if (referencedPlanIds.length > 0) {
    const referencedPlanIdSet = new Set(referencedPlanIds);
    const allPlansSnapshot = await db.collectionGroup('plans').get();
    for (const doc of allPlansSnapshot.docs) {
      if (!referencedPlanIdSet.has(doc.id)) continue;
      byPath.set(doc.ref.path, doc);
    }
  }

  return [...byPath.values()];
}

async function markMergedPlansForPullRequest({
  db,
  prUrl,
  referencedPlanIds = [],
  prNumber = null,
  mergeCommitSha = null,
  mergedAt = new Date().toISOString(),
}) {
  if (!prUrl && referencedPlanIds.length === 0) {
    throw new Error('Either prUrl or referencedPlanIds is required.');
  }

  const candidateDocs = await findPlansByPullRequest({ db, prUrl, referencedPlanIds });
  const classified = classifyPlanDocs(candidateDocs);
  const summary = summarizeMergeCandidates([
    ...classified.toMerge,
    ...classified.alreadyMerged,
    ...classified.skipped,
  ]);

  if (classified.toMerge.length === 0) {
    return summary;
  }

  const batch = db.batch();
  for (const plan of classified.toMerge) {
    batch.update(plan.ref, {
      status: 'merged',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      mergedAt: admin.firestore.FieldValue.serverTimestamp(),
      mergedFromPrNumber: prNumber,
      mergedFromPrUrl: prUrl,
      mergedFromCommitSha: mergeCommitSha,
      mergedByAutomationAt: mergedAt,
    });
  }
  await batch.commit();

  return summary;
}

async function main() {
  const event = loadPullRequestEvent(process.env.GITHUB_EVENT_PATH);
  if (event.action !== 'closed' || !event.merged) {
    console.log(`Skipping event: action=${event.action || 'unknown'} merged=${event.merged}`);
    return;
  }

  initializeFirebaseAdmin();
  const db = admin.firestore();
  const referencedPlanIds = parseReferencedPlanIds(event.body);
  const result = await markMergedPlansForPullRequest({
    db,
    prUrl: event.url,
    referencedPlanIds,
    prNumber: event.number,
    mergeCommitSha: event.mergeCommitSha,
  });

  console.log(JSON.stringify({
    prUrl: event.url,
    prNumber: event.number,
    referencedPlanIds,
    ...result,
  }, null, 2));
}

module.exports = {
  classifyPlanDocs,
  loadPullRequestEvent,
  markMergedPlansForPullRequest,
  parseReferencedPlanIds,
  summarizeMergeCandidates,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

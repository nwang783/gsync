const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const { generateJoinCode, sha256 } = require("./join-codes");
const {
  FEATURE_KEY: ACTIVITY_SUMMARY_FEATURE_KEY,
  buildActivitySummaryDocument,
  buildActivitySummaryErrorDocument,
  buildActivitySummaryFingerprint,
  buildActivitySummarySource,
  generateActivitySummary,
} = require("./insights/activity-summary.cjs");

for (const candidate of [
  path.join(__dirname, ".env"),
  path.join(__dirname, ".env.local"),
  path.join(__dirname, "..", ".env"),
  path.join(__dirname, "..", ".env.local"),
]) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false });
  }
}

admin.initializeApp();
const db = admin.firestore();

const app = express();
const router = express.Router();
app.use(cors({ origin: true }));
app.use(express.json());

function sendApiError(res, err, { fallbackMessage, status = 500 }) {
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  return res.status(status).json({ error: fallbackMessage });
}

async function requireTeamAdmin(req, { adminClient = admin, dbClient = db } = {}) {
  const authHeader = req.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const err = new Error("Missing Authorization Bearer token");
    err.status = 401;
    throw err;
  }

  const decoded = await adminClient.auth().verifyIdToken(match[1]);
  const teamId = decoded.teamId;
  const seatId = decoded.uid;

  if (!teamId || !seatId) {
    const err = new Error("Authenticated seat is missing team context");
    err.status = 401;
    throw err;
  }

  const membershipSnap = await dbClient.doc(`teams/${teamId}/memberships/${seatId}`).get();
  if (!membershipSnap.exists) {
    const err = new Error("Seat is not a member of this team");
    err.status = 403;
    throw err;
  }

  if (membershipSnap.data().role !== "admin") {
    const err = new Error("Only admins can create join codes");
    err.status = 403;
    throw err;
  }

  return {
    teamId,
    seatId,
    seatName: membershipSnap.data().seatName || decoded.name || seatId,
  };
}

async function requireScopedTeamAdmin(req, requestedTeamId, deps = {}) {
  const auth = await requireTeamAdmin(req, deps);
  if (requestedTeamId && requestedTeamId !== auth.teamId) {
    const err = new Error("Admins can only refresh insights for their own team");
    err.status = 403;
    throw err;
  }
  return auth;
}

function createJoinCodeDoc(dbClient, batch, teamId, { seatId, seatName }) {
  const joinCode = generateJoinCode();
  const joinCodeRef = dbClient.doc(`teams/${teamId}/joinCodes/${uuidv4()}`);
  batch.set(joinCodeRef, {
    codeHash: sha256(joinCode),
    role: "member",
    uses: 0,
    createdAt: FieldValue.serverTimestamp(),
    createdBySeatId: seatId,
    createdBySeatName: seatName,
  });

  return {
    joinCode,
    joinCodeRef,
  };
}

async function issueJoinCodeForTeam({ dbClient = db, teamId, seatId, seatName }) {
  const batch = dbClient.batch();
  const { joinCode, joinCodeRef } = createJoinCodeDoc(dbClient, batch, teamId, {
    seatId,
    seatName,
  });
  await batch.commit();
  return {
    joinCode,
    joinCodeId: joinCodeRef.id,
    role: "member",
    createdBySeatId: seatId,
    createdBySeatName: seatName,
  };
}

async function joinTeamWithCode({ dbClient = db, adminClient = admin, joinCode, seatName }) {
  const codeHash = sha256(joinCode);

  const codesSnap = await dbClient
    .collectionGroup("joinCodes")
    .where("codeHash", "==", codeHash)
    .limit(1)
    .get();

  const joinCodeRef = codesSnap.empty ? null : codesSnap.docs[0].ref;
  const teamId = joinCodeRef ? joinCodeRef.parent.parent.id : null;

  if (!joinCodeRef) {
    const err = new Error("Invalid join code");
    err.status = 404;
    throw err;
  }

  const result = await dbClient.runTransaction(async (tx) => {
    const freshSnap = await tx.get(joinCodeRef);
    const data = freshSnap.data();

    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      const err = new Error("Join code has expired");
      err.status = 403;
      throw err;
    }
    if (data.maxUses && data.uses >= data.maxUses) {
      const err = new Error("Join code has reached maximum uses");
      err.status = 403;
      throw err;
    }

    const seatId = uuidv4();
    const seatKey = uuidv4();
    const keyHash = sha256(seatKey);
    const now = FieldValue.serverTimestamp();

    tx.update(joinCodeRef, { uses: (data.uses || 0) + 1 });

    tx.set(dbClient.doc(`teams/${teamId}/memberships/${seatId}`), {
      role: data.role || "member",
      seatName,
      status: "active",
      joinedAt: now,
    });

    tx.set(dbClient.doc(`seats/${seatId}`), {
      seatName,
      keyHash,
      homeTeamId: teamId,
      createdAt: now,
      lastLoginAt: now,
    });

    return { seatId, seatKey, role: data.role || "member" };
  });

  const firebaseToken = await adminClient.auth().createCustomToken(result.seatId, {
    teamId,
    role: result.role,
  });

  return {
    teamId,
    seatId: result.seatId,
    seatName,
    role: result.role,
    seatKey: result.seatKey,
    firebaseToken,
  };
}

async function loadActivitySummarySource(teamId) {
  const [teamSnap, twoWeekSnap, threeDaySnap, plansSnap] = await Promise.all([
    db.doc(`teams/${teamId}`).get(),
    db.doc(`teams/${teamId}/meta/2week`).get(),
    db.doc(`teams/${teamId}/meta/3day`).get(),
    db.collection(`teams/${teamId}/plans`).get(),
  ]);

  const teamName = teamSnap.exists ? teamSnap.data().name || null : null;
  return buildActivitySummarySource({
    teamId,
    teamName,
    twoWeekGoal: twoWeekSnap.exists ? twoWeekSnap.data().content || null : null,
    threeDayGoal: threeDaySnap.exists ? threeDaySnap.data().content || null : null,
    plans: plansSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  });
}

async function refreshActivitySummary(teamId) {
  const summaryRef = db.doc(`teams/${teamId}/insights/${ACTIVITY_SUMMARY_FEATURE_KEY}`);
  const previousSnap = await summaryRef.get();
  const previous = previousSnap.exists ? previousSnap.data() : null;

  const source = await loadActivitySummarySource(teamId);
  const sourceFingerprint = buildActivitySummaryFingerprint(source);

  if (previous?.sourceFingerprint === sourceFingerprint && previous?.status === 'ready') {
    return { refreshed: false, skipped: true, reason: 'source unchanged', sourceFingerprint };
  }

  let generated;
  try {
    generated = await generateActivitySummary({ source });
  } catch (error) {
    console.error(`[activity-summary] generation failed team=${teamId}:`, error);
    const errorDoc = buildActivitySummaryErrorDocument({
      teamId,
      source,
      error,
      sourceFingerprint,
      previousDocument: previous,
    });
    await summaryRef.set(errorDoc, { merge: true });
    throw error;
  }

  const latestSource = await loadActivitySummarySource(teamId);
  const latestFingerprint = buildActivitySummaryFingerprint(latestSource);
  if (latestFingerprint !== sourceFingerprint) {
    return { refreshed: false, skipped: true, reason: 'source changed during generation', sourceFingerprint };
  }

  const currentSnap = await summaryRef.get();
  const currentGeneratedAt = currentSnap.exists ? Date.parse(currentSnap.data().generatedAt || '') : NaN;
  const previousGeneratedAt = previous ? Date.parse(previous.generatedAt || '') : NaN;
  if (
    Number.isFinite(currentGeneratedAt)
    && Number.isFinite(previousGeneratedAt)
    && currentGeneratedAt > previousGeneratedAt
    && (currentSnap.data().sourceFingerprint || null) !== sourceFingerprint
  ) {
    return { refreshed: false, skipped: true, reason: 'a newer summary already exists', sourceFingerprint };
  }

  const docData = buildActivitySummaryDocument({
    teamId,
    source: latestSource,
    model: generated.model,
    output: generated.output,
    sourceFingerprint,
    previousDocument: previous,
  });
  await summaryRef.set(docData, { merge: true });
  return { refreshed: true, skipped: false, sourceFingerprint, model: generated.model };
}

// ---------------------------------------------------------------------------
// POST /teams — create a new team + first admin seat
// ---------------------------------------------------------------------------
router.post("/teams", async (req, res) => {
  try {
    const { teamName, seatName } = req.body;
    if (!teamName || !seatName) {
      return res.status(400).json({ error: "teamName and seatName are required" });
    }

    const teamId = uuidv4();
    const seatId = uuidv4();
    const seatKey = uuidv4();
    const keyHash = sha256(seatKey);
    const now = FieldValue.serverTimestamp();

    const batch = db.batch();
    const { joinCode } = createJoinCodeDoc(db, batch, teamId, {
      seatId,
      seatName,
    });

    batch.set(db.doc(`teams/${teamId}`), {
      name: teamName,
      createdAt: now,
      createdBySeatId: seatId,
    });

    batch.set(db.doc(`teams/${teamId}/memberships/${seatId}`), {
      role: "admin",
      seatName,
      status: "active",
      joinedAt: now,
    });

    batch.set(db.doc(`seats/${seatId}`), {
      seatName,
      keyHash,
      homeTeamId: teamId,
      createdAt: now,
      lastLoginAt: now,
    });

    await batch.commit();

    const firebaseToken = await admin.auth().createCustomToken(seatId, {
      teamId,
      role: "admin",
    });

    return res.status(201).json({ teamId, seatId, seatName, role: "admin", seatKey, joinCode, firebaseToken });
  } catch (err) {
    console.error("POST /teams error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /join-codes — create a fresh join code for the authenticated team
// ---------------------------------------------------------------------------
router.post("/join-codes", async (req, res) => {
  try {
    const { teamId, seatId, seatName } = await requireTeamAdmin(req);
    const { joinCode, joinCodeId, role, createdBySeatId, createdBySeatName } = await issueJoinCodeForTeam({
      dbClient: db,
      teamId,
      seatId,
      seatName,
    });

    return res.status(201).json({
      teamId,
      joinCode,
      joinCodeId,
      role,
      createdBySeatId,
      createdBySeatName,
    });
  } catch (err) {
    console.error("POST /join-codes error:", err);
    return sendApiError(res, err, { fallbackMessage: "Could not create join code" });
  }
});

// ---------------------------------------------------------------------------
// POST /teams/join — join an existing team via a join code
// ---------------------------------------------------------------------------
router.post("/teams/join", async (req, res) => {
  try {
    const { joinCode, seatName } = req.body;
    if (!joinCode || !seatName) {
      return res.status(400).json({ error: "joinCode and seatName are required" });
    }
    const result = await joinTeamWithCode({
      dbClient: db,
      adminClient: admin,
      joinCode,
      seatName,
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error("POST /teams/join error:", err);
    return sendApiError(res, err, { fallbackMessage: "Could not join team" });
  }
});

// ---------------------------------------------------------------------------
// POST /agent/login — exchange a durable seat key for a Firebase token
// ---------------------------------------------------------------------------
router.post("/agent/login", async (req, res) => {
  try {
    const { seatKey } = req.body;
    if (!seatKey) {
      return res.status(400).json({ error: "seatKey is required" });
    }

    const keyHash = sha256(seatKey);

    const seatsSnap = await db
      .collection("seats")
      .where("keyHash", "==", keyHash)
      .limit(1)
      .get();

    if (seatsSnap.empty) {
      return res.status(401).json({ error: "Invalid seat key" });
    }

    const seatDoc = seatsSnap.docs[0];
    const seatId = seatDoc.id;
    const seat = seatDoc.data();
    const teamId = seat.homeTeamId;

    // Look up the membership to get the role
    const memberSnap = await db
      .doc(`teams/${teamId}/memberships/${seatId}`)
      .get();

    if (!memberSnap.exists) {
      return res.status(401).json({ error: "Seat has no active membership" });
    }

    const role = memberSnap.data().role;

    // Update lastLoginAt
    await seatDoc.ref.update({
      lastLoginAt: FieldValue.serverTimestamp(),
    });

    const firebaseToken = await admin.auth().createCustomToken(seatId, {
      teamId,
      role,
    });

    return res.status(200).json({ teamId, seatId, seatName: seat.seatName, role, firebaseToken });
  } catch (err) {
    console.error("POST /agent/login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function handleActivitySummaryRefresh(req, res) {
  try {
    const requestedTeamId = req.params.teamId || req.body.teamId || null;
    const { teamId } = await requireScopedTeamAdmin(req, requestedTeamId);

    const result = await refreshActivitySummary(teamId);
    return res.status(200).json({ teamId, featureKey: ACTIVITY_SUMMARY_FEATURE_KEY, ...result });
  } catch (err) {
    console.error("refreshActivitySummary error:", err);
    return sendApiError(res, err, { fallbackMessage: "Could not refresh activity summary" });
  }
}

router.post("/teams/:teamId/insights/activity-summary/refresh", handleActivitySummaryRefresh);
router.post("/insights/activity-summary/refresh", handleActivitySummaryRefresh);

// Support both direct function URLs (`/agent/login`) and Hosting rewrites that
// preserve the `/api` prefix (`/api/agent/login`).
app.use(router);
app.use("/api", router);

exports.onPlanWriteActivitySummary = functions.firestore
  .document("teams/{teamId}/plans/{planId}")
  .onWrite(async (_change, context) => {
    const { teamId } = context.params;
    try {
      await refreshActivitySummary(teamId);
    } catch (err) {
      console.error(`Activity summary refresh failed for team ${teamId}:`, err);
    }
  });

exports.onTeamGoalWriteActivitySummary = functions.firestore
  .document("teams/{teamId}/meta/{docId}")
  .onWrite(async (_change, context) => {
    const { teamId, docId } = context.params;
    if (!['2week', '3day'].includes(docId)) return;
    try {
      await refreshActivitySummary(teamId);
    } catch (err) {
      console.error(`Activity summary refresh failed for team ${teamId} meta ${docId}:`, err);
    }
  });

exports.api = functions.https.onRequest(app);
module.exports.requireTeamAdmin = requireTeamAdmin;
module.exports.requireScopedTeamAdmin = requireScopedTeamAdmin;
module.exports.issueJoinCodeForTeam = issueJoinCodeForTeam;
module.exports.joinTeamWithCode = joinTeamWithCode;
module.exports.refreshActivitySummary = refreshActivitySummary;

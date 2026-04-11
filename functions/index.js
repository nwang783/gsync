const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { generateJoinCode, sha256 } = require("./join-codes");

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

// Support both direct function URLs (`/agent/login`) and Hosting rewrites that
// preserve the `/api` prefix (`/api/agent/login`).
app.use(router);
app.use("/api", router);

exports.api = functions.https.onRequest(app);
module.exports.requireTeamAdmin = requireTeamAdmin;
module.exports.issueJoinCodeForTeam = issueJoinCodeForTeam;
module.exports.joinTeamWithCode = joinTeamWithCode;

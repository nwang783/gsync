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
app.use(cors({ origin: true }));
app.use(express.json());

// ---------------------------------------------------------------------------
// POST /teams — create a new team + first admin seat
// ---------------------------------------------------------------------------
app.post("/teams", async (req, res) => {
  try {
    const { teamName, seatName } = req.body;
    if (!teamName || !seatName) {
      return res.status(400).json({ error: "teamName and seatName are required" });
    }

    const teamId = uuidv4();
    const seatId = uuidv4();
    const seatKey = uuidv4();
    const joinCode = generateJoinCode();
    const keyHash = sha256(seatKey);
    const joinCodeRef = db.doc(`teams/${teamId}/joinCodes/${uuidv4()}`);
    const now = FieldValue.serverTimestamp();

    const batch = db.batch();

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

    batch.set(joinCodeRef, {
      codeHash: sha256(joinCode),
      role: "member",
      uses: 0,
      createdAt: now,
      createdBySeatId: seatId,
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
// POST /teams/join — join an existing team via a join code
// ---------------------------------------------------------------------------
app.post("/teams/join", async (req, res) => {
  try {
    const { joinCode, seatName } = req.body;
    if (!joinCode || !seatName) {
      return res.status(400).json({ error: "joinCode and seatName are required" });
    }

    const codeHash = sha256(joinCode);

    const codesSnap = await db
      .collectionGroup("joinCodes")
      .where("codeHash", "==", codeHash)
      .limit(1)
      .get();

    const joinCodeRef = codesSnap.empty ? null : codesSnap.docs[0].ref;
    const teamId = joinCodeRef ? joinCodeRef.parent.parent.id : null;

    if (!joinCodeRef) {
      return res.status(404).json({ error: "Invalid join code" });
    }

    // Use a transaction to atomically validate and consume the join code
    const result = await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(joinCodeRef);
      const data = freshSnap.data();

      if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        throw new Error("Join code has expired");
      }
      if (data.maxUses && data.uses >= data.maxUses) {
        throw new Error("Join code has reached maximum uses");
      }

      const seatId = uuidv4();
      const seatKey = uuidv4();
      const keyHash = sha256(seatKey);
      const now = FieldValue.serverTimestamp();

      tx.update(joinCodeRef, { uses: (data.uses || 0) + 1 });

      tx.set(db.doc(`teams/${teamId}/memberships/${seatId}`), {
        role: data.role,
        seatName,
        status: "active",
        joinedAt: now,
      });

      tx.set(db.doc(`seats/${seatId}`), {
        seatName,
        keyHash,
        homeTeamId: teamId,
        createdAt: now,
        lastLoginAt: now,
      });

      return { seatId, seatKey, role: data.role };
    });

    const firebaseToken = await admin.auth().createCustomToken(result.seatId, {
      teamId,
      role: result.role,
    });

    return res.status(201).json({
      teamId,
      seatId: result.seatId,
      seatName,
      role: result.role,
      seatKey: result.seatKey,
      firebaseToken,
    });
  } catch (err) {
    console.error("POST /teams/join error:", err);
    const status = err.message.includes("expired") || err.message.includes("maximum") ? 403 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /agent/login — exchange a durable seat key for a Firebase token
// ---------------------------------------------------------------------------
app.post("/agent/login", async (req, res) => {
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

exports.api = functions.https.onRequest(app);

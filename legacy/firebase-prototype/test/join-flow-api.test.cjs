const test = require('node:test');
const assert = require('node:assert/strict');
const { sha256 } = require('../functions/join-codes');
const {
  createTeamReport,
  requireScopedTeamMember,
  requireTeamAdmin,
  requireScopedTeamAdmin,
  issueJoinCodeForTeam,
  joinTeamWithCode,
} = require('../functions/index.js');

function createMemoryDb(seed = {}) {
  const store = new Map(Object.entries(seed));

  function makeDocRef(path) {
    const parts = path.split('/');
    return {
      path,
      id: parts[parts.length - 1],
      parent: parts.length >= 4
        ? {
            id: parts[parts.length - 2],
            parent: {
              id: parts[parts.length - 3],
              parent: null,
            },
          }
        : parts.length >= 2
          ? {
              id: parts[parts.length - 2],
              parent: null,
            }
          : null,
      async get() {
        const data = store.get(path);
        return {
          exists: data !== undefined,
          data: () => data,
          id: parts[parts.length - 1],
          ref: makeDocRef(path),
        };
      },
      async set(data, opts = {}) {
        applySet(path, data, Boolean(opts.merge));
      },
    };
  }

  function applySet(path, data, merge = false) {
    const current = store.get(path);
    store.set(path, merge && current ? { ...current, ...data } : data);
  }

  function makeQuery(kind, collectionName) {
    return {
      where(field, op, value) {
        if (op !== '==') throw new Error(`Unsupported op: ${op}`);
        return {
          limit(limitCount) {
            return {
              async get() {
                const docs = [];
                for (const [path, data] of store.entries()) {
                  const parts = path.split('/');
                  const isMatch = kind === 'collection'
                    ? parts.length === 2 && parts[0] === collectionName
                    : parts.length >= 4 && parts[parts.length - 2] === collectionName;
                  if (!isMatch) continue;
                  if (data?.[field] === value) {
                    docs.push({
                      id: parts[parts.length - 1],
                      ref: makeDocRef(path),
                      data: () => data,
                    });
                  }
                }
                return {
                  empty: docs.length === 0,
                  docs: docs.slice(0, limitCount),
                };
              },
            };
          },
        };
      },
    };
  }

  return {
    doc: makeDocRef,
    batch() {
      const ops = [];
      return {
        set(ref, data, opts = {}) {
          ops.push({ path: ref.path, data, merge: Boolean(opts.merge) });
        },
        async commit() {
          for (const op of ops) {
            applySet(op.path, op.data, op.merge);
          }
        },
      };
    },
    collection(name) {
      return makeQuery('collection', name);
    },
    collectionGroup(name) {
      return makeQuery('collectionGroup', name);
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          const data = store.get(ref.path);
          return {
            exists: data !== undefined,
            data: () => data,
          };
        },
        update(ref, patch) {
          const current = store.get(ref.path) || {};
          store.set(ref.path, { ...current, ...patch });
        },
        set(ref, data, opts = {}) {
          applySet(ref.path, data, opts.merge);
        },
      };
      return fn(tx);
    },
    _store: store,
  };
}

function createAdminClient({ tokenClaims = {}, customTokenPrefix = 'custom' } = {}) {
  return {
    auth() {
      return {
        verifyIdToken: async (token) => {
          if (token === 'token-admin') {
            return { uid: 'seat-admin', teamId: 'team-1', ...tokenClaims };
          }
          if (token === 'token-member') {
            return { uid: 'seat-member', teamId: 'team-1', ...tokenClaims };
          }
          return { uid: 'unknown', teamId: 'team-unknown', ...tokenClaims };
        },
        createCustomToken: async (uid, claims) => `${customTokenPrefix}:${uid}:${claims.teamId}:${claims.role}`,
      };
    },
  };
}

test('requireTeamAdmin rejects non-admin seats', async () => {
  const db = createMemoryDb({
    'teams/team-1/memberships/seat-member': { role: 'member', seatName: 'Guest Seat' },
  });
  const req = { get: () => 'Bearer token-member' };

  await assert.rejects(
    () => requireTeamAdmin(req, { adminClient: createAdminClient(), dbClient: db }),
    /Only admins can create join codes/,
  );
});

test('requireScopedTeamAdmin rejects refreshing a different team', async () => {
  const db = createMemoryDb({
    'teams/team-1/memberships/seat-admin': { role: 'admin', seatName: 'Admin Seat' },
  });
  const req = { get: () => 'Bearer token-admin' };

  await assert.rejects(
    () => requireScopedTeamAdmin(req, 'team-2', { adminClient: createAdminClient(), dbClient: db }),
    /Admins can only refresh insights for their own team/,
  );
});

test('requireScopedTeamMember rejects submitting reports to a different team', async () => {
  const db = createMemoryDb({
    'teams/team-1/memberships/seat-member': { role: 'member', seatName: 'Guest Seat' },
  });
  const req = { get: () => 'Bearer token-member' };

  await assert.rejects(
    () => requireScopedTeamMember(req, 'team-2', { adminClient: createAdminClient(), dbClient: db }),
    /Seats can only submit reports for their own team/,
  );
});

test('issueJoinCodeForTeam always stores member invites', async () => {
  const db = createMemoryDb();
  const result = await issueJoinCodeForTeam({
    dbClient: db,
    teamId: 'team-1',
    seatId: 'seat-admin',
    seatName: 'Admin Seat',
  });

  assert.equal(result.role, 'member');
  const stored = db._store.get(`teams/team-1/joinCodes/${result.joinCodeId}`);
  assert.equal(stored.role, 'member');
  assert.equal(stored.createdBySeatName, 'Admin Seat');

  const lookup = db._store.get(`joinCodeLookups/${stored.codeHash}`);
  assert.equal(lookup.teamId, 'team-1');
  assert.equal(lookup.joinCodePath, `teams/team-1/joinCodes/${result.joinCodeId}`);
});

test('joinTeamWithCode lands the new seat on the same team and backfills lookup docs for legacy codes', async () => {
  const db = createMemoryDb({
    'teams/team-1/joinCodes/code-1': {
      codeHash: sha256('SP7E-YKDH-LPC3'),
      role: 'member',
      uses: 0,
      createdBySeatId: 'seat-admin',
      createdBySeatName: 'Admin Seat',
    },
  });
  const result = await joinTeamWithCode({
    dbClient: db,
    adminClient: createAdminClient({ customTokenPrefix: 'joined' }),
    joinCode: 'SP7E-YKDH-LPC3',
    seatName: 'Teammate Laptop',
  });

  assert.equal(result.teamId, 'team-1');
  assert.equal(result.role, 'member');
  assert.match(result.firebaseToken, /^joined:/);

  const membershipEntries = [...db._store.entries()].filter(([path]) => path.startsWith('teams/team-1/memberships/'));
  assert.equal(membershipEntries.length, 1);
  assert.equal(membershipEntries[0][1].seatName, 'Teammate Laptop');

  const seatEntries = [...db._store.entries()].filter(([path]) => path.startsWith('seats/'));
  assert.equal(seatEntries.length, 1);
  assert.equal(seatEntries[0][1].homeTeamId, 'team-1');

  const lookup = db._store.get(`joinCodeLookups/${sha256('SP7E-YKDH-LPC3')}`);
  assert.equal(lookup.teamId, 'team-1');
  assert.equal(lookup.joinCodePath, 'teams/team-1/joinCodes/code-1');
});

test('joinTeamWithCode prefers the top-level lookup over collection-group search', async () => {
  const joinCode = 'SP7E-YKDH-LPC3';
  const codeHash = sha256(joinCode);
  const db = createMemoryDb({
    'joinCodeLookups/55a0a645-should-not-be-used': {
      teamId: 'team-other',
      joinCodePath: 'teams/team-other/joinCodes/code-other',
    },
    [`joinCodeLookups/${codeHash}`]: {
      teamId: 'team-1',
      joinCodePath: 'teams/team-1/joinCodes/code-1',
      role: 'member',
    },
    'teams/team-1/joinCodes/code-1': {
      codeHash,
      role: 'member',
      uses: 0,
      createdBySeatId: 'seat-admin',
      createdBySeatName: 'Admin Seat',
    },
  });

  db.collectionGroup = () => ({
    where() {
      throw new Error('collectionGroup lookup should not run when a lookup doc exists');
    },
  });

  const result = await joinTeamWithCode({
    dbClient: db,
    adminClient: createAdminClient({ customTokenPrefix: 'joined' }),
    joinCode,
    seatName: 'Lookup Path Seat',
  });

  assert.equal(result.teamId, 'team-1');
});

test('createTeamReport stores bug reports with seat metadata', async () => {
  const db = createMemoryDb();

  const report = await createTeamReport({
    dbClient: db,
    teamId: 'team-1',
    seatId: 'seat-member',
    seatName: 'Guest Seat',
    role: 'member',
    payload: {
      kind: 'bug',
      title: 'Login copy is confusing',
      body: 'The CLI told me to retry, but it did not say whether my seat key or network was wrong.',
      severity: 'high',
      source: 'cli',
    },
  });

  const stored = db._store.get(`teams/team-1/reports/${report.id}`);
  assert.equal(stored.kind, 'bug');
  assert.equal(stored.title, 'Login copy is confusing');
  assert.equal(stored.severity, 'high');
  assert.equal(stored.createdBySeatName, 'Guest Seat');
  assert.equal(stored.createdByRole, 'member');
});

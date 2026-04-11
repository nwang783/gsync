#!/usr/bin/env node
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const DEV_DIR = path.join(ROOT, '.dev');
const DEV_HOME = path.join(DEV_DIR, 'home');
const DEV_STATE_FILE = path.join(DEV_DIR, 'state.json');
const DEV_SEED_FILE = path.join(DEV_DIR, 'seed.json');
const DEV_PLAN_FILE = path.join(DEV_DIR, 'seed-plan.md');
const CLI_BIN = path.join(ROOT, 'bin', 'gsync.js');
const FIREBASE_PROJECT_ID = 'nomergeconflicts';
const FIREBASE_API_KEY = 'demo-local-api-key';
const API_BASE_URL = `http://127.0.0.1:5001/${FIREBASE_PROJECT_ID}/us-central1/api`;
const DASHBOARD_URL = 'http://127.0.0.1:5173';

function ensureDevDirs() {
  fs.mkdirSync(DEV_HOME, { recursive: true });
  fs.mkdirSync(path.dirname(DEV_STATE_FILE), { recursive: true });
}

function stripAnsi(text) {
  return String(text || '').replace(/\u001b\[[0-9;]*m/g, '');
}

function runSync(command, args, { cwd = ROOT, env = {}, inheritStdio = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: inheritStdio ? 'inherit' : 'pipe',
  });

  if (result.status !== 0) {
    const error = new Error([
      `${command} ${args.join(' ')}`.trim(),
      result.stdout ? stripAnsi(result.stdout) : '',
      result.stderr ? stripAnsi(result.stderr) : '',
    ].filter(Boolean).join('\n\n'));
    error.exitCode = result.status ?? 1;
    throw error;
  }

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function runCli(args, { home = DEV_HOME, extraEnv = {}, inheritStdio = false } = {}) {
  return runSync(process.execPath, [CLI_BIN, ...args], {
    env: {
      HOME: home,
      ...extraEnv,
    },
    inheritStdio,
  });
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host }, () => {
        socket.end();
        resolve();
      });

      socket.on('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

async function waitForServices() {
  await Promise.all([
    waitForPort(8080),
    waitForPort(9099),
    waitForPort(5001),
    waitForPort(5173),
    waitForFunctionsReady(),
  ]);
}

async function waitForFunctionsReady(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_BASE_URL}/agent/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatKey: '' }),
      });
      if (response.status !== 404) {
        return;
      }
    } catch {
      // keep polling until the function manifest is available
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Timed out waiting for the local Functions emulator to load api.');
}

function loadState() {
  if (!fs.existsSync(DEV_STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(DEV_STATE_FILE, 'utf8'));
}

function writeState(state) {
  ensureDevDirs();
  fs.writeFileSync(DEV_STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function clearState() {
  if (fs.existsSync(DEV_STATE_FILE)) {
    fs.unlinkSync(DEV_STATE_FILE);
  }
}

function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return;
  }
}

async function startDevStack() {
  ensureDevDirs();

  if (loadState()?.emulatorsPid && loadState()?.dashboardPid) {
    const state = loadState();
    const emulatorsRunning = isProcessAlive(state.emulatorsPid);
    const dashboardRunning = isProcessAlive(state.dashboardPid);
    if (emulatorsRunning && dashboardRunning) {
      console.log(`Dev stack already running.`);
      console.log(`  Dashboard: ${DASHBOARD_URL}`);
      console.log(`  Firebase emulators: http://127.0.0.1:4000`);
      return;
    }

    killProcessTree(state.emulatorsPid);
    killProcessTree(state.dashboardPid);
    clearState();
  }

  const dashboardEnv = {
    VITE_USE_FIREBASE_EMULATORS: 'true',
    VITE_FIREBASE_PROJECT_ID: FIREBASE_PROJECT_ID,
    VITE_FIREBASE_API_KEY: FIREBASE_API_KEY,
    VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    VITE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    VITE_FUNCTIONS_ORIGIN: 'http://127.0.0.1:5001',
    VITE_API_BASE_URL: '/api',
  };

  const emulators = spawn(
    'firebase',
    ['emulators:start', '--only', 'auth,firestore,functions', '--project', FIREBASE_PROJECT_ID],
    {
      cwd: ROOT,
      env: { ...process.env },
      stdio: 'inherit',
    },
  );

  const dashboard = spawn(
    'npm',
    ['--prefix', 'dashboard', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    {
      cwd: ROOT,
      env: { ...process.env, ...dashboardEnv },
      stdio: 'inherit',
    },
  );

  writeState({
    emulatorsPid: emulators.pid,
    dashboardPid: dashboard.pid,
    startedAt: new Date().toISOString(),
    dashboardUrl: DASHBOARD_URL,
    apiBaseUrl: API_BASE_URL,
    devHome: DEV_HOME,
  });

  const shutdown = (exitCode = 0) => {
    killProcessTree(emulators.pid);
    killProcessTree(dashboard.pid);
    clearState();
    process.exit(exitCode);
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  emulators.on('exit', (code) => shutdown(code ?? 1));
  dashboard.on('exit', (code) => shutdown(code ?? 1));

  await waitForServices();
  console.log('');
  console.log('Local dev stack ready.');
  console.log(`  Dashboard: ${DASHBOARD_URL}`);
  console.log('  Firebase emulator UI: http://127.0.0.1:4000');
  console.log(`  CLI home: ${DEV_HOME}`);
  console.log('  Use `npm run dev:seed` to populate demo data.');
  console.log('  Use `npm run dev:cli -- <args>` to run gsync against this sandbox.');

  await new Promise(() => {});
}

async function stopDevStack() {
  const state = loadState();
  if (!state) {
    console.log('No dev stack state file found.');
    return;
  }

  killProcessTree(state.emulatorsPid);
  killProcessTree(state.dashboardPid);
  clearState();
  console.log('Stopped local dev stack.');
}

function resetDevStack() {
  clearState();
  fs.rmSync(DEV_DIR, { recursive: true, force: true });
  console.log('Removed local dev state.');
}

function extractDraftId(output) {
  const match = stripAnsi(output).match(/Conversation draft created:\s*([a-zA-Z0-9-]+)/);
  if (!match) {
    throw new Error(`Could not parse draft id from output:\n${output}`);
  }
  return match[1];
}

function extractJoinSeatKey(output) {
  const clean = stripAnsi(output);
  const marker = 'SAVE YOUR SEAT KEY';
  const markerIndex = clean.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Could not parse join seat key from output:\n${output}`);
  }
  const tail = clean.slice(markerIndex).split('\n').map((line) => line.trim()).filter(Boolean);
  const keyLine = tail.find((line) => /^[0-9a-f-]{36}$/i.test(line));
  if (!keyLine) {
    throw new Error(`Could not parse join seat key from output:\n${output}`);
  }
  return keyLine;
}

function extractPlanId(output) {
  const match = stripAnsi(output).match(/ID:\s*([a-zA-Z0-9-]+)/);
  if (!match) {
    throw new Error(`Could not parse plan id from output:\n${output}`);
  }
  return match[1];
}

function loadSeed() {
  if (!fs.existsSync(DEV_SEED_FILE)) return null;
  return JSON.parse(fs.readFileSync(DEV_SEED_FILE, 'utf8'));
}

async function showTestCreds() {
  ensureDevDirs();

  let seed = loadSeed();
  if (!seed) {
    await seedDevData();
    seed = loadSeed();
  }

  if (!seed) {
    throw new Error('Local seed file could not be created.');
  }

  const validation = await fetch(`${API_BASE_URL}/agent/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seatKey: seed.adminSeatKey }),
  }).then(async (response) => {
    if (response.ok) return { ok: true };
    return { ok: false, status: response.status, body: await response.text() };
  }).catch((error) => ({ ok: false, error: error.message }));

  if (!validation.ok) {
    console.log('Existing sandbox creds were stale, reseeding local data...');
    await seedDevData();
    seed = loadSeed();
  }

  console.log('');
  console.log('Local test credentials:');
  console.log(`  Team ID: ${seed.teamId}`);
  console.log(`  Dashboard: ${seed.dashboardUrl || DASHBOARD_URL}`);
  console.log(`  Admin seat key: ${seed.adminSeatKey}`);
  console.log(`  Peer seat key: ${seed.peerSeatKey}`);
  console.log(`  Join code: ${seed.joinCode}`);
  console.log('');
  console.log('Manual verification paths:');
  console.log(`  1. Open ${seed.dashboardUrl || DASHBOARD_URL} and sign in with the admin seat key.`);
  console.log(`  2. Use the "Join a team with a code" form with the join code and the peer seat name.`);
  console.log(`  3. Run ${process.execPath} bin/gsync.js join --code ${seed.joinCode} --seat-name teammate-mbp with HOME=${seed.devHome || DEV_HOME}.`);
}

async function seedDevData() {
  ensureDevDirs();
  await waitForServices();

  runCli(['init', '--local', '--api-key', FIREBASE_API_KEY, '--project-id', FIREBASE_PROJECT_ID], { inheritStdio: true });

  const teamResp = await fetch(`${API_BASE_URL}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamName: 'Local Dev Lab',
      seatName: 'agent-admin',
    }),
  });

  if (!teamResp.ok) {
    throw new Error(`Failed to create local dev team: ${teamResp.status} ${await teamResp.text()}`);
  }

  const team = await teamResp.json();
  runCli(['login', '--key', team.seatKey], { inheritStdio: true });

  const joinResult = runCli(['join', '--code', team.joinCode, '--seat-name', 'agent-peer']);
  const peerSeatKey = extractJoinSeatKey(joinResult.stdout);
  runCli(['login', '--key', team.seatKey], { inheritStdio: true });

  runCli(['goals', 'set-2week', '--goal', 'Ship the company memory layer and keep reviewer context fail-closed'], { inheritStdio: true });
  runCli(['goals', 'set-3day', '--goal', 'Verify local dev stack, memory approval flow, and sync refresh handling'], { inheritStdio: true });

  const companyDraft = runCli(['memory', 'draft', '--title', 'Company brief', '--body', 'We sell confidence for small teams.']);
  const companyDraftId = extractDraftId(companyDraft.stdout);
  runCli(['memory', 'approve', companyDraftId, '--to', 'companyBrief'], { inheritStdio: true });

  const projectDraft = runCli(['memory', 'draft', '--title', 'Project brief', '--body', 'This quarter focuses on onboarding, reliability, and memory visibility.']);
  const projectDraftId = extractDraftId(projectDraft.stdout);
  runCli(['memory', 'approve', projectDraftId, '--to', 'projectBrief'], { inheritStdio: true });

  const decisionDraft = runCli(['memory', 'draft', '--title', 'Memory policy', '--body', 'Approve drafts before they become durable memory.']);
  const decisionDraftId = extractDraftId(decisionDraft.stdout);
  runCli(['memory', 'approve', decisionDraftId, '--to', 'decisionLog'], { inheritStdio: true });

  runCli(['memory', 'draft', '--title', 'Open question', '--body', 'Should the agent sync before every reviewer-context read?']);

  fs.writeFileSync(DEV_PLAN_FILE, `---\nslug: dev-memory-loop\nsummary: Seed local memory dev loop\nalignment: Validates the approval-gated memory flow and dashboard visibility\noutOfScope: Production data, remote deploys, or long-term storage design\nstatus: in-progress\nauthor: agent-admin\ntouches: src/context.js, src/firestore.js, dashboard/src/components/MemoryPanel.jsx\n---\n\n# Seeded local dev plan\n\nThis plan exists only so the local dashboard has a realistic active plan to render.\n`, 'utf8');
  const planPush = runCli(['plan', 'push', DEV_PLAN_FILE]);
  const planId = extractPlanId(planPush.stdout);
  runCli(['plan', 'update', planId, '--note', 'Seeded demo plan for local dev testing.'], { inheritStdio: true });

  runCli(['sync'], { inheritStdio: true });

  const reviewerContext = runCli(['memory', 'reviewer-context']);
  if (!/Approved Company Brief/i.test(reviewerContext.stdout) || !/Approved Project Brief/i.test(reviewerContext.stdout)) {
    throw new Error(`Reviewer context did not include approved memory:\n${reviewerContext.stdout}`);
  }

  const seed = {
    teamId: team.teamId,
    adminSeatName: team.seatName,
    adminSeatKey: team.seatKey,
    joinCode: team.joinCode,
    peerSeatName: 'agent-peer',
    peerSeatKey,
    planId,
    dashboardUrl: DASHBOARD_URL,
    apiBaseUrl: API_BASE_URL,
    devHome: DEV_HOME,
    seededAt: new Date().toISOString(),
  };

  fs.writeFileSync(DEV_SEED_FILE, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');

  console.log('');
  console.log('Seeded local dev data.');
  console.log(`  Team: ${seed.teamId}`);
  console.log(`  Admin seat key: ${seed.adminSeatKey}`);
  console.log(`  Peer seat key: ${seed.peerSeatKey}`);
  console.log(`  Dashboard: ${DASHBOARD_URL}`);
  console.log(`  Dev home: ${DEV_HOME}`);
}

async function smokeTest() {
  await seedDevData();

  const homeCheck = runCli(['memory', 'reviewer-context']);
  if (!/Approved Company Brief/i.test(homeCheck.stdout)) {
    throw new Error('Reviewer context smoke check failed.');
  }

  const dashboardResp = await fetch(DASHBOARD_URL);
  if (!dashboardResp.ok) {
    throw new Error(`Dashboard smoke check failed: ${dashboardResp.status}`);
  }

  const staleDraft = runCli(['memory', 'draft', '--title', 'Updated company brief', '--body', 'We help teams stay aligned when approved memory changes.']);
  const staleDraftId = extractDraftId(staleDraft.stdout);
  runCli(['memory', 'approve', staleDraftId, '--to', 'companyBrief'], { inheritStdio: true });

  let failedClosed = false;
  try {
    runCli(['memory', 'reviewer-context']);
  } catch (error) {
    failedClosed = /Run `gsync sync`/i.test(error.message);
  }

  if (!failedClosed) {
    throw new Error('Reviewer context should fail closed after approved memory changes until sync reruns.');
  }

  runCli(['sync'], { inheritStdio: true });
  const refreshedContext = runCli(['memory', 'reviewer-context']);
  if (!/stay aligned when approved memory changes/i.test(refreshedContext.stdout)) {
    throw new Error('Reviewer context did not refresh after syncing updated approved memory.');
  }

  console.log('Smoke test passed.');
}

function showStatus() {
  const state = loadState();
  if (!state) {
    console.log('No local dev stack state file found.');
    return;
  }

  console.log(JSON.stringify({
    ...state,
    emulatorsRunning: isProcessAlive(state.emulatorsPid),
    dashboardRunning: isProcessAlive(state.dashboardPid),
    seedFile: fs.existsSync(DEV_SEED_FILE) ? DEV_SEED_FILE : null,
  }, null, 2));
}

function runPassthroughCli(args) {
  if (args.length === 0) {
    throw new Error('Pass a gsync command after `npm run dev:cli --`.');
  }
  runCli(args, { inheritStdio: true });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'up':
      await startDevStack();
      break;
    case 'down':
      await stopDevStack();
      break;
    case 'reset':
      resetDevStack();
      break;
    case 'seed':
      await seedDevData();
      break;
    case 'smoke':
      await smokeTest();
      break;
    case 'creds':
      await showTestCreds();
      break;
    case 'status':
      showStatus();
      break;
    case 'cli':
      runPassthroughCli(args);
      break;
    default:
      console.log([
        'Usage:',
        '  node scripts/dev-env.mjs up',
        '  node scripts/dev-env.mjs down',
        '  node scripts/dev-env.mjs reset',
        '  node scripts/dev-env.mjs seed',
        '  node scripts/dev-env.mjs smoke',
        '  node scripts/dev-env.mjs creds',
        '  node scripts/dev-env.mjs status',
        '  node scripts/dev-env.mjs cli <gsync args...>',
      ].join('\n'));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

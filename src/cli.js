import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';
import { loadConfig, saveConfig, loadSession, saveSession, clearSession, ensureDirs, PLANS_DIR, CONFIG_FILE, CONTEXT_FILE, INDEX_FILE, SKILL_FILE, getDefaultConfig, hasConfigFile } from './config.js';
import { initFirebase, cleanup, getTeamMeta, setTeamMeta, getPlanContent, getPlanSummary, getRecentPlans, updatePlanNote, updatePlanStatus, getActivePlans, upsertPlanContent } from './firestore.js';
import { generateContext } from './context.js';
import { formatPlanSummary, formatPlanSummaryDetail, formatRelativeTime, parseDuration } from './format.js';
import { buildPulledPlanFile, normalizeTouches, parsePlanFile } from './plan-file.js';

const program = new Command();

program
  .name('gsync')
  .description('Team sync CLI for coordinating plans via Firestore')
  .version('1.0.0')
  .option('--verbose', 'enable debug logging');

function verbose(...args) {
  if (program.opts().verbose) {
    console.log(chalk.gray('[debug]'), ...args);
  }
}

function friendlyError(err) {
  const code = err.code || '';
  if (code.includes('permission-denied')) return 'Authentication failed. Run `gsync signup`, `gsync join`, or `gsync login` to reconfigure.';
  if (code.includes('unavailable') || code.includes('network') || err.message?.includes('fetch')) return 'Cannot reach Firestore. Check your connection and retry.';
  if (code.includes('not-found')) return 'Resource not found. Check your team ID.';
  return err.message;
}

function requireConfig() {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red('Not initialized. Run `gsync signup`, `gsync join`, or `gsync login` first.'));
    process.exit(1);
  }
  const session = loadSession();
  if (!session) {
    console.error(chalk.red('Not logged in. Run `gsync signup`, `gsync join`, or `gsync login` first.'));
    process.exit(1);
  }
  verbose('Config loaded:', JSON.stringify(config, null, 2));
  verbose('Session loaded:', JSON.stringify(session, null, 2));
  initFirebase({ apiKey: config.firebaseApiKey, projectId: config.firebaseProjectId });
  return { config, session };
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '');
}

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'plan';
}

function writeLocalPlanFile(summary, content) {
  ensureDirs();
  const filename = `${sanitizeFilename(summary.slug || 'plan')}--${summary.id}.md`;
  const filePath = path.join(PLANS_DIR, filename);
  fs.writeFileSync(filePath, buildPulledPlanFile(summary, content), 'utf-8');
  return filePath;
}

function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) return null;
  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
}

function isLocalApiBaseUrl(apiBaseUrl) {
  try {
    const url = new URL(apiBaseUrl);
    return ['127.0.0.1', 'localhost'].includes(url.hostname);
  } catch {
    return false;
  }
}

function sameBackend(a, b) {
  return a.apiBaseUrl === b.apiBaseUrl
    && a.firebaseProjectId === b.firebaseProjectId
    && a.firebaseApiKey === b.firebaseApiKey
    && Boolean(a.useEmulators) === Boolean(b.useEmulators);
}

function resolveOnboardingConfig() {
  const config = loadConfig();
  if (!hasConfigFile()) {
    saveConfig(config);
  }
  return config;
}

// --- gsync init ---
program
  .command('init')
  .description('Initialize gsync app configuration')
  .option('--api-base-url <url>', 'base URL for onboarding API')
  .requiredOption('--api-key <key>', 'Firebase API key')
  .requiredOption('--project-id <id>', 'Firebase project ID')
  .option('--local', 'configure for local Firebase emulators')
  .option('--use-emulators', 'connect Firestore/Auth to local Firebase emulators')
  .option('--firestore-host <host:port>', 'Firestore emulator host', '127.0.0.1:8080')
  .option('--auth-host <host:port>', 'Auth emulator host', '127.0.0.1:9099')
  .action(async (opts) => {
    try {
      const useEmulators = Boolean(opts.local || opts.useEmulators);
      const apiBaseUrl = opts.local
        ? `http://127.0.0.1:5001/${opts.projectId}/us-central1/api`
        : opts.apiBaseUrl;

      if (!apiBaseUrl) {
        throw new Error('apiBaseUrl is required unless you pass `--local`.');
      }

      const config = {
        apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
        firebaseApiKey: opts.apiKey,
        firebaseProjectId: opts.projectId,
        useEmulators,
        firestoreHost: opts.firestoreHost,
        authHost: opts.authHost,
      };
      saveConfig(config);
      ensureDirs();

      clearSession();

      // Validate Firestore connection shape
      try {
        initFirebase({
          apiKey: config.firebaseApiKey,
          projectId: config.firebaseProjectId,
          useEmulators: config.useEmulators,
          firestoreHost: config.firestoreHost,
        });
      } catch (err) {
        verbose('Firebase validation error:', err.code, err.message);
        const code = err.code || '';
        if (code.includes('permission-denied') || code.includes('unauthenticated')) {
          fs.unlinkSync(CONFIG_FILE);
          throw new Error('Firebase authentication failed. Check your API key and project ID.');
        }
        if (code.includes('unavailable') || code.includes('network') || err.message?.includes('ENOTFOUND')) {
          fs.unlinkSync(CONFIG_FILE);
          throw new Error('Cannot reach Firebase. Check your network connection and project ID.');
        }
        console.log(chalk.yellow(`  ⚠ Could not validate connection: ${err.message}`));
        console.log(chalk.yellow(`  Proceeding — this may be a new/empty project.`));
      }

      // Copy SKILL.md for agent integration
      const skillSrc = path.join(path.dirname(fileURLToPath(import.meta.url)), '../SKILL.md');
      if (fs.existsSync(skillSrc)) {
        fs.copyFileSync(skillSrc, SKILL_FILE);
      }

      console.log(chalk.green('✓ gsync configured!'));
      console.log(chalk.cyan(`  Config saved to ~/.gsync/config.json`));
      console.log(chalk.cyan(`  Plans directory: ~/.gsync/plans/`));
      console.log(chalk.cyan(`  API: ${config.apiBaseUrl}`));
      console.log(chalk.cyan(`  Firebase project: ${config.firebaseProjectId}`));
      if (config.useEmulators) {
        console.log(chalk.cyan(`  Emulators: Firestore ${config.firestoreHost}, Auth ${config.authHost}`));
      }
      if (fs.existsSync(SKILL_FILE)) {
        console.log(chalk.cyan(`  SKILL.md installed at ~/.gsync/SKILL.md`));
      }
    } catch (err) {
      console.error(chalk.red(`Init failed: ${friendlyError(err)}`));
      process.exit(1);
    }
  });

// --- gsync sync ---
program
  .command('sync')
  .description('Sync plans and generate CONTEXT.md')
  .option('--last <count>', 'number of recent plans to include', '20')
  .action(async (opts) => {
    try {
      const { session } = requireConfig();
      ensureDirs();
      const recentCount = Number.parseInt(opts.last ?? '20', 10);

      verbose('Fetching data from Firestore...');
      const [twoWeek, threeDay, activePlans, recentPlans] = await Promise.all([
        getTeamMeta(session.teamId, '2week'),
        getTeamMeta(session.teamId, '3day'),
        getActivePlans(session.teamId),
        getRecentPlans(session.teamId, Number.isNaN(recentCount) ? 20 : recentCount),
      ]);

      const contextContent = generateContext(twoWeek, threeDay, activePlans, recentPlans);
      fs.writeFileSync(CONTEXT_FILE, contextContent, 'utf-8');
      fs.writeFileSync(
        INDEX_FILE,
        JSON.stringify({
          syncedAt: new Date().toISOString(),
          teamId: session.teamId,
          activePlans,
          recentPlans,
        }, null, 2) + '\n',
        'utf-8',
      );

      console.log(chalk.green(`✓ Synced ${activePlans.length} active plan(s)`));
      console.log(chalk.cyan(`  CONTEXT.md updated at ~/.gsync/CONTEXT.md`));
      for (const plan of activePlans) {
        console.log(chalk.cyan(`  ${formatPlanSummary(plan)}`));
      }
    } catch (err) {
      console.error(chalk.red(`Sync failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// --- gsync plan ---
const planCmd = program
  .command('plan')
  .description('Manage plans');

// gsync plan update <id>
planCmd
  .command('update <id>')
  .description('Add an update note to a plan')
  .requiredOption('--note <text>', 'update note')
  .action(async (id, opts) => {
    try {
      const { session } = requireConfig();
      verbose('Updating plan:', id);
      await updatePlanNote(session.teamId, id, opts.note, session.seatName);
      console.log(chalk.green(`✓ Note added to plan ${id}`));
    } catch (err) {
      console.error(chalk.red(`Plan update failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

planCmd
  .command('push <file>')
  .description('Create or update a canonical markdown plan')
  .option('--id <id>', 'existing plan ID')
  .option('--summary <text>', 'plan summary override')
  .option('--alignment <text>', 'alignment override')
  .option('--out-of-scope <text>', 'out of scope override')
  .option('--touches <paths>', 'comma-separated touched paths override')
  .option('--status <status>', 'status override')
  .action(async (file, opts) => {
    try {
      const { session } = requireConfig();
      const raw = fs.readFileSync(path.resolve(file), 'utf-8');
      const parsed = parsePlanFile(raw);
      const summary = opts.summary || parsed.metadata.summary;
      if (!summary) {
        throw new Error('Plan summary is required. Add `summary:` to frontmatter or pass `--summary`.');
      }

      const planId = opts.id || parsed.metadata.id || null;
      const touches = normalizeTouches(opts.touches || parsed.metadata.touches || '');
      const revision = parsed.metadata.revision == null ? null : Number.parseInt(String(parsed.metadata.revision), 10);
      const slug = sanitizeFilename(parsed.metadata.slug || slugify(summary));
      const summaryData = {
        slug,
        summary,
        alignment: opts.alignment ?? parsed.metadata.alignment ?? '',
        outOfScope: opts.outOfScope ?? parsed.metadata.outOfScope ?? '',
        touches,
        author: parsed.metadata.author || session.seatName,
        status: opts.status || parsed.metadata.status || 'in-progress',
        prUrl: parsed.metadata.prUrl || null,
      };

      const id = await upsertPlanContent(
        session.teamId,
        planId,
        summaryData,
        parsed.markdown,
        session.seatName,
        Number.isNaN(revision) ? null : revision,
      );

      const savedSummary = await getPlanSummary(session.teamId, id);
      const savedContent = await getPlanContent(session.teamId, id);
      const localPath = writeLocalPlanFile(savedSummary, savedContent);

      console.log(chalk.green(`✓ Plan pushed: ${savedSummary.slug}`));
      console.log(chalk.cyan(`  ID: ${id}`));
      console.log(chalk.cyan(`  Revision: ${savedContent?.revision || savedSummary.revision || 0}`));
      console.log(chalk.cyan(`  Cached at: ${localPath}`));
    } catch (err) {
      console.error(chalk.red(`Plan push failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

planCmd
  .command('review <id>')
  .description('Move plan to review status')
  .option('--pr <url>', 'pull request URL')
  .action(async (id, opts) => {
    try {
      if (opts.pr && !/^https?:\/\//i.test(opts.pr)) {
        console.error(chalk.red('PR URL must start with http:// or https://'));
        process.exit(1);
      }
      const { session } = requireConfig();
      verbose('Setting plan to review:', id);
      const extra = opts.pr ? { prUrl: opts.pr } : {};
      await updatePlanStatus(session.teamId, id, 'review', extra);
      console.log(chalk.green(`✓ Plan ${id} moved to review`));
      if (opts.pr) {
        console.log(chalk.cyan(`  PR: ${opts.pr}`));
      }
    } catch (err) {
      console.error(chalk.red(`Plan review failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// gsync plan merged <id>
planCmd
  .command('merged <id>')
  .description('Mark plan as merged')
  .action(async (id) => {
    try {
      const { session } = requireConfig();
      verbose('Setting plan to merged:', id);
      await updatePlanStatus(session.teamId, id, 'merged');
      console.log(chalk.green(`✓ Plan ${id} marked as merged`));
    } catch (err) {
      console.error(chalk.red(`Plan merged failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// gsync plan get <id>
planCmd
  .command('pull <id>')
  .description('Fetch a plan')
  .option('--metadata-only', 'print summary metadata without pulling the body')
  .option('--stdout', 'print the full canonical markdown body instead of writing a file')
  .action(async (id, opts) => {
    try {
      const { session } = requireConfig();
      const summary = await getPlanSummary(session.teamId, id);
      if (!summary) {
        throw new Error(`Plan ${id} not found.`);
      }

      if (opts.metadataOnly) {
        console.log(formatPlanSummaryDetail(summary));
        return;
      }

      const content = await getPlanContent(session.teamId, id);
      if (!content) {
        throw new Error(`Plan ${id} has no canonical markdown body yet.`);
      }

      if (opts.stdout) {
        console.log(formatPlanSummaryDetail(summary));
        console.log('');
        console.log(content.markdown);
        return;
      }

      const localPath = writeLocalPlanFile(summary, content);
      console.log(chalk.green(`✓ Plan pulled: ${summary.slug}`));
      console.log(chalk.cyan(`  Cached at: ${localPath}`));
      console.log(chalk.cyan(`  Revision: ${content.revision || summary.revision || 0}`));
    } catch (err) {
      console.error(chalk.red(`Plan pull failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// --- gsync goals ---
const goalsCmd = program
  .command('goals')
  .description('Manage team goals');

goalsCmd
  .command('set-2week')
  .description('Set the 2-week goal')
  .requiredOption('--goal <text>', 'the 2-week goal')
  .action(async (opts) => {
    try {
      const { session } = requireConfig();
      verbose('Setting 2-week goal');
      await setTeamMeta(session.teamId, '2week', opts.goal, session.seatName);
      console.log(chalk.green('✓ 2-week goal updated'));
    } catch (err) {
      console.error(chalk.red(`Set 2-week goal failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

goalsCmd
  .command('set-3day')
  .description('Set the 3-day target')
  .requiredOption('--goal <text>', 'the 3-day target')
  .action(async (opts) => {
    try {
      const { session } = requireConfig();
      verbose('Setting 3-day target');
      await setTeamMeta(session.teamId, '3day', opts.goal, session.seatName);
      console.log(chalk.green('✓ 3-day target updated'));
    } catch (err) {
      console.error(chalk.red(`Set 3-day target failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// --- gsync status ---
program
  .command('status')
  .description('Show status of all active plans from local cache')
  .action(() => {
    try {
      const index = loadIndex();
      if (!index || !Array.isArray(index.activePlans) || index.activePlans.length === 0) {
        console.log(chalk.yellow('No cached plans. Run `gsync sync` first.'));
        return;
      }
      console.log(chalk.cyan(`Active plans (${index.activePlans.length}):`));
      for (const plan of index.activePlans) {
        console.log(`  ${chalk.white(plan.author || 'unknown')} — ${chalk.cyan(plan.slug || plan.id)} (${plan.status || 'unknown'}): ${plan.summary || ''}`);
      }
    } catch (err) {
      console.error(chalk.red(`Status failed: ${friendlyError(err)}`));
      process.exit(1);
    }
  });

// --- gsync log ---
program
  .command('log')
  .description('Show recent activity across all plans')
  .option('--since <duration>', 'time window (e.g. 24h, 7d, 1w)', '24h')
  .action(async (opts) => {
    try {
      const { session } = requireConfig();
      const durationMs = parseDuration(opts.since);
      const cutoff = Date.now() - durationMs;

      verbose(`Fetching all plans, cutoff: ${new Date(cutoff).toISOString()}`);
      const plans = await getRecentPlans(session.teamId, 50);

      const events = [];

      for (const plan of plans) {
        // Plan creation event
        const createdMs = toMillis(plan.createdAt);
        if (createdMs && createdMs > cutoff) {
          events.push({
            time: createdMs,
            text: `${plan.author} created ${plan.slug}`,
          });
        }

        // Update events
        if (plan.updates) {
          for (const u of plan.updates) {
            const uMs = toMillis(u.timestamp);
            if (uMs && uMs > cutoff) {
              events.push({
                time: uMs,
                text: `${u.author} updated ${plan.slug}: "${u.note}"`,
              });
            }
          }
        }
      }

      events.sort((a, b) => b.time - a.time);

      if (events.length === 0) {
        console.log(chalk.yellow(`No activity in the last ${opts.since}.`));
        return;
      }

      console.log(chalk.cyan(`Activity (last ${opts.since}):`));
      for (const e of events) {
        const rel = formatRelativeTime({ seconds: Math.floor(e.time / 1000) });
        console.log(`  - ${rel} — ${e.text}`);
      }
    } catch (err) {
      console.error(chalk.red(`Log failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

function toMillis(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toMillis) return timestamp.toMillis();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  if (timestamp instanceof Date) return timestamp.getTime();
  return new Date(timestamp).getTime();
}

async function apiPost(config, endpoint, body) {
  const url = `${config.apiBaseUrl}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

async function apiPostWithFallback(config, endpoint, body) {
  try {
    const data = await apiPost(config, endpoint, body);
    return { data, config, fellBackToHosted: false };
  } catch (err) {
    const hostedConfig = getDefaultConfig();
    if (!isLocalApiBaseUrl(config.apiBaseUrl) || sameBackend(config, hostedConfig)) {
      throw err;
    }

    verbose(`Onboarding request failed against local backend (${config.apiBaseUrl}). Retrying hosted backend (${hostedConfig.apiBaseUrl}).`);
    const data = await apiPost(hostedConfig, endpoint, body);
    saveConfig(hostedConfig);
    return { data, config: hostedConfig, fellBackToHosted: true };
  }
}

async function firebaseSignIn(config, customToken) {
  const { getAuth, signInWithCustomToken, connectAuthEmulator } = await import('firebase/auth');
  initFirebase({
    apiKey: config.firebaseApiKey,
    projectId: config.firebaseProjectId,
    useEmulators: config.useEmulators,
    firestoreHost: config.firestoreHost,
  });
  const auth = getAuth();
  if (config.useEmulators) {
    connectAuthEmulator(auth, `http://${config.authHost}`, { disableWarnings: true });
  }
  await signInWithCustomToken(auth, customToken);
}

// --- gsync signup ---
program
  .command('signup')
  .description('Create a new team and get your first seat')
  .requiredOption('--team <name>', 'team name')
  .requiredOption('--seat-name <name>', 'name for this seat/machine')
  .action(async (opts) => {
    try {
      const config = resolveOnboardingConfig();

      verbose('Creating team...');
      const { data, config: activeConfig, fellBackToHosted } = await apiPostWithFallback(config, '/teams', { teamName: opts.team, seatName: opts.seatName });

      const session = {
        teamId: data.teamId,
        seatId: data.seatId,
        seatName: opts.seatName,
        role: data.role || 'admin',
        lastLoginAt: new Date().toISOString(),
      };

      if (data.firebaseToken) {
        await firebaseSignIn(activeConfig, data.firebaseToken);
      }
      saveConfig(activeConfig);
      saveSession(session);

      console.log(chalk.green('✓ Team created!'));
      if (fellBackToHosted) {
        console.log(chalk.yellow(`  Switched onboarding to hosted backend: ${activeConfig.apiBaseUrl}`));
      }
      console.log(chalk.cyan(`  Team ID: ${data.teamId}`));
      console.log(chalk.cyan(`  Seat ID: ${data.seatId}`));
      console.log('');
      console.log(chalk.yellow.bold('⚠ SAVE YOUR SEAT KEY — you will need it to log in again:'));
      console.log(chalk.white.bold(`  ${data.seatKey}`));
      console.log('');
      if (data.joinCode) {
        console.log(chalk.cyan(`  Join code for teammates: ${data.joinCode}`));
      }
    } catch (err) {
      console.error(chalk.red(`Signup failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// --- gsync join ---
program
  .command('join')
  .description('Join an existing team with a join code')
  .requiredOption('--code <join-code>', 'join code from team admin')
  .requiredOption('--seat-name <name>', 'name for this seat/machine')
  .action(async (opts) => {
    try {
      const config = resolveOnboardingConfig();

      verbose('Joining team...');
      const { data, config: activeConfig, fellBackToHosted } = await apiPostWithFallback(config, '/teams/join', { joinCode: opts.code, seatName: opts.seatName });

      const session = {
        teamId: data.teamId,
        seatId: data.seatId,
        seatName: opts.seatName,
        role: data.role || 'member',
        lastLoginAt: new Date().toISOString(),
      };

      if (data.firebaseToken) {
        await firebaseSignIn(activeConfig, data.firebaseToken);
      }
      saveConfig(activeConfig);
      saveSession(session);

      console.log(chalk.green('✓ Joined team!'));
      if (fellBackToHosted) {
        console.log(chalk.yellow(`  Switched onboarding to hosted backend: ${activeConfig.apiBaseUrl}`));
      }
      console.log(chalk.cyan(`  Team ID: ${data.teamId}`));
      console.log(chalk.cyan(`  Seat ID: ${data.seatId}`));
      console.log('');
      console.log(chalk.yellow.bold('⚠ SAVE YOUR SEAT KEY — you will need it to log in again:'));
      console.log(chalk.white.bold(`  ${data.seatKey}`));
    } catch (err) {
      console.error(chalk.red(`Join failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// --- gsync login ---
program
  .command('login')
  .description('Log in with your seat key')
  .requiredOption('--key <seat-key>', 'your seat key')
  .action(async (opts) => {
    try {
      const config = resolveOnboardingConfig();

      verbose('Logging in...');
      const { data, config: activeConfig, fellBackToHosted } = await apiPostWithFallback(config, '/agent/login', { seatKey: opts.key });

      const session = {
        teamId: data.teamId,
        seatId: data.seatId,
        seatName: data.seatName || data.seatId,
        role: data.role,
        lastLoginAt: new Date().toISOString(),
      };

      if (data.firebaseToken) {
        await firebaseSignIn(activeConfig, data.firebaseToken);
      }
      saveConfig(activeConfig);
      saveSession(session);

      console.log(chalk.green(`✓ Logged in as ${session.seatName}`));
      if (fellBackToHosted) {
        console.log(chalk.yellow(`  Switched onboarding to hosted backend: ${activeConfig.apiBaseUrl}`));
      }
      console.log(chalk.cyan(`  Team: ${session.teamId}`));
      console.log(chalk.cyan(`  Role: ${session.role}`));
    } catch (err) {
      console.error(chalk.red(`Login failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// --- gsync logout ---
program
  .command('logout')
  .description('Clear local session')
  .action(() => {
    clearSession();
    console.log(chalk.green('✓ Logged out. Session cleared.'));
  });

program.parseAsync().finally(() => cleanup().catch(() => {}));

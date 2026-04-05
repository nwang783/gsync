import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

import { loadConfig, saveConfig, ensureDirs, PLANS_DIR, CONFIG_FILE, CONTEXT_FILE } from './config.js';
import { initFirebase, cleanup, getTeamMeta, setTeamMeta, createPlan, getPlan, updatePlanNote, updatePlanStatus, getActivePlans, getAllPlans } from './firestore.js';
import { generateContext } from './context.js';
import { formatPlanSummary, formatPlanDetail, formatRelativeTime, parseDuration } from './format.js';

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
  if (code.includes('permission-denied')) return 'Authentication failed. Run `gsync init` to reconfigure.';
  if (code.includes('unavailable') || code.includes('network') || err.message?.includes('fetch')) return 'Cannot reach Firestore. Check your connection and retry.';
  if (code.includes('not-found')) return 'Resource not found. Check your team ID.';
  return err.message;
}

function requireConfig() {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red('Not initialized. Run `gsync init` first.'));
    process.exit(1);
  }
  verbose('Config loaded:', JSON.stringify(config, null, 2));
  initFirebase(config);
  return config;
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

// --- gsync init ---
program
  .command('init')
  .description('Initialize gsync configuration')
  .requiredOption('--team-id <id>', 'team ID')
  .requiredOption('--user-name <name>', 'your display name')
  .requiredOption('--api-key <key>', 'Firebase API key')
  .requiredOption('--project-id <id>', 'Firebase project ID')
  .action(async (opts) => {
    try {
      const config = {
        teamId: opts.teamId,
        userName: opts.userName,
        apiKey: opts.apiKey,
        projectId: opts.projectId,
      };
      saveConfig(config);
      ensureDirs();

      // Validate Firebase connection
      try {
        initFirebase(config);
        await getTeamMeta(config.teamId, '2week');
      } catch (err) {
        verbose('Firebase validation error:', err.code, err.message);
        // permission-denied or unavailable = real problem
        // missing-doc or not-found is fine (empty project)
        const code = err.code || '';
        if (code.includes('permission-denied') || code.includes('unauthenticated')) {
          fs.unlinkSync(CONFIG_FILE);
          throw new Error('Firebase authentication failed. Check your API key and project ID.');
        }
        if (code.includes('unavailable') || code.includes('network') || err.message?.includes('ENOTFOUND')) {
          fs.unlinkSync(CONFIG_FILE);
          throw new Error('Cannot reach Firebase. Check your network connection and project ID.');
        }
        // For other errors (e.g. missing indexes, empty project), warn but don't fail
        console.log(chalk.yellow(`  ⚠ Could not validate connection: ${err.message}`));
        console.log(chalk.yellow(`  Proceeding — this may be a new/empty project.`));
      }

      console.log(chalk.green('✓ gsync initialized!'));
      console.log(chalk.cyan(`  Config saved to ~/.gsync/config.json`));
      console.log(chalk.cyan(`  Plans directory: ~/.gsync/plans/`));
      console.log(chalk.yellow(`  Note: Copy your SKILL.md to ~/.gsync/SKILL.md for agent integration.`));
    } catch (err) {
      console.error(chalk.red(`Init failed: ${friendlyError(err)}`));
      process.exit(1);
    }
  });

// --- gsync sync ---
program
  .command('sync')
  .description('Sync plans and generate CONTEXT.md')
  .action(async () => {
    try {
      const config = requireConfig();
      ensureDirs();

      verbose('Fetching data from Firestore...');
      const [twoWeek, threeDay, activePlans, allPlans] = await Promise.all([
        getTeamMeta(config.teamId, '2week'),
        getTeamMeta(config.teamId, '3day'),
        getActivePlans(config.teamId),
        getAllPlans(config.teamId),
      ]);

      // Build plan cache files in memory
      const planFiles = activePlans.map((plan) => {
        const filename = `${sanitizeFilename(plan.slug || 'plan')}--${plan.id}.md`;
        const content = formatPlanDetail(plan);
        return { filename, content };
      });

      // Build CONTEXT.md in memory
      const contextContent = generateContext(twoWeek, threeDay, activePlans, allPlans);

      // All data ready — now write to disk atomically
      const newFilenames = new Set(planFiles.map((f) => f.filename));
      const existing = fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith('.md'));

      // Write new/updated files
      for (const { filename, content } of planFiles) {
        fs.writeFileSync(path.join(PLANS_DIR, filename), content, 'utf-8');
        verbose(`Wrote ${filename}`);
      }

      // Remove old files not in new set
      for (const f of existing) {
        if (!newFilenames.has(f)) {
          fs.unlinkSync(path.join(PLANS_DIR, f));
          verbose(`Removed stale ${f}`);
        }
      }

      fs.writeFileSync(CONTEXT_FILE, contextContent, 'utf-8');

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

// gsync plan create
planCmd
  .command('create')
  .description('Create a new plan')
  .requiredOption('--summary <text>', 'plan summary')
  .requiredOption('--alignment <text>', 'alignment with current goals')
  .requiredOption('--out-of-scope <text>', 'what is out of scope')
  .requiredOption('--touches <paths>', 'comma-separated list of files/dirs touched')
  .action(async (opts) => {
    try {
      const config = requireConfig();
      const slug = slugify(opts.summary);
      const touches = opts.touches.split(',').map((t) => t.trim());

      verbose('Creating plan:', slug);
      const planData = {
        slug,
        summary: opts.summary,
        alignment: opts.alignment,
        outOfScope: opts.outOfScope,
        touches,
        author: config.userName,
      };

      const id = await createPlan(config.teamId, planData);
      console.log(chalk.green(`✓ Plan created: ${slug}`));
      console.log(chalk.cyan(`  ID: ${id}`));
    } catch (err) {
      console.error(chalk.red(`Plan create failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// gsync plan update <id>
planCmd
  .command('update <id>')
  .description('Add an update note to a plan')
  .requiredOption('--note <text>', 'update note')
  .action(async (id, opts) => {
    try {
      const config = requireConfig();
      verbose('Updating plan:', id);
      await updatePlanNote(config.teamId, id, opts.note, config.userName);
      console.log(chalk.green(`✓ Note added to plan ${id}`));
    } catch (err) {
      console.error(chalk.red(`Plan update failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// gsync plan review <id>
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
      const config = requireConfig();
      verbose('Setting plan to review:', id);
      const extra = opts.pr ? { prUrl: opts.pr } : {};
      await updatePlanStatus(config.teamId, id, 'review', extra);
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
      const config = requireConfig();
      verbose('Setting plan to merged:', id);
      await updatePlanStatus(config.teamId, id, 'merged');
      console.log(chalk.green(`✓ Plan ${id} marked as merged`));
    } catch (err) {
      console.error(chalk.red(`Plan merged failed: ${friendlyError(err)}`));
      if (program.opts().verbose) console.error(err);
      process.exit(1);
    }
  });

// gsync plan get <id>
planCmd
  .command('get <id>')
  .description('Get full plan details')
  .action(async (id) => {
    try {
      const config = requireConfig();
      verbose('Fetching plan:', id);
      const plan = await getPlan(config.teamId, id);
      if (!plan) {
        console.error(chalk.red(`Plan ${id} not found.`));
        process.exit(1);
      }
      console.log(formatPlanDetail(plan));
    } catch (err) {
      console.error(chalk.red(`Plan get failed: ${friendlyError(err)}`));
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
      const config = requireConfig();
      verbose('Setting 2-week goal');
      await setTeamMeta(config.teamId, '2week', opts.goal, config.userName);
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
      const config = requireConfig();
      verbose('Setting 3-day target');
      await setTeamMeta(config.teamId, '3day', opts.goal, config.userName);
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
      ensureDirs();
      const files = fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith('.md'));
      if (files.length === 0) {
        console.log(chalk.yellow('No cached plans. Run `gsync sync` first.'));
        return;
      }
      console.log(chalk.cyan(`Active plans (${files.length}):`));
      for (const f of files) {
        const content = fs.readFileSync(path.join(PLANS_DIR, f), 'utf-8');
        const statusMatch = content.match(/^Status:\s*(.+)$/m);
        const authorMatch = content.match(/^Author:\s*(.+)$/m);
        const summaryMatch = content.match(/^Summary:\s*(.+)$/m);
        const name = f.replace('.md', '').replace(/--[a-zA-Z0-9]+$/, '');
        const status = statusMatch ? statusMatch[1] : 'unknown';
        const author = authorMatch ? authorMatch[1] : 'unknown';
        const summary = summaryMatch ? summaryMatch[1] : '';
        console.log(`  ${chalk.white(author)} — ${chalk.cyan(name)} (${status}): ${summary}`);
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
      const config = requireConfig();
      const durationMs = parseDuration(opts.since);
      const cutoff = Date.now() - durationMs;

      verbose(`Fetching all plans, cutoff: ${new Date(cutoff).toISOString()}`);
      const plans = await getAllPlans(config.teamId);

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

program.parseAsync().finally(() => cleanup().catch(() => {}));

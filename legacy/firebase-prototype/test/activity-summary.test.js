import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildActivitySummaryFingerprint,
  buildActivitySummaryPrompt,
  buildActivitySummarySource,
  resolveActivitySummaryModel,
  computeCloseCandidates,
  computeNextCandidates,
} = require('../functions/insights/activity-summary.cjs');

test('buildActivitySummarySource keeps payload compact and counts activity correctly', () => {
  const source = buildActivitySummarySource({
    teamId: 'team-1',
    teamName: 'Alpha',
    twoWeekGoal: 'Ship the summary block',
    threeDayGoal: 'Wire the live refresh',
    now: new Date('2026-04-11T12:00:00.000Z'),
    plans: [
      {
        id: 'p1',
        slug: 'plan-one',
        author: 'alex',
        status: 'review',
        summary: 'First plan',
        createdAt: new Date('2026-04-11T09:00:00.000Z'),
        updatedAt: new Date('2026-04-11T11:30:00.000Z'),
        updates: [{ timestamp: new Date('2026-04-11T11:45:00.000Z'), author: 'alex', note: 'Moved to review' }],
      },
      {
        id: 'p2',
        slug: 'plan-two',
        author: 'sam',
        status: 'merged',
        summary: 'Second plan',
        createdAt: new Date('2026-04-10T09:00:00.000Z'),
        updatedAt: new Date('2026-04-11T10:30:00.000Z'),
        updates: [],
      },
    ],
  });

  assert.equal(source.scope.kind, 'team');
  assert.equal(source.stats.totalPlans, 2);
  assert.equal(source.stats.activePlans, 1);
  assert.equal(source.stats.mergedPlans, 1);
  assert.equal(source.stats.createdToday, 1);
  assert.equal(source.stats.contributors, 2);
  assert.equal(source.recentPlans[0].slug, 'plan-one');
  assert.equal(source.recentActivity[0].action, 'updated');
});

test('buildActivitySummaryPrompt is explicit about the model payload', () => {
  const source = buildActivitySummarySource({
    teamId: 'team-1',
    plans: [],
    now: new Date('2026-04-11T12:00:00.000Z'),
  });

  const prompt = buildActivitySummaryPrompt(source);
  assert.match(prompt, /activity-summary/);
  assert.match(prompt, /Use only the supplied data/);
  assert.match(prompt, /recentPlans/);
});

test('resolveActivitySummaryModel defaults to the newest flash lite model', () => {
  const model = resolveActivitySummaryModel({
    AI_INSIGHTS_PROVIDER: 'google',
  });

  assert.equal(model.provider, 'google');
  assert.equal(model.model, 'gemini-3.1-flash-lite-preview');
});

test('buildActivitySummaryFingerprint is stable for the same source', () => {
  const source = buildActivitySummarySource({
    teamId: 'team-1',
    plans: [],
    now: new Date('2026-04-11T12:00:00.000Z'),
  });

  const a = buildActivitySummaryFingerprint(source);
  const b = buildActivitySummaryFingerprint(source);
  assert.equal(a, b);
});

test('buildActivitySummarySource includes signals and candidates', () => {
  const now = new Date('2026-04-11T12:00:00.000Z');
  const nowMs = now.getTime();
  const staleUpdatedAt = new Date(nowMs - 5 * 24 * 60 * 60 * 1000); // 5 days ago

  const source = buildActivitySummarySource({
    teamId: 'team-1',
    twoWeekGoal: 'Ship auth flow',
    threeDayGoal: 'Close review queue',
    now,
    plans: [
      {
        id: 'p-stale',
        slug: 'stale-plan',
        author: 'alex',
        status: 'in-progress',
        summary: 'Stale work item',
        alignment: '',
        updatedAt: staleUpdatedAt,
        createdAt: staleUpdatedAt,
        updates: [],
      },
      {
        id: 'p-merged',
        slug: 'merged-plan',
        author: 'sam',
        status: 'merged',
        summary: 'Merged last night',
        updatedAt: new Date(nowMs - 18 * 60 * 60 * 1000), // 18h ago
        createdAt: new Date(nowMs - 2 * 24 * 60 * 60 * 1000),
        updates: [],
      },
    ],
  });

  assert.ok(source.signals, 'signals block is present');
  assert.equal(source.signals.stalePlanCount, 1);
  assert.equal(source.signals.recentMergeCount, 1);
  assert.ok(source.candidates, 'candidates block is present');
});

test('computeCloseCandidates detects abandoned plan', () => {
  const nowMs = new Date('2026-04-11T12:00:00.000Z').getTime();
  const stalePlan = {
    id: 'p1',
    slug: 'old-work',
    status: 'in-progress',
    summary: 'Old work item',
    alignment: '',
    prUrl: null,
    updatedAt: new Date(nowMs - 5 * 24 * 60 * 60 * 1000),
  };
  const candidates = computeCloseCandidates([stalePlan], nowMs);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].action, 'abandoned');
  assert.equal(candidates[0].slug, 'old-work');
});

test('computeCloseCandidates detects plan with prUrl as merged candidate', () => {
  const nowMs = new Date('2026-04-11T12:00:00.000Z').getTime();
  const plan = {
    id: 'p2',
    slug: 'pr-plan',
    status: 'review',
    summary: 'Has a PR',
    alignment: 'closes the auth flow',
    prUrl: 'https://github.com/org/repo/pull/42',
    updatedAt: new Date(nowMs - 1 * 24 * 60 * 60 * 1000),
  };
  const candidates = computeCloseCandidates([plan], nowMs);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].action, 'merged');
});

test('computeNextCandidates returns goal-aligned plans', () => {
  const nowMs = new Date('2026-04-11T12:00:00.000Z').getTime();
  const plan = {
    id: 'p3',
    slug: 'auth-work',
    status: 'in-progress',
    summary: 'Auth flow implementation',
    alignment: 'directly supports 3-day target for auth',
    prUrl: null,
    updatedAt: new Date(nowMs - 2 * 60 * 60 * 1000),
  };
  const goals = { twoWeek: 'Ship the full auth module', threeDay: 'Close the 3-day auth sprint' };
  const candidates = computeNextCandidates([plan], goals, nowMs);
  assert.ok(candidates.length > 0, 'should return at least one candidate');
  assert.equal(candidates[0].slug, 'auth-work');
});

test('buildActivitySummaryPrompt includes signals and candidates when present', () => {
  const now = new Date('2026-04-11T12:00:00.000Z');
  const source = buildActivitySummarySource({
    teamId: 'team-1',
    threeDayGoal: 'Close review',
    now,
    plans: [{
      id: 'p1',
      slug: 'plan-one',
      author: 'alex',
      status: 'in-progress',
      summary: 'Work item',
      alignment: 'supports 3-day target to close review',
      prUrl: 'https://github.com/org/repo/pull/7',
      updatedAt: new Date(now.getTime() - 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      updates: [],
    }],
  });
  const prompt = buildActivitySummaryPrompt(source);
  assert.match(prompt, /signals/);
  assert.match(prompt, /candidates/);
});

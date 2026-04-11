import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildActivitySummaryFingerprint,
  buildActivitySummaryPrompt,
  buildActivitySummarySource,
  resolveActivitySummaryModel,
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

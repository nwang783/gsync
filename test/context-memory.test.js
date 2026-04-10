import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompiledContextPack, buildSyncContextContent, assertReviewerContextReady } from '../src/context.js';

test('buildCompiledContextPack produces fresh pack from approved memory', () => {
  const pack = buildCompiledContextPack({
    twoWeek: { content: 'Ship beta' },
    threeDay: { content: 'Close onboarding bugs' },
    activePlans: [],
    recentPlans: [],
    memory: {
      revision: 3,
      companyBrief: { content: 'We sell confidence for small teams.' },
      projectBrief: { content: 'This quarter focuses on onboarding and reliability.' },
      decisionLog: { entries: [{ decidedAt: '2026-04-10', summary: 'Keep approval-gated memory' }] },
    },
    now: new Date('2026-04-10T00:00:00.000Z'),
  });

  assert.equal(pack.state, 'fresh');
  assert.match(pack.markdown, /Approved Company Brief/);
  assert.match(pack.markdown, /Keep approval-gated memory/);
  assert.equal(pack.memoryRevision, 3);
});

test('buildSyncContextContent includes approved memory in the normal sync artifact', () => {
  const result = buildSyncContextContent({
    twoWeek: { content: 'Ship beta' },
    threeDay: { content: 'Close onboarding bugs' },
    activePlans: [],
    recentPlans: [],
    memory: {
      revision: 3,
      companyBrief: { content: 'We sell confidence for small teams.' },
      projectBrief: { content: 'This quarter focuses on onboarding and reliability.' },
      decisionLog: { entries: [] },
    },
    now: new Date('2026-04-10T00:00:00.000Z'),
  });

  assert.equal(result.compiledPack.state, 'fresh');
  assert.match(result.contextContent, /Approved Company Brief/);
  assert.match(result.contextContent, /We sell confidence for small teams\./);
});

test('buildCompiledContextPack marks missing when approved memory is incomplete', () => {
  const pack = buildCompiledContextPack({
    twoWeek: null,
    threeDay: null,
    activePlans: [],
    recentPlans: [],
    memory: {
      revision: 1,
      companyBrief: { content: 'Only company brief exists.' },
      projectBrief: null,
      decisionLog: { entries: [] },
    },
    now: new Date('2026-04-10T00:00:00.000Z'),
  });

  assert.equal(pack.state, 'missing');
  assert.match(pack.reason, /required/i);
});

test('assertReviewerContextReady returns the compiled pack when memory revisions match', () => {
  const compiledPack = {
    state: 'fresh',
    compiledAt: '2026-04-10T00:00:00.000Z',
    memoryRevision: 4,
    markdown: 'x',
  };

  assert.equal(assertReviewerContextReady(compiledPack, { revision: 4 }), compiledPack);
});

test('assertReviewerContextReady fails closed when approved memory revision changes after sync', () => {
  assert.throws(() => {
    assertReviewerContextReady({
      state: 'fresh',
      compiledAt: '2026-04-10T12:00:00.000Z',
      memoryRevision: 2,
      markdown: 'x',
    }, { revision: 3, latestMemoryUpdatedAt: '2026-04-10T00:00:00.000Z' });
  }, /changed after the last sync/i);
});

test('assertReviewerContextReady fails closed when the compiled pack predates memory revisions', () => {
  assert.throws(() => {
    assertReviewerContextReady({
      state: 'fresh',
      compiledAt: '2026-04-11T00:00:00.000Z',
      markdown: 'x',
    }, { revision: 1 });
  }, /outdated/i);
});

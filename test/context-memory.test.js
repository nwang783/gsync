import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompiledContextPack, buildSyncContextContent, assertReviewerContextReady } from '../src/context.js';

test('buildCompiledContextPack produces fresh pack from the unified memory timeline', () => {
  const pack = buildCompiledContextPack({
    twoWeek: { content: 'Ship beta' },
    threeDay: { content: 'Close onboarding bugs' },
    activePlans: [],
    recentPlans: [],
    memory: {
      revision: 3,
      memories: [
        {
          title: 'Company North Star',
          content: 'We sell confidence for small teams.',
          createdAt: '2026-04-08T12:00:00.000Z',
          createdBy: 'agent-admin',
          tags: ['company'],
        },
        {
          title: 'Launch Decision',
          content: 'Keep the memory timeline append-only.',
          createdAt: '2026-04-09T12:00:00.000Z',
          createdBy: 'agent-peer',
        },
      ],
      latestMemory: {
        title: 'Launch Decision',
        createdAt: '2026-04-09T12:00:00.000Z',
        createdBy: 'agent-peer',
      },
    },
    now: new Date('2026-04-10T00:00:00.000Z'),
  });

  assert.equal(pack.state, 'fresh');
  assert.match(pack.markdown, /## Memories/);
  assert.match(pack.markdown, /Company North Star/);
  assert.match(pack.markdown, /Launch Decision/);
  assert.match(pack.markdown, /## Latest Memory/);
  assert.equal(pack.memoryRevision, 3);
});

test('buildSyncContextContent includes the unified memory timeline in the normal sync artifact', () => {
  const result = buildSyncContextContent({
    twoWeek: { content: 'Ship beta' },
    threeDay: { content: 'Close onboarding bugs' },
    activePlans: [],
    recentPlans: [],
    memory: {
      revision: 3,
      memories: [
        {
          title: 'Company North Star',
          content: 'We sell confidence for small teams.',
          createdAt: '2026-04-08T12:00:00.000Z',
          createdBy: 'agent-admin',
        },
      ],
      latestMemory: {
        title: 'Company North Star',
        createdAt: '2026-04-08T12:00:00.000Z',
        createdBy: 'agent-admin',
      },
    },
    now: new Date('2026-04-10T00:00:00.000Z'),
  });

  assert.equal(result.compiledPack.state, 'fresh');
  assert.match(result.contextContent, /## Memories/);
  assert.match(result.contextContent, /We sell confidence for small teams\./);
});

test('buildCompiledContextPack still compiles when memory is empty', () => {
  const pack = buildCompiledContextPack({
    twoWeek: null,
    threeDay: null,
    activePlans: [],
    recentPlans: [],
    memory: {
      revision: 0,
      memories: [],
      latestMemory: null,
    },
    now: new Date('2026-04-10T00:00:00.000Z'),
  });

  assert.equal(pack.state, 'fresh');
  assert.match(pack.markdown, /no memories yet/i);
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

test('assertReviewerContextReady fails closed when memory revision changes after sync', () => {
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

import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeMemoryEntries } from '../src/firestore.js';

test('mergeMemoryEntries keeps mixed legacy and new memories without duplicating exact clones', () => {
  const merged = mergeMemoryEntries(
    [
      {
        id: 'new-1',
        source: 'memories',
        title: 'Launch retrospective',
        content: 'We learned to keep the flow simple.',
        createdAt: '2026-04-04T14:00:00.000Z',
        createdBy: 'agent-admin',
      },
    ],
    [
      {
        id: 'legacy-1',
        source: 'legacy-companyBrief',
        title: 'Company brief',
        content: 'We sell confidence for small teams.',
        createdAt: '2026-04-02T10:00:00.000Z',
        createdBy: 'agent-peer',
      },
      {
        id: 'legacy-copy',
        source: 'legacy-memoryEntries',
        title: 'Launch retrospective',
        content: 'We learned to keep the flow simple.',
        createdAt: '2026-04-04T14:00:00.000Z',
        createdBy: 'agent-admin',
      },
    ],
  );

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((entry) => entry.title),
    ['Company brief', 'Launch retrospective'],
  );
  assert.equal(merged.find((entry) => entry.title === 'Launch retrospective')?.source, 'memories');
});

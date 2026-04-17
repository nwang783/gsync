import test from 'node:test';
import assert from 'node:assert/strict';

const modulePath = new URL('../functions/scripts/mark-merged-plans-from-pr.cjs', import.meta.url);
const { classifyPlanDocs, parseReferencedPlanIds, summarizeMergeCandidates } = await import(modulePath);

test('classifyPlanDocs separates review, merged, and skipped plans', () => {
  const docs = [
    {
      id: 'plan-review',
      ref: { path: 'teams/a/plans/plan-review' },
      data: () => ({ slug: 'review-plan', status: 'review' }),
    },
    {
      id: 'plan-merged',
      ref: { path: 'teams/a/plans/plan-merged' },
      data: () => ({ slug: 'merged-plan', status: 'merged' }),
    },
    {
      id: 'plan-draft',
      ref: { path: 'teams/a/plans/plan-draft' },
      data: () => ({ slug: 'draft-plan', status: 'draft' }),
    },
  ];

  const result = classifyPlanDocs(docs);

  assert.deepEqual(result.toMerge.map((plan) => plan.id), ['plan-review']);
  assert.deepEqual(result.alreadyMerged.map((plan) => plan.id), ['plan-merged']);
  assert.deepEqual(result.skipped.map((plan) => plan.id), ['plan-draft']);
});

test('classifyPlanDocs falls back to document ids when slug is missing', () => {
  const docs = [
    {
      id: 'plan-no-slug',
      ref: { path: 'teams/a/plans/plan-no-slug' },
      data: () => ({ status: 'review' }),
    },
  ];

  const result = classifyPlanDocs(docs);

  assert.equal(result.toMerge[0].slug, 'plan-no-slug');
  assert.equal(result.toMerge[0].status, 'review');
});

test('parseReferencedPlanIds finds plan ids in PR body context blocks', () => {
  const result = parseReferencedPlanIds(`
## Context
Plan: abc123

More details here.
Plan: xyz-789
`);

  assert.deepEqual(result, ['abc123', 'xyz-789']);
});

test('summarizeMergeCandidates counts mergeable and skipped records', () => {
  const result = summarizeMergeCandidates([
    { id: 'a', status: 'review' },
    { id: 'b', status: 'merged' },
    { id: 'c', status: 'draft' },
  ]);

  assert.deepEqual(result, {
    matched: 3,
    merged: 1,
    alreadyMerged: 1,
    skipped: 1,
    planIds: ['a'],
  });
});

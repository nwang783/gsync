import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidPlanStatusTransition, VALID_PLAN_STATUS_TRANSITIONS } from '../src/firestore.js';

test('proposed plans can move directly to review', () => {
  assert.equal(isValidPlanStatusTransition('proposed', 'review'), true);
});

test('draft plans can still move through the existing flow', () => {
  assert.equal(isValidPlanStatusTransition('draft', 'in-progress'), true);
  assert.equal(isValidPlanStatusTransition('draft', 'review'), true);
});

test('existing blocked transitions remain blocked', () => {
  assert.equal(isValidPlanStatusTransition('review', 'in-progress'), false);
  assert.equal(isValidPlanStatusTransition('merged', 'review'), false);
});

test('transition map keeps abandoned allowed from any current status', () => {
  for (const status of Object.keys(VALID_PLAN_STATUS_TRANSITIONS)) {
    assert.equal(isValidPlanStatusTransition(status, 'abandoned'), true);
  }
  assert.equal(isValidPlanStatusTransition('proposed', 'abandoned'), true);
});

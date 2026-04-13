import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidPlanStatus } from '../src/firestore.js';

test('accepts built-in statuses', () => {
  assert.equal(isValidPlanStatus('proposed'), true);
  assert.equal(isValidPlanStatus('review'), true);
  assert.equal(isValidPlanStatus('merged'), true);
});

test('accepts arbitrary agent-defined statuses', () => {
  assert.equal(isValidPlanStatus('blocked-on-design'), true);
  assert.equal(isValidPlanStatus('qa-ready'), true);
  assert.equal(isValidPlanStatus('waiting for human signoff'), true);
});

test('rejects empty or non-string statuses', () => {
  assert.equal(isValidPlanStatus(''), false);
  assert.equal(isValidPlanStatus('   '), false);
  assert.equal(isValidPlanStatus(null), false);
  assert.equal(isValidPlanStatus(undefined), false);
});

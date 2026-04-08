const test = require('node:test');
const assert = require('node:assert/strict');

const { generateJoinCode, sha256 } = require('../functions/join-codes');

test('generateJoinCode returns readable grouped codes', () => {
  const code = generateJoinCode();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test('sha256 is deterministic for join-code lookups', () => {
  assert.equal(sha256('ABCD-EFGH-JKLM'), sha256('ABCD-EFGH-JKLM'));
});

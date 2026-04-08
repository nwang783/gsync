import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const originalHome = process.env.HOME;
const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsync-config-test-'));
process.env.HOME = tempHome;

const configModule = await import('../src/config.js');

test.after(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tempHome, { recursive: true, force: true });
});

test('loadConfig falls back to hosted defaults when no config file exists', () => {
  const config = configModule.loadConfig();
  assert.equal(config.apiBaseUrl, 'https://nomergeconflicts.web.app/api');
  assert.equal(config.firebaseProjectId, 'nomergeconflicts');
  assert.equal(config.firebaseApiKey, 'demo-api-key');
  assert.equal(config.useEmulators, false);
});

test('saveConfig normalizes persisted config fields', () => {
  configModule.saveConfig({
    apiBaseUrl: 'https://example.com/api///',
    firebaseProjectId: 'custom-project',
    firebaseApiKey: 'custom-key',
  });

  const config = configModule.loadConfig();
  assert.equal(config.apiBaseUrl, 'https://example.com/api');
  assert.equal(config.firebaseProjectId, 'custom-project');
  assert.equal(config.firebaseApiKey, 'custom-key');
  assert.equal(config.useEmulators, false);
});

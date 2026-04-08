import fs from 'fs';
import path from 'path';
import os from 'os';

export const CONFIG_DIR = path.join(os.homedir(), '.gsync');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const SESSION_FILE = path.join(CONFIG_DIR, 'session.json');
export const CONTEXT_FILE = path.join(CONFIG_DIR, 'CONTEXT.md');
export const INDEX_FILE = path.join(CONFIG_DIR, 'index.json');
export const PLANS_DIR = path.join(CONFIG_DIR, 'plans');
export const SKILL_FILE = path.join(CONFIG_DIR, 'SKILL.md');

export function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }
  const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const config = JSON.parse(raw);
  return {
    apiBaseUrl: config.apiBaseUrl,
    firebaseProjectId: config.firebaseProjectId || config.projectId,
    firebaseApiKey: config.firebaseApiKey || config.apiKey,
    useEmulators: Boolean(config.useEmulators),
    firestoreHost: config.firestoreHost || '127.0.0.1:8080',
    authHost: config.authHost || '127.0.0.1:9099',
  };
}

export function saveConfig(config) {
  ensureDirs();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function loadSession() {
  if (!fs.existsSync(SESSION_FILE)) {
    return null;
  }
  const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
  return JSON.parse(raw);
}

export function saveSession(session) {
  ensureDirs();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2) + '\n', 'utf-8');
}

export function clearSession() {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
  }
}

export function ensureDirs() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.mkdirSync(PLANS_DIR, { recursive: true });
}

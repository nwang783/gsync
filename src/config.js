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

const DEFAULT_FIREBASE_PROJECT_ID = process.env.GSYNC_FIREBASE_PROJECT_ID || 'nomergeconflicts';
const DEFAULT_FIREBASE_API_KEY = process.env.GSYNC_FIREBASE_API_KEY || 'AIzaSyD3FJkbzXQiDZCDoDauqPUW07lszVpCVpU';
const DEFAULT_API_BASE_URL = (
  process.env.GSYNC_API_BASE_URL || `https://${DEFAULT_FIREBASE_PROJECT_ID}.web.app/api`
).replace(/\/+$/, '');

export function getDefaultConfig() {
  return {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    firebaseProjectId: DEFAULT_FIREBASE_PROJECT_ID,
    firebaseApiKey: DEFAULT_FIREBASE_API_KEY,
    useEmulators: false,
    firestoreHost: '127.0.0.1:8080',
    authHost: '127.0.0.1:9099',
  };
}

export function hasConfigFile() {
  return fs.existsSync(CONFIG_FILE);
}

function normalizeConfig(raw = {}) {
  const defaults = getDefaultConfig();
  return {
    apiBaseUrl: (raw.apiBaseUrl || defaults.apiBaseUrl).replace(/\/+$/, ''),
    firebaseProjectId: raw.firebaseProjectId || raw.projectId || defaults.firebaseProjectId,
    firebaseApiKey: raw.firebaseApiKey || raw.apiKey || defaults.firebaseApiKey,
    useEmulators: raw.useEmulators == null ? defaults.useEmulators : Boolean(raw.useEmulators),
    firestoreHost: raw.firestoreHost || defaults.firestoreHost,
    authHost: raw.authHost || defaults.authHost,
  };
}

export function loadConfig() {
  if (!hasConfigFile()) {
    return getDefaultConfig();
  }
  const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
  return normalizeConfig(JSON.parse(raw));
}

export function saveConfig(config) {
  ensureDirs();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(normalizeConfig(config), null, 2) + '\n', 'utf-8');
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

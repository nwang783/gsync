import fs from 'fs';
import path from 'path';
import os from 'os';

export const CONFIG_DIR = path.join(os.homedir(), '.gsync');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const CONTEXT_FILE = path.join(CONFIG_DIR, 'CONTEXT.md');
export const PLANS_DIR = path.join(CONFIG_DIR, 'plans');

export function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }
  const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const config = JSON.parse(raw);
  return {
    teamId: config.teamId,
    userName: config.userName,
    apiKey: config.apiKey,
    projectId: config.projectId,
  };
}

export function saveConfig(config) {
  ensureDirs();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function ensureDirs() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.mkdirSync(PLANS_DIR, { recursive: true });
}

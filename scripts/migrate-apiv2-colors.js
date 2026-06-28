#!/usr/bin/env node
/**
 * Replace raw hex in ApiV2 JSON with color tokens from colors.config.jsonc
 */

const fs = require('fs');
const path = require('path');

const APIV2_ROOT = path.join(__dirname, '../ApiV2');
const CONFIG_PATH = path.join(APIV2_ROOT, 'colors.config.jsonc');

const HEX_TO_TOKEN = {
  '#2d6a9f': 'chartPcVnPrimary',
  '#5b9bd5': 'chartPcVnSecondary',
  '#e67e22': 'chartPcNnPrimary',
  '#f0b27a': 'chartPcNnSecondary',
  '#e74c3c': 'chartPcNnLine',
  '#95a5a6': 'chartTargetLineMuted',
  '#d5dbdb': 'chartTargetBar',
  '#27ae60': 'chartTvPrimary',
  '#8e44ad': 'chartFleetAtr',
  '#1abc9c': 'chartLaborAls',
  '#1a3a5c': 'chartPositionTvc',
};

function loadConfigTokens() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const jsonOnly = raw.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const config = JSON.parse(jsonOnly);
  return Object.keys(config);
}

function walkJsonFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonFiles(full, files);
    else if (entry.name.endsWith('.json')) files.push(full);
  }
  return files;
}

function migrateFile(filePath, tokens) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [hex, token] of Object.entries(HEX_TO_TOKEN)) {
    const re = new RegExp(`"${hex.replace('#', '#')}"`, 'gi');
    if (re.test(content)) {
      content = content.replace(new RegExp(`"${hex}"`, 'gi'), `"${token}"`);
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(filePath, content);
  return changed;
}

const tokens = loadConfigTokens();
const files = walkJsonFiles(APIV2_ROOT).filter((f) => !f.endsWith('colors.config.jsonc'));
let count = 0;

for (const file of files) {
  if (migrateFile(file, tokens)) count++;
}

console.log(`Migrated ${count} files in ApiV2/`);

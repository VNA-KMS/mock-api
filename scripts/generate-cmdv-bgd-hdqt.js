#!/usr/bin/env node
/**
 * Generate ApiV2/CMDV/BGD and ApiV2/CMDV/HDQT from CQDV.
 * HDQT and BGD cannot see CPM-003, CPM-004, CPM-005; everything else matches CQDV.
 *
 * Usage:
 *   node scripts/generate-cmdv-bgd-hdqt.js
 *   node scripts/generate-cmdv-bgd-hdqt.js BGD
 *   node scripts/generate-cmdv-bgd-hdqt.js HDQT
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '../ApiV2/CMDV/CQDV');
const ORGS = (process.argv.slice(2).length ? process.argv.slice(2) : ['BGD', 'HDQT']).map((o) =>
  o.toUpperCase()
);

const HIDDEN_METRIC_CODES = new Set(['CPM_003', 'CPM_004', 'CPM_005']);
const HIDDEN_CODES = new Set(['CPM-003', 'CPM-004', 'CPM-005']);
const SKIP_DIR_PATTERN = /[/\\]board[/\\]tthh[/\\]CPM_00[345]([/\\]|$)/;

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 4)}\n`, 'utf8');
}

function replaceOrg(data, org) {
  const json = JSON.stringify(data).replace(/CMDV\/CQDV/g, `CMDV/${org}`);
  return JSON.parse(json);
}

function isHiddenKpiItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.metricCode && HIDDEN_METRIC_CODES.has(item.metricCode)) return true;
  if (item.code && HIDDEN_CODES.has(item.code)) return true;
  return false;
}

function filterKpis(kpis) {
  return kpis.filter((k) => !isHiddenKpiItem(k));
}

function computeOverviewFromKpis(kpis) {
  const total = kpis.length;
  const achieved = kpis.filter((k) => k.statusLabel?.keyVi === 'ĐẠT').length;
  const notAchieved = total - achieved;
  const progress = total > 0 ? Math.round((achieved / total) * 100) : 0;
  return { total, achieved, notAchieved, progress };
}

function buildOverviewMessage(stats, date, templateMessage) {
  const { total, achieved, notAchieved } = stats;
  if (notAchieved === 0) {
    return {
      keyVi: `Tất cả KPI đạt mục tiêu trong ${date}`,
      keyEn: `All KPIs achieved in ${date}.`,
    };
  }
  if (notAchieved === 1) {
    return {
      keyVi: `1 KPI không đạt mục tiêu trong ${date}`,
      keyEn: `1 KPI not achieved in ${date}.`,
    };
  }
  if (templateMessage?.keyVi && /\d+ KPI không đạt/.test(templateMessage.keyVi)) {
    return {
      keyVi: `${notAchieved} KPI không đạt mục tiêu trong ${date}`,
      keyEn: `${notAchieved} KPIs not achieved in ${date}.`,
    };
  }
  return templateMessage;
}

function patchOverview(data, kpis) {
  const stats = computeOverviewFromKpis(kpis);
  const summary = data.data?.[0]?.data;
  if (summary) {
    summary.progress.value = stats.progress;
    summary.statistics[0].value = stats.total;
    summary.statistics[1].value = stats.achieved;
    summary.statistics[2].value = stats.notAchieved;
  }
  data.message = buildOverviewMessage(stats, data.date, data.message);
  return data;
}

function patchPeriodIndex(data) {
  const entry = Array.isArray(data) ? data[0] : data;
  if (!entry) return data;

  if (entry.tthh?.count === 5) entry.tthh.count = 2;
  if (entry.all?.count === 26) entry.all.count = 23;

  return data;
}

function findPeriodDir(filePath) {
  let dir = path.dirname(filePath);
  while (dir.startsWith(SOURCE) && dir !== SOURCE) {
    if (fs.existsSync(path.join(dir, 'kpis/tthh/index.json'))) return dir;
    if (fs.existsSync(path.join(dir, 'kpis/index.json'))) return dir;
    dir = path.dirname(dir);
  }
  return path.dirname(filePath);
}

function getKpisForPeriod(periodDir) {
  const tthhPath = path.join(periodDir, 'kpis/tthh/index.json');
  if (fs.existsSync(tthhPath)) return filterKpis(readJson(tthhPath));
  const legacyPath = path.join(periodDir, 'kpis/index.json');
  if (fs.existsSync(legacyPath)) return filterKpis(readJson(legacyPath));
  return [];
}

function transformFile(relPath, data, org, srcPath) {
  let out = replaceOrg(data, org);

  if (relPath.endsWith('/kpis/tthh/index.json') || relPath.endsWith('/kpis/index.json')) {
    out = filterKpis(out);
    return out;
  }

  if (relPath.endsWith('/board/tthh/index.json') || relPath.endsWith('/board/index.json')) {
    return filterKpis(out);
  }

  if (relPath.endsWith('/overview/tthh/index.json') || relPath.endsWith('/overview/index.json')) {
    const periodDir = findPeriodDir(srcPath);
    const kpis = getKpisForPeriod(periodDir);
    if (kpis.length) out = patchOverview(out, kpis);
    return out;
  }

  if (relPath.endsWith('/index.json') && !relPath.includes('/board/') && !relPath.includes('/overview/')) {
    return patchPeriodIndex(out);
  }

  return out;
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (SKIP_DIR_PATTERN.test(`${rel}/`)) continue;
      out.push(...listFiles(full, base));
    } else if (entry.name.endsWith('.json')) {
      if (SKIP_DIR_PATTERN.test(rel)) continue;
      out.push(rel);
    }
  }
  return out;
}

function generateOrg(org) {
  const target = path.join(__dirname, '../ApiV2/CMDV', org);
  const files = listFiles(SOURCE);

  console.log(`Generating ${org} from CQDV (${files.length} files)...`);

  for (const rel of files) {
    const srcPath = path.join(SOURCE, rel);
    const tgtPath = path.join(target, rel);
    const data = readJson(srcPath);
    const transformed = transformFile(rel, data, org, srcPath);
    writeJson(tgtPath, transformed);
  }

  console.log(`  Done: ApiV2/CMDV/${org}`);
  for (const division of ['BSV', 'KHPT', 'TTBSP']) {
    fs.mkdirSync(path.join(target, division), { recursive: true });
  }
}

for (const org of ORGS) {
  generateOrg(org);
}

console.log('Done.');

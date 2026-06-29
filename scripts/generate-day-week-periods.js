#!/usr/bin/env node
/**
 * Generate W/ and D/ period folders for CQDV, BGD, and HDQT.
 * W/W_1..W_54, D/D_1..D_31 — data interpolated from M_1..M_12 so every period differs.
 *
 * Files updated with period-specific values:
 *   kpis/all/index.json
 *   kpis/fight-time/index.json  (CQDV, BGD only)
 *   board/all/chart/index0.json
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TCNL_ROOT = path.join(__dirname, '../ApiV2/TCNL');
const ORGS = ['CQDV', 'BGD', 'HDQT'];

// ─── helpers ────────────────────────────────────────────────────────────────

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 4) + '\n');
}

function round(v, ref) {
  // Match decimal precision of the reference value
  const decimals = String(ref).includes('.') ? String(ref).split('.')[1].length : 0;
  return parseFloat(v.toFixed(decimals));
}

function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * Build a smooth series of N values by interpolating across 12 monthly points.
 * Adds a small sine-wave ripple so adjacent periods look slightly different.
 */
function buildSeries(monthlyActuals, totalPeriods) {
  const n = totalPeriods;
  const m = monthlyActuals.length; // 12
  return Array.from({ length: n }, (_, i) => {
    const floatIdx = i * (m - 1) / (n - 1);
    const i0 = Math.floor(floatIdx);
    const i1 = Math.min(m - 1, i0 + 1);
    const t = floatIdx - i0;
    const base = lerp(monthlyActuals[i0], monthlyActuals[i1], t);
    // subtle ripple: ±1.5% amplitude, 3 full cycles across the year
    const amplitude = Math.abs(base) * 0.015;
    return base + amplitude * Math.sin((i / (n - 1)) * Math.PI * 6);
  });
}

/**
 * Determine if higher actual is better for this KPI item.
 * Detection: if M_12 variant=success AND actual < target → lower is better.
 */
function isHigherBetter(m12Item) {
  return !(m12Item.variant === 'success' && m12Item.actual < m12Item.target);
}

function computeVariant(actual, target, higherBetter) {
  if (higherBetter) {
    if (actual >= target) return 'success';
    if (actual >= target * 0.9) return 'warning';
    return 'danger';
  } else {
    if (actual <= target) return 'success';
    if (actual <= target * 1.1) return 'warning';
    return 'danger';
  }
}

function computeProgress(actual, target, higherBetter) {
  const ratio = higherBetter ? actual / target : target / actual;
  return Math.min(100, Math.round(ratio * 100));
}

// ─── series builders ────────────────────────────────────────────────────────

/**
 * Reads actuals for all 12 months for a given kpi file path relative to org root.
 * Returns array of arrays: [month0_actuals, month1_actuals, ...]
 */
function readMonthlyKpiActuals(orgRoot, relPath) {
  return Array.from({ length: 12 }, (_, m) => {
    const p = path.join(orgRoot, 'M', `M_${m + 1}`, relPath);
    if (!fs.existsSync(p)) return null;
    return readJson(p).map(item => item.actual);
  });
}

/**
 * Build per-period series for each KPI item in a file.
 * Returns: [ [period0val, period1val, ...], [period0val, ...], ... ]  one array per kpi item
 */
function buildKpiSeries(monthlyActualsMatrix, totalPeriods) {
  const numKpis = monthlyActualsMatrix[0].length;
  return Array.from({ length: numKpis }, (_, kpiIdx) => {
    const monthlyActuals = monthlyActualsMatrix.map(m => m[kpiIdx]);
    return buildSeries(monthlyActuals, totalPeriods);
  });
}

// ─── file patchers ──────────────────────────────────────────────────────────

function patchKpisFile(filePath, kpiSeries, periodIdx, m12Items) {
  if (!fs.existsSync(filePath)) return;
  const template = readJson(filePath);
  const updated = template.map((item, i) => {
    const series = kpiSeries[i];
    const actual = round(series[periodIdx], m12Items[i].actual);
    const prevActual = periodIdx > 0 ? round(series[periodIdx - 1], m12Items[i].actual) : actual;
    const target = item.target;
    const hb = isHigherBetter(m12Items[i]);
    const variant = computeVariant(actual, target, hb);
    const trendDir = actual > prevActual ? 'up' : actual < prevActual ? 'down' : 'flat';
    return {
      ...item,
      actual,
      trendValue: round(Math.abs(actual - prevActual), m12Items[i].actual),
      trendDirection: trendDir,
      variant,
      statusLabel: variant === 'success'
        ? { keyVi: 'ĐẠT', keyEn: 'ACHIEVED' }
        : { keyVi: 'KHÔNG ĐẠT', keyEn: 'NOT ACHIEVED' },
      progress: computeProgress(actual, target, hb),
    };
  });
  writeJson(filePath, updated);
}

function patchChartIndex0(filePath, kpiSeries, periodIdx, periodType) {
  if (!fs.existsSync(filePath)) return;
  const chart = readJson(filePath);
  if (!chart.data || !chart.data[0] || !Array.isArray(chart.data[0].name)) return;

  const windowSize = chart.data[0].name.length; // typically 12
  const seriesVals = kpiSeries[0]; // use first kpi series for the main chart
  const start = Math.max(0, periodIdx - windowSize + 1);
  const window = [];
  for (let i = start; i <= periodIdx; i++) window.push(seriesVals[i]);
  while (window.length < windowSize) window.unshift(seriesVals[Math.max(0, start - 1)]);

  // Round to match existing precision
  const rounded = window.map(v => round(v, chart.data[0].name[0]));
  chart.data[0].name = rounded;

  // Update labels — clamp to 1
  const labelStart = periodIdx - window.length + 1;
  if (periodType === 'W') {
    chart.labels = Array.from({ length: windowSize }, (_, i) => {
      const wn = Math.max(1, labelStart + i + 1);
      return `W${wn}/26`;
    });
  } else {
    chart.labels = Array.from({ length: windowSize }, (_, i) => {
      const dn = Math.max(1, labelStart + i + 1);
      return `D${dn}/06`;
    });
  }

  writeJson(filePath, chart);
}

// ─── main copy + patch ──────────────────────────────────────────────────────

function copyPeriod(org, templateDir, folder, key, periodIdx, patchCtx) {
  const orgRoot = path.join(TCNL_ROOT, org);
  const dstRoot = path.join(orgRoot, folder, key);
  const needle = `TCNL/${org}/M/M_12`;
  const replacement = `TCNL/${org}/${folder}/${key}`;

  function walk(relDir) {
    const absSrc = path.join(templateDir, relDir);
    if (!fs.existsSync(absSrc)) return;
    for (const entry of fs.readdirSync(absSrc, { withFileTypes: true })) {
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const srcPath = path.join(absSrc, entry.name);
      const dstPath = path.join(dstRoot, relPath);
      if (entry.isDirectory()) { walk(relPath); continue; }
      const raw = fs.readFileSync(srcPath, 'utf8');
      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      fs.writeFileSync(dstPath, raw.split(needle).join(replacement));
    }
  }
  walk('');

  // Patch kpis/all
  const periodType = folder; // 'W' or 'D'
  patchKpisFile(
    path.join(dstRoot, 'kpis/all/index.json'),
    patchCtx.kpiAllSeries,
    periodIdx,
    patchCtx.m12KpiAll,
  );

  // Patch kpis/fight-time (CQDV, BGD)
  if (patchCtx.kpiFightSeries) {
    patchKpisFile(
      path.join(dstRoot, 'kpis/fight-time/index.json'),
      patchCtx.kpiFightSeries,
      periodIdx,
      patchCtx.m12KpiFight,
    );
  }

  // Patch board/all/chart/index0
  patchChartIndex0(
    path.join(dstRoot, 'board/all/chart/index0.json'),
    patchCtx.kpiAllSeries,
    periodIdx,
    periodType,
  );
}

// ─── entry point ────────────────────────────────────────────────────────────

for (const org of ORGS) {
  const orgRoot = path.join(TCNL_ROOT, org);
  const templateDir = path.join(orgRoot, 'M/M_12');
  if (!fs.existsSync(templateDir)) {
    console.warn(`[SKIP] ${org} — no M/M_12 template`);
    continue;
  }

  // Read M_12 items as reference for variant logic and precision
  const m12KpiAll = readJson(path.join(orgRoot, 'M/M_12/kpis/all/index.json'));
  const m12KpiFightPath = path.join(orgRoot, 'M/M_12/kpis/fight-time/index.json');
  const m12KpiFight = fs.existsSync(m12KpiFightPath) ? readJson(m12KpiFightPath) : null;

  // Read all 12 months
  const monthlyKpiAll = readMonthlyKpiActuals(orgRoot, 'kpis/all/index.json');
  const monthlyKpiFight = m12KpiFight
    ? readMonthlyKpiActuals(orgRoot, 'kpis/fight-time/index.json')
    : null;

  const WEEKS = 54;
  const DAYS = 31;

  // Build interpolated series
  const kpiAllSeriesW = buildKpiSeries(monthlyKpiAll, WEEKS);
  const kpiAllSeriesD = buildKpiSeries(monthlyKpiAll, DAYS);
  const kpiFightSeriesW = monthlyKpiFight ? buildKpiSeries(monthlyKpiFight, WEEKS) : null;
  const kpiFightSeriesD = monthlyKpiFight ? buildKpiSeries(monthlyKpiFight, DAYS) : null;

  console.log(`Generating ${org}...`);

  for (let w = 1; w <= WEEKS; w++) {
    copyPeriod(org, templateDir, 'W', `W_${w}`, w - 1, {
      kpiAllSeries: kpiAllSeriesW,
      kpiFightSeries: kpiFightSeriesW,
      m12KpiAll,
      m12KpiFight,
    });
  }
  console.log(`  W/W_1..W_${WEEKS} done`);

  for (let d = 1; d <= DAYS; d++) {
    copyPeriod(org, templateDir, 'D', `D_${d}`, d - 1, {
      kpiAllSeries: kpiAllSeriesD,
      kpiFightSeries: kpiFightSeriesD,
      m12KpiAll,
      m12KpiFight,
    });
  }
  console.log(`  D/D_1..D_${DAYS} done`);
}

console.log('All done.');

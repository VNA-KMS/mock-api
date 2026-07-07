#!/usr/bin/env node
/**
 * Generate D/D_1..D_31 for ApiV2/demoV2/BGD/commercial-services/development-plan/D
 * from the D_7 template. Each day gets unique values (charts + kpis + overview).
 *
 * Rules enforced:
 *   - 6 KPIs in kpis/all and kpis/network, same codes/names
 *   - overview counts (ĐẠT / KHÔNG ĐẠT) derived from kpis statuses
 *   - comparisons: INT always status=3, DOM always status=4
 *   - vs CK / vs KH: status=1 when value positive, 0 when negative
 *   - chart labels: 1..31; colors: blue for days <= d, gray dashed for days > d
 *
 * Skips D_7 to preserve the manually edited template.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../ApiV2/demoV2/BGD/commercial-services/development-plan/D');
const TEMPLATE = path.join(ROOT, 'D_7');
const DAYS = 31;
const SKIP = new Set([7]);

const CHART_FILES = ['index0', 'index1', 'index2', 'index3', 'index4', 'index5'];

// ─── io ──────────────────────────────────────────────────────────────────────

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 4) + '\n');
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(v, ref) {
  const s = String(ref);
  const decimals = s.includes('.') ? s.split('.')[1].length : 0;
  return parseFloat(v.toFixed(decimals));
}

function fmtPct(value) {
  const sign = value >= 0 ? '+' : '-';
  const abs = Math.abs(value).toFixed(1);
  return `${sign}${abs.replace('.', ',')}%`;
}

// ─── chart generation ────────────────────────────────────────────────────────

function genSeries(seed, minVal, maxVal, refVal) {
  const rng = mulberry32(seed);
  const amp1 = (maxVal - minVal) * 0.32;
  const amp2 = (maxVal - minVal) * 0.10;
  const base = (minVal + maxVal) / 2;
  const out = [];
  for (let i = 0; i < DAYS; i++) {
    const x = i / (DAYS - 1);
    const w1 = Math.sin(x * Math.PI * 2.4) * amp1;
    const w2 = Math.sin(x * Math.PI * 5.0 + seed) * amp2;
    const noise = (rng() - 0.5) * amp2 * 0.6;
    out.push(round(base + w1 + w2 + noise, refVal));
  }
  return out;
}

function buildChart(templateChart, day, seedBase) {
  const chart = JSON.parse(JSON.stringify(templateChart));
  const ref = templateChart.data[0].name[0];
  const minVal = templateChart.config.minValue + 5;
  const maxVal = templateChart.config.maxValue - 5;

  chart.labels = Array.from({ length: DAYS }, (_, i) => String(i + 1));
  chart.data[0].name = genSeries(seedBase, minVal, maxVal, ref);
  // "Cùng kỳ" slightly lower, different seed
  chart.data[1].name = genSeries(seedBase * 7 + 13, minVal * 0.92, maxVal * 0.94, ref);

  const colors = [];
  const dashes = [];
  for (let i = 1; i <= DAYS; i++) {
    const isActual = i <= day;
    colors.push(isActual ? '#2d6a9f' : '#95a5a6');
    dashes.push(isActual ? null : [6, 3]);
  }
  chart.data[0].color = colors;
  chart.data[0].borderDash = dashes;
  return chart;
}

// ─── kpi generation ──────────────────────────────────────────────────────────

function genKpi(templateKpi, day, kpiIdx) {
  const rng = mulberry32(day * 1009 + kpiIdx * 31 + 7);
  const kpi = JSON.parse(JSON.stringify(templateKpi));

  const refAfter = parseFloat(templateKpi.change.after);
  const drift = 0.78 + rng() * 0.45;          // 0.78 .. 1.23
  const after = round(refAfter * drift, refAfter);
  const beforeRatio = 0.82 + rng() * 0.18;    // 0.82 .. 1.00
  const before = round(after * beforeRatio, refAfter);
  kpi.change = { before: String(before), after: String(after) };

  // vs CK: bias towards positive (70%)
  const vsCk = (rng() < 0.7 ? 1 : -1) * (1 + rng() * 14);
  kpi.comparisons[0].value = fmtPct(vsCk);
  kpi.comparisons[0].status = vsCk >= 0 ? 1 : 0;

  // vs KH: similar bias
  const vsKh = (rng() < 0.6 ? 1 : -1) * (0.5 + rng() * 11);
  kpi.comparisons[1].value = fmtPct(vsKh);
  kpi.comparisons[1].status = vsKh >= 0 ? 1 : 0;

  // INT / DOM scale by kpi range
  const baseInt = parseInt(templateKpi.comparisons[2].value, 10) || 200;
  const baseDom = parseInt(templateKpi.comparisons[3].value, 10) || 50;
  const intScale = 0.7 + rng() * 0.6;
  const domScale = 0.6 + rng() * 0.8;
  kpi.comparisons[2].value = String(Math.max(20, Math.round(baseInt * intScale)));
  kpi.comparisons[3].value = String(Math.max(10, Math.round(baseDom * domScale)));
  kpi.comparisons[2].status = 3; // INT
  kpi.comparisons[3].status = 4; // DOM

  // Overall status: achieved only when both vs CK and vs KH are positive
  kpi.status = (kpi.comparisons[0].status === 1 && kpi.comparisons[1].status === 1) ? 1 : 0;

  return kpi;
}

function genKpis(templateKpis, day) {
  return templateKpis.map((k, i) => genKpi(k, day, i));
}

function genOverview(kpis) {
  const total = kpis.length;
  const dat = kpis.filter(k => k.status === 1).length;
  const khongDat = total - dat;
  const percent = total > 0 ? Math.round((dat / total) * 10000) / 100 : 0;
  return {
    title: 'TỔNG KPIS',
    percent,
    data: [
      { label: 'CHỈ TIÊU', value: String(total), status: 2 },
      { label: 'ĐẠT', value: String(dat), status: 1 },
      { label: 'KHÔNG ĐẠT', value: String(khongDat), status: 0 },
    ],
  };
}

// ─── board/all URL rewrite ───────────────────────────────────────────────────

function updateBoardAll(templateBoard, day) {
  const walk = (v) => {
    if (typeof v === 'string') return v.replace(/D\/D_7/g, `D/D_${day}`);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out = {};
      for (const k in v) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };
  return walk(templateBoard);
}

// ─── main ────────────────────────────────────────────────────────────────────

const tplBoardAll = readJson(path.join(TEMPLATE, 'board/all/index.json'));
const tplCharts = CHART_FILES.map(f => readJson(path.join(TEMPLATE, `board/all/chart/${f}.json`)));
const tplKpisAll = readJson(path.join(TEMPLATE, 'kpis/all/index.json'));
const tplKpisNetwork = readJson(path.join(TEMPLATE, 'kpis/network/index.json'));

for (let d = 1; d <= DAYS; d++) {
  if (SKIP.has(d)) {
    console.log(`[SKIP] D_${d} (template)`);
    continue;
  }
  const target = path.join(ROOT, `D_${d}`);

  for (let i = 0; i < CHART_FILES.length; i++) {
    const chart = buildChart(tplCharts[i], d, d * 1000 + i);
    writeJson(path.join(target, `board/all/chart/${CHART_FILES[i]}.json`), chart);
  }

  writeJson(path.join(target, 'board/all/index.json'), updateBoardAll(tplBoardAll, d));

  const kpisAll = genKpis(tplKpisAll, d);
  const kpisNetwork = genKpis(tplKpisNetwork, d);
  writeJson(path.join(target, 'kpis/all/index.json'), kpisAll);
  writeJson(path.join(target, 'kpis/network/index.json'), kpisNetwork);
  writeJson(path.join(target, 'overview/index.json'), genOverview(kpisAll));

  console.log(`[GEN]  D_${d} done (${kpisAll.filter(k => k.status === 1).length}/${kpisAll.length} đạt)`);
}

console.log('All done.');

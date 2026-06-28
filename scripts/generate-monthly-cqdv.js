#!/usr/bin/env node
/**
 * Generate M_1 .. M_12 from M_12 template.
 * KPI actual/trend/progress derived from 12-month chart series.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../ApiV2/TCNL/CQDV/M');
const BASE = 'https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main/ApiV2/TCNL/CQDV/M';

// Source series from M_12 line charts (T1..T12)
const PCVN = [62, 68, 72, 72, 74, 76, 78, 77, 76, 74, 72, 71.7];
const PCNN = [65, 70, 73, 75, 76, 78, 79, 78, 77, 75, 73, 74.5];
const PC_TARGET_LINE = 70;
const TV = [70, 74, 78, 78, 79, 80, 81, 80, 79, 78, 76, 74];
const TV_TARGET_LINE = 75;
const KPI_TARGET = 75;

// April (T4) bar chart baselines from M_12
const INDEX1_PCVN = [89, 87, 93, 93, 65, 49, 58, 58];
const INDEX1_PCNN = [86, 65, 89, 74, 61, 51, 61, null];
const INDEX1_TARGET = [85, 85, 85, 85, 70, 70, 55, 55];
const INDEX2_TH = [76.2, 68.5, 77.8, 64.5];
const INDEX2_TARGET = [68, 68, 68, 68];
const INDEX5_VN = [70.8, 76.7, 81.7, 78.1];
const INDEX5_ALS = [68.5, 75.7, 79, 78.1];
const INDEX5_NN = [null, 71.1, 71.9, 64.6];
const INDEX5_TARGET = [75, 75, 75, 75];
const INDEX6_TH = [76.5, 78, 68.4];
const INDEX6_TARGET = [75, 75, 75];

const INDEX3_BASE = {
  B787: [78, 82, 85, 84],
  A350: [75, 80, 86, 89],
  A321: [50, 54, 56, 55],
  ATR: [42, 48, 52, 56],
};

const INDEX7_BASE = {
  'TVT-B2': [58, 62, 66, 70],
  'TVT-B1': [68, 72, 74, 76],
  TVC: [72, 76, 80, 82],
  TVY: [70, 74, 78, 78],
};

const APRIL_PC_AVG = (PCVN[3] + PCNN[3]) / 2;
const APRIL_TV = TV[3];

function round1(n) {
  return Math.round(n * 10) / 10;
}

function pcAvg(monthIdx) {
  return round1((PCVN[monthIdx] + PCNN[monthIdx]) / 2);
}

function scaleArray(values, factor, nullable = false) {
  return values.map((v) => {
    if (v === null) return null;
    return Math.round(v * factor);
  });
}

function scaleArray1dp(values, factor, nullable = false) {
  return values.map((v) => {
    if (v === null) return null;
    return round1(v * factor);
  });
}

function kpiMetrics(monthIdx) {
  const pcActual = pcAvg(monthIdx);
  const tvActual = round1(TV[monthIdx]);
  const prevIdx = monthIdx - 1;
  const pcPrev = prevIdx >= 0 ? pcAvg(prevIdx) : pcActual;
  const tvPrev = prevIdx >= 0 ? round1(TV[prevIdx]) : tvActual;

  function build(actual, prev) {
    const diff = round1(Math.abs(actual - prev));
    let trendDirection = 'flat';
    if (monthIdx > 0) {
      if (actual > prev) trendDirection = 'up';
      else if (actual < prev) trendDirection = 'down';
    }
    const achieved = actual >= KPI_TARGET * 0.9;
    const progress = achieved ? 100 : Math.min(99, Math.round((actual / KPI_TARGET) * 100));
    return {
      actual,
      target: KPI_TARGET,
      trendValue: monthIdx === 0 ? 0 : diff,
      trendDirection,
      variant: achieved ? 'success' : actual >= KPI_TARGET * 0.8 ? 'warning' : 'danger',
      statusLabel: achieved
        ? { keyVi: 'ĐẠT', keyEn: 'ACHIEVED' }
        : { keyVi: 'KHÔNG ĐẠT', keyEn: 'NOT ACHIEVED' },
      progress,
    };
  }

  return { pc: build(pcActual, pcPrev), tv: build(tvActual, tvPrev) };
}

function monthLabels(monthIdx, count = 4) {
  const start = Math.max(0, monthIdx - count + 1);
  const labels = [];
  for (let i = start; i <= monthIdx; i++) {
    labels.push(`T${i + 1}/25`);
  }
  while (labels.length < count) {
    labels.unshift(`T${monthIdx - labels.length + 2}/25`);
  }
  return labels.slice(-count);
}

function heatmapValues(monthIdx, baseSeries, fullSeries) {
  const labels = monthLabels(monthIdx, 4);
  const startMonth = monthIdx - 3;
  return labels.map((_, i) => {
    const idx = startMonth + i;
    if (idx < 0 || idx >= fullSeries.length) return baseSeries[Math.max(0, i + startMonth)] ?? baseSeries[0];
    const ratio = fullSeries[idx] / (fullSeries[3] || fullSeries[idx] || 1);
    const baseIdx = Math.min(i, baseSeries.length - 1);
    return Math.round(baseSeries[baseIdx] * ratio);
  });
}

function heatmapPositionValues(monthIdx, baseSeries) {
  const labels = monthLabels(monthIdx, 4);
  const startMonth = monthIdx - 3;
  return labels.map((_, i) => {
    const idx = startMonth + i;
    const tvAt = idx >= 0 && idx < TV.length ? TV[idx] : TV[0];
    const ratio = tvAt / APRIL_TV;
    const baseIdx = Math.min(i, baseSeries.length - 1);
    return Math.round(baseSeries[baseIdx] * ratio);
  });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 4) + '\n');
}

function buildKpis(month) {
  const m = kpiMetrics(month - 1);
  const template = readJson(path.join(ROOT, 'M_12/kpis/fight-time/index.json'));

  template[0].actual = m.pc.actual;
  template[0].target = m.pc.target;
  template[0].trendValue = m.pc.trendValue;
  template[0].trendDirection = m.pc.trendDirection;
  template[0].variant = m.pc.variant;
  template[0].statusLabel = m.pc.statusLabel;
  template[0].progress = m.pc.progress;

  template[1].actual = m.tv.actual;
  template[1].target = m.tv.target;
  template[1].trendValue = m.tv.trendValue;
  template[1].trendDirection = m.tv.trendDirection;
  template[1].variant = m.tv.variant;
  template[1].statusLabel = m.tv.statusLabel;
  template[1].progress = m.tv.progress;

  return template;
}

function buildBoardIndex(month) {
  const template = readJson(path.join(ROOT, 'M_12/board/index.json'));
  const folder = `M_${month}`;
  const monthLabel = `${month}T/2026`;
  const monthVi = `Tháng ${month}/2025`;

  function patch(node) {
    if (Array.isArray(node)) return node.map(patch);
    if (node && typeof node === 'object') {
      const out = { ...node };
      if (typeof out.child === 'string' && out.child.includes('/board/chart/flight-time/')) {
        out.child = out.child.replace(/M_M_\d+|M_\d+/, folder);
      }
      if (out.subTitle?.keyVi) {
        out.subTitle.keyVi = out.subTitle.keyVi
          .replace(/T\d+\/2026/g, `T${String(month).padStart(2, '0')}/2026`)
          .replace(/\(T\d+\/2026\)/g, `(T${String(month).padStart(2, '0')}/2026)`)
          .replace(/Tháng \d+\/2025/g, monthVi)
          .replace(/\(\d+T\/2026\)/g, `(${monthLabel})`);
      }
      if (out.subTitle?.keyEn) {
        out.subTitle.keyEn = out.subTitle.keyEn
          .replace(/\(T\d+\/2026\)/g, `(T${String(month).padStart(2, '0')}/2026)`)
          .replace(/April 2025/g, `Month ${month}/2025`)
          .replace(/\(\d+T\/2026\)/g, `(${monthLabel})`);
      }
      if (out.child && typeof out.child !== 'string') out.child = patch(out.child);
      if (out.child && Array.isArray(out.child)) out.child = patch(out.child);
      return out;
    }
    return node;
  }

  const board = patch(template);
  // Ensure all chart URLs point to this month
  const json = JSON.stringify(board);
  const fixed = json.replace(
    /M_\d+\/board\/chart\/flight-time/g,
    `${folder}/board/chart/flight-time`
  );
  return JSON.parse(fixed);
}

function buildCharts(month) {
  const idx = month - 1;
  const pcFactor = pcAvg(idx) / APRIL_PC_AVG;
  const tvFactor = TV[idx] / APRIL_TV;
  const monthPadded = String(month).padStart(2, '0');
  const monthVi = `Tháng ${month}/2025`;
  const monthEn = `Month ${month}/2025`;
  const monthLabel = `${month}T/2026`;

  const charts = {};

  // index0, index4: 12-month trends — same series, ensure T12 matches KPI inputs
  charts['index0.json'] = readJson(path.join(ROOT, 'M_12/board/chart/flight-time/index0.json'));
  charts['index4.json'] = readJson(path.join(ROOT, 'M_12/board/chart/flight-time/index4.json'));

  // index1 — PC by team
  const i1 = readJson(path.join(ROOT, 'M_12/board/chart/flight-time/index1.json'));
  i1.subTitle.keyVi = `So sánh giờ bay BQ giữa các đội bay (T${monthPadded}/2026)`;
  i1.subTitle.keyEn = `Compare flight time BQ between flight teams (T${monthPadded}/2026)`;
  i1.data[0].key.keyVi = `PCVN T${monthPadded}/2026 (${monthVi})`;
  i1.data[0].key.keyEn = `PCVN T${monthPadded}/2026 (${monthEn})`;
  i1.data[0].name = scaleArray(INDEX1_PCVN, pcFactor);
  i1.data[1].key.keyVi = `PCNN T${monthPadded}/2026 (${monthVi})`;
  i1.data[1].key.keyEn = `PCNN T${monthPadded}/2026 (${monthEn})`;
  i1.data[1].name = scaleArray(INDEX1_PCNN, pcFactor, true);
  i1.data[2].key.keyVi = `Giờ mức (${monthVi})`;
  i1.data[2].key.keyEn = `Target (${monthEn})`;
  i1.data[2].name = scaleArray(INDEX1_TARGET, pcFactor);
  charts['index1.json'] = i1;

  // index2 — VN vs NN
  const i2 = readJson(path.join(ROOT, 'M_12/board/chart/flight-time/index2.json'));
  i2.data[0].key.keyVi = `TH ${monthLabel} (${monthVi})`;
  i2.data[0].key.keyEn = `TH ${monthLabel} (${monthEn})`;
  i2.data[0].name = scaleArray1dp(INDEX2_TH, pcFactor);
  i2.data[1].key.keyVi = `Giờ mức (${monthVi})`;
  i2.data[1].key.keyEn = `Target (${monthEn})`;
  i2.data[1].name = scaleArray(INDEX2_TARGET, pcFactor);
  charts['index2.json'] = i2;

  // index3 — heatmap team x month (last 4 months ending at current)
  const i3 = readJson(path.join(ROOT, 'M_12/board/chart/flight-time/index3.json'));
  i3.labels = monthLabels(idx, 4);
  i3.data[0].key.keyVi = `B787 (${monthVi})`;
  i3.data[0].key.keyEn = `B787 (${monthEn})`;
  i3.data[0].name = heatmapValues(idx, INDEX3_BASE.B787, PCVN);
  i3.data[1].key.keyVi = `A350 (${monthVi})`;
  i3.data[1].key.keyEn = `A350 (${monthEn})`;
  i3.data[1].name = heatmapValues(idx, INDEX3_BASE.A350, PCVN);
  i3.data[2].key.keyVi = `A321 (${monthVi})`;
  i3.data[2].key.keyEn = `A321 (${monthEn})`;
  i3.data[2].name = heatmapValues(idx, INDEX3_BASE.A321, PCVN);
  i3.data[3].key.keyVi = `ATR (${monthVi})`;
  i3.data[3].key.keyEn = `ATR (${monthEn})`;
  i3.data[3].name = heatmapValues(idx, INDEX3_BASE.ATR, PCVN);
  charts['index3.json'] = i3;

  // index5 — TV by position
  const i5 = readJson(path.join(ROOT, 'M_12/board/chart/flight-time/index5.json'));
  i5.data[0].key = `VN (${monthVi})`;
  i5.data[0].name = scaleArray1dp(INDEX5_VN, tvFactor);
  i5.data[1].key = `ALS (${monthVi})`;
  i5.data[1].name = scaleArray1dp(INDEX5_ALS, tvFactor);
  i5.data[2].key = `NN (${monthVi})`;
  i5.data[2].name = scaleArray1dp(INDEX5_NN, tvFactor, true);
  i5.data[3].key = `Giờ mức (${monthVi})`;
  i5.data[3].name = INDEX5_TARGET;
  charts['index5.json'] = i5;

  // index6 — VN vs ALS vs NN
  const i6 = readJson(path.join(ROOT, 'M_12/board/chart/flight-time/index6.json'));
  i6.title.keyVi = `VN vs ALS vs NN (${monthLabel})`;
  i6.title.keyEn = `VN vs ALS vs NN (${monthLabel})`;
  i6.data[0].key.keyVi = `TH ${monthLabel} (${monthVi})`;
  i6.data[0].key.keyEn = `TH ${monthLabel} (${monthEn})`;
  i6.data[0].name = scaleArray1dp(INDEX6_TH, tvFactor);
  i6.data[1].key.keyVi = `Giờ mức (${monthVi})`;
  i6.data[1].key.keyEn = `Target (${monthEn})`;
  i6.data[1].name = INDEX6_TARGET;
  charts['index6.json'] = i6;

  // index7 — heatmap position x month
  const i7 = readJson(path.join(ROOT, 'M_12/board/chart/flight-time/index7.json'));
  i7.labels = monthLabels(idx, 4);
  const posKeys = ['TVT-B2', 'TVT-B1', 'TVC', 'TVY'];
  posKeys.forEach((pos, pi) => {
    i7.data[pi].key.keyVi = `${pos} (${monthVi})`;
    i7.data[pi].key.keyEn = `${pos} (${monthEn})`;
    i7.data[pi].name = heatmapPositionValues(idx, INDEX7_BASE[pos]);
  });
  charts['index7.json'] = i7;

  return charts;
}

function generateMonth(month) {
  const folder = `M_${month}`;
  const monthDir = path.join(ROOT, folder);

  // overview — unchanged copy from M_12
  const overview = readJson(path.join(ROOT, 'M_12/overview/index.json'));
  writeJson(path.join(monthDir, 'overview/index.json'), overview);

  writeJson(path.join(monthDir, 'kpis/fight-time/index.json'), buildKpis(month));
  writeJson(path.join(monthDir, 'board/index.json'), buildBoardIndex(month));

  const charts = buildCharts(month);
  for (const [file, data] of Object.entries(charts)) {
    writeJson(path.join(monthDir, 'board/chart/flight-time', file), data);
  }

  const m = kpiMetrics(month - 1);
  console.log(
    `M_${month}: PC actual=${m.pc.actual} trend=${m.pc.trendDirection} ${m.pc.trendValue} | TV actual=${m.tv.actual} trend=${m.tv.trendDirection} ${m.tv.trendValue}`
  );
}

// Generate M_11 down to M_1, then refresh M_12
for (let m = 11; m >= 1; m--) generateMonth(m);
generateMonth(12);

console.log('Done.');

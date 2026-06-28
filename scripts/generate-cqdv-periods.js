#!/usr/bin/env node
/**
 * Generate CQDV period folders: M (month), W (week), D (day).
 * Same structure as M_12 template; KPI/chart numbers derived from shared series.
 */

const fs = require('fs');
const path = require('path');

const CQDV_ROOT = path.join(__dirname, '../ApiV2/TCNL/CQDV');
const MONTH_ROOT = path.join(CQDV_ROOT, 'M');
const TEMPLATE_MONTH = 12;

const PCVN_M = [62, 68, 72, 72, 74, 76, 78, 77, 76, 74, 72, 71.7];
const PCNN_M = [65, 70, 73, 75, 76, 78, 79, 78, 77, 75, 73, 74.5];
const TV_M = [70, 74, 78, 78, 79, 80, 81, 80, 79, 78, 76, 74];
const KPI_TARGET = 75;

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

const APRIL_PC_AVG = (PCVN_M[3] + PCNN_M[3]) / 2;
const APRIL_TV = TV_M[3];
const WEEKS_IN_YEAR = 52;
const DAYS_IN_MONTH = 31;
const DECEMBER_MONTH_IDX = 11;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolateSeries(monthlySeries, periodIndex, totalPeriods) {
  const floatIdx = ((periodIndex - 1) * 12) / totalPeriods;
  const i0 = Math.min(11, Math.max(0, Math.floor(floatIdx)));
  const i1 = Math.min(11, i0 + 1);
  const t = floatIdx - i0;
  return round1(lerp(monthlySeries[i0], monthlySeries[i1], t));
}

function buildWeeklySeries(monthlySeries) {
  return Array.from({ length: WEEKS_IN_YEAR }, (_, i) =>
    interpolateSeries(monthlySeries, i + 1, WEEKS_IN_YEAR)
  );
}

function buildDailySeries(monthlySeries, monthIdx, days) {
  const monthStart = monthlySeries[Math.max(0, monthIdx - 1)] ?? monthlySeries[monthIdx];
  const monthEnd = monthlySeries[monthIdx];
  return Array.from({ length: days }, (_, i) => {
    const t = days === 1 ? 1 : i / (days - 1);
    const wave = Math.sin((i / days) * Math.PI) * 0.8;
    return round1(lerp(monthStart, monthEnd, t) + wave);
  });
}

const PCVN_W = buildWeeklySeries(PCVN_M);
const PCNN_W = buildWeeklySeries(PCNN_M);
const TV_W = buildWeeklySeries(TV_M);
const PCVN_D = buildDailySeries(PCVN_M, DECEMBER_MONTH_IDX, DAYS_IN_MONTH);
const PCNN_D = buildDailySeries(PCNN_M, DECEMBER_MONTH_IDX, DAYS_IN_MONTH);
const TV_D = buildDailySeries(TV_M, DECEMBER_MONTH_IDX, DAYS_IN_MONTH);

function pcAvgFrom(vn, nn) {
  return round1((vn + nn) / 2);
}

function scaleArray(values, factor) {
  return values.map((v) => (v === null ? null : Math.round(v * factor)));
}

function scaleArray1dp(values, factor) {
  return values.map((v) => (v === null ? null : round1(v * factor)));
}

function pcnnAt(idx, kind) {
  if (kind === 'week') return PCNN_W[idx];
  if (kind === 'day') return PCNN_D[idx];
  return PCNN_M[idx];
}

function pcvnAt(idx, kind) {
  if (kind === 'week') return PCVN_W[idx];
  if (kind === 'day') return PCVN_D[idx];
  return PCVN_M[idx];
}

function tvAt(idx, kind) {
  if (kind === 'week') return TV_W[idx];
  if (kind === 'day') return TV_D[idx];
  return TV_M[idx];
}

function computeKpi(idx, kind, hasPrev) {
  const pcActual = pcAvgFrom(pcvnAt(idx, kind), pcnnAt(idx, kind));
  const tvActual = round1(tvAt(idx, kind));
  const prevIdx = idx - 1;
  const pcPrev = hasPrev ? pcAvgFrom(pcvnAt(prevIdx, kind), pcnnAt(prevIdx, kind)) : pcActual;
  const tvPrev = hasPrev ? round1(tvAt(prevIdx, kind)) : tvActual;

  function build(actual, prev) {
    const diff = round1(Math.abs(actual - prev));
    let trendDirection = 'flat';
    if (hasPrev) {
      if (actual > prev) trendDirection = 'up';
      else if (actual < prev) trendDirection = 'down';
    }
    const achieved = actual >= KPI_TARGET * 0.9;
    const progress = achieved ? 100 : Math.min(99, Math.round((actual / KPI_TARGET) * 100));
    return {
      actual,
      target: KPI_TARGET,
      trendValue: hasPrev ? diff : 0,
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

function slidingLabels(kind, idx, count, periodNum) {
  const labels = [];
  const start = Math.max(0, idx - count + 1);
  for (let i = start; i <= idx; i++) {
    if (kind === 'month') labels.push(`T${i + 1}/25`);
    else if (kind === 'week') labels.push(`W${i + 1}/25`);
    else labels.push(`D${i + 1}/12`);
  }
  while (labels.length < count) {
    const pad = idx - labels.length;
    if (kind === 'month') labels.unshift(`T${pad + 1}/25`);
    else if (kind === 'week') labels.unshift(`W${pad + 1}/25`);
    else labels.unshift(`D${pad + 1}/12`);
  }
  return labels.slice(-count);
}

function heatmapFromSeries(idx, baseSeries, valueSeries) {
  const start = idx - 3;
  return [0, 1, 2, 3].map((i) => {
    const si = start + i;
    const ref = valueSeries[Math.min(valueSeries.length - 1, Math.max(0, si))];
    const baseRef = valueSeries[Math.min(3, idx)] || ref;
    const ratio = ref / (baseRef || ref || 1);
    const baseIdx = Math.min(i, baseSeries.length - 1);
    return Math.round(baseSeries[baseIdx] * ratio);
  });
}

function heatmapPositionFromTv(idx, baseSeries, kind) {
  const tvSeries = kind === 'week' ? TV_W : kind === 'day' ? TV_D : TV_M;
  const start = idx - 3;
  return [0, 1, 2, 3].map((i) => {
    const si = Math.min(tvSeries.length - 1, Math.max(0, start + i));
    const ratio = tvSeries[si] / APRIL_TV;
    const baseIdx = Math.min(i, baseSeries.length - 1);
    return Math.round(baseSeries[baseIdx] * ratio);
  });
}

function buildLineChart12(kind, idx) {
  const count = 12;
  const start = Math.max(0, idx - count + 1);
  const labels = [];
  const pcvn = [];
  const pcnn = [];
  const tv = [];
  const pcTarget = [];
  const tvTarget = [];

  for (let i = start; i <= idx; i++) {
    labels.push(slidingLabels(kind, i, 1, null)[0]);
    pcvn.push(pcvnAt(i, kind));
    pcnn.push(pcnnAt(i, kind));
    tv.push(tvAt(i, kind));
    pcTarget.push(70);
    tvTarget.push(75);
  }
  while (labels.length < count) {
    const pad = start - (count - labels.length);
    labels.unshift(kind === 'month' ? `T${pad + 1}/25` : kind === 'week' ? `W${pad + 1}/25` : `D${pad + 1}/12`);
    pcvn.unshift(pcvnAt(Math.max(0, pad), kind));
    pcnn.unshift(pcnnAt(Math.max(0, pad), kind));
    tv.unshift(tvAt(Math.max(0, pad), kind));
    pcTarget.unshift(70);
    tvTarget.unshift(75);
  }

  return {
    labels: labels.slice(-count),
    pcvn: pcvn.slice(-count),
    pcnn: pcnn.slice(-count),
    tv: tv.slice(-count),
    pcTarget: pcTarget.slice(-count),
    tvTarget: tvTarget.slice(-count),
  };
}

function periodMeta(kind, periodNum) {
  if (kind === 'month') {
    const p = String(periodNum).padStart(2, '0');
    return {
      folder: `M_${periodNum}`,
      periodRoot: 'M',
      idx: periodNum - 1,
      hasPrev: periodNum > 1,
      periodLabel: `${periodNum}T/2026`,
      periodPadded: p,
      periodVi: `Tháng ${periodNum}/2025`,
      periodEn: `Month ${periodNum}/2025`,
      subtitleTag: `T${p}/2026`,
    };
  }
  if (kind === 'week') {
    const p = String(periodNum).padStart(2, '0');
    return {
      folder: `W_${periodNum}`,
      periodRoot: 'W',
      idx: periodNum - 1,
      hasPrev: periodNum > 1,
      periodLabel: `W${periodNum}/2025`,
      periodPadded: p,
      periodVi: `Tuần ${periodNum}/2025`,
      periodEn: `Week ${periodNum}/2025`,
      subtitleTag: `W${p}/2025`,
    };
  }
  const p = String(periodNum).padStart(2, '0');
  return {
    folder: `D_${periodNum}`,
    periodRoot: 'D',
    idx: periodNum - 1,
    hasPrev: periodNum > 1,
    periodLabel: `D${periodNum}/12/2025`,
    periodPadded: p,
    periodVi: `Ngày ${periodNum}/12/2025`,
    periodEn: `Day ${periodNum}/12/2025`,
    subtitleTag: `D${p}/12/2025`,
  };
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 4) + '\n');
}

function buildKpis(meta, kind) {
  const m = computeKpi(meta.idx, kind, meta.hasPrev);
  const template = readJson(path.join(MONTH_ROOT, `M_${TEMPLATE_MONTH}/kpis/fight-time/index.json`));
  Object.assign(template[0], {
    actual: m.pc.actual,
    target: m.pc.target,
    trendValue: m.pc.trendValue,
    trendDirection: m.pc.trendDirection,
    variant: m.pc.variant,
    statusLabel: m.pc.statusLabel,
    progress: m.pc.progress,
  });
  Object.assign(template[1], {
    actual: m.tv.actual,
    target: m.tv.target,
    trendValue: m.tv.trendValue,
    trendDirection: m.tv.trendDirection,
    variant: m.tv.variant,
    statusLabel: m.tv.statusLabel,
    progress: m.tv.progress,
  });
  return template;
}

function buildBoardIndex(meta) {
  const template = readJson(path.join(MONTH_ROOT, `M_${TEMPLATE_MONTH}/board/index.json`));
  const chartPath = `ApiV2/TCNL/CQDV/${meta.periodRoot}/${meta.folder}/board/chart/flight-time`;
  const json = JSON.stringify(template)
    .replace(/ApiV2\/TCNL\/CQDV\/M\/M_\d+\/board\/chart\/flight-time/g, chartPath)
    .replace(/T\d+\/2026/g, meta.subtitleTag)
    .replace(/Tháng \d+\/2025/g, meta.periodVi)
    .replace(/Month \d+\/2025/g, meta.periodEn)
    .replace(/\(\d+T\/2026\)/g, `(${meta.periodLabel})`);
  return JSON.parse(json);
}

function buildCharts(meta, kind) {
  const idx = meta.idx;
  const pcActual = pcAvgFrom(pcvnAt(idx, kind), pcnnAt(idx, kind));
  const tvActual = round1(tvAt(idx, kind));
  const pcFactor = pcActual / APRIL_PC_AVG;
  const tvFactor = tvActual / APRIL_TV;
  const line = buildLineChart12(kind, idx);
  const chartDir = path.join(MONTH_ROOT, `M_${TEMPLATE_MONTH}/board/chart/flight-time`);

  const i0 = readJson(path.join(chartDir, 'index0.json'));
  i0.labels = line.labels;
  i0.data[0].name = line.pcvn;
  i0.data[1].name = line.pcnn;
  i0.data[2].name = line.pcTarget;

  const i4 = readJson(path.join(chartDir, 'index4.json'));
  i4.labels = line.labels;
  i4.data[0].name = line.tv;
  i4.data[1].name = line.tvTarget;

  const i1 = readJson(path.join(chartDir, 'index1.json'));
  i1.subTitle.keyVi = `So sánh giờ bay BQ giữa các đội bay (${meta.subtitleTag})`;
  i1.subTitle.keyEn = `Compare flight time BQ between flight teams (${meta.subtitleTag})`;
  i1.data[0].key.keyVi = `PCVN ${meta.subtitleTag} (${meta.periodVi})`;
  i1.data[0].key.keyEn = `PCVN ${meta.subtitleTag} (${meta.periodEn})`;
  i1.data[0].name = scaleArray(INDEX1_PCVN, pcFactor);
  i1.data[1].key.keyVi = `PCNN ${meta.subtitleTag} (${meta.periodVi})`;
  i1.data[1].key.keyEn = `PCNN ${meta.subtitleTag} (${meta.periodEn})`;
  i1.data[1].name = scaleArray(INDEX1_PCNN, pcFactor);
  i1.data[2].key.keyVi = `Giờ mức (${meta.periodVi})`;
  i1.data[2].key.keyEn = `Target (${meta.periodEn})`;
  i1.data[2].name = scaleArray(INDEX1_TARGET, pcFactor);

  const i2 = readJson(path.join(chartDir, 'index2.json'));
  i2.data[0].key.keyVi = `TH ${meta.periodLabel} (${meta.periodVi})`;
  i2.data[0].key.keyEn = `TH ${meta.periodLabel} (${meta.periodEn})`;
  i2.data[0].name = scaleArray1dp(INDEX2_TH, pcFactor);
  i2.data[1].key.keyVi = `Giờ mức (${meta.periodVi})`;
  i2.data[1].key.keyEn = `Target (${meta.periodEn})`;
  i2.data[1].name = scaleArray(INDEX2_TARGET, pcFactor);

  const valueSeries = kind === 'week' ? PCVN_W : kind === 'day' ? PCVN_D : PCVN_M;
  const i3 = readJson(path.join(chartDir, 'index3.json'));
  i3.labels = slidingLabels(kind, idx, 4);
  i3.data[0].key.keyVi = `B787 (${meta.periodVi})`;
  i3.data[0].key.keyEn = `B787 (${meta.periodEn})`;
  i3.data[0].name = heatmapFromSeries(idx, INDEX3_BASE.B787, valueSeries);
  i3.data[1].key.keyVi = `A350 (${meta.periodVi})`;
  i3.data[1].key.keyEn = `A350 (${meta.periodEn})`;
  i3.data[1].name = heatmapFromSeries(idx, INDEX3_BASE.A350, valueSeries);
  i3.data[2].key.keyVi = `A321 (${meta.periodVi})`;
  i3.data[2].key.keyEn = `A321 (${meta.periodEn})`;
  i3.data[2].name = heatmapFromSeries(idx, INDEX3_BASE.A321, valueSeries);
  i3.data[3].key.keyVi = `ATR (${meta.periodVi})`;
  i3.data[3].key.keyEn = `ATR (${meta.periodEn})`;
  i3.data[3].name = heatmapFromSeries(idx, INDEX3_BASE.ATR, valueSeries);

  const i5 = readJson(path.join(chartDir, 'index5.json'));
  i5.data[0].key = `VN (${meta.periodVi})`;
  i5.data[0].name = scaleArray1dp(INDEX5_VN, tvFactor);
  i5.data[1].key = `ALS (${meta.periodVi})`;
  i5.data[1].name = scaleArray1dp(INDEX5_ALS, tvFactor);
  i5.data[2].key = `NN (${meta.periodVi})`;
  i5.data[2].name = scaleArray1dp(INDEX5_NN, tvFactor);
  i5.data[3].key = `Giờ mức (${meta.periodVi})`;
  i5.data[3].name = INDEX5_TARGET;

  const i6 = readJson(path.join(chartDir, 'index6.json'));
  i6.title.keyVi = `VN vs ALS vs NN (${meta.periodLabel})`;
  i6.title.keyEn = `VN vs ALS vs NN (${meta.periodLabel})`;
  i6.data[0].key.keyVi = `TH ${meta.periodLabel} (${meta.periodVi})`;
  i6.data[0].key.keyEn = `TH ${meta.periodLabel} (${meta.periodEn})`;
  i6.data[0].name = scaleArray1dp(INDEX6_TH, tvFactor);
  i6.data[1].key.keyVi = `Giờ mức (${meta.periodVi})`;
  i6.data[1].key.keyEn = `Target (${meta.periodEn})`;
  i6.data[1].name = INDEX6_TARGET;

  const i7 = readJson(path.join(chartDir, 'index7.json'));
  i7.labels = slidingLabels(kind, idx, 4);
  ['TVT-B2', 'TVT-B1', 'TVC', 'TVY'].forEach((pos, pi) => {
    i7.data[pi].key.keyVi = `${pos} (${meta.periodVi})`;
    i7.data[pi].key.keyEn = `${pos} (${meta.periodEn})`;
    i7.data[pi].name = heatmapPositionFromTv(idx, INDEX7_BASE[pos], kind);
  });

  return {
    'index0.json': i0,
    'index1.json': i1,
    'index2.json': i2,
    'index3.json': i3,
    'index4.json': i4,
    'index5.json': i5,
    'index6.json': i6,
    'index7.json': i7,
  };
}

function generatePeriod(kind, periodNum) {
  const meta = periodMeta(kind, periodNum);
  const root = path.join(CQDV_ROOT, meta.periodRoot, meta.folder);
  const overview = readJson(path.join(MONTH_ROOT, `M_${TEMPLATE_MONTH}/overview/index.json`));

  writeJson(path.join(root, 'overview/index.json'), overview);
  writeJson(path.join(root, 'kpis/fight-time/index.json'), buildKpis(meta, kind));
  writeJson(path.join(root, 'board/index.json'), buildBoardIndex(meta));

  const charts = buildCharts(meta, kind);
  for (const [file, data] of Object.entries(charts)) {
    writeJson(path.join(root, 'board/chart/flight-time', file), data);
  }
}

function runWeeks() {
  console.log('Generating W_52 .. W_1 ...');
  for (let w = WEEKS_IN_YEAR; w >= 1; w--) {
    generatePeriod('week', w);
    if (w % 13 === 0 || w === 1) {
      const m = computeKpi(w - 1, 'week', w > 1);
      console.log(`  W_${w}: PC=${m.pc.actual} TV=${m.tv.actual}`);
    }
  }
}

function runDays() {
  console.log('Generating D_31 .. D_1 ...');
  for (let d = DAYS_IN_MONTH; d >= 1; d--) {
    generatePeriod('day', d);
    if (d % 10 === 0 || d === 1) {
      const m = computeKpi(d - 1, 'day', d > 1);
      console.log(`  D_${d}: PC=${m.pc.actual} TV=${m.tv.actual}`);
    }
  }
}

runWeeks();
runDays();
console.log('Done.');

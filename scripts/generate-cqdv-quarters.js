#!/usr/bin/env node
/**
 * Generate Q_1 .. Q_3 from Q_4 template (quarterly config).
 * overview/ copied unchanged from Q_4; colors preserved; numbers varied per quarter.
 *
 * Usage:
 *   node scripts/generate-cqdv-quarters.js          # CQDV (default)
 *   node scripts/generate-cqdv-quarters.js BGD
 *   node scripts/generate-cqdv-quarters.js CQDV BGD  # both orgs
 */

const fs = require('fs');
const path = require('path');

const ORGS = (process.argv.slice(2).length ? process.argv.slice(2) : ['CQDV']).map((o) =>
  o.toUpperCase()
);

const PCVN_Q = [68, 75.5, 77, 72.5];
const PCNN_Q = [69.5, 76.5, 78.5, 74.5];
const TV_Q = [70, 74, 78, 76.1];
const NSLD_KPI = [232, 238, 242, 246];
const NSLD_TH = [220, 245, 255, 265];
const NSLD_KH = [225, 245, 260, 285];
const NSLD_CK = [180, 200, 210, 225];
const LABOR_KPI = [7.12, 7.15, 7.17, 7.195];
const PC_KPI = [72.0, 74.5, 75.8, 76.1];
const TV_KPI = [73.0, 75.2, 76.0, 76.1];
const LABOR_ACTUAL_Q = [7450, 7520, 7650, 7900];
const LABOR_WATERFALL = [
  { start: 7200, hire: 620, quit: -72, leave: -312, end: 7436 },
  { start: 7350, hire: 720, quit: -85, leave: -389, end: 7596 },
  { start: 7520, hire: 780, quit: -88, leave: -420, end: 7792 },
  { start: 7450, hire: 840, quit: -95, leave: -449, end: 7436 },
];
const DOUGHNUT = [
  [960, 88, 25, 1090, 2150, 12, 2980, 105],
  [972, 91, 26, 1105, 2180, 13, 3018, 108],
  [978, 93, 27, 1112, 2192, 14, 3038, 110],
  [983, 94, 27, 1120, 2204, 14, 3056, 111],
];
const DIVISION_TH = [
  [520, 1450, 440, 115, 310, 4300, 105],
  [530, 1470, 448, 118, 318, 4370, 108],
  [535, 1485, 453, 120, 322, 4410, 109],
  [540, 1500, 459, 121, 325, 4442, 111],
];
const DIVISION_KH = [
  [550, 1600, 530, 128, 340, 4850, 125],
  [560, 1620, 538, 129, 343, 4885, 126],
  [565, 1630, 542, 130, 345, 4900, 127],
  [569, 1641, 545, 131, 347, 4920, 127],
];
const NSLD_DIV_TH = [
  [365, 335, 275, 248, 110, 198],
  [372, 340, 280, 252, 112, 200],
  [376, 344, 282, 254, 114, 203],
  [380, 348, 285, 255, 115, 205],
];
const NSLD_DIV_KH = [
  [355, 330, 288, 265, 148, 208],
  [358, 332, 290, 266, 149, 209],
  [359, 334, 291, 267, 150, 210],
  [360, 335, 292, 268, 150, 210],
];
const NSLD_DIV_CK = [
  [330, 308, 262, 238, 120, 190],
  [335, 312, 265, 242, 122, 192],
  [338, 314, 268, 244, 124, 194],
  [340, 315, 270, 245, 125, 195],
];
const BULLET_NSLD = [
  [228, 235],
  [235, 240],
  [238, 243],
  [240, 245],
];
const RTK_ACTUAL = [
  [58, 59, null, null, 58],
  [59, 60, null, null, 59],
  [60, 61, null, null, 60],
  [60, 61, null, null, 60],
];
const INDEX1_PCVN = [
  [74, 72, 77, 77, 60, 45, 54, 54],
  [76, 74, 79, 79, 58, 47, 56, 56],
  [77, 75, 80, 80, 57, 48, 57, 57],
  [77, 75, 80, 80, 56, 42, 50, 50],
];
const INDEX1_PCNN = [
  [71, 54, 74, 62, 56, 42, 50, null],
  [73, 55, 76, 63, 54, 43, 52, null],
  [74, 56, 77, 64, 53, 44, 53, null],
  [74, 56, 77, 64, 53, 44, 53, null],
];
const INDEX2_TH = [
  [63.5, 57.2, 64.8, 53.5],
  [64.8, 58.5, 66.2, 55.0],
  [65.2, 59.0, 66.8, 55.5],
  [65.8, 59.2, 67.2, 55.7],
];
const INDEX5_VN = [
  [68, 74, 79, 75],
  [69, 75, 80, 76],
  [70, 76, 81, 77],
  [71, 77, 82, 78],
];
const INDEX5_ALS = [
  [66, 73, 76, 75],
  [67, 74, 77, 76],
  [68, 75, 78, 77],
  [69, 76, 79, 78],
];
const INDEX5_NN = [
  [null, 68, 69, 62],
  [null, 69, 70, 63],
  [null, 70, 71, 64],
  [null, 71, 72, 65],
];
const INDEX6_TH = [
  [66.5, 68.0, 59.5],
  [67.5, 69.0, 61.0],
  [68.2, 69.5, 62.5],
  [68.7, 70.0, 61.4],
];
const INDEX3_BASE = {
  B787: [
    [74, 74, 74, 68],
    [76, 76, 76, 70],
    [77, 77, 77, 71],
    [78, 78, 78, 72],
  ],
  A350: [
    [72, 72, 72, 74],
    [73, 73, 73, 75],
    [74, 74, 74, 76],
    [75, 75, 75, 77],
  ],
  A321: [
    [48, 48, 48, 45],
    [49, 49, 49, 46],
    [49, 49, 49, 46],
    [50, 50, 50, 47],
  ],
  ATR: [
    [40, 40, 40, 46],
    [41, 41, 41, 47],
    [41, 41, 41, 47],
    [42, 42, 42, 48],
  ],
};
const INDEX7_BASE = {
  'TVT-B2': [
    [55, 59, 63, 67],
    [56, 60, 64, 68],
    [57, 61, 65, 69],
    [58, 62, 66, 70],
  ],
  'TVT-B1': [
    [65, 69, 72, 73],
    [66, 70, 73, 74],
    [67, 71, 74, 75],
    [68, 72, 75, 76],
  ],
  TVC: [
    [69, 72, 75, 77],
    [70, 73, 76, 78],
    [71, 74, 77, 79],
    [72, 75, 78, 80],
  ],
  TVY: [
    [67, 70, 73, 73],
    [68, 71, 74, 74],
    [69, 72, 75, 75],
    [70, 73, 76, 76],
  ],
};

const QUARTER_META = {
  1: {
    tag: '1T/2026',
    label: 'Q1/2026',
    tTag: 'T01/2026',
    monthVi: 'Tháng 1/2025',
    monthEn: 'Month 1/2025',
    quarterVi: 'Quý 1/2025',
    quarterEn: 'Q1/2025',
    heatmapLabels: ['T-1/25', 'T0/25', 'T1/25', 'T1/25'],
    heatmapMonthVi: 'Tháng 1/2025',
    heatmapMonthEn: 'Month 1/2025',
  },
  2: {
    tag: '2T/2026',
    label: 'Q2/2026',
    tTag: 'T04/2026',
    monthVi: 'Tháng 4/2025',
    monthEn: 'Month 4/2025',
    quarterVi: 'Quý 2/2025',
    quarterEn: 'Q2/2025',
    heatmapLabels: ['T2/25', 'T3/25', 'T4/25', 'T4/25'],
    heatmapMonthVi: 'Tháng 4/2025',
    heatmapMonthEn: 'Month 4/2025',
  },
  3: {
    tag: '3T/2026',
    label: 'Q3/2026',
    tTag: 'T07/2026',
    monthVi: 'Tháng 7/2025',
    monthEn: 'Month 7/2025',
    quarterVi: 'Quý 3/2025',
    quarterEn: 'Q3/2025',
    heatmapLabels: ['T5/25', 'T6/25', 'T7/25', 'T7/25'],
    heatmapMonthVi: 'Tháng 7/2025',
    heatmapMonthEn: 'Month 7/2025',
  },
  4: {
    tag: '4T/2026',
    label: 'Q4/2026',
    tTag: 'T10/2026',
    monthVi: 'Tháng 10/2025',
    monthEn: 'Month 10/2025',
    quarterVi: 'Quý 4/2025',
    quarterEn: 'Q4/2025',
    heatmapLabels: ['T-1/25', 'T0/25', 'T1/25', 'T1/25'],
    heatmapMonthVi: 'Tháng 1/2025',
    heatmapMonthEn: 'Month 1/2025',
  },
};

function round1(n) {
  return Math.round(n * 10) / 10;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 4) + '\n');
}

function qi(quarter) {
  return quarter - 1;
}

function kpiTrend(actual, prev) {
  const diff = round1(Math.abs(actual - prev));
  let trendDirection = 'flat';
  if (actual > prev) trendDirection = 'up';
  else if (actual < prev) trendDirection = 'down';
  return { trendValue: diff, trendDirection };
}

function applyKpiItem(item, actual, target, prev, higherIsBetter = true) {
  const achieved = higherIsBetter
    ? actual >= target * 0.9
    : actual <= target * 1.02;
  const trend = kpiTrend(actual, prev);
  item.actual = actual;
  item.target = target;
  item.trendValue = trend.trendValue;
  item.trendDirection = trend.trendDirection;
  item.variant = achieved ? 'success' : 'warning';
  item.statusLabel = achieved
    ? { keyVi: 'ĐẠT', keyEn: 'ACHIEVED' }
    : { keyVi: 'KHÔNG ĐẠT', keyEn: 'NOT ACHIEVED' };
  item.progress = achieved ? 100 : Math.min(99, Math.round((actual / target) * 100));
}

function walkAndFix(obj, quarter) {
  if (typeof obj === 'string') {
    return obj
      .replace(/\/Q\/Q_\d+\//g, `/Q/Q_${quarter}/`)
      .replace(/board\/chart\/all\//g, 'board/all/chart/')
      .replace(/board\/chart\/flight-time\//g, 'board/fight-time/chart/')
      .replace(/board\/chart\/labor\//g, 'board/labor/chart/')
      .replace(/board\/chart\/labor-productivity\//g, 'board/labor-productivity/chart/');
  }
  if (Array.isArray(obj)) return obj.map((v) => walkAndFix(v, quarter));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walkAndFix(v, quarter);
    return out;
  }
  return obj;
}

function fixBoardUrls(json, quarter) {
  return walkAndFix(json, quarter);
}

function replaceQuarterText(obj, meta) {
  const s = JSON.stringify(obj)
    .replace(/4T\/2026/g, meta.tag)
    .replace(/Q4\/2026/g, meta.label)
    .replace(/T01\/2026/g, meta.tTag)
    .replace(/Tháng 1\/2025/g, meta.monthVi)
    .replace(/Month 1\/2025/g, meta.monthEn)
    .replace(/Tháng 4\/2025/g, meta.monthVi)
    .replace(/Month 4\/2025/g, meta.monthEn)
    .replace(/Quý 1\/2025/g, meta.quarterVi)
    .replace(/Q1\/2025/g, meta.quarterEn)
    .replace(/Quý 2\/2025/g, meta.quarterVi)
    .replace(/Q2\/2025/g, meta.quarterEn)
    .replace(/Quý 2\/2026/g, meta.label.replace('Q1', 'Q').replace(/Q\d/, meta.label.split('/')[0]))
    .replace(/Q2\/2026/g, meta.label);
  return JSON.parse(s);
}

function buildKpisAll(quarter, template) {
  const i = qi(quarter);
  const prev = Math.max(0, i - 1);
  const data = readJson(path.join(template, 'kpis/all/index.json'));
  applyKpiItem(data[0], NSLD_KPI[i], 245, NSLD_KPI[prev]);
  applyKpiItem(data[1], LABOR_KPI[i], 7.2, LABOR_KPI[prev], false);
  applyKpiItem(data[2], PC_KPI[i], 75, PC_KPI[prev]);
  applyKpiItem(data[3], TV_KPI[i], 75, TV_KPI[prev]);
  return data;
}

function buildKpisFightTime(quarter, template) {
  const i = qi(quarter);
  const prev = Math.max(0, i - 1);
  const data = readJson(path.join(template, 'kpis/fight-time/index.json'));
  applyKpiItem(data[0], PC_KPI[i], 75, PC_KPI[prev]);
  applyKpiItem(data[1], TV_KPI[i], 75, TV_KPI[prev]);
  return data;
}

function buildKpisLabor(quarter, template) {
  const i = qi(quarter);
  const prev = Math.max(0, i - 1);
  const data = readJson(path.join(template, 'kpis/labor/index.json'));
  applyKpiItem(data[0], LABOR_KPI[i], 7.2, LABOR_KPI[prev], false);
  return data;
}

function buildKpisLaborProductivity(quarter, template) {
  const i = qi(quarter);
  const prev = Math.max(0, i - 1);
  const data = readJson(path.join(template, 'kpis/labor-productivity/index.json'));
  applyKpiItem(data[0], NSLD_KPI[i], 245, NSLD_KPI[prev]);
  return data;
}

function buildBoardIndex(relPath, quarter, template) {
  const data = readJson(path.join(template, relPath));
  const fixed = fixBoardUrls(data, quarter);
  return replaceQuarterText(fixed, QUARTER_META[quarter]);
}

function buildFightTimeCharts(quarter, template) {
  const i = qi(quarter);
  const meta = QUARTER_META[quarter];

  const i0 = readJson(path.join(template, 'board/fight-time/chart/index0.json'));
  i0.data[0].name = PCVN_Q;
  i0.data[1].name = PCNN_Q;

  const i1 = readJson(path.join(template, 'board/fight-time/chart/index1.json'));
  i1.subTitle.keyVi = `So sánh giờ bay BQ giữa các đội bay (${meta.tTag})`;
  i1.subTitle.keyEn = `Compare flight time BQ between flight teams (${meta.tTag})`;
  i1.data[0].key.keyVi = `PCVN ${meta.tTag} (${meta.monthVi})`;
  i1.data[0].key.keyEn = `PCVN ${meta.tTag} (${meta.monthEn})`;
  i1.data[0].name = INDEX1_PCVN[i];
  i1.data[1].key.keyVi = `PCNN ${meta.tTag} (${meta.monthVi})`;
  i1.data[1].key.keyEn = `PCNN ${meta.tTag} (${meta.monthEn})`;
  i1.data[1].name = INDEX1_PCNN[i];
  i1.data[2].key.keyVi = `Giờ mức (${meta.monthVi})`;
  i1.data[2].key.keyEn = `Target (${meta.monthEn})`;

  const i2 = readJson(path.join(template, 'board/fight-time/chart/index2.json'));
  i2.data[0].key.keyVi = `TH ${meta.tag} (${meta.monthVi})`;
  i2.data[0].key.keyEn = `TH ${meta.tag} (${meta.monthEn})`;
  i2.data[0].name = INDEX2_TH[i];
  i2.data[1].key.keyVi = `Giờ mức (${meta.monthVi})`;
  i2.data[1].key.keyEn = `Target (${meta.monthEn})`;

  const i3 = readJson(path.join(template, 'board/fight-time/chart/index3.json'));
  i3.labels = meta.heatmapLabels;
  ['B787', 'A350', 'A321', 'ATR'].forEach((k, idx) => {
    i3.data[idx].key.keyVi = `${k} (${meta.heatmapMonthVi})`;
    i3.data[idx].key.keyEn = `${k} (${meta.heatmapMonthEn})`;
    i3.data[idx].name = INDEX3_BASE[k][i];
  });

  const i4 = readJson(path.join(template, 'board/fight-time/chart/index4.json'));

  const i5 = readJson(path.join(template, 'board/fight-time/chart/index5.json'));
  i5.data[0].key.keyVi = `VN (${meta.quarterVi})`;
  i5.data[0].key.keyEn = `VN (${meta.quarterEn})`;
  i5.data[0].name = INDEX5_VN[i];
  i5.data[1].key.keyVi = `ALS (${meta.quarterVi})`;
  i5.data[1].key.keyEn = `ALS (${meta.quarterEn})`;
  i5.data[1].name = INDEX5_ALS[i];
  i5.data[2].key.keyVi = `NN (${meta.quarterVi})`;
  i5.data[2].key.keyEn = `NN (${meta.quarterEn})`;
  i5.data[2].name = INDEX5_NN[i];
  i5.data[3].key.keyVi = `Giờ mức (${meta.quarterVi})`;
  i5.data[3].key.keyEn = `Target (${meta.quarterEn})`;

  const i6 = readJson(path.join(template, 'board/fight-time/chart/index6.json'));
  i6.title.keyVi = `VN vs ALS vs NN (${meta.label})`;
  i6.title.keyEn = `VN vs ALS vs NN (${meta.label})`;
  i6.data[0].key.keyVi = `TH ${meta.label} (${meta.quarterVi})`;
  i6.data[0].key.keyEn = `TH ${meta.label} (${meta.quarterEn})`;
  i6.data[0].name = INDEX6_TH[i];
  i6.data[1].key.keyVi = `Giờ mức (${meta.quarterVi})`;
  i6.data[1].key.keyEn = `Target (${meta.quarterEn})`;

  const i7 = readJson(path.join(template, 'board/fight-time/chart/index7.json'));
  ['TVT-B2', 'TVT-B1', 'TVC', 'TVY'].forEach((k, idx) => {
    i7.data[idx].key.keyVi = `${k} (${meta.label})`;
    i7.data[idx].key.keyEn = `${k} (${meta.label})`;
    i7.data[idx].name = INDEX7_BASE[k][i];
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

function buildAllCharts(quarter, template) {
  const i = qi(quarter);
  const i0 = readJson(path.join(template, 'board/all/chart/index0.json'));
  i0.data[0].name = NSLD_TH;
  i0.data[1].name = NSLD_KH;
  i0.data[2].name = NSLD_CK;

  const i1 = readJson(path.join(template, 'board/all/chart/index1.json'));
  const laborVal = LABOR_ACTUAL_Q[i];
  i1.data[0].name = [laborVal, laborVal, laborVal, laborVal];
  i1.data[1].name = [laborVal, laborVal, laborVal, laborVal];

  const i2 = readJson(path.join(template, 'board/all/chart/index2.json'));
  const pc = PC_KPI[i];
  i2.data[0].name = [pc - 1, pc, pc, pc];
  i2.config.minValue = Math.floor(pc - 2);
  i2.config.maxValue = Math.ceil(pc + 1);

  const i3 = readJson(path.join(template, 'board/all/chart/index3.json'));
  const tv = TV_KPI[i];
  i3.data[0].name = [tv - 1, tv, tv, tv];
  i3.config.minValue = Math.floor(tv - 2);
  i3.config.maxValue = Math.ceil(tv + 1);

  return { 'index0.json': i0, 'index1.json': i1, 'index2.json': i2, 'index3.json': i3 };
}

function buildLaborCharts(quarter, template) {
  const i = qi(quarter);
  const meta = QUARTER_META[quarter];
  const wf = LABOR_WATERFALL[i];

  const i0 = readJson(path.join(template, 'board/labor/chart/index0.json'));

  const i1 = readJson(path.join(template, 'board/labor/chart/index1.json'));
  i1.data[0].key.keyVi = `Cơ cấu LĐ ${meta.tag}`;
  i1.data[0].key.keyEn = `Labor structure ${meta.label}`;
  i1.data[0].name = DOUGHNUT[i];

  const i2 = readJson(path.join(template, 'board/labor/chart/index2.json'));
  i2.data[0].key.keyVi = `TH ${meta.tag} (${meta.monthVi})`;
  i2.data[0].key.keyEn = `Actual ${meta.label} (${meta.monthEn})`;
  i2.data[0].name = DIVISION_TH[i];
  i2.data[1].key.keyVi = `KH 2026 (${meta.monthVi})`;
  i2.data[1].key.keyEn = `Plan 2026 (${meta.monthEn})`;
  i2.data[1].name = DIVISION_KH[i];

  const i3 = readJson(path.join(template, 'board/labor/chart/index3.json'));
  i3.title.keyVi = `Biến động LĐ ${meta.tag}`;
  i3.title.keyEn = `Labor movement ${meta.label}`;
  i3.data[0].key.keyVi = `Biến động LĐ ${meta.tag}`;
  i3.data[0].key.keyEn = `Labor movement ${meta.label}`;
  i3.data[0].name = [wf.start, wf.hire, wf.quit, wf.leave, wf.end];

  return { 'index0.json': i0, 'index1.json': i1, 'index2.json': i2, 'index3.json': i3 };
}

function buildLaborProductivityCharts(quarter, template) {
  const i = qi(quarter);
  const meta = QUARTER_META[quarter];

  const i0 = readJson(path.join(template, 'board/labor-productivity/chart/index0.json'));
  i0.data[0].name = NSLD_TH;
  i0.data[1].name = NSLD_KH;
  i0.data[2].name = NSLD_CK;

  const i1 = readJson(path.join(template, 'board/labor-productivity/chart/index1.json'));
  i1.data[0].key.keyVi = `TH 2026 (${meta.label})`;
  i1.data[0].key.keyEn = `Actual 2026 (${meta.label})`;
  i1.data[0].name = NSLD_DIV_TH[i];
  i1.data[1].key.keyVi = `KH 2026 (${meta.label})`;
  i1.data[1].key.keyEn = `Plan 2026 (${meta.label})`;
  i1.data[1].name = NSLD_DIV_KH[i];
  i1.data[2].key.keyVi = `TH 2025 (${meta.quarterVi})`;
  i1.data[2].key.keyEn = `Actual 2025 (${meta.quarterEn})`;
  i1.data[2].name = NSLD_DIV_CK[i];

  const i2 = readJson(path.join(template, 'board/labor-productivity/chart/index2.json'));
  i2.data[0].key.keyVi = `NSLĐ ${meta.tag} (${meta.quarterVi})`;
  i2.data[0].key.keyEn = `Labor productivity ${meta.tag} (${meta.quarterEn})`;
  i2.data[0].name = BULLET_NSLD[i];

  const i3 = readJson(path.join(template, 'board/labor-productivity/chart/index3.json'));
  i3.data[0].name = RTK_ACTUAL[i];

  return { 'index0.json': i0, 'index1.json': i1, 'index2.json': i2, 'index3.json': i3 };
}

function generateQuarter(quarter, qRoot, template, org) {
  const root = path.join(qRoot, `Q_${quarter}`);
  const overview = readJson(path.join(template, 'overview/index.json'));
  writeJson(path.join(root, 'overview/index.json'), overview);

  writeJson(path.join(root, 'kpis/all/index.json'), buildKpisAll(quarter, template));
  writeJson(path.join(root, 'kpis/fight-time/index.json'), buildKpisFightTime(quarter, template));
  writeJson(path.join(root, 'kpis/labor/index.json'), buildKpisLabor(quarter, template));
  writeJson(path.join(root, 'kpis/labor-productivity/index.json'), buildKpisLaborProductivity(quarter, template));

  writeJson(path.join(root, 'board/all/index.json'), buildBoardIndex('board/all/index.json', quarter, template));
  writeJson(path.join(root, 'board/fight-time/index.json'), buildBoardIndex('board/fight-time/index.json', quarter, template));
  writeJson(path.join(root, 'board/labor/index.json'), buildBoardIndex('board/labor/index.json', quarter, template));
  writeJson(
    path.join(root, 'board/labor-productivity/index.json'),
    buildBoardIndex('board/labor-productivity/index.json', quarter, template)
  );

  for (const [file, data] of Object.entries(buildAllCharts(quarter, template))) {
    writeJson(path.join(root, 'board/all/chart', file), data);
  }
  for (const [file, data] of Object.entries(buildFightTimeCharts(quarter, template))) {
    writeJson(path.join(root, 'board/fight-time/chart', file), data);
  }
  for (const [file, data] of Object.entries(buildLaborCharts(quarter, template))) {
    writeJson(path.join(root, 'board/labor/chart', file), data);
  }
  for (const [file, data] of Object.entries(buildLaborProductivityCharts(quarter, template))) {
    writeJson(path.join(root, 'board/labor-productivity/chart', file), data);
  }

  const i = qi(quarter);
  console.log(
    `  ${org} Q_${quarter}: NSLĐ=${NSLD_KPI[i]} PC=${PC_KPI[i]} TV=${TV_KPI[i]} LĐ=${LABOR_KPI[i]}`
  );
}

for (const org of ORGS) {
  const qRoot = path.join(__dirname, '../ApiV2/TCNL', org, 'Q');
  const template = path.join(qRoot, 'Q_4');
  if (!fs.existsSync(template)) {
    console.error(`Skip ${org}: template not found at ${template}`);
    continue;
  }
  console.log(`Generating ${org} Q_1 .. Q_3 from Q_4 template ...`);
  for (let q = 1; q <= 3; q++) {
    generateQuarter(q, qRoot, template, org);
  }
}
console.log('Done.');

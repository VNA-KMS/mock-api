#!/usr/bin/env node
/**
 * Generate yearly folders Y_2022 .. Y_2025 from Y_2026 template.
 * overview/ copied unchanged; colors preserved; numbers varied per year.
 *
 * Usage:
 *   node scripts/generate-cqdv-years.js           # CQDV + BGD
 *   node scripts/generate-cqdv-years.js CQDV
 *   node scripts/generate-cqdv-years.js BGD
 */

const fs = require('fs');
const path = require('path');

const ORGS = (process.argv.slice(2).length ? process.argv.slice(2) : ['CQDV', 'BGD']).map((o) =>
  o.toUpperCase()
);
const TARGET_YEARS = [2022, 2023, 2024, 2025];
const BASE_YEAR = 2026;
const SERIES_START = 2022;

// Master series mapped to 2022..2026 (from Y_2026 board/all charts + kpis)
const MASTER = {
  nsld: {
    th: [218, 225, 232, 238, 246],
    kh: [240, 242, 243, 244, 245],
    baseline: [205, 208, 210, 212, 215],
    higherIsBetter: true,
  },
  satisfaction: {
    th: [72, 74, 76, 78, 80.8],
    kh: [85, 88, 90, 95, 100],
    baseline: null,
    higherIsBetter: true,
  },
  salary: {
    th: [32, 34, 36, 38, 39],
    kh: [38, 39, 40, 41, 42],
    baseline: [30, 31, 32, 33, 34],
    higherIsBetter: true,
  },
  labor: {
    th: [6850, 6950, 7050, 7120, 7195],
    kh: [7000, 7050, 7100, 7150, 7200],
    baseline: [6700, 6750, 6800, 6850, 6900],
    higherIsBetter: true,
    kpiScale: 1000,
  },
  pc: {
    th: [68, 70, 72, 74, 76.1],
    kh: [75, 75, 75, 75, 75],
    baseline: [65, 66, 67, 68, 69],
    higherIsBetter: true,
  },
  tv: {
    th: [68, 70, 72, 74, 76.1],
    kh: [75, 75, 75, 75, 75],
    baseline: [65, 66, 67, 68, 69],
    higherIsBetter: true,
  },
  costLd: {
    th: [45, 47, 49, 50, 50.8],
    kh: [48, 49, 50, 51, 52],
    baseline: [42, 43, 44, 45, 46],
    higherIsBetter: false,
  },
  costRtk: {
    th: [11800, 12100, 12350, 12550, 40],
    kh: [12200, 12300, 12450, 12550, 12650],
    baseline: [11500, 11600, 11700, 11800, 11900],
    higherIsBetter: false,
  },
  costFlight: {
    th: [2.55, 2.62, 2.68, 2.72, 2.75],
    kh: [2.7, 2.72, 2.74, 2.76, 2.78],
    baseline: [2.5, 2.52, 2.54, 2.56, 2.58],
    higherIsBetter: false,
  },
  costBh: {
    th: [1.08, 1.1, 1.12, 1.15, 1.17],
    kh: [1.15, 1.16, 1.17, 1.18, 1.2],
    baseline: [1.05, 1.06, 1.07, 1.08, 1.09],
    higherIsBetter: false,
  },
};

const FIGHT_PC_TREND = {
  pcvn: [64, 66, 69, 72, 74],
  pcnn: [66, 68, 71, 74, 76],
  target: [70, 70, 70, 70, 70],
};

const FIGHT_TV_TREND = {
  th: [68, 70, 72, 74, 76.1],
  target: [75, 75, 75, 75, 75],
};

const FIGHT_HEATMAP = {
  B787: [62, 65, 68, 71, 74],
  A350: [60, 63, 66, 69, 72],
  A321: [45, 48, 52, 55, 58],
  ATR: [40, 42, 45, 48, 52],
};

const FIGHT_TV_HEATMAP = {
  'TVT-B2': [55, 58, 62, 65, 68],
  'TVT-B1': [62, 65, 68, 71, 73],
  TVC: [66, 69, 72, 75, 77],
  TVY: [64, 67, 70, 72, 73],
};

const NSLD_DIV = {
  th: [385, 350, 288, 260, 115, 208],
  kh: [362, 338, 295, 270, 155, 215],
  ck: [345, 320, 275, 250, 124, 198],
};

const LABOR_LONG = {
  th: [6800, 6500, 6200, 6600, 7000, 7200, 7350, 7195],
  kh: [7000, 6800, 6600, 7000, 7400, 7600, 7800, 8280],
  ck: [6200, 6400, 6550, 6700, 6850, 7000, 7134, 7134],
};

const LABOR_WATERFALL = [
  { start: 6800, hire: 480, quit: -72, leave: -213, end: 6995 },
  { start: 6900, hire: 520, quit: -80, leave: -320, end: 7020 },
  { start: 7000, hire: 580, quit: -88, leave: -442, end: 7050 },
  { start: 7080, hire: 620, quit: -92, leave: -493, end: 7115 },
  { start: 7200, hire: 620, quit: -95, leave: -530, end: 7195 },
];

const ALL_KPI_ORDER = [
  'nsld',
  'satisfaction',
  'salary',
  'labor',
  'pc',
  'tv',
  'costLd',
  'costRtk',
  'costFlight',
  'costBh',
];

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function yearIdx(year) {
  return year - SERIES_START;
}

function valueAtYear(series, year) {
  const idx = year - SERIES_START;
  if (idx >= 0 && idx < series.length) return series[idx];
  const step = series[1] - series[0];
  return series[0] + idx * step;
}

function windowSeries(series, endYear, len = 5) {
  const startYear = endYear - len + 1;
  return Array.from({ length: len }, (_, i) => {
    const y = startYear + i;
    const v = valueAtYear(series, y);
    return typeof series[0] === 'number' && series[0] % 1 !== 0 ? round1(v) : Math.round(v);
  });
}

function windowLabels(endYear, len = 5) {
  const start = endYear - len + 1;
  return Array.from({ length: len }, (_, i) => String(start + i));
}

function longLabels(endYear, len = 8) {
  const start = endYear - len + 1;
  return Array.from({ length: len - 1 }, (_, i) => String(start + i)).concat(`${endYear}E`);
}

function scaleValues(values, factor) {
  return values.map((v) => {
    if (v == null) return null;
    const scaled = v * factor;
    return Number.isInteger(v) ? Math.round(scaled) : round1(scaled);
  });
}

function deriveKpi(metric, year) {
  const idx = yearIdx(year);
  const m = MASTER[metric];
  let actual = m.th[idx];
  let target = m.kh[idx];
  const prev = idx > 0 ? m.th[idx - 1] : null;

  if (m.kpiScale) {
    actual = round3(actual / m.kpiScale);
    target = round3(target / m.kpiScale);
  }

  const achieved = m.higherIsBetter ? actual >= target : actual <= target;
  let progress;
  if (m.higherIsBetter) {
    progress = Math.min(100, Math.round((actual / target) * 100));
  } else {
    progress = Math.min(100, Math.round((target / actual) * 100));
  }

  let trendDirection = 'flat';
  let trendValue = 0;
  if (prev != null) {
    const prevVal = m.kpiScale ? prev / m.kpiScale : prev;
    const diff = actual - prevVal;
    const pct = Math.abs((diff / prevVal) * 100);
    trendValue = round1(pct);
    if (Math.abs(diff) < 0.05) trendDirection = 'flat';
    else trendDirection = diff > 0 ? 'up' : 'down';
  }

  return {
    actual,
    target,
    progress,
    variant: achieved ? 'success' : 'warning',
    statusVi: achieved ? 'ĐẠT' : 'KHÔNG ĐẠT',
    statusEn: achieved ? 'ACHIEVED' : 'NOT ACHIEVED',
    trendDirection,
    trendValue,
  };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 4) + '\n');
}

function listJsonFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full, base));
    else if (entry.name.endsWith('.json')) out.push(path.relative(base, full));
  }
  return out;
}

function replaceYearText(str, year) {
  const prev = year - 1;
  const P = {
    thPrev: '<<TH_PREV>>',
    actualPrev: '<<ACTUAL_PREV>>',
    khPrev: '<<KH_PREV>>',
    planPrev: '<<PLAN_PREV>>',
  };

  let s = str
    .replace(/Actual 2025/g, P.actualPrev)
    .replace(/TH 2025/g, P.thPrev)
    .replace(/KH 2025/g, P.khPrev)
    .replace(/Plan 2025/g, P.planPrev);

  s = s
    .replace(/Y_2026/g, `Y_${year}`)
    .replace(/\(Năm 2026\)/g, `(Năm ${year})`)
    .replace(/\(Year 2026\)/g, `(Year ${year})`)
    .replace(/T04\/2026/g, `T04/${year}`)
    .replace(/4T\/2026/g, `4T/${year}`)
    .replace(/4TĐN \(Năm 2026\)/g, `4TĐN (Năm ${year})`)
    .replace(/Biến động LĐ 4T\/2026/g, `Biến động LĐ 4T/${year}`)
    .replace(/Labor movement Q2 2026/g, `Labor movement Q2 ${year}`)
    .replace(/VN vs ALS vs NN \(4T\/2026\)/g, `VN vs ALS vs NN (4T/${year})`)
    .replace(/TH 4T\/2026 \(Năm 2026\)/g, `TH 4T/${year} (Năm ${year})`)
    .replace(/TH 4T\/2026/g, `TH 4T/${year}`)
    .replace(/PCVN T04\/2026/g, `PCVN T04/${year}`)
    .replace(/PCNN T04\/2026/g, `PCNN T04/${year}`)
    .replace(/Giờ mức \(Năm 2026\)/g, `Giờ mức (Năm ${year})`)
    .replace(/Target \(Year 2026\)/g, `Target (Year ${year})`)
    .replace(/VN \(Năm 2026\)/g, `VN (Năm ${year})`)
    .replace(/ALS \(Năm 2026\)/g, `ALS (Năm ${year})`)
    .replace(/NN \(Năm 2026\)/g, `NN (Năm ${year})`)
    .replace(/KH tạm giao \(Năm 2026\)/g, `KH tạm giao (Năm ${year})`)
    .replace(/Interim plan \(Year 2026\)/g, `Interim plan (Year ${year})`)
    .replace(/Actual 4 months \(Year 2026\)/g, `Actual 4 months (Year ${year})`)
    .replace(/Labor productivity 2026/g, `Labor productivity ${year}`)
    .replace(/NSLĐ 2026/g, `NSLĐ ${year}`)
    .replace(/Actual 2026/g, `Actual ${year}`)
    .replace(/Plan 2026/g, `Plan ${year}`)
    .replace(/KH 2026/g, `KH ${year}`)
    .replace(/TH 2026/g, `TH ${year}`);

  return s
    .replace(new RegExp(P.actualPrev, 'g'), `Actual ${prev}`)
    .replace(new RegExp(P.thPrev, 'g'), `TH ${prev}`)
    .replace(new RegExp(P.khPrev, 'g'), `KH ${prev}`)
    .replace(new RegExp(P.planPrev, 'g'), `Plan ${prev}`);
}

function deepReplaceText(node, year) {
  if (typeof node === 'string') return replaceYearText(node, year);
  if (Array.isArray(node)) return node.map((item) => deepReplaceText(item, year));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = deepReplaceText(v, year);
    return out;
  }
  return node;
}

function isFiveYearLabels(labels) {
  return (
    Array.isArray(labels) &&
    labels.length === 5 &&
    labels.every((l, i) => l === String(SERIES_START + i))
  );
}

function isLongYearLabels(labels) {
  return (
    Array.isArray(labels) &&
    labels.length === 8 &&
    labels[0] === '2019' &&
    labels[labels.length - 1] === '2026E'
  );
}

function patchFiveYearChart(chart, year) {
  chart.labels = windowLabels(year);
  const title = chart.title?.keyVi || '';
  const metric = detectMetricFromChart(chart, title);
  if (metric && MASTER[metric]) {
    const m = MASTER[metric];
    for (const s of chart.data) {
      const keyVi = s.key?.keyVi || '';
      if (keyVi === 'Thực hiện' || keyVi.startsWith('TH ') || keyVi === 'PCVN TH' || keyVi === 'PCNN TH' || keyVi === 'TV TH') {
        if (metric === 'pc' && keyVi === 'PCVN TH') s.name = windowSeries(FIGHT_PC_TREND.pcvn, year);
        else if (metric === 'pc' && keyVi === 'PCNN TH') s.name = windowSeries(FIGHT_PC_TREND.pcnn, year);
        else if (metric === 'tv' && keyVi === 'TV TH') s.name = windowSeries(FIGHT_TV_TREND.th, year);
        else s.name = windowSeries(m.th, year);
        if (year < BASE_YEAR && metric === 'costLd') {
          const idx = yearIdx(year);
          s.name[4] = m.th[idx];
        }
      } else if (keyVi === 'Mục tiêu' || keyVi.startsWith('KH ') || keyVi === 'Giờ mức') {
        if (keyVi === 'Giờ mức') {
          if (title.includes('PC')) s.name = windowSeries(FIGHT_PC_TREND.target, year);
          else s.name = windowSeries(FIGHT_TV_TREND.target, year);
        } else {
          s.name = windowSeries(m.kh, year);
        }
      } else if (keyVi === '2019' || (keyVi.startsWith('TH ') && keyVi !== `TH ${year}`)) {
        if (m.baseline) s.name = windowSeries(m.baseline, year);
        else if (keyVi.startsWith('TH ')) s.name = windowSeries(m.th.map((v) => v * 0.85), year);
      }
    }
  } else if (title.includes('Heatmap')) {
    chart.labels = windowLabels(year);
    const heat = title.includes('TV') ? FIGHT_TV_HEATMAP : FIGHT_HEATMAP;
    chart.data.forEach((s) => {
      const k = s.key?.keyVi?.split(' ')[0];
      if (heat[k]) s.name = windowSeries(heat[k], year);
    });
  }
  return chart;
}

function detectMetricFromChart(chart, title) {
  if (title.includes('Năng suất') || title.includes('NSLĐ')) return 'nsld';
  if (title.includes('hài lòng')) return 'satisfaction';
  if (title.includes('lương') || title.includes('salary')) return 'salary';
  if (title.includes('Kế hoạch lao động') || title.includes('Labor plan')) return 'labor';
  if (title.includes('Phi công') || title.includes('Pilot')) return 'pc';
  if (title.includes('Tiếp viên') || title.includes('attendant')) return 'tv';
  if (title.includes('trên 1 lao động') || title.includes('per employee')) return 'costLd';
  if (title.includes('RTK')) return 'costRtk';
  if (title.includes('chuyến bay') || title.includes('per flight')) return 'costFlight';
  if (title.includes('BH') || title.includes('block hour')) return 'costBh';
  if (chart.subTitle?.keyVi?.includes('Giờ bay PC')) return 'pc';
  if (chart.subTitle?.keyVi?.includes('giờ bay TV')) return 'tv';
  return null;
}

function patchLongYearChart(chart, year) {
  chart.labels = longLabels(year);
  const len = 8;
  const startYear = year - len + 1;
  for (const s of chart.data) {
    if (!Array.isArray(s.name) || s.name.length !== 8) continue;
    const keyVi = s.key?.keyVi || '';
    if (keyVi.startsWith('TH ') || keyVi === 'PCVN' || keyVi === 'BĐH' || keyVi === 'Tiếp viên' || keyVi === 'LĐ mặt đất') {
      const src = keyVi.startsWith('TH ') ? (keyVi.includes('2026') ? LABOR_LONG.th : LABOR_LONG.ck) : s.name;
      s.name = Array.from({ length: len }, (_, i) => {
        const y = startYear + i;
        const baseIdx = y - 2019;
        if (baseIdx >= 0 && baseIdx < src.length) return src[baseIdx];
        const step = src[1] - src[0];
        return round1(src[0] + baseIdx * step);
      });
    } else if (keyVi.startsWith('KH ')) {
      s.name = Array.from({ length: len }, (_, i) => {
        const y = startYear + i;
        const baseIdx = y - 2019;
        if (baseIdx >= 0 && baseIdx < LABOR_LONG.kh.length) return LABOR_LONG.kh[baseIdx];
        const step = LABOR_LONG.kh[1] - LABOR_LONG.kh[0];
        return Math.round(LABOR_LONG.kh[0] + baseIdx * step);
      });
    }
  }
  return chart;
}

function patchBarSnapshot(chart, year, relPath) {
  const idx = yearIdx(year);
  const factor = 0.9 + idx * 0.025;

  if (relPath.includes('labor-productivity/chart/index1')) {
    chart.data[0].name = scaleValues(NSLD_DIV.th, 0.88 + idx * 0.03);
    chart.data[1].name = scaleValues(NSLD_DIV.kh, 0.88 + idx * 0.03);
    chart.data[2].name = scaleValues(NSLD_DIV.ck, 0.88 + Math.max(0, idx - 1) * 0.03);
  }

  if (relPath.includes('labor-productivity/chart/index2')) {
    const th = MASTER.nsld.th[idx];
    const kh = MASTER.nsld.kh[idx];
    chart.data[0].name = [th, kh];
  }

  if (relPath.includes('labor/chart/index3')) {
    const wf = LABOR_WATERFALL[idx];
    chart.data[0].name = [wf.start, wf.hire, -Math.abs(wf.quit), -Math.abs(wf.leave), wf.end];
  }

  if (relPath.includes('fight-time/chart/index1')) {
    chart.data[0].name = scaleValues(chart.data[0].name, factor);
    chart.data[1].name = chart.data[1].name.map((v) => (v == null ? null : round1(v * factor)));
    chart.data[2].name = chart.data[2].name.map((v) => round1(v * (0.95 + idx * 0.01)));
  }

  if (relPath.includes('fight-time/chart/index2')) {
    chart.data[0].name = scaleValues(chart.data[0].name, factor);
    chart.data[1].name = chart.data[1].name.map((v) => round1(v * (0.95 + idx * 0.01)));
  }

  if (relPath.includes('fight-time/chart/index5')) {
    chart.data.forEach((s, i) => {
      if (i < 3) s.name = scaleValues(s.name, factor);
    });
  }

  if (relPath.includes('fight-time/chart/index6')) {
    chart.data[0].name = scaleValues([72, 70, 65], factor);
  }

  if (relPath.includes('labor-cost/chart/index0')) {
    const scale = 0.85 + idx * 0.04;
    chart.data[0].name = [round1(18.5 * scale), Math.round(2850 * scale), round1(32.4 * scale), round1(8.2 * scale)];
    chart.data[1].name = [round1(20.2 * scale), Math.round(3100 * scale), round1(35.8 * scale), round1(9.1 * scale)];
  }

  return chart;
}

function buildKpis(templateKpis, year, kpiOrder) {
  return templateKpis.map((item, i) => {
    const metric = kpiOrder[i];
    const derived = deriveKpi(metric, year);
    const out = { ...item };
    out.actual = derived.actual;
    out.target = derived.target;
    out.progress = derived.progress;
    out.variant = derived.variant;
    out.statusLabel = { keyVi: derived.statusVi, keyEn: derived.statusEn };
    out.trendDirection = derived.trendDirection;
    out.trendValue = derived.trendValue;
    return out;
  });
}

function transformFile(relPath, year, template, kpiOrder) {
  const full = path.join(template, relPath);
  let data = readJson(full);

  if (relPath === 'overview/index.json') {
    return data;
  }

  data = deepReplaceText(data, year);

  if (relPath.startsWith('kpis/')) {
    return buildKpis(data, year, kpiOrder);
  }

  if (relPath.includes('/chart/')) {
    if (isFiveYearLabels(data.labels)) data = patchFiveYearChart(data, year);
    if (isLongYearLabels(data.labels)) data = patchLongYearChart(data, year);
    data = patchBarSnapshot(data, year, relPath);

    if (relPath.includes('labor-productivity/chart/index0')) {
      data.data[0].name = windowSeries(MASTER.nsld.th, year);
      data.data[1].name = windowSeries(MASTER.nsld.kh, year);
      data.data[2].name = windowSeries(MASTER.nsld.th.map((v) => v * 0.78), year);
    }
  }

  return data;
}

function generateOrg(org) {
  const yRoot = path.join(__dirname, '../ApiV2/TCNL', org, 'Y');
  const template = path.join(yRoot, 'Y_2026');

  if (!fs.existsSync(template)) {
    console.error(`Skip ${org}: template not found at ${template}`);
    return;
  }

  const kpiOrder = ALL_KPI_ORDER.slice(0, readJson(path.join(template, 'kpis/all/index.json')).length);
  const files = listJsonFiles(template);

  console.log(`Generating ${org} Y_2022 .. Y_2025 (${files.length} files/year)...`);

  for (const year of TARGET_YEARS) {
    const outDir = path.join(yRoot, `Y_${year}`);
    console.log(`  ${org} Y_${year}...`);

    for (const rel of files) {
      const data = transformFile(rel, year, template, kpiOrder);
      writeJson(path.join(outDir, rel), data);
    }

    const nsld = deriveKpi('nsld', year);
    console.log(
      `    NSLĐ=${nsld.actual} PC=${deriveKpi('pc', year).actual} LĐ=${deriveKpi('labor', year).actual}`
    );
  }
}

for (const org of ORGS) {
  generateOrg(org);
}

console.log('Done.');

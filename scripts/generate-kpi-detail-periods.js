/**
 * Generates the full period matrix (52 weeks, 12 months, 4 quarters) for every
 * KPI_Detail/{code} fixture, deriving all values from the existing M_12 template
 * (single source of truth) instead of hand-authoring each period.
 *
 * For CPM-002/CPM-005 (the two forecast-bearing metrics), the "Thực tế + Dự báo"
 * series' actual/forecast split point is recomputed per period instance to match
 * that instance's own position in the year (W_5 -> solid weeks 1-5, dashed 6-52).
 * CPM-001/CPM-004 have no forecast series, so their time-series charts are
 * identical across every period of a granularity.
 *
 * Usage: node scripts/generate-kpi-detail-periods.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'ApiV2', 'demoV2', 'BGD', 'KPI_Detail');
const N_MONTHS = 12;

// Chart `child` links must point at the published raw.github fixtures, not a local dev server —
// matches vna-demo's .env `VITE_API_BASE` (the non-.env.local, "real" base).
const RAW_GITHUB_BASE = 'https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main';

const GRANULARITIES = [
  { key: 'M', prefix: 'M', count: 12, axisPrefix: 'T' },
  { key: 'W', prefix: 'W', count: 52, axisPrefix: 'W' },
  { key: 'Q', prefix: 'Q', count: 4, axisPrefix: 'Q' },
];

// slots: which chart indices are "theo thời gian" trend charts, paired with their
// cumulative ("lũy kế") counterpart when one exists.
const CODES = {
  'CPM-002': {
    hasForecast: true,
    aggregate: 'sum',
    slots: [
      { chartIdx: 0, cumIdx: 1 },
      { chartIdx: 2, cumIdx: 3 },
      { chartIdx: 4, cumIdx: 5 },
    ],
    invariantCharts: [6, 7, 8],
  },
  'CPM-005': {
    hasForecast: true,
    aggregate: 'sum',
    slots: [
      { chartIdx: 0, cumIdx: 1 },
      { chartIdx: 2, cumIdx: 3 },
      { chartIdx: 4, cumIdx: 5 },
    ],
    invariantCharts: [6, 7, 8],
  },
  'CPM-001': {
    hasForecast: false,
    aggregate: 'avg',
    slots: [{ chartIdx: 0 }, { chartIdx: 1 }, { chartIdx: 2 }],
    invariantCharts: [],
  },
  'CPM-004': {
    hasForecast: false,
    aggregate: 'avg',
    slots: [{ chartIdx: 0 }, { chartIdx: 1 }, { chartIdx: 2 }],
    invariantCharts: [3, 4, 5],
  },
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 4)}\n`, 'utf8');
}

function round(n) {
  return Math.round(n);
}

// --- derive week/quarter series from the 12 monthly points -----------------

function interpolateWeeks(monthly) {
  const lo = Math.min(...monthly);
  const hi = Math.max(...monthly);
  const amp = Math.max(1, (hi - lo) * 0.08);
  const seed = monthly.reduce((a, b) => a + b, 0) * 0.001;
  const out = [];
  for (let w = 0; w < 52; w += 1) {
    const t = (w * (N_MONTHS - 1)) / 51;
    const i0 = Math.floor(t);
    const i1 = Math.min(i0 + 1, N_MONTHS - 1);
    const frac = t - i0;
    const base = monthly[i0] * (1 - frac) + monthly[i1] * frac;
    const jitter = amp * Math.sin(w * 1.31 + seed);
    out.push(round(base + jitter));
  }
  return out;
}

function aggregateQuarters(monthly, mode) {
  const out = [];
  for (let q = 0; q < 4; q += 1) {
    const chunk = monthly.slice(q * 3, q * 3 + 3);
    const sum = chunk.reduce((a, b) => a + b, 0);
    out.push(round(mode === 'sum' ? sum : sum / chunk.length));
  }
  return out;
}

function rampToTotal(total, n) {
  return Array.from({ length: n }, (_, i) => round((total * (i + 1)) / n));
}

// --- templates: read the M_12 source-of-truth ONCE per code, before any file
// in that tree gets wiped by generatePeriod (M_12 itself is regenerated too). --

function monthlyChartPath(code, chartIdx) {
  return path.join(ROOT, code, 'M', 'M_12', 'chart', `index${chartIdx}.json`);
}

function loadTemplates(code, spec) {
  const chartIndices = new Set();
  for (const slot of spec.slots) {
    chartIndices.add(slot.chartIdx);
    if (slot.cumIdx != null) chartIndices.add(slot.cumIdx);
  }
  for (const chartIdx of spec.invariantCharts) chartIndices.add(chartIdx);

  const charts = {};
  for (const chartIdx of chartIndices) {
    charts[chartIdx] = readJson(monthlyChartPath(code, chartIdx));
  }

  return {
    indexJson: readJson(path.join(ROOT, code, 'M', 'M_12', 'index.json')),
    charts,
  };
}

// --- per-code dataset (computed once, cached, reused across every period) --

function buildDataset(spec, templates) {
  const dataset = { M: {}, W: {}, Q: {} };

  for (const slot of spec.slots) {
    const perSeriesMonthly = templates.charts[slot.chartIdx].data.map((s) => s.name);

    dataset.M[slot.chartIdx] = perSeriesMonthly;
    dataset.W[slot.chartIdx] = perSeriesMonthly.map(interpolateWeeks);
    dataset.Q[slot.chartIdx] = perSeriesMonthly.map((values) => aggregateQuarters(values, spec.aggregate));

    if (slot.cumIdx != null) {
      const totals = templates.charts[slot.cumIdx].data.map((s) => s.name[s.name.length - 1]);
      dataset.M[slot.cumIdx] = totals.map((total) => rampToTotal(total, 12));
      dataset.W[slot.cumIdx] = totals.map((total) => rampToTotal(total, 52));
      dataset.Q[slot.cumIdx] = totals.map((total) => rampToTotal(total, 4));
    }
  }

  return dataset;
}

// --- split computation (only forecast-bearing codes' time-series charts) ---

function computeSplit(n, total) {
  const color = Array.from({ length: total }, (_, i) => (i < n ? '#2d6a9f' : '#95a5a6'));
  const borderDash = Array.from({ length: total }, (_, i) => (i < n ? null : [6, 3]));
  return { color, borderDash };
}

function axisLabel(gran, n) {
  return `${gran.axisPrefix}${n}`;
}

function fixText(text, gran, n, hasForecast) {
  if (typeof text !== 'string') return text;
  let out = text.replace('theo tháng', gran.key === 'M' ? 'theo tháng' : gran.key === 'W' ? 'theo tuần' : 'theo quý');
  if (hasForecast) {
    const label = axisLabel(gran, n);
    out = out.replace(/\(đến [^)]+\)/, `(đến ${label})`).replace(/\(từ [^)]+\)/, `(từ ${label})`);
  }
  return out;
}

// --- chart file builder ------------------------------------------------

function buildChartFile(spec, gran, n, chartIdx, dataset, templates, isCumulative) {
  const template = templates.charts[chartIdx];
  const labels = Array.from({ length: gran.count }, (_, i) => axisLabel(gran, i + 1));
  const seriesValues = dataset[gran.key][chartIdx];

  const chart = {
    ...template,
    labels,
    data: template.data.map((series, i) => {
      const next = { ...series, name: seriesValues[i] };
      const isPerPointStyled = Array.isArray(series.color) && series.color.length === N_MONTHS;
      if (spec.hasForecast && isPerPointStyled) {
        const { color, borderDash } = computeSplit(n, gran.count);
        next.color = color;
        next.borderDash = borderDash;
      }
      return next;
    }),
  };

  chart.title = fixText(chart.title, gran, n, spec.hasForecast && isCumulative === false);
  chart.subTitle = fixText(chart.subTitle, gran, n, spec.hasForecast);

  return chart;
}

function buildInvariantChartFile(chartIdx, templates) {
  return templates.charts[chartIdx];
}

// --- index.json builder --------------------------------------------------

function buildIndexJson(code, gran, n, templates) {
  const template = templates.indexJson;
  const periodSegment = `${gran.key}/${gran.key}_${n}`;
  const wordFor = gran.key === 'M' ? 'theo tháng' : gran.key === 'W' ? 'theo tuần' : 'theo quý';

  const index = JSON.parse(JSON.stringify(template));
  for (const section of index.data) {
    for (const item of section.child) {
      if (typeof item.title === 'string') item.title = item.title.replace('theo tháng', wordFor);
      if (typeof item.subTitle === 'string') item.subTitle = item.subTitle.replace('theo tháng', wordFor);
      if (typeof item.child === 'string') {
        const relPath = item.child
          .replace(/^https?:\/\/[^/]+/, '')
          .replace(`/${code}/M/M_12/`, `/${code}/${periodSegment}/`);
        item.child = `${RAW_GITHUB_BASE}${relPath}`;
      }
    }
  }
  return index;
}

// --- driver ----------------------------------------------------------------

function generatePeriod(code, spec, gran, n, dataset, templates) {
  const periodDir = path.join(ROOT, code, gran.key, `${gran.key}_${n}`);
  fs.rmSync(periodDir, { recursive: true, force: true });

  writeJson(path.join(periodDir, 'index.json'), buildIndexJson(code, gran, n, templates));

  for (const slot of spec.slots) {
    writeJson(
      path.join(periodDir, 'chart', `index${slot.chartIdx}.json`),
      buildChartFile(spec, gran, n, slot.chartIdx, dataset, templates, false),
    );
    if (slot.cumIdx != null) {
      writeJson(
        path.join(periodDir, 'chart', `index${slot.cumIdx}.json`),
        buildChartFile(spec, gran, n, slot.cumIdx, dataset, templates, true),
      );
    }
  }

  for (const chartIdx of spec.invariantCharts) {
    writeJson(path.join(periodDir, 'chart', `index${chartIdx}.json`), buildInvariantChartFile(chartIdx, templates));
  }
}

function main() {
  let fileCount = 0;
  for (const [code, spec] of Object.entries(CODES)) {
    const templates = loadTemplates(code, spec);
    const dataset = buildDataset(spec, templates);
    for (const gran of GRANULARITIES) {
      for (let n = 1; n <= gran.count; n += 1) {
        generatePeriod(code, spec, gran, n, dataset, templates);
        fileCount += 1 + spec.slots.length * (spec.slots[0].cumIdx != null ? 2 : 1) + spec.invariantCharts.length;
      }
    }
    console.log(`${code}: done`);
  }
  console.log(`Generated ~${fileCount} files`);
}

main();

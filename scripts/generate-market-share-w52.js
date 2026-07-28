const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'apiV5', 'domain', 'ceo-command-center', 'market-share', '2026', 'W31');
const CHART_DIR = path.join(BASE, 'chart');
const INDEX_FILE = path.join(BASE, 'index.json');
const BAK_DIR = path.join(BASE, '.bak');

const CROSS_SECTIONAL_TYPES = new Set(['donut-pct', 'treemap', 'sunburst', 'heatmap', 'bar-h', 'bar-h-stacked']);

const CARRIER_IDS = new Set(['vn', 'bl', 'vj', 'qh', 'vu', 'vna_gr', 'g9']);

function isTimeSeries(data) {
  const ac = data.autoChart;
  if (!ac || !ac.views || !ac.views[0]) return false;
  if (CROSS_SECTIONAL_TYPES.has(ac.chartType)) return false;
  const view = ac.views[0];
  const xf = view.xField;
  if (!xf) return false;
  if (['country', 'region', 'route', 'label', 'name', 'y'].includes(xf)) return false;
  const rows = ac.dataset && ac.dataset.rows;
  if (!rows || rows.length === 0) return false;
  const first = String(rows[0][0] || '');
  return /^W\d+$/.test(first) || /^T\d+$/.test(first);
}

function detectSchemaType(columns) {
  const ids = columns.map(c => c.id);
  const hasCarrier = ids.some(id => CARRIER_IDS.has(id));
  if (hasCarrier) return 'carrier';
  if (ids.includes('th_2026') && ids.includes('th_2025')) return 'qt';
  const hasTh = ids.includes('th');
  const hasCk = ids.includes('ck');
  const hasDb = ids.includes('db');
  const hasFct = ids.includes('fct');
  if (hasTh && hasCk && hasDb) return hasFct ? 'standard' : 'standard_nofct';
  if (hasTh && hasCk) return 'simple';
  return 'standard';
}

function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateRows(columns, existingRows) {
  const schemaType = detectSchemaType(columns);
  const numCols = columns.length;
  const lkIndices = new Set();
  const nonLkIndices = [];
  const lkToBase = {};

  for (let i = 0; i < numCols; i++) {
    const id = columns[i].id;
    if (id.endsWith('_lk')) {
      lkIndices.add(i);
      const baseId = id.slice(0, -3);
      const baseIdx = columns.findIndex(c => c.id === baseId);
      if (baseIdx !== -1) lkToBase[i] = baseIdx;
    }
    if (!lkIndices.has(i)) nonLkIndices.push(i);
  }

  const baseValues = [];
  for (let i = 1; i < numCols; i++) {
    const vals = existingRows.map(r => r[i]).filter(v => v !== null && v !== undefined && typeof v === 'number');
    baseValues.push(vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 1);
  }

  const runningSums = new Array(numCols).fill(0);
  const rows = [];

  for (let w = 1; w <= 52; w++) {
    const row = [`W${w}`];
    const rng = seededRand(w * 9973 + 7919);
    let colIdx = 1;

    for (let i = 1; i < numCols; i++) {
      const isLk = lkIndices.has(i);
      const id = columns[i].id;

      if (isLk) {
        const baseIdx = lkToBase[i];
        const sum = baseIdx !== undefined ? runningSums[baseIdx] : 0;
        row.push(Math.round(sum * 100) / 100);
      } else {
        let val = null;

        if (schemaType === 'standard' || schemaType === 'standard_nofct') {
          if (id === 'th') {
            val = (w <= 31) ? generateValue(baseValues, colIdx, w, rng) : null;
          } else if (id === 'ck') {
            val = generateValue(baseValues, colIdx, w, rng);
          } else if (id === 'db') {
            val = (w <= 30) ? generateValue(baseValues, colIdx, w, rng) : null;
          } else if (id === 'db_fct') {
            val = (w >= 31) ? generateValue(baseValues, colIdx, w, rng) : null;
          } else if (id === 'fct') {
            val = (w >= 31 && w <= 41) ? generateValue(baseValues, colIdx, w, rng) : null;
          } else {
            val = generateValue(baseValues, colIdx, w, rng);
          }
        } else if (schemaType === 'simple') {
          if (id === 'th') {
            val = (w <= 31) ? generateValue(baseValues, colIdx, w, rng) : null;
          } else if (id === 'ck') {
            val = generateValue(baseValues, colIdx, w, rng);
          } else {
            val = generateValue(baseValues, colIdx, w, rng);
          }
        } else if (schemaType === 'qt') {
          if (id === 'th_2026') {
            val = (w <= 31) ? generateValue(baseValues, colIdx, w, rng) : null;
          } else if (id === 'th_2025') {
            val = generateValue(baseValues, colIdx, w, rng);
          } else {
            val = generateValue(baseValues, colIdx, w, rng);
          }
        } else {
          val = generateValue(baseValues, colIdx, w, rng);
        }

        row.push(val);
        if (val !== null) {
          runningSums[i] += val;
        }
        colIdx++;
      }
    }
    rows.push(row);
  }
  return rows;
}

function generateValue(baseValues, colIdx, w, rng) {
  const base = baseValues[colIdx - 1] || 1;
  const trend = Math.sin((w - 1) / 51 * Math.PI * 2) * 0.08;
  const noise = (rng() - 0.5) * 0.25;
  let val = Math.round(base * (1 + trend + noise) * 100) / 100;
  if (val < 0) val = Math.abs(val) * 0.1;
  return val;
}

function addDbFctColumns(data) {
  const ac = data.autoChart;
  const columns = ac.dataset.columns;

  const hasDbFct = columns.some(c => c.id === 'db_fct');
  if (hasDbFct) return;

  const dbIdx = columns.findIndex(c => c.id === 'db');
  const dbLkIdx = columns.findIndex(c => c.id === 'db_lk');

  if (dbIdx === -1) return;

  const dbFctCol = {
    id: 'db_fct',
    type: 'number',
    label: 'KH 2026 (FCT)',
    colorToken: 'series.target'
  };

  const dbFctLkCol = {
    id: 'db_fct_lk',
    type: 'number',
    label: 'KH 2026 (FCT)',
    colorToken: 'series.target'
  };

  const fctIdx = columns.findIndex(c => c.id === 'fct');
  const insertAfter = fctIdx !== -1 ? fctIdx : dbIdx;

  columns.splice(insertAfter + 1, 0, dbFctCol);

  const fctLkIdx = columns.findIndex(c => c.id === 'fct_lk');
  if (fctLkIdx !== -1) {
    columns.splice(fctLkIdx + 1, 0, dbFctLkCol);
  } else if (dbLkIdx !== -1) {
    columns.splice(dbLkIdx + 1, 0, dbFctLkCol);
  } else {
    columns.push(dbFctLkCol);
  }
}

function addDbFctSeries(data) {
  const ac = data.autoChart;
  const view = ac.views[0];
  if (!view || !view.series) return;

  const hasDbFctSeries = view.series.some(s => s.field === 'db_fct');
  if (hasDbFctSeries) return;

  const dbSeriesIdx = view.series.findIndex(s => s.field === 'db');
  if (dbSeriesIdx === -1) return;

  const dbFctSeries = JSON.parse(JSON.stringify(view.series[dbSeriesIdx]));
  dbFctSeries.field = 'db_fct';
  dbFctSeries.lineStyle = 'dashed';

  const fctSeriesIdx = view.series.findIndex(s => s.field === 'fct');
  const insertAfter = fctSeriesIdx !== -1 ? fctSeriesIdx : dbSeriesIdx;
  view.series.splice(insertAfter + 1, 0, dbFctSeries);
}

function convertToLine(data) {
  const ac = data.autoChart;
  const view = ac.views[0];
  let allLine = true;
  for (const s of view.series) {
    if (s.chartType === 'bar' || s.chartType === 'combo') s.chartType = 'line';
    if (s.chartType !== 'line') allLine = false;
    delete s.barOpacity;
  }
  if (allLine) ac.chartType = 'line';
  delete view.stack;
  delete view.labelInside;
}

function processFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  if (!isTimeSeries(data)) return { changed: false };
  const ac = data.autoChart;
  const schemaType = detectSchemaType(ac.dataset.columns);

  if (schemaType === 'standard' || schemaType === 'standard_nofct') {
    addDbFctColumns(data);
    addDbFctSeries(data);
  }

  ac.dataset.rows = generateRows(ac.dataset.columns, ac.dataset.rows);
  convertToLine(data);
  return { changed: true, data };
}

function main() {
  if (!fs.existsSync(BAK_DIR)) fs.mkdirSync(BAK_DIR, { recursive: true });

  const files = fs.readdirSync(CHART_DIR).filter(f => f.endsWith('.json'));
  const errors = [];
  let changed = 0;

  for (const f of files) {
    fs.copyFileSync(path.join(CHART_DIR, f), path.join(BAK_DIR, f));
  }

  for (const f of files) {
    const fp = path.join(CHART_DIR, f);
    try {
      const r = processFile(fp);
      if (r.changed) {
        fs.writeFileSync(fp, JSON.stringify(r.data, null, 2) + '\n');
        changed++;
      }
    } catch (e) {
      errors.push(`${f}: ${e.message}`);
    }
  }

  let valErrors = 0;
  for (const f of files) {
    try { JSON.parse(fs.readFileSync(path.join(CHART_DIR, f), 'utf-8')); }
    catch (e) { valErrors++; errors.push(`Validation fail ${f}: ${e.message}`); }
  }

  console.log('=== Market Share W1-W52 Transformation Report ===');
  console.log(`Files changed: ${changed}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Validation errors: ${valErrors}`);
  console.log(`Backup: ${BAK_DIR}`);
  errors.forEach(e => console.log(`  ERR: ${e}`));
  console.log('================================================');
}

main();

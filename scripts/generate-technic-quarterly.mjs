import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

const BASE = join(import.meta.dirname, '..', 'apiV5', 'domain', 'bod-strategic-dashboards', 'technic', '2026');
const MONTH = '07';
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const monthRanges = {
  Q1: { months: ['T1', 'T2', 'T3'], label: 'Quý 1', rowLabel: 'Q1' },
  Q2: { months: ['T4', 'T5', 'T6'], label: 'Quý 2', rowLabel: 'Q2' },
  Q3: { months: ['T7', 'T8', 'T9'], label: 'Quý 3', rowLabel: 'Q3' },
  Q4: { months: ['T10', 'T11', 'T12'], label: 'Quý 4', rowLabel: 'Q4' },
};

function avg(values) {
  const valid = values.filter(v => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 100) / 100;
}

function sum(values) {
  const valid = values.filter(v => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) * 100) / 100;
}

function last(values) {
  const valid = values.filter(v => v !== null && v !== undefined);
  return valid.length > 0 ? valid[valid.length - 1] : null;
}

function aggregateRows(rows, valueIndices, aggFn, monthMap = null) {
  const result = {};
  for (const qKey of Object.keys(monthRanges)) {
    const { months } = monthRanges[qKey];
    const values = valueIndices.map(idx => {
      const vals = months.map(m => {
        const row = rows.find(r => r[0] === m);
        return row ? row[idx] : null;
      });
      return aggFn(vals);
    });
    const label = monthMap ? monthMap[qKey] : qKey;
    result[qKey] = [label, ...values.map(v => v !== null && v !== undefined ? v : null)];
  }
  return result;
}

// Read source data
function readJSON(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function monthHasActual(rows, month) {
  const row = rows.find(r => r[0] === month);
  if (!row) return false;
  for (let i = 1; i < row.length; i++) {
    if (row[i] !== null && row[i] !== undefined) return true;
  }
  return false;
}

// Count how many months in a quarter have actual data
function quarterActualCount(quarterMonths, rows) {
  return quarterMonths.filter(m => monthHasActual(rows, m)).length;
}

const chartDir = join(BASE, MONTH, 'chart');
const chartFiles = existsSync(chartDir) ? readdirSync(chartDir).filter(f => f.endsWith('.json')) : [];

// For each chart file, determine if it has monthly rows and aggregate accordingly
for (const q of QUARTERS) {
  const qDir = join(BASE, q);
  const qChartDir = join(qDir, 'chart');
  mkdirSync(qChartDir, { recursive: true });
}

// Process each chart file
for (const chartFile of chartFiles) {
  const srcPath = join(chartDir, chartFile);
  const data = readJSON(srcPath);

  // Deep clone for modification
  const processed = JSON.parse(JSON.stringify(data));

  // Check if this chart has datasets with monthly rows
  let hasMonthlyRows = false;

  // Function to process a dataset
  function processDataset(dataset) {
    if (!dataset || !dataset.rows || !dataset.columns) return;

    const monthCol = dataset.columns.findIndex(c => c.id === 'month');
    if (monthCol === -1) return;

    // Check if rows have month-like labels (T1, T2, etc.)
    const firstRowLabel = dataset.rows[0]?.[0];
    if (!firstRowLabel?.startsWith('T')) return;

    hasMonthlyRows = true;

    // Get all value column indices (after month)
    const valueIndices = [];
    for (let i = 1; i < dataset.columns.length; i++) {
      valueIndices.push(i);
    }

    // Determine aggregation function based on context
    // For rates (ARL, DR, OCR percentage): average
    // For counts (delay count, AOG count): sum
    // For cumulative: last value
    let aggFn = avg;
    if (chartFile.includes('aog_tech')) aggFn = sum;
    if (chartFile.includes('delay_stats')) aggFn = avg; // avg delay count

    // For most monthly metrics, use avg (ARL, DR, OCR, MC/ASK are rates)
    if (chartFile.includes('arl') || chartFile.includes('dr') || chartFile.includes('ocr') || chartFile.includes('mc_ask')) {
      aggFn = avg;
    }
    if (chartFile.includes('aog_tech')) aggFn = sum;

    // For cumulative columns (th_lk, db_lk, ck_lk), use last value
    const cumulativeCols = new Set();
    dataset.columns.forEach((col, idx) => {
      if (col.id?.endsWith('_lk') || col.id?.endsWith('_luy_ke') || col.id?.includes('luyke')) {
        cumulativeCols.add(idx);
      }
    });

    const newRows = [];
    for (const qKey of Object.keys(monthRanges)) {
      const { months, rowLabel } = monthRanges[qKey];
      const newRow = [rowLabel];

      for (let i = 1; i < dataset.columns.length; i++) {
        const values = months.map(m => {
          const row = dataset.rows.find(r => r[0] === m);
          return row ? row[i] : null;
        });

        let val;
        if (cumulativeCols.has(i)) {
          val = last(values);
        } else {
          val = aggFn(values);
        }
        newRow.push(val !== null && val !== undefined ? Math.round(val * 100) / 100 : null);
      }
      newRows.push(newRow);
    }

    dataset.rows = newRows;
  }

  // Process main dataset
  if (processed.autoChart?.dataset) {
    processDataset(processed.autoChart.dataset);
  }

  // Process views (nested datasets like mc_ask with fleet views)
  if (processed.autoChart?.views) {
    for (const view of processed.autoChart.views) {
      if (view.autoChart?.dataset) {
        processDataset(view.autoChart.dataset);
      }
    }
  }

  // Process headerAction views
  if (processed.autoChart?.headerAction?.views) {
    for (const view of processed.autoChart.headerAction.views) {
      if (view.autoChart?.dataset) {
        processDataset(view.autoChart.dataset);
      }
    }
  }

  // For views at the top level of the chart (like mc_ask_dept)
  if (processed.views) {
    for (const view of processed.views) {
      if (view.autoChart?.dataset) {
        processDataset(view.autoChart.dataset);
      }
    }
  }

  // Special: the index.json has inline data in views with headerAction
  // These are handled separately in the index.json processing

  // Remove forecastStartIndex metadata if present (not relevant for quarterly)
  if (processed.metadata?.forecastStartIndex !== undefined) {
    delete processed.metadata;
  }

  // Write to all quarters
  for (const q of QUARTERS) {
    const destPath = join(BASE, q, 'chart', chartFile);
    writeJSON(destPath, processed);
  }

  console.log(`  ${chartFile} ${hasMonthlyRows ? '(aggregated monthly→quarterly)' : '(static, copied as-is)'}`);
}

// Reusable function to process inline datasets (not tied to chartFile context)
function processInlineDataset(dataset) {
  if (!dataset || !dataset.rows || !dataset.columns) return false;
  const monthCol = dataset.columns.findIndex(c => c.id === 'month');
  if (monthCol === -1) return false;
  const firstRowLabel = dataset.rows[0]?.[0];
  if (!firstRowLabel?.startsWith('T')) return false;

  const cumulativeCols = new Set();
  dataset.columns.forEach((col, idx) => {
    if (col.id?.endsWith('_lk') || col.id?.endsWith('_luy_ke') || col.id?.includes('luyke')) {
      cumulativeCols.add(idx);
    }
  });

  // Determine agg function based on column count/type
  const newRows = [];
  for (const qKey of Object.keys(monthRanges)) {
    const { months, rowLabel } = monthRanges[qKey];
    const newRow = [rowLabel];

    for (let i = 1; i < dataset.columns.length; i++) {
      const values = months.map(m => {
        const row = dataset.rows.find(r => r[0] === m);
        return row ? row[i] : null;
      });
      let val;
      if (cumulativeCols.has(i)) {
        val = last(values);
      } else {
        val = avg(values);
      }
      newRow.push(val !== null && val !== undefined ? Math.round(val * 100) / 100 : null);
    }
    newRows.push(newRow);
  }
  dataset.rows = newRows;
  return true;
}

// Now process index.json
console.log('\nGenerating index.json for each quarter...');
const srcIndex = readJSON(join(BASE, MONTH, 'index.json'));

for (const q of QUARTERS) {
  const indexData = JSON.parse(JSON.stringify(srcIndex));

  // Update timeFrameHiddenModes to NOT hide quarter
  // Keep day, week, year, custom hidden but allow quarter and month
  indexData.timeFrameHiddenModes = ['day', 'week', 'year', 'custom'];

  // Update all chart paths to point to quarterly folder
  function updateChartPaths(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.chartPath && typeof obj.chartPath === 'string') {
      obj.chartPath = obj.chartPath.replace(`/${MONTH}/`, `/${q}/`);
    }
    for (const key of Object.keys(obj)) {
      updateChartPaths(obj[key]);
    }
  }
  updateChartPaths(indexData);

  // Process inline datasets in chartBoard views (e.g., mc_ask fleet views, mc_ask_dept)
  for (const section of indexData.chartBoard || []) {
    for (const item of section.items || []) {
      // Process views at item level (like chart_mc_ask fleet views)
      if (item.views) {
        for (const view of item.views) {
          if (view.autoChart?.dataset) {
            processInlineDataset(view.autoChart.dataset);
          }
        }
      }
    }
  }

  // Update metric cards for the quarter context
  // The metric cards already point to paths that don't need changing

  // Update table summary data (ARL, DR fleet tables)
  // These are static snapshot values, keep them as-is from month 07
  // but update the titles to reflect quarterly

  // Update insight cards for quarterly context
  if (indexData.insightCards?.insight?.items) {
    indexData.insightCards.insight.items = indexData.insightCards.insight.items.map(item =>
      item.replace(/tháng/g, 'quý')
    );
  }

  // Update metric card sparklines to have fewer data points (quarterly instead of monthly)
  // Keep the last 4 values as a mini sparkline
  for (const item of indexData.metricCards?.items || []) {
    if (item.visualization?.type === 'sparkline' && item.visualization.data) {
      // Keep last 4 values for a compact quarterly sparkline
      // Represent quarterly trend
      const data = item.visualization.data;
      if (data.length > 4) {
        // Take roughly evenly spaced samples
        const step = Math.max(1, Math.floor(data.length / 4));
        const sampled = [];
        for (let i = 0; i < data.length && sampled.length < 4; i += step) {
          sampled.push(data[i]);
        }
        // Always include last value
        if (sampled[sampled.length - 1] !== data[data.length - 1]) {
          sampled.push(data[data.length - 1]);
        }
        item.visualization.data = sampled;
      }
    }
  }

  // Update cardHtml section description if present
  if (indexData.cardHtml) {
    if (typeof indexData.cardHtml === 'string') {
      indexData.cardHtml = indexData.cardHtml.replace(/tháng/g, 'quý');
    } else if (typeof indexData.cardHtml === 'object') {
      const str = JSON.stringify(indexData.cardHtml);
      const updated = str.replace(/tháng/g, 'quý');
      indexData.cardHtml = JSON.parse(updated);
    }
  }

  // Write index.json
  const destPath = join(BASE, q, 'index.json');
  writeJSON(destPath, indexData);
  console.log(`  index.json → ${q}/`);
}

console.log('\n✅ Quarterly data generated successfully!');

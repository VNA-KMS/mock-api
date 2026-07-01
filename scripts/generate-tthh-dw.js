#!/usr/bin/env node
/**
 * Generate TTHH weekly (W_1..W_52) and daily (D_1..D_31) mock data.
 */

const path = require('path');
const {
  WEEKS_IN_YEAR,
  DAYS_IN_MONTH,
  buildWeeklySeries,
  buildDailySeries,
  generatePeriod,
  weekCtx,
  dayCtx,
  kpiMetrics,
} = require('./tthh-period-lib');

const TTHH_ROOT = path.join(__dirname, '../ApiV2/CMDV/CQDV/TTHH');
const TEMPLATE = path.join(TTHH_ROOT, 'M/M_12');
const W_SERIES = buildWeeklySeries();
const D_SERIES = buildDailySeries();

console.log('Generating TTHH W_52 .. W_1 ...');
for (let w = WEEKS_IN_YEAR; w >= 1; w--) {
  const ctx = weekCtx(
    w,
    TEMPLATE,
    path.join(TTHH_ROOT, 'W'),
    `https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main/ApiV2/CMDV/CQDV/TTHH/W/W_${w}`,
  );
  ctx.verbose = w % 13 === 0 || w === 1;
  generatePeriod(ctx, W_SERIES);
  if (ctx.verbose) {
    const m = kpiMetrics(W_SERIES, 'CPM_001', w - 1);
    console.log(`  W_${w}: CPM_001=${m.actual}/${m.target} ${m.trendDirection}`);
  }
}

console.log('Generating TTHH D_31 .. D_1 ...');
for (let d = DAYS_IN_MONTH; d >= 1; d--) {
  const ctx = dayCtx(
    d,
    TEMPLATE,
    path.join(TTHH_ROOT, 'D'),
    `https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main/ApiV2/CMDV/CQDV/TTHH/D/D_${d}`,
  );
  ctx.verbose = d % 10 === 0 || d === 1;
  generatePeriod(ctx, D_SERIES);
  if (ctx.verbose) {
    const m = kpiMetrics(D_SERIES, 'CPM_002', d - 1);
    console.log(`  D_${d}: CPM_002=${m.actual}/${m.target} ${m.trendDirection}`);
  }
}

console.log('Done — TTHH W + D generated.');

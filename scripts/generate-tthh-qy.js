#!/usr/bin/env node
/**
 * Generate TTHH quarterly (Q_1..Q_4) and yearly (Y_2022..Y_2026) mock data.
 */

const path = require('path');
const {
  buildQuarterlySeries,
  buildYearlySeries,
  generatePeriod,
  quarterCtx,
  yearCtx,
} = require('./tthh-period-lib');

const TTHH_ROOT = path.join(__dirname, '../ApiV2/CMDV/CQDV/TTHH');
const TEMPLATE = path.join(TTHH_ROOT, 'M/M_12');

const Q_SERIES = buildQuarterlySeries();
const Y_SERIES = buildYearlySeries();

console.log('Generating TTHH Q_1 .. Q_4 ...');
for (let q = 1; q <= 4; q++) {
  generatePeriod(
    quarterCtx(
      q,
      TEMPLATE,
      path.join(TTHH_ROOT, 'Q'),
      `https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main/ApiV2/CMDV/CQDV/TTHH/Q/Q_${q}`,
    ),
    Q_SERIES,
  );
}

console.log('Generating TTHH Y_2022 .. Y_2026 ...');
for (const year of [2022, 2023, 2024, 2025, 2026]) {
  generatePeriod(
    yearCtx(
      year,
      TEMPLATE,
      path.join(TTHH_ROOT, 'Y'),
      `https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main/ApiV2/CMDV/CQDV/TTHH/Y/Y_${year}`,
    ),
    Y_SERIES,
  );
}

console.log('Done — TTHH Q + Y generated.');

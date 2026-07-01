#!/usr/bin/env node
/**
 * Bổ sung mock CMDV/CQDV/TTHH cho FE prod-marketing:
 * - overview/index.json → thêm field `filter`
 * - kpis/all/index.json, overview/all/index.json, board/all/index.json (giai đoạn 1: từ tthh)
 * - overview/index.json thiếu → tạo từ overview/tthh
 */

const fs = require('fs');
const path = require('path');

const TTHH_ROOT = path.join(__dirname, '../ApiV2/CMDV/CQDV/TTHH');
const DIVISION_ORDER = ['all', 'khpt', 'tthh', 'ttbsp', 'bsv'];

const DEFAULT_DIVISION_COUNTS = {
  all: 26,
  khpt: 13,
  tthh: 5,
  ttbsp: 6,
  bsv: 2,
};

const DEFAULT_DIVISION_TITLES = {
  all: { keyVi: 'Tất cả', keyEn: 'All' },
  khpt: { keyVi: 'Ban KHPT', keyEn: 'Division KHPT' },
  tthh: { keyVi: 'Ban TTHH', keyEn: 'Division TTHH' },
  ttbsp: { keyVi: 'Ban TTBSP', keyEn: 'Division TTBSP' },
  bsv: { keyVi: 'TT BSV', keyEn: 'TT BSV' },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 4)}\n`, 'utf8');
}

function buildFilter(periodDir) {
  const indexPath = path.join(periodDir, 'index.json');
  let divisions = null;

  if (fs.existsSync(indexPath)) {
    const raw = readJson(indexPath);
    divisions = Array.isArray(raw) ? raw[0] : raw;
  }

  return DIVISION_ORDER.map((key) => {
    const fromIndex = divisions?.[key];
    const title = fromIndex?.title ?? DEFAULT_DIVISION_TITLES[key];
    const count = fromIndex?.count ?? DEFAULT_DIVISION_COUNTS[key];

    return {
      title: [title],
      path: `/${key}`,
      count,
    };
  });
}

function patchOverviewRoot(periodDir, filter) {
  const overviewPath = path.join(periodDir, 'overview/index.json');
  const overviewTthhPath = path.join(periodDir, 'overview/tthh/index.json');

  let overview;
  if (fs.existsSync(overviewPath)) {
    overview = readJson(overviewPath);
  } else if (fs.existsSync(overviewTthhPath)) {
    overview = readJson(overviewTthhPath);
  } else {
    return false;
  }

  if (!Array.isArray(overview.data)) {
    return false;
  }

  overview.filter = filter;
  writeJson(overviewPath, overview);
  return true;
}

function patchOverviewAll(periodDir) {
  const src = path.join(periodDir, 'overview/tthh/index.json');
  const dest = path.join(periodDir, 'overview/all/index.json');
  if (!fs.existsSync(src)) return false;

  const overview = JSON.parse(JSON.stringify(readJson(src)));
  const summaryBlock = overview.data?.find((block) => block.type === 'summary');
  if (summaryBlock?.title) {
    summaryBlock.title = {
      keyVi: 'Tổng KPIs toàn CQDV',
      keyEn: 'CQDV-wide KPI summary',
    };
  }

  writeJson(dest, overview);
  return true;
}

function patchKpisAll(periodDir) {
  const src = path.join(periodDir, 'kpis/tthh/index.json');
  const dest = path.join(periodDir, 'kpis/all/index.json');
  if (!fs.existsSync(src)) return false;

  // Giai đoạn 1: KPI list gộp dùng cùng payload tthh; drill-down vẫn qua board/tthh.
  writeJson(dest, readJson(src));
  return true;
}

function patchBoardAll(periodDir) {
  const src = path.join(periodDir, 'board/tthh/index.json');
  const dest = path.join(periodDir, 'board/all/index.json');
  if (!fs.existsSync(src)) return false;

  writeJson(dest, readJson(src));
  return true;
}

function listPeriodDirs() {
  const folders = ['M', 'Q', 'Y', 'W', 'D'];
  const dirs = [];

  for (const folder of folders) {
    const base = path.join(TTHH_ROOT, folder);
    if (!fs.existsSync(base)) continue;

    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      dirs.push(path.join(base, entry.name));
    }
  }

  return dirs.sort();
}

function main() {
  const periods = listPeriodDirs();
  let overviewPatched = 0;
  let kpisAll = 0;
  let overviewAll = 0;
  let boardAll = 0;

  for (const periodDir of periods) {
    const filter = buildFilter(periodDir);

    if (patchOverviewRoot(periodDir, filter)) overviewPatched += 1;
    if (patchKpisAll(periodDir)) kpisAll += 1;
    if (patchOverviewAll(periodDir)) overviewAll += 1;
    if (patchBoardAll(periodDir)) boardAll += 1;
  }

  console.log(`Periods scanned: ${periods.length}`);
  console.log(`overview/index.json + filter: ${overviewPatched}`);
  console.log(`kpis/all/index.json: ${kpisAll}`);
  console.log(`overview/all/index.json: ${overviewAll}`);
  console.log(`board/all/index.json: ${boardAll}`);
}

main();

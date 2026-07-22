#!/usr/bin/env node
/**
 * Generate board/tthh/CPM_00X folders with diverse drill-down charts.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../ApiV2/CMDV/CQDV/TTHH/M/M_1');
const BOARD_TTHH = path.join(ROOT, 'board/tthh');
const CHARTS_SRC = path.join(ROOT, 'board/charts');
const BASE_URL =
  'https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main/ApiV2/CMDV/CQDV/TTHH/M/M_1/board/tthh';

const CHART_KEYS = [
  { key: 'bullet-th-kh', file: 'bullet-th-kh.json' },
  { key: 'trend-12m', file: 'trend-12m.json' },
  { key: 'by-network', file: 'by-network.json' },
  { key: 'by-area', file: 'by-area.json' },
  { key: 'by-country', file: 'by-country.json' },
  { key: 'by-sector', file: 'by-sector.json' },
];

const KPI_META = [
  {
    folder: 'CPM_001',
    code: 'CPM-001',
    titleVi: 'Thị phần hàng hóa vận chuyển',
    titleEn: 'Cargo market share',
    subTitleVi: 'Đơn vị: % · Nguồn: BCTM · MIS (tổng thị trường) · Tháng 1/2026',
    subTitleEn: 'Unit: % · Source: BCTM · MIS (total market) · January 2026',
    variation: 1.0,
  },
  {
    folder: 'CPM_002',
    code: 'CPM-002',
    titleVi: 'Sản lượng hàng hóa, bưu kiện',
    titleEn: 'Cargo and mail volume',
    subTitleVi: 'Đơn vị: Tấn · Nguồn: BCTM · CargoSpot · DWH · Tháng 1/2026',
    subTitleEn: 'Unit: Ton · Source: BCTM · CargoSpot · DWH · January 2026',
    variation: 1.03,
  },
  {
    folder: 'CPM_003',
    code: 'CPM-003',
    titleVi: 'Hàng hóa, bưu kiện luân chuyển (RFTK)',
    titleEn: 'Cargo and mail turnover (RFTK)',
    subTitleVi: 'Đơn vị: Nghìn tấn.km · Nguồn: BCTM · RPS · DWH · Tháng 1/2026',
    subTitleEn: 'Unit: Thousand ton-km · Source: BCTM · RPS · DWH · January 2026',
    variation: 0.97,
  },
  {
    folder: 'CPM_004',
    code: 'CPM-004',
    titleVi: 'Hệ số sử dụng tải hàng',
    titleEn: 'Cargo load factor',
    subTitleVi: 'Đơn vị: % · Nguồn: CRM Report · RPS · Tháng 1/2026',
    subTitleEn: 'Unit: % · Source: CRM Report · RPS · January 2026',
    variation: 1.05,
  },
  {
    folder: 'CPM_005',
    code: 'CPM-005',
    titleVi: 'Doanh thu hàng hóa, bưu kiện',
    titleEn: 'Cargo and mail revenue',
    subTitleVi: 'Đơn vị: Triệu VNĐ · Nguồn: BCTM · CRA · RAS · Tháng 1/2026',
    subTitleEn: 'Unit: Million VND · Source: BCTM · CRA · RAS · January 2026',
    variation: 0.94,
  },
];

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 4)}\n`, 'utf8');
}

function roundValue(value, variation, index) {
  if (typeof value !== 'number' || Number.isNaN(value)) return value;
  const jitter = 1 + (variation - 1) + index * 0.008;
  const scaled = value * jitter;
  if (Math.abs(value) >= 100) return Math.round(scaled);
  if (Math.abs(value) >= 10) return Math.round(scaled * 10) / 10;
  return Math.round(scaled * 100) / 100;
}

function varyChartData(chart, variation, chartIndex) {
  const next = JSON.parse(JSON.stringify(chart));
  if (!Array.isArray(next.data)) return next;

  next.data = next.data.map((series) => ({
    ...series,
    name: Array.isArray(series.name)
      ? series.name.map((v, i) => roundValue(v, variation, chartIndex + i))
      : series.name,
  }));

  if (next.config && typeof next.config.minValue === 'number') {
    const values = next.data.flatMap((s) => (Array.isArray(s.name) ? s.name : []));
    if (values.length) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const pad = (max - min) * 0.12 || max * 0.08 || 1;
      next.config.minValue = Math.round((min - pad) * 100) / 100;
      next.config.maxValue = Math.round((max + pad) * 100) / 100;
    }
  }

  return next;
}

function buildKpiSection(meta, chartChildren) {
  return {
    title: { keyVi: meta.titleVi, keyEn: meta.titleEn },
    subTitle: { keyVi: meta.subTitleVi, keyEn: meta.subTitleEn },
    grid: 2,
    child: chartChildren,
  };
}

function generateKpiFolder(meta) {
  const folderPath = path.join(BOARD_TTHH, meta.folder);
  const chartChildren = [];

  CHART_KEYS.forEach(({ file }, index) => {
    const srcPath = path.join(CHARTS_SRC, meta.code, file);
    const chart = varyChartData(JSON.parse(fs.readFileSync(srcPath, 'utf8')), meta.variation, index);
    const chartFile = `chart/index${index}.json`;
    writeJson(path.join(folderPath, chartFile), chart);

    chartChildren.push({
      title: chart.title,
      subTitle: chart.subTitle,
      child: `${BASE_URL}/${meta.folder}/${chartFile}`,
    });
  });

  writeJson(path.join(folderPath, 'index.json'), [buildKpiSection(meta, chartChildren)]);
  return buildKpiSection(meta, chartChildren);
}

function generate() {
  const boardSections = KPI_META.map((meta) => generateKpiFolder(meta));
  writeJson(path.join(BOARD_TTHH, 'index.json'), boardSections);

  console.log('Generated board/tthh:');
  KPI_META.forEach((meta) => {
    console.log(`  ${meta.folder}/index.json + chart/index0..${CHART_KEYS.length - 1}.json`);
  });
  console.log('  index.json — 5 KPI sections');
}

generate();

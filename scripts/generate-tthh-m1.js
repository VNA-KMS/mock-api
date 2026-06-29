#!/usr/bin/env node
/**
 * Generate TTHH M_1 mock:
 * - board/index.json        → array 5 chart overview (mỗi chart có code CPM-00x)
 * - chart-catalog.json      → map code → list chartKey drill-down
 * - charts/{code}/{key}.json → dữ liệu chart drill-down theo từng KPI
 */

const fs = require('fs');
const path = require('path');

const PERIOD_ROOT = path.join(__dirname, '../ApiV2/TTHH/TTHH/M/M_1');
const MODULE_ROOT = path.join(__dirname, '../ApiV2/TTHH/TTHH');

const MONTH_LABELS = [
  'T1/26', 'T2/26', 'T3/26', 'T4/26', 'T5/26', 'T6/26',
  'T7/26', 'T8/26', 'T9/26', 'T10/26', 'T11/26', 'T12/26',
];

const NETWORK_LABELS = ['Nội địa', 'Quốc tế'];
const AREA_LABELS = ['Châu Á - Thái Bình Dương', 'Châu Âu', 'Châu Mỹ', 'Trung Đông'];
const COUNTRY_LABELS = ['Việt Nam', 'Nhật Bản', 'Hàn Quốc', 'Úc', 'Đức'];
const SECTOR_LABELS = ['Hàng tổng hợp', 'Hàng express', 'Hàng dễ hỏng', 'Hàng đặc biệt'];

const DRILLDOWN_CHART_KEYS = [
  'trend-12m',
  'by-network',
  'by-area',
  'by-country',
  'by-sector',
  'bullet-th-kh',
];

const AI_INSIGHT = [
  {
    keyVi: '<Nội dung do AI tổng hợp và đề xuất>',
    keyEn: '<AI-generated summary and recommendations>',
  },
];

const KPIS = [
  {
    code: 'CPM-001',
    metricCode: 'CPM_001',
    filterPath: '/market-share',
    titleVi: 'Thị phần hàng hóa vận chuyển',
    titleEn: 'Cargo market share',
    unitVi: '%',
    unitEn: '%',
    actual: 78,
    target: 70,
    variant: 'success',
    statusVi: 'ĐẠT',
    statusEn: 'ACHIEVED',
    trendDirection: 'up',
    trendValue: 13.8,
    progress: 103,
    minValue: 0,
    maxValue: 100,
    trendBase: 72,
    trendStep: 0.5,
    dimBase: [62, 38],
    dimStep: 2,
  },
  {
    code: 'CPM-002',
    metricCode: 'CPM_002',
    filterPath: '/cargo-volume',
    titleVi: 'Sản lượng hàng hóa, bưu kiện',
    titleEn: 'Cargo and mail volume',
    unitVi: 'Tấn',
    unitEn: 'Ton',
    actual: 2195,
    target: 2000,
    variant: 'success',
    statusVi: 'ĐẠT',
    statusEn: 'ACHIEVED',
    trendDirection: 'down',
    trendValue: 0.5,
    progress: 105,
    minValue: 0,
    maxValue: 3000,
    trendBase: 1800,
    trendStep: 35,
    dimBase: [1200, 995],
    dimStep: 40,
  },
  {
    code: 'CPM-003',
    metricCode: 'CPM_003',
    filterPath: '/rftk',
    titleVi: 'Hàng hóa, bưu kiện luân chuyển (RFTK)',
    titleEn: 'Cargo and mail turnover (RFTK)',
    unitVi: 'Nghìn tấn.km',
    unitEn: 'Thousand ton-km',
    actual: 76.1,
    target: 75,
    variant: 'success',
    statusVi: 'ĐẠT',
    statusEn: 'ACHIEVED',
    trendDirection: 'up',
    trendValue: 2.1,
    progress: 103,
    minValue: 0,
    maxValue: 100,
    trendBase: 68,
    trendStep: 0.7,
    dimBase: [42, 34],
    dimStep: 1.5,
  },
  {
    code: 'CPM-004',
    metricCode: 'CPM_004',
    filterPath: '/load-factor',
    titleVi: 'Hệ số sử dụng tải hàng',
    titleEn: 'Cargo load factor',
    unitVi: '%',
    unitEn: '%',
    actual: 46,
    target: 50,
    variant: 'error',
    statusVi: 'KHÔNG ĐẠT',
    statusEn: 'NOT ACHIEVED',
    trendDirection: 'down',
    trendValue: 1.2,
    progress: 93,
    minValue: 0,
    maxValue: 100,
    trendBase: 48,
    trendStep: -0.2,
    dimBase: [52, 48],
    dimStep: -1,
  },
  {
    code: 'CPM-005',
    metricCode: 'CPM_005',
    filterPath: '/revenue',
    titleVi: 'Doanh thu hàng hóa, bưu kiện',
    titleEn: 'Cargo and mail revenue',
    unitVi: 'Triệu VNĐ',
    unitEn: 'Million VND',
    actual: 934,
    target: 800,
    variant: 'success',
    statusVi: 'ĐẠT',
    statusEn: 'ACHIEVED',
    trendDirection: 'up',
    trendValue: 0.8,
    progress: 110,
    minValue: 0,
    maxValue: 1200,
    trendBase: 720,
    trendStep: 18,
    dimBase: [520, 414],
    dimStep: 15,
  },
];

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n');
}

function seriesValues(base, step, count) {
  return Array.from({ length: count }, (_, i) => Math.round((base + step * i) * 10) / 10);
}

function dimValues(base, step, count) {
  return Array.from({ length: count }, (_, i) =>
    Math.round((base[0] + step * i) * 10) / 10,
  );
}

function buildKpiItem(kpi) {
  return {
    title: { keyVi: kpi.titleVi, keyEn: kpi.titleEn },
    tooltip: {
      keyVi: `Đơn vị: ${kpi.unitVi} · Nguồn: KMS · Đạt: ≥ KH`,
      keyEn: `Unit: ${kpi.unitEn} · Source: KMS · Reach: ≥ Plan`,
    },
    variant: kpi.variant,
    metricCode: kpi.metricCode,
    actual: kpi.actual,
    unit: { keyVi: kpi.unitVi, keyEn: kpi.unitEn },
    statusLabel: { keyVi: kpi.statusVi, keyEn: kpi.statusEn },
    trendDirection: kpi.trendDirection,
    trendValue: kpi.trendValue,
    trendLabel: { keyVi: 'với kỳ trước', keyEn: 'vs previous period' },
    target: kpi.target,
    targetLabel: { keyVi: 'Mục tiêu', keyEn: 'Target' },
    progress: kpi.progress,
  };
}

function lineChart({ titleVi, titleEn, subVi, subEn, slug, minValue, maxValue, target, trendBase, trendStep }) {
  const th = seriesValues(trendBase, trendStep, 12);
  const kh = MONTH_LABELS.map(() => target);
  const prev = seriesValues(trendBase * 0.92, trendStep * 0.85, 12);
  const config = { height: 200, minValue, maxValue, insightLayout: 'inline' };
  if (slug) config.slug = slug;

  return {
    chartKey: 'line',
    config,
    title: { keyVi: titleVi, keyEn: titleEn },
    subTitle: { keyVi: subVi, keyEn: subEn },
    labels: MONTH_LABELS,
    data: [
      {
        key: { keyVi: 'TH 2026', keyEn: 'Actual 2026' },
        name: th,
        color: ['#2962A0'],
        type: null,
        tension: 0.3,
        borderDash: null,
        fill: true,
      },
      {
        key: { keyVi: 'KH 2026', keyEn: 'Plan 2026' },
        name: kh,
        color: ['#D0D1D3'],
        type: null,
        tension: 0.3,
        borderDash: [6, 3],
        fill: false,
      },
      {
        key: { keyVi: 'TH 2025', keyEn: 'Actual 2025' },
        name: prev,
        color: ['#EC4899'],
        type: null,
        tension: 0.3,
        borderDash: null,
        fill: false,
      },
    ],
    insightLines: AI_INSIGHT,
  };
}

function barChart({ titleVi, titleEn, subVi, subEn, labels, minValue, maxValue, kpi }) {
  const count = labels.length;
  const actual = dimValues(kpi.dimBase, kpi.dimStep, count);
  const plan = actual.map((v) => Math.round(v * (kpi.target / kpi.actual) * 10) / 10);
  const prev = actual.map((v) => Math.round(v * 0.94 * 10) / 10);

  return {
    chartKey: 'bar',
    config: { height: 200, minValue, maxValue, insightLayout: 'inline' },
    title: { keyVi: titleVi, keyEn: titleEn },
    subTitle: { keyVi: subVi, keyEn: subEn },
    labels,
    data: [
      {
        key: { keyVi: 'TH 2026 (Tháng 1/2026)', keyEn: 'Actual 2026 (Month 1/2026)' },
        name: actual,
        color: ['#2962A0'],
        type: null,
        tension: null,
        borderDash: null,
        fill: null,
      },
      {
        key: { keyVi: 'KH 2026 (Tháng 1/2026)', keyEn: 'Plan 2026 (Month 1/2026)' },
        name: plan,
        color: ['#D0D1D3'],
        type: null,
        tension: null,
        borderDash: null,
        fill: null,
      },
      {
        key: { keyVi: 'TH 2025 (Tháng 1/2025)', keyEn: 'Actual 2025 (Month 1/2025)' },
        name: prev,
        color: ['#EC4899'],
        type: null,
        tension: null,
        borderDash: null,
        fill: null,
      },
    ],
    insightLines: AI_INSIGHT,
  };
}

function bulletChart({ titleVi, titleEn, subVi, subEn, minValue, maxValue, kpi }) {
  return {
    chartKey: 'bar',
    config: { height: 200, direction: 1, minValue, maxValue, insightLayout: 'inline' },
    title: { keyVi: titleVi, keyEn: titleEn },
    subTitle: { keyVi: subVi, keyEn: subEn },
    labels: ['TH', 'KH'],
    data: [
      {
        key: { keyVi: `${kpi.titleVi} 1T/2026`, keyEn: `${kpi.titleEn} Q1 2026` },
        name: [kpi.actual, kpi.target],
        color: ['#2962A0', '#D0D1D3'],
        type: null,
        tension: null,
        borderDash: null,
        fill: null,
      },
    ],
    insightLines: AI_INSIGHT,
  };
}

function buildOverviewChart(kpi) {
  return {
    code: kpi.code,
    metricCode: kpi.metricCode,
    ...lineChart({
      titleVi: kpi.titleVi,
      titleEn: kpi.titleEn,
      subVi: `Đơn vị: ${kpi.unitVi}`,
      subEn: `Unit: ${kpi.unitEn}`,
      slug: kpi.unitVi,
      minValue: kpi.minValue,
      maxValue: kpi.maxValue,
      target: kpi.target,
      trendBase: kpi.trendBase,
      trendStep: kpi.trendStep,
    }),
  };
}

function buildDrilldownChart(kpi, key) {
  const base = {
    code: kpi.code,
    key,
    metricCode: kpi.metricCode,
  };

  switch (key) {
    case 'trend-12m':
      return {
        ...base,
        ...lineChart({
          titleVi: `Xu hướng ${kpi.titleVi} 12 tháng`,
          titleEn: `12-month ${kpi.titleEn} trend`,
          subVi: 'Theo dõi biến động theo thời gian, so với KH và cùng kỳ',
          subEn: 'Track changes over time vs plan and same period',
          slug: kpi.unitVi,
          minValue: kpi.minValue,
          maxValue: kpi.maxValue,
          target: kpi.target,
          trendBase: kpi.trendBase,
          trendStep: kpi.trendStep,
        }),
      };
    case 'by-network':
      return {
        ...base,
        ...barChart({
          titleVi: `${kpi.titleVi} theo Network`,
          titleEn: `${kpi.titleEn} by network`,
          subVi: 'So sánh TH vs KH giữa mạng Nội địa và Quốc tế',
          subEn: 'Compare actual vs plan between domestic and international networks',
          labels: NETWORK_LABELS,
          minValue: kpi.minValue,
          maxValue: kpi.maxValue,
          kpi,
        }),
      };
    case 'by-area':
      return {
        ...base,
        ...barChart({
          titleVi: `${kpi.titleVi} theo Area`,
          titleEn: `${kpi.titleEn} by area`,
          subVi: 'Phân tích theo khu vực địa lý',
          subEn: 'Analysis by geographic area',
          labels: AREA_LABELS,
          minValue: kpi.minValue,
          maxValue: kpi.maxValue,
          kpi,
        }),
      };
    case 'by-country':
      return {
        ...base,
        ...barChart({
          titleVi: `${kpi.titleVi} theo Country`,
          titleEn: `${kpi.titleEn} by country`,
          subVi: 'So sánh giữa các thị trường quốc gia chính',
          subEn: 'Compare key country markets',
          labels: COUNTRY_LABELS,
          minValue: kpi.minValue,
          maxValue: kpi.maxValue,
          kpi,
        }),
      };
    case 'by-sector':
      return {
        ...base,
        ...barChart({
          titleVi: `${kpi.titleVi} theo Sector`,
          titleEn: `${kpi.titleEn} by sector`,
          subVi: 'Phân tích theo loại hàng hóa / ngành',
          subEn: 'Analysis by cargo type / sector',
          labels: SECTOR_LABELS,
          minValue: kpi.minValue,
          maxValue: kpi.maxValue,
          kpi,
        }),
      };
    case 'bullet-th-kh':
      return {
        ...base,
        ...bulletChart({
          titleVi: 'Bullet: TH so với KH',
          titleEn: 'Bullet: actual vs plan',
          subVi: 'Đánh giá trực quan mức độ hoàn thành mục tiêu',
          subEn: 'Visual assessment of target completion',
          minValue: kpi.minValue,
          maxValue: kpi.maxValue,
          kpi,
        }),
      };
    default:
      throw new Error(`Unknown chart key: ${key}`);
  }
}

function buildChartCatalog() {
  const chartTypes = {
    'trend-12m': {
      dimension: 'time',
      chartKey: 'line',
      title: { keyVi: 'Xu hướng 12 tháng', keyEn: '12-month trend' },
    },
    'by-network': {
      dimension: 'network',
      chartKey: 'bar',
      title: { keyVi: 'Theo Network', keyEn: 'By network' },
    },
    'by-area': {
      dimension: 'area',
      chartKey: 'bar',
      title: { keyVi: 'Theo Area', keyEn: 'By area' },
    },
    'by-country': {
      dimension: 'country',
      chartKey: 'bar',
      title: { keyVi: 'Theo Country', keyEn: 'By country' },
    },
    'by-sector': {
      dimension: 'sector',
      chartKey: 'bar',
      title: { keyVi: 'Theo Sector', keyEn: 'By sector' },
    },
    'bullet-th-kh': {
      dimension: 'bullet',
      chartKey: 'bar',
      title: { keyVi: 'Bullet: TH so với KH', keyEn: 'Bullet: actual vs plan' },
    },
  };

  const kpiCharts = {};
  for (const kpi of KPIS) {
    kpiCharts[kpi.code] = {
      metricCode: kpi.metricCode,
      filterPath: kpi.filterPath,
      title: { keyVi: kpi.titleVi, keyEn: kpi.titleEn },
      charts: [...DRILLDOWN_CHART_KEYS],
    };
  }

  return { chartTypes, kpiCharts };
}

function removeLegacyBoardDirs() {
  const boardRoot = path.join(PERIOD_ROOT, 'board');
  if (!fs.existsSync(boardRoot)) return;

  for (const entry of fs.readdirSync(boardRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      fs.rmSync(path.join(boardRoot, entry.name), { recursive: true, force: true });
    }
  }
}

function generate() {
  removeLegacyBoardDirs();

  const overviewCharts = KPIS.map(buildOverviewChart);
  writeJson(path.join(PERIOD_ROOT, 'board/index.json'), overviewCharts);

  writeJson(path.join(MODULE_ROOT, 'chart-catalog.json'), buildChartCatalog());

  writeJson(path.join(PERIOD_ROOT, 'kpis/all/index.json'), KPIS.map(buildKpiItem));
  KPIS.forEach((kpi, idx) => {
    const item = buildKpiItem(kpi);
    writeJson(path.join(PERIOD_ROOT, `kpis/index${idx}.json`), [item]);
  });

  for (const kpi of KPIS) {
    for (const chartKey of DRILLDOWN_CHART_KEYS) {
      writeJson(
        path.join(PERIOD_ROOT, `charts/${kpi.code}/${chartKey}.json`),
        buildDrilldownChart(kpi, chartKey),
      );
    }
  }

  console.log('Generated TTHH M_1:');
  console.log(`  board/index.json — ${overviewCharts.length} overview charts (with code)`);
  console.log(`  chart-catalog.json — ${KPIS.length} KPI mappings`);
  console.log(`  charts/{code}/{chartKey}.json — ${KPIS.length * DRILLDOWN_CHART_KEYS.length} drill-down charts`);
}

generate();

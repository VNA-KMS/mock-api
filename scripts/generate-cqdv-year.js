#!/usr/bin/env node
/**
 * Generate CQDV yearly config (Y_2026) from Figma design.
 * Extends monthly structure with salary + labor-cost modules.
 */

const fs = require('fs');
const path = require('path');

const Y_ROOT = path.join(__dirname, '../ApiV2/TCNL/CQDV/Y');
const YEAR = process.argv[2] || 'Y_2026';
const OUT = path.join(Y_ROOT, YEAR);
const BASE_URL =
  'https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main/ApiV2/TCNL/CQDV/Y';

const YEAR_LABELS = ['2022', '2023', '2024', '2025', '2026'];

function writeJson(relPath, data) {
  const full = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data, null, 4) + '\n');
}

function chartUrl(module, index) {
  return `${BASE_URL}/${YEAR}/board/${module}/chart/index${index}.json`;
}

function lineChart({
  titleVi,
  titleEn,
  subVi,
  subEn,
  slug,
  minValue,
  maxValue,
  th,
  target,
  baseline,
  baselineKey = { keyVi: '2019', keyEn: '2019' },
}) {
  const series = [
    {
      key: { keyVi: 'Thực hiện', keyEn: 'Actual' },
      name: th,
      color: ['#27ae60'],
      type: null,
      tension: 0.3,
      borderDash: null,
      fill: false,
    },
    {
      key: { keyVi: 'Mục tiêu', keyEn: 'Target' },
      name: target,
      color: ['#e74c3c'],
      type: null,
      tension: null,
      borderDash: [6, 3],
      fill: false,
    },
  ];
  if (baseline) {
    series.push({
      key: baselineKey,
      name: baseline,
      color: ['#8e44ad'],
      type: null,
      tension: 0.3,
      borderDash: null,
      fill: false,
    });
  }
  const config = { height: 200, minValue, maxValue, insightLayout: 'inline' };
  if (slug) config.slug = slug;
  return {
    chartKey: 'line',
    config,
    title: { keyVi: titleVi, keyEn: titleEn },
    subTitle: { keyVi: subVi, keyEn: subEn },
    labels: YEAR_LABELS,
    data: series,
    insightLines: [
      {
        keyVi: '<Nội dung do AI tổng hợp và đề xuất>',
        keyEn: '<AI-generated summary and recommendations>',
      },
    ],
  };
}

function kpi({
  titleVi,
  titleEn,
  tooltipVi,
  tooltipEn,
  metricCode,
  actual,
  unitVi,
  unitEn,
  variant,
  statusVi,
  statusEn,
  trendDirection,
  trendValue,
  target,
  progress,
}) {
  const item = {
    title: { keyVi: titleVi, keyEn: titleEn },
    tooltip: { keyVi: tooltipVi, keyEn: tooltipEn },
    variant,
    metricCode,
    unit: { keyVi: unitVi, keyEn: unitEn },
    statusLabel: { keyVi: statusVi, keyEn: statusEn },
    trendDirection,
    trendValue,
    trendLabel: { keyVi: 'với kỳ trước', keyEn: 'vs previous period' },
    target,
    targetLabel: { keyVi: 'Mục tiêu', keyEn: 'Target' },
    progress,
  };
  if (actual !== undefined) item.actual = actual;
  return item;
}

// --- KPI definitions (Figma node 21035:50819) ---
const KPIS = {
  nsld: kpi({
    titleVi: 'Năng suất lao động',
    titleEn: 'Labor Productivity',
    tooltipVi: 'Đơn vị: Nghìn tấn.km/LĐ · Nguồn: KMS · Đạt: ≥ KH',
    tooltipEn: 'Unit: Thousand ton-km/Labor · Source: KMS · Reach: ≥ Plan',
    metricCode: 'KMS_TCNL_REV_001',
    actual: 246,
    unitVi: 'Nghìn tấn.km/LĐ',
    unitEn: 'Thousand ton-km/Labor',
    variant: 'success',
    statusVi: 'ĐẠT',
    statusEn: 'ACHIEVED',
    trendDirection: 'up',
    trendValue: 13.8,
    target: 245,
    progress: 100,
  }),
  satisfaction: kpi({
    titleVi: 'Mức độ hài lòng và gắn kết của nhân viên',
    titleEn: 'Employee satisfaction and engagement',
    tooltipVi: 'Đơn vị: % · Nguồn: Khảo sát nội bộ',
    tooltipEn: 'Unit: % · Source: Internal survey',
    metricCode: 'KMS_TCNL_REV_002',
    actual: 80.8,
    unitVi: '%',
    unitEn: '%',
    variant: 'success',
    statusVi: 'ĐẠT',
    statusEn: 'ACHIEVED',
    trendDirection: 'up',
    trendValue: 3.9,
    target: 100,
    progress: 100,
  }),
  salary: kpi({
    titleVi: 'Tiền lương bình quân',
    titleEn: 'Average salary',
    tooltipVi: 'Đơn vị: Triệu VNĐ/người/tháng · Nguồn: KMS',
    tooltipEn: 'Unit: Million VND/person/month · Source: KMS',
    metricCode: 'KMS_TCNL_REV_003',
    actual: 39,
    unitVi: 'Triệu VNĐ/người/tháng',
    unitEn: 'Million VND/person/month',
    variant: 'warning',
    statusVi: 'KHÔNG ĐẠT',
    statusEn: 'NOT ACHIEVED',
    trendDirection: 'down',
    trendValue: 6.7,
    target: 42,
    progress: 93,
  }),
  labor: kpi({
    titleVi: 'Kế hoạch lao động',
    titleEn: 'Labor plan',
    tooltipVi: 'Tải luân chuyển/Số lao động sử dụng bình quân của kỳ đó',
    tooltipEn: 'Turnover load/Average labor used in the period',
    metricCode: 'KMS_TCNL_REV_004',
    actual: 7.195,
    unitVi: 'Người',
    unitEn: 'People',
    variant: 'success',
    statusVi: 'ĐẠT',
    statusEn: 'ACHIEVED',
    trendDirection: 'down',
    trendValue: 0.5,
    target: 7.2,
    progress: 100,
  }),
  pc: kpi({
    titleVi: 'Giờ bay phi công',
    titleEn: 'Pilot flight hours',
    tooltipVi: 'Đơn vị: Giờ/người/tháng · Nguồn: AVES · Đạt: ≥ Định mức (±10%)',
    tooltipEn: 'Unit: Hour/person/month · Source: AVES · Reach: ≥ Target (±10%)',
    metricCode: 'KMS_TCNL_REV_005',
    actual: 76.1,
    unitVi: 'Giờ/người/tháng',
    unitEn: 'Hours/person/month',
    variant: 'success',
    statusVi: 'ĐẠT',
    statusEn: 'ACHIEVED',
    trendDirection: 'up',
    trendValue: 1.2,
    target: 75,
    progress: 100,
  }),
  tv: kpi({
    titleVi: 'Giờ bay tiếp viên',
    titleEn: 'Flight attendant flight hours',
    tooltipVi: 'Đơn vị: Giờ/người/tháng · Nguồn: AVES · Đạt: ≥ Định mức (±10%)',
    tooltipEn: 'Unit: Hour/person/month · Source: AVES · Reach: ≥ Target (±10%)',
    metricCode: 'KMS_TCNL_REV_006',
    actual: 76.1,
    unitVi: 'Giờ/người/tháng',
    unitEn: 'Hours/person/month',
    variant: 'success',
    statusVi: 'ĐẠT',
    statusEn: 'ACHIEVED',
    trendDirection: 'up',
    trendValue: 1.2,
    target: 75,
    progress: 100,
  }),
  costLd: kpi({
    titleVi: 'Chi phí nhân công bình quân trên 1 lao động',
    titleEn: 'Average labor cost per employee',
    tooltipVi: 'Đơn vị: Triệu VNĐ/người/tháng · Gồm nhân công thuê ngoài',
    tooltipEn: 'Unit: Million VND/person/month · Includes outsourced labor',
    metricCode: 'KMS_TCNL_REV_007',
    actual: null,
    unitVi: 'Triệu VNĐ/người/tháng',
    unitEn: 'Million VND/person/month',
    variant: 'warning',
    statusVi: 'KHÔNG ĐẠT',
    statusEn: 'NOT ACHIEVED',
    trendDirection: 'flat',
    trendValue: 0,
    target: 52,
    progress: 0,
  }),
  costRtk: kpi({
    titleVi: 'Chi phí nhân công bình quân RTK',
    titleEn: 'Average labor cost per RTK',
    tooltipVi: 'Đơn vị: VNĐ/tấn.km',
    tooltipEn: 'Unit: VND/ton.km',
    metricCode: 'KMS_TCNL_REV_008',
    actual: 12850,
    unitVi: 'VNĐ/tấn.km',
    unitEn: 'VND/ton.km',
    variant: 'success',
    statusVi: 'ĐẠT',
    statusEn: 'ACHIEVED',
    trendDirection: 'up',
    trendValue: 2.1,
    target: 12650,
    progress: 100,
  }),
  costFlight: kpi({
    titleVi: 'Chi phí nhân công bình quân chuyến bay',
    titleEn: 'Average labor cost per flight',
    tooltipVi: 'Đơn vị: Triệu VNĐ/chuyến',
    tooltipEn: 'Unit: Million VND/flight',
    metricCode: 'KMS_TCNL_REV_009',
    actual: 2.75,
    unitVi: 'Triệu VNĐ/chuyến',
    unitEn: 'Million VND/flight',
    variant: 'warning',
    statusVi: 'KHÔNG ĐẠT',
    statusEn: 'NOT ACHIEVED',
    trendDirection: 'down',
    trendValue: 0.8,
    target: 2.78,
    progress: 99,
  }),
  costBh: kpi({
    titleVi: 'Chi phí nhân công bình quân BH',
    titleEn: 'Average labor cost per block hour',
    tooltipVi: 'Đơn vị: Triệu VNĐ/giờ',
    tooltipEn: 'Unit: Million VND/hour',
    metricCode: 'KMS_TCNL_REV_010',
    actual: 1.17,
    unitVi: 'Triệu VNĐ/giờ',
    unitEn: 'Million VND/hour',
    variant: 'warning',
    statusVi: 'KHÔNG ĐẠT',
    statusEn: 'NOT ACHIEVED',
    trendDirection: 'down',
    trendValue: 0.8,
    target: 1.2,
    progress: 98,
  }),
};

// --- Chart data (yearly trends from Figma) ---
const CHARTS = {
  nsld: lineChart({
    titleVi: 'Năng suất lao động',
    titleEn: 'Labor Productivity',
    subVi: 'Đơn vị: 1.000 tấn.km/LĐ',
    subEn: 'Unit: 1,000 ton-km/Labor',
    minValue: 200,
    maxValue: 260,
    th: [218, 225, 232, 238, 246],
    target: [240, 242, 243, 244, 245],
    baseline: [205, 208, 210, 212, 215],
  }),
  satisfaction: lineChart({
    titleVi: 'Mức độ hài lòng và gắn kết của nhân viên',
    titleEn: 'Employee satisfaction and engagement',
    subVi: 'Đơn vị: %',
    subEn: 'Unit: %',
    minValue: 60,
    maxValue: 100,
    th: [72, 74, 76, 78, 80.8],
    target: [85, 88, 90, 95, 100],
    baseline: null,
  }),
  salary: lineChart({
    titleVi: 'Tiền lương bình quân',
    titleEn: 'Average salary',
    subVi: 'Đơn vị: Triệu VNĐ/người/tháng',
    subEn: 'Unit: Million VND/person/month',
    minValue: 30,
    maxValue: 45,
    th: [32, 34, 36, 38, 39],
    target: [38, 39, 40, 41, 42],
    baseline: [30, 31, 32, 33, 34],
  }),
  labor: lineChart({
    titleVi: 'Kế hoạch lao động',
    titleEn: 'Labor plan',
    subVi: 'Đơn vị: Người',
    subEn: 'Unit: People',
    slug: 'Người',
    minValue: 6500,
    maxValue: 7500,
    th: [6850, 6950, 7050, 7120, 7195],
    target: [7000, 7050, 7100, 7150, 7200],
    baseline: [6700, 6750, 6800, 6850, 6900],
  }),
  pc: lineChart({
    titleVi: 'Giờ bay Phi công',
    titleEn: 'Pilot flight hours',
    subVi: 'Đơn vị: Giờ/người/tháng',
    subEn: 'Unit: Hours/person/month',
    minValue: 60,
    maxValue: 80,
    th: [68, 70, 72, 74, 76.1],
    target: [75, 75, 75, 75, 75],
    baseline: [65, 66, 67, 68, 69],
  }),
  tv: lineChart({
    titleVi: 'Giờ bay Tiếp viên',
    titleEn: 'Flight attendant flight hours',
    subVi: 'Đơn vị: Giờ/người/tháng',
    subEn: 'Unit: Hours/person/month',
    minValue: 60,
    maxValue: 80,
    th: [68, 70, 72, 74, 76.1],
    target: [75, 75, 75, 75, 75],
    baseline: [65, 66, 67, 68, 69],
  }),
  costLd: lineChart({
    titleVi: 'Chi phí nhân công bình quân trên 1 lao động (gồm nhân công thuê ngoài)',
    titleEn: 'Average labor cost per employee (incl. outsourced)',
    subVi: 'Đơn vị: Triệu đồng/người/tháng',
    subEn: 'Unit: Million VND/person/month',
    minValue: 40,
    maxValue: 55,
    th: [45, 47, 49, 50, null],
    target: [48, 49, 50, 51, 52],
    baseline: [42, 43, 44, 45, 46],
  }),
  costRtk: lineChart({
    titleVi: 'Chi phí nhân công bình quân RTK',
    titleEn: 'Average labor cost per RTK',
    subVi: 'Đơn vị: VND/tấn.km',
    subEn: 'Unit: VND/ton.km',
    minValue: 11000,
    maxValue: 13500,
    th: [11800, 12100, 12350, 12550, 12850],
    target: [12200, 12300, 12450, 12550, 12650],
    baseline: [11500, 11600, 11700, 11800, 11900],
  }),
  costFlight: lineChart({
    titleVi: 'Chi phí nhân công bình quân chuyến bay',
    titleEn: 'Average labor cost per flight',
    subVi: 'Đơn vị: Triệu đồng/chuyến',
    subEn: 'Unit: Million VND/flight',
    minValue: 2.4,
    maxValue: 3.0,
    th: [2.55, 2.62, 2.68, 2.72, 2.75],
    target: [2.7, 2.72, 2.74, 2.76, 2.78],
    baseline: [2.5, 2.52, 2.54, 2.56, 2.58],
  }),
  costBh: lineChart({
    titleVi: 'Chi phí nhân công bình quân BH',
    titleEn: 'Average labor cost per block hour',
    subVi: 'Đơn vị: Triệu đồng/giờ',
    subEn: 'Unit: Million VND/hour',
    minValue: 1.0,
    maxValue: 1.3,
    th: [1.08, 1.1, 1.12, 1.15, 1.17],
    target: [1.15, 1.16, 1.17, 1.18, 1.2],
    baseline: [1.05, 1.06, 1.07, 1.08, 1.09],
  }),
};

const ALL_CHART_KEYS = [
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

const ALL_CHART_META = [
  { key: 'nsld', titleVi: 'Năng suất lao động', titleEn: 'Labor Productivity', subVi: 'Đơn vị: 1.000 tấn.km/LĐ', subEn: 'Unit: 1,000 ton-km/Labor' },
  { key: 'satisfaction', titleVi: 'Mức độ hài lòng và gắn kết của nhân viên', titleEn: 'Employee satisfaction and engagement', subVi: 'Đơn vị: %', subEn: 'Unit: %' },
  { key: 'salary', titleVi: 'Tiền lương bình quân', titleEn: 'Average salary', subVi: 'Đơn vị: Triệu VNĐ/người/tháng', subEn: 'Unit: Million VND/person/month' },
  { key: 'labor', titleVi: 'Kế hoạch lao động', titleEn: 'Labor plan', subVi: 'Đơn vị: Người', subEn: 'Unit: People' },
  { key: 'pc', titleVi: 'Giờ bay Phi công', titleEn: 'Pilot flight hours', subVi: 'Đơn vị: Giờ/người/tháng', subEn: 'Unit: Hours/person/month' },
  { key: 'tv', titleVi: 'Giờ bay Tiếp viên', titleEn: 'Flight attendant flight hours', subVi: 'Đơn vị: Giờ/người/tháng', subEn: 'Unit: Hours/person/month' },
  { key: 'costLd', titleVi: 'Chi phí nhân công bình quân trên 1 lao động (gồm nhân công thuê ngoài)', titleEn: 'Average labor cost per employee (incl. outsourced)', subVi: 'Đơn vị: Triệu đồng/người/tháng', subEn: 'Unit: Million VND/person/month' },
  { key: 'costRtk', titleVi: 'Chi phí nhân công bình quân RTK', titleEn: 'Average labor cost per RTK', subVi: 'Đơn vị: VND/tấn.km', subEn: 'Unit: VND/ton.km' },
  { key: 'costFlight', titleVi: 'Chi phí nhân công bình quân chuyến bay', titleEn: 'Average labor cost per flight', subVi: 'Đơn vị: Triệu đồng/chuyến', subEn: 'Unit: Million VND/flight' },
  { key: 'costBh', titleVi: 'Chi phí nhân công bình quân BH', titleEn: 'Average labor cost per block hour', subVi: 'Đơn vị: Triệu đồng/giờ', subEn: 'Unit: Million VND/hour' },
];

function boardIndex(module, items) {
  return [
    {
      title: { keyVi: 'Chi tiết', keyEn: 'Details' },
      grid: 2,
      child: items.map((item, i) => ({
        title: { keyVi: item.titleVi, keyEn: item.titleEn },
        subTitle: { keyVi: item.subVi, keyEn: item.subEn },
        child: chartUrl(module, i),
      })),
    },
  ];
}

function moduleBoard(module, metaList) {
  metaList.forEach((meta, i) => writeJson(`board/${module}/chart/index${i}.json`, CHARTS[meta.key]));
  writeJson(`board/${module}/index.json`, boardIndex(module, metaList));
}

// --- Generate ---
console.log(`Generating ${OUT}...`);

// overview
writeJson('overview/index.json', {
  data: [
    {
      type: 'summary',
      title: { keyVi: 'Tổng KPIs năm', keyEn: 'Total KPIs year' },
      data: {
        progress: { value: 60, label: { keyVi: 'Đạt', keyEn: 'Achieved' } },
        statistics: [
          { label: { keyVi: 'Chỉ tiêu', keyEn: 'Target' }, value: 10 },
          { label: { keyVi: 'Đạt', keyEn: 'Achieved' }, value: 6 },
          { label: { keyVi: 'Không đạt', keyEn: 'Not achieved' }, value: 4 },
        ],
      },
    },
    {
      type: 'card',
      title: { keyVi: 'Tín hiệu tích cực', keyEn: 'Positive signal' },
      variant: 'success',
      data: {
        description: {
          keyVi: '<Nội dung do AI tổng hợp và đề xuất>',
          keyEn: '<AI summary and recommendation>',
        },
      },
    },
    {
      type: 'card',
      title: { keyVi: 'Khuyến nghị hành động', keyEn: 'Action recommendation' },
      variant: 'warning',
      data: {
        description: {
          keyVi: '<Nội dung do AI tổng hợp và đề xuất>',
          keyEn: '<AI summary and recommendation>',
        },
      },
    },
  ],
  filter: [
    { title: [{ keyVi: 'Tất cả', keyEn: 'All' }], path: '/', count: 10 },
    { title: [{ keyVi: 'Năng suất lao động', keyEn: 'Labor Productivity' }], path: '/labor-productivity', count: 2 },
    { title: [{ keyVi: 'Giờ bay Phi công, Tiếp viên', keyEn: 'Flight Time PC, TV' }], path: '/flight-time', count: 2 },
    { title: [{ keyVi: 'Tiền lương', keyEn: 'Salary' }], path: '/salary', count: 1 },
    { title: [{ keyVi: 'Lao động', keyEn: 'Labor' }], path: '/labor', count: 1 },
    { title: [{ keyVi: 'Chi phí nhân công', keyEn: 'Labor cost' }], path: '/labor-cost', count: 4 },
  ],
});

// kpis
writeJson('kpis/all/index.json', ALL_CHART_KEYS.map((k) => KPIS[k]));
writeJson('kpis/labor-productivity/index.json', [KPIS.nsld, KPIS.satisfaction]);
writeJson('kpis/fight-time/index.json', [KPIS.pc, KPIS.tv]);
writeJson('kpis/salary/index.json', [KPIS.salary]);
writeJson('kpis/labor/index.json', [KPIS.labor]);
writeJson('kpis/labor-cost/index.json', [KPIS.costLd, KPIS.costRtk, KPIS.costFlight, KPIS.costBh]);

// board/all
ALL_CHART_META.forEach((meta, i) => writeJson(`board/all/chart/index${i}.json`, CHARTS[meta.key]));
writeJson('board/all/index.json', boardIndex('all', ALL_CHART_META));

// module boards
moduleBoard('labor-productivity', ALL_CHART_META.filter((m) => ['nsld', 'satisfaction'].includes(m.key)));
moduleBoard('fight-time', ALL_CHART_META.filter((m) => ['pc', 'tv'].includes(m.key)));
moduleBoard('salary', ALL_CHART_META.filter((m) => m.key === 'salary'));
moduleBoard('labor', ALL_CHART_META.filter((m) => m.key === 'labor'));
moduleBoard('labor-cost', ALL_CHART_META.filter((m) => ['costLd', 'costRtk', 'costFlight', 'costBh'].includes(m.key)));

const fileCount = fs.readdirSync(OUT, { recursive: true }).filter((f) => String(f).endsWith('.json')).length;
console.log(`Done: ${fileCount} JSON files in ${OUT}`);

#!/usr/bin/env node
/**
 * Generate ApiV2/TCNL/HDQT/Y from BGD/Y template.
 * - Same structure as BGD/Y except fight-time pages removed
 * - overview + kpis/all + board/all aligned with HDQT Figma (node 21657:19351)
 */

const fs = require('fs');
const path = require('path');

const SOURCE= path.join(__dirname, '../ApiV2/TCNL/BGD/Y');
const TARGET = path.join(__dirname, '../ApiV2/TCNL/HDQT/Y');
const YEARS = ['Y_2022', 'Y_2023', 'Y_2024', 'Y_2025', 'Y_2026'];

const SKIP_PATTERNS = [
  /[/\\]fight-time[/\\]/,
  /[/\\]flight-time[/\\]/,
];

// Figma: Cấp HĐQT theo Năm - Tổng quan KPIs (Y_2026)
const FIGMA_Y2026 = {
  overview: {
    progress: 75,
    total: 4,
    achieved: 3,
    notAchieved: 1,
  },
  filter: [
    { title: [{ keyVi: 'Tất cả', keyEn: 'All' }], path: '/', count: 4 },
    {
      title: [{ keyVi: 'Năng suất lao động', keyEn: 'Labor Productivity' }],
      path: '/labor-productivity',
      count: 2,
    },
    {
      title: [{ keyVi: 'Tiền lương', keyEn: 'Salary' }],
      path: '/salary',
      count: 1,
    },
    {
      title: [{ keyVi: 'Lao động', keyEn: 'Labor' }],
      path: '/labor',
      count: 1,
    },
  ],
  kpis: [
    {
      title: { keyVi: 'Năng suất lao động', keyEn: 'Labor Productivity' },
      tooltip: {
        keyVi: 'Đơn vị: Nghìn tấn.km/LĐ · Nguồn: KMS · Đạt: ≥ KH',
        keyEn: 'Unit: Thousand ton-km/Labor · Source: KMS · Reach: ≥ Plan',
      },
      variant: 'success',
      metricCode: 'HRD_001',
      unit: { keyVi: 'Nghìn tấn.km/LĐ', keyEn: 'Thousand ton-km/Labor' },
      statusLabel: { keyVi: 'ĐẠT', keyEn: 'ACHIEVED' },
      trendDirection: 'up',
      trendValue: 13.8,
      trendLabel: { keyVi: 'với kỳ trước', keyEn: 'vs previous period' },
      target: 245,
      targetLabel: { keyVi: 'Mục tiêu', keyEn: 'Target' },
      progress: 100,
      actual: 246,
    },
    {
      title: {
        keyVi: 'Mức độ hài lòng và gắn kết của nhân viên',
        keyEn: 'Employee satisfaction and engagement',
      },
      tooltip: {
        keyVi: 'Đơn vị: % · Nguồn: Khảo sát nội bộ',
        keyEn: 'Unit: % · Source: Internal survey',
      },
      variant: 'success',
      metricCode: 'HRD_002',
      unit: { keyVi: '%', keyEn: '%' },
      statusLabel: { keyVi: 'ĐẠT', keyEn: 'ACHIEVED' },
      trendDirection: 'up',
      trendValue: 3.9,
      trendLabel: { keyVi: 'với kỳ trước', keyEn: 'vs previous period' },
      target: 100,
      targetLabel: { keyVi: 'Mục tiêu', keyEn: 'Target' },
      progress: 100,
      actual: 80.8,
    },
    {
      title: { keyVi: 'Tiền lương bình quân', keyEn: 'Average salary' },
      tooltip: {
        keyVi: 'Đơn vị: Triệu VNĐ/người/tháng · Nguồn: KMS',
        keyEn: 'Unit: Million VND/person/month · Source: KMS',
      },
      variant: 'warning',
      metricCode: 'HRD_003',
      unit: { keyVi: 'Triệu VNĐ/người/tháng', keyEn: 'Million VND/person/month' },
      statusLabel: { keyVi: 'KHÔNG ĐẠT', keyEn: 'NOT ACHIEVED' },
      trendDirection: 'down',
      trendValue: 6.7,
      trendLabel: { keyVi: 'với kỳ trước', keyEn: 'vs previous period' },
      target: 42,
      targetLabel: { keyVi: 'Mục tiêu', keyEn: 'Target' },
      progress: 93,
      actual: 39,
    },
    {
      title: { keyVi: 'Kế hoạch lao động', keyEn: 'Labor plan' },
      tooltip: {
        keyVi: 'Tải luân chuyển/Số lao động sử dụng bình quân của kỳ đó',
        keyEn: 'Turnover load/Average labor used in the period',
      },
      variant: 'success',
      metricCode: 'HRD_004',
      unit: { keyVi: 'Người', keyEn: 'People' },
      statusLabel: { keyVi: 'ĐẠT', keyEn: 'ACHIEVED' },
      trendDirection: 'down',
      trendValue: 0.5,
      trendLabel: { keyVi: 'với kỳ trước', keyEn: 'vs previous period' },
      target: 7.2,
      targetLabel: { keyVi: 'Mục tiêu', keyEn: 'Target' },
      progress: 100,
      actual: 7.195,
    },
  ],
};

const ALL_BOARD_META = [
  {
    titleVi: 'Năng suất lao động',
    titleEn: 'Labor Productivity',
    subVi: 'Đơn vị: 1.000 tấn.km/LĐ',
    subEn: 'Unit: 1,000 ton-km/Labor',
  },
  {
    titleVi: 'Mức độ hài lòng và gắn kết của nhân viên',
    titleEn: 'Employee satisfaction and engagement',
    subVi: 'Đơn vị: %',
    subEn: 'Unit: %',
  },
  {
    titleVi: 'Tiền lương bình quân',
    titleEn: 'Average salary',
    subVi: 'Đơn vị: Triệu VNĐ/người/tháng',
    subEn: 'Unit: Million VND/person/month',
  },
  {
    titleVi: 'Kế hoạch lao động',
    titleEn: 'Labor plan',
    subVi: 'Đơn vị: Người',
    subEn: 'Unit: People',
  },
];

function shouldSkip(relativePath) {
  return SKIP_PATTERNS.some((p) => p.test(relativePath));
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 4) + '\n');
}

function replaceOrgInJson(data) {
  const json = JSON.stringify(data).replace(/TCNL\/BGD/g, 'TCNL/HDQT');
  return JSON.parse(json);
}

function isFlightKpi(kpi) {
  return /Giờ bay/i.test(kpi.title.keyVi);
}

function filterKpisAll(kpis) {
  return kpis.filter((k) => !isFlightKpi(k));
}

function computeOverviewFromKpis(kpis) {
  const total = kpis.length;
  const achieved = kpis.filter((k) => k.statusLabel.keyVi === 'ĐẠT').length;
  const notAchieved = total - achieved;
  const progress = total > 0 ? Math.round((achieved / total) * 100) : 0;
  return { progress, total, achieved, notAchieved };
}

function buildOverview(year, kpisAll) {
  const template = readJson(path.join(SOURCE, `${year}/overview/index.json`));

  const stats =
    year === 'Y_2026'
      ? FIGMA_Y2026.overview
      : computeOverviewFromKpis(kpisAll);

  template.data[0].data.progress.value = stats.progress;
  template.data[0].data.statistics[0].value = stats.total;
  template.data[0].data.statistics[1].value = stats.achieved;
  template.data[0].data.statistics[2].value = stats.notAchieved;

  template.filter =
    year === 'Y_2026'
      ? FIGMA_Y2026.filter
      : [
          { title: [{ keyVi: 'Tất cả', keyEn: 'All' }], path: '/', count: stats.total },
          {
            title: [{ keyVi: 'Năng suất lao động', keyEn: 'Labor Productivity' }],
            path: '/labor-productivity',
            count: 2,
          },
          {
            title: [{ keyVi: 'Tiền lương', keyEn: 'Salary' }],
            path: '/salary',
            count: 1,
          },
          {
            title: [{ keyVi: 'Lao động', keyEn: 'Labor' }],
            path: '/labor',
            count: 1,
          },
        ];

  return template;
}

function buildKpisAll(year) {
  if (year === 'Y_2026') return FIGMA_Y2026.kpis;
  return filterKpisAll(readJson(path.join(SOURCE, `${year}/kpis/all/index.json`)));
}

function buildBoardAllIndex(year) {
  const baseUrl =
    'https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main/ApiV2/TCNL/HDQT/Y';
  return [
    {
      title: { keyVi: 'Chi tiết', keyEn: 'Details' },
      grid: 2,
      child: ALL_BOARD_META.map((meta, i) => ({
        title: { keyVi: meta.titleVi, keyEn: meta.titleEn },
        subTitle: { keyVi: meta.subVi, keyEn: meta.subEn },
        child: `${baseUrl}/${year}/board/all/chart/index${i}.json`,
      })),
    },
  ];
}

function syncChartLastPoint(year, kpisAll) {
  const yearIdx = parseInt(year.replace('Y_', ''), 10) - 2022;
  if (yearIdx < 0 || yearIdx > 4) return;

  const chartMap = [
    { file: 'index0.json', seriesKey: 'Thực hiện', kpiIdx: 0 },
    { file: 'index1.json', seriesKey: 'Hài lòng', kpiIdx: 1 },
    { file: 'index2.json', seriesKey: 'TLBQ (triệu VNĐ)', kpiIdx: 2 },
    { file: 'index3.json', seriesKey: 'Thực hiện', kpiIdx: 3 },
  ];

  for (const { file, seriesKey, kpiIdx } of chartMap) {
    const chartPath = path.join(TARGET, year, 'board/all/chart', file);
    if (!fs.existsSync(chartPath) || !kpisAll[kpiIdx]) continue;
    const chart = readJson(chartPath);
    const series = chart.data.find((d) => d.key.keyVi === seriesKey);
    if (series && series.name[yearIdx] !== undefined) {
      series.name[yearIdx] = kpisAll[kpiIdx].actual;
    }
    writeJson(chartPath, chart);
  }
}

function copyYear(year) {
  const srcDir = path.join(SOURCE, year);
  const tgtDir = path.join(TARGET, year);

  function walk(relDir) {
    const absSrc = path.join(srcDir, relDir);
    if (!fs.existsSync(absSrc)) return;

    for (const entry of fs.readdirSync(absSrc, { withFileTypes: true })) {
      const relPath = path.join(relDir, entry.name).replace(/\\/g, '/');
      if (shouldSkip(relPath)) continue;

      const srcPath = path.join(absSrc, entry.name);
      const tgtPath = path.join(tgtDir, relPath);

      if (entry.isDirectory()) {
        walk(relPath);
        continue;
      }

      // Skip flight-time charts in board/all (index4, index5)
      if (/board\/all\/chart\/index[45]\.json$/.test(relPath)) continue;

      writeJson(tgtPath, replaceOrgInJson(readJson(srcPath)));
    }
  }

  walk('');

  const kpisAll = buildKpisAll(year);
  writeJson(path.join(tgtDir, 'overview/index.json'), buildOverview(year, kpisAll));
  writeJson(path.join(tgtDir, 'kpis/all/index.json'), kpisAll);
  writeJson(path.join(tgtDir, 'board/all/index.json'), buildBoardAllIndex(year));

  syncChartLastPoint(year, kpisAll);

  const stats = computeOverviewFromKpis(kpisAll);
  console.log(
    `${year}: ${stats.total} KPIs | ${stats.achieved} đạt | ${stats.notAchieved} không đạt | ${stats.progress}%`
  );
}

for (const year of YEARS) copyYear(year);
console.log('Done. Generated ApiV2/TCNL/HDQT/Y/Y_2022 .. Y_2026');

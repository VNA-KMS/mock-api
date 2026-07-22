#!/usr/bin/env node
/**
 * Generate D (day) and W (week) mock data for product-marketing,
 * mirroring the M (month) structure.
 *
 *   - D_1 .. D_31   (31 items, labels "1".."31")
 *   - W_1 .. W_53   (53 items, labels "W1".."W53")
 *
 * Per item we create:
 *   overview/index.json
 *   kpis/{all,network}/index.json        (3 items, no "Thị phần hàng hoá vận chuyển")
 *   board/{all,network}/index.json       (1 panel, 6 child charts)
 *   board/{all,network}/chart/index0..5.json
 *
 * KPI cards: Sản lượng, Doanh thu, Hệ số sử dụng tải (3 items)
 * Overview: 3 chỉ tiêu, 3 đạt / 0 không đạt
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(
  __dirname,
  '..',
  'ApiV2/demoV2/BGD/commercial-services/product-marketing'
);

// ---- Seeded PRNG (mulberry32) -------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts) {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function round(value, decimals = 1) {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
}

function genSeries(rng, n, min, max, decimals = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(round(min + rng() * (max - min), decimals));
  }
  return out;
}

// ---- Chart definitions ---------------------------------------------------
// title, subTitle, min, max, decimals, key ("Thực tế + Dự báo" | "Thực tế"),
// numberOfSeries (3 with CK+KH or 1 if Thị phần uses just 1 line)
const CHART_DEFS = [
  {
    title: 'Sản lượng hàng hóa theo thời gian',
    subTitle: 'Theo dõi xu hướng thực hiện, kế hoạch và cùng kỳ theo thời gian',
    min: 540,
    max: 760,
    decimals: 0,
    key: 'Thực tế + Dự báo',
    seriesKeys: ['Thực tế + Dự báo', 'Cùng kỳ', 'Kế hoạch'],
    ranges: [
      [560, 760], // thực tế
      [520, 720], // cùng kỳ
      [540, 740], // kế hoạch
    ],
    dashLast: [5, 3],
  },
  {
    title: 'Sản lượng hàng hóa lũy kế theo thời gian',
    subTitle: 'Theo dõi mức tích lũy thực hiện, cùng kỳ và kế hoạch theo tháng',
    min: 0,
    max: 7800,
    decimals: 0,
    key: 'Thực tế + Dự báo',
    seriesKeys: ['Thực tế + Dự báo', 'Cùng kỳ', 'Kế hoạch'],
    ranges: [
      [200, 1800],
      [200, 1700],
      [200, 1800],
    ],
    cumulative: true,
    dashLast: [5, 3],
  },
  {
    title: 'Doanh thu hàng hóa theo thời gian',
    subTitle: 'Theo dõi doanh thu thực hiện, kế hoạch và cùng kỳ theo thời gian',
    min: 800,
    max: 1900,
    decimals: 0,
    key: 'Thực tế + Dự báo',
    seriesKeys: ['Thực tế + Dự báo', 'Cùng kỳ', 'Kế hoạch'],
    ranges: [
      [800, 1900],
      [750, 1800],
      [800, 1900],
    ],
    dashLast: [5, 3],
  },
  {
    title: 'Doanh thu hàng hóa lũy kế theo thời gian',
    subTitle: 'Theo dõi doanh thu tích lũy thực hiện, cùng kỳ và kế hoạch theo tháng',
    min: 1000,
    max: 18000,
    decimals: 0,
    key: 'Thực tế + Dự báo',
    seriesKeys: ['Thực tế + Dự báo', 'Cùng kỳ', 'Kế hoạch'],
    ranges: [
      [200, 1900],
      [200, 1800],
      [200, 1900],
    ],
    cumulative: true,
    dashLast: [5, 3],
  },
  {
    title: 'Hệ số sử dụng tải theo thời gian',
    subTitle: 'Theo dõi hệ số sử dụng tải thực hiện, cùng kỳ và kế hoạch theo tháng',
    min: 0.55,
    max: 0.8,
    decimals: 2,
    key: 'Thực tế',
    seriesKeys: ['Thực tế', 'Cùng kỳ', 'Kế hoạch'],
    ranges: [
      [0.55, 0.8],
      [0.55, 0.78],
      [0.55, 0.8],
    ],
    dashLast: [5, 3],
  },
  {
    title: 'Thị phần hàng hóa theo thời gian',
    subTitle: 'Theo dõi thị phần thực hiện, cùng kỳ và kế hoạch theo tháng',
    min: 12,
    max: 28,
    decimals: 1,
    key: 'Thực tế',
    seriesKeys: ['Thực tế', 'Cùng kỳ', 'Kế hoạch'],
    ranges: [
      [12, 28],
      [12, 26],
      [12, 28],
    ],
    dashLast: [5, 3],
  },
];

// ---- KPI templates -------------------------------------------------------
// 3-item set (for D/W — no "Thị phần hàng hoá vận chuyển")
const KPI_TEMPLATES_3 = [
  {
    name: 'Sản lượng Hàng hoá, bưu kiện',
    code: 'CPM-002',
    unit: 'Giờ/người/tháng',
    tooltip:
      'Đơn vị: Giờ/người/tháng · Nguồn: AVES · Đạt: ≥ Định mức (±8%)',
    valueRange: [60, 95],
    compRange: [
      ['+1.0%', '+5.0%'],
      ['-3.0%', '+4.0%'],
    ],
  },
  {
    name: 'Doanh thu hàng hoá, bưu kiện',
    code: 'CPM-005',
    unit: 'Giờ/người/tháng',
    tooltip:
      'Đơn vị: Giờ/người/tháng · Nguồn: AVES · Đạt: ≥ Định mức (±7%)',
    valueRange: [60, 95],
    compRange: [
      ['+1.0%', '+6.0%'],
      ['-2.0%', '+3.0%'],
    ],
  },
  {
    name: 'Hệ số sử dụng tải hàng',
    code: 'CPM-004',
    unit: 'Giờ/người/tháng',
    tooltip:
      'Đơn vị: Giờ/người/tháng · Nguồn: AVES · Đạt: ≥ Định mức (±5%)',
    valueRange: [55, 90],
    compRange: [
      ['-4.0%', '+1.0%'],
      ['+2.0%', '+8.0%'],
    ],
  },
];

// 4-item set (for M/Q/Y — full set including "Thị phần hàng hoá vận chuyển")
const KPI_TEMPLATES_4 = [
  ...KPI_TEMPLATES_3,
  {
    name: 'Thị phần hàng hoá vận chuyển',
    code: 'CPM-001',
    unit: 'Giờ/người/tháng',
    tooltip:
      'Đơn vị: Giờ/người/tháng · Nguồn: AVES · Đạt: ≥ Định mức (±10%)',
    valueRange: [55, 90],
    compRange: [
      ['+5.0%', '+12.0%'],
      ['+8.0%', '+15.0%'],
    ],
  },
];

// ---- Builders ------------------------------------------------------------
function buildLabels(prefix, n) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(`${prefix}${i}`);
  return out;
}

function buildChart(def, prefix, n, itemKey, scope) {
  const rng = mulberry32(hashSeed(itemKey, scope, def.title));
  const labels = buildLabels(prefix, n);
  const data = def.seriesKeys.map((key, idx) => {
    const [lo, hi] = def.ranges[idx];
    let values = genSeries(rng, n, lo, hi, def.decimals);
    if (def.cumulative) {
      // make it monotonically increasing
      for (let i = 1; i < values.length; i++) {
        values[i] = round(values[i] + values[i - 1], def.decimals);
      }
    }
    const isLast = idx === def.seriesKeys.length - 1;
    return {
      key,
      name: values,
      color: isLast ? ['#16a34a'] : idx === 1 ? ['#e67e22'] : ['#2d6a9f'],
      type: null,
      tension: 0.35,
      borderDash: isLast ? def.dashLast : null,
      fill: false,
    };
  });

  return {
    chartKey: 'line',
    config: {
      insightLayout: 'inline',
      minValue: def.min,
      maxValue: def.max,
      height: 200,
    },
    title: def.title,
    subTitle: def.subTitle,
    direction: 'vertical',
    labels,
    data,
    insightLines: ['Nội dung do AI tổng hợp và đề xuất'],
  };
}

function buildBoardIndex(kind, itemKey, scope, baseUrl) {
  const childUrls = CHART_DEFS.map((_, i) =>
    `${baseUrl}/${kind}/${itemKey}/board/${scope}/chart/index${i}.json`
  );
  return [
    {
      title: 'Giờ bay Phi công',
      subTitle: 'Đơn vị: Giờ/người/tháng · Nguồn: AVES · Đạt: ≥ Định mức (±10%)',
      grid: 2,
      child: CHART_DEFS.map((def, i) => ({
        title: def.title,
        subTitle: '',
        child: childUrls[i],
      })),
    },
  ];
}

function buildKpis(itemKey, scope, templates) {
  const rng = mulberry32(hashSeed(itemKey, scope, 'kpis'));
  return templates.map((kpi) => {
    const before = round(kpi.valueRange[0] + rng() * (kpi.valueRange[1] - kpi.valueRange[0]), 1);
    const after = round(kpi.valueRange[0] + rng() * (kpi.valueRange[1] - kpi.valueRange[0]), 1);
    const comp0Lo = parseFloat(kpi.compRange[0][0]);
    const comp0Hi = parseFloat(kpi.compRange[0][1]);
    const comp1Lo = parseFloat(kpi.compRange[1][0]);
    const comp1Hi = parseFloat(kpi.compRange[1][1]);
    const v0 = round(comp0Lo + rng() * (comp0Hi - comp0Lo), 1);
    const v1 = round(comp1Lo + rng() * (comp1Hi - comp1Lo), 1);
    const status0 = v0 >= 0 ? 1 : 0;
    const status1 = v1 >= 0 ? 1 : 0;
    return {
      status: 1,
      name: kpi.name,
      code: kpi.code,
      unit: kpi.unit,
      change: {
        before: before.toFixed(1),
        after: after.toFixed(1),
      },
      comparisons: [
        { label: 'vs CK:', status: status0, value: (v0 >= 0 ? '+' : '') + v0.toFixed(1).replace('.', ',') + '%' },
        { label: 'vs KH:', status: status1, value: (v1 >= 0 ? '+' : '') + v1.toFixed(1).replace('.', ',') + '%' },
      ],
      tooltip: kpi.tooltip,
    };
  });
}

function buildOverview(count) {
  return {
    title: 'TỔNG KPIS',
    percent: 100,
    data: [
      { label: 'CHỈ TIÊU', value: String(count), status: 2 },
      { label: 'ĐẠT', value: String(count), status: 1 },
      { label: 'KHÔNG ĐẠT', value: '0', status: 0 },
    ],
  };
}

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 4) + '\n', 'utf8');
}

// ---- Main ---------------------------------------------------------------
function generateItem({ kind, itemKey, labelPrefix, labelCount, templates, baseUrl }) {
  const itemDir = path.join(BASE, kind, itemKey);
  const kpiCount = templates.length;

  // overview
  writeJson(path.join(itemDir, 'overview/index.json'), buildOverview(kpiCount));

  // kpis
  writeJson(path.join(itemDir, 'kpis/all/index.json'), buildKpis(itemKey, 'all', templates));
  writeJson(path.join(itemDir, 'kpis/network/index.json'), buildKpis(itemKey, 'network', templates));

  // board
  writeJson(
    path.join(itemDir, 'board/all/index.json'),
    buildBoardIndex(kind, itemKey, 'all', baseUrl)
  );
  writeJson(
    path.join(itemDir, 'board/network/index.json'),
    buildBoardIndex(kind, itemKey, 'network', baseUrl)
  );

  // charts
  for (const scope of ['all', 'network']) {
    CHART_DEFS.forEach((def, i) => {
      const chart = buildChart(def, labelPrefix, labelCount, itemKey, scope);
      writeJson(
        path.join(itemDir, `board/${scope}/chart/index${i}.json`),
        chart
      );
    });
  }
}

const BASE_URL =
  'https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main/ApiV2/demoV2/BGD/commercial-services/product-marketing';

function main() {
  // D_1..D_31  (3 KPIs, 31 day labels)
  for (let i = 1; i <= 31; i++) {
    generateItem({
      kind: 'D',
      itemKey: `D_${i}`,
      labelPrefix: '',
      labelCount: 31,
      templates: KPI_TEMPLATES_3,
      baseUrl: BASE_URL,
    });
  }
  // W_1..W_53  (3 KPIs, 53 week labels "W1".."W53")
  for (let i = 1; i <= 53; i++) {
    generateItem({
      kind: 'W',
      itemKey: `W_${i}`,
      labelPrefix: 'W',
      labelCount: 53,
      templates: KPI_TEMPLATES_3,
      baseUrl: BASE_URL,
    });
  }
  // Y_2022..Y_2026  (4 KPIs full set, 12 month labels "T1".."T12")
  for (const year of [2022, 2023, 2024, 2025, 2026]) {
    generateItem({
      kind: 'Y',
      itemKey: `Y_${year}`,
      labelPrefix: 'T',
      labelCount: 12,
      templates: KPI_TEMPLATES_4,
      baseUrl: BASE_URL,
    });
  }
  console.log('Done.');
}

main();

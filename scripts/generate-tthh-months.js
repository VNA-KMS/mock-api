#!/usr/bin/env node
/**
 * Generate TTHH mock data M_1 .. M_11 from M_12 template.
 * KPI actual / trend / progress derived from 12-month chart series.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../ApiV2/CMDV/CQDV/TTHH/M');
const TEMPLATE = path.join(ROOT, 'M_12');
const BASE_URL =
  'https://raw.githubusercontent.com/VNA-KMS/mock-api/refs/heads/main/ApiV2/CMDV/CQDV/TTHH/M';

const MONTH_NAMES_VI = [
  '', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];
const MONTH_NAMES_EN = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT_EN = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTH_END_DATES = [
  '', '31/01/2026', '28/02/2026', '31/03/2026', '30/04/2026', '31/05/2026', '30/06/2026',
  '31/07/2026', '31/08/2026', '30/09/2026', '31/10/2026', '30/11/2026', '31/12/2026',
];

/** 12-month coherent cargo model — more seasonal swing & mid-year momentum */
const SERIES = {
  CPM_001: {
    TH: [77.2, 76.4, 79.8, 81.2, 81.9, 83.1, 84.6, 85.9, 86.5, 87.0, 87.8, 88.6],
    KH: [70.0, 70.6, 72.2, 73.5, 74.2, 75.0, 75.6, 76.0, 76.2, 76.3, 76.1, 76.0],
    CK: [75.6, 75.0, 77.8, 79.0, 79.8, 80.6, 81.8, 83.1, 84.0, 84.9, 85.5, 86.0],
    decimals: 1,
    trendLabel: { keyVi: 'điểm % so với kỳ trước', keyEn: 'pp vs prior period' },
  },
  CPM_002: {
    TH: [2185, 2095, 2510, 2645, 2755, 2880, 3025, 3045, 3110, 3195, 3375, 3565],
    KH: [2000, 2010, 2285, 2410, 2505, 2595, 2685, 2690, 2755, 2850, 3000, 3125],
    CK: [2045, 1965, 2355, 2490, 2600, 2720, 2860, 2880, 2945, 3025, 3195, 3350],
    decimals: 0,
    trendLabel: { keyVi: 'so với kỳ trước', keyEn: 'vs prior period' },
  },
  CPM_003: {
    TH: [75.8, 71.6, 84.2, 87.8, 90.5, 94.0, 99.2, 99.8, 102.0, 104.8, 110.2, 116.5],
    KH: [75.0, 71.2, 81.5, 85.8, 89.0, 91.5, 95.0, 94.8, 97.2, 100.8, 106.0, 110.5],
    CK: [71.8, 68.5, 78.8, 82.5, 86.0, 89.2, 93.5, 94.0, 96.2, 99.0, 104.5, 109.5],
    decimals: 1,
    trendLabel: { keyVi: 'so với kỳ trước', keyEn: 'vs prior period' },
  },
  CPM_004: {
    TH: [46.3, 48.1, 49.8, 50.7, 51.4, 52.3, 53.6, 54.8, 55.2, 54.9, 55.4, 56.1],
    KH: [50.0, 50.8, 51.8, 52.6, 53.2, 53.9, 54.5, 54.8, 55.0, 55.1, 55.0, 54.9],
    CK: [48.2, 49.0, 50.2, 51.0, 51.6, 52.2, 53.2, 54.0, 54.4, 54.2, 54.6, 55.0],
    decimals: 1,
    trendLabel: { keyVi: 'điểm % so với kỳ trước', keyEn: 'pp vs prior period' },
  },
  CPM_005: {
    TH: [928, 895, 1035, 1080, 1120, 1165, 1225, 1235, 1260, 1295, 1365, 1440],
    KH: [800, 805, 920, 965, 1000, 1035, 1080, 1075, 1105, 1140, 1200, 1255],
    CK: [865, 840, 975, 1020, 1060, 1095, 1155, 1160, 1185, 1220, 1285, 1350],
    decimals: 0,
    trendLabel: { keyVi: 'so với kỳ trước', keyEn: 'vs prior period' },
  },
};

const KPI_FOLDERS = ['CPM_001', 'CPM_002', 'CPM_003', 'CPM_004', 'CPM_005'];
const CHART_COUNT = 6;

const KPI_META = {
  CPM_001: {
    titleVi: 'Thị phần hàng hóa vận chuyển',
    titleEn: 'Cargo market share',
    unitVi: '%',
    unitEn: '%',
    slug: '%',
  },
  CPM_002: {
    titleVi: 'Sản lượng hàng hóa, bưu kiện',
    titleEn: 'Cargo and mail volume',
    unitVi: 'Tấn',
    unitEn: 'Ton',
    slug: 'Tấn',
  },
  CPM_003: {
    titleVi: 'Hàng hóa, bưu kiện luân chuyển (RFTK)',
    titleEn: 'Cargo and mail turnover (RFTK)',
    unitVi: 'Nghìn tấn.km',
    unitEn: 'Thousand ton-km',
    slug: 'Nghìn tấn.km',
  },
  CPM_004: {
    titleVi: 'Hệ số sử dụng tải hàng',
    titleEn: 'Cargo load factor',
    unitVi: '%',
    unitEn: '%',
    slug: '%',
  },
  CPM_005: {
    titleVi: 'Doanh thu hàng hóa, bưu kiện',
    titleEn: 'Cargo and mail revenue',
    unitVi: 'Triệu VNĐ',
    unitEn: 'Million VND',
    slug: 'Triệu VNĐ',
  },
};

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 4)}\n`, 'utf8');
}

function roundVal(n, decimals) {
  if (decimals === 0) return Math.round(n);
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function monthCtx(month) {
  const pad = String(month).padStart(2, '0');
  return {
    month,
    pad,
    short: `T${month}/26`,
    shortFull: `T${month}/2026`,
    vi: `${MONTH_NAMES_VI[month]}/2026`,
    en: `${MONTH_NAMES_EN[month]} 2026`,
    shortEn: MONTH_SHORT_EN[month],
    endDate: MONTH_END_DATES[month],
    label: `${month}T/2026`,
  };
}

function kpiMetrics(metricCode, monthIdx) {
  const s = SERIES[metricCode];
  const actual = roundVal(s.TH[monthIdx], s.decimals);
  const target = roundVal(s.KH[monthIdx], s.decimals);
  const prev = monthIdx > 0 ? roundVal(s.TH[monthIdx - 1], s.decimals) : actual;
  const diff = roundVal(Math.abs(actual - prev), s.decimals);

  let trendDirection = 'flat';
  if (monthIdx > 0) {
    if (actual > prev) trendDirection = 'up';
    else if (actual < prev) trendDirection = 'down';
  }

  const achieved = actual >= target;
  const progress = Math.round((actual / target) * 100);

  return {
    actual,
    target,
    trendValue: monthIdx === 0 ? (metricCode === 'CPM_001' ? 1.4 : metricCode === 'CPM_004' ? 0.8 : diff) : diff,
    trendDirection: monthIdx === 0 ? (metricCode === 'CPM_004' ? 'down' : 'up') : trendDirection,
    variant: achieved ? 'success' : 'error',
    statusLabel: achieved
      ? { keyVi: 'ĐẠT', keyEn: 'ACHIEVED' }
      : { keyVi: 'KHÔNG ĐẠT', keyEn: 'NOT ACHIEVED' },
    progress,
  };
}

function updateConfigRange(chart) {
  if (!chart.config) return;
  const values = chart.data.flatMap((s) => (Array.isArray(s.name) ? s.name.filter((v) => typeof v === 'number') : []));
  if (!values.length) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || max * 0.08 || 1;
  chart.config.minValue = roundVal(min - pad, max >= 100 ? 0 : 2);
  chart.config.maxValue = roundVal(max + pad, max >= 100 ? 0 : 2);
}

function scaleValues(values, factor, decimals, jitter = 0) {
  return values.map((v, i) => {
    if (typeof v !== 'number') return v;
    const j = 1 + (i % 2 === 0 ? jitter : -jitter);
    return roundVal(v * factor * j, decimals);
  });
}

function buildBulletChart(template, metricCode, month) {
  const ctx = monthCtx(month);
  const idx = month - 1;
  const s = SERIES[metricCode];
  const meta = KPI_META[metricCode];
  const m = kpiMetrics(metricCode, idx);
  const chart = JSON.parse(JSON.stringify(template));

  chart.subTitle.keyVi = `Tổng hợp ${ctx.vi} · ${meta.slug}`;
  chart.subTitle.keyEn = `${ctx.en} summary · ${meta.unitEn}`;

  const th = m.actual;
  const kh = m.target;
  chart.data[0].key.keyVi = `${meta.titleVi} · ${ctx.shortFull}`;
  chart.data[0].key.keyEn = `${meta.titleEn} · ${ctx.shortEn} 2026`;
  chart.data[0].name = [th, kh];

  const gap = roundVal(Math.abs(th - kh), s.decimals);
  const pct = m.progress;
  if (m.variant === 'success') {
    chart.insightLines[0].keyVi = `TH ${th}${meta.unitVi === '%' ? '%' : ` ${meta.unitVi}`} so với KH ${kh} — vượt ${gap} (${pct}% hoàn thành).`;
    chart.insightLines[0].keyEn = `Actual ${th} vs plan ${kh} — ahead by ${gap} (${pct}% completion).`;
  } else {
    chart.insightLines[0].keyVi = `TH ${th}${meta.unitVi === '%' ? '%' : ` ${meta.unitVi}`} so với KH ${kh} — thiếu ${gap} (${pct}% hoàn thành).`;
    chart.insightLines[0].keyEn = `Actual ${th} vs plan ${kh} — short by ${gap} (${pct}% completion).`;
  }

  updateConfigRange(chart);
  return chart;
}

function buildTrendChart(template, metricCode, month) {
  const idx = month - 1;
  const s = SERIES[metricCode];
  const meta = KPI_META[metricCode];
  const m = kpiMetrics(metricCode, idx);
  const chart = JSON.parse(JSON.stringify(template));

  chart.data = chart.data.map((series, si) => ({
    ...series,
    name: ['TH', 'KH', 'CK'].map((k, i) => {
      const key = si === 0 ? 'TH' : si === 1 ? 'KH' : 'CK';
      return s[key].map((v) => roundVal(v, s.decimals));
    })[si] ?? series.name,
  }));

  // Fix: map series by key
  chart.data = chart.data.map((series) => {
    const keyVi = series.key.keyVi || '';
    let src = s.TH;
    if (/KH|Kế hoạch|Plan/i.test(keyVi)) src = s.KH;
    else if (/Cùng kỳ|Same period/i.test(keyVi)) src = s.CK;
    return { ...series, name: src.map((v) => roundVal(v, s.decimals)) };
  });

  const th12 = s.TH[11];
  const kh12 = s.KH[11];
  const gap12 = roundVal(th12 - kh12, s.decimals);
  chart.insightLines[0].keyVi = `${meta.titleVi} tháng ${month} đạt ${m.actual} ${meta.unitVi} (${m.progress}% KH). Mùa cao điểm T11–T12; chênh lệch T12 so với KH: ${gap12 >= 0 ? '+' : ''}${gap12} ${meta.unitVi}.`;
  chart.insightLines[0].keyEn = `${meta.titleEn} in ${MONTH_NAMES_EN[month]}: ${m.actual} ${meta.unitEn} (${m.progress}% of plan). Peak Nov–Dec; Dec gap vs plan: ${gap12 >= 0 ? '+' : ''}${gap12} ${meta.unitEn}.`;

  updateConfigRange(chart);
  return chart;
}

function buildScaledChart(template, metricCode, month, chartIdx) {
  const idx = month - 1;
  const s = SERIES[metricCode];
  const meta = KPI_META[metricCode];
  const baseActual = s.TH[0];
  const currentActual = s.TH[idx];
  const factor = currentActual / baseActual;
  const jitter = 0.015 * (chartIdx % 3);
  const chart = JSON.parse(JSON.stringify(template));

  if (metricCode === 'CPM_001' || metricCode === 'CPM_004') {
    chart.data = chart.data.map((series) => ({
      ...series,
      name: scaleValues(series.name, 1 + (factor - 1) * 0.85, s.decimals, jitter),
    }));
  } else {
    chart.data = chart.data.map((series) => ({
      ...series,
      name: scaleValues(series.name, factor, s.decimals, jitter),
    }));
  }

  // Doughnut / sector — ensure sum ≈ actual
  if (chart.chartKey === 'doughnut' && chart.data[0]?.name?.length === 4) {
    const total = chart.data[0].name.reduce((a, b) => a + b, 0);
    const targetTotal = kpiMetrics(metricCode, idx).actual;
    const fix = targetTotal / total;
    chart.data[0].name = chart.data[0].name.map((v) => roundVal(v * fix, s.decimals));
    chart.data[0].key.keyVi = `Cơ cấu ${meta.titleVi} · ${monthCtx(month).shortFull}`;
    chart.data[0].key.keyEn = `${meta.titleEn} mix · ${monthCtx(month).shortEn} 2026`;
  }

  updateConfigRange(chart);
  return chart;
}

function patchMonthStrings(obj, month) {
  if (Array.isArray(obj)) return obj.map((v) => patchMonthStrings(v, month));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'child' && typeof v === 'string' && v.includes('/TTHH/M/M_')) {
        out[k] = v.replace(/M_\d+\/board\/tthh/g, `M_${month}/board/tthh`);
      } else if (typeof v === 'string') {
        out[k] = v
          .replace(/Tháng \d+\/2026/g, monthCtx(month).vi)
          .replace(/January|February|March|April|May|June|July|August|September|October|November|December 2026/g, monthCtx(month).en)
          .replace(/T\d+\/2026/g, monthCtx(month).shortFull)
          .replace(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec 2026/g, `${monthCtx(month).shortEn} 2026`)
          .replace(/23\/04\/2026/g, monthCtx(month).endDate)
          .replace(/ApiV2\/CMDV\/CQDV\/TTHH\/M\/M_\d+/g, `ApiV2/CMDV/CQDV/TTHH/M/M_${month}`);
      } else {
        out[k] = patchMonthStrings(v, month);
      }
    }
    return out;
  }
  return obj;
}

function buildKpisTthh(month) {
  const template = readJson(path.join(TEMPLATE, 'kpis/tthh/index.json'));
  const idx = month - 1;

  return template.map((card) => {
    const code = card.metricCode;
    const m = kpiMetrics(code, idx);
    const meta = KPI_META[code];
    return {
      ...card,
      actual: m.actual,
      target: m.target,
      trendValue: m.trendValue,
      trendDirection: m.trendDirection,
      variant: m.variant,
      statusLabel: m.statusLabel,
      progress: m.progress,
      trendLabel: SERIES[code].trendLabel,
      detail: `ApiV2/CMDV/CQDV/TTHH/M/M_${month}/board/tthh/${code}/index.json`,
    };
  });
}

function buildOverviewTthh(month) {
  const kpis = buildKpisTthh(month);
  const achieved = kpis.filter((k) => k.variant === 'success').length;
  const notAchieved = kpis.length - achieved;
  const ctx = monthCtx(month);

  return {
    data: [
      {
        type: 'summary',
        title: { keyVi: 'Tổng KPIs tháng', keyEn: 'Monthly KPI summary' },
        data: {
          progress: {
            value: Math.round((achieved / kpis.length) * 100),
            label: { keyVi: 'Đạt', keyEn: 'Achieved' },
          },
          statistics: [
            { label: { keyVi: 'Chỉ tiêu', keyEn: 'KPIs' }, value: kpis.length },
            { label: { keyVi: 'Đạt', keyEn: 'Achieved' }, value: achieved },
            { label: { keyVi: 'Không đạt', keyEn: 'Not achieved' }, value: notAchieved },
          ],
        },
      },
    ],
    message: notAchieved > 0
      ? {
          keyVi: `${notAchieved} KPI không đạt mục tiêu trong ${ctx.endDate}`,
          keyEn: `${notAchieved} KPI${notAchieved > 1 ? 's' : ''} not achieved in ${ctx.endDate}.`,
        }
      : {
          keyVi: `Tất cả KPI đạt mục tiêu trong ${ctx.endDate}`,
          keyEn: `All KPIs achieved in ${ctx.endDate}.`,
        },
    date: ctx.endDate,
  };
}

function buildBoardTthhOverview(month) {
  const template = readJson(path.join(TEMPLATE, 'board/tthh/index.json'));
  const ctx = monthCtx(month);

  return template.map((section, si) => {
    const code = section.metricCode;
    const m = kpiMetrics(code, month - 1);
    const meta = KPI_META[code];
    const next = JSON.parse(JSON.stringify(section));

    next.subTitle.keyVi = next.subTitle.keyVi.replace(/Tháng \d+\/2026/, ctx.vi);
    next.subTitle.keyEn = next.subTitle.keyEn.replace(/January 2026|February 2026|March 2026|April 2026|May 2026|June 2026|July 2026|August 2026|September 2026|October 2026|November 2026|December 2026/, ctx.en);

    if (next.chartKey === 'bar' && next.labels?.[0] === 'TH') {
      next.data[0].name = [m.actual, m.target];
      next.data[0].key.keyVi = `${meta.titleVi} · ${ctx.shortFull}`;
      next.data[0].key.keyEn = `${meta.titleEn} · ${ctx.shortEn} 2026`;
      const gap = roundVal(Math.abs(m.actual - m.target), SERIES[code].decimals);
      next.insightLines[0].keyVi = `TH ${m.actual}${meta.unitVi === '%' ? '%' : ''} so với KH ${m.target} — ${m.variant === 'success' ? 'vượt' : 'thiếu'} ${gap} (${m.progress}% hoàn thành).`;
      next.insightLines[0].keyEn = `Actual ${m.actual} vs plan ${m.target} — ${m.variant === 'success' ? 'ahead' : 'short'} by ${gap} (${m.progress}% completion).`;
      updateConfigRange(next);
    }

    if (next.chartKey === 'line') {
      const s = SERIES[code];
      next.data = next.data.map((series) => {
        const keyVi = series.key.keyVi || '';
        let src = s.TH;
        if (/KH|Kế hoạch|Plan/i.test(keyVi)) src = s.KH;
        else if (/Cùng kỳ|Same period/i.test(keyVi)) src = s.CK;
        return { ...series, name: src.map((v) => roundVal(v, s.decimals)) };
      });
      updateConfigRange(next);
    }

    if (next.chartKey === 'radar') {
      return buildScaledChart(next, code, month, 3);
    }

    if (next.chartKey === 'doughnut') {
      const scaled = buildScaledChart(next, code, month, 5);
      scaled.subTitle.keyVi = `Cơ cấu Sector · ${ctx.vi}`;
      scaled.subTitle.keyEn = `Sector mix · ${ctx.en}`;
      return scaled;
    }

    if (next.chartKey === 'bar' && next.labels?.[0] === 'Nội địa') {
      return buildScaledChart(next, code, month, 2);
    }

    return next;
  });
}

function buildCpmCharts(metricCode, month) {
  const charts = {};
  const srcDir = path.join(TEMPLATE, 'board/tthh', metricCode, 'chart');

  for (let i = 0; i < CHART_COUNT; i++) {
    const template = readJson(path.join(srcDir, `index${i}.json`));
    if (i === 0) charts[`index${i}.json`] = buildBulletChart(template, metricCode, month);
    else if (i === 1) charts[`index${i}.json`] = buildTrendChart(template, metricCode, month);
    else charts[`index${i}.json`] = buildScaledChart(template, metricCode, month, i);
  }
  return charts;
}

function buildCpmIndex(metricCode, month) {
  const template = readJson(path.join(TEMPLATE, 'board/tthh', metricCode, 'index.json'));
  const ctx = monthCtx(month);
  const meta = KPI_META[metricCode];
  const section = JSON.parse(JSON.stringify(template[0]));

  section.subTitle.keyVi = `Đơn vị: ${meta.slug} · Nguồn: BCTM · ${metricCode === 'CPM_004' ? 'CRM Report · RPS' : metricCode === 'CPM_005' ? 'CRA · RAS' : metricCode === 'CPM_002' ? 'CargoSpot · DWH' : metricCode === 'CPM_003' ? 'RPS · DWH' : 'MIS (tổng thị trường)'} · ${ctx.vi}`;
  section.subTitle.keyEn = `Unit: ${meta.unitEn} · Source: BCTM · ${ctx.en}`;

  section.child = section.child.map((c, i) => ({
    ...c,
    child: `${BASE_URL}/M_${month}/board/tthh/${metricCode}/chart/index${i}.json`,
    subTitle: patchMonthStrings(c.subTitle, month),
  }));

  return [section];
}

function generateMonth(month) {
  const monthDir = path.join(ROOT, `M_${month}`);

  writeJson(path.join(monthDir, 'kpis/tthh/index.json'), buildKpisTthh(month));
  writeJson(path.join(monthDir, 'overview/tthh/index.json'), buildOverviewTthh(month));
  writeJson(path.join(monthDir, 'board/tthh/index.json'), buildBoardTthhOverview(month));

  for (const folder of KPI_FOLDERS) {
    writeJson(path.join(monthDir, 'board/tthh', folder, 'index.json'), buildCpmIndex(folder, month));
    const charts = buildCpmCharts(folder, month);
    for (const [file, data] of Object.entries(charts)) {
      writeJson(path.join(monthDir, 'board/tthh', folder, 'chart', file), data);
    }
  }

  const kpis = buildKpisTthh(month);
  const summary = kpis.map((k) => `${k.metricCode}=${k.actual}/${k.target} ${k.trendDirection}`).join(' | ');
  console.log(`M_${month}: ${summary}`);
}

for (let m = 1; m <= 11; m++) generateMonth(m);
generateMonth(12);

console.log('Done — TTHH M_1..M_12 generated.');

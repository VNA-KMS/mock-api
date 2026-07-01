/**
 * Shared TTHH period generator — used by monthly / quarterly / yearly scripts.
 */

const fs = require('fs');
const path = require('path');

const MONTHLY_SERIES = {
  CPM_001: {
    TH: [77.2, 76.4, 79.8, 81.2, 81.9, 83.1, 84.6, 85.9, 86.5, 87.0, 87.8, 88.6],
    KH: [70.0, 70.6, 72.2, 73.5, 74.2, 75.0, 75.6, 76.0, 76.2, 76.3, 76.1, 76.0],
    CK: [75.6, 75.0, 77.8, 79.0, 79.8, 80.6, 81.8, 83.1, 84.0, 84.9, 85.5, 86.0],
    decimals: 1,
    agg: 'avg',
    trendLabel: { keyVi: 'điểm % so với kỳ trước', keyEn: 'pp vs prior period' },
  },
  CPM_002: {
    TH: [2185, 2095, 2510, 2645, 2755, 2880, 3025, 3045, 3110, 3195, 3375, 3565],
    KH: [2000, 2010, 2285, 2410, 2505, 2595, 2685, 2690, 2755, 2850, 3000, 3125],
    CK: [2045, 1965, 2355, 2490, 2600, 2720, 2860, 2880, 2945, 3025, 3195, 3350],
    decimals: 0,
    agg: 'sum',
    trendLabel: { keyVi: 'so với kỳ trước', keyEn: 'vs prior period' },
  },
  CPM_003: {
    TH: [75.8, 71.6, 84.2, 87.8, 90.5, 94.0, 99.2, 99.8, 102.0, 104.8, 110.2, 116.5],
    KH: [75.0, 71.2, 81.5, 85.8, 89.0, 91.5, 95.0, 94.8, 97.2, 100.8, 106.0, 110.5],
    CK: [71.8, 68.5, 78.8, 82.5, 86.0, 89.2, 93.5, 94.0, 96.2, 99.0, 104.5, 109.5],
    decimals: 1,
    agg: 'sum',
    trendLabel: { keyVi: 'so với kỳ trước', keyEn: 'vs prior period' },
  },
  CPM_004: {
    TH: [46.3, 48.1, 49.8, 50.7, 51.4, 52.3, 53.6, 54.8, 55.2, 54.9, 55.4, 56.1],
    KH: [50.0, 50.8, 51.8, 52.6, 53.2, 53.9, 54.5, 54.8, 55.0, 55.1, 55.0, 54.9],
    CK: [48.2, 49.0, 50.2, 51.0, 51.6, 52.2, 53.2, 54.0, 54.4, 54.2, 54.6, 55.0],
    decimals: 1,
    agg: 'avg',
    trendLabel: { keyVi: 'điểm % so với kỳ trước', keyEn: 'pp vs prior period' },
  },
  CPM_005: {
    TH: [928, 895, 1035, 1080, 1120, 1165, 1225, 1235, 1260, 1295, 1365, 1440],
    KH: [800, 805, 920, 965, 1000, 1035, 1080, 1075, 1105, 1140, 1200, 1255],
    CK: [865, 840, 975, 1020, 1060, 1095, 1155, 1160, 1185, 1220, 1285, 1350],
    decimals: 0,
    agg: 'sum',
    trendLabel: { keyVi: 'so với kỳ trước', keyEn: 'vs prior period' },
  },
};

const KPI_FOLDERS = ['CPM_001', 'CPM_002', 'CPM_003', 'CPM_004', 'CPM_005'];
const CHART_COUNT = 6;

const DIVISION_FILTER_ORDER = ['all', 'khpt', 'tthh', 'ttbsp', 'bsv'];

const DIVISION_FILTER_TITLES = {
  all: { keyVi: 'Tất cả', keyEn: 'All' },
  khpt: { keyVi: 'Ban KHPT', keyEn: 'Division KHPT' },
  tthh: { keyVi: 'Ban TTHH', keyEn: 'Division TTHH' },
  ttbsp: { keyVi: 'Ban TTBSP', keyEn: 'Division TTBSP' },
  bsv: { keyVi: 'TT BSV', keyEn: 'TT BSV' },
};

const DIVISION_FILTER_COUNTS = {
  all: 26,
  khpt: 13,
  tthh: 5,
  ttbsp: 6,
  bsv: 2,
};

function buildDivisionFilter(templateIndexPath) {
  let divisions = null;
  if (fs.existsSync(templateIndexPath)) {
    const raw = readJson(templateIndexPath);
    divisions = Array.isArray(raw) ? raw[0] : raw;
  }

  return DIVISION_FILTER_ORDER.map((key) => ({
    title: [divisions?.[key]?.title ?? DIVISION_FILTER_TITLES[key]],
    path: `/${key}`,
    count: divisions?.[key]?.count ?? DIVISION_FILTER_COUNTS[key],
  }));
}

function cloneKpisForDivision(kpis, fromBan, toBan) {
  return kpis.map((item) => {
    const next = { ...item };
    if (typeof next.detail === 'string') {
      next.detail = next.detail.replace(`/board/${fromBan}/`, `/board/${toBan}/`);
    }
    return next;
  });
}

function buildOverviewAllFromTthh(overviewTthh) {
  const overview = JSON.parse(JSON.stringify(overviewTthh));
  const summaryBlock = overview.data?.find((block) => block.type === 'summary');
  if (summaryBlock?.title) {
    summaryBlock.title = {
      keyVi: 'Tổng KPIs toàn CQDV',
      keyEn: 'CQDV-wide KPI summary',
    };
  }
  return overview;
}

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

function aggSlice(values, mode, decimals) {
  if (mode === 'sum') return roundVal(values.reduce((a, b) => a + b, 0), decimals);
  return roundVal(values.reduce((a, b) => a + b, 0) / values.length, decimals);
}

function buildQuarterlySeries() {
  const out = {};
  const slices = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];
  for (const [code, src] of Object.entries(MONTHLY_SERIES)) {
    out[code] = {
      TH: slices.map((idxs) => aggSlice(idxs.map((i) => src.TH[i]), src.agg, src.decimals)),
      KH: slices.map((idxs) => aggSlice(idxs.map((i) => src.KH[i]), src.agg, src.decimals)),
      CK: slices.map((idxs) => aggSlice(idxs.map((i) => src.CK[i]), src.agg, src.decimals)),
      decimals: src.decimals,
      trendLabel: src.trendLabel,
    };
  }
  return out;
}

function buildYearlySeries() {
  const base2026 = {};
  for (const [code, src] of Object.entries(MONTHLY_SERIES)) {
    base2026[code] = {
      TH: aggSlice(src.TH, src.agg, src.decimals),
      KH: aggSlice(src.KH, src.agg, src.decimals),
      CK: aggSlice(src.CK, src.agg, src.decimals),
      decimals: src.decimals,
      trendLabel: src.trendLabel,
    };
  }

  const years = [2022, 2023, 2024, 2025, 2026];
  const growth = [0.82, 0.88, 0.93, 0.97, 1.0];
  const out = {};

  for (const [code, b] of Object.entries(base2026)) {
    out[code] = {
      TH: years.map((_, i) => roundVal(b.TH * growth[i], b.decimals)),
      KH: years.map((_, i) => roundVal(b.KH * (growth[i] + 0.02), b.decimals)),
      CK: years.map((_, i) => roundVal(b.CK * (growth[i] - 0.03 + i * 0.01), b.decimals)),
      decimals: b.decimals,
      trendLabel: b.trendLabel,
    };
    if (code === 'CPM_004') {
      out[code].TH = [44.5, 47.2, 49.8, 52.1, 52.8];
      out[code].KH = [48.0, 49.5, 51.0, 52.5, 53.5];
      out[code].CK = [43.0, 45.5, 48.0, 50.2, 51.0];
    }
  }
  return out;
}

const WEEKS_IN_YEAR = 52;
const DAYS_IN_MONTH = 31;
const WEEKS_PER_MONTH = 4.33;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolateMonthly(monthlyValues, periodIndex, totalPeriods, decimals) {
  const floatIdx = ((periodIndex - 1) * 12) / totalPeriods;
  const i0 = Math.min(11, Math.max(0, Math.floor(floatIdx)));
  const i1 = Math.min(11, i0 + 1);
  const t = floatIdx - i0;
  return roundVal(lerp(monthlyValues[i0], monthlyValues[i1], t), decimals);
}

function buildInterpolatedSeries(totalPeriods, scaleForSum, dailyMonthIdx) {
  const out = {};
  for (const [code, src] of Object.entries(MONTHLY_SERIES)) {
    const sumScale = src.agg === 'sum' ? scaleForSum : 1;
    const buildTrack = (track) => {
      if (dailyMonthIdx != null) {
        const monthStart = src[track][Math.max(0, dailyMonthIdx - 1)] ?? src[track][dailyMonthIdx];
        const monthEnd = src[track][dailyMonthIdx];
        return Array.from({ length: totalPeriods }, (_, i) => {
          const t = totalPeriods === 1 ? 1 : i / (totalPeriods - 1);
          const wave = Math.sin((i / totalPeriods) * Math.PI) * (src.decimals === 0 ? 8 : 0.6);
          return roundVal((lerp(monthStart, monthEnd, t) + wave) * sumScale, src.decimals);
        });
      }
      return Array.from({ length: totalPeriods }, (_, i) =>
        roundVal(interpolateMonthly(src[track], i + 1, totalPeriods, src.decimals) * sumScale, src.decimals),
      );
    };
    out[code] = {
      TH: buildTrack('TH'),
      KH: buildTrack('KH'),
      CK: buildTrack('CK'),
      decimals: src.decimals,
      trendLabel: src.trendLabel,
    };
  }
  return out;
}

function buildWeeklySeries() {
  return buildInterpolatedSeries(WEEKS_IN_YEAR, 1 / WEEKS_PER_MONTH, null);
}

function buildDailySeries(monthIdx = 11) {
  return buildInterpolatedSeries(DAYS_IN_MONTH, 1 / DAYS_IN_MONTH, monthIdx);
}

function sliceTrend(series, idx, count, labelFn) {
  const start = Math.max(0, idx - count + 1);
  const labels = [];
  const tracks = { TH: [], KH: [], CK: [] };
  for (let i = start; i <= idx; i++) {
    labels.push(labelFn(i));
    tracks.TH.push(series.TH[i]);
    tracks.KH.push(series.KH[i]);
    tracks.CK.push(series.CK[i]);
  }
  while (labels.length < count) {
    const pad = start - (count - labels.length);
    const pi = Math.max(0, pad);
    labels.unshift(labelFn(pi));
    tracks.TH.unshift(series.TH[pi]);
    tracks.KH.unshift(series.KH[pi]);
    tracks.CK.unshift(series.CK[pi]);
  }
  return {
    labels: labels.slice(-count),
    TH: tracks.TH.slice(-count),
    KH: tracks.KH.slice(-count),
    CK: tracks.CK.slice(-count),
  };
}

function weekEndDate(week) {
  const d = new Date('2026-01-01');
  d.setDate(d.getDate() + week * 7 - 1);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/2026`;
}

function kpiMetrics(series, metricCode, idx) {
  const s = series[metricCode];
  const actual = roundVal(s.TH[idx], s.decimals);
  const target = roundVal(s.KH[idx], s.decimals);
  const prev = idx > 0 ? roundVal(s.TH[idx - 1], s.decimals) : actual;
  const diff = roundVal(Math.abs(actual - prev), s.decimals);

  let trendDirection = 'flat';
  if (idx > 0) {
    if (actual > prev) trendDirection = 'up';
    else if (actual < prev) trendDirection = 'down';
  }

  const achieved = actual >= target;
  const progress = Math.round((actual / target) * 100);

  return {
    actual,
    target,
    trendValue: diff,
    trendDirection,
    variant: achieved ? 'success' : 'error',
    statusLabel: achieved
      ? { keyVi: 'ĐẠT', keyEn: 'ACHIEVED' }
      : { keyVi: 'KHÔNG ĐẠT', keyEn: 'NOT ACHIEVED' },
    progress,
  };
}

function updateConfigRange(chart) {
  if (!chart.config) return;
  const values = chart.data.flatMap((s) =>
    Array.isArray(s.name) ? s.name.filter((v) => typeof v === 'number') : [],
  );
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

function sourceLabel(series) {
  const keyVi = series.key?.keyVi || '';
  if (/KH|Kế hoạch|Plan/i.test(keyVi)) return 'KH';
  if (/Cùng kỳ|Same period/i.test(keyVi)) return 'CK';
  return 'TH';
}

function buildBulletChart(template, series, metricCode, ctx) {
  const s = series[metricCode];
  const meta = KPI_META[metricCode];
  const m = kpiMetrics(series, metricCode, ctx.idx);
  const chart = JSON.parse(JSON.stringify(template));

  chart.subTitle.keyVi = `Tổng hợp ${ctx.periodVi} · ${meta.slug}`;
  chart.subTitle.keyEn = `${ctx.periodEn} summary · ${meta.unitEn}`;
  chart.data[0].key.keyVi = `${meta.titleVi} · ${ctx.tagFull}`;
  chart.data[0].key.keyEn = `${meta.titleEn} · ${ctx.tagEn}`;
  chart.data[0].name = [m.actual, m.target];

  const gap = roundVal(Math.abs(m.actual - m.target), s.decimals);
  const verbVi = m.variant === 'success' ? 'vượt' : 'thiếu';
  const verbEn = m.variant === 'success' ? 'ahead' : 'short';
  const suffix = meta.unitVi === '%' ? '%' : ` ${meta.unitVi}`;
  chart.insightLines[0].keyVi = `TH ${m.actual}${suffix} so với KH ${m.target} — ${verbVi} ${gap} (${m.progress}% hoàn thành).`;
  chart.insightLines[0].keyEn = `Actual ${m.actual} vs plan ${m.target} — ${verbEn} by ${gap} (${m.progress}% completion).`;

  updateConfigRange(chart);
  return chart;
}

function buildTrendChart(template, series, metricCode, ctx) {
  const s = series[metricCode];
  const meta = KPI_META[metricCode];
  const m = kpiMetrics(series, metricCode, ctx.idx);
  const chart = JSON.parse(JSON.stringify(template));

  chart.title.keyVi = chart.title.keyVi.replace(
    /12 tháng|4 quý|5 năm|12 tuần|12 ngày/g,
    ctx.trendTitleVi,
  );
  chart.title.keyEn = chart.title.keyEn.replace(
    /12-month|4-quarter|5-year|12-week|12-day/g,
    ctx.trendTitleEn,
  );

  const trend = ctx.trendWindow
    ? sliceTrend(s, ctx.idx, ctx.trendWindow, ctx.trendLabelFn)
    : {
        labels: ctx.trendLabels,
        TH: s.TH,
        KH: s.KH,
        CK: s.CK,
      };
  chart.labels = trend.labels;

  chart.data = chart.data.map((row) => {
    const key = sourceLabel(row);
    return {
      ...row,
      name: trend[key].map((v) => roundVal(v, s.decimals)),
    };
  });

  const last = s.TH[ctx.idx];
  const lastKh = s.KH[ctx.idx];
  const gap = roundVal(last - lastKh, s.decimals);
  chart.insightLines[0].keyVi = `${meta.titleVi} ${ctx.periodShortVi} đạt ${m.actual} ${meta.unitVi} (${m.progress}% KH). ${ctx.trendInsightVi}; chênh lệch cuối kỳ so với KH: ${gap >= 0 ? '+' : ''}${gap} ${meta.unitVi}.`;
  chart.insightLines[0].keyEn = `${meta.titleEn} ${ctx.periodShortEn}: ${m.actual} ${meta.unitEn} (${m.progress}% of plan). ${ctx.trendInsightEn}; end-period gap vs plan: ${gap >= 0 ? '+' : ''}${gap} ${meta.unitEn}.`;

  updateConfigRange(chart);
  return chart;
}

function buildScaledChart(template, series, metricCode, ctx, chartIdx) {
  const s = series[metricCode];
  const meta = KPI_META[metricCode];
  const baseActual = s.TH[0];
  const currentActual = s.TH[ctx.idx];
  const factor = currentActual / baseActual;
  const jitter = 0.015 * (chartIdx % 3);
  const chart = JSON.parse(JSON.stringify(template));

  if (metricCode === 'CPM_001' || metricCode === 'CPM_004') {
    chart.data = chart.data.map((row) => ({
      ...row,
      name: scaleValues(row.name, 1 + (factor - 1) * 0.85, s.decimals, jitter),
    }));
  } else {
    chart.data = chart.data.map((row) => ({
      ...row,
      name: scaleValues(row.name, factor, s.decimals, jitter),
    }));
  }

  if (chart.chartKey === 'doughnut' && chart.data[0]?.name?.length === 4) {
    const total = chart.data[0].name.reduce((a, b) => a + b, 0);
    const targetTotal = kpiMetrics(series, metricCode, ctx.idx).actual;
    chart.data[0].name = chart.data[0].name.map((v) =>
      roundVal(v * (targetTotal / total), s.decimals),
    );
    chart.data[0].key.keyVi = `Cơ cấu ${meta.titleVi} · ${ctx.tagFull}`;
    chart.data[0].key.keyEn = `${meta.titleEn} mix · ${ctx.tagEn}`;
  }

  updateConfigRange(chart);
  return chart;
}

function patchStrings(obj, ctx) {
  if (Array.isArray(obj)) return obj.map((v) => patchStrings(v, ctx));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'child' && typeof v === 'string' && v.includes('/TTHH/')) {
        out[k] = v.replace(ctx.pathPattern, ctx.pathReplace);
      } else if (typeof v === 'string') {
        out[k] = ctx.replacements.reduce((s, [from, to]) => s.replace(from, to), v);
      } else {
        out[k] = patchStrings(v, ctx);
      }
    }
    return out;
  }
  return obj;
}

function buildKpisTthh(template, series, ctx) {
  return template.map((card) => {
    const code = card.metricCode;
    const m = kpiMetrics(series, code, ctx.idx);
    return {
      ...card,
      actual: m.actual,
      target: m.target,
      trendValue: m.trendValue,
      trendDirection: m.trendDirection,
      variant: m.variant,
      statusLabel: m.statusLabel,
      progress: m.progress,
      trendLabel: series[code].trendLabel,
      detail: `${ctx.apiPrefix}/board/tthh/${code}/index.json`,
    };
  });
}

function buildOverviewTthh(series, ctx) {
  const kpis = buildKpisTthh(readJson(path.join(ctx.template, 'kpis/tthh/index.json')), series, ctx);
  const achieved = kpis.filter((k) => k.variant === 'success').length;
  const notAchieved = kpis.length - achieved;

  return {
    data: [
      {
        type: 'summary',
        title: { keyVi: ctx.summaryTitleVi, keyEn: ctx.summaryTitleEn },
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
    message:
      notAchieved > 0
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

function buildBoardTthhOverview(templatePath, series, ctx) {
  const template = readJson(templatePath);
  return template.map((section) => {
    const code = section.metricCode;
    const m = kpiMetrics(series, code, ctx.idx);
    const meta = KPI_META[code];
    const next = JSON.parse(JSON.stringify(section));

    next.subTitle = patchStrings(next.subTitle, ctx);

    if (next.chartKey === 'bar' && next.labels?.[0] === 'TH') {
      next.data[0].name = [m.actual, m.target];
      next.data[0].key.keyVi = `${meta.titleVi} · ${ctx.tagFull}`;
      next.data[0].key.keyEn = `${meta.titleEn} · ${ctx.tagEn}`;
      const gap = roundVal(Math.abs(m.actual - m.target), series[code].decimals);
      next.insightLines[0].keyVi = `TH ${m.actual}${meta.unitVi === '%' ? '%' : ''} so với KH ${m.target} — ${m.variant === 'success' ? 'vượt' : 'thiếu'} ${gap} (${m.progress}% hoàn thành).`;
      next.insightLines[0].keyEn = `Actual ${m.actual} vs plan ${m.target} — ${m.variant === 'success' ? 'ahead' : 'short'} by ${gap} (${m.progress}% completion).`;
      updateConfigRange(next);
    }

    if (next.chartKey === 'line') {
      const s = series[code];
      const trend = ctx.trendWindow
        ? sliceTrend(s, ctx.idx, ctx.trendWindow, ctx.trendLabelFn)
        : {
            labels: ctx.trendLabels,
            TH: s.TH,
            KH: s.KH,
            CK: s.CK,
          };
      next.labels = trend.labels;
      next.data = next.data.map((row) => {
        const key = sourceLabel(row);
        return {
          ...row,
          name: trend[key].map((v) => roundVal(v, s.decimals)),
        };
      });
      updateConfigRange(next);
    }

    if (next.chartKey === 'radar') return buildScaledChart(next, series, code, ctx, 3);
    if (next.chartKey === 'doughnut') {
      const scaled = buildScaledChart(next, series, code, ctx, 5);
      scaled.subTitle.keyVi = `Cơ cấu Sector · ${ctx.periodVi}`;
      scaled.subTitle.keyEn = `Sector mix · ${ctx.periodEn}`;
      return scaled;
    }
    if (next.chartKey === 'bar' && next.labels?.[0] === 'Nội địa') {
      return buildScaledChart(next, series, code, ctx, 2);
    }
    return next;
  });
}

function buildCpmCharts(templateRoot, series, metricCode, ctx) {
  const charts = {};
  const srcDir = path.join(templateRoot, 'board/tthh', metricCode, 'chart');
  for (let i = 0; i < CHART_COUNT; i++) {
    const template = readJson(path.join(srcDir, `index${i}.json`));
    if (i === 0) charts[`index${i}.json`] = buildBulletChart(template, series, metricCode, ctx);
    else if (i === 1) charts[`index${i}.json`] = buildTrendChart(template, series, metricCode, ctx);
    else charts[`index${i}.json`] = buildScaledChart(template, series, metricCode, ctx, i);
  }
  return charts;
}

function buildCpmIndex(templateRoot, series, metricCode, ctx) {
  const template = readJson(path.join(templateRoot, 'board/tthh', metricCode, 'index.json'));
  const meta = KPI_META[metricCode];
  const section = JSON.parse(JSON.stringify(template[0]));

  const source =
    metricCode === 'CPM_004'
      ? 'CRM Report · RPS'
      : metricCode === 'CPM_005'
        ? 'CRA · RAS'
        : metricCode === 'CPM_002'
          ? 'CargoSpot · DWH'
          : metricCode === 'CPM_003'
            ? 'RPS · DWH'
            : 'MIS (tổng thị trường)';

  section.subTitle.keyVi = `Đơn vị: ${meta.slug} · Nguồn: BCTM · ${source} · ${ctx.periodVi}`;
  section.subTitle.keyEn = `Unit: ${meta.unitEn} · Source: BCTM · ${ctx.periodEn}`;
  section.child = section.child.map((c, i) => ({
    ...patchStrings(c, ctx),
    child: `${ctx.baseUrl}/board/tthh/${metricCode}/chart/index${i}.json`,
  }));

  return [section];
}

function generatePeriod(ctx, series) {
  const outDir = path.join(ctx.root, ctx.folder);
  const kpisTemplate = readJson(path.join(ctx.template, 'kpis/tthh/index.json'));

  writeJson(path.join(outDir, 'index.json'), readJson(path.join(ctx.template, 'index.json')));
  const kpisTthh = buildKpisTthh(kpisTemplate, series, ctx);
  const overviewTthh = buildOverviewTthh(series, ctx);
  const boardTthh = buildBoardTthhOverview(
    path.join(ctx.template, 'board/tthh/index.json'),
    series,
    ctx,
  );
  const divisionFilter = buildDivisionFilter(path.join(ctx.template, 'index.json'));

  writeJson(path.join(outDir, 'kpis/tthh/index.json'), kpisTthh);
  writeJson(path.join(outDir, 'kpis/all/index.json'), JSON.parse(JSON.stringify(kpisTthh)));
  writeJson(path.join(outDir, 'overview/tthh/index.json'), overviewTthh);
  writeJson(path.join(outDir, 'overview/all/index.json'), buildOverviewAllFromTthh(overviewTthh));

  const overviewRoot = patchStrings(readJson(path.join(ctx.template, 'overview/index.json')), ctx);
  overviewRoot.filter = divisionFilter;
  writeJson(path.join(outDir, 'overview/index.json'), overviewRoot);

  writeJson(path.join(outDir, 'board/tthh/index.json'), boardTthh);
  writeJson(path.join(outDir, 'board/all/index.json'), JSON.parse(JSON.stringify(boardTthh)));

  for (const folder of KPI_FOLDERS) {
    writeJson(
      path.join(outDir, 'board/tthh', folder, 'index.json'),
      buildCpmIndex(ctx.template, series, folder, ctx),
    );
    const charts = buildCpmCharts(ctx.template, series, folder, ctx);
    for (const [file, data] of Object.entries(charts)) {
      writeJson(path.join(outDir, 'board/tthh', folder, 'chart', file), data);
    }
  }

  if (ctx.verbose !== false) {
    const summary = kpisTthh.map((k) => `${k.metricCode}=${k.actual}/${k.target} ${k.trendDirection}`).join(' | ');
    console.log(`${ctx.folder}: ${summary}`);
  }
}

function monthCtx(month, template, root, baseUrl) {
  const pad = String(month).padStart(2, '0');
  const vi = `${MONTH_NAMES_VI[month]}/2026`;
  const en = `${MONTH_NAMES_EN[month]} 2026`;
  const endDates = [
    '', '31/01/2026', '28/02/2026', '31/03/2026', '30/04/2026', '31/05/2026', '30/06/2026',
    '31/07/2026', '31/08/2026', '30/09/2026', '31/10/2026', '30/11/2026', '31/12/2026',
  ];
  return {
    idx: month - 1,
    folder: `M_${month}`,
    template,
    root,
    baseUrl,
    apiPrefix: `ApiV2/CMDV/CQDV/TTHH/M/M_${month}`,
    periodVi: vi,
    periodEn: en,
    periodShortVi: `tháng ${month}`,
    periodShortEn: MONTH_NAMES_EN[month],
    tagFull: `T${month}/2026`,
    tagEn: `${MONTH_SHORT_EN[month]} 2026`,
    endDate: endDates[month],
    summaryTitleVi: 'Tổng KPIs tháng',
    summaryTitleEn: 'Monthly KPI summary',
    trendTitleVi: '12 tháng',
    trendTitleEn: '12-month',
    trendLabels: Array.from({ length: 12 }, (_, i) => `T${i + 1}/26`),
    trendInsightVi: 'Mùa cao điểm T11–T12',
    trendInsightEn: 'Peak Nov–Dec',
    pathPattern: /M_\d+\/board\/tthh/g,
    pathReplace: `M_${month}/board/tthh`,
    replacements: [
      [/Tháng \d+\/2026/g, vi],
      [/January|February|March|April|May|June|July|August|September|October|November|December 2026/g, en],
      [/T\d+\/2026/g, `T${month}/2026`],
      [/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec 2026/g, `${MONTH_SHORT_EN[month]} 2026`],
      [/23\/04\/2026/g, endDates[month]],
      [/ApiV2\/CMDV\/CQDV\/TTHH\/M\/M_\d+/g, `ApiV2/CMDV/CQDV/TTHH/M/M_${month}`],
    ],
  };
}

function quarterCtx(quarter, template, root, baseUrl) {
  const endDates = ['', '31/03/2026', '30/06/2026', '30/09/2026', '31/12/2026'];
  const vi = `Quý ${quarter}/2026`;
  const en = `Q${quarter} 2026`;
  return {
    idx: quarter - 1,
    folder: `Q_${quarter}`,
    template,
    root,
    baseUrl,
    apiPrefix: `ApiV2/CMDV/CQDV/TTHH/Q/Q_${quarter}`,
    periodVi: vi,
    periodEn: en,
    periodShortVi: `quý ${quarter}`,
    periodShortEn: `Q${quarter}`,
    tagFull: `Q${quarter}/2026`,
    tagEn: `Q${quarter} 2026`,
    endDate: endDates[quarter],
    summaryTitleVi: 'Tổng KPIs quý',
    summaryTitleEn: 'Quarterly KPI summary',
    trendTitleVi: '4 quý',
    trendTitleEn: '4-quarter',
    trendLabels: ['Q1/26', 'Q2/26', 'Q3/26', 'Q4/26'],
    trendInsightVi: 'Q4 thường cao điểm cuối năm',
    trendInsightEn: 'Q4 typically peaks at year-end',
    pathPattern: /Q_\d+\/board\/tthh/g,
    pathReplace: `Q_${quarter}/board/tthh`,
    replacements: [
      [/Tháng \d+\/2026/g, vi],
      [/Quý \d+\/2026/g, vi],
      [/January|February|March|April|May|June|July|August|September|October|November|December 2026/g, en],
      [/Q\d 2026/g, en],
      [/T\d+\/2026/g, `Q${quarter}/2026`],
      [/Q\d\/2026/g, `Q${quarter}/2026`],
      [/23\/04\/2026/g, endDates[quarter]],
      [/ApiV2\/CMDV\/CQDV\/TTHH\/Q\/Q_\d+/g, `ApiV2/CMDV/CQDV/TTHH/Q/Q_${quarter}`],
      [/ApiV2\/CMDV\/CQDV\/TTHH\/M\/M_\d+/g, `ApiV2/CMDV/CQDV/TTHH/Q/Q_${quarter}`],
    ],
  };
}

function yearCtx(year, template, root, baseUrl) {
  const vi = `Năm ${year}`;
  const en = `Year ${year}`;
  const endDate = `31/12/${year}`;
  const years = [2022, 2023, 2024, 2025, 2026];
  const idx = years.indexOf(year);
  return {
    idx,
    folder: `Y_${year}`,
    template,
    root,
    baseUrl,
    apiPrefix: `ApiV2/CMDV/CQDV/TTHH/Y/Y_${year}`,
    periodVi: vi,
    periodEn: en,
    periodShortVi: `năm ${year}`,
    periodShortEn: `${year}`,
    tagFull: `${year}`,
    tagEn: `${year}`,
    endDate,
    summaryTitleVi: 'Tổng KPIs năm',
    summaryTitleEn: 'Yearly KPI summary',
    trendTitleVi: '5 năm',
    trendTitleEn: '5-year',
    trendLabels: years.map(String),
    trendInsightVi: 'Xu hướng tăng trưởng ổn định qua các năm',
    trendInsightEn: 'Steady growth trend across years',
    pathPattern: /Y_\d{4}\/board\/tthh/g,
    pathReplace: `Y_${year}/board/tthh`,
    replacements: [
      [/Tháng \d+\/2026/g, vi],
      [/Năm \d{4}/g, vi],
      [/Year \d{4}/g, en],
      [/T\d+\/2026/g, `${year}`],
      [/Q\d\/2026/g, `${year}`],
      [/23\/04\/2026/g, endDate],
      [/31\/12\/2026/g, endDate],
      [/ApiV2\/CMDV\/CQDV\/TTHH\/Y\/Y_\d{4}/g, `ApiV2/CMDV/CQDV/TTHH/Y/Y_${year}`],
      [/ApiV2\/CMDV\/CQDV\/TTHH\/M\/M_\d+/g, `ApiV2/CMDV/CQDV/TTHH/Y/Y_${year}`],
    ],
  };
}

function weekCtx(week, template, root, baseUrl) {
  const vi = `Tuần ${week}/2026`;
  const en = `Week ${week}/2026`;
  const endDate = weekEndDate(week);
  const trendWindow = 12;
  const trendLabelFn = (i) => `W${i + 1}/26`;

  return {
    idx: week - 1,
    folder: `W_${week}`,
    template,
    root,
    baseUrl,
    apiPrefix: `ApiV2/CMDV/CQDV/TTHH/W/W_${week}`,
    periodVi: vi,
    periodEn: en,
    periodShortVi: `tuần ${week}`,
    periodShortEn: `Week ${week}`,
    tagFull: `W${week}/2026`,
    tagEn: `W${week} 2026`,
    endDate,
    summaryTitleVi: 'Tổng KPIs tuần',
    summaryTitleEn: 'Weekly KPI summary',
    trendTitleVi: '12 tuần',
    trendTitleEn: '12-week',
    trendWindow,
    trendLabelFn,
    trendLabels: [],
    trendInsightVi: 'Xu hướng tăng dần về cuối năm, W50–W52 thường cao điểm',
    trendInsightEn: 'Gradual rise toward year-end; W50–W52 often peak',
    pathPattern: /W_\d+\/board\/tthh/g,
    pathReplace: `W_${week}/board/tthh`,
    replacements: [
      [/Tháng \d+\/2026/g, vi],
      [/Tuần \d+\/2026/g, vi],
      [/Week \d+\/2026/g, en],
      [/T\d+\/2026/g, `W${week}/2026`],
      [/W\d+\/2026/g, `W${week}/2026`],
      [/23\/04\/2026/g, endDate],
      [/ApiV2\/CMDV\/CQDV\/TTHH\/W\/W_\d+/g, `ApiV2/CMDV/CQDV/TTHH/W/W_${week}`],
      [/ApiV2\/CMDV\/CQDV\/TTHH\/M\/M_\d+/g, `ApiV2/CMDV/CQDV/TTHH/W/W_${week}`],
    ],
  };
}

function dayCtx(day, template, root, baseUrl) {
  const pad = String(day).padStart(2, '0');
  const vi = `Ngày ${day}/12/2026`;
  const en = `Day ${day}/12/2026`;
  const endDate = `${pad}/12/2026`;
  const trendWindow = 12;
  const trendLabelFn = (i) => `D${i + 1}/12`;

  return {
    idx: day - 1,
    folder: `D_${day}`,
    template,
    root,
    baseUrl,
    apiPrefix: `ApiV2/CMDV/CQDV/TTHH/D/D_${day}`,
    periodVi: vi,
    periodEn: en,
    periodShortVi: `ngày ${day}/12`,
    periodShortEn: `Dec ${day}`,
    tagFull: `D${day}/12/2026`,
    tagEn: `Dec ${day}, 2026`,
    endDate,
    summaryTitleVi: 'Tổng KPIs ngày',
    summaryTitleEn: 'Daily KPI summary',
    trendTitleVi: '12 ngày',
    trendTitleEn: '12-day',
    trendWindow,
    trendLabelFn,
    trendLabels: [],
    trendInsightVi: 'Cuối tháng 12 tăng nhẹ nhờ hàng Tết và peak holiday',
    trendInsightEn: 'Late December uptick on Tet cargo and holiday peak',
    pathPattern: /D_\d+\/board\/tthh/g,
    pathReplace: `D_${day}/board/tthh`,
    replacements: [
      [/Tháng \d+\/2026/g, vi],
      [/Ngày \d+\/12\/2026/g, vi],
      [/Day \d+\/12\/2026/g, en],
      [/T\d+\/2026/g, `D${day}/12/2026`],
      [/D\d+\/12\/2026/g, `D${day}/12/2026`],
      [/23\/04\/2026/g, endDate],
      [/31\/12\/2026/g, endDate],
      [/ApiV2\/CMDV\/CQDV\/TTHH\/D\/D_\d+/g, `ApiV2/CMDV/CQDV/TTHH/D/D_${day}`],
      [/ApiV2\/CMDV\/CQDV\/TTHH\/M\/M_\d+/g, `ApiV2/CMDV/CQDV/TTHH/D/D_${day}`],
    ],
  };
}

module.exports = {
  MONTHLY_SERIES,
  KPI_FOLDERS,
  KPI_META,
  WEEKS_IN_YEAR,
  DAYS_IN_MONTH,
  DIVISION_FILTER_ORDER,
  readJson,
  writeJson,
  buildDivisionFilter,
  buildQuarterlySeries,
  buildYearlySeries,
  buildWeeklySeries,
  buildDailySeries,
  generatePeriod,
  monthCtx,
  quarterCtx,
  yearCtx,
  weekCtx,
  dayCtx,
  kpiMetrics,
};

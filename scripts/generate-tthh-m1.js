#!/usr/bin/env node
/**
 * TTHH M_1 mock generator — single source of truth
 *
 * Outputs:
 *   overview/index.json
 *   kpis/all + index0..4
 *   board/index.json          (5 overview charts, mixed types)
 *   board/charts/{CPM}/…      (6 drill-down charts × 5 KPIs, all chart kinds)
 *   ../chart-catalog.json
 */

const fs = require('fs');
const path = require('path');

const PERIOD_ROOT = path.join(__dirname, '../ApiV2/TTHH/TTHH/M/M_1');
const MODULE_ROOT = path.join(__dirname, '../ApiV2/TTHH/TTHH');

// ─── Period & dimensions ───────────────────────────────────────────────────

const PERIOD = { vi: 'Tháng 1/2026', en: 'January 2026', shortVi: 'T1/2026', shortEn: 'Jan 2026' };

const MONTH_LABELS = [
  'T1/26', 'T2/26', 'T3/26', 'T4/26', 'T5/26', 'T6/26',
  'T7/26', 'T8/26', 'T9/26', 'T10/26', 'T11/26', 'T12/26',
];

const NETWORK_LABELS = ['Nội địa', 'Quốc tế'];
const AREA_LABELS = ['Châu Á - Thái Bình Dương', 'Châu Âu', 'Châu Mỹ', 'Trung Đông'];
const COUNTRY_LABELS = ['Việt Nam', 'Nhật Bản', 'Hàn Quốc', 'Úc', 'Đức'];
const SECTOR_LABELS = ['Hàng tổng hợp', 'Hàng express', 'Hàng dễ hỏng', 'Hàng đặc biệt'];
const SECTOR_COLORS = ['#5b9bd5', '#8e44ad', '#1abc9c', '#27ae60'];

/** Mùa vụ hàng hóa: thấp T1–T2 (Tết), tăng dần, đỉnh T11–T12 */
const SEASONAL_RAW = [0.86, 0.83, 0.93, 0.97, 1.0, 1.02, 1.05, 1.04, 1.06, 1.09, 1.14, 1.18];
const SEASONAL = normalizeWeights(SEASONAL_RAW);

const NETWORK_W = [0.57, 0.43];
const AREA_W = [0.44, 0.23, 0.19, 0.14];
const COUNTRY_W = [0.31, 0.23, 0.19, 0.15, 0.12];
const SECTOR_W = [0.37, 0.28, 0.21, 0.14];

const DRILLDOWN_KEYS = [
  'trend-12m',
  'by-network',
  'by-area',
  'by-country',
  'by-sector',
  'bullet-th-kh',
];

const DRILLDOWN_CHART_KIND = {
  'trend-12m': 'line',
  'by-network': 'bar',
  'by-area': 'radar',
  'by-country': 'combo',
  'by-sector': 'doughnut',
  'bullet-th-kh': 'bar',
};

// ─── KPI seed (nghiệp vụ tháng 1/2026) ─────────────────────────────────────

const KPI_SEEDS = [
  {
    code: 'CPM-001',
    metricCode: 'CPM_001',
    filterPath: '/market-share',
    titleVi: 'Thị phần hàng hóa vận chuyển',
    titleEn: 'Cargo market share',
    unitVi: '%',
    unitEn: '%',
    kind: 'percent',
    actual: 77.2,
    target: 70,
    prior: 75.8,
    minValue: 55,
    maxValue: 90,
    /** Thị phần theo network/area/country — không cộng dồn về tổng */
    networkPct: [84.5, 67.8],
    areaPct: [79.5, 72.4, 68.1, 71.2],
    countryPct: [91.2, 74.6, 71.8, 66.5, 63.2],
    sectorPct: [76.8, 78.5, 74.2, 79.1],
    trendSlope: 0.35,
    sourceVi: 'BCTM · MIS (tổng thị trường)',
    sourceEn: 'BCTM · MIS (total market)',
  },
  {
    code: 'CPM-002',
    metricCode: 'CPM_002',
    filterPath: '/cargo-volume',
    titleVi: 'Sản lượng hàng hóa, bưu kiện',
    titleEn: 'Cargo and mail volume',
    unitVi: 'Tấn',
    unitEn: 'Ton',
    kind: 'absolute',
    actual: 2185,
    target: 2000,
    prior: 2062,
    minValue: 0,
    maxValue: 2800,
    trendSlope: 28,
    sourceVi: 'BCTM · CargoSpot · DWH',
    sourceEn: 'BCTM · CargoSpot · DWH',
  },
  {
    code: 'CPM-003',
    metricCode: 'CPM_003',
    filterPath: '/rftk',
    titleVi: 'Hàng hóa, bưu kiện luân chuyển (RFTK)',
    titleEn: 'Cargo and mail turnover (RFTK)',
    unitVi: 'Nghìn tấn.km',
    unitEn: 'Thousand ton-km',
    kind: 'absolute',
    actual: 75.8,
    target: 75,
    prior: 72.1,
    minValue: 0,
    maxValue: 95,
    trendSlope: 0.55,
    sourceVi: 'BCTM · RPS · DWH',
    sourceEn: 'BCTM · RPS · DWH',
  },
  {
    code: 'CPM-004',
    metricCode: 'CPM_004',
    filterPath: '/load-factor',
    titleVi: 'Hệ số sử dụng tải hàng',
    titleEn: 'Cargo load factor',
    unitVi: '%',
    unitEn: '%',
    kind: 'percent',
    actual: 46.3,
    target: 50,
    prior: 47.1,
    minValue: 35,
    maxValue: 65,
    networkPct: [51.2, 40.1],
    areaPct: [53.8, 47.5, 42.6, 44.9],
    countryPct: [55.1, 46.8, 44.2, 41.5, 43.7],
    sectorPct: [48.5, 52.1, 49.8, 38.4],
    trendSlope: -0.15,
    sourceVi: 'CRM Report · RPS',
    sourceEn: 'CRM Report · RPS',
  },
  {
    code: 'CPM-005',
    metricCode: 'CPM_005',
    filterPath: '/revenue',
    titleVi: 'Doanh thu hàng hóa, bưu kiện',
    titleEn: 'Cargo and mail revenue',
    unitVi: 'Triệu VNĐ',
    unitEn: 'Million VND',
    kind: 'absolute',
    actual: 928,
    target: 800,
    prior: 891,
    minValue: 0,
    maxValue: 1150,
    trendSlope: 14,
    sourceVi: 'BCTM · CRA · RAS',
    sourceEn: 'BCTM · CRA · RAS',
  },
];

// ─── Math helpers ──────────────────────────────────────────────────────────

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round0(n) {
  return Math.round(n);
}

function normalizeWeights(arr) {
  const sum = arr.reduce((a, b) => a + b, 0);
  return arr.map((v) => v / sum);
}

function splitTotal(total, weights, decimals = 0) {
  const r = decimals ? round1 : round0;
  return weights.map((w) => r(total * w));
}

function planFromActual(actuals, target, actual) {
  const ratio = target / actual;
  return actuals.map((v) => round1(v * ratio));
}

function priorFromActual(actuals, prior, actual) {
  const ratio = prior / actual;
  return actuals.map((v) => round1(v * ratio));
}

function pctChange(actual, prior) {
  if (prior === 0) return 0;
  return round1(((actual - prior) / prior) * 100);
}

function ppChange(actual, prior) {
  return round1(actual - prior);
}

function progressPct(actual, target) {
  return round0((actual / target) * 100);
}

function seasonalShape(index) {
  return SEASONAL[index] / SEASONAL[0];
}

/** Chuỗi KH: T1 = target, các tháng theo mùa vụ */
function planTrend(target, fn) {
  return SEASONAL.map((_, i) => fn(target * seasonalShape(i)));
}

function buildTrendSeries(kpi) {
  const isPct = kpi.kind === 'percent';
  const fn = isPct ? round1 : kpi.actual < 200 ? round1 : round0;
  const perf = kpi.actual / kpi.target;
  const slopeSign = kpi.trendSlope >= 0 ? 1 : -1;

  const kh = planTrend(kpi.target, fn);

  const th = kh.map((p, i) => {
    if (i === 0) return kpi.actual;
    const drift = 1 + i * 0.006 * slopeSign;
    const noise = 1 + Math.sin(i * 1.15) * 0.018;
    return fn(p * perf * drift * noise);
  });

  const ck = planTrend(kpi.prior, fn).map((p, i) => {
    const drift = 1 + i * 0.004 * slopeSign;
    return fn(p * drift);
  });

  return { th, kh, ck };
}

// ─── KPI model (derived splits + status) ───────────────────────────────────

function buildKpiModel(seed) {
  const { actual, target, prior } = seed;
  const achieved = seed.kind === 'percent' ? actual >= target : actual >= target;
  const variant = achieved ? 'success' : 'error';
  const trendDirection = actual >= prior ? 'up' : 'down';
  const trendDelta = seed.kind === 'percent' ? ppChange(actual, prior) : pctChange(actual, prior);
  const trendValue = Math.abs(trendDelta);

  const splits = {};

  if (seed.kind === 'percent') {
    splits.network = { th: seed.networkPct, kh: planFromActual(seed.networkPct, target, actual) };
    splits.area = { th: seed.areaPct, kh: planFromActual(seed.areaPct, target, actual) };
    splits.country = { th: seed.countryPct, kh: planFromActual(seed.countryPct, target, actual) };
    splits.sector = { th: seed.sectorPct, kh: planFromActual(seed.sectorPct, target, actual) };
    splits.prior = {
      network: priorFromActual(seed.networkPct, prior, actual),
      country: priorFromActual(seed.countryPct, prior, actual),
    };
  } else {
    splits.network = {
      th: splitTotal(actual, NETWORK_W),
      kh: splitTotal(target, NETWORK_W),
    };
    splits.area = {
      th: splitTotal(actual, AREA_W),
      kh: splitTotal(target, AREA_W),
    };
    splits.country = {
      th: splitTotal(actual, COUNTRY_W),
      kh: splitTotal(target, COUNTRY_W),
    };
    splits.sector = { th: splitTotal(actual, SECTOR_W) };
    splits.prior = {
      network: splitTotal(prior, NETWORK_W),
      country: priorFromActual(splitTotal(actual, COUNTRY_W), prior, actual).map(round0),
    };
  }

  const trend = buildTrendSeries(seed);

  return {
    ...seed,
    variant,
    statusVi: achieved ? 'ĐẠT' : 'KHÔNG ĐẠT',
    statusEn: achieved ? 'ACHIEVED' : 'NOT ACHIEVED',
    trendDirection,
    trendValue,
    progress: progressPct(actual, target),
    splits,
    trend,
  };
}

const KPIS = KPI_SEEDS.map(buildKpiModel);

// ─── Insight copy (ngữ cảnh, không placeholder) ───────────────────────────

function insight(vi, en) {
  return [{ keyVi: vi, keyEn: en }];
}

function trendInsight(kpi) {
  const { th, kh } = kpi.trend;
  const endGap = round1(th[11] - kh[11]);
  const sign = endGap >= 0 ? 'trên' : 'dưới';
  const signEn = endGap >= 0 ? 'above' : 'below';

  if (kpi.kind === 'percent') {
    return insight(
      `Xu hướng ${kpi.trendDirection === 'up' ? 'tăng' : 'giảm'} ${kpi.trendValue} điểm % so với cùng kỳ. Dự báo T12/26 ở mức ${th[11]}%, ${sign} KH ${Math.abs(endGap)} điểm %.`,
      `Trend is ${kpi.trendDirection} ${kpi.trendValue} pp vs same period. Dec 2026 forecast at ${th[11]}%, ${signEn} plan by ${Math.abs(endGap)} pp.`,
    );
  }

  return insight(
    `Sản lượng/doanh thu tháng 1 đạt ${kpi.actual.toLocaleString('vi-VN')} ${kpi.unitVi} (${kpi.progress}% KH). Chuỗi 12 tháng cho thấy mùa cao điểm T11–T12; khoảng cách cuối năm so với KH: ${endGap >= 0 ? '+' : ''}${endGap.toLocaleString('vi-VN')} ${kpi.unitVi}.`,
    `January closed at ${kpi.actual.toLocaleString('en-US')} ${kpi.unitEn} (${kpi.progress}% of plan). The 12-month curve peaks in Nov–Dec; year-end gap vs plan: ${endGap >= 0 ? '+' : ''}${endGap.toLocaleString('en-US')} ${kpi.unitEn}.`,
  );
}

function networkInsight(kpi) {
  const [d, i] = kpi.splits.network.th;
  const [dKh] = kpi.splits.network.kh;
  if (kpi.kind === 'percent') {
    return insight(
      `Nội địa duy trì thị phần mạnh (${d}% vs KH ${dKh}%), Quốc tế ${i}% — cần chú ý cạnh tranh trên các sector EU–US.`,
      `Domestic share remains strong (${d}% vs ${dKh}% plan); international at ${i}% — watch competition on EU–US sectors.`,
    );
  }
  return insight(
    `Nội địa đóng góp ${d.toLocaleString('vi-VN')} ${kpi.unitVi} (${round0((d / kpi.actual) * 100)}%), Quốc tế ${i.toLocaleString('vi-VN')} ${kpi.unitVi}. Mạng nội địa vượt KH rõ nhất.`,
    `Domestic: ${d.toLocaleString('en-US')} ${kpi.unitEn} (${round0((d / kpi.actual) * 100)}%), international: ${i.toLocaleString('en-US')} ${kpi.unitEn}. Domestic network leads plan attainment.`,
  );
}

function areaInsight(kpi) {
  const top = AREA_LABELS[0];
  const topVal = kpi.splits.area.th[0];
  return insight(
    `${top} dẫn đầu với ${topVal}${kpi.kind === 'percent' ? '%' : ` ${kpi.unitVi}`}. Radar cho thấy chênh lệch TH–KH lớn nhất tại Châu Mỹ và Trung Đông.`,
    `${top} leads at ${topVal}${kpi.kind === 'percent' ? '%' : ` ${kpi.unitEn}`}. Radar highlights the largest actual-vs-plan gap in the Americas and Middle East.`,
  );
}

function countryInsight(kpi) {
  return insight(
    `Việt Nam và Nhật Bản chiếm ${round0((COUNTRY_W[0] + COUNTRY_W[1]) * 100)}% cơ cấu. Đường cùng kỳ 2025 thấp hơn TH 2026 tại Hàn Quốc và Úc — đà tăng tích cực.`,
    `Vietnam and Japan account for ${round0((COUNTRY_W[0] + COUNTRY_W[1]) * 100)}% of the mix. The 2025 same-period line trails 2026 actuals in Korea and Australia — positive momentum.`,
  );
}

function sectorInsight(kpi) {
  const vals = kpi.splits.sector.th;
  const topIdx = vals.indexOf(Math.max(...vals));
  return insight(
    `${SECTOR_LABELS[topIdx]} chiếm tỷ trọng lớn nhất (${kpi.kind === 'percent' ? `${vals[topIdx]}%` : `${vals[topIdx].toLocaleString('vi-VN')} ${kpi.unitVi}`}). Hàng dễ hỏng tăng trưởng nhanh nhờ mở rộng cold-chain Tết.`,
    `${SECTOR_LABELS[topIdx]} has the largest share (${kpi.kind === 'percent' ? `${vals[topIdx]}%` : `${vals[topIdx].toLocaleString('en-US')} ${kpi.unitEn}`}). Perishables grew fastest on Tet cold-chain expansion.`,
  );
}

function bulletInsight(kpi) {
  const gap = round1(kpi.actual - kpi.target);
  return insight(
    `TH ${kpi.actual}${kpi.unitVi === '%' ? '%' : ` ${kpi.unitVi}`} so với KH ${kpi.target} — ${gap >= 0 ? `vượt ${gap}` : `thiếu ${Math.abs(gap)}`} (${kpi.progress}% hoàn thành).`,
    `Actual ${kpi.actual} vs plan ${kpi.target} — ${gap >= 0 ? `ahead by ${gap}` : `short by ${Math.abs(gap)}`} (${kpi.progress}% completion).`,
  );
}

// ─── Chart builders ────────────────────────────────────────────────────────

function chartConfig(kpi, extra = {}) {
  const cfg = { height: extra.height ?? 220, minValue: kpi.minValue, maxValue: kpi.maxValue, insightLayout: 'inline' };
  if (kpi.unitVi) cfg.slug = kpi.unitVi;
  return { ...cfg, ...extra };
}

function lineChart(kpi, meta) {
  const { th, kh, ck } = kpi.trend;
  return {
    chartKey: 'line',
    config: chartConfig(kpi, { height: 240 }),
    title: { keyVi: meta.titleVi, keyEn: meta.titleEn },
    subTitle: { keyVi: meta.subVi, keyEn: meta.subEn },
    labels: MONTH_LABELS,
    data: [
      { key: { keyVi: 'TH 2026', keyEn: 'Actual 2026' }, name: th, color: ['#2962A0'], type: null, tension: 0.35, borderDash: null, fill: true },
      { key: { keyVi: 'KH 2026', keyEn: 'Plan 2026' }, name: kh, color: ['#D0D1D3'], type: null, tension: 0.35, borderDash: [6, 3], fill: false },
      { key: { keyVi: 'Cùng kỳ 2025', keyEn: 'Same period 2025' }, name: ck, color: ['#EC4899'], type: null, tension: 0.35, borderDash: [6, 3], fill: false },
    ],
    insightLines: meta.insight ?? trendInsight(kpi),
  };
}

function barTwoSeries(kpi, meta, labels, actual, plan) {
  return {
    chartKey: 'bar',
    config: chartConfig(kpi),
    title: { keyVi: meta.titleVi, keyEn: meta.titleEn },
    subTitle: { keyVi: meta.subVi, keyEn: meta.subEn },
    labels,
    data: [
      { key: { keyVi: 'TH 2026', keyEn: 'Actual 2026' }, name: actual, color: ['#2962A0'], type: null, tension: null, borderDash: null, fill: null },
      { key: { keyVi: 'KH 2026', keyEn: 'Plan 2026' }, name: plan, color: ['#D0D1D3'], type: null, tension: null, borderDash: null, fill: null },
    ],
    insightLines: meta.insight ?? networkInsight(kpi),
  };
}

function radarChart(kpi, meta, labels, actual, plan) {
  return {
    chartKey: 'radar',
    config: chartConfig(kpi, { height: 260 }),
    title: { keyVi: meta.titleVi, keyEn: meta.titleEn },
    subTitle: { keyVi: meta.subVi, keyEn: meta.subEn },
    labels,
    data: [
      { key: { keyVi: 'TH 2026', keyEn: 'Actual 2026' }, name: actual, color: ['#2962A0'], type: null, tension: null, borderDash: null, fill: true },
      { key: { keyVi: 'KH 2026', keyEn: 'Plan 2026' }, name: plan, color: ['#D0D1D3'], type: null, tension: null, borderDash: [6, 3], fill: false },
    ],
    insightLines: meta.insight ?? areaInsight(kpi),
  };
}

function comboChart(kpi, meta, labels, actual, plan, prior) {
  return {
    chartKey: 'combo',
    config: chartConfig(kpi, { height: 250 }),
    title: { keyVi: meta.titleVi, keyEn: meta.titleEn },
    subTitle: { keyVi: meta.subVi, keyEn: meta.subEn },
    labels,
    data: [
      { key: { keyVi: 'TH 2026', keyEn: 'Actual 2026' }, name: actual, color: ['#2962A0'], type: 'bar', tension: null, borderDash: null, fill: null },
      { key: { keyVi: 'KH 2026', keyEn: 'Plan 2026' }, name: plan, color: ['#D0D1D3'], type: 'bar', tension: null, borderDash: null, fill: null },
      { key: { keyVi: 'Cùng kỳ 2025', keyEn: 'Same period 2025' }, name: prior, color: ['#EC4899'], type: 'line', tension: 0.3, borderDash: [6, 3], fill: false },
    ],
    insightLines: meta.insight ?? countryInsight(kpi),
  };
}

function doughnutChart(kpi, meta, labels, values) {
  return {
    chartKey: 'doughnut',
    config: { height: 240, insightLayout: 'inline' },
    title: { keyVi: meta.titleVi, keyEn: meta.titleEn },
    subTitle: { keyVi: meta.subVi, keyEn: meta.subEn },
    labels,
    data: [
      {
        key: { keyVi: `Cơ cấu ${kpi.titleVi} · ${PERIOD.shortVi}`, keyEn: `${kpi.titleEn} mix · ${PERIOD.shortEn}` },
        name: values,
        color: SECTOR_COLORS,
        type: null,
        tension: null,
        borderDash: null,
        fill: null,
      },
    ],
    insightLines: meta.insight ?? sectorInsight(kpi),
  };
}

function bulletChart(kpi, meta) {
  return {
    chartKey: 'bar',
    config: { height: 200, direction: 1, minValue: kpi.minValue, maxValue: kpi.maxValue, insightLayout: 'inline' },
    title: { keyVi: meta.titleVi, keyEn: meta.titleEn },
    subTitle: { keyVi: meta.subVi, keyEn: meta.subEn },
    labels: ['TH', 'KH'],
    data: [
      {
        key: { keyVi: `${kpi.titleVi} · ${PERIOD.shortVi}`, keyEn: `${kpi.titleEn} · ${PERIOD.shortEn}` },
        name: [kpi.actual, kpi.target],
        color: ['#2962A0', '#D0D1D3'],
        type: null,
        tension: null,
        borderDash: null,
        fill: null,
      },
    ],
    insightLines: meta.insight ?? bulletInsight(kpi),
  };
}

// ─── Overview board (5 charts, mixed types) ─────────────────────────────────

function buildOverviewChart(kpi) {
  const base = { code: kpi.code, metricCode: kpi.metricCode };
  const s = kpi.splits;

  switch (kpi.code) {
    case 'CPM-001':
      return {
        ...base,
        ...bulletChart(kpi, {
          titleVi: kpi.titleVi,
          titleEn: kpi.titleEn,
          subVi: `Đánh giá TH/KH · ${PERIOD.vi} · Đơn vị: %`,
          subEn: `Actual vs plan · ${PERIOD.en} · Unit: %`,
        }),
      };
    case 'CPM-002':
      return {
        ...base,
        ...comboChart(
          kpi,
          {
            titleVi: kpi.titleVi,
            titleEn: kpi.titleEn,
            subVi: `Phân bổ Network · ${PERIOD.vi}`,
            subEn: `Network split · ${PERIOD.en}`,
            insight: networkInsight(kpi),
          },
          NETWORK_LABELS,
          s.network.th,
          s.network.kh,
          s.prior.network,
        ),
      };
    case 'CPM-003':
      return {
        ...base,
        ...lineChart(kpi, {
          titleVi: kpi.titleVi,
          titleEn: kpi.titleEn,
          subVi: `Xu hướng 12 tháng · Đơn vị: ${kpi.unitVi}`,
          subEn: `12-month trend · Unit: ${kpi.unitEn}`,
        }),
      };
    case 'CPM-004':
      return {
        ...base,
        ...radarChart(
          kpi,
          {
            titleVi: kpi.titleVi,
            titleEn: kpi.titleEn,
            subVi: `So sánh Area · ${PERIOD.vi} · Đơn vị: %`,
            subEn: `Area comparison · ${PERIOD.en} · Unit: %`,
            insight: areaInsight(kpi),
          },
          AREA_LABELS,
          s.area.th,
          s.area.kh,
        ),
      };
    case 'CPM-005':
      return {
        ...base,
        ...doughnutChart(
          kpi,
          {
            titleVi: kpi.titleVi,
            titleEn: kpi.titleEn,
            subVi: `Cơ cấu Sector · ${PERIOD.vi}`,
            subEn: `Sector mix · ${PERIOD.en}`,
            insight: sectorInsight(kpi),
          },
          SECTOR_LABELS,
          s.sector.th,
        ),
      };
    default:
      throw new Error(`Unknown KPI: ${kpi.code}`);
  }
}

function buildDrilldownChart(kpi, key) {
  const base = { code: kpi.code, key, metricCode: kpi.metricCode };
  const s = kpi.splits;

  switch (key) {
    case 'trend-12m':
      return {
        ...base,
        ...lineChart(kpi, {
          titleVi: `Xu hướng ${kpi.titleVi} 12 tháng`,
          titleEn: `12-month ${kpi.titleEn} trend`,
          subVi: `TH / KH / cùng kỳ · Nguồn: ${kpi.sourceVi}`,
          subEn: `Actual / plan / same period · Source: ${kpi.sourceEn}`,
        }),
      };
    case 'by-network':
      return {
        ...base,
        ...barTwoSeries(
          kpi,
          {
            titleVi: `${kpi.titleVi} theo Network`,
            titleEn: `${kpi.titleEn} by network`,
            subVi: 'So sánh Nội địa vs Quốc tế · TH và KH',
            subEn: 'Domestic vs international · actual and plan',
          },
          NETWORK_LABELS,
          s.network.th,
          s.network.kh,
        ),
      };
    case 'by-area':
      return {
        ...base,
        ...radarChart(
          kpi,
          {
            titleVi: `${kpi.titleVi} theo Area`,
            titleEn: `${kpi.titleEn} by area`,
            subVi: 'Radar TH vs KH theo 4 khu vực địa lý',
            subEn: 'Radar actual vs plan across 4 geographic areas',
          },
          AREA_LABELS,
          s.area.th,
          s.area.kh,
        ),
      };
    case 'by-country':
      return {
        ...base,
        ...comboChart(
          kpi,
          {
            titleVi: `${kpi.titleVi} theo Country`,
            titleEn: `${kpi.titleEn} by country`,
            subVi: '5 thị trường trọng điểm · cột TH/KH + đường cùng kỳ',
            subEn: 'Top 5 markets · TH/plan bars + same-period line',
          },
          COUNTRY_LABELS,
          s.country.th,
          s.country.kh,
          s.prior.country,
        ),
      };
    case 'by-sector':
      return {
        ...base,
        ...doughnutChart(
          kpi,
          {
            titleVi: `Cơ cấu ${kpi.titleVi} theo Sector`,
            titleEn: `${kpi.titleEn} mix by sector`,
            subVi: 'Tỷ trọng 4 nhóm hàng hóa chính',
            subEn: 'Share across 4 main cargo groups',
          },
          SECTOR_LABELS,
          s.sector.th,
        ),
      };
    case 'bullet-th-kh':
      return {
        ...base,
        ...bulletChart(kpi, {
          titleVi: 'Bullet: TH so với KH',
          titleEn: 'Bullet: actual vs plan',
          subVi: `Tổng hợp ${PERIOD.vi} · ${kpi.unitVi}`,
          subEn: `${PERIOD.en} summary · ${kpi.unitEn}`,
        }),
      };
    default:
      throw new Error(`Unknown chart key: ${key}`);
  }
}

// ─── KPI cards & overview summary ──────────────────────────────────────────

function buildKpiCard(kpi) {
  const trendLabel =
    kpi.kind === 'percent'
      ? { keyVi: 'điểm % so với kỳ trước', keyEn: 'pp vs prior period' }
      : { keyVi: 'so với kỳ trước', keyEn: 'vs prior period' };

  return {
    title: { keyVi: kpi.titleVi, keyEn: kpi.titleEn },
    tooltip: {
      keyVi: `Đơn vị: ${kpi.unitVi} · Nguồn: ${kpi.sourceVi}`,
      keyEn: `Unit: ${kpi.unitEn} · Source: ${kpi.sourceEn}`,
    },
    variant: kpi.variant,
    metricCode: kpi.metricCode,
    actual: kpi.actual,
    unit: { keyVi: kpi.unitVi, keyEn: kpi.unitEn },
    statusLabel: { keyVi: kpi.statusVi, keyEn: kpi.statusEn },
    trendDirection: kpi.trendDirection,
    trendValue: kpi.trendValue,
    trendLabel,
    target: kpi.target,
    targetLabel: { keyVi: 'Kế hoạch', keyEn: 'Plan' },
    progress: kpi.progress,
  };
}

function buildOverviewIndex() {
  const achieved = KPIS.filter((k) => k.variant === 'success').length;
  const loadKpi = KPIS.find((k) => k.code === 'CPM-004');
  const volKpi = KPIS.find((k) => k.code === 'CPM-002');
  const shareKpi = KPIS.find((k) => k.code === 'CPM-001');

  return {
    data: [
      {
        type: 'summary',
        title: { keyVi: 'Tổng KPIs tháng', keyEn: 'Monthly KPI summary' },
        data: {
          progress: {
            value: round0((achieved / KPIS.length) * 100),
            label: { keyVi: 'Đạt', keyEn: 'Achieved' },
          },
          statistics: [
            { label: { keyVi: 'Chỉ tiêu', keyEn: 'KPIs' }, value: KPIS.length },
            { label: { keyVi: 'Đạt', keyEn: 'Achieved' }, value: achieved },
            { label: { keyVi: 'Không đạt', keyEn: 'Not achieved' }, value: KPIS.length - achieved },
          ],
        },
      },
      {
        type: 'card',
        title: { keyVi: 'Chưa tốt', keyEn: 'Needs attention' },
        variant: 'error',
        data: {
          description: {
            keyVi: `Hệ số sử dụng tải hàng ${loadKpi.actual}% — thấp hơn KH ${loadKpi.target}% (${loadKpi.progress}% hoàn thành). Nội địa ${loadKpi.splits.network.th[0]}% nhưng Quốc tế chỉ ${loadKpi.splits.network.th[1]}%; hàng đặc biệt thấp nhất (${loadKpi.splits.sector.th[3]}%).`,
            keyEn: `Load factor ${loadKpi.actual}% — below ${loadKpi.target}% plan (${loadKpi.progress}% completion). Domestic ${loadKpi.splits.network.th[0]}% but international only ${loadKpi.splits.network.th[1]}%; special cargo lowest (${loadKpi.splits.sector.th[3]}%).`,
          },
        },
      },
      {
        type: 'card',
        title: { keyVi: 'Tín hiệu tích cực', keyEn: 'Positive signals' },
        variant: 'success',
        data: {
          description: {
            keyVi: `Thị phần ${shareKpi.actual}% (+${ppChange(shareKpi.actual, shareKpi.prior)} điểm %), sản lượng ${volKpi.actual.toLocaleString('vi-VN')} tấn (${volKpi.progress}% KH). Doanh thu và RFTK duy trì trên kế hoạch; Châu Á–Thái Bình Dương chiếm ${round0(AREA_W[0] * 100)}% sản lượng.`,
            keyEn: `Market share ${shareKpi.actual}% (+${ppChange(shareKpi.actual, shareKpi.prior)} pp), volume ${volKpi.actual.toLocaleString('en-US')} tons (${volKpi.progress}% of plan). Revenue and RFTK remain above plan; Asia-Pacific accounts for ${round0(AREA_W[0] * 100)}% of volume.`,
          },
        },
      },
      {
        type: 'card',
        title: { keyVi: 'Khuyến nghị hành động', keyEn: 'Recommended actions' },
        variant: 'warning',
        data: {
          description: {
            keyVi: 'Ưu tiên tối ưu belly cargo và mix hàng trên sector Nhật–Hàn; rà soát capacity T2 sau Tết. Triển khai action plan nâng load factor Quốc tế lên ≥43% trong Q1.',
            keyEn: 'Prioritize belly-cargo optimization and cargo mix on Japan–Korea sectors; review post-Tet capacity in Feb. Deploy an action plan to lift international load factor to ≥43% in Q1.',
          },
        },
      },
    ],
    filter: [
      { title: [{ keyVi: 'Tất cả', keyEn: 'All' }], path: '/', count: KPIS.length },
      ...KPIS.map((k) => ({
        title: [{ keyVi: k.titleVi, keyEn: k.titleEn }],
        path: k.filterPath,
        count: 1,
      })),
    ],
  };
}

function buildChartCatalog() {
  const DIMENSION = {
    'trend-12m': 'time',
    'by-network': 'network',
    'by-area': 'area',
    'by-country': 'country',
    'by-sector': 'sector',
    'bullet-th-kh': 'bullet',
  };
  const TITLE = {
    'trend-12m': { keyVi: 'Xu hướng 12 tháng', keyEn: '12-month trend' },
    'by-network': { keyVi: 'Theo Network', keyEn: 'By network' },
    'by-area': { keyVi: 'Theo Area', keyEn: 'By area' },
    'by-country': { keyVi: 'Theo Country', keyEn: 'By country' },
    'by-sector': { keyVi: 'Theo Sector', keyEn: 'By sector' },
    'bullet-th-kh': { keyVi: 'Bullet: TH so với KH', keyEn: 'Bullet: actual vs plan' },
  };

  const chartTypes = Object.fromEntries(
    DRILLDOWN_KEYS.map((key) => [
      key,
      { dimension: DIMENSION[key], chartKey: DRILLDOWN_CHART_KIND[key], title: TITLE[key] },
    ]),
  );

  const kpiCharts = Object.fromEntries(
    KPIS.map((k) => [
      k.code,
      {
        metricCode: k.metricCode,
        filterPath: k.filterPath,
        title: { keyVi: k.titleVi, keyEn: k.titleEn },
        charts: [...DRILLDOWN_KEYS],
      },
    ]),
  );

  return { chartTypes, kpiCharts };
}

// ─── IO ─────────────────────────────────────────────────────────────────────

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 4)}\n`);
}

function generate() {
  writeJson(path.join(PERIOD_ROOT, 'overview/index.json'), buildOverviewIndex());

  const kpiCards = KPIS.map(buildKpiCard);
  writeJson(path.join(PERIOD_ROOT, 'kpis/all/index.json'), kpiCards);
  kpiCards.forEach((card, i) => writeJson(path.join(PERIOD_ROOT, `kpis/index${i}.json`), [card]));
  writeJson(path.join(PERIOD_ROOT, 'kpis/index.json'), kpiCards);

  writeJson(path.join(PERIOD_ROOT, 'board/index.json'), KPIS.map(buildOverviewChart));
  writeJson(path.join(MODULE_ROOT, 'chart-catalog.json'), buildChartCatalog());

  for (const kpi of KPIS) {
    for (const key of DRILLDOWN_KEYS) {
      writeJson(
        path.join(PERIOD_ROOT, `board/charts/${kpi.code}/${key}.json`),
        buildDrilldownChart(kpi, key),
      );
    }
  }

  console.log('Generated TTHH M_1 (coherent cargo model):');
  console.log('  overview/index.json');
  console.log('  kpis/ (all + index0..4)');
  console.log(`  board/index.json — ${KPIS.length} mixed overview charts`);
  console.log(`  board/charts/ — ${KPIS.length * DRILLDOWN_KEYS.length} drill-downs (line·bar·combo·radar·doughnut)`);
  console.log('  chart-catalog.json');
}

generate();

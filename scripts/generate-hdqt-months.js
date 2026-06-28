#!/usr/bin/env node
/**
 * Generate ApiV2/TCNL/HDQT/M from BGD/M template.
 * - Same structure as BGD/M except fight-time pages removed
 * - overview + kpis/all + board/all aligned with HDQT Figma (node 21689:22039)
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '../ApiV2/TCNL/BGD/M');
const TARGET = path.join(__dirname, '../ApiV2/TCNL/HDQT/M');

const SKIP_PATTERNS = [
  /[/\\]fight-time[/\\]/,
  /[/\\]flight-time[/\\]/,
];

// Figma: Cấp HĐQT theo Tháng - Tổng quan KPIs (M_12 template)
const FIGMA_M12_KPI = {
  nsld: {
    actual: 246,
    target: 245,
    trendDirection: 'up',
    trendValue: 13.8,
    variant: 'success',
    progress: 100,
    statusLabel: { keyVi: 'ĐẠT', keyEn: 'ACHIEVED' },
  },
  labor: {
    actual: 7.195,
    target: 7.2,
    trendDirection: 'down',
    trendValue: 0.5,
    variant: 'success',
    progress: 100,
    statusLabel: { keyVi: 'ĐẠT', keyEn: 'ACHIEVED' },
  },
};

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

function buildOverview() {
  const template = readJson(path.join(SOURCE, 'M_12/overview/index.json'));
  template.data[0].data.progress.value = 100;
  template.data[0].data.statistics[0].value = 2;
  template.data[0].data.statistics[1].value = 2;
  template.data[0].data.statistics[2].value = 0;
  template.filter = [
    {
      title: [{ keyVi: 'Tất cả', keyEn: 'All' }],
      path: '/',
      count: 2,
    },
    {
      title: [{ keyVi: 'Năng suất lao động', keyEn: 'Labor Productivity' }],
      path: '/labor-productivity',
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

function buildKpisAll(month) {
  const bgd = readJson(path.join(SOURCE, `M_${month}/kpis/all/index.json`));
  const result = bgd
    .filter((k) => !/Giờ bay/i.test(k.title.keyVi))
    .slice(0, 2);

  if (month === 12) {
    Object.assign(result[0], FIGMA_M12_KPI.nsld);
    Object.assign(result[1], FIGMA_M12_KPI.labor);
  }

  return result;
}

function buildBoardAllIndex(month) {
  const bgd = readJson(path.join(SOURCE, `M_${month}/board/all/index.json`));
  const board = replaceOrgInJson(bgd);
  board[0].child = board[0].child.filter((c) => !/Giờ bay/i.test(c.title.keyVi));
  board[0].child = board[0].child.map((c) => ({
    ...c,
    child: c.child.replace(/M_M_\d+|M_\d+/, `M_${month}`),
  }));
  return board;
}

function syncAllChartWithKpis(month, kpisAll) {
  const chart0Path = path.join(TARGET, `M_${month}/board/all/chart/index0.json`);
  if (!fs.existsSync(chart0Path) || !kpisAll[0]) return;

  const chart0 = readJson(chart0Path);
  const idx = month - 1;
  const actualSeries = chart0.data.find((d) => d.key.keyVi === 'Thực hiện');
  if (actualSeries && actualSeries.name[idx] !== undefined) {
    actualSeries.name[idx] = kpisAll[0].actual;
  }
  writeJson(chart0Path, chart0);
}

function copyMonth(month) {
  const srcDir = path.join(SOURCE, `M_${month}`);
  const tgtDir = path.join(TARGET, `M_${month}`);

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

      // Skip flight-time charts in board/all
      if (/board\/all\/chart\/index[23]\.json$/.test(relPath)) continue;

      writeJson(tgtPath, replaceOrgInJson(readJson(srcPath)));
    }
  }

  walk('');

  writeJson(path.join(tgtDir, 'overview/index.json'), buildOverview());

  const kpisAll = buildKpisAll(month);
  writeJson(path.join(tgtDir, 'kpis/all/index.json'), kpisAll);
  writeJson(path.join(tgtDir, 'board/all/index.json'), buildBoardAllIndex(month));

  syncAllChartWithKpis(month, kpisAll);

  console.log(
    `M_${month}: NSLĐ=${kpisAll[0].actual} (${kpisAll[0].statusLabel.keyVi}) | KH LĐ=${kpisAll[1].actual} (${kpisAll[1].statusLabel.keyVi})`
  );
}

for (let m = 1; m <= 12; m++) copyMonth(m);
console.log('Done. Generated ApiV2/TCNL/HDQT/M/M_1 .. M_12');

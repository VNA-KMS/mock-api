/**
 * fix-market-share-final.js
 *
 * Final fixes:
 * 1. Align cumulative metric cards with chart th_lk values
 * 2. Revise aiInsight texts: "{title}: Thực hiện...; so với CK...; so với dự báo..."
 *
 * Run: node scripts/fix-market-share-final.js
 */
const fs = require('fs')
const path = require('path')

const BASE_DIR = path.resolve(__dirname, '../apiV5/domain/ceo-command-center/market-share/2026')
const PERIODS = ['07', 'Q3', 'W31']

function round1(n) { return Math.round((n + Number.EPSILON) * 10) / 10 }
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')) }
function writeJson(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8') }

const PERIOD_LABEL = { '07': 'Tháng 7', 'Q3': 'Quý 3', 'W31': 'Tuần 31', '2026': 'Tháng 7' }

// ─────────────────────────────────────────────────────────
//  Fix 1: Cumulative metric cards
// ─────────────────────────────────────────────────────────
function fixCumulativeMetricCards() {
  const chartMap = [
    { file: 'cf_network_total_b_pax_total.json', key: 't_tot' },
    { file: 'cf_network_total_b_pax_int.json',   key: 't_int' },
    { file: 'cf_network_total_b_pax_dom.json',   key: 't_dom' },
  ]

  for (const period of PERIODS) {
    const values = {}
    for (const { file, key } of chartMap) {
      const p = path.join(BASE_DIR, period, 'chart', file)
      if (!fs.existsSync(p)) continue
      const d = readJson(p)
      const rows = d.autoChart?.dataset?.rows || []
      const cols = d.autoChart?.dataset?.columns || []
      const currentCategory = getCurrentCategory(period)
      const lkIdx = cols.findIndex(c => c.id === 'th_lk')
      if (!currentCategory || lkIdx === -1) continue
      const hlRow = rows.find(r => r[0] === currentCategory)
      if (hlRow) values[key] = hlRow[lkIdx]
    }

    const idxPath = path.join(BASE_DIR, period, 'index.json')
    const data = readJson(idxPath)
    const cards = data.metricCardsCumulative?.items
    if (!cards) continue

    for (const item of cards) {
      if (values[item.id] !== undefined) {
        item.value = String(round1(values[item.id]))
      }
    }
    writeJson(idxPath, data)
    console.log(`✅ ${period} metricCardsCumulative: t_tot=${values.t_tot}, t_int=${values.t_int}, t_dom=${values.t_dom}`)
  }

  // Root 2026 → copy from 07
  const rootPath = path.join(BASE_DIR, 'index.json')
  const idx07 = readJson(path.join(BASE_DIR, '07', 'index.json'))
  const root = readJson(rootPath)
  if (idx07.metricCardsCumulative?.items && root.metricCardsCumulative) {
    root.metricCardsCumulative.items = JSON.parse(JSON.stringify(idx07.metricCardsCumulative.items))
    writeJson(rootPath, root)
    console.log('✅ 2026 metricCardsCumulative synced from 07')
  }
}

// ─────────────────────────────────────────────────────────
//  Fix 2: aiInsight revision
// ─────────────────────────────────────────────────────────

function fmtNum(n) {
  // Format 2 decimals with comma
  return n.toFixed(2).replace('.', ',')
}
function fmtPct(n) {
  // Percentage with 1 decimal
  return n.toFixed(1).replace('.', ',')
}

function genPaxInsight(title, th, ck, db) {
  const thStr = fmtNum(th)
  let ckStr = ''
  let dbStr = ''

  if (ck != null && ck > 0) {
    const pct = (th / ck - 1) * 100
    ckStr = pct >= 0 ? `tăng ${fmtPct(pct)}%` : `giảm ${fmtPct(Math.abs(pct))}%`
  }
  if (db != null && db > 0) {
    const ratio = (th / db) * 100
    dbStr = ratio >= 100 ? `vượt ${fmtPct(ratio - 100)}%` : `đạt ${fmtPct(ratio)}%`
  }

  return {
    text: `${title}: Thực hiện ${thStr} triệu; so với CK ${ckStr}; so với dự báo ${dbStr}.`,
    tone: 'info',
    status: 1
  }
}

function genShareInsight(title, th, ck, db) {
  // Sanity: market share percentage must be 0-100
  if (th > 100 || th < 0) return null

  const thStr = fmtPct(th)
  let ckStr = ''
  let dbStr = ''

  if (ck != null && ck > 0 && ck <= 100) {
    const diff = th - ck
    if (Math.abs(diff) < 50) { // reasonable diff
      ckStr = diff >= 0 ? `tăng ${fmtPct(diff)} điểm %` : `giảm ${fmtPct(Math.abs(diff))} điểm %`
    }
  }
  if (db != null && db > 0 && db <= 100) {
    const diff = th - db
    if (Math.abs(diff) < 50) { // reasonable diff
      dbStr = diff >= 0 ? `cao hơn ${fmtPct(diff)} điểm %` : `thấp hơn ${fmtPct(Math.abs(diff))} điểm %`
    }
  }

  if (!ckStr && !dbStr) return null // invalid data, use generic

  return {
    text: `${title}: Thực hiện ${thStr}%; so với CK ${ckStr}; so với KH ${dbStr}.`,
    tone: 'info',
    status: 1
  }
}

function genGenericInsight(title) {
  return {
    text: `${title}: Dữ liệu thị trường được cập nhật theo kỳ báo cáo.`,
    tone: 'info',
    status: 1
  }
}

function getCurrentCategory(period) {
  const map = { '07': 'T7', 'Q3': 'Q3', 'W31': 'W31', '2026': 'T7' }
  return map[period] || null
}

function getHighlightRow(chartData, period) {
  if (!chartData?.autoChart?.dataset) return null
  const currentCategory = getCurrentCategory(period)
  const rows = chartData.autoChart.dataset.rows || []
  const cols = chartData.autoChart.dataset.columns || []
  if (!currentCategory) return null
  const hlRow = rows.find(r => r[0] === currentCategory)
  if (!hlRow) return null
  const idx = id => cols.findIndex(c => c.id === id)
  return {
    th: hlRow[idx('th')],
    ck: hlRow[idx('ck')],
    db: hlRow[idx('db')],
    unit: chartData.autoChart.views?.[0]?.tooltipUnit
  }
}

function shouldKeepExisting(id) {
  // Region INT charts that already have detailed K-unit insights
  if (/^b_int_(eu|au_us|us|nea|sea|clmv)$/.test(id)) return true
  // Region DOM charts that already have detailed K-unit insights
  if (/^b_dom_(hansgn|handad|sgndad|trucle|dulich|diaphuong)$/.test(id)) return true
  // Route share
  if (id === 'b_int_route_share') return true
  return false
}

function isPaxUnit(unit) { return unit && unit.includes('Triệu khách') }
function isShareUnit(unit) { return unit && unit.includes('%') }

function generateForItem(item, period) {
  const id = item.id || ''
  const title = item.title || ''

  // Keep existing detailed insights for region charts
  if (shouldKeepExisting(id)) return null

  // b_total_int_dom_pie: special composition
  if (id === 'b_total_int_dom_pie') {
    const periodActual = period === '2026' ? '07' : period
    let intTh = 0, domTh = 0
    try {
      const intData = readJson(path.join(BASE_DIR, periodActual, 'chart', 'cf_network_total_b_pax_int.json'))
      const r = getHighlightRow(intData, periodActual)
      if (r && r.th != null) intTh = r.th
    } catch {}
    try {
      const domData = readJson(path.join(BASE_DIR, periodActual, 'chart', 'cf_network_total_b_pax_dom.json'))
      const r = getHighlightRow(domData, periodActual)
      if (r && r.th != null) domTh = r.th
    } catch {}
    return {
      text: `${title}: Thực hiện ${fmtNum(intTh + domTh)} triệu; Quốc tế ${fmtNum(intTh)} triệu; Nội địa ${fmtNum(domTh)} triệu.`,
      tone: 'info', status: 1
    }
  }

  // Try to read chart data (chartPath is relative to mock-api root)
  let chartData = null
  if (item.chartPath) {
    const chartFilePath = path.resolve(__dirname, '..', item.chartPath.replace(/^\//, ''))
    if (fs.existsSync(chartFilePath)) {
      try { chartData = readJson(chartFilePath) } catch {}
    }
  }

  if (!chartData) return genGenericInsight(title)

  const hl = getHighlightRow(chartData, period)
  if (!hl || hl.th == null) return genGenericInsight(title)

  const { th, ck, db, unit } = hl

  // Pax chart
  if (isPaxUnit(unit)) return genPaxInsight(title, th, ck, db)
  // Share chart
  if (isShareUnit(unit)) {
    const si = genShareInsight(title, th, ck, db)
    if (si) return si
    // fall through to generic if share data is invalid
  }

  return genGenericInsight(title)
}

function generateAllInsights(period) {
  const indexPath = period === '2026' ? path.join(BASE_DIR, 'index.json') : path.join(BASE_DIR, period, 'index.json')
  if (!fs.existsSync(indexPath)) return 0
  const data = readJson(indexPath)
  let count = 0

  function walkItems(items) {
    if (!Array.isArray(items)) return
    for (const item of items) {
      const insight = generateForItem(item, period)
      if (insight) {
        item.aiInsight = insight
        count++
      }
    }
  }

  function walkChartBoards(obj) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item && Array.isArray(item.items)) walkItems(item.items)
      }
      return
    }
    if (obj.chartBoard) walkChartBoards(obj.chartBoard)
    if (obj.contentFilter?.network) {
      for (const key of ['total', 'int', 'dom']) {
        if (obj.contentFilter.network[key]?.chartBoard) walkChartBoards(obj.contentFilter.network[key].chartBoard)
      }
    }
  }

  walkChartBoards(data)
  if (count > 0) writeJson(indexPath, data)
  return count
}

// ─────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────
console.log('═'.repeat(60))
console.log('Final market-share fix')
console.log('═'.repeat(60))

console.log('\n📊 Fix 1: Cumulative metric cards')
fixCumulativeMetricCards()

console.log('\n💡 Fix 2: Revised aiInsight texts')
for (const period of [...PERIODS, '2026']) {
  const n = generateAllInsights(period)
  console.log(`  ${period}/index.json: ${n} insights updated`)
}

// Verify cumulative values
console.log('\n🔍 Verification:')
const chartMap = [
  { file: 'cf_network_total_b_pax_total.json', key: 't_tot' },
  { file: 'cf_network_total_b_pax_int.json',   key: 't_int' },
  { file: 'cf_network_total_b_pax_dom.json',   key: 't_dom' },
]
for (const period of PERIODS) {
  const idx = readJson(path.join(BASE_DIR, period, 'index.json'))
  const cards = idx.metricCardsCumulative?.items || []
  console.log(`  ${period} cumulative:`)
  for (const { file, key } of chartMap) {
    const chartPath = path.join(BASE_DIR, period, 'chart', file)
    const d = readJson(chartPath)
    const rows = d.autoChart?.dataset?.rows || []
    const cols = d.autoChart?.dataset?.columns || []
    const currentCategory = getCurrentCategory(period)
    const lkIdx = cols.findIndex(c => c.id === 'th_lk')
    const hlRow = currentCategory ? rows.find(r => r[0] === currentCategory) : null
    const chartVal = hlRow && lkIdx >= 0 ? round1(hlRow[lkIdx]) : 'N/A'
    const cardVal = cards.find(c => c.id === key)?.value
    const match = String(chartVal) === cardVal
    console.log(`    ${key}: chart_lk=${chartVal}, card=${cardVal} ${match ? '✓' : '✗'}`)
  }
}

console.log('\n' + '═'.repeat(60))
console.log('Done!')
console.log('═'.repeat(60))

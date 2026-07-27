/**
 * fix-market-share-comprehensive.js
 *
 * Comprehensive fix for market-share mock data addressing all 4 issues:
 * 1. Scale "Triệu khách" pax chart data (÷1000, 2 decimals, recompute cumulative sums)
 * 2. Align chart highlights with metric cards
 * 3. Handle 2026/index.json (sync metric cards to 07 values)
 * 4. Add aiInsight to every chart item missing it
 *
 * Run: node scripts/fix-market-share-comprehensive.js
 */

const fs = require('fs')
const path = require('path')

const BASE_DIR = path.resolve(__dirname, '../apiV5/domain/ceo-command-center/market-share/2026')
const PERIODS = ['07', 'Q3', 'W31']
const PAX_FILES = [
  'cf_network_total_b_pax_total.json',
  'cf_network_total_b_pax_int.json',
  'cf_network_total_b_pax_dom.json'
]
const SHARE_FILES = [
  'cf_network_int_b_share_int.json',
  'cf_network_dom_b_share_dom.json'
]

const METRIC_TARGETS = {
  '07':   { t_tot: 2.3, t_int: 1.1, t_dom: 1.2 },
  'Q3':   { t_tot: 2.8, t_int: 1.3, t_dom: 1.5 },
  'W31':  { t_tot: 2.4, t_int: 1.2, t_dom: 1.2 },
  '2026': { t_tot: 2.3, t_int: 1.1, t_dom: 1.2 }
}

// Period labels for aiInsight text
const PERIOD_LABELS = {
  '07':  'Tháng 7',
  'Q3':  'Quý 3',
  'W31': 'Tuần 31'
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')) }
function writeJson(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8') }

// ─── Issue 1: Scale pax charts ───────────────────────────────────────────────
function scalePaxChart(filePath) {
  const data = readJson(filePath)
  const columns = data.autoChart?.dataset?.columns
  const rows = data.autoChart?.dataset?.rows
  if (!columns || !rows) return false

  const colMap = {}
  columns.forEach((c, i) => { colMap[c.id] = i })

  const monthlyCols = ['th', 'ck', 'db', 'fct']
  const cumulativeCols = ['th_lk', 'ck_lk', 'db_lk', 'fct_lk']

  // Step 1: Scale monthly values
  for (const row of rows) {
    for (const colId of monthlyCols) {
      const idx = colMap[colId]
      if (idx != null && row[idx] !== null && row[idx] !== undefined) {
        row[idx] = round2(row[idx] / 1000)
      }
    }
  }

  // Step 2: Recompute cumulative as running sums of monthly values
  const runningSums = {}
  for (const colId of cumulativeCols) {
    runningSums[colId] = 0
  }

  for (const row of rows) {
    for (const cumCol of cumulativeCols) {
      const baseCol = cumCol.replace('_lk', '')
      const baseIdx = colMap[baseCol]
      const cumIdx = colMap[cumCol]
      if (baseIdx == null || cumIdx == null) continue

      if (row[baseIdx] !== null && row[baseIdx] !== undefined) {
        runningSums[cumCol] = round2((runningSums[cumCol] || 0) + row[baseIdx])
        row[cumIdx] = runningSums[cumCol]
      } else {
        // Keep null for th_lk when th is null; reset running sum to 0 for other cumulatives
        if (cumCol === 'th_lk') {
          row[cumIdx] = null
        } else {
          row[cumIdx] = null
        }
      }
    }
  }

  writeJson(filePath, data)
  return true
}

// ─── Issue 2: Align chart highlights to metric cards ─────────────────────────
function getCurrentCategory(period) {
  const map = { '07': 'T7', 'Q3': 'Q3', 'W31': 'W31', '2026': 'T7' }
  return map[period] || null
}

function alignChartHighlights(period) {
  const targets = METRIC_TARGETS[period]
  if (!targets) return 0

  const chartMap = {
    'cf_network_total_b_pax_total.json': 't_tot',
    'cf_network_total_b_pax_int.json':   't_int',
    'cf_network_total_b_pax_dom.json':   't_dom'
  }

  let count = 0
  for (const [fileName, metricKey] of Object.entries(chartMap)) {
    const filePath = path.join(BASE_DIR, period, 'chart', fileName)
    if (!fs.existsSync(filePath)) continue

    const data = readJson(filePath)
    const targetValue = targets[metricKey]
    const currentCategory = getCurrentCategory(period)
    const rows = data.autoChart?.dataset?.rows
    const columns = data.autoChart?.dataset?.columns
    if (!currentCategory || !rows || !columns) continue

    const thIdx = columns.findIndex(c => c.id === 'th')
    if (thIdx === -1) continue

    const hlRow = rows.find(r => r[0] === currentCategory)
    if (!hlRow) continue

    hlRow[thIdx] = targetValue

    // Recompute cumulative columns after changing the highlight value
    const cumulativeCols = ['th_lk', 'ck_lk', 'db_lk', 'fct_lk']
    const colMap = {}
    columns.forEach((c, i) => { colMap[c.id] = i })

    const runningSums = { th_lk: 0, ck_lk: 0, db_lk: 0, fct_lk: 0 }
    for (const row of rows) {
      for (const cumCol of cumulativeCols) {
        const baseCol = cumCol.replace('_lk', '')
        const baseIdx = colMap[baseCol]
        const cumIdx = colMap[cumCol]
        if (baseIdx == null || cumIdx == null) continue

        if (row[baseIdx] !== null && row[baseIdx] !== undefined) {
          runningSums[cumCol] = round2((runningSums[cumCol] || 0) + row[baseIdx])
          row[cumIdx] = runningSums[cumCol]
        } else {
          row[cumIdx] = null
        }
      }
    }

    writeJson(filePath, data)
    count++
  }
  return count
}

// ─── Issue 3: Sync 2026/index.json metric cards to 07 values ─────────────────
function syncRootIndexTo07() {
  const rootPath = path.join(BASE_DIR, 'index.json')
  if (!fs.existsSync(rootPath)) return false

  // Read 07 index to get its metric card values and sparklines
  const idx07Path = path.join(BASE_DIR, '07', 'index.json')
  const idx07 = readJson(idx07Path)
  const rootData = readJson(rootPath)

  // Copy metricCard items from 07
  if (idx07.metricCards?.items && rootData.metricCards) {
    rootData.metricCards.items = JSON.parse(JSON.stringify(idx07.metricCards.items))
  }

  // Copy metricCardsCumulative items from 07
  if (idx07.metricCardsCumulative?.items && rootData.metricCardsCumulative) {
    rootData.metricCardsCumulative.items = JSON.parse(JSON.stringify(idx07.metricCardsCumulative.items))
  }

  writeJson(rootPath, rootData)
  return true
}

// ─── Issue 4: Add aiInsight to chart items ───────────────────────────────────
function generateInsightForChart(item, period, chartData) {
  const id = item.id || ''
  const title = item.title || ''
  const subTitle = item.subTitle || ''
  const target = METRIC_TARGETS[period]

  // If it already has aiInsight, keep it
  if (item.aiInsight) return null

  // Determine chart type from id/title to generate appropriate insight
  if (id.includes('b_pax_total') || title.includes('Toàn thị trường')) {
    return {
      text: `<strong>${PERIOD_LABELS[period]}:</strong> Số khách toàn thị trường đạt <strong>${target.t_tot.toFixed(2).replace('.', ',')}</strong> triệu; tăng <strong>4%</strong> so với cùng kỳ; dự báo T8 đạt <strong>1,28</strong> triệu.`,
      tone: 'info',
      status: 1
    }
  }

  if (id.includes('b_pax_int') || title.includes('Quốc tế')) {
    return {
      text: `<strong>${PERIOD_LABELS[period]}:</strong> Khách quốc tế đạt <strong>${target.t_int.toFixed(2).replace('.', ',')}</strong> triệu; tăng <strong>6%</strong> so với cùng kỳ; dự báo T8 đạt <strong>1,14</strong> triệu.`,
      tone: 'info',
      status: 1
    }
  }

  if (id.includes('b_pax_dom') || title.includes('Nội địa')) {
    return {
      text: `<strong>${PERIOD_LABELS[period]}:</strong> Khách nội địa đạt <strong>${target.t_dom.toFixed(2).replace('.', ',')}</strong> triệu; tăng <strong>2%</strong> so với cùng kỳ; dự báo T8 đạt <strong>1,20</strong> triệu.`,
      tone: 'info',
      status: 1
    }
  }

  if (id.includes('b_share_int') && title.includes('Quốc tế')) {
    return {
      text: `<strong>${PERIOD_LABELS[period]}:</strong> Thị phần VNA Group quốc tế đạt <strong>28,2%</strong>, thấp hơn <strong>0,8</strong> điểm % so với KH; xu hướng ổn định.`,
      tone: 'warning',
      status: 1
    }
  }

  if (id.includes('b_share_dom') && title.includes('Nội địa')) {
    return {
      text: `<strong>${PERIOD_LABELS[period]}:</strong> Thị phần VNA Group nội địa đạt <strong>45,4%</strong>, thấp hơn <strong>0,6</strong> điểm % so với KH.`,
      tone: 'warning',
      status: 1
    }
  }

  if (id.includes('b_total_int_dom_pie')) {
    return {
      text: `Cơ cấu thị trường INT/DOM: Quốc tế chiếm <strong>${(target.t_int / target.t_tot * 100).toFixed(0)}%</strong>, Nội địa chiếm <strong>${(target.t_dom / target.t_tot * 100).toFixed(0)}%</strong>.`,
      tone: 'info',
      status: 1
    }
  }

  if (id.includes('b_total_market_structure')) {
    return {
      text: `Cơ cấu thị trường: Khu vực NEA dẫn đầu về thị phần quốc tế, tiếp theo là SEA và CLMV.`,
      tone: 'info',
      status: 1
    }
  }

  // Region charts with subTitle 'ĐVT: %' — share charts
  if (subTitle.includes('%') && !item.aiInsight) {
    // Generic share insight
    const regionName = title.replace('Thị phần ', '').trim()
    return {
      text: `Thị phần ${regionName} duy trì ổn định trong kỳ.`,
      tone: 'info',
      status: 1
    }
  }

  // Pie / stacked / treemap / route share — composition summaries
  if (id.includes('_pie') || id.includes('_treemap') || id.includes('_route_pie') || id.includes('_share_pie') || id.includes('_route_share')) {
    return {
      text: `Cơ cấu thị trường: ${title}.`,
      tone: 'info',
      status: 1
    }
  }

  // Carrier/vna group share charts
  if (id.includes('_vna_group') || id.includes('_vna') || id.includes('_carrier_share') || id.includes('_pa') || id.includes('_vj') || id.includes('_ba') || id.includes('_sun') || id.includes('_vu')) {
    return {
      text: `Thị phần ${title} duy trì ổn định.`,
      tone: 'info',
      status: 1
    }
  }

  // Risk chart
  if (id.includes('b_risk')) {
    return {
      text: `Theo dõi biến động thị phần theo khu vực; phát hiện các điểm giảm cần cảnh báo.`,
      tone: 'warning',
      status: 1
    }
  }

  // Country share charts
  if (id.includes('_country')) {
    const region = title.replace(' - Thị phần Country', '').trim()
    return {
      text: `Thị phần Country khu vực ${region} duy trì ổn định.`,
      tone: 'info',
      status: 1
    }
  }

  // Fallback
  return {
    text: `${title}: Dữ liệu thị trường được cập nhật theo kỳ báo cáo.`,
    tone: 'info',
    status: 1
  }
}

function getChartData(filePath) {
  if (!fs.existsSync(filePath)) return null
  try { return readJson(filePath) } catch { return null }
}

function addAiInsightsToIndex(period) {
  const indexPath = period === '2026'
    ? path.join(BASE_DIR, 'index.json')
    : path.join(BASE_DIR, period, 'index.json')

  if (!fs.existsSync(indexPath)) return 0

  const data = readJson(indexPath)
  let count = 0

  function walkChartItems(items) {
    if (!Array.isArray(items)) return
    for (const item of items) {
      if (item.aiInsight) continue // skip existing insights
      // Don't add insights to the top-level Strategic Trend Zone / Enterprise Risk Zone items
      if (item.id === 'b_int' || item.id === 'b_dom' || item.id === 'b_carrier' || item.id === 'b_risk') {
        // Only add if it doesn't have one
        const insight = generateInsightForChart(item, period, null)
        if (insight) {
          item.aiInsight = insight
          count++
        }
        continue
      }

      // Read chart data if chartPath exists
      let chartData = null
      if (item.chartPath) {
        const chartFilePath = path.resolve(BASE_DIR, '..', item.chartPath)
        chartData = getChartData(chartFilePath)
      }

      const insight = generateInsightForChart(item, period, chartData)
      if (insight) {
        item.aiInsight = insight
        count++
      }
    }
  }

  function walkBoards(obj) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item.items) {
          walkChartItems(item.items)
        } else {
          walkBoards(item)
        }
      }
    } else {
      if (obj.chartBoard) {
        walkBoards(obj.chartBoard)
      }
      if (obj.contentFilter) {
        // contentFilter has network/total/int/dom keys
        Object.values(obj.contentFilter).forEach(walkBoards)
      }
      // Walk network keys (total, int, dom) when we're at the network level
      for (const key of ['total', 'int', 'dom']) {
        if (obj[key]) walkBoards(obj[key])
      }
    }
  }

  walkBoards(data)

  if (count > 0) writeJson(indexPath, data)
  return count
}

// ─── Verify share charts ────────────────────────────────────────────────────
function verifyShareCharts() {
  let allNull = true
  for (const period of PERIODS) {
    for (const file of SHARE_FILES) {
      const filePath = path.join(BASE_DIR, period, 'chart', file)
      if (!fs.existsSync(filePath)) continue
      const data = readJson(filePath)
      const columns = data.autoChart?.dataset?.columns || []
      const rows = data.autoChart?.dataset?.rows || []
      const fctLkIdx = columns.findIndex(c => c.id === 'fct_lk')
      if (fctLkIdx === -1) continue
      for (const row of rows) {
        if (row[fctLkIdx] !== null) {
          console.log(`  ⚠️  ${period}/chart/${file}: fct_lk = ${row[fctLkIdx]} at ${row[0]}`)
          allNull = false
        }
      }
    }
  }
  return allNull
}

// ─── Update metric cards in per-period indexes ───────────────────────────────
function updateMetricCards(period) {
  const indexPath = period === '2026'
    ? path.join(BASE_DIR, 'index.json')
    : path.join(BASE_DIR, period, 'index.json')
  if (!fs.existsSync(indexPath)) return false

  const data = readJson(indexPath)
  const targets = METRIC_TARGETS[period]
  if (!targets) return false

  let changed = false
  for (const key of ['metricCards', 'metricCardsCumulative']) {
    const cards = data[key]
    if (!cards?.items) continue
    for (const item of cards.items) {
      if (item.id === 't_tot' && item.value !== String(targets.t_tot)) {
        item.value = String(targets.t_tot)
        changed = true
      }
      if (item.id === 't_int' && item.value !== String(targets.t_int)) {
        item.value = String(targets.t_int)
        changed = true
      }
      if (item.id === 't_dom' && item.value !== String(targets.t_dom)) {
        item.value = String(targets.t_dom)
        changed = true
      }
    }
  }

  if (changed) writeJson(indexPath, data)
  return changed
}

// ─── Main ────────────────────────────────────────────────────────────────────
function run() {
  console.log('═'.repeat(60))
  console.log('Market-Share Data Fix — Comprehensive')
  console.log('═'.repeat(60))

  // ── Issue 1: Scale pax charts ──
  console.log('\n📊 Issue 1: Scaling pax chart data (÷1000, 2 decimals)')
  let scaled = 0
  for (const period of PERIODS) {
    for (const file of PAX_FILES) {
      const filePath = path.join(BASE_DIR, period, 'chart', file)
      if (!fs.existsSync(filePath)) continue
      if (scalePaxChart(filePath)) {
        console.log(`  ✅ ${period}/chart/${file} — scaled`)
        scaled++
      }
    }
  }
  console.log(`  → ${scaled}/9 pax chart files scaled`)

  // ── Issue 2: Align chart highlights ──
  console.log('\n🎯 Issue 2: Aligning chart highlights with metric cards')
  let aligned = 0
  for (const period of PERIODS) {
    const n = alignChartHighlights(period)
    aligned += n
  }
  console.log(`  → ${aligned}/9 pax chart highlights aligned`)

  // ── Issue 3: Handle 2026/index.json ──
  console.log('\n🔄 Issue 3: Syncing 2026/index.json to 07 values')
  if (syncRootIndexTo07()) {
    console.log('  ✅ 2026/index.json metric cards synced to 07 values')
  } else {
    console.log('  ⚠️  Could not sync 2026/index.json')
  }

  // Also update metric card values in all index files
  console.log('\n📋 Updating metric card values in all index files')
  for (const period of [...PERIODS, '2026']) {
    if (updateMetricCards(period)) {
      console.log(`  ✅ ${period}/index.json metric cards updated`)
    }
  }

  // ── Verify share charts ──
  console.log('\n🔍 Issue 3 (verify): Share chart fct_lk check')
  if (verifyShareCharts()) {
    console.log('  ✅ All 6 share charts have fct_lk = null')
  } else {
    console.log('  ⚠️ Some share charts have non-null fct_lk values')
  }

  // ── Issue 4: Add aiInsights ──
  console.log('\n💡 Issue 4: Adding aiInsight to chart items')
  let insightCount = 0
  for (const period of [...PERIODS, '2026']) {
    const n = addAiInsightsToIndex(period)
    if (n > 0) {
      console.log(`  ✅ ${period}/index.json — ${n} insights added`)
      insightCount += n
    } else {
      console.log(`  ℹ️  ${period}/index.json — no new insights needed`)
    }
  }
  console.log(`  → ${insightCount} total aiInsight blocks added`)

  console.log('\n' + '═'.repeat(60))
  console.log('Fix complete!')
  console.log('═'.repeat(60))
}

run()

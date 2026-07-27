/**
 * fix-market-share-data.js
 *
 * Batch-fix market-share 2026 JSON data:
 * 1. Recompute t_tot metric card values and sparklines from t_int + t_dom.
 * 2. Move view-level labelShow:"all" to series-level showLabel:"all" on the th series only.
 * 3. Align fct/fct_lk in share charts to match the Toàn thị trường pattern:
 *    forecast values only for the next 1-2 future categories.
 * 4. Fix cross-period chart paths in contentFilter blocks.
 * 5. Regenerate non-flat metric-card sparklines matching trend tone.
 * 6. Scale "Triệu khách" pax chart data (÷1000, 2 decimals, recompute cumulative sums).
 * 7. Align chart highlights with metric card values.
 * 8. Sync 2026 root metric cards to 07 values.
 * 9. Add aiInsight to every chart item.
 *
 * Run: node scripts/fix-market-share-data.js
 */

const fs = require('fs')
const path = require('path')

const BASE_DIR = path.resolve(__dirname, '../apiV5/domain/ceo-command-center/market-share/2026')
const PERIODS = ['07', 'Q3', 'W31']

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function findIndexItem(items, id) {
  return items.find((it) => it.id === id)
}

function getPrimaryTrendTone(item) {
  // Prefer the plan trend; fall back to the first trend's tone if type is missing.
  const planTrend = item.trend?.find((t) => t.type === 'plan')
  return planTrend?.tone || item.trend?.[0]?.tone || 'neutral'
}

function generateTrendSparkline(endValue, tone, length = 8) {
  const end = Number(endValue)
  const startOffset = tone === 'positive' ? -Math.max(0.2, end * 0.15) : tone === 'negative' ? Math.max(0.2, end * 0.15) : 0
  const start = round1(Math.max(0.1, end + startOffset))
  const data = []
  for (let i = 0; i < length; i++) {
    const ratio = i / (length - 1)
    const v = round1(start + (end - start) * ratio)
    data.push(Math.max(0.1, v))
  }
  return data
}

function recomputeMetricCards(filePath) {
  const data = readJson(filePath)
  let changed = false
  for (const key of ['metricCards', 'metricCardsCumulative']) {
    const cards = data[key]
    if (!cards?.items) continue
    const tInt = findIndexItem(cards.items, 't_int')
    const tDom = findIndexItem(cards.items, 't_dom')
    const tTot = findIndexItem(cards.items, 't_tot')
    if (!tInt || !tDom || !tTot) continue

    const intVal = parseFloat(tInt.value)
    const domVal = parseFloat(tDom.value)
    const newTot = round1(intVal + domVal)
    if (String(newTot) !== String(tTot.value)) {
      tTot.value = String(newTot)
      changed = true
    }

    // Always regenerate sparklines so they trend up/down by tone instead of staying flat.
    // t_tot gets its own trend line based on its own tone, not the sum of t_int + t_dom,
    // so the visual slope is clear even when the two components move in opposite directions.
    const intTone = getPrimaryTrendTone(tInt)
    const domTone = getPrimaryTrendTone(tDom)
    const totTone = getPrimaryTrendTone(tTot)
    const intSpark = generateTrendSparkline(intVal, intTone)
    const domSpark = generateTrendSparkline(domVal, domTone)
    const totSpark = generateTrendSparkline(newTot, totTone)

    tInt.visualization = { type: 'sparkline', data: intSpark }
    tDom.visualization = { type: 'sparkline', data: domSpark }
    tTot.visualization = { type: 'sparkline', data: totSpark }
    changed = true
  }
  if (changed) writeJson(filePath, data)
  return changed
}

function fixLabelsInChart(filePath) {
  const data = readJson(filePath)
  let changed = false
  const views = data.autoChart?.views
  if (!Array.isArray(views)) return false

  for (const view of views) {
    if (view.labelShow === 'all') {
      delete view.labelShow
      changed = true
    }
    if (Array.isArray(view.series)) {
      for (const s of view.series) {
        if (s.field === 'th' && s.showLabel !== 'all') {
          s.showLabel = 'all'
          changed = true
        }
      }
    }
  }
  if (changed) writeJson(filePath, data)
  return changed
}

function getCurrentCategory(period) {
  const map = { '07': 'T7', 'Q3': 'Q3', 'W31': 'W31', '2026': 'T7' }
  return map[period] || null
}

function alignShareForecast(filePath, period) {
  const data = readJson(filePath)
  const rows = data.autoChart?.dataset?.rows
  const columns = data.autoChart?.dataset?.columns
  if (!Array.isArray(rows) || !Array.isArray(columns)) return false

  const fctIdx = columns.findIndex((c) => c.id === 'fct')
  const fctLkIdx = columns.findIndex((c) => c.id === 'fct_lk')
  if (fctIdx === -1 || fctLkIdx === -1) return false

  const currentCategory = getCurrentCategory(period)
  if (!currentCategory) return false

  const catIdx = rows.findIndex((r) => r[0] === currentCategory)
  if (catIdx === -1) return false
  const keepFromIndex = catIdx + 1
  // Keep at most 2 future categories (matches Toàn thị trường monthly pattern).
  const keepUntilIndex = Math.min(rows.length, keepFromIndex + 2)

  let changed = false
  rows.forEach((row, idx) => {
    if (idx < keepFromIndex || idx >= keepUntilIndex) {
      if (row[fctIdx] !== null) {
        row[fctIdx] = null
        changed = true
      }
      if (row[fctLkIdx] !== null) {
        row[fctLkIdx] = null
        changed = true
      }
    }
  })

  if (changed) writeJson(filePath, data)
  return changed
}

/**
 * Market-share percentage charts should not accumulate percentages when the cumulative
 * toggle is on. Make th_lk/ck_lk/db_lk equal to the monthly value so the chart stays in
 * the 20-50% range and does not trend upward like passenger-volume charts. fct_lk is kept
 * null because a cumulative forecast of market-share percentage is semantically invalid.
 */
function normalizeShareCumulative(filePath) {
  const data = readJson(filePath)
  const rows = data.autoChart?.dataset?.rows
  const columns = data.autoChart?.dataset?.columns
  if (!Array.isArray(rows) || !Array.isArray(columns)) return false

  const colMap = Object.fromEntries(columns.map((c, i) => [c.id, i]))
  const pairs = [
    ['th', 'th_lk'],
    ['ck', 'ck_lk'],
    ['db', 'db_lk'],
  ]

  let changed = false
  for (const row of rows) {
    for (const [src, dest] of pairs) {
      const srcIdx = colMap[src]
      const destIdx = colMap[dest]
      if (srcIdx == null || destIdx == null) continue
      const srcVal = row[srcIdx]
      if (srcVal === null || srcVal === undefined) {
        if (row[destIdx] !== null) {
          row[destIdx] = null
          changed = true
        }
      } else if (row[destIdx] !== srcVal) {
        row[destIdx] = srcVal
        changed = true
      }
    }
    const fctLkIdx = colMap['fct_lk']
    if (fctLkIdx != null && row[fctLkIdx] !== null) {
      row[fctLkIdx] = null
      changed = true
    }
  }

  if (changed) writeJson(filePath, data)
  return changed
}

/**
 * Cap forecast values in percentage share charts to a realistic 20-50% range and ensure
 * INT/DOM forecasts are slightly different.
 */
function capShareForecast(filePath, targetMin = 20, targetMax = 50) {
  const data = readJson(filePath)
  const rows = data.autoChart?.dataset?.rows
  const columns = data.autoChart?.dataset?.columns
  if (!Array.isArray(rows) || !Array.isArray(columns)) return false

  const fctIdx = columns.findIndex((c) => c.id === 'fct')
  if (fctIdx === -1) return false

  let changed = false
  for (const row of rows) {
    const v = row[fctIdx]
    if (v == null) continue
    if (v < targetMin || v > targetMax) {
      // Pick a deterministic value inside the range so INT and DOM charts differ.
      const isDom = filePath.includes('_dom_b_share_dom')
      row[fctIdx] = isDom ? 45.5 : 27.5
      changed = true
    }
  }

  if (changed) writeJson(filePath, data)
  return changed
}

function fixCrossPeriodPaths(filePath, period) {
  const data = readJson(filePath)
  let changed = false
  const contentFilter = data.contentFilter
  if (!contentFilter || typeof contentFilter !== 'object') return false

  function walk(obj) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      obj.forEach(walk)
    } else {
      if (typeof obj.chartPath === 'string') {
        const expected = `apiV5/domain/ceo-command-center/market-share/2026/${period}/`
        if (obj.chartPath.includes('/2026/07/') && period !== '07') {
          const newPath = obj.chartPath.replace('/2026/07/', `/2026/${period}/`)
          if (newPath !== obj.chartPath) {
            obj.chartPath = newPath
            changed = true
          }
        }
      }
      Object.values(obj).forEach(walk)
    }
  }

  walk(contentFilter)
  if (changed) writeJson(filePath, data)
  return changed
}

// ─────────────────────────────────────────────────────────
//  NEW HELPERS (Issue 1–4 from MARKET_SHARE_FIX_PLAN.md)
// ─────────────────────────────────────────────────────────

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

const PAX_FILES = [
  'cf_network_total_b_pax_total.json',
  'cf_network_total_b_pax_int.json',
  'cf_network_total_b_pax_dom.json'
]

const METRIC_TARGETS = {
  '07':   { t_tot: 2.3, t_int: 1.1, t_dom: 1.2 },
  'Q3':   { t_tot: 2.8, t_int: 1.3, t_dom: 1.5 },
  'W31':  { t_tot: 2.4, t_int: 1.2, t_dom: 1.2 },
  '2026': { t_tot: 2.3, t_int: 1.1, t_dom: 1.2 }
}

// Issue 1: Scale pax chart data
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

  // Step 2: Recompute cumulative as running sums
  const runningSums = Object.fromEntries(cumulativeCols.map(c => [c, 0]))
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
  return true
}

// Issue 2: Align chart highlights to metric cards
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

    // Recompute cumulative columns after changing highlight value
    const cumulativeCols = ['th_lk', 'ck_lk', 'db_lk', 'fct_lk']
    const colMap = {}
    columns.forEach((c, i) => { colMap[c.id] = i })
    const runningSums = Object.fromEntries(cumulativeCols.map(c => [c, 0]))

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

// Issue 3: Sync root 2026 metric cards to 07 values
function syncRootIndexTo07() {
  const rootPath = path.join(BASE_DIR, 'index.json')
  const idx07Path = path.join(BASE_DIR, '07', 'index.json')
  if (!fs.existsSync(rootPath) || !fs.existsSync(idx07Path)) return false

  const idx07 = readJson(idx07Path)
  const rootData = readJson(rootPath)

  if (idx07.metricCards?.items && rootData.metricCards) {
    rootData.metricCards.items = JSON.parse(JSON.stringify(idx07.metricCards.items))
  }
  if (idx07.metricCardsCumulative?.items && rootData.metricCardsCumulative) {
    rootData.metricCardsCumulative.items = JSON.parse(JSON.stringify(idx07.metricCardsCumulative.items))
  }

  writeJson(rootPath, rootData)
  return true
}

// Verify share chart fct_lk values
function verifyShareCharts() {
  const shareFiles = [
    'cf_network_int_b_share_int.json',
    'cf_network_dom_b_share_dom.json'
  ]
  let allNull = true
  for (const period of PERIODS) {
    for (const file of shareFiles) {
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

// Issue 4: aiInsight helpers
const PERIOD_LABELS = { '07': 'Tháng 7', 'Q3': 'Quý 3', 'W31': 'Tuần 31', '2026': 'Tháng 7' }

function generateInsight(item, period) {
  const id = item.id || ''
  const title = item.title || ''
  const t = METRIC_TARGETS[period]

  if (id === 'b_pax_total' || title === 'Toàn thị trường')
    return { text: `<strong>${PERIOD_LABELS[period]}:</strong> Số khách toàn thị trường đạt <strong>${t.t_tot.toFixed(2).replace('.', ',')}</strong> triệu, tăng <strong>4%</strong> so với cùng kỳ; dự báo T8 đạt <strong>1,28</strong> triệu.`, tone: 'info', status: 1 }
  if (id === 'b_pax_int' || title === 'Quốc tế')
    return { text: `<strong>${PERIOD_LABELS[period]}:</strong> Khách quốc tế đạt <strong>${t.t_int.toFixed(2).replace('.', ',')}</strong> triệu, tăng <strong>6%</strong> so với cùng kỳ; dự báo T8 đạt <strong>1,14</strong> triệu.`, tone: 'info', status: 1 }
  if (id === 'b_pax_dom' || title === 'Nội địa')
    return { text: `<strong>${PERIOD_LABELS[period]}:</strong> Khách nội địa đạt <strong>${t.t_dom.toFixed(2).replace('.', ',')}</strong> triệu, tăng <strong>2%</strong> so với cùng kỳ; dự báo T8 đạt <strong>1,20</strong> triệu.`, tone: 'info', status: 1 }
  if (id === 'b_share_int' && title.includes('Quốc tế'))
    return { text: `<strong>${PERIOD_LABELS[period]}:</strong> Thị phần VNA Group quốc tế đạt <strong>28,2%</strong>, thấp hơn <strong>0,8</strong> điểm % so với KH; xu hướng ổn định.`, tone: 'warning', status: 1 }
  if (id === 'b_share_dom' && title.includes('Nội địa'))
    return { text: `<strong>${PERIOD_LABELS[period]}:</strong> Thị phần VNA Group nội địa đạt <strong>45,4%</strong>, thấp hơn <strong>0,6</strong> điểm % so với KH.`, tone: 'warning', status: 1 }
  if (id === 'b_total_int_dom_pie')
    return { text: `Cơ cấu thị trường INT/DOM: Quốc tế chiếm <strong>${(t.t_int/t.t_tot*100).toFixed(0)}%</strong>, Nội địa chiếm <strong>${(t.t_dom/t.t_tot*100).toFixed(0)}%</strong>.`, tone: 'info', status: 1 }
  if (id === 'b_total_market_structure_stacked' || id === 'b_total_market_structure' || id === 'b_total_market_structure_bar100')
    return { text: `Cơ cấu thị trường theo khu vực: NEA dẫn đầu thị phần quốc tế, tiếp theo là SEA và CLMV.`, tone: 'info', status: 1 }
  if (id === 'b_risk')
    return { text: `Phát hiện biến động giảm thị phần tại một số khu vực, cần theo dõi chặt chẽ.`, tone: 'warning', status: 1 }
  if (id === 'b_int' || id === 'b_dom' || id === 'b_carrier')
    return { text: `${title}: Dữ liệu thị trường được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }
  if (id.startsWith('b_int_') && !id.includes('_country') && !id.includes('_route_share') && !id.includes('_route_pie') && !id.includes('_treemap'))
    return { text: `Khu vực ${title}: Dữ liệu khách quốc tế được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }
  if (id.startsWith('b_dom_') && !id.includes('_country') && !id.includes('_share_pie') && !id.includes('_route_pie') && !id.includes('_carrier_share') && !id.startsWith('b_dom_vna') && !id.startsWith('b_dom_pa') && !id.startsWith('b_dom_vj') && !id.startsWith('b_dom_ba') && !id.startsWith('b_dom_sun') && !id.startsWith('b_dom_vu'))
    return { text: `Khu vực ${title}: Dữ liệu khách nội địa được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }
  if (id.includes('_country')) {
    const region = title.replace(' - Thị phần Country', '')
    return { text: `Thị phần Country khu vực ${region}: Dữ liệu được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }
  }
  if (id.includes('_route_share'))
    return { text: `Thị phần route theo khu vực: SWP 44%, CLMV 31%, NEA 11%, SEA 6%, US 5%, EU 3%.`, tone: 'info', status: 1 }
  if (id.includes('_route_pie') || id.includes('_share_pie') || id.includes('_treemap'))
    return { text: `Cơ cấu ${title}: Thị phần được phân bổ theo các hãng bay.`, tone: 'info', status: 1 }
  if (id.includes('_carrier_share'))
    return { text: `Thị phần các hãng theo khu vực: VNA Group dẫn đầu thị phần nội địa.`, tone: 'info', status: 1 }
  if (id.startsWith('b_dom_vna_group') || id.startsWith('b_dom_vna') || id.startsWith('b_dom_pa') || id.startsWith('b_dom_vj') || id.startsWith('b_dom_ba') || id.startsWith('b_dom_sun') || id.startsWith('b_dom_vu'))
    return { text: `Thị phần ${title}: Dữ liệu được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }
  return { text: `${title}: Dữ liệu thị trường được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }
}

function addAiInsights(period) {
  const indexPath = period === '2026' ? path.join(BASE_DIR, 'index.json') : path.join(BASE_DIR, period, 'index.json')
  if (!fs.existsSync(indexPath)) return 0
  const data = readJson(indexPath)
  let count = 0

  function walkItems(items) {
    if (!Array.isArray(items)) return
    for (const item of items) {
      const insight = generateInsight(item, period)
      if (insight) { item.aiInsight = insight; count++ }
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
//  RUN
// ─────────────────────────────────────────────────────────

function run() {
  let metricUpdated = 0
  let labelUpdated = 0
  let shareUpdated = 0
  let pathUpdated = 0

  // 1. Metric cards in index files
  for (const period of PERIODS) {
    const indexPath = path.join(BASE_DIR, period, 'index.json')
    if (fs.existsSync(indexPath) && recomputeMetricCards(indexPath)) {
      console.log(`✅ metricCards ${period}/index.json`)
      metricUpdated++
    }
  }
  const rootIndex = path.join(BASE_DIR, 'index.json')
  if (fs.existsSync(rootIndex) && recomputeMetricCards(rootIndex)) {
    console.log(`✅ metricCards 2026/index.json`)
    metricUpdated++
  }

  // 2. Labels in all market-share chart JSONs
  for (const period of PERIODS) {
    const chartDir = path.join(BASE_DIR, period, 'chart')
    if (!fs.existsSync(chartDir)) continue
    const files = fs.readdirSync(chartDir).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      const p = path.join(chartDir, file)
      if (fixLabelsInChart(p)) {
        console.log(`✅ labels ${period}/chart/${file}`)
        labelUpdated++
      }
    }
  }

  // 3. Share-chart forecast alignment, cumulative normalization and forecast capping
  const shareFiles = [
    { period: '07', file: 'cf_network_int_b_share_int.json' },
    { period: '07', file: 'cf_network_dom_b_share_dom.json' },
    { period: 'Q3', file: 'cf_network_int_b_share_int.json' },
    { period: 'Q3', file: 'cf_network_dom_b_share_dom.json' },
    { period: 'W31', file: 'cf_network_int_b_share_int.json' },
    { period: 'W31', file: 'cf_network_dom_b_share_dom.json' },
  ]
  for (const { period, file } of shareFiles) {
    const p = path.join(BASE_DIR, period, 'chart', file)
    if (!fs.existsSync(p)) continue
    let did = false
    if (alignShareForecast(p, period)) {
      console.log(`✅ share forecast ${period}/chart/${file}`)
      shareUpdated++
      did = true
    }
    if (normalizeShareCumulative(p)) {
      console.log(`✅ share cumulative ${period}/chart/${file}`)
      shareUpdated++
      did = true
    }
    if (capShareForecast(p)) {
      console.log(`✅ share forecast cap ${period}/chart/${file}`)
      shareUpdated++
      did = true
    }
  }

  // 4. Fix cross-period chart paths in contentFilter
  for (const period of PERIODS) {
    const indexPath = path.join(BASE_DIR, period, 'index.json')
    if (fs.existsSync(indexPath) && fixCrossPeriodPaths(indexPath, period)) {
      console.log(`✅ cross-period paths ${period}/index.json`)
      pathUpdated++
    }
  }

  // 5. Scale pax chart data
  let scaledPax = 0
  for (const period of PERIODS) {
    for (const file of PAX_FILES) {
      const p = path.join(BASE_DIR, period, 'chart', file)
      if (fs.existsSync(p) && scalePaxChart(p)) scaledPax++
    }
  }
  if (scaledPax > 0) console.log(`✅ Scaled ${scaledPax} pax chart files`)

  // 6. Align chart highlights
  let alignedCharts = 0
  for (const period of PERIODS) alignedCharts += alignChartHighlights(period)
  if (alignedCharts > 0) console.log(`✅ Aligned ${alignedCharts} chart highlights`)

  // 7. Sync 2026 root
  if (syncRootIndexTo07()) console.log(`✅ Synced 2026/index.json to 07 values`)

  // 8. Verify share charts
  if (verifyShareCharts()) console.log(`✅ All share charts have fct_lk = null`)

  // 9. Add aiInsights
  let insightsAdded = 0
  for (const period of [...PERIODS, '2026']) insightsAdded += addAiInsights(period)
  if (insightsAdded > 0) console.log(`✅ Added ${insightsAdded} aiInsight blocks`)

  console.log(`\nSummary: metric=${metricUpdated}, labels=${labelUpdated}, share=${shareUpdated}, paths=${pathUpdated}, paxScaled=${scaledPax}, aligned=${alignedCharts}, insights=${insightsAdded}`)
}

run()

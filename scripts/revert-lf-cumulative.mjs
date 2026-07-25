import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'

const BASE_DIR = path.resolve(process.cwd(), 'mock-api/apiV5/domain/bod-strategic-dashboards/commerce')

const LF_DIRS = [
  '2026/07/passenger/vn/drilldown/lf',
  '2026/07/passenger/vn-ov/drilldown/lf',
  '2026/07/24/passenger/vn/drilldown/lf',
  '2026/07/24/passenger/vn-ov/drilldown/lf',
  '2026/W30/passenger/vn/drilldown/lf',
  '2026/W30/passenger/vn-ov/drilldown/lf',
  '2026/Q2/passenger/vn/drilldown/lf',
  '2026/Q2/passenger/vn-ov/drilldown/lf',
  '2026/Q3/passenger/vn/drilldown/lf',
  '2026/Q3/passenger/vn-ov/drilldown/lf',
]

/** Step 1: Revert view series từ X_lk → X */
function revertViewSeries(filePath) {
  const raw = readFileSync(filePath, 'utf-8')
  const obj = JSON.parse(raw)

  if (!obj?.autoChart?.dataset?.columns) {
    console.log(`  [SKIP] No autoChart: ${path.basename(filePath)}`)
    return false
  }

  const colIds = obj.autoChart.dataset.columns.map(c => c.id)
  if (!colIds.includes('th') || !colIds.includes('ck')) {
    console.log(`  [SKIP] Not time-series: ${path.basename(filePath)}`)
    return false
  }

  const { views } = obj.autoChart
  if (!Array.isArray(views)) {
    console.log(`  [SKIP] No views: ${path.basename(filePath)}`)
    return false
  }

  let changed = false
  for (const view of views) {
    if (!Array.isArray(view.series)) continue
    for (const s of view.series) {
      if (typeof s.field === 'string' && s.field.endsWith('_lk')) {
        s.field = s.field.slice(0, -3)
        changed = true
      }
    }
  }

  if (changed) {
    writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8')
    console.log(`  [OK] Reverted series: ${path.basename(filePath)}`)
  } else {
    console.log(`  [SKIP] No _lk series: ${path.basename(filePath)}`)
  }
  return changed
}

/** Step 2: Restore headerAction cumulative trong index.json */
function isLfTimeSeriesChart(chartPath) {
  if (!chartPath || typeof chartPath !== 'string') return false
  return (
    chartPath.includes('lf/chart/') &&
    !chartPath.includes('treemap') &&
    !chartPath.includes('market_structure')
  )
}

function addCumulativeHeaderAction(obj) {
  if (obj == null || typeof obj !== 'object') return false
  let changed = false

  if (obj.chartPath && isLfTimeSeriesChart(obj.chartPath) && !obj.headerAction) {
    obj.headerAction = { type: 'cumulative', defaultChecked: false }
    changed = true
  }

  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (Array.isArray(val)) {
      for (const item of val) {
        if (addCumulativeHeaderAction(item)) changed = true
      }
    } else if (val != null && typeof val === 'object') {
      if (addCumulativeHeaderAction(val)) changed = true
    }
  }

  return changed
}

function processIndexFile(filePath) {
  if (!existsSync(filePath)) {
    console.log(`  [SKIP] No index: ${filePath}`)
    return
  }

  const raw = readFileSync(filePath, 'utf-8')
  const obj = JSON.parse(raw)

  const changed = addCumulativeHeaderAction(obj)
  if (changed) {
    writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8')
    console.log(`  [OK] Restored headerAction: ${path.basename(filePath)}`)
  } else {
    console.log(`  [SKIP] No items to restore: ${path.basename(filePath)}`)
  }
}

let chartRevertCount = 0
let chartSkipCount = 0
let indexCount = 0

for (const lfDir of LF_DIRS) {
  const chartDir = path.join(BASE_DIR, lfDir, 'chart')
  const indexPath = path.join(BASE_DIR, lfDir, 'index.json')

  if (!existsSync(chartDir)) {
    console.log(`[SKIP] No chart dir: ${lfDir}`)
    continue
  }

  console.log(`\n=== ${lfDir} ===`)

  // Step 1: Revert view series
  const files = readdirSync(chartDir).filter(f => f.endsWith('.json'))
  for (const f of files) {
    const ok = revertViewSeries(path.join(chartDir, f))
    if (ok) chartRevertCount++
    else chartSkipCount++
  }

  // Step 2: Restore headerAction
  processIndexFile(indexPath)
  indexCount++
}

console.log(`\n--- Done! ---`)
console.log(`Charts reverted: ${chartRevertCount}`)
console.log(`Charts skipped: ${chartSkipCount}`)
console.log(`Index files processed: ${indexCount}`)

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

function cleanNumber(n) {
  return Number(n.toFixed(10))
}

/** Kiểm tra file có phải time-series LF chart (chứa th, ck) không. */
function isTimeSeriesChart(obj) {
  if (!obj?.autoChart?.dataset?.columns) return false
  const colIds = obj.autoChart.dataset.columns.map(c => c.id)
  return colIds.includes('th') && colIds.includes('ck')
}

/** Lấy index các cột number (trừ string/X-axis) */
function getNumberColumnIndexes(dataset) {
  const indexes = []
  for (let i = 0; i < dataset.columns.length; i++) {
    if (dataset.columns[i].type === 'number') {
      indexes.push(i)
    }
  }
  return indexes
}

function processChartFile(filePath) {
  const raw = readFileSync(filePath, 'utf-8')
  const obj = JSON.parse(raw)

  if (!isTimeSeriesChart(obj)) {
    console.log(`  [SKIP] Not a time-series chart: ${path.basename(filePath)}`)
    return
  }

  const { dataset, views } = obj.autoChart
  const numIndexes = getNumberColumnIndexes(dataset)

  // Thêm _lk columns
  const newColumns = []
  for (const idx of numIndexes) {
    const col = dataset.columns[idx]
    newColumns.push({
      id: col.id + '_lk',
      type: 'number',
      label: 'Luỹ kế ' + (col.label || col.id),
      color: col.color,
    })
  }
  dataset.columns.push(...newColumns)

  // Tính running sum và thêm vào rows
  const runningSums = numIndexes.map(() => 0)
  const lkIndexOffsets = numIndexes.map((_, i) => dataset.columns.length - numIndexes.length + i)

  for (let r = 0; r < dataset.rows.length; r++) {
    const row = dataset.rows[r]
    const newRow = row.slice()

    for (let i = 0; i < numIndexes.length; i++) {
      const val = row[numIndexes[i]]
      if (val != null && typeof val === 'number') {
        runningSums[i] = cleanNumber(runningSums[i] + val)
      }
      // null value: running sum stays as-is (không reset)
      newRow.push(runningSums[i])
    }

    dataset.rows[r] = newRow
  }

  // Cập nhật views: series field → field_lk
  if (Array.isArray(views)) {
    for (const view of views) {
      if (Array.isArray(view.series)) {
        for (const s of view.series) {
          if (numIndexes.some(idx => dataset.columns[idx].id === s.field)) {
            s.field = s.field + '_lk'
          }
        }
      }
    }
  }

  writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8')
  console.log(`  [OK] Updated: ${path.basename(filePath)}`)
}

function removeCumulativeHeaderAction(obj) {
  if (obj == null || typeof obj !== 'object') return false
  let changed = false

  // Xoá headerAction nếu type === 'cumulative'
  if ('headerAction' in obj && obj.headerAction?.type === 'cumulative') {
    delete obj.headerAction
    changed = true
  }

  // Đệ quy vào tất cả object con
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (Array.isArray(val)) {
      for (const item of val) {
        if (removeCumulativeHeaderAction(item)) changed = true
      }
    } else if (val != null && typeof val === 'object') {
      if (removeCumulativeHeaderAction(val)) changed = true
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

  const changed = removeCumulativeHeaderAction(obj)
  if (changed) {
    writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8')
    console.log(`  [OK] Removed cumulative headerActions: ${path.basename(filePath)}`)
  } else {
    console.log(`  [SKIP] No cumulative headerActions found: ${path.basename(filePath)}`)
  }
}

let chartCount = 0
let indexCount = 0

for (const lfDir of LF_DIRS) {
  const chartDir = path.join(BASE_DIR, lfDir, 'chart')
  const indexPath = path.join(BASE_DIR, lfDir, 'index.json')

  if (!existsSync(chartDir)) {
    console.log(`[SKIP] No chart dir: ${lfDir}`)
    continue
  }

  console.log(`\n=== ${lfDir} ===`)

  // Xử lý index.json
  processIndexFile(indexPath)
  indexCount++

  // Xử lý từng chart file
  const files = readdirSync(chartDir).filter(f => f.endsWith('.json'))
  for (const f of files) {
    processChartFile(path.join(chartDir, f))
    chartCount++
  }
}

console.log(`\n--- Done! ---`)
console.log(`Charts processed: ${chartCount}`)
console.log(`Index files processed: ${indexCount}`)

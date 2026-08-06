/**
 * Duplicate Commerce II month charts -> week charts.
 *
 * Requirement (for `ceo-command-center/commerce`):
 * - Month chart has 12 points with x-axis id `month` and labels `T1..T12`.
 * - Week chart needs 15 points with x-axis id `week` and labels `N15..N29`.
 * - Mapping: T1..T12 -> N15..N26
 *            N27..N29 -> null (tail 3 days)
 *
 * Implementation:
 * - For each chart JSON under:
 *   - 2026/07/chart -> 2026/W31/chart
 *   - 2026/08/chart -> 2026/W32/chart
 *   and also:
 *   - passenger/vn/chart, cargo/vn/chart
 * - If chart.dataset.columns[0].id === "month", transform:
 *   - dataset.columns[0].id: month -> week
 *   - views[*].xField: month -> week
 *   - dataset.rows: remap to 15 rows N15..N29 with null tail
 * - Otherwise, copy file as-is.
 */

'use strict'

const fs = require('fs')
const path = require('path')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function getChartContainer(data) {
  // Most charts in this domain are wrapped by `autoChart`.
  if (data?.autoChart?.dataset?.columns && Array.isArray(data.autoChart.dataset.columns)) {
    return data.autoChart
  }
  if (data?.dataset?.columns && Array.isArray(data.dataset.columns)) {
    return data
  }
  return null
}

function transformMonthToWeekInPlace(chartJson) {
  const container = getChartContainer(chartJson)
  if (!container) return false
  const columns = container.dataset?.columns
  const rows = container.dataset?.rows
  if (!columns || !rows || columns.length === 0) return false

  const firstCol = columns[0]
  if (!firstCol || firstCol.id !== 'month') return false

  // 1) Switch x-axis column id to `week`
  columns[0] = { ...firstCol, id: 'week' }

  // 2) Switch views xField (if present)
  if (Array.isArray(container.views)) {
    container.views.forEach((v) => {
      if (v && v.xField === 'month') v.xField = 'week'
    })
  }

  // 3) Remap dataset rows to N15..N29 (15 points)
  const colCount = columns.length
  const monthRows = Array.isArray(rows) ? rows.slice(0, 12) : []

  const newRows = []
  for (let dayOffset = 0; dayOffset < 15; dayOffset++) {
    const label = `N${15 + dayOffset}`
    if (dayOffset < 12) {
      const monthRow = monthRows[dayOffset]
      if (Array.isArray(monthRow) && monthRow.length === colCount) {
        newRows.push([label, ...monthRow.slice(1)])
      } else {
        newRows.push([label, ...Array(colCount - 1).fill(null)])
      }
    } else {
      // Tail: N27..N29 => null
      newRows.push([label, ...Array(colCount - 1).fill(null)])
    }
  }

  container.dataset.rows = newRows
  return true
}

function copyAndTransformDir({ srcDir, dstDir }) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`[duplicate-month->week] Source dir missing: ${srcDir}`)
    return
  }
  ensureDir(dstDir)

  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.json') && !f.includes('.bak'))
  for (const file of files) {
    const srcPath = path.join(srcDir, file)
    const dstPath = path.join(dstDir, file)

    const raw = fs.readFileSync(srcPath, 'utf-8')
    const json = JSON.parse(raw)

    transformMonthToWeekInPlace(json)
    fs.writeFileSync(dstPath, JSON.stringify(json, null, 2), 'utf-8')
  }
}

function main() {
  const BASE = path.join(__dirname, '..', 'apiV5', 'domain', 'ceo-command-center', 'commerce', '2026')

  const pairs = [
    { src: path.join(BASE, '07'), dst: path.join(BASE, 'W31') },
    { src: path.join(BASE, '08'), dst: path.join(BASE, 'W32') },
  ]

  const subChartDirs = [
    'chart',
    path.join('passenger', 'vn', 'chart'),
    path.join('cargo', 'vn', 'chart'),
  ]

  for (const { src, dst } of pairs) {
    for (const subChartDir of subChartDirs) {
      copyAndTransformDir({
        srcDir: path.join(src, subChartDir),
        dstDir: path.join(dst, subChartDir),
      })
    }
  }

  console.log('[duplicate-month->week] Done')
}

main()


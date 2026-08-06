/**
 * generate_commerce_ii_day_charts.js
 *
 * For ceo-command-center/commerce-ii day mode:
 * - Source: month chart files at  .../YYYY/MM/chart/*.json  (x-axis = "month", labels T1..T12)
 * - Target: day chart files at    .../YYYY/MM/DD/chart/*.json  (x-axis = "day", labels DD/MM)
 *
 * Rule (calendar window, 15 points):
 *   Today = DD (T)
 *   End   = T - 1  (yesterday, current month day)
 *   Start = calendar day of (T-1 minus 14 days). If that crosses month boundary,
 *           use previous-month day number = a.
 *   X-axis labels: {DD}/{MM}  (day/month, padded to 2 digits, crossing months)
 *
 *   Example: today = 6 (Aug):
 *     end = 5 (Aug 5)
 *     5 - 14 days → Jul 22 (a = 22) when prev month has 31 days
 *     labels: 22/07..31/07, 01/08..05/08
 *
 * Day mode series (only):
 *   ck = cùng kỳ, db = kế hoạch, th = thực hiện
 * (drops fct / uth / *_lk)
 *
 * Also updates each DD/index.json to redirect chartPath from
 *   .../YYYY/MM/chart/xxx.json  →  .../YYYY/MM/DD/chart/xxx.json
 *
 * Scope: ONLY commerce-ii months 07 and 08 (all days 01-31).
 */

'use strict'

const fs = require('fs')
const path = require('path')

// ── helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8')
}

/**
 * Build 15 calendar day labels for selected day DD of current month.
 *
 * endDay   = DD - 1  (T-1)
 * startDay = calendar day of (endDay - 14 days), rolling into previous month if needed.
 *
 * Labels use DD/MM format (e.g. 22/07..31/07,01/08..05/08).
 *
 * @returns {{ labels: string[], prevSlotCount: number, startDom: number }}
 */
function buildDayLabels(dd, currentMm, prevMm, prevMonthDays) {
  const pad = (n) => String(n).padStart(2, '0')
  const endDay = dd - 1 // T-1
  if (endDay < 1) {
    // Edge: DD=1 → yesterday is last day of prev month; window entirely in prev month
    const endDom = prevMonthDays
    const startDom = endDom - 14
    const labels = []
    for (let d = startDom; d <= endDom; d++) labels.push(`${pad(d)}/${prevMm}`)
    return { labels, prevSlotCount: 15, startDom }
  }

  // How many days of the 15-point window fall in the current month (1..endDay)?
  const curSlotCount = Math.min(15, endDay)
  const prevSlotCount = 15 - curSlotCount
  const labels = []

  if (prevSlotCount > 0) {
    // Crosses into previous month: a = prevMonthDays - prevSlotCount + 1
    const startDom = prevMonthDays - prevSlotCount + 1
    for (let d = startDom; d <= prevMonthDays; d++) labels.push(`${pad(d)}/${prevMm}`)
    for (let d = 1; d <= endDay; d++) labels.push(`${pad(d)}/${currentMm}`)
    return { labels, prevSlotCount, startDom }
  }

  // Entire window in current month: DD/MM format
  const startDom = endDay - 14
  for (let d = startDom; d <= endDay; d++) labels.push(`${pad(d)}/${currentMm}`)
  return { labels, prevSlotCount: 0, startDom }
}

/**
 * Transform a month-based chart JSON into a day-based one.
 * Day mode keeps ONLY 3 series:
 *   - ck  = cùng kỳ
 *   - db  = kế hoạch
 *   - th  = thực hiện
 * (drops fct/uth/*_lk and any other series)
 *
 * X-axis labels are now DD/MM format (e.g. 22/07..05/08).
 *
 * Returns transformed clone, or null if chart should be copied as-is.
 */
function transformChartForDay(chartJson, dd, currentMm, prevMm, prevChartJson, prevMonthDays) {
  // Find the chart container (may be wrapped in autoChart)
  let container = null
  let isWrapped = false
  if (chartJson?.autoChart?.dataset?.columns) {
    container = chartJson.autoChart
    isWrapped = true
  } else if (chartJson?.dataset?.columns) {
    container = chartJson
  }

  if (!container) return null

  const cols = container.dataset?.columns
  const rows = container.dataset?.rows
  if (!cols || !rows || cols.length === 0) return null

  const firstColId = cols[0]?.id
  if (firstColId !== 'month') return null // not a month-series chart → copy as-is

  // Day series: cùng kỳ / kế hoạch / thực hiện only
  const KEEP_SERIES = ['ck', 'db', 'th']
  const colById = Object.fromEntries(cols.map((c, i) => [c.id, { col: c, idx: i }]))
  const hasAllThree = KEEP_SERIES.every((id) => colById[id])
  if (!hasAllThree) {
    // Time-series without ck/db/th → still convert x-axis, but leave other columns as-is
    // (rare). Fall through with month→day only below via a lighter path.
  }

  const clone = JSON.parse(JSON.stringify(chartJson))
  const cloneContainer = isWrapped ? clone.autoChart : clone
  const { labels } = buildDayLabels(dd, currentMm, prevMm, prevMonthDays)

  // Build reduced columns: day + ck + db + th (preserve original column metadata)
  const dayCol = { ...cols[0], id: 'day' }
  const keptCols = hasAllThree
    ? [dayCol, ...KEEP_SERIES.map((id) => ({ ...colById[id].col }))]
    : [dayCol, ...cols.slice(1)]
  const keptIds = keptCols.map((c) => c.id)
  const srcIdx = keptIds.map((id) => (id === 'day' ? 0 : cols.findIndex((c) => c.id === id)))

  cloneContainer.dataset.columns = keptCols

  // Views: xField day, series only ck/db/th, rewrite xAxis.data
  if (Array.isArray(cloneContainer.views)) {
    cloneContainer.views.forEach((v) => {
      if (!v) return
      if (v.xField === 'month' || v.xField === 'day') v.xField = 'day'
      if (Array.isArray(v.series) && hasAllThree) {
        const byField = Object.fromEntries(v.series.map((s) => [s.field, s]))
        // Stable order: ck (cùng kỳ), db (kế hoạch), th (thực hiện)
        v.series = KEEP_SERIES.map((field) => {
          const prev = byField[field]
          if (prev) return { ...prev, field }
          return {
            field,
            chartType: 'line',
            ...(field === 'db' ? { lineStyle: 'dashed' } : {}),
            ...(field === 'th' ? { showLabel: 'end' } : {}),
          }
        })
      }
      if (!v.xAxis || typeof v.xAxis !== 'object') v.xAxis = {}
      v.xAxis.data = labels
      if (v.xAxis.axisLabel == null) v.xAxis.axisLabel = { interval: 0 }
    })
  }

  // Source rows from current (+ prev) month; keep only full actual (th != null)
  const thIdx = cols.findIndex((c) => c && c.id === 'th')
  const colCount = cols.length
  const curMonthRows = Array.isArray(rows) ? rows.slice(0, 12) : []
  let prevMonthRows = []
  if (prevChartJson) {
    const prevContainer = prevChartJson?.autoChart ?? prevChartJson
    if (Array.isArray(prevContainer?.dataset?.rows)) {
      prevMonthRows = prevContainer.dataset.rows.slice(0, 12)
    }
  }

  function isFullActualRow(row) {
    if (!Array.isArray(row) || row.length !== colCount) return false
    if (thIdx >= 0) return row[thIdx] != null
    return row.slice(1).some((v) => typeof v === 'number')
  }

  function projectRow(srcRow, label) {
    return keptIds.map((id, i) => {
      if (id === 'day') return label
      const si = srcIdx[i]
      return si >= 0 && srcRow ? srcRow[si] : null
    })
  }

  const fullCur = curMonthRows.filter(isFullActualRow)
  const fullPrev = prevMonthRows.filter(isFullActualRow)
  const pool = (fullCur.length > 0 ? fullCur : fullPrev.length > 0 ? fullPrev : curMonthRows)
    .filter((r) => Array.isArray(r) && r.length === colCount)

  const newRows = []
  for (let i = 0; i < 15; i++) {
    const label = labels[i]
    if (pool.length === 0) {
      newRows.push([label, ...Array(keptCols.length - 1).fill(null)])
      continue
    }
    newRows.push(projectRow(pool[i % pool.length], label))
  }

  cloneContainer.dataset.rows = newRows
  return clone
}

// Deep-walk JSON and replace chartPath strings: MM/[subDir]/chart/ → MM/DD/[subDir]/chart/
function rewriteChartPaths(obj, mm, dd2) {
  if (!obj || typeof obj !== 'object') return
  const keys = Array.isArray(obj) ? [...obj.keys()] : Object.keys(obj)
  for (const k of keys) {
    if (typeof obj[k] === 'string') {
      const base = `/commerce-ii/2026/${mm}/`
      if (obj[k].includes(base) && obj[k].includes('/chart/')) {
        // Replace the MM segment with MM/DD while keeping sub-paths intact
        // e.g. .../2026/08/passenger/vn/chart/xxx → .../2026/08/05/passenger/vn/chart/xxx
        obj[k] = obj[k].replace(
          new RegExp(`/commerce-ii/2026/${mm}/(?!${dd2}/)`),
          `/commerce-ii/2026/${mm}/${dd2}/`
        )
      }
    } else {
      rewriteChartPaths(obj[k], mm, dd2)
    }
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

// Days in each month (for prev-month boundary calculations)
const MONTH_DAYS = { '01': 31, '02': 28, '03': 31, '04': 30, '05': 31, '06': 30,
                     '07': 31, '08': 31, '09': 30, '10': 31, '11': 30, '12': 31 }

function prevMonth(mm) {
  const n = parseInt(mm, 10)
  if (n === 1) return { mm: '12', days: MONTH_DAYS['12'] }
  const prev = String(n - 1).padStart(2, '0')
  return { mm: prev, days: MONTH_DAYS[prev] }
}

// Sub-chart directories to process (relative to month dir)
const SUB_CHART_DIRS = [
  'chart',
  path.join('passenger', 'vn', 'chart'),
  path.join('cargo', 'vn', 'chart'),
]

function main() {
  const BASE = path.join(__dirname, '..', 'apiV5', 'domain', 'ceo-command-center', 'commerce-ii', '2026')

  const months = [
    { mm: '07', days: 31 },
    { mm: '08', days: 31 },
  ]

  for (const { mm, days } of months) {
    const { mm: prevMm, days: prevDays } = prevMonth(mm)

    // For each sub-chart dir, preload source + prev month files
    const subDirMeta = SUB_CHART_DIRS.map(subDir => {
      const srcChartDir = path.join(BASE, mm, subDir)
      const prevChartDir = path.join(BASE, prevMm, subDir)

      if (!fs.existsSync(srcChartDir)) {
        console.warn(`[day-charts] Source chart dir missing: ${srcChartDir}`)
        return null
      }

      const chartFiles = fs.readdirSync(srcChartDir).filter(f => f.endsWith('.json') && !f.includes('.bak'))

      // Preload prev month charts
      const prevChartCache = {}
      if (fs.existsSync(prevChartDir)) {
        for (const file of chartFiles) {
          const p = path.join(prevChartDir, file)
          if (fs.existsSync(p)) prevChartCache[file] = readJson(p)
        }
      }

      return { subDir, srcChartDir, chartFiles, prevChartCache }
    }).filter(Boolean)

    for (let d = 1; d <= days; d++) {
      const dd2 = String(d).padStart(2, '0')
      // Need prev-month data when (T-1) window crosses into previous month: endDay < 15
      const needsPrevMonth = (d - 1) < 15

      // Generate chart files for each sub-dir
      for (const { subDir, srcChartDir, chartFiles, prevChartCache } of subDirMeta) {
        const dayChartDir = path.join(BASE, mm, dd2, subDir)
        ensureDir(dayChartDir)

        for (const file of chartFiles) {
          const srcPath = path.join(srcChartDir, file)
          const dstPath = path.join(dayChartDir, file)

          const srcJson = readJson(srcPath)
          if (!srcJson) continue

          const prevJson = needsPrevMonth ? (prevChartCache[file] || null) : null
          const transformed = transformChartForDay(srcJson, d, mm, prevMm, prevJson, prevDays)
          writeJson(dstPath, transformed !== null ? transformed : srcJson)
        }
      }

      // Rewrite ALL chartPaths in day index.json (root + passenger/vn + cargo/vn)
      const dayIndexPath = path.join(BASE, mm, dd2, 'index.json')
      const dayIndex = readJson(dayIndexPath)
      if (!dayIndex) {
        console.warn(`[day-charts] No index.json for ${mm}/${dd2}, skipping path rewrite`)
        continue
      }
      rewriteChartPaths(dayIndex, mm, dd2)
      writeJson(dayIndexPath, dayIndex)

      // Also rewrite passenger/vn/index.json if it exists
      for (const subIndexSub of [['passenger', 'vn'], ['cargo', 'vn']]) {
        const subIndexPath = path.join(BASE, mm, dd2, ...subIndexSub, 'index.json')
        const subIndex = readJson(subIndexPath)
        if (!subIndex) continue
        rewriteChartPaths(subIndex, mm, dd2)
        writeJson(subIndexPath, subIndex)
      }
    }

    console.log(`[day-charts] Month ${mm}: done`)
  }

  console.log('[day-charts] All done')
}

main()

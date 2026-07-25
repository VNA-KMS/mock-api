import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'

const DOMAIN_DIR = path.resolve(process.cwd(), 'mock-api/apiV5/domain')

const COLUMN_MAP = {
  'th': 'th', 'tt': 'th', 'cur': 'th', 'actual': 'th', 'thuc_hien': 'th',
  'y2026': 'th', 'docso': 'th', 'doanhthu': 'th',
  'ck': 'ck', 'samePeriod': 'ck', 'y2025': 'ck',
  'db': 'db', 'kh': 'db', 'plan': 'db', 'ke_hoach': 'db',
  'uth': 'uth', 'uth_tt': 'uth',
}

const LK_FIELDS = ['th', 'ck', 'db']

const CHART_TYPE_MAP = { 'th': 'line', 'ck': 'line', 'db': 'line', 'uth': 'bar' }

function cleanNumber(n) {
  return Number(n.toFixed(10))
}

function findChartDirs(dir) {
  const results = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'chart') results.push(full)
        else results.push(...findChartDirs(full))
      }
    }
  } catch {}
  return results
}

function isAllNullValues(rows, idx) {
  return rows.every(r => r[idx] == null)
}

function processChart(filePath) {
  const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
  const obj = JSON.parse(raw)

  const ac = obj.autoChart
  if (!ac?.dataset?.columns?.length) return

  const { columns, rows } = ac.dataset
  const views = ac.views

  // Must have at least one string column (x-axis)
  if (!columns.some(c => c.type === 'string')) return

  // Skip if already has _lk columns
  if (columns.some(c => c.id.endsWith('_lk'))) return

  // Map number columns
  for (const col of columns) {
    if (col.type !== 'number') continue
    const newId = COLUMN_MAP[col.id]
    if (newId && newId !== col.id && !columns.some(c => c.id === newId)) {
      col.id = newId
    }
  }

  // Check if views reference standard fields (th/ck/db/uth) — signal of time-series chart
  const seriesFields = Array.isArray(views) && views[0]?.series
    ? views[0].series.map(s => COLUMN_MAP[s.field] || s.field)
    : []
  const hasStandardSeries = seriesFields.some(f => ['th', 'ck', 'db', 'uth'].includes(f))
  if (!hasStandardSeries) return

  // Must have 'th' (current year) mapped
  if (!columns.some(c => c.id === 'th' && c.type === 'number')) return

  // Update series
  if (Array.isArray(views)) {
    for (const view of views) {
      if (!Array.isArray(view.series)) continue
      for (const s of view.series) {
        const mapped = COLUMN_MAP[s.field]
        if (mapped) s.field = mapped

        if (CHART_TYPE_MAP[s.field]) {
          s.chartType = CHART_TYPE_MAP[s.field]
          if (s.field === 'db') {
            s.lineStyle = 'dashed'
            delete s.lineType
          }
        }
      }
    }
  }

  // Add _lk columns
  const numCols = columns.map((c, i) => ({ ...c, i })).filter(c => c.type === 'number')
  const lkCols = numCols.filter(c => LK_FIELDS.includes(c.id))
  if (lkCols.length === 0) return

  // Skip if all data is null
  if (lkCols.every(lc => isAllNullValues(rows, lc.i))) return

  const runningSums = lkCols.map(() => 0)

  for (const lc of lkCols) {
    columns.push({
      id: lc.id + '_lk',
      type: 'number',
      label: 'Luỹ kế ' + (lc.label || lc.id),
      color: lc.color,
    })
  }

  for (const row of rows) {
    for (let i = 0; i < lkCols.length; i++) {
      const val = row[lkCols[i].i]
      if (val != null && typeof val === 'number') {
        runningSums[i] = cleanNumber(runningSums[i] + val)
      }
      row.push(runningSums[i])
    }
  }

  writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8')
  return true
}

const chartDirs = findChartDirs(DOMAIN_DIR)
let ok = 0, skip = 0

for (const dir of chartDirs) {
  const files = readdirSync(dir).filter(f => f.endsWith('.json'))
  for (const f of files) {
    const r = processChart(path.join(dir, f))
    if (r) { ok++; process.stdout.write('.') }
    else skip++
  }
}

console.log(`\n\nDone! Standardized: ${ok}, Skipped: ${skip}, Chart dirs: ${chartDirs.length}`)

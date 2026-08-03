import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import path from 'path'

const DOMAIN_DIR = path.resolve(process.cwd(), 'mock-api/apiV5/domain')

function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function findLfChartDirs(dir) {
  const results = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (!statSync(full).isDirectory()) continue

      // Check if this is an lf/chart directory
      if (entry === 'chart' && dir.endsWith('lf')) {
        results.push(full)
      } else {
        results.push(...findLfChartDirs(full))
      }
    }
  } catch {}
  return results
}

function round1(n) {
  return Math.round(n * 10) / 10
}

function processChart(filePath) {
  const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
  const obj = JSON.parse(raw)
  const ac = obj.autoChart
  if (!ac?.dataset?.columns?.length) return false

  const { columns, rows } = ac.dataset

  // Find _lk columns
  const lkPairs = []
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    if (!col.id.endsWith('_lk')) continue
    const srcId = col.id.slice(0, -3)
    const srcIdx = columns.findIndex(c => c.id === srcId && c.type === 'number')
    if (srcIdx < 0) continue
    lkPairs.push({ lkIdx: i, srcIdx })
  }

  if (lkPairs.length === 0) return false

  const totalRows = rows.length
  const h = hashCode(filePath)

  for (let r = 0; r < totalRows; r++) {
    const row = rows[r]
    for (let i = 0; i < lkPairs.length; i++) {
      const { lkIdx, srcIdx } = lkPairs[i]
      const srcVal = row[srcIdx]

      if (srcVal == null || typeof srcVal !== 'number') {
        row[lkIdx] = null
      } else {
        const colOffset = ((h >> (i * 4)) % 30) / 10        // 0.0 - 2.9
        const base = 82 + (colOffset)                        // 82.0 - 84.9
        const totalGain = 12 - colOffset                     // 9.1 - 12.0
        const inc = totalGain / (totalRows - 1 || 1)        // per-row increment
        const varOffset = ((h >> (i * 4 + 8)) % 20) / 100   // ±0.00-0.19 per row
        let val = base + r * inc + (r * varOffset)
        if (val > 95) val = 95
        row[lkIdx] = round1(val)
      }
    }
  }

  writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8')
  return true
}

// Find all lf/chart directories across CEO and BOD
const domains = ['ceo-command-center', 'bod-strategic-dashboards']
let chartDirs = []

for (const domain of domains) {
  const commercePath = path.join(DOMAIN_DIR, domain, 'commerce')
  if (!statSync(commercePath).isDirectory) continue
  chartDirs.push(...findLfChartDirs(commercePath))
}

// Remove duplicates
chartDirs = [...new Set(chartDirs)]
console.log(`Found ${chartDirs.length} lf/chart directories`)

let ok = 0
for (const dir of chartDirs) {
  const files = readdirSync(dir).filter(f => f.endsWith('.json'))
  for (const f of files) {
    const r = processChart(path.join(dir, f))
    if (r) { ok++; process.stdout.write('.') }
  }
}

console.log(`\nDone! LF charts fixed: ${ok}`)

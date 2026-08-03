import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'

const DOMAIN_DIR = path.resolve(process.cwd(), 'mock-api/apiV5/domain')

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

function cleanNumber(n) {
  return Number(n.toFixed(10))
}

function processChart(filePath) {
  const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
  const obj = JSON.parse(raw)
  const ac = obj.autoChart
  if (!ac?.dataset?.columns?.length) return

  const { columns, rows } = ac.dataset

  // Find _lk columns and their source columns
  const lkPairs = []
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    if (!col.id.endsWith('_lk')) continue
    const srcId = col.id.slice(0, -3)
    const srcIdx = columns.findIndex(c => c.id === srcId && c.type === 'number')
    if (srcIdx < 0) continue
    lkPairs.push({ lkIdx: i, srcIdx, srcId })
  }

  if (lkPairs.length === 0) return

  const runningSums = lkPairs.map(() => 0)
  const initialized = lkPairs.map(() => false)

  for (const row of rows) {
    for (let i = 0; i < lkPairs.length; i++) {
      const { lkIdx, srcIdx } = lkPairs[i]
      const val = row[srcIdx]

      if (val != null && typeof val === 'number') {
        runningSums[i] = cleanNumber(runningSums[i] + val)
        initialized[i] = true
        row[lkIdx] = runningSums[i]
      } else {
        // null source → null cumulative
        row[lkIdx] = null
      }
    }
  }

  writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8')
  return true
}

const chartDirs = findChartDirs(DOMAIN_DIR)
let ok = 0

for (const dir of chartDirs) {
  const files = readdirSync(dir).filter(f => f.endsWith('.json'))
  for (const f of files) {
    const r = processChart(path.join(dir, f))
    if (r) { ok++; process.stdout.write('.') }
  }
}

console.log(`\n\nDone! Fixed: ${ok}`)

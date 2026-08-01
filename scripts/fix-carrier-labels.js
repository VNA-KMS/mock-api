/**
 * Fix labels in carrier combo charts:
 *   ck: "TH 2025"  → "2025"
 *   th: "TH 2026"  → "TH 2026" (keep)
 *   db: "KH 2026"  → "KH 2026" (keep)
 *   fct: "FCT 2026" → "FCT 2026" (keep)
 * 
 * Cumulative:
 *   ck_lk: "Lũy kế TH 2025" → "Lũy kế 2025"
 *   th_lk: "Lũy kế TH 2026" → "Lũy kế TH 2026" (keep)
 *   db_lk: "Luỹ kế KH 2026" → "Luỹ kế KH 2026" (keep)
 *   fct_lk: "Lũy kế FCT 2026" → "Lũy kế FCT 2026" (keep)
 */

const fs = require('fs')
const path = require('path')

const BASE = path.resolve(__dirname, '../apiV5/domain')

const CARRIER_PATTERNS = [
  { pattern: /_vna\.json$/, exclude: /_vna_group|b_carrier/ },
  { pattern: /_vj\.json$/ },
  { pattern: /_pa\.json$/ },
  { pattern: /_ba\.json$/ },
  { pattern: /_vu\.json$/ },
  { pattern: /_sun\.json$/ },
]

function shouldProcess(filename) {
  return CARRIER_PATTERNS.some(({ pattern, exclude }) => {
    if (!pattern.test(filename)) return false
    if (exclude && exclude.test(filename)) return false
    return true
  })
}

function processFile(filePath, filename) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const json = JSON.parse(content)
    if (!json.autoChart?.dataset?.columns) return
    if (json.autoChart.chartType !== 'combo') return

    let changed = false
    for (const col of json.autoChart.dataset.columns) {
      if (col.id === 'ck' && col.label === 'TH 2025') {
        col.label = '2025'; changed = true
      }
      if (col.id === 'ck_lk' && col.label === 'Lũy kế TH 2025') {
        col.label = 'Lũy kế 2025'; changed = true
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8')
      console.log(`  ✓ ${path.relative(BASE, filePath)}`)
    }
  } catch (err) {
    console.error(`  ✗ ${path.relative(BASE, filePath)} — ${err.message}`)
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(fullPath)
    } else if (entry.isFile() && entry.name.endsWith('.json') && shouldProcess(entry.name)) {
      processFile(fullPath, entry.name)
    }
  }
}

console.log('Fixing carrier combo chart labels...')
walkDir(BASE)
console.log('Done!')

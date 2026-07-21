/**
 * remove-colortoken.js
 *
 * Duyệt toàn bộ ceo-command-center, thêm `color` (hex) cho mọi column
 * dựa trên `colorToken`, sau đó xoá trường `colorToken`.
 *
 * Run: node scripts/remove-colortoken.js
 */

const fs = require('fs')
const path = require('path')

// ---------- Màu light từ kms-palette.config.json ----------
const TOKEN_HEX = {
  // series.*
  'series.actual': '#006D88',
  'series.target': '#D3AC2B',
  'series.previous': '#9AA0A6',
  'series.forecast': '#A8B4C4',
  // seq.N → fillSeq.v4 swatches
  'seq.1': '#1D4857',
  'seq.2': '#479EB3',
  'seq.3': '#3D879B',
  'seq.4': '#C4A83A',
  'seq.5': '#889941',
  'seq.6': '#5E793D',
  // rag.*
  'rag.positive': '#22C55E',
  'rag.negative': '#EF4444',
  'rag.warning': '#B45309',
  // domain.*
  'domain.commerce': '#06B6D4',
  'domain.flightOps': '#3B82F6',
  'domain.engineering': '#F97316',
  'domain.service': '#D4AF37',
  'domain.loyalty': '#5B21B6',
  'domain.cargo': '#F59E0B',
  'domain.safety': '#10B981',
  'domain.finance': '#059669',
  'domain.hr': '#F43F5E',
  'domain.digital': '#8B5CF6',
  'domain.admin': '#A8A29E',
}

const CEO_DIR = path.resolve(__dirname, '../apiV5/domain/ceo-command-center')

let total = 0

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
      walk(p)
    } else if (e.name.endsWith('.json')) {
      processFile(p)
    }
  }
}

function processFile(absPath) {
  try {
    const orig = fs.readFileSync(absPath, 'utf8')
    const json = JSON.parse(orig)
    const cols = json.autoChart?.dataset?.columns
    if (!cols) return

    let changed = false

    for (const col of cols) {
      const token = col.colorToken
      if (!token) continue

      // Add color if token is in mapping
      const hex = TOKEN_HEX[token]
      if (hex && !col.color) {
        col.color = hex
        changed = true
      }

      // Remove colorToken
      delete col.colorToken
      changed = true
    }

    if (changed) {
      fs.writeFileSync(absPath, JSON.stringify(json, null, 2) + '\n', 'utf8')
      total++
      if (total % 100 === 0) process.stdout.write('.')
    }
  } catch (e) {
    // skip invalid JSON
  }
}

console.log('Processing ceo-command-center chart files...')
walk(CEO_DIR)
console.log(`\n✅ Đã xử lý ${total} files`)

/**
 * add-hex-colors.js
 *
 * Thêm hex `color` vào tất cả chart JSON trong market-share,
 * dựa trên `colorToken` hiện có.
 *
 * Run: node scripts/add-hex-colors.js
 */

const fs = require('fs')
const path = require('path')

const TOKEN_HEX = {
  // ROLE_TOKEN_ALIAS (line chart)
  'series.actual': '#006D88',
  'series.target': '#D3AC2B',
  'series.previous': '#9AA0A6',
  // data.* (treemap)
  'data.deep-teal': '#1D4857',
  'data.olive-gold': '#C4A83A',
}

const CHART_DIR = path.resolve(__dirname, '../apiV5/domain/ceo-command-center/market-share/2026/07/chart')

const files = fs.readdirSync(CHART_DIR).filter(f => f.endsWith('.json'))

let updated = 0

for (const file of files) {
  const absPath = path.join(CHART_DIR, file)
  const json = JSON.parse(fs.readFileSync(absPath, 'utf8'))

  let changed = false

  // Xử lý columns (line chart)
  const columns = json.autoChart?.dataset?.columns
  if (columns) {
    for (const col of columns) {
      if (col.colorToken && TOKEN_HEX[col.colorToken]) {
        if (col.color !== TOKEN_HEX[col.colorToken]) {
          col.color = TOKEN_HEX[col.colorToken]
          changed = true
        }
      }
    }
  }

  // Xử lý rows (treemap — thay token bằng hex)
  const rows = json.autoChart?.dataset?.rows
  if (rows) {
    for (const row of rows) {
      const color = row[3]
      if (color && TOKEN_HEX[color]) {
        row[3] = TOKEN_HEX[color]
        changed = true
      }
    }
  }

  if (changed) {
    fs.writeFileSync(absPath, JSON.stringify(json, null, 2) + '\n', 'utf8')
    console.log(`✅ ${file}`)
    updated++
  }
}

console.log(`\nĐã cập nhật ${updated}/${files.length} files`)

/**
 * fix-missing-colors.js
 *
 * Thêm `color` cho các column còn thiếu trong toàn bộ ceo-command-center.
 * - Columns có `colorToken` → resolve hex → add color
 * - Columns có label khớp pattern → gán màu chuẩn
 * - Columns còn lại → gán màu V4 sequential
 *
 * Run: node scripts/fix-missing-colors.js
 */

const fs = require('fs')
const path = require('path')

const TOKEN_HEX = {
  'series.actual': '#006D88',
  'series.target': '#D3AC2B',
  'series.previous': '#9AA0A6',
  'series.forecast': '#A8B4C4',
  'seq.1': '#1D4857', 'seq.2': '#479EB3', 'seq.3': '#3D879B',
  'seq.4': '#C4A83A', 'seq.5': '#889941', 'seq.6': '#5E793D',
  'rag.positive': '#22C55E', 'rag.negative': '#EF4444', 'rag.warning': '#B45309',
  'domain.commerce': '#06B6D4', 'domain.flightOps': '#3B82F6',
  'domain.engineering': '#F97316', 'domain.service': '#D4AF37',
  'domain.loyalty': '#5B21B6', 'domain.cargo': '#F59E0B',
  'domain.safety': '#10B981', 'domain.finance': '#059669',
  'domain.hr': '#F43F5E', 'domain.digital': '#8B5CF6', 'domain.admin': '#A8A29E',
}

const LABEL_MAP = [
  { pattern: /^Thực hiện/i, color: '#006D88' },
  { pattern: /^Thực tế/i, color: '#006D88' },
  { pattern: /^Kế hoạch/i, color: '#D3AC2B' },
  { pattern: /^Mục tiêu/i, color: '#D3AC2B' },
  { pattern: /^Cùng kỳ/i, color: '#9AA0A6' },
  { pattern: /^Dự báo/i, color: '#A8B4C4' },
  { pattern: /^Tháng này/i, color: '#006D88' },
  { pattern: /^Tháng trước/i, color: '#9AA0A6' },
  { pattern: /^Doanh thu/i, color: '#22C55E' },
  { pattern: /^HQ /i, color: '#006D88' },
  { pattern: /^Sản lượng/i, color: '#3D879B' },
  { pattern: /^%/, color: '#B86A84' },
]

const V4_SEQ = ['#1D4857','#479EB3','#3D879B','#C4A83A','#889941','#5E793D','#C76449','#A55C3E','#B86A84','#AE8655','#476065','#E28A81','#EFE9D6']

function addColor(c, fileLabel, seqCounter) {
  if (c.color) return
  // Skip non-series columns
  const skipIds = new Set(['value','month','year','item','y','x','name','parent','color'])
  if (skipIds.has(c.id) && !c.label) return

  // Resolve từ colorToken
  if (c.colorToken && TOKEN_HEX[c.colorToken]) {
    c.color = TOKEN_HEX[c.colorToken]
    return
  }

  // Resolve từ label pattern
  if (c.label) {
    for (const m of LABEL_MAP) {
      if (m.pattern.test(c.label)) {
        c.color = m.color
        return
      }
    }
  }

  // Resolve từ id nếu label khớp pattern
  if (c.id) {
    for (const m of LABEL_MAP) {
      if (m.pattern.test(c.id)) {
        c.color = m.color
        return
      }
    }
  }

  // Fallback: V4 sequential
  if (c.type === 'number' && c.label) {
    const idx = seqCounter.next++
    c.color = V4_SEQ[idx % V4_SEQ.length]
  }
}

const CEO_DIR = path.resolve(__dirname, '../apiV5/domain/ceo-command-center')
let total = 0

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') walk(p)
    else if (e.name.endsWith('.json') && e.name !== 'index.json' && !e.name.startsWith('kms-')) {
      processFile(p)
    }
  }
}

function processFile(absPath) {
  try {
    const j = JSON.parse(fs.readFileSync(absPath, 'utf8'))
    let changed = false

    const processColumns = (cols) => {
      if (!cols) return
      const seq = { next: 0 }
      for (const c of cols) {
        const before = c.color
        addColor(c, absPath.replace(CEO_DIR,''), seq)
        if (c.color !== before) changed = true
        // Xoá colorToken nếu còn
        if ('colorToken' in c) { delete c.colorToken; changed = true }
      }
    }

    processColumns(j.autoChart?.dataset?.columns)
    if (j.filterViews) {
      for (const fv of j.filterViews) {
        processColumns(fv.autoChart?.dataset?.columns)
      }
    }

    if (changed) {
      fs.writeFileSync(absPath, JSON.stringify(j, null, 2) + '\n', 'utf8')
      total++
      if (total % 200 === 0) process.stdout.write('.')
    }
  } catch (e) {
    // skip
  }
}

console.log('Processing...')
walk(CEO_DIR)
console.log(`\n✅ Đã cập nhật ${total} files`)

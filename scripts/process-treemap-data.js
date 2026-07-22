/**
 * process-treemap-data.js
 *
 * Đọc 3 treemap JSON, chỉ giữ 1 màu gốc (ô lớn nhất),
 * dùng generateTreemapGradient() để tạo gradient và ghi lại file.
 *
 * Run: node scripts/process-treemap-data.js
 */

const fs = require('fs')
const path = require('path')
const { generateTreemapGradient } = require('./generate-treemap-gradient')

const TOKEN_HEX = {
  'data.deep-teal': '#1D4857',
  'data.olive-gold': '#C4A83A',
}

const FILES = [
  'apiV5/domain/ceo-command-center/market-share/2026/07/chart/cf_network_dom_b_dom_treemap.json',
  'apiV5/domain/ceo-command-center/market-share/2026/07/chart/cf_network_int_b_int_treemap.json',
  'apiV5/domain/ceo-command-center/market-share/2026/07/chart/cf_network_total_b_market_structure.json',
]

const BASE_DIR = path.resolve(__dirname, '..')

/**
 * Cấu hình màu gốc cho từng treemap.
 * - rootToken: màu của item root
 * - branchColor: map { parentName → colorToken } — các nhánh con của root
 */
const BRANCH_MAP = {
  'cf_network_dom_b_dom_treemap.json': {
    rootToken: 'data.deep-teal',
  },
  'cf_network_int_b_int_treemap.json': {
    rootToken: 'data.olive-gold',
  },
  'cf_network_total_b_market_structure.json': {
    rootToken: 'data.deep-teal',
    branchColor: {
      'Nội địa': 'data.deep-teal',
      'Quốc tế': 'data.olive-gold',
    },
  },
}

for (const relPath of FILES) {
  const absPath = path.join(BASE_DIR, relPath)
  const fileName = path.basename(relPath)
  const cfg = BRANCH_MAP[fileName]
  if (!cfg) continue

  const json = JSON.parse(fs.readFileSync(absPath, 'utf8'))
  const rows = json.autoChart.dataset.rows

  // ---------- Reset tất cả về "" ----------
  for (const row of rows) row[3] = ''

  // ---------- Gán root ----------
  rows[0][3] = cfg.rootToken

  // ---------- Gán branchColor cho con trực tiếp của root ----------
  if (cfg.branchColor) {
    for (const row of rows) {
      if (row[2] === rows[0][0] && cfg.branchColor[row[0]]) {
        row[3] = cfg.branchColor[row[0]]
      }
    }
  }

  // ---------- Gom nhóm theo parent ----------
  const byParent = {}
  for (const row of rows) {
    const parent = row[2] || '__root__'
    if (!byParent[parent]) byParent[parent] = []
    byParent[parent].push(row)
  }

  // ---------- Gradient cho item con ----------
  for (const [parentName, children] of Object.entries(byParent)) {
    // Bỏ qua root
    if (parentName === '__root__') continue

    // Nếu root có branchColor → bỏ qua nhóm con trực tiếp của root
    // (vd "Tổng thị trường" → Nội địa / Quốc tế là branch head, không gradient)
    const hasNamedBranches = cfg.branchColor && Object.keys(cfg.branchColor).length > 0
    if (hasNamedBranches && parentName === rows[0][0]) continue

    // Bỏ qua nhóm chỉ có 1 con (không cần gradient)
    if (children.length < 2) continue

    // Sắp xếp giá trị giảm dần
    children.sort((a, b) => b[1] - a[1])

    // Xác định base hex
    let baseHex = null

    // 1. Nếu parent nằm trong branchColor → dùng token đó
    if (cfg.branchColor && cfg.branchColor[parentName]) {
      baseHex = TOKEN_HEX[cfg.branchColor[parentName]]
    }

    // 2. Nếu parent có color rồi → resolve nếu là token
    if (!baseHex) {
      const parentRow = rows.find(r => r[0] === parentName)
      if (parentRow && parentRow[3]) {
        baseHex = TOKEN_HEX[parentRow[3]] || parentRow[3]
      }
    }

    // 3. Fallback: dùng root
    if (!baseHex) baseHex = TOKEN_HEX[cfg.rootToken]
    if (!baseHex) continue

    const gradient = generateTreemapGradient(baseHex, children.length)
    for (let i = 0; i < children.length; i++) {
      children[i][3] = gradient[i]
    }
  }

  // ---------- Cascade: item cha chưa có màu lấy từ con lớn nhất ----------
  for (const row of rows) {
    // Không cascade đè lên branchColor hoặc root
    if (row[3] === '' && row[2] !== '') {
      const childRows = rows.filter(r => r[2] === row[0])
      if (childRows.length > 0) {
        const sorted = [...childRows].sort((a, b) => b[1] - a[1])
        row[3] = sorted[0][3]
      }
    }
  }

  // ---------- Ghi file ----------
  fs.writeFileSync(absPath, JSON.stringify(json, null, 2) + '\n', 'utf8')
  console.log(`✅ ${fileName}`)

  // In kết quả
  const byParent2 = {}
  for (const row of rows) {
    const p = row[2] || 'root'
    if (!byParent2[p]) byParent2[p] = []
    byParent2[p].push(row)
  }
  for (const [p, children] of Object.entries(byParent2)) {
    const sorted = [...children].sort((a, b) => b[1] - a[1])
    sorted.forEach(c => {
      const label = (c[3] || '').startsWith('data.') ? c[3] : c[3]
      console.log(`  ${p.padEnd(18)} → ${c[0].padEnd(14)} ${String(c[1]).padStart(7)}  ${label}`)
    })
  }
  console.log('')
}

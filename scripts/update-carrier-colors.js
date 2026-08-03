/**
 * Script cập nhật colorToken trong các file JSON chart của carrier
 * 
 * Mapping:
 *   data.deep-teal    → carrier.vna  (VNA)
 *   data.brick        → carrier.vj   (VietJet)
 *   data.jade-blue    → carrier.qh   (Bamboo Airways)
 *   data.moss-green   → carrier.bl   (Pacific Airlines)
 *   data.olive-green  → carrier.bl   (Pacific Airlines)
 *   data.plum         → carrier.vu   (Vietravel)
 *   data.terracotta   → carrier.9g   (Sun Air)
 */

const fs = require('fs')
const path = require('path')

const BASE = path.resolve(__dirname, '../apiV5/domain')

// Map tên file (pattern) → replacement
const FILE_PATTERNS = [
  // Carrier-specific individual files
  { pattern: /_vna\.json$/, tokenMap: { 'data.deep-teal': 'carrier.vna' } },
  { pattern: /_vna_group\.json$/, tokenMap: { 'data.deep-teal': 'carrier.vna' } },
  { pattern: /_vj\.json$/, tokenMap: { 'data.brick': 'carrier.vj' } },
  { pattern: /_pa\.json$/, tokenMap: { 'data.jade-blue': 'carrier.qh' } },
  { pattern: /_ba\.json$/, tokenMap: { 'data.moss-green': 'carrier.bl' } },
  { pattern: /_vu\.json$/, tokenMap: { 'data.plum': 'carrier.vu' } },
  { pattern: /_sun\.json$/, tokenMap: { 'data.terracotta': 'carrier.9g' } },
  // General carrier chart (b_carrier — VNA data)
  { pattern: /b_carrier\.json$/, tokenMap: { 'data.deep-teal': 'carrier.vna' } },
  // Multi-carrier share_pie — color array, each position matches a carrier
  { pattern: /_share_pie\.json$/, tokenMap: {
    'data.deep-teal': 'carrier.vna',
    'data.brick': 'carrier.vj',
    'data.jade-blue': 'carrier.qh',
    'data.olive-green': 'carrier.bl',
    'data.plum': 'carrier.vu',
    'data.terracotta': 'carrier.9g',
  }},
  // Multi-carrier carrier_share — individual columns
  { pattern: /_carrier_share\.json$/, tokenMap: {
    'data.deep-teal': 'carrier.vna',
    'data.brick': 'carrier.vj',
    'data.jade-blue': 'carrier.qh',
    'data.olive-green': 'carrier.bl',
    'data.plum': 'carrier.vu',
    'data.terracotta': 'carrier.9g',
  }},
]

function shouldProcess(filename) {
  return FILE_PATTERNS.some(({ pattern }) => pattern.test(filename))
}

function getTokenMap(filename) {
  for (const { pattern, tokenMap } of FILE_PATTERNS) {
    if (pattern.test(filename)) return tokenMap
  }
  return {}
}

function replaceTokens(obj, tokenMap) {
  if (typeof obj === 'string') {
    if (obj in tokenMap) return tokenMap[obj]
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(item => replaceTokens(item, tokenMap))
  }
  if (obj && typeof obj === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      // Check key
      const newKey = key in tokenMap ? tokenMap[key] : key
      // Check value (string), hoặc đệ quy vào object/array
      if (typeof value === 'string' && value in tokenMap) {
        result[newKey] = tokenMap[value]
      } else {
        result[newKey] = replaceTokens(value, tokenMap)
      }
    }
    return result
  }
  return obj
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

function processFile(filePath, filename) {
  const tokenMap = getTokenMap(filename)
  if (Object.keys(tokenMap).length === 0) return

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const json = JSON.parse(content)
    const updated = replaceTokens(json, tokenMap)
    const newContent = JSON.stringify(updated, null, 2)
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8')
      console.log(`  ✓ ${path.relative(BASE, filePath)}`)
    }
  } catch (err) {
    console.error(`  ✗ ${path.relative(BASE, filePath)} — ${err.message}`)
  }
}

console.log('Updating carrier colors...')
walkDir(BASE)
console.log('Done!')

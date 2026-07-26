#!/usr/bin/env node
/**
 * Migrate mock-api chart/metric colors: hex → ColorTokenId.
 *
 * - columns[].color "#hex" → colorToken (delete color)
 * - columns[].color ["#a","#b"] → ["data.*", ...] (token strings in array)
 * - colorTokens.visualization "#hex" → token
 *
 * Unmapped hex kept as-is (legacy escape hatch).
 *
 * Usage: node scripts/migrate-color-tokens.mjs [--dry-run]
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

/** @type {Record<string, string>} */
const HEX_TO_TOKEN = {
  /* Role / brand (TH / KH / CK) */
  '#006d88': 'series.actual',
  '#004071': 'series.actual',
  '#2962a0': 'series.actual',
  '#2d6a9f': 'series.actual',
  '#1a4a80': 'series.actual',
  '#4a82c0': 'series.actual',
  '#d3ac2b': 'series.target',
  '#e6b441': 'series.target',
  '#b4901f': 'series.target',
  '#9aa0a6': 'series.previous',
  '#cbcfd0': 'series.previous',
  '#d0d1d3': 'series.previous',
  '#c8cdd2': 'series.previous',
  '#95a5a6': 'series.previous',
  '#64748b': 'series.forecast',
  '#a8b4c4': 'series.forecast',

  /* Semantic / RAG */
  '#22c55e': 'semantic.positive',
  '#34d399': 'semantic.positive',
  '#35c76a': 'semantic.positive',
  '#4caf50': 'semantic.positive',
  '#ef4444': 'semantic.negative',
  '#f87171': 'semantic.negative',
  '#b0322d': 'semantic.negative',
  '#fbbf24': 'rag.warning',
  '#fdb813': 'rag.warning',
  '#f4c628': 'rag.warning',

  /* V4 data swatches */
  '#1d4857': 'data.deep-teal',
  '#23434f': 'data.deep-teal',
  '#479eb3': 'data.jade-blue',
  '#3d879b': 'data.sea-blue',
  '#0e7490': 'data.sea-blue',
  '#c4a83a': 'data.olive-gold',
  '#889941': 'data.olive-green',
  '#5e793d': 'data.moss-green',
  '#c76449': 'data.brick',
  '#a55c3e': 'data.terracotta',
  '#b86a84': 'data.plum',
  '#ae8655': 'data.brown',
  '#476065': 'data.blue-grey',
  '#e28a81': 'data.coral',
  '#efe9d6': 'data.cream',

  /* Nearest-data for legacy / one-offs */
  '#8b5cf6': 'data.plum',
  '#7b3fe4': 'data.plum',
  '#8f79f1': 'data.plum',
  '#c4b5fd': 'data.plum',
  '#9c27b0': 'data.plum',
  '#ec4899': 'data.coral',
  '#f56f81': 'data.coral',
  '#e67e22': 'data.terracotta',
  '#ea580c': 'data.terracotta',
  '#fb923c': 'data.terracotta',
  '#f7a213': 'data.olive-gold',
  '#fac775': 'data.olive-gold',
  '#ef9f27': 'data.olive-gold',
  '#d98c1e': 'data.olive-gold',
  '#ba7517': 'data.brown',
  '#a5670f': 'data.brown',
  '#7a4a08': 'data.brown',
  '#14b8a6': 'data.jade-blue',
  '#2dd4bf': 'data.jade-blue',
  '#5eead4': 'data.jade-blue',
  '#3cd0a3': 'data.jade-blue',
  '#43b9e6': 'data.jade-blue',
  '#009688': 'data.jade-blue',
  '#2563eb': 'data.sea-blue',
  '#3b82f6': 'data.sea-blue',
  '#1d4ed8': 'data.sea-blue',
  '#60a5fa': 'data.sea-blue',
  '#93c5fd': 'data.sea-blue',
  '#bfdbfe': 'data.sea-blue',
  '#5b9bd5': 'data.sea-blue',
  '#2f7bc4': 'data.sea-blue',
  '#185fa5': 'data.sea-blue',
  '#0c447c': 'data.deep-teal',
  '#042c53': 'data.deep-teal',
  '#68a5f5': 'data.sea-blue',
  '#5b9cf6': 'data.sea-blue',
  '#85b7eb': 'data.sea-blue',
  '#aecbec': 'data.sea-blue',
  '#d6e6f7': 'data.cream',
  '#6d28d9': 'data.plum',
  '#f59e0b': 'data.olive-gold',
}

function normHex(hex) {
  return String(hex).trim().toLowerCase()
}

function hexToToken(hex) {
  return HEX_TO_TOKEN[normHex(hex)] ?? null
}

const stats = {
  files: 0,
  changed: 0,
  colorToToken: 0,
  colorArrayMapped: 0,
  visualizationMapped: 0,
  unmappedHex: new Map(),
}

function noteUnmapped(hex) {
  const k = normHex(hex)
  stats.unmappedHex.set(k, (stats.unmappedHex.get(k) || 0) + 1)
}

/**
 * @param {unknown} node
 * @param {string | null} parentKey
 */
function walk(node, parentKey) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const item = node[i]
      if (parentKey === 'color' && typeof item === 'string' && item.startsWith('#')) {
        const token = hexToToken(item)
        if (token) {
          node[i] = token
          stats.colorArrayMapped++
        } else {
          noteUnmapped(item)
        }
      } else {
        walk(item, parentKey)
      }
    }
    return
  }

  if (!node || typeof node !== 'object') return

  const obj = /** @type {Record<string, unknown>} */ (node)

  if (typeof obj.color === 'string' && obj.color.startsWith('#')) {
    const token = hexToToken(obj.color)
    if (token) {
      obj.colorToken = token
      delete obj.color
      stats.colorToToken++
    } else {
      noteUnmapped(obj.color)
    }
  } else if (Array.isArray(obj.color)) {
    walk(obj.color, 'color')
  }

  if (
    obj.colorTokens &&
    typeof obj.colorTokens === 'object' &&
    !Array.isArray(obj.colorTokens)
  ) {
    const ct = /** @type {Record<string, unknown>} */ (obj.colorTokens)
    if (typeof ct.visualization === 'string' && ct.visualization.startsWith('#')) {
      const token = hexToToken(ct.visualization)
      if (token) {
        ct.visualization = token
        stats.visualizationMapped++
      } else {
        noteUnmapped(ct.visualization)
      }
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'color') continue
    if (key === 'colorTokens') {
      // already handled visualization; still walk nested for safety
      walk(value, key)
      continue
    }
    walk(value, key)
  }
}

function walkDir(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'scripts') continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      walkDir(full)
      continue
    }
    if (!name.endsWith('.json')) continue
    stats.files++
    let raw
    try {
      raw = fs.readFileSync(full, 'utf8')
    } catch {
      continue
    }
    let data
    try {
      data = JSON.parse(raw)
    } catch {
      continue
    }
    const before = JSON.stringify(data)
    walk(data, null)
    const after = JSON.stringify(data)
    if (before === after) continue
    stats.changed++
    if (!DRY) {
      // Preserve 2-space indent (common in this repo)
      fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    }
  }
}

walkDir(ROOT)

console.log(
  JSON.stringify(
    {
      dryRun: DRY,
      filesScanned: stats.files,
      filesChanged: stats.changed,
      colorToToken: stats.colorToToken,
      colorArrayMapped: stats.colorArrayMapped,
      visualizationMapped: stats.visualizationMapped,
      unmappedHex: Object.fromEntries(
        [...stats.unmappedHex.entries()].sort((a, b) => b[1] - a[1]),
      ),
    },
    null,
    2,
  ),
)

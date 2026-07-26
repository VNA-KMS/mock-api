#!/usr/bin/env node
/**
 * Migrate mock-api chartType → contract ngoài→trong:
 *   R = engine cụ thể (không auto)
 *   V = auto | engine (auto = kế thừa R)
 *   S = line|bar|area (+ lineStyle / showSymbol)
 *
 * - legacy actual-plan-combo (nếu còn) → combo + series tường minh
 * - pie/donut/… trên series → promote lên R/V
 * - R=auto → suy từ view/series (một lần), ghi cứng
 *
 * Usage: node scripts/migrate-chart-types.cjs [--dry-run]
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const SERIES_GEOMS = new Set(['line', 'bar', 'area'])
const ENGINE_TYPES = new Set([
  'line', 'bar', 'area', 'combo',
  'bar-h', 'bar-h-stacked', 'horizontal-stacked-bar',
  'pie', 'pie-simple', 'half-donut', 'center-donut', 'donut-pct', 'donut-kpi',
  'kpi-distribution', 'nested-pie',
  'radar', 'scatter', 'scatter-bar', 'multi-y',
  'heatmap', 'gauge', 'waterfall', 'sankey', 'parallel', 'treemap', 'sunburst',
  'difference',
])

/** One-time migrate convention (không chạy ở FE runtime). */
function applyFieldConvention(series) {
  if (!Array.isArray(series)) return false
  let changed = false
  for (const s of series) {
    if (!s || typeof s !== 'object' || !s.field) continue
    const id = String(s.field).toLowerCase()
    const before = JSON.stringify(s)
    if (id === 'th' || id === 'th_lk') {
      s.chartType = 'bar'
      if (s.showSymbol == null) s.showSymbol = true
      delete s.lineStyle
      delete s.lineType
    } else if (id === 'ck' || id === 'ck_lk') {
      s.chartType = 'bar'
      delete s.lineStyle
      delete s.lineType
    } else if (id === 'db' || id === 'db_lk') {
      s.chartType = 'line'
      s.lineStyle = 'dashed'
    } else if (id === 'uth') {
      s.chartType = 'bar'
      s.lineStyle = 'dashed'
    } else if (id === 'fct' || id === 'fct_lk') {
      s.chartType = 'line'
      s.lineStyle = 'dotted'
    }
    if (JSON.stringify(s) !== before) changed = true
  }
  return changed
}

function looksLikeActualPlan(series) {
  if (!Array.isArray(series) || !series.length) return false
  const ids = new Set(series.map((s) => String(s.field || '').toLowerCase()))
  const hasTh = ids.has('th') || ids.has('th_lk')
  const hasDb = ids.has('db') || ids.has('db_lk')
  const hasCk = ids.has('ck') || ids.has('ck_lk')
  return hasTh && (hasDb || hasCk)
}

function normalizeSeriesGeom(s) {
  if (!s || typeof s !== 'object') return { changed: false, engine: null }
  const t = String(s.chartType || '').toLowerCase()
  if (!t || t === 'auto') return { changed: false, engine: null }
  if (SERIES_GEOMS.has(t)) return { changed: false, engine: null }
  if (ENGINE_TYPES.has(t) || t.includes('pie') || t.includes('donut')) {
    const engine = t === 'pie' ? 'pie-simple' : t
    delete s.chartType
    return { changed: true, engine }
  }
  // unknown → strip to avoid FE confusion
  delete s.chartType
  return { changed: true, engine: null }
}

function inferFromSeries(series) {
  if (!Array.isArray(series) || !series.length) return null
  const geoms = []
  let engine = null
  for (const s of series) {
    const t = String(s?.chartType || '').toLowerCase()
    if (!t || t === 'auto') continue
    if (SERIES_GEOMS.has(t)) geoms.push(t)
    else if (ENGINE_TYPES.has(t) || t.includes('pie') || t.includes('donut')) {
      engine = t === 'pie' ? 'pie-simple' : t
    }
  }
  if (engine) return engine
  const uniq = [...new Set(geoms)]
  if (uniq.length === 0) return null
  if (uniq.length === 1) return uniq[0]
  if (uniq.includes('bar') && (uniq.includes('line') || uniq.includes('area'))) return 'combo'
  return 'combo'
}

function migrateAutoChart(ac) {
  if (!ac || typeof ac !== 'object' || !Array.isArray(ac.views)) return false
  let changed = false
  const views = ac.views

  // Promote engine off series; collect hints
  const promoted = []
  for (const v of views) {
    if (!v || !Array.isArray(v.series)) continue
    for (const s of v.series) {
      const { changed: c, engine } = normalizeSeriesGeom(s)
      if (c) changed = true
      if (engine) promoted.push(engine)
    }
  }

  let R = ac.chartType
  const wasApc = R === 'actual-plan-combo'
  if (wasApc) {
    ac.chartType = 'combo'
    R = 'combo'
    changed = true
    for (const v of views) {
      if (applyFieldConvention(v.series)) changed = true
    }
  }

  // Silent-APC cases: bar/area/combo/auto with th+db/ck
  if (
    (!R || R === 'auto' || R === 'bar' || R === 'area' || R === 'combo')
    && views.some((v) => looksLikeActualPlan(v.series))
  ) {
    if (R !== 'combo') {
      ac.chartType = 'combo'
      R = 'combo'
      changed = true
    }
    for (const v of views) {
      if (looksLikeActualPlan(v.series) && applyFieldConvention(v.series)) changed = true
    }
  }

  // Infer R when auto/missing
  if (!R || R === 'auto') {
    let inferred = promoted[0] || null
    if (!inferred) {
      for (const v of views) {
        const vt = v?.chartType
        if (vt && vt !== 'auto' && ENGINE_TYPES.has(vt)) {
          inferred = vt
          break
        }
      }
    }
    if (!inferred) {
      for (const v of views) {
        inferred = inferFromSeries(v.series)
        if (inferred) break
      }
    }
    if (!inferred) inferred = 'line'
    ac.chartType = inferred
    R = inferred
    changed = true
  }

  // Normalize views
  for (const v of views) {
    if (!v) continue
    let V = v.chartType
    if (promoted.length === 1 && (!V || V === 'auto' || V === 'bar' || V === 'line')) {
      // single promoted engine (pie etc.) — keep V auto to inherit R
      if (V && V !== 'auto' && V !== R) {
        // leave concrete override
      } else if (V !== 'auto') {
        v.chartType = 'auto'
        changed = true
        V = 'auto'
      }
    }

    // bar-h root with view bar → inherit
    if ((R === 'bar-h' || R === 'bar-h-stacked') && V === 'bar') {
      v.chartType = 'auto'
      changed = true
      V = 'auto'
    }

    // view carries pie while R is pie → auto
    if (V && V !== 'auto' && V === R) {
      v.chartType = 'auto'
      changed = true
    }

    if (!V || V === 'auto') {
      if (v.chartType !== 'auto') {
        v.chartType = 'auto'
        changed = true
      }
    }
  }

  // Ensure combo series have geom
  if (R === 'combo') {
    for (const v of views) {
      if (!Array.isArray(v.series)) continue
      for (const s of v.series) {
        if (!s.chartType || s.chartType === 'auto') {
          s.chartType = 'bar'
          changed = true
        }
      }
    }
  }

  return changed
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue
      walk(p, files)
    } else if (ent.name.endsWith('.json')) {
      files.push(p)
    }
  }
  return files
}

function processFile(file) {
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return false
  }
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return false
  }

  let changed = false

  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node.autoChart) {
      if (migrateAutoChart(node.autoChart)) changed = true
    }
    // some files ARE the autoChart root
    if (node.dataset && Array.isArray(node.views) && ('chartType' in node || node.views)) {
      if (migrateAutoChart(node)) changed = true
    }
    for (const k of Object.keys(node)) {
      if (k === 'autoChart') continue
      visit(node[k])
    }
  }

  visit(data)
  if (!changed) return false
  if (!DRY) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
  }
  return true
}

const files = walk(path.join(ROOT, 'apiV5'))
let n = 0
for (const f of files) {
  if (processFile(f)) {
    n++
    if (n <= 20 || n % 500 === 0) {
      console.log((DRY ? '[dry] ' : '') + path.relative(ROOT, f))
    }
  }
}
console.log(`\n${DRY ? 'Would update' : 'Updated'} ${n} / ${files.length} files`)

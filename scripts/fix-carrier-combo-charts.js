/**
 * Fix combo chart definitions for individual carrier chart files.
 *
 * Issues:
 * 1. Labels "2026" → "TH 2026", "2025" → "TH 2025"
 * 2. th colorToken: carrier.* → series.actual
 * 3. th_lk colorToken: carrier.* → series.actual  
 * 4. Missing fct (forecast) column with color #8B5CF6
 * 5. Add fct to views
 * 6. Cumulative labels: "Luỹ kế 2026" → "Lũy kế TH 2026"
 */

const fs = require('fs')
const path = require('path')

const BASE = path.resolve(__dirname, '../apiV5/domain')
const FCT_COLOR = '#8B5CF6'

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
    if (!json.autoChart || json.autoChart.chartType !== 'combo') return
    if (!json.autoChart.dataset?.columns) return

    const ds = json.autoChart.dataset
    let changed = false

    // 1. Fix labels and colorTokens
    for (const col of ds.columns) {
      if (col.id === 'th') {
        if (col.label === '2026') { col.label = 'TH 2026'; changed = true }
        if (col.colorToken?.startsWith('carrier.')) { col.colorToken = 'series.actual'; changed = true }
      }
      if (col.id === 'ck' && col.label === '2025') {
        col.label = 'TH 2025'; changed = true
      }
      if (col.id === 'th_lk') {
        if (col.label === 'Luỹ kế 2026') { col.label = 'Lũy kế TH 2026'; changed = true }
        if (col.colorToken?.startsWith('carrier.')) { col.colorToken = 'series.actual'; changed = true }
      }
      if (col.id === 'ck_lk' && col.label === 'Luỹ kế 2025') {
        col.label = 'Lũy kế TH 2025'; changed = true
      }
    }

    // 2. Add fct column if missing
    if (!ds.columns.some(c => c.id === 'fct') && ds.rows?.length > 0) {
      const thIdx = ds.columns.findIndex(c => c.id === 'th')
      const dbIdx = ds.columns.findIndex(c => c.id === 'db')
      const thLkIdx = ds.columns.findIndex(c => c.id === 'th_lk')

      // Compute fct values for each row
      const fctValues = ds.rows.map(row => {
        const thVal = row[thIdx]
        const dbVal = dbIdx !== -1 ? row[dbIdx] : null
        if (thVal != null) return null // Past months
        if (dbVal != null) { // Future months
          const variation = (Math.random() - 0.2) * dbVal * 0.06
          return Math.round((dbVal + variation) * 10) / 10
        }
        return null
      })

      // Compute cumulative forecast
      let cumSum = 0
      const fctLkValues = fctValues.map(v => {
        if (v != null) cumSum += v
        return cumSum > 0 ? Math.round(cumSum * 10) / 10 : null
      })

      // Add columns
      ds.columns.splice(thIdx + 1, 0, {
        id: 'fct', type: 'number', label: 'FCT 2026', color: FCT_COLOR
      })
      ds.columns.splice(thLkIdx + 2, 0, {
        id: 'fct_lk', type: 'number', label: 'Lũy kế FCT 2026', color: FCT_COLOR
      })

      // Add values to each row
      for (let i = 0; i < ds.rows.length; i++) {
        ds.rows[i].splice(thIdx + 1, 0, fctValues[i])
        ds.rows[i].splice(thLkIdx + 2, 0, fctLkValues[i])
      }

      // Add fct to views
      if (json.autoChart.views) {
        for (const view of json.autoChart.views) {
          if (view.series && !view.series.some(s => s.field === 'fct')) {
            view.series.push({
              field: 'fct',
              chartType: 'bar',
              barOpacity: 0.3,
              lineStyle: 'dashed'
            })
          }
        }
      }

      changed = true
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

console.log('Fixing carrier combo chart definitions...')
walkDir(BASE)
console.log('Done!')

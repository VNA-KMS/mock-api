const fs = require('fs')
const path = require('path')

const BASE = path.join(__dirname, '..', 'apiV5', 'domain', 'ceo-command-center')
const SRC_MONTH = path.join(BASE, 'commerce-i', '2026', '07')
const SRC_WEEK = path.join(BASE, 'commerce-i', '2026', 'W31')
const DST_MONTH = path.join(BASE, 'commerce-ii', '2026', '07')
const DST_WEEK = path.join(BASE, 'commerce-ii', '2026', 'W31')

// Read, modify data (shift by random factor), and write chart files
function processChartFiles(srcDir, dstDir, seed) {
  if (!fs.existsSync(srcDir)) {
    console.log(`Source dir not found: ${srcDir}`)
    return
  }
  const chartDir = path.join(dstDir, 'chart')
  fs.mkdirSync(chartDir, { recursive: true })

  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json') && !f.includes('.bak'))
  let count = 0
  for (const file of files) {
    const srcPath = path.join(srcDir, file)
    const dstPath = path.join(chartDir, file)
    try {
      const data = JSON.parse(fs.readFileSync(srcPath, 'utf-8'))
      if (data.autoChart?.dataset?.rows) {
        for (const row of data.autoChart.dataset.rows) {
          for (let i = 1; i < row.length; i++) {
            if (typeof row[i] === 'number') {
              // Shift by -15% to +15% using seed-based deterministic variation
              const hash = (file.charCodeAt(0) + file.charCodeAt(file.length - 1) + i * seed) % 31
              const factor = 0.85 + (hash / 31) * 0.3
              row[i] = Math.round(row[i] * factor)
            }
          }
        }
      }
      fs.writeFileSync(dstPath, JSON.stringify(data, null, 2), 'utf-8')
      count++
    } catch (e) {
      console.error(`Error processing ${file}: ${e.message}`)
    }
  }
  console.log(`  Created ${count} chart files in ${chartDir}`)
}

// Create week index.json from month template
function createWeekIndex() {
  const srcPath = path.join(DST_MONTH, 'index.json')
  const dstPath = path.join(DST_WEEK, 'index.json')

  if (!fs.existsSync(srcPath)) {
    console.error(`Month index.json not found: ${srcPath}`)
    return
  }

  const data = JSON.parse(fs.readFileSync(srcPath, 'utf-8'))

  // Update chart paths from 07 to W31
  function updatePaths(obj) {
    if (!obj || typeof obj !== 'object') return
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace('/2026/07/', '/2026/W31/')
      } else {
        updatePaths(obj[key])
      }
    }
  }
  updatePaths(data)

  // Update metric card values slightly
  for (const item of data.metricCards?.items || []) {
    const val = parseFloat(String(item.value).replace(/[.,\s]/g, ''))
    if (!isNaN(val)) {
      const hash = (item.id?.charCodeAt(0) || 1) * 7
      const factor = 0.9 + (hash % 21) / 100
      item.value = String(Math.round(val * factor))
    }
    if (item.visualization?.data) {
      item.visualization.data = item.visualization.data.map(d => {
        if (typeof d === 'number') {
          const hash = (item.id?.charCodeAt(0) || 1) * 3
          const factor = 0.88 + (hash % 25) / 100
          return Math.round(d * factor * 10) / 10
        }
        return d
      })
    }
  }

  fs.mkdirSync(path.dirname(dstPath), { recursive: true })
  fs.writeFileSync(dstPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`  Created ${dstPath}`)
}

// Update month index.json chart paths from commerce-i to commerce-ii
function updateMonthIndexPaths() {
  const indexPath = path.join(DST_MONTH, 'index.json')
  const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))

  function updatePaths(obj) {
    if (!obj || typeof obj !== 'object') return
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/\/commerce-i\//g, '/commerce-ii/')
      } else {
        updatePaths(obj[key])
      }
    }
  }
  updatePaths(data)

  fs.writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`  Updated chart paths in ${indexPath}`)
}

console.log('=== Generating Commerce II chart data ===')
console.log('\nMonth (07) chart files:')
processChartFiles(path.join(SRC_MONTH, 'chart'), DST_MONTH, 13)
console.log('\nWeek (W31) chart files:')
processChartFiles(path.join(SRC_WEEK, 'chart'), DST_WEEK, 7)
console.log('\nCreating W31 index.json:')
createWeekIndex()
console.log('\nUpdating month index.json paths:')
updateMonthIndexPaths()
console.log('\nDone!')

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_V3 = path.resolve(__dirname, '..', 'apiV3')
const API_V4 = path.resolve(__dirname, '..', 'apiV4')

function isBoardData(obj) {
  if (!obj || typeof obj !== 'object') return false
  return 'chartBoard' in obj || 'sections' in obj || 'metricCards' in obj
}

function generateLineData(labels, seriesCount, baseValue, variance) {
  const series = []
  for (let s = 0; s < seriesCount; s++) {
    const name = `Series ${s + 1}`
    const colors = ['#2563eb', '#14b8a6', '#8b5cf6', '#ec4899', '#f59e0b']
    const data = labels.map(() =>
      Math.round((baseValue + (Math.random() - 0.5) * variance) * 10) / 10
    )
    series.push({ name, data, color: colors[s % colors.length] })
  }
  return series
}

function generateBarData(labels, seriesCount) {
  const series = []
  const colors = ['#2563eb', '#c4b5fd', '#14b8a6', '#f59e0b']
  for (let s = 0; s < seriesCount; s++) {
    const data = labels.map(() => Math.round(Math.random() * 10000))
    series.push({
      name: s === 0 ? 'Thực hiện' : s === 1 ? 'Kế hoạch' : `Series ${s + 1}`,
      data,
      color: colors[s % colors.length],
    })
  }
  return series
}

function buildDatasetFromChartName(title, chartPath) {
  const isBar = /\b(bar|fleet|delay|causes|breakdown)\b/i.test(title) ||
    chartPath?.includes('fleet') || chartPath?.includes('breakdown')
  const isDoughnut = /\b(doughnut|pie|share|ratio|breakdown)\b/i.test(title) ||
    chartPath?.includes('doughnut')
  const isScatter = /\b(scatter|correlation|scatter)\b/i.test(title) ||
    chartPath?.includes('scatter') || chartPath?.includes('correlation')

  if (isDoughnut) {
    const rows = [
      ['Kỹ thuật', 65],
      ['Phi kỹ thuật', 35],
    ]
    return {
      columns: [
        { id: 'label', type: 'string' },
        { id: 'value', type: 'number', color: ['#2d6a9f', '#e67e22', '#22c55e', '#f59e0b'] },
      ],
      rows,
    }
  }

  if (isScatter) {
    const rows = [
      ['DOM', 1400, 60, 'Domestic'],
      ['INT', 300, 40, 'International'],
      ['INT', 500, 70, 'International'],
      ['DOM', 1850, 40, 'Domestic'],
    ]
    return {
      columns: [
        { id: 'area', type: 'string' },
        { id: 'x', type: 'number', label: 'X' },
        { id: 'y', type: 'number', label: 'Y' },
        { id: 'segment', type: 'string' },
      ],
      rows,
    }
  }

  const labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']

  if (isBar) {
    const categories = ['A321', 'A350', 'B787', 'ATR72']
    const seriesData = generateBarData(categories, 2)
    const columns = [
      { id: 'category', type: 'string' },
    ]
    const rows = categories.map((cat, i) => {
      const row = [cat]
      seriesData.forEach((s) => row.push(s.data[i]))
      return row
    })
    columns.push(...seriesData.map((s) => ({
      id: s.name.toLowerCase().replace(/\s+/g, '_'),
      type: 'number',
      label: s.name,
      color: s.color,
    })))
    return { columns, rows }
  }

  const seriesData = generateLineData(labels, 3, 100, 20)
  const columns = [
    { id: 'month', type: 'string' },
    ...seriesData.map((s) => ({
      id: s.name.toLowerCase().replace(/\s+/g, '_'),
      type: 'number',
      label: s.name,
      color: s.color,
    })),
  ]
  const rows = labels.map((label, i) => {
    const row = [label]
    seriesData.forEach((s) => row.push(s.data[i]))
    return row
  })

  return { columns, rows }
}

function convertBoard(v3Data) {
  const result = {}
  if (v3Data.titleInfo) result.titleInfo = v3Data.titleInfo
  if (v3Data.metricCards) result.metricCards = v3Data.metricCards

  const chartBoard = v3Data.chartBoard || v3Data.sections || []
  if (chartBoard.length === 0) {
    return result
  }

  result.chartBoard = chartBoard.map((section, sectionIdx) => {
    const columns = section.columns || 2
    let currentRow = 1

    const items = (section.items || []).map((item, itemIdx) => {
      const itemResult = {
        id: item.id || `item-${sectionIdx}-${itemIdx}`,
        title: item.title,
        subTitle: item.subTitle,
      }

      // Compute col/row placement
      const itemCol = item.col || ((itemIdx % columns) + 1)
      const itemRow = item.row || currentRow
      const colSpan = item.span ? parseInt(String(item.span)) : (item.colSpan || 1)
      const rowSpan = item.rowSpan || 1
      itemResult.col = itemCol
      itemResult.row = itemRow
      itemResult.colSpan = colSpan
      itemResult.rowSpan = rowSpan
      itemResult.aspectRatio = item.aspectRatio || 1.8

      // If current item spans to a column that would exceed the grid width, advance row
      if (itemCol + colSpan > columns + 1) {
        itemResult.col = 1
        itemResult.row = currentRow + 1
      }

      // Update currentRow for next items
      if (itemCol + colSpan > columns) {
        currentRow = itemRow + rowSpan
      } else if (itemCol === columns) {
        currentRow = itemRow + rowSpan
      }

      if (item.card) {
        itemResult.card = item.card
      } else if (item.table) {
        itemResult.table = item.table
      } else if (item.chartPath || item.chart) {
        const chartPath = item.chartPath || ''
        const title = item.title || ''
        const dataset = buildDatasetFromChartName(title, chartPath)

        itemResult.autoChart = {
          chartType: 'auto',
          aspectRatio: item.aspectRatio || 1.8,
          dataset,
          views: [
            {
              id: 'main',
              chartType: 'auto',
              xField: dataset.columns[0].id,
              series: dataset.columns
                .filter((c) => c.type === 'number')
                .map((c) => ({
                  field: c.id,
                  chartType: 'line',
                })),
            },
          ],
        }
      }

      return itemResult
    })

    return {
      title: section.title,
      columns,
      items,
    }
  })

  return result
}

function collectV3Files(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectV3Files(fullPath))
    } else if (entry.isFile() && entry.name === 'index.json' && !fullPath.includes('node_modules')) {
      files.push(fullPath)
    }
  }
  return files
}

function main() {
  const v3Files = collectV3Files(API_V3)
  let converted = 0
  let skipped = 0
  let errors = 0

  for (const v3File of v3Files) {
    try {
      const content = fs.readFileSync(v3File, 'utf-8')
      const v3Data = JSON.parse(content)

      if (!isBoardData(v3Data)) {
        skipped++
        continue
      }

      const v4RelPath = path.relative(API_V3, v3File)
      const v4File = path.join(API_V4, v4RelPath)
      const v4Dir = path.dirname(v4File)

      const v4Data = convertBoard(v3Data)
      fs.mkdirSync(v4Dir, { recursive: true })
      fs.writeFileSync(v4File, JSON.stringify(v4Data, null, 2), 'utf-8')
      converted++
      console.log(`✓ ${v4RelPath}`)
    } catch (err) {
      errors++
      console.error(`✗ ${path.relative(API_V3, v3File)}: ${err.message}`)
    }
  }

  console.log(`\nDone: ${converted} converted, ${skipped} skipped, ${errors} errors`)
}

main()

/**
 * fix-aiinsights.js — Re-run aiInsight addition with fixed walker
 */
const fs = require('fs')
const path = require('path')

const BASE_DIR = path.resolve(__dirname, '../apiV5/domain/ceo-command-center/market-share/2026')
const PERIODS = ['07', 'Q3', 'W31']

const METRIC_TARGETS = {
  '07':   { t_tot: 2.3, t_int: 1.1, t_dom: 1.2 },
  'Q3':   { t_tot: 2.8, t_int: 1.3, t_dom: 1.5 },
  'W31':  { t_tot: 2.4, t_int: 1.2, t_dom: 1.2 },
  '2026': { t_tot: 2.3, t_int: 1.1, t_dom: 1.2 }
}

const PERIOD_LABELS = { '07': 'Tháng 7', 'Q3': 'Quý 3', 'W31': 'Tuần 31', '2026': 'Tháng 7' }

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')) }
function writeJson(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8') }

function generateInsight(item, period) {
  const id = item.id || ''
  const title = item.title || ''
  const subTitle = item.subTitle || ''
  const t = METRIC_TARGETS[period]

  if (id === 'b_pax_total' || title === 'Toàn thị trường')
    return { text: `<strong>${PERIOD_LABELS[period]}:</strong> Số khách toàn thị trường đạt <strong>${t.t_tot.toFixed(2).replace('.', ',')}</strong> triệu, tăng <strong>4%</strong> so với cùng kỳ; dự báo T8 đạt <strong>1,28</strong> triệu.`, tone: 'info', status: 1 }
  if (id === 'b_pax_int' || title === 'Quốc tế')
    return { text: `<strong>${PERIOD_LABELS[period]}:</strong> Khách quốc tế đạt <strong>${t.t_int.toFixed(2).replace('.', ',')}</strong> triệu, tăng <strong>6%</strong> so với cùng kỳ; dự báo T8 đạt <strong>1,14</strong> triệu.`, tone: 'info', status: 1 }
  if (id === 'b_pax_dom' || title === 'Nội địa')
    return { text: `<strong>${PERIOD_LABELS[period]}:</strong> Khách nội địa đạt <strong>${t.t_dom.toFixed(2).replace('.', ',')}</strong> triệu, tăng <strong>2%</strong> so với cùng kỳ; dự báo T8 đạt <strong>1,20</strong> triệu.`, tone: 'info', status: 1 }
  if (id === 'b_share_int' && title.includes('Quốc tế'))
    return { text: `<strong>${PERIOD_LABELS[period]}:</strong> Thị phần VNA Group quốc tế đạt <strong>28,2%</strong>, thấp hơn <strong>0,8</strong> điểm % so với KH; xu hướng ổn định.`, tone: 'warning', status: 1 }
  if (id === 'b_share_dom' && title.includes('Nội địa'))
    return { text: `<strong>${PERIOD_LABELS[period]}:</strong> Thị phần VNA Group nội địa đạt <strong>45,4%</strong>, thấp hơn <strong>0,6</strong> điểm % so với KH.`, tone: 'warning', status: 1 }
  if (id === 'b_total_int_dom_pie')
    return { text: `Cơ cấu thị trường INT/DOM: Quốc tế chiếm <strong>${(t.t_int/t.t_tot*100).toFixed(0)}%</strong>, Nội địa chiếm <strong>${(t.t_dom/t.t_tot*100).toFixed(0)}%</strong>.`, tone: 'info', status: 1 }
  if (id === 'b_total_market_structure_stacked' || id === 'b_total_market_structure' || id === 'b_total_market_structure_bar100')
    return { text: `Cơ cấu thị trường theo khu vực: NEA dẫn đầu thị phần quốc tế, tiếp theo là SEA và CLMV.`, tone: 'info', status: 1 }
  if (id === 'b_risk')
    return { text: `Phát hiện biến động giảm thị phần tại một số khu vực, cần theo dõi chặt chẽ.`, tone: 'warning', status: 1 }
  if (id === 'b_int' || id === 'b_dom' || id === 'b_carrier')
    return { text: `${title}: Dữ liệu thị trường được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }

  // Region INT charts
  if (id.startsWith('b_int_') && !id.includes('_country') && !id.includes('_route_share') && !id.includes('_route_pie') && !id.includes('_treemap')) {
    const region = title
    return { text: `Khu vực ${region}: Dữ liệu khách quốc tế được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }
  }

  // Region DOM charts  
  if (id.startsWith('b_dom_') && !id.includes('_country') && !id.includes('_share_pie') && !id.includes('_route_pie') && !id.includes('_carrier_share') && !id.startsWith('b_dom_vna') && !id.startsWith('b_dom_pa') && !id.startsWith('b_dom_vj') && !id.startsWith('b_dom_ba') && !id.startsWith('b_dom_sun') && !id.startsWith('b_dom_vu')) {
    return { text: `Khu vực ${title}: Dữ liệu khách nội địa được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }
  }

  // Country share charts
  if (id.includes('_country')) {
    const region = title.replace(' - Thị phần Country', '')
    return { text: `Thị phần Country khu vực ${region}: Dữ liệu được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }
  }

  // Route / pie / treemap
  if (id.includes('_route_share'))
    return { text: `Thị phần route theo khu vực: SWP 44%, CLMV 31%, NEA 11%, SEA 6%, US 5%, EU 3%.`, tone: 'info', status: 1 }
  if (id.includes('_route_pie') || id.includes('_share_pie') || id.includes('_treemap'))
    return { text: `Cơ cấu ${title}: Thị phần được phân bổ theo các hãng bay.`, tone: 'info', status: 1 }
  if (id.includes('_carrier_share'))
    return { text: `Thị phần các hãng theo khu vực: VNA Group dẫn đầu thị phần nội địa.`, tone: 'info', status: 1 }
  if (id.startsWith('b_dom_vna_group') || id.startsWith('b_dom_vna') || id.startsWith('b_dom_pa') || id.startsWith('b_dom_vj') || id.startsWith('b_dom_ba') || id.startsWith('b_dom_sun') || id.startsWith('b_dom_vu'))
    return { text: `Thị phần ${title}: Dữ liệu được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }

  return { text: `${title}: Dữ liệu thị trường được cập nhật theo kỳ báo cáo.`, tone: 'info', status: 1 }
}

function addInsights(period, overwriteExisting = false) {
  const indexPath = period === '2026' ? path.join(BASE_DIR, 'index.json') : path.join(BASE_DIR, period, 'index.json')
  if (!fs.existsSync(indexPath)) return 0
  const data = readJson(indexPath)
  let count = 0

  function walkItems(items) {
    if (!Array.isArray(items)) return
    for (const item of items) {
      if (!overwriteExisting && item.aiInsight) continue
      const insight = generateInsight(item, period)
      if (insight) { item.aiInsight = insight; count++ }
    }
  }

  function walkChartBoards(obj) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item && Array.isArray(item.items)) {
          walkItems(item.items)
        }
      }
      return
    }
    if (obj.chartBoard) walkChartBoards(obj.chartBoard)
    if (obj.contentFilter?.network) {
      for (const key of ['total', 'int', 'dom']) {
        if (obj.contentFilter.network[key]?.chartBoard) {
          walkChartBoards(obj.contentFilter.network[key].chartBoard)
        }
      }
    }
  }

  walkChartBoards(data)
  if (count > 0) writeJson(indexPath, data)
  return count
}

// Re-run 2026 with overwrite to fix "undefined" labels
const n2026 = addInsights('2026', true)
console.log(`2026/index.json: ${n2026} insights updated (overwrite)`)

// Other periods: add missing only
for (const period of PERIODS) {
  const n = addInsights(period)
  console.log(`${period}/index.json: ${n} insights added`)
}

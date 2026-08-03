const fs = require('fs');
const p = 'D:/Project/VNA/Git/mock-api/apiV5/domain/bod-strategic-dashboards/finance/2026/07/index.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));

d.chartBoard.push({
  title: 'Phân tích doanh thu & lợi nhuận',
  items: [
    {
      id: 'b_waterfall',
      title: 'P&L Bridge',
      subTitle: 'Gross Revenue \u2192 Net Profit',
      col: 1,
      colSpan: 30,
      row: 1,
      chartPath: 'apiV5/domain/bod-strategic-dashboards/finance/2026/07/chart/b_waterfall.json'
    },
    {
      id: 'b_structure',
      title: 'Revenue Structure',
      subTitle: 'Treemap 2 l\u1edbp',
      col: 31,
      colSpan: 30,
      row: 1,
      chartPath: 'apiV5/domain/bod-strategic-dashboards/finance/2026/07/chart/b_structure.json'
    }
  ]
});

fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
console.log('Added section');

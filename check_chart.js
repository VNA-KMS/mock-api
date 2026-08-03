const fs = require('fs');
const p = 'D:/Project/VNA/Git/mock-api/apiV5/domain/bod-strategic-dashboards/finance/2026/07/chart/b_profit_bridge_uth.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));
data.autoChart.dataset.columns.forEach(c => console.log(c.id + ': label=' + (c.label||'') + ' color=' + JSON.stringify(c.color)));
data.autoChart.views[0].series.forEach(s => console.log('series: ' + s.field + ' type=' + s.chartType));

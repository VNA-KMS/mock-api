const fs = require('fs');
const p = 'D:/Project/VNA/Git/mock-api/apiV5/domain/ceo-command-center/finance/2026/07/index.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
d.chartBoard.forEach(s => {
  if (s.title === 'Phân tích doanh thu & lợi nhuận') {
    console.log('Section:', s.title);
    s.items.forEach(i => {
      console.log('  id=' + i.id + ' title=' + (i.title || '') + ' chartPath=' + (i.chartPath || ''));
    });
  }
});

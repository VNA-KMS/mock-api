const fs = require('fs');
const p = 'D:/Project/VNA/Git/mock-api/apiV5/domain/bod-strategic-dashboards/invest/2026/07/index.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

const items = [
  { iconBg: '#ffedd5', color: '#004071', bar: '#004071',
    title: 'Tàu bay, động c\u01a1', value: '2.508', total: '3.200', caption: 'Gi\u1ea3i ng\u00e2n 8/8 D\u1ef1 \u00e1n (100%)', pct: 78 },
  { iconBg: '#d1fae5', color: '#0e9f6e', bar: '#10b981',
    title: 'TTB', value: '864', total: '1.450', caption: 'Gi\u1ea3i ng\u00e2n 4/6 D\u1ef1 \u00e1n (67%)', pct: 60 },
  { iconBg: '#ffe4e8', color: '#e11d48', bar: '#f43f5e',
    title: 'XDCB', value: '568', total: '1.100', caption: 'Gi\u1ea3i ng\u00e2n 2/5 D\u1ef1 \u00e1n (40%)', pct: 52 },
  { iconBg: '#cffafe', color: '#0891b2', bar: '#06b6d4',
    title: '\u0110TRNDN', value: '616', total: '850', caption: 'Gi\u1ea3i ng\u00e2n 4/5 D\u1ef1 \u00e1n (80%)', pct: 72 }
];

function esc(s) {
  return s.replace(/"/g, '&quot;');
}

function buildItemHtml(d) {
  const li = '12';
  const items = [
    '<div class="item-list" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid rgba(20,20,20,0.09)">',
    '<div style="width:40px;height:40px;border-radius:1000px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + d.iconBg + '">',
    '<svg width="17" height="17" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="8.5" fill="' + d.bar + '"/></svg>',
    '</div>',
    '<div style="display:flex;flex-direction:column;gap:8px;min-width:0;flex:1">',
    '<div style="font-size:12px;font-weight:700;line-height:18px;letter-spacing:-0.2px;color:' + d.color + '">' + esc(d.title) + '</div>',
    '<div style="display:flex;flex-direction:column;gap:4px;width:100%">',
    '<div style="display:flex;align-items:center;gap:8px;height:12px;width:100%">',
    '<div style="flex:1;height:12px;border-radius:1000px;background:rgba(20,20,20,0.06);overflow:hidden;position:relative;min-width:0">',
    '<div style="position:absolute;left:0;top:0;height:12px;border-radius:1000px;overflow:hidden;background:' + d.bar + ';width:' + d.pct + '%">',
    '<span style="position:absolute;left:6px;top:-1.5px;font-size:10px;font-weight:700;line-height:15px;letter-spacing:0.4px;text-transform:uppercase;color:#fff;white-space:nowrap">' + d.value + '</span>',
    '</div>',
    '</div>',
    '<div style="font-size:10px;font-weight:700;line-height:15px;letter-spacing:0.4px;text-transform:uppercase;white-space:nowrap;flex-shrink:0;color:#0f172a">' + d.total + '</div>',
    '</div>',
    '<div style="font-size:11px;font-weight:500;line-height:16px;letter-spacing:-0.25px;color:#6f829b">' + esc(d.caption) + '</div>',
    '</div>',
    '</div>',
    '</div>'
  ];
  return items.join('\n');
}

const listItems = items.map(buildItemHtml).join('\n');
const html = '<div style="border:1px solid rgba(20,20,20,0.09);border-radius:12px;overflow:hidden;background:#fff">\n' + listItems + '\n</div>';

data.chartBoard.forEach(s => s.items.forEach(i => {
  if (i.id === 'b_disburse') {
    delete i.chartPath;
    i.extraComponent = {
      type: 'card-html',
      config: {
        html: html,
        backgroundClassName: '',
        borderClassName: ''
      }
    };
  }
}));

fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
console.log('Updated b_disburse to grouped-list card-html');

const fs = require('fs');
const path = require('path');

const files = [
  'D:/Project/VNA/Git/mock-api/apiV5/domain/bod-strategic-dashboards/operation/2026/07/chart/b_otp_di.json',
  'D:/Project/VNA/Git/mock-api/apiV5/domain/bod-strategic-dashboards/operation/2026/07/chart/b_otp_den.json',
  'D:/Project/VNA/Git/mock-api/apiV5/domain/bod-strategic-dashboards/operation/2026/07/chart/b_osp_di.json',
  'D:/Project/VNA/Git/mock-api/apiV5/domain/bod-strategic-dashboards/operation/2026/07/chart/b_osp_den.json',
];

const ROOT = 'D:/Project/VNA/Git/mock-api/apiV5';

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(fullPath);
  }
}

// Only process the 4 BOD files + any remaining files with old labels
files.forEach(filePath => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    let text = raw;
    let changed = false;

    // Check for any old patterns
    const hasOld = text.includes('Thực hiện 2026') || text.includes('ước thực hiện') || text.includes('Cùng kỳ 2025') || text.includes('Mục tiêu 2026');
    if (!hasOld) return;

    // Parse JSON to remove ước thực hiện columns
    if (text.includes('ước thực hiện') || text.includes('uth') || text.includes('"label": "Ư')) {
      const data = JSON.parse(text);
      if (data.autoChart && data.autoChart.dataset && Array.isArray(data.autoChart.dataset.columns)) {
        const ds = data.autoChart.dataset;
        const removeIdxs = ds.columns
          .map((col, i) => ({ col, i }))
          .filter(({ col }) => {
            const label = (col.label || '').toLowerCase();
            const id = (col.id || '').toLowerCase();
            return label.includes('ước thực') || id === 'uth' || id.startsWith('uth_');
          })
          .map(({ i }) => i)
          .sort((a, b) => b - a);

        if (removeIdxs.length > 0) {
          removeIdxs.forEach(i => ds.columns.splice(i, 1));
          if (Array.isArray(ds.rows)) {
            ds.rows = ds.rows.map(row => {
              const newRow = [...row];
              removeIdxs.forEach(i => newRow.splice(i, 1));
              return newRow;
            });
          }
          if (Array.isArray(data.autoChart.views)) {
            data.autoChart.views.forEach(view => {
              if (Array.isArray(view.series)) {
                view.series = view.series.filter(s => {
                  const field = (s.field || '').toLowerCase();
                  return field !== 'uth' && !field.startsWith('uth_');
                });
              }
            });
          }
          text = JSON.stringify(data, null, 2);
          changed = true;
        }
      }
    }

    // Simple label renames (safe now since ước columns removed)
    if (text.includes('Thực hiện')) {
      text = text.replace(/"label": "Thực hiện 2026/g, '"label": "2026');
      changed = true;
    }
    if (text.includes('Cùng kỳ')) {
      text = text.replace(/"label": "Cùng kỳ 2025/g, '"label": "2025');
      changed = true;
    }
    if (text.includes('Mục tiêu 2026')) {
      text = text.replace(/"label": "Mục tiêu 2026/g, '"label": "MT 2026');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, text, 'utf8');
      console.log('Updated: ' + path.relative(ROOT, filePath));
    }
  } catch (e) {
    console.error('Error processing ' + filePath + ': ' + e.message);
  }
});

console.log('Done');

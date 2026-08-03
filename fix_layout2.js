const fs = require('fs');
const p = 'D:/Project/VNA/Git/mock-api/apiV5/domain/bod-strategic-dashboards/operation/2026/07/index.json';
const text = fs.readFileSync(p, 'utf8');

const idx = text.indexOf('b_delay_heatmap');
const s = text.lastIndexOf('{', idx);
const s1 = text.lastIndexOf('{', s - 1);

const marker = 'timeFrameHiddenModes';
const e = text.indexOf(marker);
const e2 = text.lastIndexOf(']', e - 1);

console.log('section1Start at char:', s1);
console.log('section2End at char:', e2);

const before = text.substring(0, s1);
const after = text.substring(e2 + 1);

const merged = `    {
      "title": "",
      "items": [
        {
          "id": "b_delay_heatmap",
          "title": "Số chuyến bay chậm theo mức độ và mạng bay",
          "col": 1,
          "colSpan": 20,
          "subTitle": "Đơn vị: chuyến",
          "chartPath": "apiV5/domain/bod-strategic-dashboards/operation/2026/07/chart/b_delay_heatmap.json",
          "aiInsight": {
            "text": "Nội địa ghi nhận 1.133 chuyến bay chậm, gấp đôi quốc tế (578 chuyến).",
            "severity": "warn",
            "status": 1
          }
        },
        {
          "id": "b_otp_reasons",
          "title": "Nguyên nhân giảm chỉ số OTP",
          "col": 21,
          "colSpan": 20,
          "subTitle": "Đơn vị: %",
          "chartPath": "apiV5/domain/bod-strategic-dashboards/operation/2026/07/chart/b_otp_reasons.json",
          "aiInsight": {
            "text": "Nguyên nhân tại sân bay (tổng 7,3%) và nguyên nhân trên đường bay (tổng 5,8%) là 2 yếu tố ảnh hưởng lớn nhất đến OTP.",
            "severity": "warn",
            "status": 1
          }
        },
        {
          "id": "b_top_otp_high",
          "title": "Top 5 sân bay OTP cao nhất",
          "col": 41,
          "colSpan": 20,
          "row": 1,
          "subTitle": "Đơn vị: %",
          "chartPath": "apiV5/domain/bod-strategic-dashboards/operation/2026/07/chart/b_top_otp_high.json",
          "aiInsight": {
            "text": "SGN dẫn đầu với OTP 98%, vượt trội so với các sân bay còn lại.",
            "severity": "good",
            "status": 1
          }
        },
        {
          "id": "b_top_otp_low",
          "title": "Top 5 sân bay OTP thấp nhất",
          "col": 41,
          "colSpan": 20,
          "row": 2,
          "subTitle": "Đơn vị: %",
          "chartPath": "apiV5/domain/bod-strategic-dashboards/operation/2026/07/chart/b_top_otp_low.json",
          "aiInsight": {
            "text": "VDO có OTP thấp nhất 68%, cần cải thiện quy trình khai thác.",
            "severity": "warn",
            "status": 1
          }
        }
      ]
    }`;

const result = before + merged + after;
fs.writeFileSync(p, result, 'utf8');
console.log('Done');

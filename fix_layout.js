const fs = require('fs');
const p = 'D:/Project/VNA/Git/mock-api/apiV5/domain/bod-strategic-dashboards/operation/2026/07/index.json';
let text = fs.readFileSync(p, 'utf8');

// Remove rightTitle "%" lines
text = text.replace(/\s+\"rightTitle\": \"%\"/g, '');

// Find the delay/otp section and top5 section, replace with merged
const old1 = text.indexOf('"id": "b_delay_heatmap"');
const sectionStart = text.lastIndexOf('{', old1);
const section1Start = text.lastIndexOf('{', sectionStart - 1);
// Find the end of the top5 section
const section2End = text.indexOf('],\n  "timeFrameHiddenModes"');

if (section1Start >= 0 && section2End >= 0) {
  const before = text.substring(0, section1Start);
  const after = text.substring(section2End);
  
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

  text = before + merged + after;
  fs.writeFileSync(p, text, 'utf8');
  console.log('Done - sections merged into 1/3 layout');
}

/**
 * generateTreemapGradient(baseHex, count)
 *
 * Nhận vào màu hex của ô lớn nhất (base),
 * trả về mảng `count` màu từ đậm (base) → nhạt dần bằng cách tăng Lightness (HSL).
 * Hue và Saturation giữ nguyên.
 */

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * @param {string} baseHex  Màu gốc dạng "#0f6176"
 * @param {number} count    Số lượng màu cần tạo (≥ 1)
 * @returns {string[]}      Mảng màu hex từ đậm → nhạt dần
 */
function generateTreemapGradient(baseHex, count) {
  if (count <= 0) return []
  if (count === 1) return [baseHex]

  const hsl = hexToHsl(baseHex)
  const maxL = 80 // giới hạn lightness tối đa để màu cuối không bị trắng
  const minL = hsl.l
  const step = (maxL - minL) / (count - 1)

  return Array.from({ length: count }, (_, i) =>
    hslToHex(hsl.h, hsl.s, Math.round(minL + step * i))
  )
}

// ---------------------------------------------------------------------------
// Xử lý dataset: điền màu gradient cho các item con trong treemap
// ---------------------------------------------------------------------------

/**
 * fillTreemapColors(rows, tokenToHex)
 *
 * @param {Array} rows        Mảng rows từ dataset.columns — mỗi row [name, value, parent, color]
 * @param {Object} tokenToHex Map token → hex, vd { 'data.deep-teal': '#1D4857', ... }
 * @returns {Array}           rows mới với color đã được điền đầy đủ (hex)
 */
function fillTreemapColors(rows, tokenToHex) {
  const rowsCopy = rows.map(r => [...r])

  // Gom item theo parent
  const byParent = {}
  for (const row of rowsCopy) {
    const parent = row[2] || '__root__'
    if (!byParent[parent]) byParent[parent] = []
    byParent[parent].push(row)
  }

  for (const [parent, children] of Object.entries(byParent)) {
    if (parent === '__root__') continue

    // Lấy base color từ item có value lớn nhất trong nhánh
    const sorted = [...children].sort((a, b) => b[1] - a[1])
    const baseToken = sorted[0][3]
    if (!baseToken) continue // không có base color → bỏ qua

    const baseHex = tokenToHex[baseToken]
    if (!baseHex) continue

    // Tạo gradient cho các item con (chỉ item thực, không tính parent aggregator)
    // Chỉ xử lý các item con có cùng parent, không bao gồm chính parent
    const childItems = children.filter(c => c[2] === parent)

    if (childItems.length <= 1) continue

    // Sắp xếp con theo value giảm dần
    childItems.sort((a, b) => b[1] - a[1])

    const gradient = generateTreemapGradient(baseHex, childItems.length)

    // Gán màu — mỗi item con lấy một màu trong gradient
    // Item lớn nhất giữ màu gốc, các item nhỏ hơn nhận màu nhạt dần
    for (let i = 0; i < childItems.length; i++) {
      childItems[i][3] = gradient[i]
    }
  }

  // Xử lý đặc biệt: các parent aggregator (kiểu "Nhóm ngành") lấy màu đậm nhất
  // của nhánh con nếu chúng có color trống
  for (const row of rowsCopy) {
    const parent = row[2] || '__root__'
    if (parent !== '' && parent !== '__root__') {
      const children = byParent[row[0]]
      if (children && children.length > 0 && !row[3]) {
        // là parent aggregator — lấy màu đậm nhất từ con
        const childColors = children
          .filter(c => c[1] > 0 && c[3])
          .sort((a, b) => b[1] - a[1])
        if (childColors.length > 0) {
          row[3] = childColors[0][3]
        }
      }
    }
  }

  return rowsCopy
}

module.exports = { generateTreemapGradient, fillTreemapColors, hexToHsl, hslToHex }

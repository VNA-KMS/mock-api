/**
 * Duplicate Commerce II month `index.json` -> day `index.json` (mock).
 *
 * Fix for 404 when FE calls:
 *   .../commerce-ii/2026/MM/DD/index.json   (mode `day`)
 *
 * Current mock-api typically has only:
 *   .../commerce-ii/2026/MM/index.json      (mode `month`)
 *
 * Implementation (lightweight):
 * - Copy `index.json` files only.
 * - Do NOT copy chart files; keep `chartPath` references pointing to month charts.
 *
 * Scope:
 * - Root overview: month 07 + 08
 * - passenger/vn + cargo/vn: month 08 (only if source dirs exist)
 */

'use strict'

const fs = require('fs')
const path = require('path')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

function safeWriteJson(filePath, obj) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8')
}

function main() {
  const BASE = path.join(__dirname, '..', 'apiV5', 'domain', 'ceo-command-center', 'commerce-ii', '2026')

  const months = [
    { mm: '07', days: 31 },
    { mm: '08', days: 31 },
  ]

  const rootSub = []
  // Root only for all months, passenger/cargo only for months where source exists.
  const passengerSub = ['passenger', 'vn']
  const cargoSub = ['cargo', 'vn']

  for (const { mm, days } of months) {
    const srcMonthRoot = path.join(BASE, mm, 'index.json')
    const monthRootJson = safeReadJson(srcMonthRoot)
    if (!monthRootJson) {
      console.warn(`[month->day-index] Missing root month source: ${srcMonthRoot}`)
      continue
    }

    for (let dd = 1; dd <= days; dd++) {
      const dd2 = String(dd).padStart(2, '0')
      const dstDayRoot = path.join(BASE, mm, dd2, 'index.json')
      safeWriteJson(dstDayRoot, monthRootJson)
    }

    // passenger/cargo only for month 08 (if exists)
    const srcPassenger = path.join(BASE, mm, ...passengerSub, 'index.json')
    const monthPassengerJson = safeReadJson(srcPassenger)
    if (monthPassengerJson) {
      for (let dd = 1; dd <= days; dd++) {
        const dd2 = String(dd).padStart(2, '0')
        const dstDayPassenger = path.join(BASE, mm, dd2, ...passengerSub, 'index.json')
        safeWriteJson(dstDayPassenger, monthPassengerJson)
      }
    }

    const srcCargo = path.join(BASE, mm, ...cargoSub, 'index.json')
    const monthCargoJson = safeReadJson(srcCargo)
    if (monthCargoJson) {
      for (let dd = 1; dd <= days; dd++) {
        const dd2 = String(dd).padStart(2, '0')
        const dstDayCargo = path.join(BASE, mm, dd2, ...cargoSub, 'index.json')
        safeWriteJson(dstDayCargo, monthCargoJson)
      }
    }
  }

  console.log('[month->day-index] Done')
}

main()


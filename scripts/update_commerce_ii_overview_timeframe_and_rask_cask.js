/**
 * Update Commerce II mock-api overview timeFrameModes only.
 *
 * NOTE: Removing chart `b_scatter_rask_cask` applies to DAY data only.
 * Do NOT remove it from month/week indexes. Day indexes are maintained
 * separately (see day `.../MM/DD/index.json`).
 *
 * This script only:
 * 1) Remove `year` from `timeFrameModes` (keep `week`).
 *
 * Scope: root overview `commerce/.../index.json` for 07/08/W31/W32.
 */

'use strict'

const fs = require('fs')
const path = require('path')

function removeScatterFromChartBoard(chartBoardSections) {
  if (!Array.isArray(chartBoardSections)) return
  for (const section of chartBoardSections) {
    if (!section || !Array.isArray(section.items)) continue
    section.items = section.items.filter((it) => it?.id !== 'b_scatter_rask_cask')
  }
}

function ensureYearHidden(root) {
  root.timeFrameHiddenModes = Array.isArray(root.timeFrameHiddenModes)
    ? root.timeFrameHiddenModes
    : []
  if (!root.timeFrameHiddenModes.includes('year')) {
    root.timeFrameHiddenModes.push('year')
  }
}

function main() {
  const BASE = path.join(__dirname, '..', 'apiV5', 'domain', 'ceo-command-center', 'commerce', '2026')

  const indexFiles = [
    path.join(BASE, '07', 'index.json'),
    path.join(BASE, '08', 'index.json'),
    path.join(BASE, 'W31', 'index.json'),
    path.join(BASE, 'W32', 'index.json'),
  ]

  for (const indexPath of indexFiles) {
    const raw = fs.readFileSync(indexPath, 'utf-8')
    const json = JSON.parse(raw)

    if (Array.isArray(json.timeFrameModes)) {
      json.timeFrameModes = json.timeFrameModes.filter((m) => m !== 'year')
      if (!json.timeFrameModes.includes('week')) {
        json.timeFrameModes.push('week')
      }
    }
    ensureYearHidden(json)

    // Intentionally do NOT remove b_scatter_rask_cask from month/week.
    // Day-only removal is handled on .../MM/DD/index.json separately.

    fs.writeFileSync(indexPath, JSON.stringify(json, null, 2), 'utf-8')
    console.log(`[update-commerce-overview] Updated: ${indexPath}`)
  }

  console.log('[update-commerce-overview] Done')
}

main()


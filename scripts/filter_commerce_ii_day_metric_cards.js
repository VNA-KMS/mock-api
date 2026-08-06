/**
 * For Commerce II root overview day data (YYYY/MM/DD/index.json):
 * Keep only specific metric cards.
 *
 * Requirement:
 * - PAX, LF, PAX REV, Doanh thu VTHK, P&L, P&L VAR
 *
 * These correspond to metricCards.item.id:
 * - pax
 * - lf
 * - dt_pax
 * - dt_vthk
 * - hq_vthk
 * - hq_so_cpbd
 *
 * Scope:
 * - ONLY root `commerce/.../<MM>/<DD>/index.json`
 * - Do NOT touch passenger/cargo day indices.
 */

'use strict'

const fs = require('fs')
const path = require('path')

const ALLOWED_IDS = new Set(['pax', 'lf', 'dt_pax', 'dt_vthk', 'hq_vthk', 'hq_so_cpbd'])

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function filterMetricCards(json) {
  if (!json?.metricCards?.items) return 0
  const before = json.metricCards.items.length
  json.metricCards.items = json.metricCards.items.filter((it) => it && ALLOWED_IDS.has(it.id))
  const after = json.metricCards.items.length
  return before - after
}

function main() {
  const BASE = path.join(__dirname, '..', 'apiV5', 'domain', 'ceo-command-center', 'commerce', '2026')

  const months = ['07', '08']
  const days = 31

  let changedFiles = 0
  let removedCount = 0

  for (const mm of months) {
    for (let dd = 1; dd <= days; dd++) {
      const dd2 = String(dd).padStart(2, '0')
      const indexPath = path.join(BASE, mm, dd2, 'index.json')
      if (!fs.existsSync(indexPath)) continue

      const raw = fs.readFileSync(indexPath, 'utf-8')
      const json = JSON.parse(raw)

      const removed = filterMetricCards(json)
      if (removed > 0) {
        fs.writeFileSync(indexPath, JSON.stringify(json, null, 2), 'utf-8')
        changedFiles++
        removedCount += removed
      }
    }
  }

  console.log(`[filter-day-metric-cards] Changed files: ${changedFiles}, removed items: ${removedCount}`)
}

main()


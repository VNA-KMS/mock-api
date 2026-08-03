/**
 * regenerate_month_data.js
 *
 * Regenerates monthly chart data for Commerce II by:
 * 1. Copying chart files from W32 to the target month directory
 * 2. Running the transformation script (gen_commerce_ii_month_charts.js)
 * 3. Copying W32/index.json to the target month
 * 4. Updating all chart paths from W32 to the target month
 * 5. Adding CASK and CASK NON FUEL metric cards to the default metricCards only
 *
 * Usage: node regenerate_month_data.js <month>
 *   e.g. node regenerate_month_data.js 07
 *        node regenerate_month_data.js 08
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TARGET_MONTH = process.argv[2];
if (!TARGET_MONTH || !/^\d{2}$/.test(TARGET_MONTH)) {
  console.error('Usage: node regenerate_month_data.js <month> (e.g. 07, 08)');
  process.exit(1);
}

// ── Paths ──────────────────────────────────────────────────────────────────────

const BASE_DIR = path.join(__dirname, '..', 'apiV5', 'domain', 'ceo-command-center', 'commerce-ii', '2026');
const W32_DIR = path.join(BASE_DIR, 'W32');
const W32_CHART_DIR = path.join(W32_DIR, 'chart');
const W32_INDEX = path.join(W32_DIR, 'index.json');

const TARGET_DIR = path.join(BASE_DIR, TARGET_MONTH);
const TARGET_CHART_DIR = path.join(TARGET_DIR, 'chart');
const TARGET_INDEX = path.join(TARGET_DIR, 'index.json');

const TRANSFORM_SCRIPT = path.join(__dirname, 'gen_commerce_ii_month_charts.js');

// ── CASK and CASK NON FUEL card definitions ────────────────────────────────────

const CASK_CARD = {
  "id": "cask",
  "borderColor": "#005f6e",
  "status": "compact",
  "title": "CASK",
  "value": "2.850",
  "unit": "VND/ghế.km",
  "backgroundStatus": 2,
  "trend": [
    {
      "direction": "flat",
      "label": "97,2% với KH",
      "type": "plan",
      "value": "97,2%",
      "status": 0,
      "tone": "negative"
    },
    {
      "direction": "up",
      "label": "3,5% với CK",
      "type": "samePeriod",
      "value": "3,5%",
      "tone": "positive"
    }
  ],
  "colorTokens": {
    "visualization": "semantic.positive"
  }
};

const CASK_NON_FUEL_CARD = {
  "id": "cask_non_fuel",
  "borderColor": "#005f6e",
  "status": "compact",
  "title": "CASK NON FUEL",
  "value": "1.920",
  "unit": "VND/ghế.km",
  "backgroundStatus": 2,
  "trend": [
    {
      "direction": "flat",
      "label": "98,1% với KH",
      "type": "plan",
      "value": "98,1%",
      "status": 0,
      "tone": "negative"
    },
    {
      "direction": "up",
      "label": "2,8% với CK",
      "type": "samePeriod",
      "value": "2,8%",
      "tone": "positive"
    }
  ],
  "colorTokens": {
    "visualization": "semantic.positive"
  }
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function log(step, msg) {
  console.log(`[${TARGET_MONTH}] ${step}: ${msg}`);
}

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', ...opts });
    return true;
  } catch (e) {
    console.error(`Command failed: ${cmd}`);
    console.error(e.message);
    return false;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log(`Regenerating month data for Commerce II — ${TARGET_MONTH}`);
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Ensure target chart directory exists
  if (!fs.existsSync(TARGET_CHART_DIR)) {
    fs.mkdirSync(TARGET_CHART_DIR, { recursive: true });
    log('STEP 1', `Created chart directory: ${TARGET_CHART_DIR}`);
  } else {
    log('STEP 1', `Chart directory exists: ${TARGET_CHART_DIR}`);
  }

  // Step 2: Copy chart files from W32 to target
  log('STEP 2', 'Copying chart files from W32...');
  const chartFiles = fs.readdirSync(W32_CHART_DIR).filter(f => f.endsWith('.json'));
  for (const file of chartFiles) {
    fs.copyFileSync(path.join(W32_CHART_DIR, file), path.join(TARGET_CHART_DIR, file));
  }
  log('STEP 2', `Copied ${chartFiles.length} chart files`);

  // Step 3: Run the transformation script
  log('STEP 3', 'Running gen_commerce_ii_month_charts.js...');
  const transformOk = run(`node "${TRANSFORM_SCRIPT}" ${TARGET_MONTH}`);
  if (!transformOk) {
    console.error('Transformation script failed. Aborting.');
    process.exit(1);
  }
  log('STEP 3', 'Transformation complete');

  // Step 4: Copy W32/index.json to target
  log('STEP 4', 'Copying W32/index.json...');
  fs.copyFileSync(W32_INDEX, TARGET_INDEX);
  log('STEP 4', 'Copied index.json');

  // Step 5: Update chart paths in index.json
  log('STEP 5', 'Updating chart paths from W32 to target month...');
  let indexContent = fs.readFileSync(TARGET_INDEX, 'utf-8');
  const oldPath = '/2026/W32/';
  const newPath = `/2026/${TARGET_MONTH}/`;
  const replaceCount = (indexContent.match(new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  indexContent = indexContent.split(oldPath).join(newPath);
  fs.writeFileSync(TARGET_INDEX, indexContent, 'utf-8');
  log('STEP 5', `Replaced ${replaceCount} path references`);

  // Step 6: Parse index.json for further modifications
  const indexData = JSON.parse(indexContent);

  // Step 7: Update metric card values from weekly to monthly
  log('STEP 7', 'Updating metric card values from weekly to monthly...');
  function updateMetricCardValues(data) {
    // Update top-level metricCards
    if (data.metricCards?.items) {
      for (const item of data.metricCards.items) {
        updateCardValue(item);
      }
    }
    // Update metricCards inside contentFilter network overrides
    if (data.contentFilter?.network) {
      for (const [networkKey, networkVal] of Object.entries(data.contentFilter.network)) {
        if (networkVal.metricCards?.items) {
          for (const item of networkVal.metricCards.items) {
            updateCardValue(item);
          }
        }
      }
    }
  }

  function updateCardValue(item) {
    // Skip percentage values and rates
    if (item.unit === '%' || item.unit === 'giờ/ngày' || item.unit === 'VND/ghế.km') return;
    const val = parseFloat(String(item.value).replace(/[.,\s]/g, ''));
    if (!isNaN(val)) {
      // Multiply by ~4 for monthly (from weekly)
      item.value = String(Math.round(val * 4));
    }
  }
  updateMetricCardValues(indexData);
  log('STEP 7', 'Updated metric card values');

  // Step 8: Add CASK and CASK NON FUEL to default metricCards only
  log('STEP 8', 'Adding CASK and CASK NON FUEL to default metricCards...');

  // Find the default metricCards (top-level, not inside contentFilter or network)
  if (indexData.metricCards && indexData.metricCards.items) {
    // Check if cask already exists
    const hasCask = indexData.metricCards.items.some(i => i.id === 'cask');
    const hasCaskNonFuel = indexData.metricCards.items.some(i => i.id === 'cask_non_fuel');

    if (!hasCask) {
      indexData.metricCards.items.push(CASK_CARD);
      log('STEP 8', 'Added CASK card');
    } else {
      log('STEP 8', 'CASK card already exists, skipping');
    }

    if (!hasCaskNonFuel) {
      indexData.metricCards.items.push(CASK_NON_FUEL_CARD);
      log('STEP 8', 'Added CASK NON FUEL card');
    } else {
      log('STEP 8', 'CASK NON FUEL card already exists, skipping');
    }

    fs.writeFileSync(TARGET_INDEX, JSON.stringify(indexData, null, 2), 'utf-8');
    log('STEP 8', 'Updated index.json with new metric cards');
  } else {
    log('STEP 8', 'WARNING: No default metricCards found in index.json');
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('');
  console.log('─'.repeat(60));
  console.log(`Done! Month ${TARGET_MONTH} data regenerated.`);
  console.log(`  Chart files: ${TARGET_CHART_DIR}`);
  console.log(`  Index file:  ${TARGET_INDEX}`);
  console.log('─'.repeat(60));
}

main();

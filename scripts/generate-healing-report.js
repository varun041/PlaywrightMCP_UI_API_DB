/**
 * If reports/healing-report.md exists (written after a playwright-test-healer run), injects it as a
 * synthetic Allure result entry ("AI Healing Report") alongside the "AI Run Summary" entry produced
 * by generate-run-summary.js, so the before/after diagnosis is visible inside the report itself
 * rather than a separate file. No-ops (and clears any stale prior entry) when no healing-report.md
 * exists, so ordinary runs that never involved healing don't carry a leftover entry forward.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RESULTS_DIR = path.join(__dirname, '..', 'reports', 'allure-results');
const HEALING_MD_PATH = path.join(__dirname, '..', 'reports', 'healing-report.md');
const HEALING_TAG = 'ai-healing-report';

function purgeOldHealingEntries() {
  if (!fs.existsSync(RESULTS_DIR)) return;
  for (const file of fs.readdirSync(RESULTS_DIR)) {
    if (!file.endsWith('-result.json')) continue;
    const fullPath = path.join(RESULTS_DIR, file);
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const isHealingEntry = (data.labels || []).some((l) => l.name === 'tag' && l.value === HEALING_TAG);
    if (isHealingEntry) fs.unlinkSync(fullPath);
  }
}

function writeHealingResult(markdown) {
  const nowMs = Date.now();
  const result = {
    uuid: crypto.randomUUID(),
    historyId: 'ai-healing-report',
    name: 'AI Healing Report',
    fullName: 'AI Healing Report',
    status: 'passed',
    stage: 'finished',
    description: markdown,
    labels: [
      { name: 'suite', value: 'Meta' },
      { name: 'parentSuite', value: 'Meta' },
      { name: 'subSuite', value: 'AI Healing Report' },
      { name: 'severity', value: 'normal' },
      { name: 'tag', value: HEALING_TAG },
    ],
    start: nowMs,
    stop: nowMs,
  };
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, `${result.uuid}-result.json`), JSON.stringify(result, null, 2));
}

function main() {
  purgeOldHealingEntries();

  if (!fs.existsSync(HEALING_MD_PATH)) {
    console.log('[generate-healing-report] No reports/healing-report.md found — skipping (no healing event this run).');
    return;
  }

  const markdown = fs.readFileSync(HEALING_MD_PATH, 'utf8');
  writeHealingResult(markdown);
  console.log('[generate-healing-report] Attached AI Healing Report to Allure results.');
}

main();

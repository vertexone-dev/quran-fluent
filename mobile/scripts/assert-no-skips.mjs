#!/usr/bin/env node
/**
 * Fail-closed test-result check (QR-DESIGN-006).
 *
 * Usage: node scripts/assert-no-skips.mjs <vitest|playwright> <report.json>
 *
 * A green test run is not enough for a release: a silently skipped test (a
 * describe.skipIf on a missing database, test.skip, a filtered file...) looks
 * green. This reads the JSON report and exits 1 unless at least one test ran,
 * none failed, and none was skipped, pending or todo.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Pure: returns the list of problems (empty = OK). */
export function check(kind, report) {
  let total, passed, failed, skipped;
  if (kind === "vitest") {
    total = report.numTotalTests;
    passed = report.numPassedTests;
    failed = report.numFailedTests + (report.numFailedTestSuites ?? 0);
    skipped = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);
  } else if (kind === "playwright") {
    const s = report.stats ?? {};
    passed = (s.expected ?? 0) + (s.flaky ?? 0);
    failed = s.unexpected ?? 0;
    skipped = s.skipped ?? 0;
    total = passed + failed + skipped;
  } else {
    return [`unknown report kind '${kind}'`];
  }
  const problems = [];
  if (![total, passed, failed, skipped].every(Number.isFinite))
    problems.push("report is missing counts");
  else {
    if (total === 0 || passed === 0) problems.push("no test ran");
    if (failed > 0) problems.push(`${failed} failed`);
    if (skipped > 0)
      problems.push(`${skipped} skipped/pending/todo (a release must run every test)`);
  }
  return problems;
}

function main() {
  const [kind, file] = process.argv.slice(2);
  if (!kind || !file) {
    console.error("usage: assert-no-skips.mjs <vitest|playwright> <report.json>");
    process.exit(2);
  }
  let report;
  try {
    report = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`assert-no-skips: cannot read ${file}: ${e.message}`);
    process.exit(1);
  }
  const problems = check(kind, report);
  if (problems.length) {
    console.error(`assert-no-skips (${kind}): FAILED`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`assert-no-skips (${kind}): OK`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

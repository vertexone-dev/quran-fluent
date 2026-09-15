#!/usr/bin/env node
// Read-only, live post-deployment security-header validator. Confirms the
// four baseline security headers enforced in src/server.ts's
// withSecurityHeaders (commit a61f566) are actually present, with the
// exact required values, on real responses from the deployed production
// Worker -- not just verified in code review. Checks '/', '/quran',
// '/learn' (HTML/SSR success responses) and one deliberately nonexistent
// route (HTML 404), the exact case that had no headers before that commit.
//
// Never sends any credential, never reads a cookie or Authorization
// header, never prints anything but route names, header names, and the
// header/status values themselves -- that is the full contract for what
// this script's output may contain.
//
// Usage: node scripts/validate-production-headers.mjs
// Env: PRODUCTION_BASE_URL (defaults to the known production origin).
//
// Exit code 0 = every check passed. Exit code 1 = at least one failed.
// Never modifies any row, any header, or any deployment.

import {
  checkRouteResponse,
  formatCheckLine,
  ROUTES,
} from "./lib/production-header-validation.mjs";

const BASE_URL = process.env.PRODUCTION_BASE_URL ?? "https://quranroots.vertexone.workers.dev";

console.log("Production security-header validation");
console.log(`Base URL: ${BASE_URL}\n`);

let failures = 0;

for (const route of ROUTES) {
  const url = new URL(route.path, BASE_URL).toString();
  let response;
  try {
    response = await fetch(url, { redirect: "follow" });
  } catch (error) {
    console.log(
      `  FAIL  ${route.path} -- request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    failures++;
    continue;
  }

  const finalHost = new URL(response.url).host;
  const checks = checkRouteResponse(route, {
    status: response.status,
    finalHost,
    headers: response.headers,
  });

  for (const check of checks) {
    console.log(formatCheckLine(route, check));
    if (!check.ok) failures++;
  }
  console.log("");
}

if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log("All security-header checks passed.");

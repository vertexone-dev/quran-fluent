// Pure, testable core of the live post-deployment security-header
// validator (scripts/validate-production-headers.mjs). Kept separate from
// that script's network/CLI shell so the assertion logic itself is
// unit-tested (scripts/lib/production-header-validation.test.ts) without a
// real fetch, matching the scripts/lib/*.mjs + *.test.ts pattern already
// established by content-source-governance.mjs.
//
// Mirrors the four headers enforced in src/server.ts's withSecurityHeaders
// (commit a61f566) -- keep both in sync if either changes.

export const REQUIRED_HEADERS = Object.freeze({
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=(), payment=()",
});

// The final origin every checked response must resolve to, even after
// following redirects -- guards against a misconfigured PRODUCTION_BASE_URL
// silently validating the wrong deployment.
export const EXPECTED_ORIGIN = "quranroots.vertexone.workers.dev";

export const ROUTES = Object.freeze([
  Object.freeze({ path: "/", expectedStatus: 200 }),
  Object.freeze({ path: "/quran", expectedStatus: 200 }),
  Object.freeze({ path: "/learn", expectedStatus: 200 }),
  // Deliberately nonexistent -- exercises the HTML 404 path, which is the
  // exact case that was missing headers before commit a61f566.
  Object.freeze({
    path: "/production-header-validation-nonexistent-route",
    expectedStatus: 404,
  }),
]);

// Checks one already-fetched response's safe-to-print facts (status, final
// host, headers) against one route's expectations. Takes plain data rather
// than a real Response so this stays testable with synthetic fixtures and
// never has to touch a network call, a cookie, or an Authorization header.
// `headers` only needs a `.get(name)` method (a real Headers object, a Map,
// or a plain object with that shape all work).
export function checkRouteResponse(route, { status, finalHost, headers }) {
  const checks = [];

  checks.push({
    label: "final origin",
    ok: finalHost === EXPECTED_ORIGIN,
    expected: EXPECTED_ORIGIN,
    actual: finalHost,
  });

  checks.push({
    label: "status",
    ok: status === route.expectedStatus,
    expected: String(route.expectedStatus),
    actual: String(status),
  });

  for (const [name, expectedValue] of Object.entries(REQUIRED_HEADERS)) {
    const actual = headers.get(name);
    checks.push({
      label: name,
      ok: actual === expectedValue,
      expected: expectedValue,
      actual: actual ?? "(missing)",
    });
  }

  return checks;
}

// Only ever prints route.path, check.label, and the header/status values
// themselves (never a cookie, Authorization header, token or any other
// secret -- those are never read by checkRouteResponse in the first place).
export function formatCheckLine(route, check) {
  const status = check.ok ? "PASS" : "FAIL";
  const suffix = check.ok ? "" : ` (expected: ${check.expected})`;
  return `  ${status}  ${route.path} -- ${check.label}: ${check.actual}${suffix}`;
}

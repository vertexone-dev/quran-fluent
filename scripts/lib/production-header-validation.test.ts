import { describe, expect, it } from "vitest";

import {
  checkRouteResponse,
  EXPECTED_ORIGIN,
  formatCheckLine,
  REQUIRED_HEADERS,
  ROUTES,
} from "./production-header-validation.mjs";

// Synthetic stand-in for the parts of a real fetch Response this module
// reads -- status, headers.get(name) -- so these tests never touch a
// network call, a cookie, or an Authorization header.
function fixtureHeaders(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = { ...REQUIRED_HEADERS, ...overrides };
  return { get: (name: string) => values[name] ?? null };
}

describe("checkRouteResponse", () => {
  const route = ROUTES[0]!; // "/", expectedStatus 200

  it("passes every check for a fully-correct response", () => {
    const checks = checkRouteResponse(route, {
      status: 200,
      finalHost: EXPECTED_ORIGIN,
      headers: fixtureHeaders(),
    });
    expect(checks.every((c) => c.ok)).toBe(true);
    // final origin + status + 4 required headers
    expect(checks).toHaveLength(6);
  });

  it("fails only the status check on a wrong status", () => {
    const checks = checkRouteResponse(route, {
      status: 500,
      finalHost: EXPECTED_ORIGIN,
      headers: fixtureHeaders(),
    });
    const statusCheck = checks.find((c) => c.label === "status")!;
    expect(statusCheck.ok).toBe(false);
    expect(statusCheck.actual).toBe("500");
    expect(statusCheck.expected).toBe("200");
    expect(checks.filter((c) => !c.ok)).toHaveLength(1);
  });

  it("fails the matching header check when a header is missing", () => {
    const checks = checkRouteResponse(route, {
      status: 200,
      finalHost: EXPECTED_ORIGIN,
      headers: fixtureHeaders({ "x-frame-options": undefined as unknown as string }),
    });
    const headerCheck = checks.find((c) => c.label === "x-frame-options")!;
    expect(headerCheck.ok).toBe(false);
    expect(headerCheck.actual).toBe("(missing)");
  });

  it("fails the matching header check when a header has the wrong value", () => {
    const checks = checkRouteResponse(route, {
      status: 200,
      finalHost: EXPECTED_ORIGIN,
      headers: fixtureHeaders({ "x-frame-options": "SAMEORIGIN" }),
    });
    const headerCheck = checks.find((c) => c.label === "x-frame-options")!;
    expect(headerCheck.ok).toBe(false);
    expect(headerCheck.actual).toBe("SAMEORIGIN");
    expect(headerCheck.expected).toBe("DENY");
  });

  it("fails the final-origin check when the response resolved to a different host", () => {
    const checks = checkRouteResponse(route, {
      status: 200,
      finalHost: "evil.example.com",
      headers: fixtureHeaders(),
    });
    const originCheck = checks.find((c) => c.label === "final origin")!;
    expect(originCheck.ok).toBe(false);
  });

  it("passes a correct 404 against the nonexistent-route fixture", () => {
    const notFoundRoute = ROUTES.find((r) => r.expectedStatus === 404)!;
    const checks = checkRouteResponse(notFoundRoute, {
      status: 404,
      finalHost: EXPECTED_ORIGIN,
      headers: fixtureHeaders(),
    });
    expect(checks.every((c) => c.ok)).toBe(true);
  });
});

describe("formatCheckLine", () => {
  const route = ROUTES[0]!;

  it("formats a passing check without an expected-value suffix", () => {
    const line = formatCheckLine(route, {
      label: "status",
      ok: true,
      expected: "200",
      actual: "200",
    });
    expect(line).toContain("PASS");
    expect(line).toContain(route.path);
    expect(line).not.toContain("expected:");
  });

  it("formats a failing check with the expected value", () => {
    const line = formatCheckLine(route, {
      label: "x-frame-options",
      ok: false,
      expected: "DENY",
      actual: "SAMEORIGIN",
    });
    expect(line).toContain("FAIL");
    expect(line).toContain("SAMEORIGIN");
    expect(line).toContain("expected: DENY");
  });
});

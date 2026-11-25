import { describe, expect, test } from "vitest";

import { withContentSecurityPolicy, withSecurityHeaders } from "./server";

// withSecurityHeaders is the single funnel every response the Worker's
// fetch handler can produce (success, normalized-catastrophic-SSR-error,
// hard-caught error) passes through before it leaves the Worker -- see the
// comment above it in server.ts for why this has to live here rather than
// in public/_headers. Tested as a pure function against synthetic Response
// objects: no TanStack Start server context, no network, no Supabase.
describe("withSecurityHeaders", () => {
  const REQUIRED_HEADERS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=(), microphone=(), camera=(), payment=()",
  };

  test("adds all four required headers with the exact required values", () => {
    const response = withSecurityHeaders(new Response("<html></html>"));
    for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  test("applies to a 404 response", () => {
    const response = withSecurityHeaders(new Response("not found", { status: 404 }));
    expect(response.status).toBe(404);
    for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  test("applies to a 500 error response", () => {
    const response = withSecurityHeaders(
      new Response("<html>error</html>", {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    expect(response.status).toBe(500);
    for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  test("preserves existing headers untouched (content-type, cache-control, Location)", () => {
    const original = new Response("redirecting", {
      status: 302,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        location: "/dashboard",
      },
    });
    const response = withSecurityHeaders(original);
    expect(response.status).toBe(302);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBe("/dashboard");
    for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  test("overwrites a conflicting pre-existing value for one of the four headers", () => {
    const original = new Response("<html></html>", {
      headers: { "x-frame-options": "SAMEORIGIN" },
    });
    const response = withSecurityHeaders(original);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  test("withSecurityHeaders alone does not add a CSP (that is withContentSecurityPolicy)", () => {
    const response = withSecurityHeaders(new Response("<html></html>"));
    expect(response.headers.get("content-security-policy")).toBeNull();
  });
});

describe("withContentSecurityPolicy", () => {
  test("sets the enforcing header and replaces any pre-existing CSP", () => {
    const original = new Response("x", {
      headers: { "content-security-policy": "default-src *", "content-type": "text/html" },
    });
    const response = withContentSecurityPolicy(original, "default-src 'none'");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'");
    expect(response.headers.get("content-security-policy-report-only")).toBeNull();
    expect(response.headers.get("content-type")).toBe("text/html");
  });

  test("report-only mode sets only the report-only header", () => {
    const response = withContentSecurityPolicy(new Response("x"), "default-src 'none'", true);
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("content-security-policy-report-only")).toBe("default-src 'none'");
  });

  test("keeps status and does not consume the body", async () => {
    const response = withContentSecurityPolicy(new Response("body", { status: 404 }), "x");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("body");
  });
});

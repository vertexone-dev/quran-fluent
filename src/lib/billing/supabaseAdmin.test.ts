import { afterEach, describe, expect, test, vi } from "vitest";

import { createServiceRoleFetch } from "./supabaseAdmin";

/**
 * Regression coverage for the production incident where GET
 * /api/billing/status 500'd with "Invalid API key" on every request, even
 * though SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY were both present and
 * correct in the Cloudflare Worker's bindings.
 *
 * Root cause: supabase-js's default fetch always sends `Authorization:
 * Bearer <serviceRoleKey>` alongside `apikey: <serviceRoleKey>` (confirmed
 * in node_modules/@supabase/supabase-js -- getAccessToken() falls back to
 * the client's own key when there's no session). For a legacy JWT-format
 * service-role key that's correct and expected. For a new-format opaque
 * key (sb_secret_...), Supabase's gateway tries to verify that
 * Authorization value as a JWT, fails, and rejects the whole request with
 * "Invalid API key" before the apikey header is ever consulted -- src/
 * integrations/supabase/client.ts already works around this for the
 * browser/anon client; supabaseAdmin.ts's service-role client didn't, so
 * this test exercises the fetch wrapper directly (getSupabaseAdminClient
 * itself just wires this same function into createClient's `global.fetch`
 * option -- not re-tested here since that would require a real or mocked
 * Supabase server).
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

async function capturedRequestHeaders(
  serviceRoleKey: string,
  requestInit: RequestInit = {},
): Promise<Headers> {
  let captured: Headers | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured = new Headers(init?.headers);
      return new Response("{}", { status: 200 });
    }),
  );

  const wrappedFetch = createServiceRoleFetch(serviceRoleKey);
  await wrappedFetch("https://example.test/rest/v1/billing_subscriptions", requestInit);

  if (!captured) throw new Error("fetch was never called");
  return captured;
}

describe("createServiceRoleFetch", () => {
  test("strips the default `Authorization: Bearer <key>` header for a new-format (sb_secret_...) key", async () => {
    const headers = await capturedRequestHeaders("sb_secret_test_disposable_value", {
      headers: { Authorization: "Bearer sb_secret_test_disposable_value" },
    });
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("apikey")).toBe("sb_secret_test_disposable_value");
  });

  test("leaves the Authorization header untouched for a legacy JWT-format key", async () => {
    const legacyKey = "eyJhbGciOiJIUzI1NiJ9.fake-legacy-jwt-payload.fake-signature";
    const headers = await capturedRequestHeaders(legacyKey, {
      headers: { Authorization: `Bearer ${legacyKey}` },
    });
    expect(headers.get("Authorization")).toBe(`Bearer ${legacyKey}`);
    expect(headers.get("apikey")).toBe(legacyKey);
  });

  test("never strips an Authorization header carrying a different token (e.g. a user's own access token), regardless of key format", async () => {
    const headers = await capturedRequestHeaders("sb_secret_test_disposable_value", {
      headers: { Authorization: "Bearer some-other-callers-jwt" },
    });
    expect(headers.get("Authorization")).toBe("Bearer some-other-callers-jwt");
    expect(headers.get("apikey")).toBe("sb_secret_test_disposable_value");
  });

  test("sets the apikey header even when the request had none to begin with", async () => {
    const headers = await capturedRequestHeaders("sb_secret_test_disposable_value");
    expect(headers.get("apikey")).toBe("sb_secret_test_disposable_value");
  });
});

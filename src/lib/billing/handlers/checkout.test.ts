import { beforeEach, describe, expect, test, vi } from "vitest";

async function loadHandlerWithMocks(userId: string | null) {
  vi.resetModules();
  vi.doMock("../requestAuth", () => ({
    requireAuthenticatedUserId: vi.fn(async () => userId),
  }));
  vi.doMock("../supabaseAdmin", () => ({
    getSupabaseAdminClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }));
  const { handleCheckout } = await import("./checkout");
  return handleCheckout;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("handleCheckout", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("401s an unauthenticated request before ever looking at the body", async () => {
    const handleCheckout = await loadHandlerWithMocks(null);
    const response = await handleCheckout(postRequest({ plan: "monthly" }));
    expect(response.status).toBe(401);
  });

  test("rejects an arbitrary/unknown plan value, even for an authenticated user", async () => {
    const handleCheckout = await loadHandlerWithMocks("user-1");
    const response = await handleCheckout(postRequest({ plan: "arbitrary-attacker-value" }));
    expect(response.status).toBe(400);
  });

  test("rejects a request that tries to send a raw Stripe priceId directly instead of a plan name", async () => {
    const handleCheckout = await loadHandlerWithMocks("user-1");
    const response = await handleCheckout(postRequest({ priceId: "price_evil_free_forever" }));
    expect(response.status).toBe(400);
  });

  test("rejects malformed JSON", async () => {
    const handleCheckout = await loadHandlerWithMocks("user-1");
    const response = await handleCheckout(
      new Request("https://example.test/api/billing/checkout", {
        method: "POST",
        body: "{not json",
      }),
    );
    expect(response.status).toBe(400);
  });
});

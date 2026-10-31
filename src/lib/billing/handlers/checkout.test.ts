import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/** The Stripe client's own `checkout.sessions.create` is mocked here (not
 * left unmocked) so every test in this file can assert exactly how many
 * times it was called -- in particular, the disabled-kill-switch tests
 * assert it is called zero times, which is the whole point of
 * serverCheckoutFlag.ts: no code path that reaches Stripe may run while
 * it's off. No test in this file makes a real network call to Stripe. */
function createStripeSessionsMock() {
  return vi.fn(async () => ({
    id: "cs_test_123",
    url: "https://checkout.stripe.test/cs_test_123",
  }));
}

async function loadHandlerWithMocks(options: { userId: string | null; checkoutEnabled: boolean }) {
  const { userId, checkoutEnabled } = options;
  vi.resetModules();

  vi.doMock("../requestAuth", () => ({
    requireAuthenticatedUserId: vi.fn(async () => userId),
  }));
  vi.doMock("../serverCheckoutFlag", () => ({
    isServerCheckoutEnabled: () => checkoutEnabled,
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

  const sessionsCreate = createStripeSessionsMock();
  vi.doMock("../stripe", () => ({
    getStripeClient: () => ({
      checkout: { sessions: { create: sessionsCreate } },
    }),
  }));

  const { handleCheckout } = await import("./checkout");
  return { handleCheckout, sessionsCreate };
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
    // Real resolvePriceId()/getAppBaseUrl() run unmocked in every test
    // below (only auth, the server flag, Supabase, and Stripe itself are
    // mocked) -- stubbing their env vars here exercises the actual
    // production price-resolution and base-URL logic, not a bypass of it.
    vi.stubEnv("STRIPE_PRICE_ID_MONTHLY", "price_test_monthly");
    vi.stubEnv("STRIPE_PRICE_ID_ANNUAL", "price_test_annual");
    vi.stubEnv("APP_BASE_URL", "https://example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("401s an unauthenticated request before ever looking at the body", async () => {
    const { handleCheckout } = await loadHandlerWithMocks({ userId: null, checkoutEnabled: true });
    const response = await handleCheckout(postRequest({ plan: "monthly" }));
    expect(response.status).toBe(401);
  });

  test("401s an unauthenticated request even while checkout is disabled (auth is still checked first)", async () => {
    const { handleCheckout, sessionsCreate } = await loadHandlerWithMocks({
      userId: null,
      checkoutEnabled: false,
    });
    const response = await handleCheckout(postRequest({ plan: "monthly" }));
    expect(response.status).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  test("rejects an arbitrary/unknown plan value, even for an authenticated user", async () => {
    const { handleCheckout } = await loadHandlerWithMocks({
      userId: "user-1",
      checkoutEnabled: true,
    });
    const response = await handleCheckout(postRequest({ plan: "arbitrary-attacker-value" }));
    expect(response.status).toBe(400);
  });

  test("rejects a request that tries to send a raw Stripe priceId directly instead of a plan name", async () => {
    const { handleCheckout } = await loadHandlerWithMocks({
      userId: "user-1",
      checkoutEnabled: true,
    });
    const response = await handleCheckout(postRequest({ priceId: "price_evil_free_forever" }));
    expect(response.status).toBe(400);
  });

  test("rejects malformed JSON", async () => {
    const { handleCheckout } = await loadHandlerWithMocks({
      userId: "user-1",
      checkoutEnabled: true,
    });
    const response = await handleCheckout(
      new Request("https://example.test/api/billing/checkout", {
        method: "POST",
        body: "{not json",
      }),
    );
    expect(response.status).toBe(400);
  });

  describe("server-side checkout kill switch (BILLING_CHECKOUT_ENABLED)", () => {
    test("disabled (the default): an authenticated request with a valid plan gets 503 and creates zero Stripe sessions", async () => {
      const { handleCheckout, sessionsCreate } = await loadHandlerWithMocks({
        userId: "user-1",
        checkoutEnabled: false,
      });
      const response = await handleCheckout(postRequest({ plan: "monthly" }));
      expect(response.status).toBe(503);
      const body = (await response.json()) as { error: string };
      // Safe, user-friendly, and never leaks why/how it's disabled.
      expect(body.error).toBe("Checkout is not available right now. Please try again later.");
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test("disabled: zero Stripe sessions are created for either plan, for multiple authenticated users", async () => {
      for (const userId of ["user-1", "user-2", "user-3"]) {
        for (const plan of ["monthly", "annual"]) {
          const { handleCheckout, sessionsCreate } = await loadHandlerWithMocks({
            userId,
            checkoutEnabled: false,
          });
          const response = await handleCheckout(postRequest({ plan }));
          expect(response.status).toBe(503);
          expect(sessionsCreate).not.toHaveBeenCalled();
        }
      }
    });

    test("enabled: an authenticated request with a valid plan creates exactly one Stripe session and returns its url", async () => {
      const { handleCheckout, sessionsCreate } = await loadHandlerWithMocks({
        userId: "user-1",
        checkoutEnabled: true,
      });
      const response = await handleCheckout(postRequest({ plan: "monthly" }));
      expect(response.status).toBe(200);
      const body = (await response.json()) as { url: string };
      expect(body.url).toBe("https://checkout.stripe.test/cs_test_123");
      expect(sessionsCreate).toHaveBeenCalledTimes(1);
      expect(sessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          client_reference_id: "user-1",
          line_items: [{ price: "price_test_monthly", quantity: 1 }],
        }),
      );
    });

    test("enabled: the annual plan resolves to the annual price id", async () => {
      const { handleCheckout, sessionsCreate } = await loadHandlerWithMocks({
        userId: "user-1",
        checkoutEnabled: true,
      });
      const response = await handleCheckout(postRequest({ plan: "annual" }));
      expect(response.status).toBe(200);
      expect(sessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ line_items: [{ price: "price_test_annual", quantity: 1 }] }),
      );
    });
  });
});

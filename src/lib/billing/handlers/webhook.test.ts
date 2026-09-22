import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

async function loadHandlerWithMocks(options: {
  constructEventAsync: (...args: unknown[]) => Promise<unknown>;
  webhookSecret?: string;
}) {
  vi.resetModules();
  process.env["STRIPE_WEBHOOK_SECRET"] = options.webhookSecret ?? "whsec_test_placeholder";
  vi.doMock("../stripe", () => ({
    getStripeClient: () => ({
      webhooks: { constructEventAsync: options.constructEventAsync },
    }),
    getWebhookCryptoProvider: () => ({}),
  }));
  vi.doMock("../supabaseAdmin", () => ({
    getSupabaseAdminClient: () => ({}),
  }));
  vi.doMock("../webhookProcessing", () => ({
    recordAndProcessEvent: vi.fn(async () => ({ kind: "processed" })),
  }));
  const { handleWebhook } = await import("./webhook");
  return handleWebhook;
}

function webhookRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/billing/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("handleWebhook — signature verification", () => {
  const originalSecret = process.env["STRIPE_WEBHOOK_SECRET"];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env["STRIPE_WEBHOOK_SECRET"] = originalSecret;
  });

  test("rejects a request with no Stripe-Signature header at all — never even reaches Stripe", async () => {
    const constructEventAsync = vi.fn();
    const handleWebhook = await loadHandlerWithMocks({ constructEventAsync });
    const response = await handleWebhook(webhookRequest('{"id":"evt_1"}'));
    expect(response.status).toBe(400);
    expect(constructEventAsync).not.toHaveBeenCalled();
  });

  test("rejects a request whose signature Stripe itself refuses to verify", async () => {
    const constructEventAsync = vi.fn(async () => {
      throw new Error("No signatures found matching the expected signature for payload");
    });
    const handleWebhook = await loadHandlerWithMocks({ constructEventAsync });
    const response = await handleWebhook(
      webhookRequest('{"id":"evt_1"}', { "stripe-signature": "t=1,v1=forged" }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    // Generic client error — the real Stripe error detail stays server-side
    // (console.error), never echoed back to the caller.
    expect(body.error).not.toMatch(/signatures found/i);
  });

  test("accepts and processes an event once signature verification succeeds", async () => {
    const fakeEvent = { id: "evt_1", type: "checkout.session.completed", created: 1000 };
    const constructEventAsync = vi.fn(async () => fakeEvent);
    const handleWebhook = await loadHandlerWithMocks({ constructEventAsync });
    const response = await handleWebhook(
      webhookRequest('{"id":"evt_1"}', { "stripe-signature": "t=1,v1=real" }),
    );
    expect(response.status).toBe(200);
  });

  test("500s (asks Stripe to retry) when the secret is not configured, rather than skipping verification", async () => {
    vi.resetModules();
    delete process.env["STRIPE_WEBHOOK_SECRET"];
    vi.doMock("../stripe", () => ({
      getStripeClient: () => ({ webhooks: { constructEventAsync: vi.fn() } }),
      getWebhookCryptoProvider: () => ({}),
    }));
    vi.doMock("../supabaseAdmin", () => ({ getSupabaseAdminClient: () => ({}) }));
    vi.doMock("../webhookProcessing", () => ({ recordAndProcessEvent: vi.fn() }));
    const { handleWebhook } = await import("./webhook");
    const response = await handleWebhook(
      webhookRequest('{"id":"evt_1"}', { "stripe-signature": "t=1,v1=real" }),
    );
    expect(response.status).toBe(500);
  });
});

import { afterEach, describe, expect, test, vi } from "vitest";

import { isServerCheckoutEnabled } from "./serverCheckoutFlag";

/**
 * BILLING_CHECKOUT_ENABLED must fail closed, exactly like
 * VITE_BILLING_CHECKOUT_ENABLED's own contract (checkoutFlag.test.ts) --
 * only the exact string "true" enables it. A missing variable (the
 * Cloudflare Worker variable was never configured), "false", or any other
 * truthy-looking-but-wrong value never accidentally authorizes a real
 * Stripe Checkout Session.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isServerCheckoutEnabled", () => {
  test("missing value -> disabled", () => {
    vi.stubEnv("BILLING_CHECKOUT_ENABLED", undefined);
    expect(isServerCheckoutEnabled()).toBe(false);
  });

  test("empty string -> disabled", () => {
    vi.stubEnv("BILLING_CHECKOUT_ENABLED", "");
    expect(isServerCheckoutEnabled()).toBe(false);
  });

  test('"false" -> disabled', () => {
    vi.stubEnv("BILLING_CHECKOUT_ENABLED", "false");
    expect(isServerCheckoutEnabled()).toBe(false);
  });

  test('exact string "true" -> enabled', () => {
    vi.stubEnv("BILLING_CHECKOUT_ENABLED", "true");
    expect(isServerCheckoutEnabled()).toBe(true);
  });

  test.each(["TRUE", "True", "1", "yes", " true", "true ", "null", "undefined"])(
    '%j is not the exact string "true" -> disabled',
    (value) => {
      vi.stubEnv("BILLING_CHECKOUT_ENABLED", value);
      expect(isServerCheckoutEnabled()).toBe(false);
    },
  );
});

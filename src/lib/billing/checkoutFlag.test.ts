import { afterEach, describe, expect, test, vi } from "vitest";

import { isBillingCheckoutEnabled } from "./checkoutFlag";

/**
 * VITE_BILLING_CHECKOUT_ENABLED must fail closed: only the exact string
 * "true" enables checkout, so a missing variable, "false", or any other
 * truthy-looking-but-wrong value (a stray "TRUE"/"1"/empty string from a
 * misconfigured deploy) never accidentally turns checkout on.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isBillingCheckoutEnabled", () => {
  test("missing value -> disabled", () => {
    vi.stubEnv("VITE_BILLING_CHECKOUT_ENABLED", undefined);
    expect(isBillingCheckoutEnabled()).toBe(false);
  });

  test('"false" -> disabled', () => {
    vi.stubEnv("VITE_BILLING_CHECKOUT_ENABLED", "false");
    expect(isBillingCheckoutEnabled()).toBe(false);
  });

  test('exact string "true" -> enabled', () => {
    vi.stubEnv("VITE_BILLING_CHECKOUT_ENABLED", "true");
    expect(isBillingCheckoutEnabled()).toBe(true);
  });

  test.each(["TRUE", "True", "1", "yes", " true", "true "])(
    '%j is not the exact string "true" -> disabled',
    (value) => {
      vi.stubEnv("VITE_BILLING_CHECKOUT_ENABLED", value);
      expect(isBillingCheckoutEnabled()).toBe(false);
    },
  );
});

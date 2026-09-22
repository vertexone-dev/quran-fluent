/**
 * The only two purchasable plans, and the only place a client-supplied
 * `plan` string is ever translated into a real Stripe Price id. A request
 * body's `priceId` (or any other client-controlled string) is NEVER passed
 * straight to Stripe -- see PAYMENT-ARCHITECTURE.md §18 threat model,
 * "Price tampering."
 */
export const BILLING_PLANS = ["monthly", "annual"] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];

export function isBillingPlan(value: unknown): value is BillingPlan {
  return typeof value === "string" && (BILLING_PLANS as readonly string[]).includes(value);
}

/** Resolves an approved plan name to its server-configured Stripe Price id.
 * Throws if the corresponding environment variable is missing -- fails
 * closed, never silently falls back to guessing a price. */
export function resolvePriceId(plan: BillingPlan): string {
  const envVar = plan === "monthly" ? "STRIPE_PRICE_ID_MONTHLY" : "STRIPE_PRICE_ID_ANNUAL";
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(`Missing ${envVar} environment variable. See PAYMENT-ARCHITECTURE.md §17.`);
  }
  return priceId;
}

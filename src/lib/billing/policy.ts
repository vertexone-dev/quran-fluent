/** Approved product/policy constants (PAYMENT-ARCHITECTURE.md §1-3, §23).
 * Single source of truth -- the pricing page, checkout handler, and
 * architecture doc all read from here rather than repeating literals. */

export const MONTHLY_PRICE_USD = 3.99;
export const ANNUAL_PRICE_USD = 29.99;

/** Free trial length, applied via Stripe Checkout's subscription_data. */
export const TRIAL_PERIOD_DAYS = 7;

/** First-payment refund window (support/Dashboard-issued; this codebase
 * does not implement self-service refunds -- PAYMENT-ARCHITECTURE.md §15). */
export const FIRST_PAYMENT_REFUND_PERIOD_DAYS = 7;

/** Failed-payment grace period -- also the single source PAYMENT-
 * ARCHITECTURE.md and entitlement.ts's PAST_DUE_GRACE_PERIOD_DAYS describe;
 * kept as one named constant re-exported there to avoid two numbers
 * drifting apart. */
export const FAILED_PAYMENT_GRACE_PERIOD_DAYS = 7;

/** One-time complimentary Premium window for every learner who already has
 * an account once enforcement is eventually activated -- not implemented by
 * this PR (enforcement itself is disabled), but the number is fixed now so
 * the later enforcement-activation phase applies it consistently. */
export const EXISTING_USER_COMPLIMENTARY_PREMIUM_DAYS = 30;

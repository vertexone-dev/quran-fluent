/**
 * Pure Premium-entitlement policy. No I/O, no Stripe SDK, no Supabase
 * client -- every function here takes plain data in and returns a plain
 * value, so it is fully unit-testable (entitlement.test.ts) without mocking
 * anything. Mirrors Stripe's own subscription status vocabulary verbatim
 * (never a locally-invented status model) -- see PAYMENT-ARCHITECTURE.md
 * §11.
 */

import { FAILED_PAYMENT_GRACE_PERIOD_DAYS } from "./policy";

export const BILLING_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;

export type BillingStatus = (typeof BILLING_STATUSES)[number];

export function isBillingStatus(value: unknown): value is BillingStatus {
  return typeof value === "string" && (BILLING_STATUSES as readonly string[]).includes(value);
}

export type SubscriptionSnapshot = {
  status: BillingStatus;
  /** End of the current paid period, if known. Drives the `canceled`
   * still-entitled-until-period-end rule -- but only when `cancelAtPeriodEnd`
   * was true at cancellation; see that field's own comment. */
  currentPeriodEnd: Date | null;
  /** Whether the subscription was scheduled to cancel at period end (true)
   * or canceled immediately (false) -- Stripe does not collapse
   * `current_period_end` to "now" for an immediate cancellation, so this
   * flag is the only way to distinguish "still owns the already-paid
   * period" from "canceled outside that, e.g. an immediate admin/refund
   * cancellation" (PAYMENT-ARCHITECTURE.md §11/§14). Confirmed against a
   * real Stripe sandbox cancellation: an immediately-canceled subscription
   * still reports its original, still-future current_period_end. */
  cancelAtPeriodEnd: boolean;
  /** When this row most recently transitioned into `status`. Only consulted
   * for the `past_due` grace window; ignored for every other status. */
  statusChangedAt: Date | null;
};

/** Failed-payment grace period: a `past_due` subscription still grants
 * Premium for this many days after the status began, matching Stripe's own
 * payment-retry window rather than punishing a learner mid-lesson for a
 * single declined card (PAYMENT-ARCHITECTURE.md §11/§23). Re-exported from
 * policy.ts's FAILED_PAYMENT_GRACE_PERIOD_DAYS so the two names can never
 * drift to different values. */
export const PAST_DUE_GRACE_PERIOD_DAYS = FAILED_PAYMENT_GRACE_PERIOD_DAYS;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a subscription snapshot currently entitles its owner to Premium,
 * independent of enforcement being on or off -- callers that need to
 * respect PREMIUM_ENFORCEMENT_ENABLED use `hasLevelAccess` below instead of
 * calling this directly for level gating.
 */
export function isPremiumEntitled(
  subscription: SubscriptionSnapshot | null,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false;

  switch (subscription.status) {
    case "trialing":
    case "active":
      return true;

    case "past_due": {
      if (!subscription.statusChangedAt) return false;
      const graceEnd = new Date(
        subscription.statusChangedAt.getTime() + PAST_DUE_GRACE_PERIOD_DAYS * DAY_MS,
      );
      return now.getTime() < graceEnd.getTime();
    }

    case "canceled":
      return (
        subscription.cancelAtPeriodEnd &&
        subscription.currentPeriodEnd != null &&
        now.getTime() < subscription.currentPeriodEnd.getTime()
      );

    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return false;
  }
}

/** Levels 1-2 are Free; Levels 3-6 are Premium (approved product decision).
 * Any level number outside the current curriculum's 1-6 range is treated
 * as Premium (fail closed, never silently free) rather than assumed Free. */
export function isLevelFree(levelNumber: number): boolean {
  return levelNumber === 1 || levelNumber === 2;
}

/**
 * Hard-coded to `false` for this PR. This is the single flag that decides
 * whether `hasLevelAccess` below ever denies access at all -- while it is
 * `false`, every learner (Free or Premium-subscribed) keeps exactly the
 * access they have today, regardless of any billing table content. Flip
 * this only in a later, separately-reviewed PR, and only once the
 * server-authorized content-delivery/RLS phase described in
 * PAYMENT-ARCHITECTURE.md ("Security note: this foundation does not yet
 * secure Levels 3-6 content") is complete -- a UI-only lock around this
 * flag would not be a real paywall.
 */
export const PREMIUM_ENFORCEMENT_ENABLED = false;

/** Whether level access should even be gated at all. Only `true` once
 * PREMIUM_ENFORCEMENT_ENABLED flips and the level itself isn't Free. */
export function requiresPremiumForLevel(levelNumber: number): boolean {
  if (!PREMIUM_ENFORCEMENT_ENABLED) return false;
  return !isLevelFree(levelNumber);
}

/**
 * The single function gating surfaces should call. While enforcement is
 * disabled this always returns true, for every level and every learner --
 * see PREMIUM_ENFORCEMENT_ENABLED's own comment. Once enforcement is
 * enabled, a Free level always returns true, and a Premium level returns
 * `isPremiumEntitled(subscription, now)`.
 */
export function hasLevelAccess(
  levelNumber: number,
  subscription: SubscriptionSnapshot | null,
  now: Date = new Date(),
): boolean {
  if (!requiresPremiumForLevel(levelNumber)) return true;
  return isPremiumEntitled(subscription, now);
}

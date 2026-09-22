import { describe, expect, test } from "vitest";

import {
  hasLevelAccess,
  isBillingStatus,
  isLevelFree,
  isPremiumEntitled,
  PAST_DUE_GRACE_PERIOD_DAYS,
  PREMIUM_ENFORCEMENT_ENABLED,
  requiresPremiumForLevel,
  type SubscriptionSnapshot,
} from "./entitlement";

const NOW = new Date("2026-09-22T00:00:00Z");
const days = (n: number) => n * 24 * 60 * 60 * 1000;

function snapshot(overrides: Partial<SubscriptionSnapshot>): SubscriptionSnapshot {
  return {
    status: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    statusChangedAt: null,
    ...overrides,
  };
}

describe("isBillingStatus", () => {
  test("accepts every Stripe status this app stores", () => {
    for (const s of [
      "trialing",
      "active",
      "past_due",
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ]) {
      expect(isBillingStatus(s)).toBe(true);
    }
  });

  test("rejects an invented/unknown status", () => {
    expect(isBillingStatus("premium")).toBe(false);
    expect(isBillingStatus("cancelled")).toBe(false); // British spelling — not Stripe's
    expect(isBillingStatus(42)).toBe(false);
    expect(isBillingStatus(null)).toBe(false);
  });
});

describe("isPremiumEntitled", () => {
  test("null subscription is never entitled", () => {
    expect(isPremiumEntitled(null, NOW)).toBe(false);
  });

  test("active and trialing are entitled", () => {
    expect(isPremiumEntitled(snapshot({ status: "active" }), NOW)).toBe(true);
    expect(isPremiumEntitled(snapshot({ status: "trialing" }), NOW)).toBe(true);
  });

  describe("past_due grace period", () => {
    test(`entitled up to ${PAST_DUE_GRACE_PERIOD_DAYS} days after the status began`, () => {
      const changedAt = new Date(NOW.getTime() - days(PAST_DUE_GRACE_PERIOD_DAYS - 1));
      expect(
        isPremiumEntitled(snapshot({ status: "past_due", statusChangedAt: changedAt }), NOW),
      ).toBe(true);
    });

    test("not entitled once the grace period has fully elapsed", () => {
      const changedAt = new Date(NOW.getTime() - days(PAST_DUE_GRACE_PERIOD_DAYS + 1));
      expect(
        isPremiumEntitled(snapshot({ status: "past_due", statusChangedAt: changedAt }), NOW),
      ).toBe(false);
    });

    test("not entitled exactly at the grace-period boundary", () => {
      const changedAt = new Date(NOW.getTime() - days(PAST_DUE_GRACE_PERIOD_DAYS));
      expect(
        isPremiumEntitled(snapshot({ status: "past_due", statusChangedAt: changedAt }), NOW),
      ).toBe(false);
    });

    test("no statusChangedAt on record fails closed (not entitled)", () => {
      expect(isPremiumEntitled(snapshot({ status: "past_due", statusChangedAt: null }), NOW)).toBe(
        false,
      );
    });
  });

  describe("canceled — entitled through the paid period only, and only when that was scheduled at period end", () => {
    test("entitled while now is before current_period_end AND cancelAtPeriodEnd was true", () => {
      const end = new Date(NOW.getTime() + days(3));
      expect(
        isPremiumEntitled(
          snapshot({ status: "canceled", currentPeriodEnd: end, cancelAtPeriodEnd: true }),
          NOW,
        ),
      ).toBe(true);
    });

    test("not entitled once current_period_end has passed, even if cancelAtPeriodEnd was true", () => {
      const end = new Date(NOW.getTime() - days(1));
      expect(
        isPremiumEntitled(
          snapshot({ status: "canceled", currentPeriodEnd: end, cancelAtPeriodEnd: true }),
          NOW,
        ),
      ).toBe(false);
    });

    // Regression test: confirmed against a real Stripe sandbox cancellation
    // that Stripe does NOT collapse current_period_end to "now" for an
    // immediate (not cancel-at-period-end) cancellation -- it still reports
    // the original, still-future period end. Without checking
    // cancelAtPeriodEnd too, an immediately-canceled subscriber would keep
    // Premium access until that date, contradicting PAYMENT-ARCHITECTURE.md
    // §11/§14's documented "revoked immediately if canceled outside
    // [cancel-at-period-end]" rule.
    test("NOT entitled for an immediate cancellation, even though current_period_end is still in the future", () => {
      const end = new Date(NOW.getTime() + days(3));
      expect(
        isPremiumEntitled(
          snapshot({ status: "canceled", currentPeriodEnd: end, cancelAtPeriodEnd: false }),
          NOW,
        ),
      ).toBe(false);
    });

    test("no current_period_end on record fails closed (not entitled), even with cancelAtPeriodEnd true", () => {
      expect(
        isPremiumEntitled(
          snapshot({ status: "canceled", currentPeriodEnd: null, cancelAtPeriodEnd: true }),
          NOW,
        ),
      ).toBe(false);
    });
  });

  test("unpaid, incomplete, incomplete_expired, paused are never entitled", () => {
    for (const status of ["unpaid", "incomplete", "incomplete_expired", "paused"] as const) {
      expect(isPremiumEntitled(snapshot({ status }), NOW)).toBe(false);
    }
  });
});

describe("isLevelFree", () => {
  test("Levels 1-2 are Free", () => {
    expect(isLevelFree(1)).toBe(true);
    expect(isLevelFree(2)).toBe(true);
  });

  test("Levels 3-6 are Premium", () => {
    for (const level of [3, 4, 5, 6]) {
      expect(isLevelFree(level)).toBe(false);
    }
  });
});

describe("enforcement flag", () => {
  test("PREMIUM_ENFORCEMENT_ENABLED is false in this PR", () => {
    expect(PREMIUM_ENFORCEMENT_ENABLED).toBe(false);
  });

  test("requiresPremiumForLevel is false for every level while enforcement is disabled", () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      expect(requiresPremiumForLevel(level)).toBe(false);
    }
  });
});

describe("hasLevelAccess (enforcement disabled — current behavior)", () => {
  test("every learner, including one with no subscription at all, keeps access to every level", () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      expect(hasLevelAccess(level, null, NOW)).toBe(true);
    }
  });

  test("a canceled-and-expired subscriber still keeps access to every level", () => {
    const expired = snapshot({
      status: "canceled",
      currentPeriodEnd: new Date(NOW.getTime() - days(30)),
    });
    for (const level of [3, 4, 5, 6]) {
      expect(hasLevelAccess(level, expired, NOW)).toBe(true);
    }
  });

  test("an unpaid subscriber still keeps access to every level", () => {
    const unpaid = snapshot({ status: "unpaid" });
    for (const level of [3, 4, 5, 6]) {
      expect(hasLevelAccess(level, unpaid, NOW)).toBe(true);
    }
  });
});

import { getSupabaseAdminClient } from "../supabaseAdmin";
import { requireAuthenticatedUserId } from "../requestAuth";
import { jsonError, jsonResponse } from "../http";
import { isBillingStatus, isPremiumEntitled, PREMIUM_ENFORCEMENT_ENABLED } from "../entitlement";

/**
 * GET /api/billing/status
 *
 * Read-only summary of the authenticated user's billing state, for
 * /settings/billing. Reads billing_subscriptions directly (never a live
 * Stripe API call on page load -- PAYMENT-ARCHITECTURE.md §6.1) via the
 * service-role client, since the row's presence/absence alone must not
 * leak through an RLS-driven "no rows" vs. "not authenticated" ambiguity
 * this endpoint's own 401 already resolves up front.
 */
export async function handleStatus(request: Request): Promise<Response> {
  const userId = await requireAuthenticatedUserId(request);
  if (!userId) return jsonError(401, "Sign in required.");

  const admin = getSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("billing_subscriptions")
    .select(
      "status, stripe_price_id, current_period_end, trial_end, cancel_at_period_end, status_changed_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[billing/status] subscription lookup failed:", error.message);
    return jsonError(500, "Billing status is temporarily unavailable.");
  }

  const row = rows?.[0];
  if (!row || !isBillingStatus(row.status)) {
    return jsonResponse(200, {
      hasSubscription: false,
      isPremium: false,
      enforcementEnabled: PREMIUM_ENFORCEMENT_ENABLED,
    });
  }

  const isPremium = isPremiumEntitled(
    {
      status: row.status,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
      statusChangedAt: row.status_changed_at ? new Date(row.status_changed_at) : null,
    },
    new Date(),
  );

  return jsonResponse(200, {
    hasSubscription: true,
    status: row.status,
    priceId: row.stripe_price_id,
    currentPeriodEnd: row.current_period_end,
    trialEnd: row.trial_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    isPremium,
    enforcementEnabled: PREMIUM_ENFORCEMENT_ENABLED,
  });
}

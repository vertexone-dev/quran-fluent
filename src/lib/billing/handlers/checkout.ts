import { getStripeClient } from "../stripe";
import { getSupabaseAdminClient } from "../supabaseAdmin";
import { requireAuthenticatedUserId } from "../requestAuth";
import { isBillingPlan, resolvePriceId } from "../prices";
import { TRIAL_PERIOD_DAYS } from "../policy";
import { jsonError, jsonResponse } from "../http";
import { getAppBaseUrl } from "../env";

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session in subscription mode for one of the two
 * approved plans. Never accepts a client-supplied Stripe Price id (see
 * ../prices.ts) -- only "monthly" | "annual" is read from the request body,
 * resolved server-side to a Price id from server environment variables.
 */
export async function handleCheckout(request: Request): Promise<Response> {
  const userId = await requireAuthenticatedUserId(request);
  if (!userId) return jsonError(401, "Sign in required.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const plan = (body as { plan?: unknown } | null)?.plan;
  if (!isBillingPlan(plan)) {
    return jsonError(400, 'Invalid "plan" -- must be "monthly" or "annual".');
  }

  let priceId: string;
  try {
    priceId = resolvePriceId(plan);
  } catch (error) {
    console.error("[billing/checkout] price resolution failed:", error);
    return jsonError(500, "Checkout is temporarily unavailable.");
  }

  // Reuse an existing Stripe Customer for this user when one is already on
  // record (billing_customers is only ever written by the webhook handler,
  // via the service-role key -- reading it here needs the same client,
  // since this request's own auth token has no SELECT-bypassing power and
  // this specific lookup must succeed even before that user's own RLS-
  // visible row would necessarily reflect a brand-new customer).
  const admin = getSupabaseAdminClient();
  const { data: existingCustomer, error: customerLookupError } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (customerLookupError) {
    console.error("[billing/checkout] customer lookup failed:", customerLookupError.message);
    return jsonError(500, "Checkout is temporarily unavailable.");
  }

  const baseUrl = getAppBaseUrl();
  const stripe = getStripeClient();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      metadata: { supabase_user_id: userId },
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata: { supabase_user_id: userId },
      },
      ...(existingCustomer ? { customer: existingCustomer.stripe_customer_id } : {}),
      // Stripe Adaptive Pricing: lets an eligible customer see and pay in
      // their local currency; falls back to the Price's own default
      // currency (USD) when localized presentment isn't available for
      // them -- no separate fallback branch needed, that's Stripe's own
      // documented behavior for this flag.
      adaptive_pricing: { enabled: true },
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
      success_url: `${baseUrl}/settings/billing?checkout=success`,
      cancel_url: `${baseUrl}/settings/billing?checkout=cancelled`,
    });

    if (!session.url) {
      console.error("[billing/checkout] Stripe returned a session with no url");
      return jsonError(500, "Checkout is temporarily unavailable.");
    }

    return jsonResponse(200, { url: session.url });
  } catch (error) {
    console.error("[billing/checkout] Stripe session creation failed:", error);
    return jsonError(500, "Checkout is temporarily unavailable.");
  }
}

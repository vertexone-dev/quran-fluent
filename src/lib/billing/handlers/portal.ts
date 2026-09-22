import { getStripeClient } from "../stripe";
import { getSupabaseAdminClient } from "../supabaseAdmin";
import { requireAuthenticatedUserId } from "../requestAuth";
import { jsonError, jsonResponse } from "../http";
import { getAppBaseUrl } from "../env";

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe-hosted Customer Portal session for the authenticated
 * user's existing Stripe Customer, resolved from billing_customers (never
 * trusted from a request body). No custom UI is built for anything the
 * Portal already does (plan changes, cancellation, payment-method updates,
 * invoice history) -- PAYMENT-ARCHITECTURE.md §6.
 */
export async function handlePortal(request: Request): Promise<Response> {
  const userId = await requireAuthenticatedUserId(request);
  if (!userId) return jsonError(401, "Sign in required.");

  const admin = getSupabaseAdminClient();
  const { data: customer, error } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[billing/portal] customer lookup failed:", error.message);
    return jsonError(500, "Billing management is temporarily unavailable.");
  }
  if (!customer) {
    return jsonError(404, "No billing account found for this user yet.");
  }

  const baseUrl = getAppBaseUrl();
  const stripe = getStripeClient();

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${baseUrl}/settings/billing`,
    });
    return jsonResponse(200, { url: session.url });
  } catch (stripeError) {
    console.error("[billing/portal] Stripe portal session creation failed:", stripeError);
    return jsonError(500, "Billing management is temporarily unavailable.");
  }
}

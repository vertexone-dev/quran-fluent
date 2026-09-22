import { getStripeClient, getWebhookCryptoProvider } from "../stripe";
import { getSupabaseAdminClient } from "../supabaseAdmin";
import { recordAndProcessEvent } from "../webhookProcessing";
import { jsonError, jsonResponse } from "../http";

/**
 * POST /api/billing/webhook
 *
 * The entire trust boundary for every billing-table write: nothing
 * downstream (webhookProcessing.ts) ever runs against a payload that
 * didn't pass Stripe signature verification here first. Reads the raw
 * body (required for signature verification -- never JSON-parses before
 * this) and verifies asynchronously with the SDK's Web Crypto provider,
 * since Cloudflare Workers has no Node `crypto` module for the sync
 * variant.
 */
export async function handleWebhook(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return jsonError(400, "Missing Stripe-Signature header.");

  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!webhookSecret) {
    console.error("[billing/webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return jsonError(500, "Webhook is not configured.");
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      getWebhookCryptoProvider(),
    );
  } catch (error) {
    console.error(
      "[billing/webhook] signature verification failed:",
      error instanceof Error ? error.message : String(error),
    );
    return jsonError(400, "Invalid signature.");
  }

  const admin = getSupabaseAdminClient();
  const outcome = await recordAndProcessEvent(admin, event);

  switch (outcome.kind) {
    case "duplicate":
    case "processed":
      return jsonResponse(200, { received: true });
    case "record_failed":
      console.error("[billing/webhook] failed to durably record event:", outcome.message);
      // Genuine, retryable write failure -- let Stripe's own retry policy
      // redeliver (PAYMENT-ARCHITECTURE.md §7.5).
      return jsonError(500, "Failed to record event.");
    case "processing_failed":
      console.error(
        `[billing/webhook] processing failed for event ${event.id} (${event.type}):`,
        outcome.message,
      );
      // Recorded but not marked processed -- a retry (Stripe's own, or a
      // manual Dashboard resend) will retry processing only, never
      // re-insert or reprocess a truly completed event.
      return jsonError(500, "Failed to process event.");
  }
}

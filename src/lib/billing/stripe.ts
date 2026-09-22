import Stripe from "stripe";

/**
 * Server-only Stripe client. Never import this module from anything that
 * ships to the browser -- see src/lib/billing/README.md for the module
 * boundary this repo relies on (only src/server.ts and other files under
 * src/lib/billing/ import it; nothing under src/routes/ or src/components/
 * does). Configured with the SDK's own fetch-based HTTP client and Web
 * Crypto webhook verification instead of its Node defaults (`https`/
 * `crypto` modules), because those do not exist in the Cloudflare Workers
 * runtime this app deploys to (see DEPLOYMENT.md).
 */

let cachedClient: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;

  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY environment variable. See PAYMENT-ARCHITECTURE.md §17.",
    );
  }

  cachedClient = new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  return cachedClient;
}

/** Web Crypto-based signature verifier for `stripe.webhooks.constructEventAsync`
 * -- the async variant is required alongside this provider; the sync
 * `constructEvent` depends on Node's `crypto` module and throws in Workers. */
export function getWebhookCryptoProvider() {
  return Stripe.createSubtleCryptoProvider();
}

/** Test-only escape hatch so unit tests can inject a mock client without
 * reaching into module internals. Never called by application code. */
export function __setStripeClientForTests(client: Stripe | undefined): void {
  cachedClient = client;
}

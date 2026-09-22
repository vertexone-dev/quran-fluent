/**
 * `APP_BASE_URL` is a server-controlled environment variable (Cloudflare
 * Worker secret / GitHub Actions `production` environment secret, same
 * mechanism as the app's other server-only config -- DEPLOYMENT.md), never
 * derived from a request's own `Host` header. Trusting a client-supplied
 * Host for a Stripe Checkout success/cancel redirect would let a forged
 * request send a paying customer back to an attacker-controlled origin
 * after checkout -- see PAYMENT-ARCHITECTURE.md's threat model.
 */
export function getAppBaseUrl(): string {
  const baseUrl = process.env["APP_BASE_URL"];
  if (!baseUrl) {
    throw new Error("Missing APP_BASE_URL environment variable. See PAYMENT-ARCHITECTURE.md §17.");
  }
  return baseUrl.replace(/\/+$/, "");
}

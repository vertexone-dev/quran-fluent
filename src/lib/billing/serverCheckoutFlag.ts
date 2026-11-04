/**
 * Server-only checkout kill switch -- deliberately separate from
 * VITE_BILLING_CHECKOUT_ENABLED (checkoutFlag.ts), which only ever hides or
 * disables the client's own "Choose Monthly"/"Choose Annual" buttons. That
 * flag is a Vite build-time substitution baked into the public client
 * bundle (`import.meta.env.VITE_BILLING_CHECKOUT_ENABLED`) -- it was never
 * read by, and cannot authorize or block, the server-side checkout handler.
 * A direct `POST /api/billing/checkout` with a valid session bypassed it
 * entirely (confirmed by source-code audit; PAYMENT-ARCHITECTURE.md's
 * "frontend vs. server-side checkout control" section documents the gap
 * this module closes).
 *
 * `BILLING_CHECKOUT_ENABLED` (no `VITE_` prefix) is read from `process.env`
 * at request time, inside the deployed Cloudflare Worker -- the exact same
 * mechanism already relied on for STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 * and every other genuinely server-only value in this module (see
 * stripe.ts, env.ts, prices.ts). It must be configured as a Cloudflare
 * Worker environment variable on the `quranroots` Worker itself (Cloudflare
 * dashboard -> Workers & Pages -> quranroots -> Settings -> Variables, or
 * `wrangler secret put`/`wrangler vars put`) -- see DEPLOYMENT.md §5's
 * existing documented precedent for this exact distinction. The GitHub
 * Actions production-deploy workflow only ever supplies `VITE_`-prefixed
 * values at build time; it has no path to this variable at all, by design
 * -- a build-time GitHub Actions value flipping would do nothing to this
 * check.
 *
 * Fails closed: unset, empty, or any value other than the exact string
 * "true" means disabled. Mirrors checkoutFlag.ts's own "default to
 * disabled, never silently enabled by a missing or malformed value"
 * contract -- the same rule, enforced independently, on the side that
 * actually matters.
 */
export function isServerCheckoutEnabled(): boolean {
  return process.env["BILLING_CHECKOUT_ENABLED"] === "true";
}

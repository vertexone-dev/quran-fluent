/**
 * Client-safe flag read from `VITE_BILLING_CHECKOUT_ENABLED` (see
 * .env.example). Defaults to disabled when unset, never to enabled --
 * checkout must be explicitly turned on, not accidentally left on by a
 * missing build-time variable. Buttons that would start Checkout must
 * check this before doing anything; this file has zero Stripe/Supabase
 * imports so it's safe to use from any client component.
 */
export function isBillingCheckoutEnabled(): boolean {
  return import.meta.env["VITE_BILLING_CHECKOUT_ENABLED"] === "true";
}

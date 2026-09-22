/** Small, boring JSON response helpers shared by every billing handler --
 * kept deliberately free of any Stripe/Supabase-specific detail so a
 * handler's error responses are always this same generic shape
 * (PAYMENT-ARCHITECTURE.md §7.5/§18: "generic client errors, detailed
 * server-side logs only"). */

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function jsonError(status: number, message: string): Response {
  return jsonResponse(status, { error: message });
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Verifies the caller's Supabase session from a raw `Authorization: Bearer
 * <access_token>` header (the browser persists its session in localStorage,
 * not a cookie -- see src/integrations/supabase/client.ts -- so every
 * billing endpoint call must attach the token explicitly; see
 * src/lib/billing/fetchClient.ts, the one client-side helper that does
 * this). Delegates verification to Supabase Auth itself
 * (`auth.getUser(token)`, a real network call, not a local JWT decode) --
 * never trusts a client-supplied user id for anything.
 *
 * Returns `null` on any failure (missing header, malformed token, expired/
 * revoked session) -- callers respond 401, and never distinguish the
 * reason in the response body (PAYMENT-ARCHITECTURE.md §7.5's "generic
 * client errors, sanitized server logs" principle, applied to auth too).
 */
export async function requireAuthenticatedUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

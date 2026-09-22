import { supabase } from "@/integrations/supabase/client";

/**
 * The one client-side helper that calls a /api/billing/* endpoint. Attaches
 * the current Supabase access token as `Authorization: Bearer <token>` --
 * this app's session lives in localStorage, not a cookie (see
 * src/integrations/supabase/client.ts), so nothing does this automatically.
 * Throws if there is no active session; callers only use this from
 * authenticated surfaces.
 */
export async function billingFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("billingFetch called with no active session.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(path, { ...init, headers });
}

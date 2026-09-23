import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Server-only Supabase client authenticated with the service-role key.
 * Never import this from anything that ships to the browser -- it bypasses
 * every RLS policy by design (see supabase/migrations/<this PR>'s own
 * comments: billing_customers/billing_subscriptions/billing_webhook_events
 * grant zero client write access, on purpose, precisely because this is the
 * only path allowed to write them).
 *
 * `SUPABASE_SERVICE_ROLE_KEY` is already documented in .env.example as
 * "Managed by the platform... privileged; server runtime only" -- this is
 * the first application code in this repo to actually read it.
 */

// New-format Supabase API keys (sb_secret_..., sb_publishable_...) are
// opaque strings, not bearer JWTs -- mirrors src/integrations/supabase/
// client.ts's own isNewSupabaseApiKey/createSupabaseFetch (that file is
// generated, so this is duplicated here rather than imported from it).
// supabase-js's default fetch always sends `Authorization: Bearer
// <supabaseKey>` alongside `apikey: <supabaseKey>` for every PostgREST/
// Auth-admin request made with this client (confirmed in
// node_modules/@supabase/supabase-js: getAccessToken() falls back to
// this.supabaseKey when there's no session, which persistSession:false
// guarantees here) -- Supabase's gateway tries to verify that
// Authorization value as a JWT first, and with a new-format key that
// verification fails before the (correct) apikey header is ever
// consulted, so every request 500s with "Invalid API key" even though
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are both present and correct.
// Root-caused from production logs after PR #39 made GET
// /api/billing/status reachable for the first time (it was unreachable
// before that fix, so this pre-existing defect was never exercised).
function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/** Exported for src/lib/billing/supabaseAdmin.test.ts -- see that file for why this needs direct coverage. */
export function createServiceRoleFetch(serviceRoleKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      isNewSupabaseApiKey(serviceRoleKey) &&
      headers.get("Authorization") === `Bearer ${serviceRoleKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", serviceRoleKey);
    return fetch(input, { ...init, headers });
  };
}

let cachedAdminClient: SupabaseClient<Database> | undefined;

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceRoleKey) {
    const missing = [
      ...(!url ? ["SUPABASE_URL"] : []),
      ...(!serviceRoleKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  cachedAdminClient = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createServiceRoleFetch(serviceRoleKey) },
  });
  return cachedAdminClient;
}

/** Test-only escape hatch, mirroring stripe.ts's own pattern. */
export function __setSupabaseAdminClientForTests(client: SupabaseClient<Database> | undefined) {
  cachedAdminClient = client;
}

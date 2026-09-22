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
  });
  return cachedAdminClient;
}

/** Test-only escape hatch, mirroring stripe.ts's own pattern. */
export function __setSupabaseAdminClientForTests(client: SupabaseClient<Database> | undefined) {
  cachedAdminClient = client;
}

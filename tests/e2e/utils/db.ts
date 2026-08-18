import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, "../../../playwright/.auth/user.json");

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. Copy .env.test.example to .env.test and fill it in.`,
    );
  }
  return value;
}

type TestUserClient = { client: SupabaseClient; userId: string; email: string; password: string };

let cached: Promise<TestUserClient> | null = null;

/**
 * Returns a publishable-key client (never a service-role key) authenticated
 * as the shared E2E test account, so every DB assertion below runs through
 * the same RLS policies real learners are subject to.
 *
 * This restores the *browser's own* session (from the storageState file
 * auth.setup.ts writes) via setSession, rather than doing its own
 * signInWithPassword. Every spec file used to sign in fresh, and Supabase
 * Auth was observed to revoke the browser's session once enough concurrent
 * sign-ins piled up for the same account (getUser() started failing with
 * "session_not_found") — spec files would then get redirected to /auth
 * outright. Sharing one session for the whole run avoids creating that
 * concurrency in the first place. Cached per worker process since the
 * session doesn't change during a run.
 */
export async function createTestUserClient(): Promise<TestUserClient> {
  if (!cached) cached = restoreBrowserSession();
  return cached;
}

/**
 * Fresh password sign-in for auth.setup.ts only: it runs before any browser
 * session exists yet, and immediately signs this session back out again as
 * part of resetting the account — it must never be shared via the cache
 * above.
 */
export async function createFreshTestUserClient(): Promise<TestUserClient> {
  const email = env("E2E_TEST_EMAIL");
  const password = env("E2E_TEST_PASSWORD");
  const client = createClient(env("VITE_SUPABASE_URL"), env("VITE_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(
      `E2E test user could not sign in (${email}): ${error?.message ?? "no user returned"}. ` +
        `Confirm the account exists, its email is confirmed, and credentials match .env.test.`,
    );
  }
  return { client, userId: data.user.id, email, password };
}

async function restoreBrowserSession(): Promise<TestUserClient> {
  const email = env("E2E_TEST_EMAIL");
  const password = env("E2E_TEST_PASSWORD");
  const client = createClient(env("VITE_SUPABASE_URL"), env("VITE_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let state: { origins?: { localStorage?: { name: string; value: string }[] }[] };
  try {
    state = JSON.parse(readFileSync(authFile, "utf8"));
  } catch {
    throw new Error(
      `Could not read the browser's session from ${authFile}. auth.setup.ts must run before any ` +
        `spec that calls createTestUserClient().`,
    );
  }
  const item = state.origins
    ?.flatMap((o) => o.localStorage ?? [])
    .find((i) => /^sb-.*-auth-token$/.test(i.name));
  if (!item) {
    throw new Error(`No Supabase session found in ${authFile}. Has auth.setup.ts run yet?`);
  }
  const stored = JSON.parse(item.value) as { access_token: string; refresh_token: string };

  const { data, error } = await client.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  });
  if (error || !data.user) {
    throw new Error(`Failed to restore the browser's session: ${error?.message ?? "no user returned"}`);
  }
  return { client, userId: data.user.id, email, password };
}

/** Wipes every mutable row owned by the test account so specs start from a known state. */
export async function resetTestUserData(client: SupabaseClient, userId: string) {
  const deletions = [
    "study_sessions",
    "practice_attempts",
    "review_items",
    "weak_areas",
    "placement_attempts",
    "learning_paths", // cascades learning_path_steps
    "user_vocabulary",
  ];
  for (const table of deletions) {
    const { error } = await client.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Failed to reset ${table}: ${error.message}`);
  }

  const { error: streakError } = await client
    .from("streaks")
    .update({ current_streak: 0, longest_streak: 0, last_active_date: null })
    .eq("user_id", userId);
  if (streakError) throw new Error(`Failed to reset streaks: ${streakError.message}`);

  const { error: prefsError } = await client
    .from("learning_preferences")
    .update({
      onboarding_completed: false,
      arabic_level: null,
      primary_goal: null,
      daily_goal_minutes: 10,
    })
    .eq("user_id", userId);
  if (prefsError) throw new Error(`Failed to reset learning_preferences: ${prefsError.message}`);

  const { error: profileError } = await client
    .from("profiles")
    .update({ interface_language: "en" })
    .eq("id", userId);
  if (profileError) throw new Error(`Failed to reset profile: ${profileError.message}`);
}

export async function countRows(
  client: SupabaseClient,
  table: string,
  userId: string,
  userIdColumn = "user_id",
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(userIdColumn, userId);
  if (error) throw error;
  return count ?? 0;
}

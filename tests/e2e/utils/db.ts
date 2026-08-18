import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. Copy .env.test.example to .env.test and fill it in.`,
    );
  }
  return value;
}

/**
 * Signs the shared E2E test account in with its own publishable-key client
 * (never a service-role key) so every DB assertion below runs through the
 * same RLS policies real learners are subject to.
 */
export async function createTestUserClient(): Promise<{
  client: SupabaseClient;
  userId: string;
  email: string;
  password: string;
}> {
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

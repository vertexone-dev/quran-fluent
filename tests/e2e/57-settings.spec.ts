import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Settings had no dedicated coverage before this file. Focused on the two
 * defects this audit found and fixed -- the daily-goal field accepting any
 * value with no upper bound, and a failed load silently falling through to
 * a form full of blank/default values with no error state at all -- plus a
 * basic save-and-persist happy path for the page's other controls, since
 * neither existed.
 */
test.describe("settings", () => {
  test.afterEach(async () => {
    // Leaves the daily goal, first name and reciter changed; other specs
    // that read them (e.g. dashboard/progress goal displays, and
    // 55-dashboard-mobile-greeting.spec.ts's generic-fallback-name
    // assertion) expect the account's normal baseline, not whatever this
    // file's tests last saved. first_name back to null (not a guessed
    // string) is what resolveGreetingName's own null/empty branch expects;
    // preferred_reciter back to the column's schema default.
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ daily_goal_minutes: 10, preferred_reciter: "mishary_alafasy" })
      .eq("user_id", userId);
    await client.from("profiles").update({ first_name: null }).eq("id", userId);
  });

  // Regression test: min={1} max={240} on this field were HTML/spinner
  // hints only -- typing e.g. 99999 directly set daily_goal_minutes to
  // 99999 with nothing else in the save path re-checking it. Confirmed
  // against the database, not just the input's own displayed value.
  test("a daily-goal value above 240 is clamped before it can be saved", async ({ page }) => {
    await page.goto("/settings");
    const dailyGoal = page.getByLabel("Daily goal (minutes)");
    await dailyGoal.fill("99999");
    await expect(dailyGoal).toHaveValue("240");

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();

    const { client, userId } = await createTestUserClient();
    const { data } = await client
      .from("learning_preferences")
      .select("daily_goal_minutes")
      .eq("user_id", userId)
      .single();
    expect(data?.daily_goal_minutes).toBe(240);
  });

  // Regression test: fetchLearnerSnapshot (src/lib/learner.ts) never
  // checked .error on any of its three queries, so a failed load still
  // resolved "successfully" with an all-null snapshot -- isError never
  // became true, and this page had no branch for it anyway. The form
  // rendered with every field at its blank initial state instead of the
  // learner's real saved values, one Save click away from overwriting
  // them. Both the missing isError branch and the swallowed error are
  // fixed; this asserts the visible, user-facing symptom either could
  // cause: no silent blank form, and Retry actually recovers.
  test("a failed load shows an error state and never falls through to a blank form", async ({
    page,
  }) => {
    // Settings' own query is capped at retry:1, but it isn't the only
    // consumer of the profiles table: src/lib/i18n.tsx independently fetches
    // interface_language for the same user on mount. Blanket-aborting every
    // /rest/v1/profiles* request (the only way to deterministically fail
    // this page's load) fails that fetch too, and real browser measurement
    // (repeated runs against the dev server) showed the combined retries
    // and connection contention push this page's own isError past 15s,
    // typically resolving around 20s. Generous, measured timeouts here
    // rather than a tight one that assumes a single isolated query.
    test.setTimeout(60_000);

    let blocked = true;
    await page.route("**/rest/v1/profiles*", (route) => {
      if (blocked) return route.abort("failed");
      return route.continue();
    });

    await page.goto("/settings");
    await expect(page.getByText("Couldn't load your settings.")).toBeVisible({ timeout: 35_000 });
    // The form -- and critically, its Save button -- must not be reachable
    // while the real data failed to load.
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await expect(page.getByLabel("First name")).toHaveCount(0);

    blocked = false;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("changing the first name and reciter persists after reload", async ({ page }) => {
    const { client, userId } = await createTestUserClient();

    await page.goto("/settings");
    await page.getByLabel("First name").fill("Test Learner");
    await page.getByLabel("Preferred reciter").click();
    await page.getByRole("option", { name: "Mahmoud Khalil Al-Husary" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("First name")).toHaveValue("Test Learner");
    await expect(page.getByLabel("Preferred reciter")).toContainText("Mahmoud Khalil Al-Husary");

    const { data: profile } = await client
      .from("profiles")
      .select("first_name")
      .eq("id", userId)
      .single();
    expect(profile?.first_name).toBe("Test Learner");
    const { data: prefs } = await client
      .from("learning_preferences")
      .select("preferred_reciter")
      .eq("user_id", userId)
      .single();
    expect(prefs?.preferred_reciter).toBe("husary");
  });
});

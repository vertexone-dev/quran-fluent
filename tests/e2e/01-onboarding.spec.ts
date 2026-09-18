import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

test.describe("onboarding", () => {
  test("completing all four steps saves preferences and reaches the placement test", async ({
    page,
  }) => {
    await page.goto("/onboarding");

    // Step 1: Arabic level.
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await page.getByRole("button", { name: "Complete beginner" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: primary goal.
    await page.getByRole("button", { name: "Learn to read the Qur'an" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: daily goal minutes.
    await page.getByRole("button", { name: "15 minutes a day" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: interface language. Exact match: the header's own language
    // switcher also has "English" as a substring of its accessible name.
    await page.getByRole("button", { name: "English", exact: true }).click();

    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page).toHaveURL(/\/placement/, { timeout: 10_000 });

    const { client, userId } = await createTestUserClient();
    const { data: prefs } = await client
      .from("learning_preferences")
      .select("onboarding_completed, arabic_level, primary_goal, daily_goal_minutes")
      .eq("user_id", userId)
      .single();
    expect(prefs?.onboarding_completed).toBe(true);
    expect(prefs?.arabic_level).toBe("complete_beginner");
    expect(prefs?.primary_goal).toBe("read_quran");
    expect(prefs?.daily_goal_minutes).toBe(15);
  });

  test("continue is disabled until a choice is made on each step", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await page.getByRole("button", { name: "Complete beginner" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("back returns to the previous step without losing the earlier answer", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Complete beginner" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Back" }).click();

    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete beginner" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  // Regression test: the custom-minutes field declared min={1} max={240}
  // but only ever enforced the floor (`parsed > 0`) -- typing e.g. 9999
  // set the daily goal to 9999 with nothing else in the path re-checking
  // it, and onboarding saved that value verbatim on Finish setup. Settings
  // (src/routes/_authenticated/settings.tsx) had the identical gap on its
  // own daily-goal field.
  test("a custom daily-goal minutes value above 240 is clamped, not saved verbatim", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Complete beginner" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Learn to read the Qur'an" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const customMinutes = page.getByLabel("Custom");
    await customMinutes.fill("9999");
    await expect(customMinutes).toHaveValue("240");

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page).toHaveURL(/\/placement/, { timeout: 10_000 });

    const { client, userId } = await createTestUserClient();
    const { data: prefs } = await client
      .from("learning_preferences")
      .select("daily_goal_minutes")
      .eq("user_id", userId)
      .single();
    expect(prefs?.daily_goal_minutes).toBe(240);
  });
});

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
});

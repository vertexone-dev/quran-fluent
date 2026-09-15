import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

test.describe("memorization", () => {
  // Both tests below navigate to /memorize and, in the first test, to
  // /dashboard. Root cause of a previously-failing "1 Ayat memorized" check
  // (confirmed via a Playwright trace screenshot, not guessed): with
  // onboarding_completed left false, /dashboard's own client-side effect
  // redirects straight to /onboarding before the memorization card ever
  // renders -- a stale-state/navigation-timing symptom, not a data-write or
  // query-caching bug (the write itself was already independently proven
  // durable by this test's own DB poll before the dashboard assertion).
  // global-setup.ts resets onboarding_completed to false once per whole
  // run; only 01-onboarding.spec.ts's own test flips it back to true, so
  // this spec implicitly depended on running after that one in the same
  // invocation -- true in the full suite, but silently false (and
  // reproducibly failing) whenever this file runs on its own, e.g. via
  // `playwright test tests/e2e/12-memorization.spec.ts`. Setting it
  // explicitly here removes that hidden cross-file ordering dependency,
  // matching the same defensive pattern already used by
  // 36-level2-release-audit-journey.spec.ts.
  test.beforeEach(async () => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);
  });

  test("starting, memorizing and reviewing an Ayah persists and updates the dashboard", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("memorization_progress").delete().eq("user_id", userId);
    await client.from("review_items").delete().eq("user_id", userId).eq("item_type", "ayah");

    await page.goto("/memorize");
    await expect(page.getByRole("heading", { name: "Memorize" })).toBeVisible();
    await expect(
      page.getByText("Choose a Surah and begin memorizing one Ayah at a time."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Start this Surah" }).first().click();
    await expect(page).toHaveURL(/surah=1/);
    await expect(page.getByText("Ayah 1")).toBeVisible();

    await page.getByRole("button", { name: "Mark as memorized" }).click();

    await expect
      .poll(async () => {
        const { data } = await client
          .from("memorization_progress")
          .select("status")
          .eq("user_id", userId)
          .eq("surah_number", 1)
          .eq("ayah_number", 1)
          .maybeSingle();
        return data?.status;
      })
      .toBe("memorized");

    // Marking memorized schedules the ayah into the existing review engine
    // (review_items), not a separate scheduling system.
    const { count: reviewCount } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("item_type", "ayah")
      .eq("item_key", "ayah:1:1");
    expect(reviewCount).toBe(1);

    await page.reload();
    await expect(page.getByText("Memorized", { exact: true })).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText("1 Ayat memorized")).toBeVisible();
  });

  test("adding an Ayah to review without marking it memorized keeps it as learning", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("memorization_progress").delete().eq("user_id", userId);
    await client.from("review_items").delete().eq("user_id", userId).eq("item_type", "ayah");

    await page.goto("/memorize?surah=112&ayah=1");
    await page.getByRole("button", { name: "Add to Review" }).click();

    await expect
      .poll(async () => {
        const { data } = await client
          .from("memorization_progress")
          .select("status")
          .eq("user_id", userId)
          .eq("surah_number", 112)
          .eq("ayah_number", 1)
          .maybeSingle();
        return data?.status;
      })
      .toBe("learning");

    const { count } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("item_key", "ayah:112:1");
    expect(count).toBe(1);
  });
});

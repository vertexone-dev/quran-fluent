import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

test.describe("memorization", () => {
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

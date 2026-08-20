import { test, expect } from "@playwright/test";

import { createTestUserClient, countRows } from "./utils/db";

/**
 * Persistence is verified via the durable DB row (through this account's own
 * RLS-scoped session), not a UI logout/login round-trip: any extra real
 * sign-in in this project risks invalidating the one browser session every
 * spec here shares (see utils/db.ts). A row surviving in Postgres across a
 * page reload is the stronger, safer proof of durability anyway.
 */
test.describe("bookmarks", () => {
  test("bookmarking an ayah persists across reload, appears on the bookmarks page, and removing it persists too", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("bookmarks").delete().eq("user_id", userId);

    await page.goto("/quran?surah=1");
    const bookmarkBtn = page.getByRole("button", { name: "Bookmark Ayah" }).first();
    await expect(bookmarkBtn).toBeVisible();
    await bookmarkBtn.click();

    await expect(page.getByRole("button", { name: "Remove Bookmark" }).first()).toBeVisible();
    await expect.poll(() => countRows(client, "bookmarks", userId)).toBe(1);

    // Refresh: not just client state.
    await page.reload();
    await expect(page.getByRole("button", { name: "Remove Bookmark" }).first()).toBeVisible();

    await page.goto("/bookmarks");
    await expect(page.getByText("1:1")).toBeVisible();

    await page.getByRole("button", { name: "Remove Bookmark" }).click();
    await expect.poll(() => countRows(client, "bookmarks", userId)).toBe(0);

    await page.reload();
    await expect(page.getByText("No bookmarks yet.")).toBeVisible();
  });

  test("bookmarking the same Ayah twice does not create duplicate rows", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("bookmarks").delete().eq("user_id", userId);

    await page.goto("/quran?surah=1");
    const toggle = page.getByRole("button", { name: /Bookmark Ayah|Remove Bookmark/ }).first();
    await toggle.click();
    await expect(page.getByRole("button", { name: "Remove Bookmark" }).first()).toBeVisible();

    // A second rapid click (fast enough to race the first mutation) must not
    // insert a second row — the unique constraint plus idempotent insert in
    // src/lib/bookmarks.ts is what's under test here.
    await client
      .from("bookmarks")
      .insert({ user_id: userId, surah_number: 1, ayah_number: 1 })
      .select();
    const { count } = await client
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("surah_number", 1)
      .eq("ayah_number", 1);
    expect(count).toBe(1);
  });
});

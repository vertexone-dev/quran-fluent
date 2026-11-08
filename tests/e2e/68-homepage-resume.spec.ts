import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

// QR-INT-005: the hero's "Continue Reading" resumes at the learner's most
// recent bookmark -- the only genuine saved reading position this app
// stores -- and falls back to the plain reader (no invented position or
// percentage) when there is none. Uses the shared test account, so every
// test cleans up the bookmarks it creates.
test.describe("homepage Continue Reading (signed in)", () => {
  test("with no bookmarks it opens the plain reader and shows no resume line", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("bookmarks").delete().eq("user_id", userId);

    await page.goto("/");
    const cta = page.getByTestId("hero-continue-reading-button");
    await expect(cta).toHaveAttribute("href", "/quran");
    await expect(page.getByTestId("hero-resume-position")).toHaveCount(0);
  });

  test("with a bookmark it deep-links to that exact ayah and says where it resumes", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("bookmarks").delete().eq("user_id", userId);
    await client.from("bookmarks").insert({ user_id: userId, surah_number: 2, ayah_number: 152 });

    try {
      await page.goto("/");
      const cta = page.getByTestId("hero-continue-reading-button");
      await expect(cta).toHaveAttribute("href", /\/quran\?surah=2&ayah=152$/);
      await expect(page.getByTestId("hero-resume-position")).toContainText(/Ayah 152/);
      await cta.click();
      await expect(page).toHaveURL(/\/quran\?surah=2&ayah=152/);
    } finally {
      await client.from("bookmarks").delete().eq("user_id", userId);
    }
  });
});

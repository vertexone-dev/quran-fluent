import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

test.describe("localization (EN/FR)", () => {
  /**
   * Always restore the shared E2E user's locale to English.
   *
   * This runs even when a localization assertion fails, preventing this
   * spec from leaking French profile state into bookmarks, notes,
   * memorization, practice, or any later authenticated spec.
   */
  test.afterEach(async () => {
    const { client, userId } = await createTestUserClient();

    const { error } = await client
      .from("profiles")
      .update({
        interface_language: "en",
      })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to restore E2E profile language to English: ${error.message}`);
    }

    await expect
      .poll(async () => {
        const { data, error: readError } = await client
          .from("profiles")
          .select("interface_language")
          .eq("id", userId)
          .single();

        if (readError) {
          throw readError;
        }

        return data?.interface_language;
      })
      .toBe("en");
  });

  test("switching to French updates the UI, the <html lang>, and persists to the profile", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    const switcher = page
      .getByRole("group", {
        name: "Change language",
      })
      .first();

    await switcher
      .getByRole("button", {
        name: /FR/,
      })
      .click();

    /*
     * Verify the document locale changed.
     */
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    /*
     * Verify translated UI appeared.
     *
     * The language switcher's accessible label itself is translated,
     * making it a stable indication that the UI switched to French.
     *
     * This is more reliable than depending on one specific navigation
     * link such as "Tableau de bord".
     */
    await expect(
      page
        .getByRole("group", {
          name: "Changer de langue",
        })
        .first(),
    ).toBeVisible();

    /*
     * Verify French was persisted to the authenticated user's profile.
     */
    const { client, userId } = await createTestUserClient();

    await expect
      .poll(async () => {
        const { data, error } = await client
          .from("profiles")
          .select("interface_language")
          .eq("id", userId)
          .single();

        if (error) {
          throw error;
        }

        return data?.interface_language;
      })
      .toBe("fr");

    /*
     * Verify persistence across a browser reload rather than merely
     * checking transient client-side state.
     */
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    await expect(
      page
        .getByRole("group", {
          name: "Changer de langue",
        })
        .first(),
    ).toBeVisible();

    /*
     * We intentionally do NOT reset the profile here.
     *
     * afterEach performs the cleanup so it happens whether this test
     * passes or throws at any assertion above.
     */
  });

  test("UI direction stays LTR while embedded Arabic content is marked RTL", async ({ page }) => {
    await page.goto("/quran");

    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    const bismillah = page.getByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");

    await expect(bismillah).toHaveAttribute("dir", "rtl");
    await expect(bismillah).toHaveAttribute("lang", "ar");
  });
});

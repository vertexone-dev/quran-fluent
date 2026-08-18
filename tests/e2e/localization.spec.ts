import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

test.describe("localization (EN/FR)", () => {
  test("switching to French updates the UI, the <html lang>, and persists to the profile", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    const switcher = page.getByRole("group", { name: "Change language" }).first();
    await switcher.getByRole("button", { name: /FR/ }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("link", { name: "Tableau de bord" })).toBeVisible();

    const { client, userId } = await createTestUserClient();
    await expect
      .poll(async () => {
        const { data } = await client
          .from("profiles")
          .select("interface_language")
          .eq("id", userId)
          .single();
        return data?.interface_language;
      })
      .toBe("fr");

    // Persists across a reload, not just client-side state.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("link", { name: "Tableau de bord" })).toBeVisible();

    // Reset to English so downstream specs see the default locale's copy.
    // The switcher's own aria-label is translated too, so it's now French.
    const switcherAfterReload = page.getByRole("group", { name: "Changer de langue" }).first();
    await switcherAfterReload.getByRole("button", { name: /^EN/ }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("UI direction stays LTR while embedded Arabic content is marked RTL", async ({ page }) => {
    await page.goto("/quran");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    const bismillah = page.getByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");
    await expect(bismillah).toHaveAttribute("dir", "rtl");
    await expect(bismillah).toHaveAttribute("lang", "ar");
  });
});

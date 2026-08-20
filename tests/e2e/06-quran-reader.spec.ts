import { test, expect } from "@playwright/test";

/**
 * Covers the typography preview and data-architecture teaser sections of
 * /quran. The Ayah reader itself (Surah picker, bookmark/note/memorize
 * actions) is covered by 10-bookmarks/11-notes/12-memorization.spec.ts, and
 * the vocabulary browser by 05-vocabulary.spec.ts.
 */
test.describe("Qur'an page (typography preview + data architecture)", () => {
  test("shows the Bismillah typography sample and explains the data layers", async ({ page }) => {
    await page.goto("/quran");

    await expect(page.getByRole("heading", { name: "Interactive Qur'an study" })).toBeVisible();
    await expect(page.getByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")).toBeVisible();
    await expect(page.getByText("Typography preview")).toBeVisible();

    await expect(page.getByRole("heading", { name: "How Qur'an data is handled" })).toBeVisible();
    await expect(page.getByText("Qur'anic Arabic", { exact: true })).toBeVisible();
    await expect(page.getByText("Translations", { exact: true })).toBeVisible();
    await expect(page.getByText("Tafsir", { exact: true })).toBeVisible();

    await expect(
      page.getByText("English — Marmaduke Pickthall (Project Gutenberg eBook #16955)"),
    ).toBeVisible();
    await expect(page.getByText("French — Muhammad Hamidullah")).toBeVisible();
  });

  test("is reachable without signing in", async ({ browser }) => {
    const context = await browser.newContext(); // no storage state
    const page = await context.newPage();
    await page.goto("/quran");
    await expect(page.getByRole("heading", { name: "Interactive Qur'an study" })).toBeVisible();
    await expect(page.getByText("Sign in to save words for review.")).toBeVisible();
    await context.close();
  });
});

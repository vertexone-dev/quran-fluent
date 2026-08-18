import { test, expect } from "@playwright/test";

/**
 * The verse-by-verse Qur'an reader itself is roadmap (Phase 3, per the page's
 * own copy) — /quran today is a typography preview plus the vocabulary
 * browser (covered in vocabulary.spec.ts). This spec covers the read-only
 * content that does exist.
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

    await expect(page.getByText("English — Saheeh International")).toBeVisible();
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

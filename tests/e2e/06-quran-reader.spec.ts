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

    // Data layers and translations now live behind their own tabs (mobile-
    // density pass 2's progressive disclosure for /quran's secondary
    // sections) instead of always-visible stacked sections below the
    // reader -- select each tab before asserting on its panel's content.
    // Layer names are asserted via role: "heading" rather than getByText,
    // since "Translations" is also the accessible name of its own tab
    // trigger -- getByText would match both and violate strict mode.
    await page.getByRole("tab", { name: "Sources" }).click();
    await expect(page.getByRole("heading", { name: "How Qur'an data is handled" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Qur'anic Arabic", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Translations", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tafsir", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Translations" }).click();
    await expect(
      page.getByText("English — Marmaduke Pickthall (Project Gutenberg eBook #16955)"),
    ).toBeVisible();
    await expect(
      page.getByText("French — Albin de Kazimirski Biberstein, Le Koran (1869)"),
    ).toBeVisible();
  });

  test("public copy accurately describes the complete, already-live Mushaf and curriculum, not stale pre-launch placeholders", async ({
    page,
  }) => {
    // Regression test: /quran and /learn's own public marketing copy
    // previously claimed "a curated set of short... Surahs" with "the
    // complete Mushaf arrives in a later phase", and "Lesson content
    // arrives in Phase 2" -- both false by the time of this sprint (the
    // full 114-surah/6,236-ayah Mushaf and 58 real, fully bilingual
    // lessons across 5 levels are already live in production; see
    // 15-full-dataset.spec.ts and the content-integrity validator).
    await page.goto("/quran");
    await expect(page.getByText(/complete Mushaf.*114 Surahs.*6,236 Ayahs/)).toBeVisible();
    await expect(page.getByText(/complete Mushaf arrives in a later phase/)).toHaveCount(0);

    await page.goto("/learn");
    await expect(page.getByText(/Levels 1 through 5 are live now/)).toBeVisible();
    await expect(page.getByText(/Lesson content arrives in Phase 2/)).toHaveCount(0);
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

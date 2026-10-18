import { test, expect } from "@playwright/test";

/**
 * Offline mobile Reader regression suite. Written because the existing
 * root-level Playwright specs that cover the Reader (06/14/15/49/50) run
 * against a local dev server backed by a local Supabase stack this
 * engagement has never stood up, and the one production-safe spec (51)
 * writes a real test user via createTestUserClient() -- unsafe to run
 * here. This suite needs none of that: every assertion below reads real,
 * live-exported production content from the bundled SQLite file, with
 * zero network requests of any kind (see offline.spec.ts).
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
});

test.describe("Surah List", () => {
  test("lists real surahs with Arabic names, and search filters them", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await expect(page.locator(".list-row")).toHaveCount(114, { timeout: 10_000 });
    await expect(page.locator(".list-row").first()).toContainText("Al-Fatiha");
    await expect(page.locator(".list-row").first()).toContainText("سُورَةُ");

    await page.locator("input[placeholder='Search surahs']").fill("Baqara");
    await expect(page.locator(".list-row")).toHaveCount(1);
    await expect(page.locator(".list-row").first()).toContainText("Al-Baqara");
  });

  test("Makki/Madani filter narrows the real revelation_type split", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.locator(".chip", { hasText: "Madani" }).click();
    const count = await page.locator(".list-row").count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(114);
    await expect(page.locator(".list-row").first()).toContainText("Madani");
  });

  test("favoriting a surah persists locally across a reload", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.locator(".list-row").first().locator("button[aria-label='favorite']").click();

    await page.reload();
    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.locator(".chip", { hasText: "Favorites" }).click();
    await expect(page.locator(".list-row")).toHaveCount(1);
    await expect(page.locator(".list-row").first()).toContainText("Al-Fatiha");
  });
});

test.describe("Reading View", () => {
  test("renders the real certified Al-Fatiha text in all three languages", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.locator(".list-row", { hasText: "Al-Fatiha" }).click();
    await expect(page.locator("h1")).toHaveText("Al-Fatiha");

    // Arabic tab is selected by default.
    await expect(page.locator(".quran-text").first()).toContainText("بِسْمِ");

    await page.locator(".chip", { hasText: "English" }).click();
    await expect(page.locator(".card").first()).toContainText(/In the name of Allah/i);

    await page.locator(".chip", { hasText: "French" }).click();
    await expect(page.locator(".card").first()).toContainText(/Dieu/);
  });

  test("every ayah in Al-Fatiha renders (no silent gaps)", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.locator(".list-row", { hasText: "Al-Fatiha" }).click();
    await expect(page.locator(".card")).toHaveCount(7);
  });
});

test.describe("Words browser and Word Details", () => {
  test("searching and opening a word shows real root/meaning/occurrences, never Part of Speech", async ({
    page,
  }) => {
    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.locator("text=Words").click();
    await page.locator("input[placeholder='Search words']").fill("Allah");
    await page.locator(".list-row").first().click();

    await expect(page.locator("h1")).toHaveText("Word Details");
    await expect(page.locator("text=Part of Speech")).toHaveCount(0);
    await expect(page.locator("text=Root")).toBeVisible();
    await expect(page.locator("text=Occurrences in the Qur'an")).toBeVisible();
  });
});

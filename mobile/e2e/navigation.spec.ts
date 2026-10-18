import { test, expect } from "@playwright/test";

/**
 * Regression guard for the HistoryContext-based navigation stack (see
 * mobile/src/HistoryContext.tsx and MainActivity.java's onBackPressed
 * override). The WebView's real back/forward history must stay a 1:1
 * mirror of the app's own navigation state -- this is what makes the
 * Android hardware back button step back one screen at a time instead of
 * exiting the app immediately. page.goBack() here exercises the exact
 * same window.history.back() / popstate path a hardware back-press
 * triggers on-device.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
});

test("back steps out of a drilled-down screen before leaving the tab", async ({ page }) => {
  await page.locator(".tab-item", { hasText: "Qur'an" }).click();
  await page.locator(".list-row", { hasText: "Al-Fatiha" }).click();
  await expect(page.locator("h1")).toHaveText("Al-Fatiha");

  await page.goBack();
  await expect(page.locator(".appbar-title")).toHaveText("Surahs");
});

test("back unwinds a tab switch back to the previously active tab", async ({ page }) => {
  await page.locator(".tab-item", { hasText: "Qur'an" }).click();
  await expect(page.locator(".tab-item.active")).toContainText("Qur'an");

  await page.goBack();
  await expect(page.locator(".tab-item.active")).toContainText("Home");
});

test("back steps through a multi-level drill-down one screen at a time", async ({ page }) => {
  await page.locator(".tab-item", { hasText: "Lessons" }).click();
  await page.locator(".list-row").first().click(); // level
  const levelTitle = await page.locator("h1").first().textContent();
  await page.locator(".list-row").first().click(); // module
  const moduleTitle = await page.locator("h1").first().textContent();
  expect(moduleTitle).not.toBe(levelTitle);

  await page.goBack();
  await expect(page.locator("h1").first()).toHaveText(levelTitle ?? "");

  await page.goBack();
  await expect(page.locator(".appbar-title")).toHaveText("Lessons");
});

test("in-app back controls and browser back stay in sync (no double-pop)", async ({ page }) => {
  await page.locator(".tab-item", { hasText: "Qur'an" }).click();
  await page.locator(".list-row", { hasText: "Al-Fatiha" }).click();
  await page.locator(".back-button").click(); // in-app back arrow
  await expect(page.locator(".appbar-title")).toHaveText("Surahs");

  // Browser back from here should go to Home (the tab switch), not land
  // nowhere or throw -- proving the in-app tap and a real back both drive
  // the exact same history depth.
  await page.goBack();
  await expect(page.locator(".tab-item.active")).toContainText("Home");
});

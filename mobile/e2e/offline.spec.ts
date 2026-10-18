import { test, expect } from "@playwright/test";

/**
 * Automated version of the "zero network code" audit in the Phase 1
 * report: walks every main screen and asserts that not a single request
 * left the page for anything other than the dev server's own origin (the
 * two bundled local assets, sql-wasm.wasm and quran-content.sqlite, plus
 * the app's own JS/CSS). A real external host showing up here would mean
 * an offline-breaking regression, not just a code-review miss.
 */

test("no request ever leaves the page's own origin while browsing every main screen", async ({
  page,
  baseURL,
}) => {
  const appOrigin = new URL(baseURL ?? "http://localhost").origin;
  const externalRequests: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.origin !== appOrigin && url.protocol !== "data:") {
      externalRequests.push(req.url());
    }
  });

  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });

  await page.locator(".tab-item", { hasText: "Qur'an" }).click();
  await page.locator(".list-row", { hasText: "Al-Fatiha" }).click();
  await page.goBack();

  await page.locator(".tab-item", { hasText: "Lessons" }).click();
  await page.locator(".list-row").first().click();
  await page.locator(".list-row").first().click();

  await page.locator(".tab-item", { hasText: "Practice" }).click();
  await page.locator(".tab-item", { hasText: "More" }).click();
  await page.locator(".list-row", { hasText: "Offline Access" }).click();
  await page.goBack();
  await page.locator(".list-row", { hasText: "Settings" }).click();

  expect(externalRequests, "no request should ever leave the app's own origin").toEqual([]);
});

import { test, expect, type Page } from "@playwright/test";

import { installQuranFixture } from "./fixtures/quran-fixture";

/**
 * QR-WEB-015C: (1) Arabic UI shows the stored canonical Arabic surah name
 * (never the English/transliterated name), with diacritic-insensitive search;
 * (2) the Understand tab strip is a clean 2-column grid at phone widths with
 * 44px touch targets and no horizontal overflow, in EN/FR/AR; keyboard
 * navigation and RTL direction are preserved. Fixture-backed, signed-out.
 */

type Locale = "en" | "fr" | "ar";

async function open(page: Page, path: string, locale: Locale) {
  await installQuranFixture(page);
  await page.addInitScript((l) => localStorage.setItem("quranroots-locale", l), locale);
  await page.goto(path);
  await page.waitForFunction(() => {
    const tsr = (window as unknown as { $_TSR?: { hydrated?: boolean } }).$_TSR;
    return !tsr || tsr.hydrated === true;
  });
}

test.describe("Arabic surah names", () => {
  test("Understand page label uses name_ar in Arabic; EN/FR unchanged", async ({ page }) => {
    await open(page, "/quran/understand?surah=1&ayah=2", "ar");
    const main = page.getByTestId("understand-page");
    await expect(main).toContainText("الفاتحة");
    await expect(main).not.toContainText("Al-Faatiha");
    await expect(main).not.toContainText("The Opening");
  });

  test("English keeps the English name", async ({ page }) => {
    await open(page, "/quran/understand?surah=1&ayah=2", "en");
    await expect(page.getByTestId("understand-page")).toContainText("The Opening");
  });

  test("search lists Arabic names and finds a surah by an undiacritised query", async ({
    page,
  }) => {
    await open(page, "/", "ar");
    await page.getByTestId("header-search-button").click();
    const item = page.getByTestId("search-result-2");
    await expect(item).toContainText("البقرة");
    await expect(item).not.toContainText("The Cow");
    await page.getByTestId("header-search-input").fill("البقرة");
    await expect(page.getByTestId("search-result-2")).toBeVisible();
  });
});

for (const width of [320, 390]) {
  for (const locale of ["en", "fr", "ar"] as const) {
    test(`Understand tabs at ${width}px (${locale}): 2-col grid, 44px targets, no overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, "/quran/understand?surah=1&ayah=2", locale);
      const list = page.getByRole("tablist");
      await expect(list).toBeVisible();
      const tabs = page.getByRole("tab");
      await expect(tabs).toHaveCount(4);
      const boxes = await tabs.evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return {
            w: r.width,
            h: r.height,
            top: Math.round(r.top),
            clipped: e.scrollWidth > e.clientWidth + 1,
          };
        }),
      );
      for (const b of boxes) {
        expect(b.h).toBeGreaterThanOrEqual(44);
        expect(b.clipped).toBe(false);
      }
      expect(new Set(boxes.map((b) => b.top)).size).toBe(2);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
      await expect(list).toHaveCSS("direction", locale === "ar" ? "rtl" : "ltr");
    });
  }
}

test("tab keyboard navigation and visible focus survive the grid layout (RTL)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, "/quran/understand?surah=1&ayah=2", "ar");
  const first = page.getByTestId("understand-tab-translations");
  await first.focus();
  await expect(first).toHaveAttribute("aria-selected", "true");
  // In RTL, ArrowLeft advances to the next tab (Radix mirrors the keys).
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("understand-tab-words")).toBeFocused();
  await expect(page.getByTestId("understand-tab-words")).toHaveAttribute("aria-selected", "true");
  const ring = await page
    .getByTestId("understand-tab-words")
    .evaluate((e) => getComputedStyle(e).boxShadow);
  expect(ring).not.toBe("none");
});

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

// QR-WEB-015E: bottom-nav labels must not be ellipsised at 320px in any
// language (French "Apprendre" used to render as "Apprend…"), and the home
// "Understand an Ayah" tab strip keeps >=44px touch targets at every width.
test.describe("QR-WEB-015E accessibility corrections", () => {
  for (const locale of ["en", "fr", "ar"] as const) {
    test(`320px bottom navigation shows every label in full (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await open(page, "/quran/understand?surah=1&ayah=2", locale);
      const labels = page.locator("nav[aria-label] li a span.truncate");
      await expect(labels).toHaveCount(5);
      const clipped = await labels.evaluateAll((els) =>
        els.filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent),
      );
      expect(clipped).toEqual([]);
    });
  }

  for (const width of [390, 768, 1440]) {
    test(`home tab strip targets are at least 44px tall at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, "/", "en");
      const tabs = page.getByTestId(/^understand-tab-/);
      expect(await tabs.count()).toBeGreaterThanOrEqual(4);
      const heights = await tabs.evaluateAll((els) =>
        els.map((e) => Math.round(e.getBoundingClientRect().height)),
      );
      for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
    });
  }
});

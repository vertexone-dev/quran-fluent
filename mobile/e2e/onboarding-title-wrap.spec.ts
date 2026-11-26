import { test, expect, type Page } from "@playwright/test";

/**
 * QR-FIX-009: the onboarding title must not break a word either. On an iPhone SE at the
 * largest accessibility size "QuranRoots" rendered as "QuranRo" / "ots" (the same cause
 * as the Home headline: rem-sized text plus `overflow-wrap: anywhere`). A word split
 * across two lines has more than one client rect.
 */
test.use({ storageState: { cookies: [], origins: [] } }); // a new user sees onboarding

async function splitWords(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel)!.firstChild as Text;
    const split: string[] = [];
    for (const m of (node.textContent ?? "").matchAll(/\S+/g)) {
      const r = document.createRange();
      r.setStart(node, m.index!);
      r.setEnd(node, m.index! + m[0].length);
      if (r.getClientRects().length > 1) split.push(m[0]);
    }
    return split;
  }, selector);
}

for (const lang of ["en", "fr", "ar"] as const) {
  for (const [width, height] of [
    [375, 667],
    [320, 568],
  ]) {
    for (const scale of [1, 2, 3.1]) {
      test(`${lang} onboarding title: no word is split, ${width}px at ${scale}x text`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await page.getByTestId("onboarding-screen").waitFor({ timeout: 15_000 });
        for (let i = 0; i < 3 && (await page.locator("html").getAttribute("lang")) !== lang; i++) {
          await page.getByTestId("onboarding-language").click();
        }
        await page.evaluate(
          (s) => document.documentElement.style.setProperty("--qr-system-text-scale", String(s)),
          scale,
        );
        await page.waitForTimeout(200);
        expect(await splitWords(page, ".onboarding-title")).toEqual([]);
      });
    }
  }
}

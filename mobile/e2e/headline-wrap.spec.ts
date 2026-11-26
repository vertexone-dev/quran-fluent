import { test, expect, type Page } from "@playwright/test";

/**
 * QR-FIX-009: a headline word must never be split across two lines. On an iPhone SE
 * at the largest accessibility size the French Home headline broke inside a word
 * ("Remonte" / "z"): `overflow-wrap: anywhere` (QR-DESIGN-007C) lets the browser
 * break a word that no longer fits. The measurement is per word: a word that spans
 * two lines has more than one client rect.
 */
async function boot(page: Page, lang: "en" | "fr" | "ar") {
  await page.goto("/");
  await page.getByTestId("home-screen").waitFor({ timeout: 15_000 });
  for (let i = 0; i < 3 && (await page.locator("html").getAttribute("lang")) !== lang; i++) {
    await page.getByTestId("home-language-toggle").click();
  }
  await expect(page.locator("html")).toHaveAttribute("lang", lang);
}

/** Words of the element whose text is laid out on more than one line. */
async function splitWords(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)!;
    const node = el.firstChild as Text;
    const text = node.textContent ?? "";
    const split: string[] = [];
    for (const m of text.matchAll(/\S+/g)) {
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
    [390, 844],
  ]) {
    for (const scale of [1, 2, 3.1]) {
      test(`${lang} Home headline: no word is split, ${width}px at ${scale}x text`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await boot(page, lang);
        await page.evaluate(
          (s) => document.documentElement.style.setProperty("--qr-system-text-scale", String(s)),
          scale,
        );
        await page.waitForTimeout(200);
        expect(await splitWords(page, ".brand-hero .tagline")).toEqual([]);
        // and nothing escapes the screen sideways
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
}

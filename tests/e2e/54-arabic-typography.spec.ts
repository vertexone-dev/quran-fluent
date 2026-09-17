import { test, expect } from "@playwright/test";

/**
 * Regression coverage for two Arabic-typography/alignment defects found
 * during a live-site audit and fixed in src/routes/index.tsx and
 * src/routes/quran.tsx.
 *
 * 1. Homepage "example word panel" (#word-study): its label/value <dl>
 *    mixed a right-aligned (dir="rtl") Arabic root value with three
 *    left-aligned English/French values in the same 2-column grid, so the
 *    root floated to the opposite edge of its cell from its own "Root"
 *    label -- the grid never actually lined up. Fixed by keeping dir="rtl"
 *    lang="ar" (still needed for correct Arabic glyph shaping/joining) but
 *    overriding the block-level alignment to text-left, so every value in
 *    the grid starts at the same edge as its label.
 *
 * 2. /quran's "most frequent words" vocabulary cards: the Arabic word used
 *    `text-quran text-2xl`, and Tailwind's own text-2xl utility silently
 *    overrode text-quran's own line-height (2.2, sized for Amiri's
 *    diacritics) down to ~1.33 -- leaving diacritics with almost no
 *    headroom above the transliteration line directly below (measured 0px
 *    gap). The root value was also plain, un-isolated text with no dir/lang
 *    or Arabic font, reading cramped against its label. Fixed by dropping
 *    text-2xl (text-quran's own sizing already applies), adding a small
 *    explicit gap before the transliteration, and isolating the root value
 *    in its own dir="rtl" lang="ar" font-arabic span.
 */

test.describe("Arabic typography and alignment", () => {
  test("homepage example word panel: every value left-aligns under its own label", async ({
    page,
  }) => {
    await page.goto("/");
    const panel = page.locator("#word-study").locator("xpath=ancestor::section[1] >> dl");
    const pairs = panel.locator("> div");
    await expect(pairs).toHaveCount(4);

    for (let i = 0; i < 4; i++) {
      const pair = pairs.nth(i);
      const dtBox = await pair.locator("dt").boundingBox();
      const ddBox = await pair.locator("dd").boundingBox();
      expect(dtBox).not.toBeNull();
      expect(ddBox).not.toBeNull();
      // The value's left edge must match its own label's left edge --
      // this is what "root floats to the opposite side of the grid cell"
      // looked like before the fix: a several-hundred-pixel mismatch.
      expect(Math.abs(dtBox!.x - ddBox!.x)).toBeLessThanOrEqual(1);
    }

    // The root value keeps dir="rtl" lang="ar" for correct glyph shaping --
    // fixing the alignment must not have dropped that.
    const rootValue = panel.locator("dd[dir='rtl'][lang='ar']");
    await expect(rootValue).toBeVisible();
  });

  test("homepage example word panel: the Arabic headline word aligns under the panel label, not floated to the opposite edge", async ({
    page,
  }) => {
    await page.goto("/");
    const section = page.locator("#word-study").locator("xpath=ancestor::section[1]");
    const labelBox = await section.locator("p.text-xs.uppercase").boundingBox();
    const wordBox = await section.locator("p.font-arabic.text-4xl").boundingBox();
    expect(labelBox).not.toBeNull();
    expect(wordBox).not.toBeNull();
    expect(Math.abs(labelBox!.x - wordBox!.x)).toBeLessThanOrEqual(1);
  });

  test("/quran vocabulary cards: the Arabic word's line height leaves real headroom for diacritics, and the transliteration is visibly separated below it", async ({
    page,
  }) => {
    await page.goto("/quran");
    // Anchored on the grid's own data-testid rather than a class/depth path
    // from #vocabulary -- mobile-density pass 2 moved this grid inside the
    // Vocabulary tab's panel, changing its ancestor structure without
    // changing anything this test actually cares about.
    const firstCard = page.getByTestId("vocabulary-grid").locator(":scope > *").first();
    await expect(firstCard).toBeVisible();

    const metrics = await firstCard.evaluate((card) => {
      const word = card.querySelector("p.text-quran") as HTMLElement;
      const translit = word.nextElementSibling as HTMLElement | null;
      const cs = getComputedStyle(word);
      const wordBox = word.getBoundingClientRect();
      const translitBox = translit?.getBoundingClientRect();
      return {
        fontSize: parseFloat(cs.fontSize),
        lineHeight: parseFloat(cs.lineHeight),
        gap: translitBox ? translitBox.top - wordBox.bottom : null,
      };
    });

    // .text-quran's own intended ratio is 2.2 (line-height / font-size);
    // the regression silently dropped this to ~1.33 by pairing it with
    // text-2xl. A generous floor (1.8) catches that regression without
    // pinning an exact pixel value that would break on a font-size tweak.
    expect(metrics.lineHeight / metrics.fontSize).toBeGreaterThanOrEqual(1.8);

    // There must be a real, visible gap before the transliteration line --
    // the regression measured exactly 0px here.
    expect(metrics.gap).not.toBeNull();
    expect(metrics.gap!).toBeGreaterThan(0);
  });

  test("/quran vocabulary cards: a word with a root shows it in an isolated, correctly-shaped RTL Arabic element", async ({
    page,
  }) => {
    await page.goto("/quran");
    const cardWithRoot = page
      .getByTestId("vocabulary-grid")
      .locator(":scope > *")
      .filter({ hasText: "Root:" })
      .first();
    await expect(cardWithRoot).toBeVisible();

    const rootValue = cardWithRoot.locator("span[dir='rtl'][lang='ar']");
    await expect(rootValue).toBeVisible();
    await expect(rootValue).toHaveClass(/font-arabic/);
  });
});

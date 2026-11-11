import { test, expect, type Page } from "@playwright/test";

import { FIXTURE, installQuranFixture } from "./fixtures/quran-fixture";

/**
 * QR-INT-007 (Milestone C): public Understand This Ayah page
 * (/quran/understand?surah=&ayah=). Uses the genuine TEST-ONLY fixture.
 * Locks: Arabic byte-identical to the source, verified EN/FR side by side
 * with their sources, no invented words/tafsir/context, safe search params,
 * cross-Surah navigation driven by the database's ayah counts.
 */

async function open(page: Page, query: string, locale: "en" | "fr" | "ar" = "en") {
  await installQuranFixture(page);
  await page.addInitScript((l) => localStorage.setItem("quranroots-locale", l), locale);
  await page.goto(`/quran/understand${query}`);
  await page.waitForFunction(() => {
    const tsr = (window as unknown as { $_TSR?: { hydrated?: boolean } }).$_TSR;
    return !tsr || tsr.hydrated === true;
  });
}

test.describe("Understand This Ayah page", () => {
  test("1:2 shows the stored Arabic and both verified translations with sources", async ({
    page,
  }) => {
    await open(page, "?surah=1&ayah=2");
    await expect(page).toHaveTitle("Understand this Ayah — QuranRoots");
    expect(await page.getByTestId("understand-arabic").textContent()).toBe(
      FIXTURE.ayahs[1]!.arabic_text,
    );
    await expect(page.getByTestId("comparison-en-text")).toHaveText(FIXTURE.pickthall[1]!.text);
    await expect(page.getByTestId("comparison-fr-text")).toHaveText(
      "Louange à Dieu, maître de l’univers",
    );
    await expect(page.getByTestId("comparison-en-source")).toHaveText(
      "Translator: Marmaduke Pickthall",
    );
    await expect(page.getByTestId("comparison-fr-source")).toHaveText(
      "Translator: Albin de Kazimirski Biberstein",
    );
    await expect(page.getByTestId("understand-reflect")).toHaveAttribute(
      "href",
      "/reflect?surah=1&ayah=2",
    );
    await expect(page.getByTestId("understand-open-reader")).toHaveAttribute(
      "href",
      "/quran?surah=1&ayah=2",
    );
  });

  test("words, tafsir and context show honest unavailable states only (keyboard tabs)", async ({
    page,
  }) => {
    await open(page, "?surah=1&ayah=2");
    await page.getByTestId("understand-tab-translations").focus();
    for (const [tab, text] of [
      ["words", "Word-by-word meanings are awaiting a verified, licensed source"],
      ["tafsir", "QuranRoots does not write or generate tafsir."],
      ["context", "Context notes are awaiting an approved scholarly source."],
    ] as const) {
      await page.keyboard.press("ArrowRight");
      await expect(page.getByTestId(`understand-tab-${tab}`)).toHaveAttribute(
        "data-state",
        "active",
      );
      const panel = page.getByRole("tabpanel");
      await expect(panel.getByTestId("content-state-unavailable")).toContainText(text);
      expect(await panel.locator('[lang="ar"]').count()).toBe(0);
    }
  });

  test("previous/next follow the database's Ayah counts across Surah boundaries", async ({
    page,
  }) => {
    await open(page, "?surah=1&ayah=1");
    await expect(page.getByTestId("understand-prev")).toBeDisabled();
    await page.goto("/quran/understand?surah=1&ayah=7");
    await page.getByTestId("understand-next").click();
    await expect(page).toHaveURL(/surah=2&ayah=1/);
    // The fixture carries no rows for Surah 2: honest empty state, no text.
    await expect(page.getByTestId("content-state-empty")).toBeVisible();
    await page.getByTestId("understand-prev").click();
    await expect(page).toHaveURL(/surah=1&ayah=7/);
    await page.goto("/quran/understand?surah=114&ayah=6");
    await expect(page.getByTestId("understand-next")).toBeDisabled();
  });

  test("malformed params fall back safely; an Ayah beyond the Surah is reported, not invented", async ({
    page,
  }) => {
    await open(page, "?surah=abc&ayah=-3");
    expect(await page.getByTestId("understand-arabic").textContent()).toBe(
      FIXTURE.ayahs[0]!.arabic_text,
    );
    await page.goto("/quran/understand?surah=1&ayah=99");
    await expect(page.getByTestId("content-state-unavailable")).toContainText(
      "isn't part of the Surah",
    );
  });

  test("Kazimirski's many_to_one Ayah (1:7) renders under the French interface", async ({
    page,
  }) => {
    await open(page, "?surah=1&ayah=7", "fr");
    await expect(page.getByRole("heading", { name: "Comprendre ce verset" })).toBeVisible();
    await expect(page.getByTestId("comparison-fr-text")).toContainText("Dans le sentier de ceux");
    await expect(page.getByTestId("comparison-fr-text")).toContainText("ni de ceux qui s’égarent.");
  });

  for (const [locale, width] of [
    ["ar", 390],
    ["en", 390],
    ["fr", 768],
  ] as const) {
    test(`responsive at ${width}px (${locale}) with no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, "?surah=1&ayah=2", locale);
      await expect(page.getByTestId("understand-ayah")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      if (locale === "ar") await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    });
  }

  test("the homepage Understand card links to this page", async ({ page }) => {
    await installQuranFixture(page);
    await page.goto("/");
    await expect(page.getByTestId("understand-study-link")).toHaveAttribute(
      "href",
      "/quran/understand?surah=1&ayah=2",
    );
  });
});

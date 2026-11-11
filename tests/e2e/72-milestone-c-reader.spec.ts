import { test, expect, type Page } from "@playwright/test";

import { FIXTURE, installQuranFixture } from "./fixtures/quran-fixture";

/**
 * QR-INT-007 (Milestone C): Reader refinement -- VerseFrame layout, toolbar
 * navigation, jump-to-Ayah, verse selection, Understand action, audio
 * mini-player and honest states. Public (signed-out) flows only, so no test
 * account is needed. Data comes from the genuine, attributed TEST-ONLY
 * fixture (tests/e2e/fixtures), following the route-interception convention
 * of specs 14/49/50.
 */

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const tsr = (window as unknown as { $_TSR?: { hydrated?: boolean } }).$_TSR;
    return !tsr || tsr.hydrated === true;
  });
}

async function openReader(page: Page, path = "/quran?surah=1") {
  await installQuranFixture(page);
  await page.goto(path);
  await hydrated(page);
  await expect(page.getByTestId("ayah-card-1-7")).toBeVisible();
}

test.describe("Milestone C Reader", () => {
  test("every Ayah's Arabic renders byte-identical to the source, with Pickthall and its attribution", async ({
    page,
  }) => {
    await openReader(page);
    for (const ayah of FIXTURE.ayahs) {
      const arabic = page.getByTestId(`ayah-card-1-${ayah.ayah_number}`).locator('p[lang="ar"]');
      await expect(arabic).toHaveClass(/text-quran/);
      expect(await arabic.textContent()).toBe(ayah.arabic_text);
    }
    for (const row of FIXTURE.pickthall) {
      await expect(page.getByText(row.text, { exact: true })).toBeVisible();
    }
    await expect(
      page
        .getByTestId("ayah-card-1-2")
        .getByRole("button", { name: "Translator: Marmaduke Pickthall" }),
    ).toBeVisible();
  });

  test("toolbar lists all 114 Surahs and moves between Surahs, with an honest empty state", async ({
    page,
  }) => {
    await openReader(page);
    await expect(page.getByTestId("reader-prev-surah")).toBeDisabled();
    await page.getByRole("combobox", { name: "Select a Surah" }).click();
    await expect(page.getByRole("option")).toHaveCount(114);
    await page.keyboard.press("Escape");
    await page.getByTestId("reader-next-surah").click();
    await expect(page).toHaveURL(/surah=2/);
    await expect(page.getByTestId("content-state-empty")).toBeVisible();
    await page.getByTestId("reader-prev-surah").click();
    await expect(page).toHaveURL(/surah=1/);
    await expect(page.getByTestId("ayah-card-1-1")).toBeVisible();
  });

  test("go to Ayah highlights the requested Ayah and rejects out-of-range numbers", async ({
    page,
  }) => {
    await openReader(page);
    await page.getByTestId("reader-jump-input").fill("9");
    await page.getByTestId("reader-jump-go").click();
    await expect(page.getByTestId("reader-jump-error")).toContainText("between 1 and 7");
    await page.getByTestId("reader-jump-input").fill("5");
    await page.getByTestId("reader-jump-go").click();
    await expect(page).toHaveURL(/ayah=5/);
    await expect(page.getByTestId("ayah-card-1-5")).toHaveAttribute("data-highlighted", "true");
  });

  test("clicking a verse selects it; its Understand action opens the Understand page", async ({
    page,
  }) => {
    await openReader(page);
    await page.getByTestId("ayah-card-1-3").locator('p[lang="ar"]').click();
    await expect(page.getByTestId("ayah-card-1-3")).toHaveAttribute("data-selected", "true");
    await page.getByTestId("understand-link-1-3").click();
    await expect(page).toHaveURL(/\/quran\/understand\?surah=1&ayah=3/);
    await expect(page.getByTestId("understand-ayah")).toBeVisible();
  });

  test("mini-player appears on play, reports an unavailable recitation honestly, and closes", async ({
    page,
  }) => {
    await openReader(page);
    await page
      .getByTestId("ayah-card-1-1")
      .getByRole("button", { name: "Play recitation" })
      .click();
    const player = page.getByTestId("audio-mini-player");
    await expect(player).toBeVisible();
    await expect(page.getByTestId("audio-mini-player-title")).toContainText("Ayah 1");
    await expect(page.getByTestId("audio-mini-player-status")).toContainText(
      "Recitation audio isn't available for this Ayah.",
    );
    await page.getByTestId("audio-mini-player-close").click();
    await expect(player).toHaveCount(0);
  });

  test("a failed Surah load shows a retryable error, and offline says so", async ({
    page,
    context,
  }) => {
    await installQuranFixture(page);
    await page.route("**/rest/v1/ayahs*", (route) => route.fulfill({ status: 500, body: "{}" }));
    await page.goto("/quran?surah=1");
    await hydrated(page);
    await expect(page.getByTestId("content-state-error")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByTestId("content-state-offline")).toBeVisible();
    await context.setOffline(false);
  });

  for (const [locale, width] of [
    ["en", 390],
    ["ar", 390],
    ["fr", 768],
  ] as const) {
    test(`no horizontal overflow at ${width}px (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((l) => localStorage.setItem("quranroots-locale", l), locale);
      await openReader(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      if (locale === "ar") await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    });
  }
});

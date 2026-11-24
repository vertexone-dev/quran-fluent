import { test, expect, type Page } from "@playwright/test";

/**
 * QR-DESIGN-002 Stage 3: Understand This Ayah, Your Journey (Progress),
 * Reflect and Memorize. Content comes only from the bundled database; the
 * unavailable states must never look like content.
 */

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
}
async function openAyahInUnderstand(page: Page, surah: number, ayah: number) {
  await page.getByTestId("tab-quran").click();
  await page
    .locator(".list-row")
    .nth(surah - 1)
    .click();
  const btn = page.getByTestId(`ayah-understand-${ayah}`);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await expect(page.getByTestId("understand-screen")).toBeVisible();
}

test.describe("Understand This Ayah", () => {
  test.beforeEach(async ({ page }) => boot(page));

  test("shows the Arabic and both verified translations for Al-Fatiha 1:1", async ({ page }) => {
    await openAyahInUnderstand(page, 1, 1);
    await expect(page.getByTestId("understand-ref")).toHaveText("Al-Fatiha 1:1");
    await expect(page.getByTestId("understand-arabic")).toContainText("بِسْمِ");
    await expect(page.getByTestId("understand-arabic")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("understand-english")).toHaveText(
      "In the name of Allah, the Beneficent, the Merciful.",
    );
    await expect(page.getByTestId("understand-french")).toHaveText(
      "Au nom du Dieu clément et miséricordieux.",
    );
  });

  test("Word by Word and Tafsir say they are unavailable and show no content", async ({ page }) => {
    await openAyahInUnderstand(page, 1, 1);
    for (const tab of ["words", "tafsir"] as const) {
      await page.getByTestId(`understand-tab-${tab}`).click();
      const box = page.getByTestId(`understand-${tab}-unavailable`);
      await expect(box).toContainText("Not available yet");
      await expect(box).toContainText("not available in this version");
      await expect(page.getByTestId("understand-panel").locator(".quran-text")).toHaveCount(0);
    }
    await expect(page.getByTestId("understand-tab-tafsir")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("next/previous cross surah boundaries using the database's own counts", async ({ page }) => {
    await openAyahInUnderstand(page, 1, 1);
    await expect(page.getByTestId("understand-prev")).toBeDisabled();
    for (let i = 0; i < 6; i++) await page.getByTestId("understand-next").click();
    await expect(page.getByTestId("understand-ref")).toHaveText("Al-Fatiha 1:7");
    await page.getByTestId("understand-next").click();
    await expect(page.getByTestId("understand-ref")).toHaveText("Al-Baqara 2:1");
    await page.getByTestId("understand-prev").click();
    await expect(page.getByTestId("understand-ref")).toHaveText("Al-Fatiha 1:7");
  });

  test("Open in Reader and the Home tile work", async ({ page }) => {
    await openAyahInUnderstand(page, 1, 3);
    await page.getByTestId("understand-open-reader").click();
    await expect(page.locator("h1")).toHaveText("Al-Fatiha");
    await page.goto("/");
    await page.getByTestId("home-tile-understand").click();
    await expect(page.getByTestId("understand-screen")).toBeVisible();
    await expect(page.getByTestId("understand-ref")).toContainText("Al-Fatiha");
  });

  test("makes no network request outside the app", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.origin !== new URL(page.url()).origin && !u.protocol.startsWith("data"))
        external.push(r.url());
    });
    await openAyahInUnderstand(page, 1, 1);
    await page.getByTestId("understand-tab-words").click();
    expect(external).toEqual([]);
  });
});

test.describe("Your Journey (Progress)", () => {
  test.beforeEach(async ({ page }) => boot(page));

  test("fresh install: honest empty state, zero counts, untracked rows", async ({ page }) => {
    await page.getByTestId("tab-progress").click();
    await expect(page.getByTestId("progress-screen")).toBeVisible();
    await expect(page.locator(".appbar-title")).toHaveText("Your Journey");
    await expect(page.getByTestId("journey-empty")).toHaveText("No reading yet");
    await expect(page.getByTestId("journey-value-bookmarks")).toHaveText("0");
    await expect(page.getByTestId("journey-value-favorites")).toHaveText("0");
    await expect(page.getByTestId("journey-value-reflections")).toHaveText("0");
    await expect(page.getByTestId("journey-value-lessons")).toHaveText("Not tracked yet");
    await expect(page.getByTestId("journey-value-memorized")).toHaveText("Not tracked yet");
  });

  test("reflects real activity: bookmark, reading position, continue", async ({ page }) => {
    await page.getByTestId("tab-quran").click();
    await page.locator(".list-row").nth(1).click(); // Al-Baqara
    await expect(page.locator("h1")).toHaveText("Al-Baqara");
    await page
      .getByRole("button", { name: /bookmark/i })
      .first()
      .click();
    await page.getByTestId("tab-progress").click();
    await expect(page.getByTestId("journey-value-bookmarks")).toHaveText("1");
    await expect(page.getByTestId("journey-surah")).toContainText("Al-Baqara 2:");
    await page.getByTestId("journey-continue").click();
    await expect(page.locator("h1")).toHaveText("Al-Baqara");
  });

  test("Arabic title", async ({ page }) => {
    await page.getByTestId("home-language-toggle").click();
    await page.getByTestId("home-language-toggle").click();
    await page.getByTestId("tab-progress").click();
    await expect(page.locator(".appbar-title")).toHaveText("رحلتك");
  });
});

test.describe("Reflect", () => {
  test.beforeEach(async ({ page }) => boot(page));

  test("with no ayah chosen it asks you to open one, and shows no entries", async ({ page }) => {
    await page.getByTestId("home-tile-reflect").click();
    await expect(page.getByTestId("reflect-choose")).toBeVisible();
    await expect(page.getByTestId("reflect-empty")).toBeVisible();
    await expect(page.getByTestId("reflect-entry")).toHaveCount(0);
  });

  test("write, save, persist across reload, then delete", async ({ page }) => {
    await openAyahInUnderstand(page, 1, 2);
    await page.getByTestId("understand-reflect").click();
    await expect(page.getByTestId("reflect-target")).toHaveText("Al-Fatiha 1:2");
    await expect(page.getByTestId("reflect-save")).toBeDisabled();
    await page.getByTestId("reflect-input").fill("  Gratitude for the day  ");
    await page.getByTestId("reflect-save").click();
    await expect(page.getByTestId("reflect-entry")).toHaveCount(1);
    await expect(page.getByTestId("reflect-entry")).toContainText("Gratitude for the day");
    await expect(page.getByTestId("reflect-entry")).toContainText("Al-Fatiha 1:2");
    await expect(page.getByTestId("reflect-input")).toHaveValue("");

    await page.reload();
    await page.getByTestId("home-tile-reflect").click();
    await expect(page.getByTestId("reflect-entry")).toHaveCount(1);

    await page.getByTestId("reflect-delete").click();
    await expect(page.getByTestId("reflect-entry")).toHaveCount(0);
    await expect(page.getByTestId("reflect-empty")).toBeVisible();
  });

  test("the count appears on Progress and stays on this device", async ({ page }) => {
    await openAyahInUnderstand(page, 1, 1);
    await page.getByTestId("understand-reflect").click();
    await page.getByTestId("reflect-input").fill("note");
    await page.getByTestId("reflect-save").click();
    await page.getByTestId("tab-progress").click();
    await expect(page.getByTestId("journey-value-reflections")).toHaveText("1");
  });
});

test.describe("Memorize (non-functional state)", () => {
  test.beforeEach(async ({ page }) => boot(page));

  test("action tiles are disabled and no progress is shown", async ({ page }) => {
    await page.getByTestId("home-tile-memorize").click();
    for (const k of ["memorize", "revise", "test"]) {
      await expect(page.getByTestId(`memorize-tile-${k}`)).toBeDisabled();
    }
    const text = (await page.getByTestId("memorize-screen").innerText()) ?? "";
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/Al-Mulk/);
  });
});

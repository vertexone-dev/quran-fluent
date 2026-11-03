import { test, expect, type Page } from "@playwright/test";

/**
 * Sprint 2: ayah bookmarks, exact reading position, and persistent reader
 * preferences. Same offline-first constraints as reader.spec.ts/
 * offline.spec.ts -- everything here reads the bundled SQLite content and
 * writes only to localStorage, zero network requests.
 */

async function openSurah(page: Page, name: string) {
  await page.locator(".tab-item", { hasText: "Qur'an" }).click();
  await page.locator(".list-row", { hasText: name }).click();
}

async function readPersistedPosition(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("qr.reading.position");
    return raw ? (JSON.parse(raw) as { surahNumber: number; ayahNumber: number }) : null;
  });
}

/**
 * scrollIntoViewIfNeeded only guarantees the target becomes visible
 * *somewhere* on screen -- in practice it aligns to whichever edge needs
 * the least scrolling, which can land a card at the very bottom of the
 * viewport rather than near the top reading position just below the
 * sticky header. That ambiguity doesn't reflect how a reader's attention
 * actually lands, so this scrolls deterministically to put the target
 * ayah exactly where ReadingScreen's own resume-scroll logic would put it
 * -- the same offset math, so this is "the reader settled on this verse,"
 * not an artifact of one API's alignment choice.
 */
async function scrollToReadingPosition(page: Page, ayahNumber: number) {
  await page.evaluate((n) => {
    const scroller = document.querySelector(".screen")!;
    const header = document.querySelector<HTMLElement>(".reader-sticky");
    const target = document.querySelector(`[data-ayah="${n}"]`)!;
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    const offset =
      target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - headerHeight - 8;
    scroller.scrollTo({ top: scroller.scrollTop + offset });
  }, ayahNumber);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
});

test.describe("Feature A: ayah bookmarks", () => {
  test("bookmarking an ayah persists across a reload and shows up in the Bookmarks list", async ({
    page,
  }) => {
    await openSurah(page, "Al-Fatiha");
    const toggle = page
      .locator('.verse-card[data-ayah="1"]')
      .getByRole("button", { name: "Bookmark this ayah" });
    await toggle.click();
    await expect(
      page.locator('.verse-card[data-ayah="1"]').getByRole("button", { name: "Remove bookmark" }),
    ).toBeVisible();

    await page.reload();
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });

    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.getByRole("button", { name: "Bookmarks" }).click();
    await expect(page.locator(".list-row")).toHaveCount(1);
    await expect(page.locator(".list-row").first()).toContainText("Al-Fatiha");
    await expect(page.locator(".list-row").first()).toContainText("1");
  });

  test("tapping again removes the bookmark (no duplicates, no leftovers)", async ({ page }) => {
    await openSurah(page, "Al-Fatiha");
    const toggle = page
      .locator('.verse-card[data-ayah="3"]')
      .getByRole("button", { name: "Bookmark this ayah" });
    await toggle.click();
    await page
      .locator('.verse-card[data-ayah="3"]')
      .getByRole("button", { name: "Remove bookmark" })
      .click();
    await expect(toggle).toBeVisible();

    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.getByRole("button", { name: "Bookmarks" }).click();
    await expect(page.locator(".text-muted", { hasText: "Bookmark an ayah" })).toBeVisible();
  });

  test("opening a bookmark from the Bookmarks list navigates to and scrolls to the correct ayah", async ({
    page,
  }) => {
    await openSurah(page, "Al-Baqara");
    await page.locator('.verse-card[data-ayah="255"]').scrollIntoViewIfNeeded();
    await page
      .locator('.verse-card[data-ayah="255"]')
      .getByRole("button", { name: "Bookmark this ayah" })
      .click();

    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.getByRole("button", { name: "Bookmarks" }).click();
    await page.getByTestId("bookmark-open").filter({ hasText: "255" }).click();

    await expect(page.locator("h1")).toHaveText("Al-Baqara");
    await expect(page.locator('.verse-card[data-ayah="255"]')).toBeInViewport();
  });
});

test.describe("Feature B: exact reading position", () => {
  test("scrolling to a verse and reloading resumes at that exact ayah, not the beginning", async ({
    page,
  }) => {
    await openSurah(page, "Al-Baqara");
    await scrollToReadingPosition(page, 50);

    await expect
      .poll(async () => (await readPersistedPosition(page))?.ayahNumber, { timeout: 5_000 })
      .toBe(50);

    // A reload always lands back on Home (App.tsx keeps no in-app route
    // across a real page reload, only localStorage) -- same as the
    // existing "favoriting a surah persists..." test in reader.spec.ts.
    // Reopening the same surah from the list is "opening a surah from the
    // list" with no explicit target ayah, which resolveResumeAyah treats
    // as a resume candidate because it's the *same* surah the saved
    // position belongs to.
    await page.reload();
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
    await openSurah(page, "Al-Baqara");
    await expect(page.locator('.verse-card[data-ayah="50"]')).toBeInViewport();
    // Not still at the top of the surah.
    await expect(page.locator('.verse-card[data-ayah="1"]')).not.toBeInViewport();

    // The restored verse must land *below* the sticky header, not behind
    // it -- the resume-scroll offset subtracts the header's own height,
    // so this checks that math actually held on a real layout, not just
    // that the card is "in viewport" (which a sliver poking out from
    // under the header would also satisfy).
    const headerBottom = await page
      .locator(".reader-sticky")
      .evaluate((el) => el.getBoundingClientRect().bottom);
    const cardTop = await page
      .locator('.verse-card[data-ayah="50"]')
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(cardTop).toBeGreaterThanOrEqual(headerBottom);
  });

  test("intentionally opening a different surah from the list starts at the beginning, never at another surah's saved position", async ({
    page,
  }) => {
    await openSurah(page, "Al-Baqara");
    await scrollToReadingPosition(page, 50);
    await expect
      .poll(async () => (await readPersistedPosition(page))?.ayahNumber, { timeout: 5_000 })
      .toBe(50);

    await page.goBack();
    await openSurah(page, "Al-Fatiha");
    await expect(page.locator("h1")).toHaveText("Al-Fatiha");
    await expect(page.locator('.verse-card[data-ayah="1"]')).toBeInViewport();
  });

  test("the Home screen's Continue Reading card restores the exact saved ayah, not just the surah", async ({
    page,
  }) => {
    await openSurah(page, "Al-Baqara");
    await scrollToReadingPosition(page, 50);
    await expect
      .poll(async () => (await readPersistedPosition(page))?.ayahNumber, { timeout: 5_000 })
      .toBe(50);

    await page.locator(".tab-item", { hasText: "Home" }).click();
    await page.locator(".hero-card", { hasText: "Continue Reading" }).click();

    await expect(page.locator("h1")).toHaveText("Al-Baqara");
    await expect(page.locator('.verse-card[data-ayah="50"]')).toBeInViewport();
    await expect(page.locator('.verse-card[data-ayah="1"]')).not.toBeInViewport();
  });

  test("resuming at ayah 1 does not scroll the translation controls out of view behind the sticky header", async ({
    page,
  }) => {
    // Found via the Android smoke suite, not desktop Playwright: a saved
    // position of exactly ayah 1 was still forcing the same scroll-to-
    // anchor offset real resume targets need, which pushed the
    // Translation/font-size controls (they sit between the sticky header
    // and the first verse card) out from under the header entirely.
    await openSurah(page, "Al-Fatiha");
    await expect
      .poll(async () => (await readPersistedPosition(page))?.ayahNumber, { timeout: 5_000 })
      .toBe(1);

    await page.reload();
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
    await openSurah(page, "Al-Fatiha");

    await expect(page.locator(".reader-controls")).toBeInViewport();
    await expect(page.locator(".seg", { hasText: "English" })).toBeInViewport();
  });
});

test.describe("Feature B durability: no pending-write loss or races", () => {
  test("switching tabs immediately after scrolling does not discard the latest position (fast tab change)", async ({
    page,
  }) => {
    await openSurah(page, "Al-Baqara");
    await scrollToReadingPosition(page, 50);
    // No wait here: switches away well inside the 400ms debounce window,
    // so this only passes if the pending write is flushed on unmount
    // rather than silently cancelled with it.
    await page.locator(".tab-item", { hasText: "Home" }).click();

    await expect
      .poll(async () => (await readPersistedPosition(page))?.ayahNumber, { timeout: 2_000 })
      .toBe(50);
  });

  test("backgrounding the app immediately after scrolling flushes the latest position (visibilitychange)", async ({
    page,
  }) => {
    await openSurah(page, "Al-Baqara");
    await scrollToReadingPosition(page, 73);
    // Simulates the OS backgrounding the app -- the realistic way an
    // Android app's process is actually reclaimed, as opposed to a true
    // force-stop/kill, which gives JS no chance to run at all and is not
    // something a web-level test can simulate.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await expect
      .poll(async () => (await readPersistedPosition(page))?.ayahNumber, { timeout: 2_000 })
      .toBe(73);
  });

  test("opening a bookmark is never reverted by a stale pre-scroll position observation", async ({
    page,
  }) => {
    await openSurah(page, "Al-Baqara");
    await scrollToReadingPosition(page, 200);
    await page
      .locator('.verse-card[data-ayah="200"]')
      .getByRole("button", { name: "Bookmark this ayah" })
      .click();

    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.getByRole("button", { name: "Bookmarks" }).click();
    await page.getByTestId("bookmark-open").filter({ hasText: "200" }).click();
    await expect(page.locator('.verse-card[data-ayah="200"]')).toBeInViewport();

    // Waits well past the 400ms debounce with nothing else happening --
    // the explicit bookmark target must still be what's persisted, not
    // whatever ayah happened to be on screen for the instant before this
    // effect's own resume-scroll ran.
    await page.waitForTimeout(800);
    expect(await readPersistedPosition(page)).toMatchObject({ surahNumber: 2, ayahNumber: 200 });
  });

  test("rapidly switching surahs does not leave a stale ayah persisted under the wrong surah", async ({
    page,
  }) => {
    await openSurah(page, "Al-Baqara");
    await scrollToReadingPosition(page, 50);
    // Navigates away well before the 400ms debounce would otherwise fire
    // for Al-Baqara's ayah 50.
    await page.goBack();
    await openSurah(page, "Al-Fatiha");

    // Long enough for Al-Baqara's now-stale debounce (if it survived,
    // which it must not) to have fired.
    await page.waitForTimeout(800);
    expect(await readPersistedPosition(page)).toMatchObject({ surahNumber: 1, ayahNumber: 1 });
  });
});

test.describe("Feature C: persistent reader preferences", () => {
  test("switching translation persists across a reload", async ({ page }) => {
    await openSurah(page, "Al-Fatiha");
    await page.locator(".seg", { hasText: "English" }).click();
    await expect(page.locator(".verse-card").first()).toContainText(/In the name of Allah/i);

    await page.reload();
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
    await openSurah(page, "Al-Fatiha");
    await expect(page.locator('.seg[aria-checked="true"]', { hasText: "English" })).toBeVisible();
    await expect(page.locator(".verse-card").first()).toContainText(/In the name of Allah/i);
  });

  test("changing font size persists across a reload", async ({ page }) => {
    await openSurah(page, "Al-Fatiha");
    const biggerButton = page.getByRole("button", { name: "Larger Arabic text" });
    await biggerButton.click();
    await biggerButton.click();
    const sizeAfterChange = await page.locator(".font-size-value").textContent();

    await page.reload();
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
    await openSurah(page, "Al-Fatiha");
    await expect(page.locator(".font-size-value")).toHaveText(sizeAfterChange ?? "");
  });
});

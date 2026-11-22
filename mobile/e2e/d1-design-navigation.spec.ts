import { test, expect, type Page } from "@playwright/test";

/**
 * Milestone D-1: Design Lock v1.0 + five primary destinations.
 * Covers the new tab structure, the Planned (D-2) screens, Profile & More,
 * Home shortcuts, hardware-back (window.history) behaviour through all of
 * them, the Arabic RTL interface, and that every new asset is bundled.
 */

async function home(page: Page) {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
}

test.describe("Five primary destinations", () => {
  test.beforeEach(async ({ page }) => home(page));

  test("tab bar shows Home, Qur'an, Learn, Reflect, Memorize in order", async ({ page }) => {
    await expect(page.locator(".tab-item .tab-label")).toHaveText([
      "Home",
      "Qur'an",
      "Learn",
      "Reflect",
      "Memorize",
    ]);
    await expect(page.locator(".tab-item")).toHaveCount(5);
  });

  for (const [tab, title] of [
    ["reflect", "Reflect"],
    ["memorize", "Memorize"],
  ] as const) {
    test(`${title} is clearly marked Planned and shows no sample content`, async ({ page }) => {
      await page.getByTestId(`tab-${tab}`).click();
      const screen = page.getByTestId(`planned-screen-${tab}`);
      await expect(screen).toBeVisible();
      await expect(page.locator(".appbar-title")).toHaveText(title);
      await expect(screen.getByTestId("planned-badge")).toHaveText("Planned");
      await expect(screen.getByTestId("planned-body")).toContainText(
        "not available in this version",
      );
      await expect(screen.locator(".quran-text")).toHaveCount(0);
      await expect(page.getByTestId(`tab-${tab}`)).toHaveAttribute(
        "aria-label",
        `${title} (Planned)`,
      );
    });
  }

  test("Planned screen links to features that work now", async ({ page }) => {
    await page.getByTestId("tab-memorize").click();
    await page.getByTestId("planned-open-quran").click();
    await expect(page.locator(".appbar-title")).toHaveText("Surahs");
    await expect(page.locator(".tab-item.active")).toContainText("Qur'an");
  });

  test("back unwinds Planned tab switches one at a time", async ({ page }) => {
    await page.getByTestId("tab-reflect").click();
    await page.getByTestId("tab-memorize").click();
    await page.goBack();
    await expect(page.locator(".tab-item.active")).toContainText("Reflect");
    await page.goBack();
    await expect(page.locator(".tab-item.active")).toContainText("Home");
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots");
  });
});

test.describe("Profile & More and Home shortcuts keep every secondary feature", () => {
  test.beforeEach(async ({ page }) => home(page));

  const targets = [
    ["bookmarks", "Bookmarks"],
    ["practice", "Practice"],
    ["offline-access", "Offline Access"],
    ["settings", "Settings"],
  ] as const;

  for (const [row, title] of targets) {
    test(`profile circle -> ${title} -> back -> back returns Home`, async ({ page }) => {
      await page.getByTestId("profile-button").click();
      await expect(page.locator(".appbar-title")).toHaveText("Profile & More");
      await page.getByTestId(`more-row-${row}`).click();
      await expect(page.locator(".appbar-title")).toHaveText(title);
      await page.goBack();
      await expect(page.locator(".appbar-title")).toHaveText("Profile & More");
      await page.goBack();
      await expect(page.locator(".appbar-title")).toHaveText("QuranRoots");
    });
  }

  for (const [key, title] of [
    ["bookmarks", "Bookmarks"],
    ["practice", "Practice"],
    ["offline", "Offline Access"],
    ["settings", "Settings"],
  ] as const) {
    test(`Home shortcut opens ${title} and the in-app back returns Home`, async ({ page }) => {
      await page.getByTestId(`home-shortcut-${key}`).click();
      await expect(page.locator(".appbar-title")).toHaveText(title);
      await page.getByTestId("appbar-back").click();
      await expect(page.locator(".appbar-title")).toHaveText("QuranRoots");
    });
  }

  test("Profile & More lists Reflect and Memorization as Planned", async ({ page }) => {
    await page.getByTestId("profile-button").click();
    await expect(page.getByTestId("more-row-reflect")).toContainText("Planned");
    await expect(page.getByTestId("more-row-memorize")).toContainText("Planned");
  });
});

test.describe("Arabic RTL interface", () => {
  test.beforeEach(async ({ page }) => home(page));

  test("EN -> FR -> AR cycles the interface and sets dir/lang", async ({ page }) => {
    const toggle = page.getByTestId("home-language-toggle");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByTestId("tab-learn")).toContainText("Apprendre");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".tab-item .tab-label")).toHaveText([
      "الرئيسية",
      "القرآن",
      "التعلّم",
      "تدبّر",
      "الحفظ",
    ]);
    // Home is the first tab, so under RTL it sits at the right edge.
    const homeBox = await page.getByTestId("tab-home").boundingBox();
    const memBox = await page.getByTestId("tab-memorize").boundingBox();
    expect(homeBox!.x).toBeGreaterThan(memBox!.x);
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("Arabic choice persists across a reload", async ({ page }) => {
    await page.getByTestId("home-language-toggle").click();
    await page.getByTestId("home-language-toggle").click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl", { timeout: 15_000 });
    await expect(page.getByTestId("tab-home")).toContainText("الرئيسية");
  });

  test("Reader under RTL: Qur'an text unchanged, translations stay left-to-right", async ({
    page,
  }) => {
    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    await page.locator(".list-row", { hasText: "Al-Fatiha" }).click();
    const firstAyahEn = await page.locator(".verse-card .quran-text").first().textContent();
    await page.goto("/");
    await page.getByTestId("home-language-toggle").click();
    await page.getByTestId("home-language-toggle").click();
    await page.getByTestId("tab-quran").click();
    await page.locator(".list-row", { hasText: "Al-Fatiha" }).click();
    await expect(page.locator(".verse-card .quran-text").first()).toHaveText(firstAyahEn ?? "");
    await page.getByTestId("reader-translation-en").click();
    const en = page.locator(".verse-card .translation-text").first();
    await expect(en).toHaveAttribute("dir", "ltr");
    await expect(en).toHaveText("In the name of Allah, the Beneficent, the Merciful.");
    await page.getByTestId("reader-translation-fr").click();
    const fr = page.locator(".verse-card .translation-text").first();
    await expect(fr).toHaveAttribute("dir", "ltr");
    await expect(fr).toHaveText("Au nom du Dieu clément et miséricordieux.");
    // Restore English reader preference for other specs sharing storage.
    await page.getByTestId("reader-translation-en").click();
  });
});

test.describe("Design Lock v1.0 assets and tokens are bundled", () => {
  test.beforeEach(async ({ page }) => home(page));

  test("logo, hero artwork and fonts load from the app itself", async ({ page }) => {
    const logo = page.getByTestId("brand-logo");
    await expect(logo).toHaveAttribute("src", "/quranroots-logo.png");
    await expect
      .poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    const art = page.locator(".brand-hero-art");
    await expect
      .poll(() => art.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        body: getComputedStyle(document.body).fontFamily,
        title: getComputedStyle(document.querySelector(".appbar-title")!).fontFamily,
        nunito: document.fonts.check('16px "Nunito Sans"'),
        cormorant: document.fonts.check('16px "Cormorant Garamond"'),
      };
    });
    expect(fonts.body).toContain("Nunito Sans");
    expect(fonts.title).toContain("Cormorant Garamond");
    expect(fonts.nunito && fonts.cormorant).toBe(true);
  });

  test("tab bar uses the fixed Midnight Teal glass in both themes", async ({ page }) => {
    const bg = () =>
      page.getByTestId("tab-bar").evaluate((el) => getComputedStyle(el).backgroundColor);
    const light = await bg();
    await page.getByTestId("home-theme-toggle").click(); // light -> dark
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await bg()).toBe(light);
    await page.getByTestId("home-theme-toggle").click(); // back toward system/light
  });

  test("no request leaves the app's origin on the new screens", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.origin !== new URL(page.url()).origin && !u.protocol.startsWith("data"))
        external.push(r.url());
    });
    await page.getByTestId("tab-reflect").click();
    await page.getByTestId("tab-memorize").click();
    await page.getByTestId("tab-home").click();
    await page.getByTestId("profile-button").click();
    await page.getByTestId("tab-home").click();
    await page.getByTestId("home-language-toggle").click();
    await page.getByTestId("home-language-toggle").click();
    await page.getByTestId("tab-learn").click();
    expect(external).toEqual([]);
  });
});

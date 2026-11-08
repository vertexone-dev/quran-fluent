import { test, expect, type Page } from "@playwright/test";

/**
 * QR-INT-002: Arabic interface localization + RTL layout.
 *
 * Runs entirely anonymously (public project, no storageState) -- same
 * rationale as 59-unauthenticated-page-titles.spec.ts: a signed-out
 * visitor's language choice lives in `localStorage["quranroots-locale"]`
 * (src/lib/i18n.tsx), completely independent of auth, so this is both the
 * fastest way to exercise it and the most faithful simulation of a real
 * anonymous visitor switching languages. The authenticated,
 * profile-persisted path (interface_language column) already has its own
 * en/fr coverage in 57-settings.spec.ts; a matching Arabic case is added
 * there (not duplicated here) since it needs createTestUserClient().
 *
 * Canonical Qur'anic Arabic text/rendering is explicitly out of scope here
 * (untouched by QR-INT-002) and already covered elsewhere
 * (42-i18n-foundation-phase1.spec.ts's "byte-identical regardless of
 * interface language" test, 06-quran-reader.spec.ts).
 */

const EN_GROUP_LABEL = "Change language"; // common.language.change, English copy
const AR_GROUP_LABEL = "تغيير اللغة"; // same key, Arabic copy
// QR-INT-005/006: the header's globe dropdown (LanguageMenu.tsx) replaced the
// segmented EN/FR/AR switcher. Its trigger carries the localized "Change
// language" label; each option is a menuitemradio named in its own language.
const AR_OPTION = "ar";
const EN_OPTION = "en";

const visibleTrigger = (page: Page) => page.locator("[data-testid=language-menu-trigger]:visible");

/** Seeds localStorage before the app's own scripts ever run, for every
 * navigation on this page -- the correct way to pre-seed a locale (a plain
 * `page.evaluate(() => localStorage...)` before any `page.goto()` throws
 * "Access is denied" against the still-opaque about:blank origin). */
function seedLocale(page: Page, locale: "ar" | "en" | "fr") {
  return page.addInitScript((value: string) => {
    window.localStorage.setItem("quranroots-locale", value);
  }, locale);
}

/**
 * Clicks the locale switcher and waits for `<html lang>` to actually
 * change, retrying the whole click on a wall-clock budget. This app has a
 * known, already-documented transient SSR/client hydration remount
 * (tests/e2e/utils/lesson-interaction.ts's trackHydrationRemounts; see
 * 48-lesson-position-race.spec.ts and friends) that can tear down and
 * rebuild the React tree shortly after first load, discarding whatever
 * local state -- including a locale just switched by clicking -- the
 * remount raced against. Re-locating the group/button fresh on every
 * attempt (rather than reusing a stale locator) is what makes a retry safe
 * across a remount.
 */
async function switchLocaleViaUi(
  page: Page,
  currentGroupLabel: string,
  option: "ar" | "en",
  expectedLang: string,
  maxMs = 15_000,
) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const trigger = visibleTrigger(page);
    await expect(trigger)
      .toHaveAttribute("aria-label", currentGroupLabel, { timeout: 2_000 })
      .catch(() => {});
    await trigger.click({ timeout: 2_000 }).catch(() => {});
    await page
      .getByTestId(`language-option-${option}`)
      .click({ timeout: 2_000 })
      .catch(() => {});
    const matched = await page
      .locator("html")
      .evaluate((el, lang) => el.getAttribute("lang") === lang, expectedLang)
      .catch(() => false);
    if (matched) return;
    await page.waitForTimeout(250);
  }
  // Final attempt so the real assertion below reports a normal, readable
  // Playwright failure instead of this helper's own timeout.
}

test.describe("Arabic locale selection and persistence", () => {
  test("switching to Arabic sets html lang/dir, persists to localStorage, and survives a reload", async ({
    page,
  }) => {
    await page.goto("/");

    // Before switching: baseline is English, ltr.
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).not.toHaveAttribute("dir", "rtl");

    await switchLocaleViaUi(page, EN_GROUP_LABEL, AR_OPTION, "ar");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await page.evaluate(() => window.localStorage.getItem("quranroots-locale"))).toBe("ar");

    // Arabic nav copy actually rendered (common.nav.home / common.nav.quran).
    await expect(page.getByRole("link", { name: "الرئيسية" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "القرآن" }).first()).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("link", { name: "الرئيسية" }).first()).toBeVisible();
  });

  test("switching back from Arabic to English restores ltr", async ({ page }) => {
    await seedLocale(page, "ar");
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await switchLocaleViaUi(page, AR_GROUP_LABEL, EN_OPTION, "en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).not.toHaveAttribute("dir", "rtl");
    expect(await page.evaluate(() => window.localStorage.getItem("quranroots-locale"))).toBe("en");
    await expect(page.getByRole("link", { name: "Home" }).first()).toBeVisible();
  });

  test("the Arabic option is reachable and activatable by keyboard", async ({ page }) => {
    await page.goto("/");

    // Keyboard-only: focus the globe trigger, Enter opens the menu with focus
    // on the active (English) option, two ArrowDowns reach Arabic (English,
    // Français, العربية),
    // Enter selects it. Same remount-safe retry as switchLocaleViaUi.
    const start = Date.now();
    let lang: string | null = null;
    while (Date.now() - start < 15_000) {
      await page.keyboard.press("Escape").catch(() => {});
      await visibleTrigger(page)
        .focus()
        .catch(() => {});
      await page.keyboard.press("Enter").catch(() => {});
      await expect(page.getByTestId("language-option-en"))
        .toBeFocused({ timeout: 2_000 })
        .catch(() => {});
      // Keys pressed during the menu's open animation are dropped, so step
      // down one option at a time until Arabic actually holds focus.
      for (let i = 0; i < 12; i++) {
        const onArabic = await page.evaluate(
          () => document.activeElement?.getAttribute("data-testid") === "language-option-ar",
        );
        if (onArabic) break;
        await page.keyboard.press("ArrowDown").catch(() => {});
        await page.waitForTimeout(200);
      }
      await page.keyboard.press("Enter").catch(() => {});
      lang = await page
        .locator("html")
        .getAttribute("lang")
        .catch(() => null);
      if (lang === "ar") break;
      await page.waitForTimeout(250);
    }
    expect(lang).toBe("ar");

    // Focus returns to the trigger (now labelled in Arabic) and the menu
    // reports Arabic as the checked option when reopened.
    await expect(visibleTrigger(page)).toHaveAttribute("aria-label", AR_GROUP_LABEL);
    await expect(visibleTrigger(page)).toContainText("AR");
    await visibleTrigger(page).click();
    await expect(page.getByTestId("language-option-ar")).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("Arabic RTL layout", () => {
  test("mobile navigation under rtl: Arabic bottom tab bar, Home on the right edge", async ({
    page,
  }) => {
    // QR-INT-005 replaced the mobile drawer with the Emergent bottom tab bar
    // (MobileTabBar.tsx). Under rtl its first destination (Home) must sit on
    // the physical right, and every label must be the Arabic copy.
    await page.setViewportSize({ width: 390, height: 844 });
    await seedLocale(page, "ar");
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const bar = page.getByTestId("mobile-tab-bar");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link", { name: "القرآن" })).toBeVisible();
    const home = await bar.getByRole("link").first().boundingBox();
    const last = await bar.getByRole("link").last().boundingBox();
    expect(home && last && home.x > last.x, "Home should be right of the last tab under rtl").toBe(
      true,
    );
  });

  test("no horizontal overflow on the homepage or Qur'an page at desktop and mobile widths", async ({
    page,
  }) => {
    await seedLocale(page, "ar");

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const path of ["/", "/quran", "/features"]) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          scrollWidth,
          `${path} at ${viewport.width}px: scrollWidth (${scrollWidth}) exceeds clientWidth (${clientWidth}) -- likely an un-flipped physical-direction utility`,
        ).toBeLessThanOrEqual(clientWidth);
      }
    }
  });

  test("the Qur'an vocabulary search is translated, correctly positioned, and still functions under rtl", async ({
    page,
  }) => {
    await seedLocale(page, "ar");
    await page.goto("/quran");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await expect(page.getByRole("heading", { name: "دراسة القرآن التفاعلية" })).toBeVisible();

    const search = page.getByPlaceholder("ابحث عن كلمات…");
    await expect(search).toBeVisible();
    await search.fill("الله");
    await expect(search).toHaveValue("الله");
  });
});

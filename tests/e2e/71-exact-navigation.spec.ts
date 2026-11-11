import { test, expect, type Page } from "@playwright/test";

import { clickAndExpect } from "./utils/auth";

// QR-INT-005 "exact Emergent navigation": the floating glass bar with
// icon-and-label destinations, the globe-and-code language dropdown, the
// functional search, and the responsive bottom tab bar. Signed-out/public
// project -- authenticated account-menu coverage lives in
// 67-dashboard-nav.spec.ts.

async function hydrated(page: Page) {
  // /: server-rendered; a click before hydration lands on an inert control.
  await page.waitForFunction(() => {
    const tsr = (window as unknown as { $_TSR?: { hydrated?: boolean } }).$_TSR;
    return !tsr || tsr.hydrated === true;
  });
}

// Both the desktop and mobile control rows are in the DOM (one hidden by
// CSS), so every header locator is scoped to the visible one.
const trigger = (page: Page) => page.locator("[data-testid=language-menu-trigger]:visible");

test.describe("desktop glass navigation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("five icon-and-label destinations, Home active with a gold pill, tab bar hidden", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(page);
    const nav = page.getByRole("navigation", { name: "Main" });
    const links = nav.getByRole("link");
    await expect(links).toHaveText(["Home", "Qur'an", "Learn", "Reflect", "Memorize"]);
    // Every destination carries its icon.
    for (let i = 0; i < 5; i++) {
      await expect(links.nth(i).locator("svg")).toHaveCount(1);
    }
    await expect(links.nth(0)).toHaveAttribute("aria-current", "page");
    await expect(links.nth(0)).toHaveClass(/nav-pill-active/);
    await expect(links.nth(1)).not.toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("mobile-tab-bar")).toBeHidden();
  });

  test("the language dropdown lists English / Français / العربية with a check on the active one", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(page);
    await expect(trigger(page)).toContainText("EN");
    await trigger(page).click();
    const menu = page.getByTestId("language-menu-content");
    await expect(menu.getByRole("menuitemradio")).toHaveText(["English", "Français", "العربية"]);
    await expect(page.getByTestId("language-option-en")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("language-option-en").locator("svg")).toHaveCount(1);
    await expect(page.getByTestId("language-option-fr")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("language-option-fr").locator("svg")).toHaveCount(0);
  });

  test("choosing Français switches the interface and persists", async ({ page }) => {
    await page.goto("/");
    await hydrated(page);
    await trigger(page).click();
    await page.getByTestId("language-option-fr").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(
      page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link").first(),
    ).toHaveText("Accueil");
    await expect(trigger(page)).toContainText("FR");
    expect(await page.evaluate(() => localStorage.getItem("quranroots-locale"))).toBe("fr");
  });

  test("choosing العربية flips the page and the bar to right-to-left", async ({ page }) => {
    await page.goto("/");
    await hydrated(page);
    await trigger(page).click();
    await page.getByTestId("language-option-ar").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const nav = page
      .getByRole("navigation", { name: "Main" })
      .or(page.locator("header nav").first());
    const first = nav.getByRole("link").first();
    const last = nav.getByRole("link").last();
    // Home (first in DOM) sits at the inline-start edge = the right in RTL.
    const a = await first.boundingBox();
    const b = await last.boundingBox();
    expect(a!.x).toBeGreaterThan(b!.x);
    await trigger(page).click();
    await expect(page.getByTestId("language-option-ar")).toHaveAttribute("aria-checked", "true");
  });

  test("the dropdown is keyboard operable: Enter opens, arrows move, Enter selects, Escape closes to the trigger", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(page);
    await trigger(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("language-menu-content")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("language-menu-content")).toBeHidden();
    await expect(trigger(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("language-menu-content")).toBeVisible();
    // Opening by keyboard puts focus on the active (checked) language.
    await expect(page.getByTestId("language-option-en")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("language-option-fr")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("search finds a real Surah and opens it in the reader", async ({ page }) => {
    await page.goto("/");
    await hydrated(page);
    await page.locator("[data-testid=header-search-button]:visible").click();
    const input = page.getByTestId("header-search-input");
    await expect(input).toBeVisible();
    await input.fill("fatiha");
    const hit = page.getByTestId("search-result-1");
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page).toHaveURL(/\/quran\?surah=1/);
  });

  test("search says so when nothing matches instead of inventing a result", async ({ page }) => {
    await page.goto("/");
    await hydrated(page);
    await page.locator("[data-testid=header-search-button]:visible").click();
    await page.getByTestId("header-search-input").fill("zzzzqqq");
    await expect(page.getByText("No Surah found.")).toBeVisible();
  });

  test("the header has no theme control -- theme lives in Settings only (QR-INT-006)", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(page);
    await expect(page.getByRole("button", { name: "Change theme" })).toHaveCount(0);
    await expect(page.getByTestId("theme-menu-trigger")).toHaveCount(0);
  });

  test("the circular profile control offers Log in and Create account when signed out", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(page);
    const profile = page.locator("[data-testid=profile-menu-trigger]:visible");
    await clickAndExpect(profile, () =>
      expect(page.getByTestId("profile-menu-content")).toBeVisible(),
    );
    await expect(page.getByTestId("profile-menu-login")).toHaveAttribute(
      "href",
      /\/auth\?mode=login/,
    );
    await expect(page.getByTestId("profile-menu-signup")).toHaveAttribute(
      "href",
      /\/auth\?mode=signup/,
    );
    await page.getByTestId("profile-menu-login").click();
    await expect(page).toHaveURL(/\/auth\?mode=login/);
  });
});

test.describe("bottom tab bar (phones and tablets)", () => {
  for (const width of [390, 768]) {
    test(`at ${width}px all five primary destinations are one tap away, including Reflect and Memorize`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await hydrated(page);
      const bar = page.getByTestId("mobile-tab-bar");
      await expect(bar).toBeVisible();
      const tabs = bar.getByRole("link");
      await expect(tabs).toHaveText(["Home", "Qur'an", "Learn", "Reflect", "Memorize"]);
      await expect(page.getByTestId("tab-reflect")).toHaveAttribute("href", "/reflect");
      await expect(page.getByTestId("tab-memorize")).toHaveAttribute("href", "/memorize");
      await expect(page.getByTestId("tab-home")).toHaveAttribute("aria-current", "page");
      // The bar never causes sideways scrolling.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
      // Every tab is a comfortable touch target.
      for (let i = 0; i < 5; i++) {
        const box = await tabs.nth(i).boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test("the last content on a page can always be scrolled clear of the bar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/about");
    await hydrated(page);
    // Re-scroll on every poll: the router's scroll restoration can reset the
    // position right after hydration, which a single scrollTo would race.
    const measureGap = () =>
      page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        const bar = document.querySelector("[data-testid=mobile-tab-bar]")!.getBoundingClientRect();
        const lastVisible = [...document.querySelectorAll("footer a, footer p, footer button")]
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .map((e) => e.getBoundingClientRect().bottom)
          .reduce((a, b) => Math.max(a, b), 0);
        return bar.top - lastVisible;
      });
    // Nothing at the very end of the page is hidden underneath the bar.
    await expect.poll(measureGap, { timeout: 10_000 }).toBeGreaterThanOrEqual(0);
  });

  test("a tab navigates, and the destination becomes the current page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await hydrated(page);
    await page.getByTestId("tab-quran").click();
    await expect(page).toHaveURL(/\/quran/);
    await expect(page.getByTestId("tab-quran")).toHaveAttribute("aria-current", "page");
  });

  test("at 390px the header keeps logo, wordmark, search, language and profile without clipping", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await hydrated(page);
    await expect(page.getByText("QuranRoots", { exact: true }).first()).toBeVisible();
    await expect(page.locator("[data-testid=header-search-button]:visible")).toBeVisible();
    await expect(trigger(page)).toBeVisible();
    await expect(page.locator("[data-testid=profile-menu-trigger]:visible")).toBeVisible();
    const clipped = await page.evaluate(() => {
      const bar = document.querySelector("header > div")!.getBoundingClientRect();
      return [...document.querySelectorAll("header > div a, header > div button")]
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .some((e) => {
          const r = e.getBoundingClientRect();
          return r.right > bar.right + 1 || r.left < bar.left - 1;
        });
    });
    expect(clipped).toBe(false);
  });

  test("Arabic at 390px mirrors the tab order and still fits", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem("quranroots-locale", "ar"));
    await page.goto("/");
    await hydrated(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const tabs = page.getByTestId("mobile-tab-bar").getByRole("link");
    const first = await tabs.first().boundingBox();
    const last = await tabs.last().boundingBox();
    expect(first!.x).toBeGreaterThan(last!.x);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("with reduced motion the bar and dropdown still work", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await hydrated(page);
    await expect(page.getByTestId("mobile-tab-bar")).toBeVisible();
    await trigger(page).click();
    await expect(page.getByTestId("language-menu-content")).toBeVisible();
  });
});

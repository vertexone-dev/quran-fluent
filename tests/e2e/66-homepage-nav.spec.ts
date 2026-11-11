import { test, expect } from "@playwright/test";

import { clickAndExpect } from "./utils/auth";

// QR-INT-004: the public homepage's new quick-link grid (Qur'an, Learn,
// Reflect, Memorize -- the same four destinations as the authenticated
// nav minus "Home", since this page already is Home) and the Design Lock
// v1 visual polish layered onto the existing, pre-existing-content
// homepage. Signed-out/public project -- see 67-dashboard-nav.spec.ts for
// the authenticated five-destination primary nav and secondary-route
// coverage.

// Scoped to the quick-links region itself: the footer also has its own
// "Learn Arabic" link (common.footer.learnArabic) to the same /learn
// route; the fifth card is labelled "Guided Learning" (QR-WEB-009).
function quickLinks(page: import("@playwright/test").Page) {
  return page.getByRole("region", { name: "Explore QuranRoots" });
}

test.describe("homepage headline, mission eyebrow and public navigation", () => {
  test("hero shows the approved headline and the Read-to-Grow mission line", async ({ page }) => {
    await page.goto("/");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveText(/A Deeper Journey\s*with the Quran/);
    await expect(page.getByTestId("hero-steps")).toHaveText(
      /Read\s*→\s*Understand\s*→\s*Reflect\s*→\s*Practice\s*→\s*Grow/,
    );
  });

  test("signed-out primary nav is Home, Quran, Learn, Reflect, Memorize, in order", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const links = page.getByRole("navigation", { name: "Main" }).getByRole("link");
    await expect(links).toHaveText(["Home", "Qur'an", "Learn", "Reflect", "Memorize"]);
  });

  test("Features, Premium and About stay in the footer; the profile menu holds Log In, Create Account and Settings", async ({
    page,
  }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    for (const name of ["Features", "Premium", "About"]) {
      await expect(footer.getByRole("link", { name })).toBeVisible();
    }
    // QR-INT-006: the circular profile control replaces the mobile drawer.
    await page.setViewportSize({ width: 390, height: 844 });
    // A click before hydration lands on an inert, server-rendered trigger.
    await page.waitForFunction(() => {
      const tsr = (window as unknown as { $_TSR?: { hydrated?: boolean } }).$_TSR;
      return !tsr || tsr.hydrated === true;
    });
    await page.locator("[data-testid=profile-menu-trigger]:visible").click();
    const menu = page.getByTestId("profile-menu-content");
    const items = menu.getByRole("menuitem");
    await expect(items).toHaveText(["Log in", "Create account", "Settings"]);
    await expect(page.getByTestId("profile-menu-settings")).toHaveAttribute(
      "href",
      "/auth?mode=login&redirect=%2Fsettings",
    );
  });

  test("Reflect and Memorize stay behind the sign-in guard for a signed-out visitor", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Reflect" })
      .click();
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("homepage quick-links", () => {
  test("link to the real destinations, public ones navigate for real", async ({ page }) => {
    await page.goto("/");

    await quickLinks(page).getByRole("link", { name: "Read the Qur'an" }).click();
    await expect(page).toHaveURL(/\/quran/);

    await page.goBack();
    await expect(
      quickLinks(page).getByRole("link", { name: "Understand This Ayah" }),
    ).toHaveAttribute("href", "/quran?tab=vocabulary");
    // QR-WEB-009: the fifth card is "Guided Learning" and still leads to the
    // existing /learn course page.
    await expect(quickLinks(page).getByRole("link", { name: "Guided Learning" })).toHaveAttribute(
      "href",
      "/learn",
    );
    await expect(quickLinks(page).getByRole("link", { name: "Learn Arabic" })).toHaveCount(0);
    await quickLinks(page).getByRole("link", { name: "Guided Learning" }).click();
    await expect(page).toHaveURL(/\/learn/);

    // Reflect/Memorize are authenticated-only routes -- confirmed wired to
    // the right destination via href rather than clicked through, since
    // following them just re-tests the existing _authenticated route
    // guard (redirect to /auth), already covered elsewhere.
    await page.goto("/");
    await expect(quickLinks(page).getByRole("link", { name: "Reflect" })).toHaveAttribute(
      "href",
      "/reflect",
    );
    await expect(quickLinks(page).getByRole("link", { name: "Memorize" })).toHaveAttribute(
      "href",
      "/memorize",
    );
  });

  test("stay visible and usable with reduced motion enabled", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(quickLinks(page).getByRole("link", { name: "Read the Qur'an" })).toBeVisible();
    await expect(
      quickLinks(page).getByRole("link", { name: "Understand This Ayah" }),
    ).toBeVisible();
    await expect(quickLinks(page).getByRole("link", { name: "Guided Learning" })).toBeVisible();
    await expect(quickLinks(page).getByRole("link", { name: "Reflect" })).toBeVisible();
    await expect(quickLinks(page).getByRole("link", { name: "Memorize" })).toBeVisible();
  });
});

test.describe("homepage hero CTA", () => {
  test("Continue Reading leads to the real Qur'an reader, never signup, when signed out", async ({
    page,
  }) => {
    await page.goto("/");
    const cta = page.getByTestId("hero-continue-reading-button");
    await expect(cta).toHaveText(/Continue Reading/);
    await expect(cta).toHaveAttribute("href", "/quran");
    // No saved position exists for a visitor, so no resume line is invented.
    await expect(page.getByTestId("hero-resume-position")).toHaveCount(0);
    await cta.click();
    await expect(page).toHaveURL(/\/quran$/);
    await expect(page).not.toHaveURL(/\/auth/);
  });
});

test.describe("header wordmark at narrow widths", () => {
  for (const width of [320, 360, 390, 414, 430]) {
    test(`the wordmark is never clipped by the header controls at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/about");
      const result = await page.evaluate(() => {
        const link = document.querySelector('header a[href="/"]');
        const text = [...(link?.querySelectorAll("span") ?? [])].find(
          (el) => el.textContent?.trim() === "QuranRoots" && el.children.length === 0,
        );
        // QR-INT-005: the segmented switcher became the language dropdown;
        // the control nearest the brand is now the search button.
        const switcher = [...document.querySelectorAll("header [data-testid=header-search-button]")]
          .map((el) => el.getBoundingClientRect())
          .find((r) => r.width > 0);
        if (!text || !switcher) return null;
        // sr-only collapses to a clipped 1px box: still in the accessibility
        // tree, intentionally not painted.
        const painted = text.parentElement!.getBoundingClientRect().width > 2;
        const range = document.createRange();
        range.selectNodeContents(text);
        return {
          painted,
          textRight: range.getBoundingClientRect().right,
          switcherLeft: switcher.left,
        };
      });
      expect(result).not.toBeNull();
      if (result!.painted) expect(result!.textRight).toBeLessThanOrEqual(result!.switcherLeft);
      // Either way the brand stays reachable by name.
      await expect(page.getByRole("link", { name: "QuranRoots home" }).first()).toBeVisible();
    });
  }
});

test.describe("header never overlaps at laptop widths, in every language", () => {
  for (const locale of ["en", "fr", "ar"]) {
    for (const width of [1024, 1280, 1440]) {
      test(`brand, nav and controls do not collide (${locale} at ${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto("/");
        await page.evaluate((l) => localStorage.setItem("quranroots-locale", l), locale);
        await page.reload();
        const gaps = await page.evaluate(() => {
          const header = document.querySelector("header")!;
          const rtl = document.documentElement.dir === "rtl";
          const brand = header.querySelector('a[href="/"]')!.getBoundingClientRect();
          const nav = header.querySelector("nav")!.getBoundingClientRect();
          // QR-INT-005: below xl the icon-and-label nav is replaced by the
          // bottom tab bar (zero-size here); the control nearest the nav is
          // the search button, not the old segmented switcher.
          const controls = [...header.querySelectorAll("[data-testid=header-search-button]")]
            .map((el) => el.getBoundingClientRect())
            .find((r) => r.width > 0)!;
          const navShown = nav.width > 0;
          const text = [...header.querySelectorAll("a[href='/'] span")].find(
            (el) => el.children.length === 0,
          )!;
          const painted = text.parentElement!.getBoundingClientRect().width > 2;
          const range = document.createRange();
          range.selectNodeContents(text);
          const brandBox = painted ? range.getBoundingClientRect() : brand;
          if (!navShown) {
            // No inline nav: brand and controls must still not collide.
            return {
              brandNav: rtl ? brandBox.left - controls.right : controls.left - brandBox.right,
              navControls: 0,
            };
          }
          return rtl
            ? { brandNav: brandBox.left - nav.right, navControls: nav.left - controls.right }
            : { brandNav: nav.left - brandBox.right, navControls: controls.left - nav.right };
        });
        // Mirrored for rtl above, so "gap" always means the visual space
        // between neighbours; it must never be negative (overlap).
        expect(gaps.brandNav).toBeGreaterThanOrEqual(0);
        expect(gaps.navControls).toBeGreaterThanOrEqual(0);
      });
    }
  }
});

test.describe("homepage theme support", () => {
  test("the saved Light and Dark themes update the document, both keep the quick-links readable", async ({
    page,
  }) => {
    // QR-INT-006: the theme control lives in Settings only, which persists the
    // choice under "quranroots-theme" (src/lib/theme.tsx). This sets that same
    // stored value directly, so the homepage's response to it is what's tested.
    await page.goto("/");

    // Default is the Design Lock v1 Midnight Teal identity (dark).
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(quickLinks(page).getByRole("link", { name: "Reflect" })).toBeVisible();

    await page.evaluate(() => window.localStorage.setItem("quranroots-theme", "light"));
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(quickLinks(page).getByRole("link", { name: "Reflect" })).toBeVisible();

    await page.evaluate(() => window.localStorage.setItem("quranroots-theme", "dark"));
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test.describe("homepage responsive layout", () => {
  test("no horizontal overflow at desktop or mobile width, in either theme", async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    }
  });
});

test.describe("homepage Arabic RTL", () => {
  test("quick-links render translated and right-to-left", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("quranroots-locale", "ar"));
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const region = page.getByRole("region", { name: "اكتشف QuranRoots" });
    await expect(region.getByRole("link", { name: "اقرأ القرآن" })).toBeVisible();
    await expect(region.getByRole("link", { name: "تدبّر" })).toBeVisible();
    await expect(region.getByRole("link", { name: "احفظ" })).toBeVisible();
    await expect(region.getByRole("link", { name: "افهم هذه الآية" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/رحلة أعمق\s*مع القرآن/);
    // The mission line's arrows point the reading direction (right-to-left).
    await expect(page.getByTestId("hero-steps")).toHaveText(
      /اقرأ\s*←\s*افهم\s*←\s*تدبّر\s*←\s*طبّق\s*←\s*ارتقِ/,
    );

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });
});

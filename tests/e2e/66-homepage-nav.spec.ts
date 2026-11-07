import { test, expect } from "@playwright/test";

// QR-INT-004: the public homepage's new quick-link grid (Qur'an, Learn,
// Reflect, Memorize -- the same four destinations as the authenticated
// nav minus "Home", since this page already is Home) and the Design Lock
// v1 visual polish layered onto the existing, pre-existing-content
// homepage. Signed-out/public project -- see 67-dashboard-nav.spec.ts for
// the authenticated five-destination primary nav and secondary-route
// coverage.

// Scoped to the quick-links region itself: the footer also has its own
// "Learn Arabic" link (common.footer.learnArabic) to the same /learn
// route, so an unscoped getByRole("link", { name: "Learn Arabic" }) is
// ambiguous on this page.
function quickLinks(page: import("@playwright/test").Page) {
  return page.getByRole("region", { name: "Explore QuranRoots" });
}

test.describe("homepage quick-links", () => {
  test("link to the real destinations, public ones navigate for real", async ({ page }) => {
    await page.goto("/");

    await quickLinks(page).getByRole("link", { name: "Read the Qur'an" }).click();
    await expect(page).toHaveURL(/\/quran/);

    await page.goBack();
    await quickLinks(page).getByRole("link", { name: "Learn Arabic" }).click();
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
    await expect(quickLinks(page).getByRole("link", { name: "Learn Arabic" })).toBeVisible();
    await expect(quickLinks(page).getByRole("link", { name: "Reflect" })).toBeVisible();
    await expect(quickLinks(page).getByRole("link", { name: "Memorize" })).toBeVisible();
  });
});

test.describe("homepage theme support", () => {
  test("switching between Light and Dark updates the document, both themes keep the quick-links readable", async ({
    page,
  }) => {
    await page.goto("/");

    // SiteHeader renders ThemeToggle twice (desktop controls + mobile
    // controls, one CSS `hidden` depending on viewport) -- both carry the
    // same data-testid and aria-label, but `hidden` is display:none, which
    // removes the other one from the accessibility tree entirely. A
    // role-based locator therefore resolves to exactly the one actually
    // visible/interactable at this test's viewport; getByTestId does not
    // filter by visibility and would match both.
    const themeTrigger = page.getByRole("button", { name: "Change theme" });

    // Default is the Design Lock v1 Midnight Teal identity (dark).
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(quickLinks(page).getByRole("link", { name: "Reflect" })).toBeVisible();

    await themeTrigger.click();
    await page.getByRole("menuitem", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(quickLinks(page).getByRole("link", { name: "Reflect" })).toBeVisible();

    await themeTrigger.click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
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

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });
});

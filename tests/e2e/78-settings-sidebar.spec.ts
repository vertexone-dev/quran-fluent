import { expect, test, type Page } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

// QR-DESIGN-008B: the Settings section sidebar. It may only list sections that
// really exist, never add a control, and must work by keyboard, on a phone and in
// right-to-left layouts.

const SECTIONS = [
  ["profile", "Profile"],
  ["learning-display", "Learning and Qur'an display"],
  ["appearance", "Appearance"],
  ["display-preferences", "Display preferences"],
  ["account", "Account"],
] as const;

test.beforeEach(async () => {
  const { client, userId } = await createTestUserClient();
  await client
    .from("learning_preferences")
    .update({ onboarding_completed: true })
    .eq("user_id", userId);
});

// Interface language for a signed-in user comes from their profile (the same way
// 09-localization sets it), so the tests set that and restore English afterwards.
async function setProfileLanguage(lang: string) {
  const { client, userId } = await createTestUserClient();
  const { error } = await client
    .from("profiles")
    .update({ interface_language: lang })
    .eq("id", userId);
  if (error) throw new Error(`Failed to set the profile language: ${error.message}`);
}

test.afterEach(async () => {
  await setProfileLanguage("en");
});

async function open(page: Page, path = "/settings") {
  await page.goto(path);
  await expect(page.getByTestId("settings-nav")).toBeVisible();
}

test.describe("Settings sidebar", () => {
  test("lists only sections that exist, each pointing at a real card, plus Billing", async ({
    page,
  }) => {
    await open(page);
    const nav = page.getByTestId("settings-nav");
    // Exactly the real sections: five in-page entries and the Billing route.
    await expect(nav.getByRole("link")).toHaveCount(SECTIONS.length + 1);
    for (const [id] of SECTIONS) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
      await expect(page.getByTestId(`settings-nav-${id}`)).toHaveAttribute(
        "href",
        `/settings#${id}`,
      );
    }
    await expect(page.getByTestId("settings-nav-billing")).toHaveAttribute(
      "href",
      "/settings/billing",
    );
    // It is navigation only: no form control lives inside it.
    await expect(nav.locator("input, select, textarea, button")).toHaveCount(0);
  });

  test("clicking an entry scrolls to the section, moves focus there and marks it current", async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId("settings-nav-appearance").click();
    await expect(page.getByTestId("settings-nav-appearance")).toHaveAttribute(
      "aria-current",
      "location",
    );
    await expect(page.locator("#appearance")).toBeFocused();
    await expect(page).toHaveURL(/#appearance$/);
    await expect(page.locator("#appearance")).toBeInViewport();
    // Only one entry is current at a time.
    await expect(page.locator('[data-testid^="settings-nav-"][aria-current]')).toHaveCount(1);
  });

  test("works from the keyboard alone: Tab reaches the entries, Enter activates one", async ({
    page,
  }) => {
    await open(page);
    const target = page.getByTestId("settings-nav-display-preferences");
    await target.focus();
    await expect(target).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#display-preferences")).toBeFocused();
    await expect(target).toHaveAttribute("aria-current", "location");
    // Visible focus ring on a focused entry (not outline: none).
    await page.getByTestId("settings-nav-profile").focus();
    const shadow = await page
      .getByTestId("settings-nav-profile")
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe("none");
  });

  test("scrolling a section to the top makes it current, and the bottom of the page marks the last", async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByTestId("settings-nav-profile")).toHaveAttribute(
      "aria-current",
      "location",
    );
    // Scroll the section to the top of the viewport (not merely into view), as a reader scrolling down would.
    await page.locator("#learning-display").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await expect(page.getByTestId("settings-nav-learning-display")).toHaveAttribute(
      "aria-current",
      "location",
    );
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByTestId("settings-nav-account")).toHaveAttribute(
      "aria-current",
      "location",
    );
    await expect(page.locator('[data-testid^="settings-nav-"][aria-current]')).toHaveCount(1);
  });

  test("Billing is a real route and shows as current there; sections link back to Settings", async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId("settings-nav-billing").click();
    await expect(page).toHaveURL(/\/settings\/billing$/);
    await expect(page.getByTestId("settings-nav-billing")).toHaveAttribute("aria-current", "page");
    await page.getByTestId("settings-nav-account").click();
    await expect(page).toHaveURL(/\/settings#account$/);
    await expect(page.locator("#account")).toBeVisible();
  });

  test("the existing Settings behaviour is unchanged by the sidebar", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("settings-profile-card")).toBeVisible();
    await expect(page.getByTestId("settings-appearance-card")).toBeVisible();
    await expect(page.getByTestId("settings-preferences-card")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  test("phone: the sidebar stacks above the content, wraps, and never overflows the page", async ({
    page,
  }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 700 });
      await open(page);
      const box = await page.getByTestId("settings-nav").boundingBox();
      const first = await page.locator("#profile").boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(first!.y + 1); // above, not beside
      const { sw, cw } = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(sw).toBeLessThanOrEqual(cw + 1);
    }
  });

  test("desktop: the sidebar sits beside the content", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    const nav = await page.getByTestId("settings-nav").boundingBox();
    const card = await page.locator("#profile").boundingBox();
    expect(nav!.x + nav!.width).toBeLessThanOrEqual(card!.x + 1);
  });

  test("touch targets are at least 44px tall", async ({ page }) => {
    await open(page);
    for (const link of await page.getByTestId("settings-nav").getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(43.5);
    }
  });

  for (const [lang, expectProfile, expectBilling] of [
    ["fr", "Profil", "Facturation"],
    ["ar", "الملف الشخصي", ""],
  ] as const) {
    test(`labels render in ${lang}${lang === "ar" ? " and the layout mirrors for RTL" : ""}`, async ({
      page,
    }) => {
      await setProfileLanguage(lang);
      await open(page);
      const nav = page.getByTestId("settings-nav");
      await expect(nav.getByTestId("settings-nav-profile")).toContainText(expectProfile);
      if (expectBilling)
        await expect(nav.getByTestId("settings-nav-billing")).toContainText(expectBilling);
      // every label is non-empty and none is an untranslated key
      for (const link of await nav.getByRole("link").all()) {
        const text = (await link.textContent())?.trim() ?? "";
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/^learning\.|^common\./);
      }
      await expect(nav).toHaveAttribute("aria-label", /.+/);
      if (lang === "ar") {
        await page.setViewportSize({ width: 1280, height: 800 });
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        const n = await nav.boundingBox();
        const c = await page.locator("#profile").boundingBox();
        // In RTL the sidebar is on the right-hand side of the content.
        expect(n!.x).toBeGreaterThanOrEqual(c!.x + c!.width - 1);
      }
    });
  }
});

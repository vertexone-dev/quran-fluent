import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

// QR-INT-004: the authenticated nav consolidated from eight top-level links
// down to the five primary destinations (Home, Qur'an, Learn, Reflect,
// Memorize), with Daily/Practice/Progress/Learning Plan/Bookmarks/Notes now
// reachable as secondary navigation (account menu on desktop, the same
// list inside the drawer on mobile -- previously the drawer had no path at
// all to Learning Plan/Bookmarks/Notes). The dashboard itself got a visual
// refresh only; this file re-checks the existing real widgets still render,
// it does not re-prove their data correctness (that's 01-onboarding.spec.ts
// and friends' job).
//
// global-setup.ts resets onboarding_completed=false once per full suite
// run; only 01-onboarding.spec.ts's own test flips it back to true, so any
// spec that visits /dashboard implicitly depends on running after that one
// in the same invocation -- true in the full suite, but silently false (and
// reproducibly redirected straight to /onboarding) whenever this file runs
// on its own. Same defensive fixup as 12-memorization.spec.ts.
test.beforeEach(async () => {
  const { client, userId } = await createTestUserClient();
  await client
    .from("learning_preferences")
    .update({ onboarding_completed: true })
    .eq("user_id", userId);
});

test.describe("primary navigation", () => {
  test("the five primary destinations are reachable from the desktop nav, in order, nothing else", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Main" });
    const links = nav.getByRole("link");

    await expect(links).toHaveText(["Home", "Qur'an", "Learn", "Reflect", "Memorize"]);
    await expect(nav.getByRole("link", { name: "Daily study" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Practice", exact: true })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Progress", exact: true })).toHaveCount(0);
  });

  test("Home is the active destination on the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    const homeLink = page.getByRole("navigation", { name: "Main" }).getByRole("link", {
      name: "Home",
    });
    await expect(homeLink).toHaveAttribute("aria-current", "page");
  });
});

test.describe("secondary navigation", () => {
  // Owner-approved account menu (QR-INT-006). Study pages stay reachable
  // from the dashboard itself; Billing from Settings.
  const secondary = ["My Profile", "My Progress", "Settings", "Sign Out"];

  test("every secondary destination is reachable from the desktop account menu", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByTestId("account-menu-trigger").click();
    const menu = page.getByTestId("account-menu-content");
    await expect(menu.getByRole("menuitem")).toHaveText(secondary);
  });

  test("the same account menu opens from the profile circle on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.locator("[data-testid=account-menu-trigger]:visible").click();
    await expect(page.getByTestId("account-menu-content").getByRole("menuitem")).toHaveText(
      secondary,
    );
  });

  test("My Profile opens the profile card in Settings, and Billing stays reachable there", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId("profile-menu-my-profile").click();
    await expect(page).toHaveURL(/\/settings#profile/);
    await expect(page.getByTestId("settings-profile-card")).toBeVisible();
    await page.getByTestId("settings-billing-link").click();
    await expect(page).toHaveURL(/\/settings\/billing/);
  });

  test("My Progress actually opens /progress from the account menu", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("account-menu-trigger").click();
    await page
      .getByTestId("account-menu-content")
      .getByRole("menuitem", { name: "My Progress" })
      .click();
    await expect(page).toHaveURL(/\/progress/);
  });
});

test.describe("dashboard still renders its real widgets", () => {
  test("greeting, streak, continue-learning, today and activity sections are all present", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Continue learning")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today's learning" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Qur'an Understanding Score" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your activity" })).toBeVisible();
    // Real streak data, not a placeholder -- the count itself isn't
    // asserted (owned by other specs), just that the widget rendered.
    await expect(page.getByText(/day streak/i).first()).toBeVisible();
  });
});

test.describe("Arabic RTL", () => {
  test("the five primary destinations render translated, right-to-left, in the same order", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "ar" }).eq("id", userId);

    try {
      await page.goto("/dashboard");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      const nav = page.getByRole("navigation", { name: "التنقل الرئيسي" });
      const links = nav.getByRole("link");
      await expect(links).toHaveText(["الرئيسية", "القرآن", "التعلّم", "تدبّر", "الحفظ"]);
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});

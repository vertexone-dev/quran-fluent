import { test, expect } from "@playwright/test";

// A genuinely new user: override the config's "already onboarded" storage.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Onboarding (first launch)", () => {
  test("is shown once, names only features that exist, and Get started opens Home", async ({
    page,
  }) => {
    await page.goto("/");
    const screen = page.getByTestId("onboarding-screen");
    await expect(screen).toBeVisible({ timeout: 15_000 });
    await expect(screen.locator("h1")).toHaveText("Welcome to QuranRoots");
    await expect(screen).toContainText("Essential Qur'an learning is free.");
    await expect(screen).not.toContainText(/family/i);
    await page.getByTestId("onboarding-start").click();
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots");

    await page.reload();
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
    await expect(page.getByTestId("onboarding-screen")).toHaveCount(0);
  });

  test("Skip also completes it", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("onboarding-skip").click({ timeout: 15_000 });
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots");
  });

  test("language can be chosen first; Arabic is right-to-left", async ({ page }) => {
    await page.goto("/");
    const lang = page.getByTestId("onboarding-language");
    await lang.click({ timeout: 15_000 });
    await expect(page.locator("h1")).toHaveText("Bienvenue sur QuranRoots");
    await lang.click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toHaveText("مرحبًا بك في QuranRoots");
  });

  test("a fresh install opens in Midnight", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("onboarding-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

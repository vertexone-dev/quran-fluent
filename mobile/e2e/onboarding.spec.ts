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

  test("language button is legible (>= 4.5:1 against the Midnight screen)", async ({ page }) => {
    await page.goto("/");
    const lang = page.getByTestId("onboarding-language");
    await expect(lang).toBeVisible({ timeout: 15_000 });
    const ratio = await page.evaluate(() => {
      const rgb = (css: string) => {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#000";
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
      };
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const fg = rgb(
        getComputedStyle(document.querySelector('[data-testid="onboarding-language"]')!).color,
      );
      const bg = rgb(getComputedStyle(document.querySelector(".onboarding")!).backgroundColor);
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test("on a short phone (375x667) Get started and Skip fit without scrolling", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    const skip = page.getByTestId("onboarding-skip");
    await expect(skip).toBeVisible({ timeout: 15_000 });
    const box = await skip.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  });
});

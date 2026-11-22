import { test, expect, type Page } from "@playwright/test";

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
}

const rootPx = (page: Page) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

/** Root size for an in-app Text Size and a system (Dynamic Type) factor. */
async function rootFor(page: Page, textSize: "small" | "medium" | "large", scale?: number) {
  await page.evaluate(
    ([size, s]) => {
      const root = document.documentElement;
      root.dataset.textSize = size as string;
      if (s === null) root.style.removeProperty("--qr-system-text-scale");
      else root.style.setProperty("--qr-system-text-scale", String(s));
    },
    [textSize, scale ?? null] as const,
  );
  return rootPx(page);
}

test.describe("Dynamic Type (system text size) composes once with the in-app Text Size", () => {
  test("without a system factor nothing changes: 15 / 16 / 18px", async ({ page }) => {
    await boot(page);
    // Chromium has no -apple-system-body, so the factor is 1 (Android/desktop unchanged).
    await expect(page.locator("html")).toHaveAttribute("data-system-text-scale", "1");
    expect(await rootFor(page, "small")).toBe(15);
    expect(await rootFor(page, "medium")).toBe(16);
    expect(await rootFor(page, "large")).toBe(18);
  });

  test("the factor multiplies the in-app size exactly once (no double scaling)", async ({
    page,
  }) => {
    await boot(page);
    expect(await rootFor(page, "medium", 1.5)).toBe(24); // 16 * 1.5
    expect(await rootFor(page, "small", 1.5)).toBe(22.5); // 15 * 1.5
    expect(await rootFor(page, "large", 1.5)).toBe(27); // 18 * 1.5
    expect(await rootFor(page, "medium", 2)).toBe(32);
  });

  test("rem-based content text actually follows (shortcut labels scale with the root)", async ({
    page,
  }) => {
    await boot(page);
    for (const sel of [".shortcut"]) {
      const el = page.locator(sel).first();
      await rootFor(page, "medium");
      const base = await el.evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
      await rootFor(page, "medium", 2);
      const scaled = await el.evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
      expect(scaled, sel).toBeCloseTo(base * 2, 1);
    }
  });

  test("chrome (tab labels, app bar title) is capped at 1.3x while content keeps scaling", async ({
    page,
  }) => {
    await boot(page);
    const tab = page.locator(".tab-item").first();
    const title = page.locator(".appbar-title").first();
    const px = (loc: typeof tab) => loc.evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
    // Below the cap the chrome follows the root: 0.72rem * 16 * 1.2
    await rootFor(page, "medium", 1.2);
    expect(await px(tab)).toBeCloseTo(0.72 * 16 * 1.2, 1);
    // Far above the cap it stops at 1.3x of the base size...
    await rootFor(page, "medium", 3);
    expect(await px(tab)).toBeCloseTo(0.72 * 16 * 1.3, 1);
    expect(await px(title)).toBeCloseTo(1.5 * 16 * 1.3, 1);
    // ...with the in-app Text Size still applied on top (large = 18px root).
    await rootFor(page, "large", 3);
    expect(await px(tab)).toBeCloseTo(0.72 * 18 * 1.3, 1);
    // No system factor: untouched.
    await rootFor(page, "medium");
    expect(await px(tab)).toBeCloseTo(0.72 * 16, 1);
  });
});

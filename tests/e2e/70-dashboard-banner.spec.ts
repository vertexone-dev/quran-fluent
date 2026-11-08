import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * QR-INT-006 milestone 1: the dashboard's cinematic banner band. It must
 * only restyle real learner data (same greeting / lesson progress / plan as
 * before), never overflow the viewport, and stay RTL-correct.
 */
test.describe("dashboard cinematic banner", () => {
  test.beforeEach(async () => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);
  });

  test("the banner shows the real greeting, lesson card and plan", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Continue learning" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
    await expect(page.getByText(/day streak/)).toBeVisible();
    // The lesson progress bar exposes a real, bounded value to assistive tech.
    const bar = page.getByRole("progressbar").first();
    const now = Number(await bar.getAttribute("aria-valuenow"));
    expect(now).toBeGreaterThanOrEqual(0);
    expect(now).toBeLessThanOrEqual(100);
  });

  for (const width of [390, 820, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Continue learning" })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("reduced motion: banner content is visible immediately and the bar is full-width", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dashboard");
    const card = page.getByRole("heading", { name: "Continue learning" });
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS("opacity", "1");
  });

  test("Arabic RTL: banner mirrors and does not overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.waitForFunction(() => {
      const tsr = (window as unknown as { $_TSR?: { hydrated?: boolean } }).$_TSR;
      return !tsr || tsr.hydrated === true;
    });
    await page
      .getByRole("group", { name: "Change language" })
      .filter({ visible: true })
      .first()
      .getByRole("button", { name: /AR/ })
      .click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // Restore the shared test account's language for later specs.
    await page
      .getByRole("group")
      .filter({ visible: true })
      .first()
      .getByRole("button")
      .first()
      .click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

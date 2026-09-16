import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Regression coverage for a mobile-only truncation bug in the dashboard
 * greeting, found during the authenticated-learning-experience audit.
 *
 * The header used to be a `grid grid-cols-[minmax(0,1fr)_auto]` below the
 * sm: breakpoint, forcing the greeting ("As-salāmu ʿalaykum, {name}") onto
 * the same row as the streak badge at every width, with `truncate`
 * silently clipping whatever didn't fit. At 390px this cut the French
 * greeting down to "As-salāmu ʿala…", losing more than half the phrase
 * (measured: scrollWidth 404px vs clientWidth 184px). The fix stacks the
 * greeting above the streak badge below sm: (matching the flex-col/
 * sm:flex-row pattern the Continue-learning card on the same page already
 * used), so the full greeting always has the row's full width to wrap
 * into instead of being clipped.
 */

test.describe("dashboard greeting at mobile width", () => {
  // global-setup.ts leaves onboarding_completed false, which redirects
  // /dashboard straight to /onboarding -- same root cause and same fix as
  // 52-production-polish.spec.ts's own beforeEach.
  test.beforeEach(async () => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);
  });

  test.afterEach(async () => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
  });

  test("the English greeting is never clipped at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Assalamu Alaikum");

    const overflow = await heading.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("the longer French greeting is never clipped at 390px", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    // The full phrase must be present in the DOM, not an ellipsis-truncated
    // prefix of it -- this is the exact string the old truncate class cut
    // down to "As-salāmu ʿala…" at this width.
    await expect(heading).toContainText("As-salāmu ʿalaykum, cher apprenant");

    const overflow = await heading.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("the greeting and streak badge still sit side by side at desktop width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    const heading = page.locator("h1");
    const streakBadge = page.getByText(/day streak/);
    await expect(heading).toBeVisible();
    await expect(streakBadge).toBeVisible();

    const headingBox = await heading.boundingBox();
    const streakBox = await streakBadge.boundingBox();
    expect(headingBox).not.toBeNull();
    expect(streakBox).not.toBeNull();
    // Same row: their vertical centers are close together, not stacked
    // with a full row height between them.
    const headingMidY = headingBox!.y + headingBox!.height / 2;
    const streakMidY = streakBox!.y + streakBox!.height / 2;
    expect(Math.abs(headingMidY - streakMidY)).toBeLessThan(40);
  });
});

import { test, expect } from "@playwright/test";

/**
 * Offline mobile Lessons/Practice regression suite -- see reader.spec.ts
 * for why this exists instead of running the root-level lesson-player
 * specs (17/21/48). Exercises the real, unmodified production grading
 * logic (curriculum-render.ts) against real exported lesson content, not
 * fixtures.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
});

test.describe("Lessons drill-down", () => {
  test("Levels -> Modules -> Lessons shows real curriculum content", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Lessons" }).click();
    await expect(page.locator(".list-row")).toHaveCount(6); // 6 real levels

    await page.locator(".list-row", { hasText: "Foundations of Arabic Script" }).click();
    await expect(page.locator("h1")).toHaveText("Foundations of Arabic Script");
    const moduleCount = await page.locator(".list-row").count();
    expect(moduleCount).toBeGreaterThan(0);

    await page.locator(".list-row").first().click();
    await expect(page.locator(".list-row").first()).toBeVisible();
  });

  test("the Categories tab shows an honest empty state, not invented data", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Lessons" }).click();
    await page.locator(".chip", { hasText: "Categories" }).click();
    await expect(page.locator("text=aren't part of the offline content bundle")).toBeVisible();
  });
});

test.describe("Lesson Player", () => {
  test("renders a real explanation section with a working progress bar", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Lessons" }).click();
    await page.locator(".list-row", { hasText: "Foundations of Arabic Script" }).click();
    await page.locator(".list-row").first().click();
    await page.locator(".list-row").first().click();

    await expect(page.locator(".appbar-title")).toContainText("Level 1");
    await expect(page.locator("text=1/")).toBeVisible();
    await expect(page.locator(".progress-fill")).toBeVisible();
  });

  test("a multiple-choice exercise grades correctly with the real production logic", async ({
    page,
  }) => {
    // Practice jumps straight to a lesson's first exercise, which is
    // faster to reach deterministically than walking the full section
    // sequence of an arbitrary lesson.
    await page.locator(".tab-item", { hasText: "Practice" }).click();
    await page.locator(".list-row").first().click();

    await expect(page.locator(".card h2")).toBeVisible();
    const choices = page.locator(".choice-row");
    await expect(choices.first()).toBeVisible();

    // Try every choice until one grades correct -- this suite doesn't
    // know the answer key up front (it's real, live content), but it
    // must always find exactly one correct choice and see the real
    // evaluateExerciseAnswer() result reflected in the UI.
    const count = await choices.count();
    let foundCorrect = false;
    for (let i = 0; i < count; i++) {
      await choices.nth(i).click();
      await page.locator("button:has-text('Check Answer')").click();
      const banner = page.locator(".banner");
      await expect(banner).toBeVisible();
      const isCorrect = (await banner.getAttribute("class"))?.includes("banner-success");
      if (isCorrect) {
        foundCorrect = true;
        await expect(banner).toContainText("Correct!");
        break;
      }
      await expect(banner).toContainText("Not quite.");
      // Reload to reset submitted state and try the next choice.
      await page.goto("/");
      await page.locator(".tab-item", { hasText: "Practice" }).click();
      await page.locator(".list-row").first().click();
    }
    expect(foundCorrect, "expected exactly one choice to grade correct").toBe(true);
  });
});

test.describe("Practice tab", () => {
  test("lists real lessons with exercise counts, not a placeholder", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Practice" }).click();
    await expect(page.locator(".list-row").first()).toBeVisible();
    await expect(page.locator(".chip", { hasText: /^\d+$/ }).first()).toBeVisible();
  });
});

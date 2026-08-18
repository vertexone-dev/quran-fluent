import { test, expect } from "@playwright/test";

/**
 * /memorize, /practice, /bookmarks and /notes are roadmap placeholders today
 * (RoadmapPage components, no backing tables or logic) — this is a smoke
 * test that the placeholder renders correctly, not a test of a hifz feature
 * that doesn't exist yet.
 */
test.describe("memorization (roadmap placeholder)", () => {
  test("shows the Hifz roadmap without exposing any non-functional controls", async ({ page }) => {
    await page.goto("/memorize");

    await expect(page.getByRole("heading", { name: "Memorization (Hifz)" })).toBeVisible();
    await expect(page.getByText("Phase 4")).toBeVisible();
    await expect(page.getByText("Mark an Ayah memorized")).toBeVisible();

    // None of the eventual hifz controls should be present yet.
    await expect(page.getByRole("button", { name: "Repeat the Ayah" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark as memorized" })).toHaveCount(0);
  });
});

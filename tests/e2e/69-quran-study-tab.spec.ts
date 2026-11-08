import { test, expect } from "@playwright/test";

// QR-INT-005: the reader's study tabs (Vocabulary / Data handling /
// Translations) are URL-addressable via ?tab=. This is the real entry point
// behind the homepage's "Understand This Ayah" card -- it opens the existing
// Vocabulary experience, nothing new.
test.describe("Qur'an study tabs are URL-addressable", () => {
  test("no tab param opens Vocabulary, as before", async ({ page }) => {
    await page.goto("/quran");
    await expect(page.getByRole("tab", { name: "Vocabulary" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  test("?tab=vocabulary opens Vocabulary with its real word grid and brings it into view", async ({
    page,
  }) => {
    await page.goto("/quran?tab=vocabulary");
    await expect(page.getByRole("tab", { name: "Vocabulary" })).toHaveAttribute(
      "data-state",
      "active",
    );
    await expect(page.getByTestId("vocabulary-grid")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Vocabulary" })).toBeInViewport();
  });

  test("?tab=translations opens that tab directly", async ({ page }) => {
    await page.goto("/quran?tab=translations");
    await expect(page.getByRole("tab", { name: "Translations" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  test("an unknown tab value falls back to Vocabulary instead of erroring", async ({ page }) => {
    await page.goto("/quran?tab=nonsense");
    await expect(page.getByRole("tab", { name: "Vocabulary" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  test("choosing a tab updates the URL so it can be shared", async ({ page }) => {
    await page.goto("/quran");
    await page.getByRole("tab", { name: "Translations" }).click();
    await expect(page).toHaveURL(/tab=translations/);
  });

  test("the homepage's Understand This Ayah card lands on the Vocabulary tab", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("region", { name: "Explore QuranRoots" })
      .getByRole("link", { name: "Understand This Ayah" })
      .click();
    await expect(page).toHaveURL(/\/quran\?tab=vocabulary/);
    await expect(page.getByRole("tab", { name: "Vocabulary" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });
});

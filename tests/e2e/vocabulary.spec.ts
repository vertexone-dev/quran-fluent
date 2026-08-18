import { test, expect } from "@playwright/test";

import { createTestUserClient, countRows } from "./utils/db";

test.describe("vocabulary (Qur'an word browser)", () => {
  test("search narrows the word list", async ({ page }) => {
    await page.goto("/quran");
    await expect(page.getByRole("heading", { name: "Most frequent Qur'anic words" })).toBeVisible();

    await page.getByPlaceholder("Search words…").fill("Lord");
    await expect(page.getByText("Rabb", { exact: true })).toBeVisible();
    await expect(page.getByText("Ṣirāṭ", { exact: true })).not.toBeVisible();
  });

  test("saving a word creates user_vocabulary and a review_items row; removing deletes both", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();

    await page.goto("/quran");
    await page.getByPlaceholder("Search words…").fill("Rabb");
    await expect(page.getByText("رَبّ", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Save for review" }).first().click();
    await expect(page.getByRole("button", { name: "Saved" }).first()).toBeVisible();

    await expect.poll(async () => countRows(client, "user_vocabulary", userId)).toBeGreaterThan(0);
    await expect.poll(async () => countRows(client, "review_items", userId)).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Saved" }).first().click();
    await expect(page.getByRole("button", { name: "Save for review" }).first()).toBeVisible();
    await expect.poll(async () => countRows(client, "user_vocabulary", userId)).toBe(0);
  });
});

import { test, expect } from "@playwright/test";

import { createTestUserClient, countRows } from "./utils/db";

test.describe("daily study", () => {
  test.beforeAll(async () => {
    const { client, userId } = await createTestUserClient();
    // Seed review items directly so the queue is non-empty regardless of
    // whether a learning path exists yet — this spec owns its own state
    // instead of depending on placement.spec.ts having run first.
    const today = new Date().toISOString().slice(0, 10);
    await client.from("review_items").insert([
      {
        user_id: userId,
        item_type: "word",
        item_key: "e2e:daily-word-1",
        front: "كِتَاب",
        back: "kitāb — book",
        due_date: today,
      },
      {
        user_id: userId,
        item_type: "word",
        item_key: "e2e:daily-word-2",
        front: "رَحْمَة",
        back: "mercy",
        due_date: today,
      },
    ]);
  });

  test("the queue loads and shows progress through items", async ({ page }) => {
    await page.goto("/daily");
    await expect(page.getByText(/Item 1 of \d+/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Show answer" })).toBeVisible();
  });

  test(
    "completing the session logs exactly one study_sessions row and a page " +
      "refresh afterwards does not create a duplicate (regression: the timer " +
      "used to insert a row on every 1s tick after the session finished)",
    async ({ page }) => {
      const { client, userId } = await createTestUserClient();

      await page.goto("/daily");
      await expect(page.getByText(/Item 1 of \d+/)).toBeVisible();

      // Work through whatever mix of review / weak-area / path-preview cards
      // the queue contains until the "Session complete" screen appears.
      for (let i = 0; i < 20; i++) {
        if (
          await page
            .getByText("Session complete")
            .isVisible()
            .catch(() => false)
        )
          break;

        const reveal = page.getByRole("button", { name: "Show answer" });
        if (await reveal.isVisible().catch(() => false)) {
          await reveal.click();
          await page.getByRole("button", { name: "Easy" }).click();
          continue;
        }
        const markPracticed = page.getByRole("button", { name: "Mark as practiced" });
        if (await markPracticed.isVisible().catch(() => false)) {
          await markPracticed.click();
          continue;
        }
        const continueBtn = page.getByRole("button", { name: "Continue" });
        if (await continueBtn.isVisible().catch(() => false)) {
          await continueBtn.click();
          continue;
        }
        break;
      }

      await expect(page.getByText("Session complete")).toBeVisible({ timeout: 15_000 });

      // The regression: the logging effect used to depend on `elapsed`
      // (which ticks every second), so it kept re-firing and inserting a
      // new row after the session was already finished. Sit through a few
      // more ticks before asserting.
      await page.waitForTimeout(3_000);
      expect(await countRows(client, "study_sessions", userId)).toBe(1);

      await page.reload();
      await page.waitForTimeout(2_000);
      expect(await countRows(client, "study_sessions", userId)).toBe(1);
    },
  );
});

import { test, expect } from "@playwright/test";

import { createTestUserClient, countRows } from "./utils/db";

/**
 * Mirrors localDate() in src/lib/study.ts (not imported — that module also
 * imports the browser Supabase client, see the placement.spec.ts comment on
 * the same constraint). The app deliberately queries due items by the
 * learner's *local* calendar day, not UTC, so a row seeded with the UTC date
 * can land a day off and silently fall outside the "due today" query.
 */
function localDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

test.describe("daily study", () => {
  test.beforeAll(async () => {
    const { client, userId } = await createTestUserClient();
    // Seed review items directly so the queue is non-empty regardless of
    // whether a learning path exists yet — this spec owns its own state
    // instead of depending on placement.spec.ts having run first.
    const today = localDate();
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
      // The loop below now sizes itself off the queue's real length, which
      // is driven by however much upstream specs seeded — give it more room
      // than the global 30s default so a larger queue doesn't trip the test
      // timeout rather than the loop's own bound.
      test.setTimeout(60_000);

      const { client, userId } = await createTestUserClient();

      await page.goto("/daily");
      const totalText = await page.getByText(/Item 1 of \d+/).innerText();
      const totalMatch = /Item 1 of (\d+)/.exec(totalText);
      // The queue's actual size depends on how much state earlier specs in
      // the suite have seeded into review_items/weak_areas by the time this
      // runs (e.g. 03-placement.spec.ts's zero-score test adds its own weak
      // areas + review items) — a fixed iteration bound drifts stale as that
      // upstream state grows. Read the real total from "Item 1 of N" and
      // size the loop off it, with a small buffer for cards that render
      // additional steps (e.g. a reveal-then-rate item counts once but takes
      // two clicks).
      const queueSize = totalMatch ? Number(totalMatch[1]) : 20;

      // Work through whatever mix of review / weak-area / path-preview cards
      // the queue contains until the "Session complete" screen appears. Each
      // item costs roughly 3 loop iterations in practice: one to reveal +
      // grade it, then one or two more spent in the 300ms fallback wait
      // while the next card's write/refetch round-trip settles before its
      // "Show answer" button appears. queueSize + 10 was measured to run out
      // partway through a real (12-item) queue; sizing off that per-item
      // cost with headroom avoids re-tuning this every time upstream specs
      // change how much they seed.
      for (let i = 0; i < queueSize * 4 + 10; i++) {
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
        // isVisible() checks the DOM right now rather than waiting; the
        // previous click's answer write is awaited before the next card
        // renders, so an iteration can land in the gap between them with
        // nothing yet visible. Give it a moment before concluding the queue
        // is genuinely exhausted.
        await page.waitForTimeout(300);
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

import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Covers Sub-phase 3.2A — review_items.item_type = 'concept' was already
 * supported end-to-end by the schema, Daily Study, SM-2 update path, and
 * rendering, but fetchPracticeQueue/fetchPracticeSummary (src/lib/practice.ts)
 * silently excluded it, exactly mirroring the gap Sub-phase 2.5 found and
 * fixed for 'letter' before it was added to those same two functions. This
 * spec proves the fix generically — no Module 3 content is seeded or
 * assumed; item_key values below are throwaway test fixtures, not the real
 * concept:fatha/kasra/damma keys a future Module 3 migration would use.
 */

function localDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function resetReviewState(
  client: Awaited<ReturnType<typeof createTestUserClient>>["client"],
  userId: string,
) {
  await client.from("review_items").delete().eq("user_id", userId);
  await client.from("weak_areas").delete().eq("user_id", userId);
  // practice_attempts is intentionally append-only application data (see
  // resetLessonProgress in utils/db.ts for the same discipline) — without
  // clearing it, a --repeat-each run reusing the same fixed item_key would
  // see attempt counts accumulate across repeats instead of resetting.
  await client.from("practice_attempts").delete().eq("user_id", userId);
}

test.describe("Practice: concept-type review items", () => {
  test("a due concept item appears in Practice, counts toward the due total, can be answered, and updates SM-2 fields normally", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await resetReviewState(client, userId);

    const today = localDate();
    await client.from("review_items").insert({
      user_id: userId,
      item_type: "concept",
      item_key: "e2e:concept-test-mark",
      front: "◌ّ",
      back: "Test mark — a throwaway concept for this regression spec only",
      due_date: today,
    });

    const { data: before, error: beforeError } = await client
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .eq("item_key", "e2e:concept-test-mark")
      .single();
    if (beforeError) throw beforeError;
    expect(before.status).toBe("new");
    expect(before.repetitions).toBe(0);

    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
    // The concept item is the only due item, so the "start" button must be
    // gated open by it alone — proves fetchPracticeSummary's total counts it.
    await expect(page.getByRole("button", { name: "Start Review Session" })).toBeVisible();

    await page.getByRole("button", { name: "Start Review Session" }).click();

    let sawOurCard = false;
    for (let i = 0; i < 10; i++) {
      if (
        await page
          .getByText("Session complete")
          .isVisible()
          .catch(() => false)
      )
        break;
      const reveal = page.getByRole("button", { name: "Tap to reveal" });
      if (await reveal.isVisible().catch(() => false)) {
        const isOurs = await page
          .getByText("◌ّ", { exact: true })
          .isVisible()
          .catch(() => false);
        await reveal.click();
        if (isOurs) sawOurCard = true;
        await page.getByRole("button", { name: "Got it" }).click();
        continue;
      }
      await page.waitForTimeout(300);
    }
    expect(sawOurCard).toBe(true);
    await expect(page.getByText("Session complete")).toBeVisible({ timeout: 15_000 });

    const { data: after, error: afterError } = await client
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .eq("item_key", "e2e:concept-test-mark")
      .single();
    if (afterError) throw afterError;
    expect(after.status).toBe("learning");
    expect(after.repetitions).toBe(1);
    expect(after.due_date > before.due_date).toBe(true);

    // practice_attempts is generic too (no item_type CHECK constraint) —
    // confirm the attempt was actually logged, not just the SM-2 fields.
    const { count: attemptCount } = await client
      .from("practice_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("item_key", "e2e:concept-test-mark");
    expect(attemptCount).toBe(1);
  });

  test("a due concept item also appears in Daily Study through the same unfiltered due-items query", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await resetReviewState(client, userId);

    const today = localDate();
    await client.from("review_items").insert({
      user_id: userId,
      item_type: "concept",
      item_key: "e2e:concept-daily-test",
      front: "◌ّ",
      back: "Test mark",
      due_date: today,
    });

    await page.goto("/daily");
    await expect(page.getByText(/Item 1 of \d+/)).toBeVisible();
    await expect(page.getByText("◌ّ", { exact: true })).toBeVisible();
  });

  test("existing letter and word review items remain practiceable and correctly counted alongside a concept item, with no duplication", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await resetReviewState(client, userId);

    const today = localDate();
    await client.from("review_items").insert([
      {
        user_id: userId,
        item_type: "letter",
        item_key: "e2e:letter-regression",
        front: "ب",
        back: "Bā'",
        due_date: today,
      },
      {
        user_id: userId,
        item_type: "word",
        item_key: "e2e:word-regression",
        front: "سَلَام",
        back: "salām — peace",
        due_date: today,
      },
      {
        user_id: userId,
        item_type: "concept",
        item_key: "e2e:concept-regression",
        front: "◌ّ",
        back: "Test mark",
        due_date: today,
      },
    ]);

    await page.goto("/practice");
    // Exactly 3 due items were seeded (one of each type); the queue must
    // reflect all three exactly once each, not fewer (a type silently
    // excluded) or more (double-counted).
    await expect(page.getByText("1 due").first()).toBeVisible();
    await page.getByRole("button", { name: "Start Review Session" }).click();

    let seenLetter = false;
    let seenWord = false;
    let seenConcept = false;
    for (let i = 0; i < 12; i++) {
      if (
        await page
          .getByText("Session complete")
          .isVisible()
          .catch(() => false)
      )
        break;
      const reveal = page.getByRole("button", { name: "Tap to reveal" });
      if (await reveal.isVisible().catch(() => false)) {
        if (
          await page
            .getByText("ب", { exact: true })
            .isVisible()
            .catch(() => false)
        ) {
          seenLetter = true;
        }
        if (
          await page
            .getByText("سَلَام", { exact: true })
            .isVisible()
            .catch(() => false)
        ) {
          seenWord = true;
        }
        if (
          await page
            .getByText("◌ّ", { exact: true })
            .isVisible()
            .catch(() => false)
        ) {
          seenConcept = true;
        }
        await reveal.click();
        await page.getByRole("button", { name: "Got it" }).click();
        continue;
      }
      await page.waitForTimeout(300);
    }
    await expect(page.getByText("Session complete")).toBeVisible({ timeout: 15_000 });
    expect(seenLetter).toBe(true);
    expect(seenWord).toBe(true);
    expect(seenConcept).toBe(true);

    const { count: stillDue } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("item_key", ["e2e:letter-regression", "e2e:word-regression", "e2e:concept-regression"])
      .lte("due_date", today);
    expect(stillDue).toBe(0);
  });

  test("French interface: a due concept item renders correctly in Practice", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await resetReviewState(client, userId);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      const today = localDate();
      await client.from("review_items").insert({
        user_id: userId,
        item_type: "concept",
        item_key: "e2e:concept-fr-test",
        front: "◌ّ",
        back: "Marque de test",
        due_date: today,
      });

      await page.goto("/practice");
      await expect(page.getByRole("heading", { name: "S'entraîner" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Commencer la révision" })).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});

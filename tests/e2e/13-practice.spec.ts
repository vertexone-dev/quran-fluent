import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/** Mirrors localDate() in src/lib/study.ts — see 04-daily-study.spec.ts for why. */
function localDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

test.describe("practice", () => {
  test("shows real due counts, completes a review session, and the queue reflects it afterwards", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("review_items").delete().eq("user_id", userId);
    await client.from("weak_areas").delete().eq("user_id", userId);
    await client.from("memorization_progress").delete().eq("user_id", userId);

    const today = localDate();
    await client.from("review_items").insert([
      {
        user_id: userId,
        item_type: "word",
        item_key: "e2e:practice-word-1",
        front: "سَلَام",
        back: "salām — peace",
        due_date: today,
      },
    ]);
    await client.from("memorization_progress").insert({
      user_id: userId,
      surah_number: 112,
      ayah_number: 1,
      status: "memorized",
    });
    await client.from("review_items").insert({
      user_id: userId,
      item_type: "ayah",
      item_key: "ayah:112:1",
      front: "قُلْ هُوَ اللَّهُ أَحَدٌ",
      back: "Say, He is Allah, One",
      due_date: today,
    });
    await client
      .from("weak_areas")
      .upsert(
        { user_id: userId, area: "Letter recognition", source: "self_assessed", strength: 20 },
        { onConflict: "user_id, area, source" },
      );

    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
    await expect(page.getByText("1 due").first()).toBeVisible();
    await expect(page.getByText("1 topics")).toBeVisible();
    await expect(page.getByText("1 Ayat")).toBeVisible();

    await page.getByRole("button", { name: "Start Review Session" }).click();

    // Work through whatever the queue contains (vocabulary + memorization
    // review cards, plus the weak-area card) until the summary appears.
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
        await reveal.click();
        await page.getByRole("button", { name: "Got it" }).click();
        continue;
      }
      const markPracticed = page.getByRole("button", { name: "Mark as practiced" });
      if (await markPracticed.isVisible().catch(() => false)) {
        await markPracticed.click();
        continue;
      }
      await page.waitForTimeout(300);
    }

    await expect(page.getByText("Session complete")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Items reviewed")).toBeVisible();

    // The two review_items answered "Got it" must have moved out of "due
    // today" — proof the session actually recorded attempts through the
    // existing SM-2 engine, not just advanced the UI.
    const { count: stillDue } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("item_key", ["e2e:practice-word-1", "ayah:112:1"])
      .lte("due_date", today);
    expect(stillDue).toBe(0);
  });
});

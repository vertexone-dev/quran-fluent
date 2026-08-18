import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

test.describe("progress", () => {
  test("reflects real activity: weekly minutes, today's minutes, weak areas and vocabulary stats", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();

    // Self-contained: 04-daily-study.spec.ts logs its own study_sessions row
    // and 03-placement.spec.ts's zero-score test seeds its own "Letter
    // recognition" weak area earlier in the run — both would otherwise
    // collide with the exact values this test seeds and asserts on.
    await client.from("study_sessions").delete().eq("user_id", userId);
    await client.from("weak_areas").delete().eq("user_id", userId);

    await client.from("study_sessions").insert({
      user_id: userId,
      activity_type: "e2e-seed",
      minutes: 12,
      occurred_at: new Date().toISOString(),
    });
    await client
      .from("weak_areas")
      .upsert(
        { user_id: userId, area: "Letter recognition", source: "self_assessed", strength: 40 },
        { onConflict: "user_id, area, source" },
      );
    const { data: word } = await client
      .from("word_frequency")
      .select("id")
      .order("frequency_rank", { ascending: true })
      .limit(1)
      .single();
    await client
      .from("user_vocabulary")
      .upsert(
        { user_id: userId, word_id: word!.id, status: "learning" },
        { onConflict: "user_id, word_id" },
      );

    await page.goto("/progress");

    await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
    // "{count} min" appears for both "Past 7 days" and "Today" once seeded.
    await expect(page.getByText("12 min", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Letter recognition")).toBeVisible();
    await expect(page.getByText("40%")).toBeVisible();
    await expect(page.getByText("Words learned")).toBeVisible();
  });

  test("shows empty states when there is no weak-area or vocabulary activity", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("weak_areas").delete().eq("user_id", userId);
    await client.from("user_vocabulary").delete().eq("user_id", userId);

    await page.goto("/progress");
    await expect(
      page.getByText("No weak areas yet. Take the placement test or practice to reveal them."),
    ).toBeVisible();
    await expect(
      page.getByText(
        "You haven't saved any words yet. Visit the Qur'an page to start building your vocabulary.",
      ),
    ).toBeVisible();
  });
});

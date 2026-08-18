import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

test.describe("learning plan", () => {
  test("with no placement taken yet, the plan shows unset fields and a CTA to test", async ({
    page,
  }) => {
    // Self-contained rather than relying on running before 01-onboarding.spec.ts
    // and 03-placement.spec.ts: clear the fields those specs set so this test
    // sees the same "nothing chosen yet" state as a freshly reset account.
    const { client, userId } = await createTestUserClient();
    await client.from("placement_attempts").delete().eq("user_id", userId);
    await client.from("learning_paths").delete().eq("user_id", userId);
    await client
      .from("learning_preferences")
      .update({ arabic_level: null, primary_goal: null })
      .eq("user_id", userId);

    await page.goto("/learning-plan");
    await expect(page.getByRole("heading", { name: "My learning plan" })).toBeVisible();
    await expect(page.getByText("Not set").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Take the placement test" })).toBeVisible();
  });

  test("once a learning path exists, the plan shows the path timeline", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    const { data: path, error } = await client
      .from("learning_paths")
      .upsert({ user_id: userId, level: "foundation", source: "manual" }, { onConflict: "user_id" })
      .select("id")
      .single();
    expect(error).toBeNull();

    await client.from("learning_path_steps").delete().eq("path_id", path!.id);
    await client.from("learning_path_steps").insert([
      {
        path_id: path!.id,
        user_id: userId,
        step_key: "alphabet",
        order_index: 0,
        status: "completed",
        progress: 100,
      },
      {
        path_id: path!.id,
        user_id: userId,
        step_key: "harakat",
        order_index: 1,
        status: "in_progress",
        progress: 0,
      },
      {
        path_id: path!.id,
        user_id: userId,
        step_key: "connected_letters",
        order_index: 2,
        status: "available",
        progress: 0,
      },
    ]);

    await page.goto("/learning-plan");
    // Several sequential queries (profile, preferences, path, steps) back
    // this page; the default 5s assertion timeout was occasionally tighter
    // than that load, seen still on its loading skeleton at 5s.
    await expect(page.getByText("Starting level: Foundation")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: "Retake the placement test" })).toBeVisible();
  });
});

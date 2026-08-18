import { test, expect, type Page } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Mirrors PLACEMENT_QUESTIONS[].correct in src/lib/placement.ts. Kept here
 * (rather than imported) because that module also imports the browser
 * Supabase client, which cannot be constructed outside a Vite runtime.
 */
const CORRECT_INDEXES = [0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 1];
const QUESTION_COUNT = CORRECT_INDEXES.length;
const RESULT_STEP_LABEL = "Your recommended starting point";

async function answerAll(
  page: Page,
  pickIndex: (correct: number, questionIndex: number) => number,
) {
  for (let i = 0; i < QUESTION_COUNT; i++) {
    // Scoped to <main>: the header's own EN/FR language toggle buttons also
    // carry aria-pressed, and an unscoped locator counted them first —
    // options.nth(0..3) was clicking "EN"/"FR", never an actual answer.
    const options = page.locator("main button[aria-pressed]");
    const isLast = i === QUESTION_COUNT - 1;
    const nextButton = page.getByRole("button", { name: isLast ? RESULT_STEP_LABEL : "Continue" });

    // The option click enables `nextButton`; on a freshly-mounted question
    // (most visibly question 1) the click can land before the option's
    // onClick is wired up, leaving `nextButton` disabled indefinitely.
    // Retry the click rather than hang on it.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await options.nth(pickIndex(CORRECT_INDEXES[i]!, i)).click();
      try {
        await expect(nextButton).toBeEnabled({ timeout: 2_000 });
        break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
    await nextButton.click();
  }
}

test.describe("placement", () => {
  test("skipping from the intro goes straight to the dashboard with no attempt saved", async ({
    page,
  }) => {
    await page.goto("/placement");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const { client, userId } = await createTestUserClient();
    const { count } = await client
      .from("placement_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(0);
  });

  test("a perfect score recommends the top level and saves a learning path", async ({ page }) => {
    await page.goto("/placement");
    await page.getByRole("button", { name: "Start the placement test" }).click();
    await answerAll(page, (correct) => correct);

    await expect(page.getByText("Intermediate Qur'anic Arabic")).toBeVisible();
    await expect(page.getByText("12 of 12 correct")).toBeVisible();

    await page.getByRole("button", { name: "Start recommended course" }).click();
    await expect(page).toHaveURL(/\/learning-plan/, { timeout: 10_000 });

    const { client, userId } = await createTestUserClient();
    const { data: attempt } = await client
      .from("placement_attempts")
      .select("score, total, recommended_level")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();
    expect(attempt?.score).toBe(12);
    expect(attempt?.total).toBe(12);
    expect(attempt?.recommended_level).toBe("intermediate_quranic");

    const { data: path } = await client
      .from("learning_paths")
      .select("id, level")
      .eq("user_id", userId)
      .single();
    expect(path?.level).toBe("intermediate_quranic");

    const { count: stepCount } = await client
      .from("learning_path_steps")
      .select("*", { count: "exact", head: true })
      .eq("path_id", path!.id);
    expect(stepCount).toBe(9); // one row per PATH_STEPS entry
  });

  test("a zero score recommends complete beginner and seeds weak areas + review items", async ({
    page,
  }) => {
    await page.goto("/placement");
    await page.getByRole("button", { name: "Start the placement test" }).click();
    await answerAll(page, (correct) => (correct + 1) % 4);

    await expect(page.getByText("Complete Beginner", { exact: true })).toBeVisible();
    await expect(page.getByText("0 of 12 correct")).toBeVisible();

    const { client, userId } = await createTestUserClient();
    // finish() fires its save off with `void` and doesn't block the result
    // screen on it, so the write can still be in flight here. Unlike the
    // perfect-score test above, nothing here clicks a follow-up button that
    // would incidentally give it time to land — poll instead.
    await expect
      .poll(async () => {
        const { count } = await client
          .from("weak_areas")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("source", "placement");
        return count ?? 0;
      })
      .toBeGreaterThan(0);

    await expect
      .poll(async () => {
        const { count } = await client
          .from("review_items")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        return count ?? 0;
      })
      .toBeGreaterThan(0);
  });
});

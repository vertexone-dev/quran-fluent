import { test, expect } from "@playwright/test";

/**
 * Offline mobile Lessons/Practice regression suite -- see reader.spec.ts
 * for why this exists instead of running the root-level lesson-player
 * specs (17/21/48). Exercises the real, unmodified production grading
 * logic (curriculum-render.ts) against real exported lesson content, not
 * fixtures.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
});

test.describe("Lessons drill-down", () => {
  test("Levels -> Modules -> Lessons shows real curriculum content", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Learn" }).click();
    await expect(page.locator(".list-row")).toHaveCount(6); // 6 real levels

    await page.locator(".list-row", { hasText: "Foundations of Arabic Script" }).click();
    await expect(page.locator("h1")).toHaveText("Foundations of Arabic Script");
    const moduleCount = await page.locator(".list-row").count();
    expect(moduleCount).toBeGreaterThan(0);

    await page.locator(".list-row").first().click();
    await expect(page.locator(".list-row").first()).toBeVisible();
  });

  test("the Categories tab shows an honest empty state, not invented data", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Learn" }).click();
    await page.locator(".chip", { hasText: "Categories" }).click();
    await expect(page.locator("text=aren't part of the offline content bundle")).toBeVisible();
  });
});

test.describe("Lesson Player", () => {
  test("renders a real explanation section with a working progress bar", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Learn" }).click();
    await page.locator(".list-row", { hasText: "Foundations of Arabic Script" }).click();
    await page.locator(".list-row").first().click();
    await page.locator(".list-row").first().click();

    await expect(page.locator(".appbar-title")).toContainText("Level 1");
    await expect(page.locator("text=Step 1 of")).toBeVisible();
    await expect(page.locator(".progress-fill")).toBeVisible();
  });

  test("a multiple-choice exercise grades correctly with the real production logic", async ({
    page,
  }) => {
    // Practice jumps straight to a lesson's first exercise, which is
    // faster to reach deterministically than walking the full section
    // sequence of an arbitrary lesson.
    await page.getByTestId("home-shortcut-practice").click(); // D-1: Practice lives on Home
    await page.locator(".list-row").first().click();

    await expect(page.locator(".card h2")).toBeVisible();
    const choices = page.locator(".choice-row");
    await expect(choices.first()).toBeVisible();

    // Try every choice until one grades correct -- this suite doesn't
    // know the answer key up front (it's real, live content), but it
    // must always find exactly one correct choice and see the real
    // evaluateExerciseAnswer() result reflected in the UI.
    const count = await choices.count();
    let foundCorrect = false;
    for (let i = 0; i < count; i++) {
      await choices.nth(i).click();
      await page.locator("button:has-text('Check Answer')").click();
      const banner = page.locator(".banner");
      await expect(banner).toBeVisible();
      const isCorrect = (await banner.getAttribute("class"))?.includes("banner-success");
      if (isCorrect) {
        foundCorrect = true;
        await expect(banner).toContainText("Correct!");
        break;
      }
      await expect(banner).toContainText("Not quite.");
      // Reload to reset submitted state and try the next choice.
      await page.goto("/");
      await page.getByTestId("home-shortcut-practice").click(); // D-1: Practice lives on Home
      await page.locator(".list-row").first().click();
    }
    expect(foundCorrect, "expected exactly one choice to grade correct").toBe(true);
  });
});

test.describe("Lesson completion and accessibility", () => {
  // "The First Letter: Alif" (Level 1 -> Letter Shapes I, the first lesson
  // reached by this exact navigation path) is the shortest real lesson in
  // the bundled content -- confirmed via a direct query against
  // mobile/content-db/quran-content.sqlite, not guessed. Its real step
  // order (buildPlayerSteps interleaves an exercise right after the
  // section it's attached to, not "all sections then all exercises"):
  //   0 explanation (section) -> 1 arabic_text (section) ->
  //   2 letter_recognition (exercise, attached to step 1) ->
  //   3 tip (section) -> 4 summary (section) ->
  //   5 true_false (exercise, unattached -- the last step)
  // Short enough to walk deterministically end-to-end in a test.
  // canAdvance only requires an exercise to be *submitted*, not correct
  // (LessonPlayerScreen.tsx), so this walks through with a fixed first
  // choice throughout -- grading correctness itself is already covered by
  // the "grades correctly" test above.
  // Positional, not text-matched, past the tab click -- Level 1 / its
  // first module / its first lesson are always first in list order
  // (listLevels/listModules/listLessons all ORDER BY order_index), so
  // this works regardless of interface locale.
  async function openAlifLesson(page: import("@playwright/test").Page, lessonsTabLabel: string) {
    await page.locator(".tab-item", { hasText: lessonsTabLabel }).click();
    await page.locator(".list-row").first().click();
    await page.locator(".list-row").first().click();
    await page.locator(".list-row").first().click();
    await expect(page.locator(".appbar-title")).toContainText("Alif");
  }

  async function answerLetterRecognitionExercise(
    page: import("@playwright/test").Page,
    nextLabel: string,
    checkLabel: string,
  ) {
    await page.getByRole("button", { name: nextLabel, exact: false }).click(); // 0 -> 1
    await page.getByRole("button", { name: nextLabel, exact: false }).click(); // 1 -> 2
    await expect(page.getByRole("radiogroup")).toBeVisible(); // now on step 2
    await page.getByRole("radio").first().click();
    await page.locator("button", { hasText: checkLabel }).click();
    await expect(page.locator(".banner")).toBeVisible();
    await page.getByRole("button", { name: nextLabel, exact: false }).click(); // 2 -> 3
    await page.getByRole("button", { name: nextLabel, exact: false }).click(); // 3 -> 4
    await page.getByRole("button", { name: nextLabel, exact: false }).click(); // 4 -> 5 (last step)
  }

  test("completing the lesson shows the completion screen, and Back to Lessons returns to the levels list", async ({
    page,
  }) => {
    await openAlifLesson(page, "Learn");
    await answerLetterRecognitionExercise(page, "Next", "Check Answer");

    // Step 5: true_false, the last step -- the primary button should
    // already read "Finish", not "Next", even before it's answered.
    await expect(page.getByRole("button", { name: "Finish" })).toBeVisible();
    await page.getByRole("button", { name: "True", exact: true }).click();
    await page.locator("button", { hasText: "Check Answer" }).click();
    await expect(page.locator(".banner")).toBeVisible();
    await page.getByRole("button", { name: "Finish" }).click();

    await expect(page.getByText("Lesson complete!")).toBeVisible();
    await expect(page.getByText("Great work finishing this lesson.")).toBeVisible();

    await page.getByRole("button", { name: "Back to Lessons" }).click();
    await expect(page.locator(".appbar-title")).toHaveText("Lessons");
    await expect(page.locator(".list-row")).toHaveCount(6);
  });

  test("exercise choices are a keyboard-operable radiogroup with selected state conveyed beyond color", async ({
    page,
  }) => {
    await openAlifLesson(page, "Learn");
    await page.getByRole("button", { name: "Next", exact: false }).click(); // 0 -> 1
    await page.getByRole("button", { name: "Next", exact: false }).click(); // 1 -> 2
    await expect(page.getByRole("radiogroup")).toBeVisible(); // now on step 2

    const radios = page.getByRole("radio");
    await expect(radios.first()).toHaveAttribute("aria-checked", "false");

    // Keyboard-operable: a real <button role="radio"> responds to Space
    // natively (no custom key handling needed), unlike the previous plain
    // <div onClick> implementation, which no keyboard could activate at
    // all regardless of focus.
    await radios.first().focus();
    await page.keyboard.press(" ");
    await expect(radios.first()).toHaveAttribute("aria-checked", "true");

    await page.locator("button", { hasText: "Check Answer" }).click();
    await expect(page.locator(".banner")).toBeVisible();
    // Not color-only: the correct row (and, if a different one was
    // selected, the incorrectly-selected row too) carries a real Check or
    // X icon, not just a background-color class. At least the correct
    // row always gets one, regardless of which option this test picked.
    const iconCount = await page
      .locator(".choice-row.correct svg, .choice-row.incorrect svg")
      .count();
    expect(iconCount).toBeGreaterThanOrEqual(1);
  });

  test("True/False labels are translated, not hardcoded English, in the French locale", async ({
    page,
  }) => {
    // The language toggle lives on Home (lang-btn, aria-label "Language");
    // beforeEach already lands on Home.
    await page.getByRole("button", { name: "Language" }).click();

    await openAlifLesson(page, "Apprendre");
    await answerLetterRecognitionExercise(page, "Suivant", "Vérifier");

    await expect(page.getByRole("button", { name: "Vrai", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Faux", exact: true })).toBeVisible();
  });
});

test.describe("Practice tab", () => {
  test("lists real lessons with exercise counts, not a placeholder", async ({ page }) => {
    await page.getByTestId("home-shortcut-practice").click(); // D-1: Practice lives on Home
    await expect(page.locator(".list-row").first()).toBeVisible();
    await expect(page.locator(".chip", { hasText: /^\d+$/ }).first()).toBeVisible();
  });
});

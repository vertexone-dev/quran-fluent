import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import { completeLessonResilient, resilientAnswerAndCheck } from "./utils/lesson-interaction";

/**
 * Covers Level 5 (Guided Āyah Comprehension) Batch 2: Module 3
 * (verbal-sentences-imperative: qul as the common imperative, yā ayyuhā
 * direct address via 109:1) and Module 4 (guided-comprehension-capstone:
 * a pure-synthesis decomposition of Al-Kawthar 108:1-3).
 *
 * Deliberately does not re-test the generic lesson-completion/review-item
 * machinery already covered extensively elsewhere (specs 21-23, 40-43) --
 * covers what is new here: Module 3 rendering in both locales, 109:1's
 * canonical FK resolution, the imperative-lesson's matching exercise
 * (its first real review item) completing and persisting, the capstone's
 * completion, and that Level 5's completion/progression state correctly
 * reflects Batch 2 now existing without regressing Batch 1.
 */

type DbExercise = {
  exercise_type: string;
  payload: {
    choices?: string[];
    correctIndex?: number;
    correctAnswer?: boolean;
    pairs?: { left: string; right: string }[];
  };
};

async function apiGet(request: APIRequestContext, path: string) {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const res = await request.get(`${url}/rest/v1/${path}`, { headers: { apikey: anonKey } });
  return res.json();
}

async function fetchModuleLessons(request: APIRequestContext, moduleSlug: string) {
  const modules = (await apiGet(
    request,
    `modules?select=id,levels!inner(slug)&slug=eq.${moduleSlug}`,
  )) as {
    id: string;
  }[];
  const moduleId = modules[0]!.id;
  return (await apiGet(
    request,
    `lessons?select=id,slug,title_en,title_fr,order_index&module_id=eq.${moduleId}&order=order_index.asc`,
  )) as { id: string; slug: string; title_en: string; title_fr: string; order_index: number }[];
}

async function fetchLevelLessons(request: APIRequestContext, levelSlug: string) {
  const mods = (await apiGet(
    request,
    `modules?select=id,levels!inner(slug)&levels.slug=eq.${levelSlug}`,
  )) as { id: string }[];
  const all: { id: string }[] = [];
  for (const m of mods) {
    all.push(
      ...((await apiGet(request, `lessons?select=id&module_id=eq.${m.id}`)) as { id: string }[]),
    );
  }
  return all;
}

async function answerExercise(page: Page, exercise: DbExercise) {
  const t = exercise.exercise_type;
  await resilientAnswerAndCheck(page, async () => {
    if (t === "multiple_choice" || t === "reading_check") {
      const choices = exercise.payload.choices!;
      const correctIndex = exercise.payload.correctIndex!;
      await page.getByRole("radio", { name: choices[correctIndex], exact: true }).click();
    } else if (t === "true_false") {
      const correct = exercise.payload.correctAnswer!;
      await page.getByRole("button", { name: correct ? "True" : "False" }).click();
    } else if (t === "matching") {
      const pairs = exercise.payload.pairs!;
      const comboboxes = page.getByRole("combobox");
      for (let i = 0; i < pairs.length; i++) {
        await comboboxes.nth(i).click();
        const rightText = pairs[i]!.right.slice(0, 30);
        await page
          .getByRole("option", {
            name: new RegExp(rightText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
          })
          .click();
      }
    } else {
      throw new Error(`answerExercise: unhandled exercise_type "${t}"`);
    }
  });
}

test.describe("Level 5 Batch 2 — Module 3: verbal-sentences-imperative", () => {
  test("recognizing-the-imperative-qul renders correctly in English, completes, and persists its first imperative review item", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "verbal-sentences-imperative");
    const lesson = lessons.find((l) => l.slug === "recognizing-the-imperative-qul")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_key", "concept:verb-imperative");

    await page.goto(`/lesson/${lesson.id}`);
    await expect(
      page.getByRole("heading", { name: "Recognizing the Imperative: Qul" }),
    ).toBeVisible();
    await expect(page.getByText(/most common imperative in the Qur.an/)).toBeVisible();

    const exercises = (await apiGet(
      request,
      `lesson_exercises?select=exercise_type,payload&lesson_id=eq.${lesson.id}&order=order_index.asc`,
    )) as DbExercise[];
    expect(exercises).toHaveLength(3);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "true_false",
      "multiple_choice",
      "matching",
    ]);

    await completeLessonResilient(page, exercises, answerExercise);
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    expect(progress?.status).toBe("completed");

    await page.waitForTimeout(1000);
    const { data: reviewItem } = await client
      .from("review_items")
      .select("item_key, back")
      .eq("user_id", userId)
      .eq("item_key", "concept:verb-imperative")
      .maybeSingle();
    expect(reviewItem).not.toBeNull();
    expect(reviewItem!.back).toContain("qul");

    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_key", "concept:verb-imperative");
  });

  test("direct-address-ya-ayyuha renders correctly in French with no English leakage, and 109:1 resolves from the canonical dataset", async ({
    page,
    request,
  }) => {
    const ayahs = (await apiGet(
      request,
      "ayahs?select=arabic_text&surah_number=eq.109&ayah_number=eq.1",
    )) as { arabic_text: string }[];
    const canonicalText = ayahs[0]!.arabic_text;

    const lessons = await fetchModuleLessons(request, "verbal-sentences-imperative");
    const lesson = lessons.find((l) => l.slug === "direct-address-ya-ayyuha")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await expect(
        page.getByRole("heading", { name: "Adresse directe : Yā Ayyuhā" }),
      ).toBeVisible();
      await expect(page.getByText(/interpeller directement quelqu.un/)).toBeVisible();
      // No English leakage: the distinctive English explanation wording
      // must not appear anywhere on a fully French-resolved lesson.
      await expect(page.getByText(/calling out to someone directly/)).not.toBeVisible();

      await page.getByRole("button", { name: "Suivant" }).click(); // past explanation, to quran_example
      // The quran_example section must render the exact canonical Arabic
      // fetched live from the ayahs table, not a hand-typed copy.
      await expect(page.getByText(canonicalText, { exact: true })).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});

test.describe("Level 5 Batch 2 — Module 4: guided-comprehension-capstone", () => {
  test("guided-decomposition-al-kawthar renders and completes, with zero new review items (pure synthesis)", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "guided-comprehension-capstone");
    const lesson = lessons.find((l) => l.slug === "guided-decomposition-al-kawthar")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);

    await page.goto(`/lesson/${lesson.id}`);
    await expect(
      page.getByRole("heading", { name: "Guided Decomposition: Sūrah Al-Kawthar" }),
    ).toBeVisible();

    const exercises = (await apiGet(
      request,
      `lesson_exercises?select=exercise_type,payload&lesson_id=eq.${lesson.id}&order=order_index.asc`,
    )) as DbExercise[];
    expect(exercises).toHaveLength(4);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "reading_check",
      "multiple_choice",
      "true_false",
      "multiple_choice",
    ]);
    expect(exercises.some((e) => e.exercise_type === "matching")).toBe(false);

    await completeLessonResilient(page, exercises, answerExercise);
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    expect(progress?.status).toBe("completed");
  });
});

test.describe("Level 5 progression after Batch 2", () => {
  test("ayah_comprehension only reports Completed once all 7 Level 5 lessons (Batch 1 + Batch 2) are done -- not after Batch 1 alone", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);

    const level1Lessons = await fetchLevelLessons(request, "foundations-of-arabic-script");
    const level2Lessons = await fetchLevelLessons(request, "basic-vocabulary-and-patterns");
    const level3Lessons = await fetchLevelLessons(request, "roots-and-word-patterns");
    const level4Lessons = await fetchLevelLessons(request, "core-grammar");
    const batch1Lessons = [
      ...(await fetchModuleLessons(request, "attached-particles")),
      ...(await fetchModuleLessons(request, "verbal-sentences-past")),
    ];
    const batch2Lessons = [
      ...(await fetchModuleLessons(request, "verbal-sentences-imperative")),
      ...(await fetchModuleLessons(request, "guided-comprehension-capstone")),
    ];
    const allLevel5Lessons = [...batch1Lessons, ...batch2Lessons];

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        [
          ...level1Lessons,
          ...level2Lessons,
          ...level3Lessons,
          ...level4Lessons,
          ...allLevel5Lessons,
        ].map((l) => l.id),
      );

    const markCompleted = (lessons: { id: string }[]) =>
      client.from("user_lesson_progress").insert(
        lessons.map((l) => ({
          user_id: userId,
          lesson_id: l.id,
          status: "completed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          last_section_index: 1,
          progress_percent: 100,
        })),
      );

    async function resetPathTo(step: string) {
      const { data: existingPath } = await client
        .from("learning_paths")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingPath) {
        await client.from("learning_path_steps").delete().eq("path_id", existingPath.id);
        await client.from("learning_paths").delete().eq("user_id", userId);
      }
      const { data: newPath } = await client
        .from("learning_paths")
        .insert({ user_id: userId, level: "complete_beginner", source: "manual" })
        .select("id")
        .single();
      const PATH_STEPS = [
        "alphabet",
        "harakat",
        "connected_letters",
        "reading",
        "vocabulary",
        "roots",
        "grammar",
        "ayah_comprehension",
        "surah_mastery",
      ];
      await client.from("learning_path_steps").insert(
        PATH_STEPS.map((s, index) => ({
          path_id: newPath!.id,
          user_id: userId,
          step_key: s,
          order_index: index,
          status: s === step ? "in_progress" : "locked",
          progress: 0,
          lesson_id: null,
        })),
      );
    }

    // Levels 1-4 complete, Level 5 Batch 1 complete, Batch 2 NOT complete
    // -> ayah_comprehension must NOT falsely report Completed, and its
    // link must point into a real Batch 2 lesson (the next incomplete one).
    await markCompleted(level1Lessons);
    await markCompleted(level2Lessons);
    await markCompleted(level3Lessons);
    await markCompleted(level4Lessons);
    await markCompleted(batch1Lessons);
    await resetPathTo("ayah_comprehension");

    const ayahRow = page.locator("li", { hasText: "Ayah comprehension" });
    await page.goto("/learning-plan");
    await expect(
      ayahRow.getByText("Completed", { exact: true }),
      "Level 5 must NOT report Completed after only Batch 1 -- Batch 2 (verbal-sentences-imperative + guided-comprehension-capstone) is not done yet",
    ).not.toBeVisible();
    await expect(ayahRow.getByText("In progress")).toBeVisible();
    const href = await ayahRow.getByRole("link").getAttribute("href");
    const batch2LessonIds = new Set(batch2Lessons.map((l) => l.id));
    expect(
      batch2LessonIds.has(href?.split("/lesson/")[1] ?? ""),
      "the ayah_comprehension step must link into a real Batch 2 lesson, not a dead link, once Batch 1 is done",
    ).toBe(true);

    // Now complete Batch 2 too -> Level 5 is fully done.
    await markCompleted(batch2Lessons);
    await resetPathTo("ayah_comprehension");

    const ayahRowDone = page.locator("li", { hasText: "Ayah comprehension" });
    await page.goto("/learning-plan");
    await expect(ayahRowDone.getByText("Completed", { exact: true })).toBeVisible();
  });

  test("Level 5 Batch 1 modules and lesson counts remain unchanged after Batch 2", async ({
    request,
  }) => {
    const batch1Lessons = [
      ...(await fetchModuleLessons(request, "attached-particles")),
      ...(await fetchModuleLessons(request, "verbal-sentences-past")),
    ];
    expect(batch1Lessons).toHaveLength(4);
    expect(batch1Lessons.map((l) => l.slug).sort()).toEqual(
      [
        "attached-prefixes-wa-al-bi-li",
        "independent-prepositions-fi-min-ala",
        "recognizing-past-tense-verbs",
        "guided-decomposition-al-falaq-2",
      ].sort(),
    );
  });
});

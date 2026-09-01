import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import {
  advanceUntilVisibleResilient,
  completeLessonResilient,
  resilientAnswerAndCheck,
  waitForHeadingResilient,
} from "./utils/lesson-interaction";

/**
 * Covers Level 2 Batch 2: "core-vocabulary-2" (word_frequency ranks 11-20,
 * same shape as Batch 1's core-vocabulary-1) and "short-phrases" (a
 * deliberately smaller pure-synthesis module — two-to-four-word ayahs built
 * entirely from vocabulary already taught, introducing zero new review
 * concepts). Also extends 32-level2-batch1-...spec.ts's progression-resolver
 * coverage two modules further, proving the "vocabulary" learning-path step
 * walks core-vocabulary-1 -> core-vocabulary-2 -> short-phrases with zero
 * application-code changes (findCurriculumEntryPoint, generalized in Batch
 * 1, needed no modification for this batch).
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
  const modules = (await apiGet(request, `modules?select=id&slug=eq.${moduleSlug}`)) as {
    id: string;
  }[];
  const moduleId = modules[0]!.id;
  return (await apiGet(
    request,
    `lessons?select=id,slug,title_en,title_fr,order_index&module_id=eq.${moduleId}&order=order_index.asc`,
  )) as { id: string; slug: string; title_en: string; title_fr: string; order_index: number }[];
}

/** Fetches the exact governed Arabic/EN/FR text for an ayah, so assertions
 * never rely on Arabic re-typed by hand into this test file (a recurring,
 * invisible combining-mark-order class of bug on this project). */
async function fetchAyah(request: APIRequestContext, surah: number, ayah: number) {
  const rows = (await apiGet(
    request,
    `ayahs?select=arabic_text,translation_en,translation_fr&surah_number=eq.${surah}&ayah_number=eq.${ayah}`,
  )) as { arabic_text: string; translation_en: string; translation_fr: string }[];
  return rows[0]!;
}

/** Fetches the exact governed Arabic word for a word_frequency rank, for
 * the same reason as fetchAyah. */
async function fetchWord(request: APIRequestContext, rank: number) {
  const rows = (await apiGet(request, `word_frequency?select=word&frequency_rank=eq.${rank}`)) as {
    word: string;
  }[];
  return rows[0]!.word;
}

/** Mirrors buildPlayerSteps' ordering (src/lib/curriculum.ts) exactly. */
async function fetchOrderedExercises(
  client: Awaited<ReturnType<typeof createTestUserClient>>["client"],
  lessonId: string,
): Promise<DbExercise[]> {
  const { data: sections } = await client
    .from("lesson_sections")
    .select("id, order_index")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });
  const { data: exercises } = await client
    .from("lesson_exercises")
    .select("section_id, order_index, exercise_type, payload")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });

  const ordered: DbExercise[] = [];
  for (const section of sections ?? []) {
    for (const ex of (exercises ?? []).filter((e) => e.section_id === section.id)) {
      ordered.push(ex as DbExercise);
    }
  }
  for (const ex of exercises ?? []) {
    if (!ex.section_id) ordered.push(ex as DbExercise);
  }
  return ordered;
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
        await page.getByRole("option", { name: pairs[i]!.right, exact: true }).click();
      }
    } else {
      throw new Error(`answerExercise: unhandled exercise_type "${t}"`);
    }
  });
}

/** Advances through sections/exercises (answering each as encountered)
 * until targetText becomes visible, rather than running to completion.
 * Wall-clock-bounded, remount-resilient replacement for the old
 * fixed-60-iteration loop -- see utils/lesson-interaction.ts. */
async function advanceUntilVisible(
  page: Page,
  exercises: DbExercise[],
  targetText: string | RegExp,
) {
  await advanceUntilVisibleResilient(page, exercises, targetText, answerExercise);
}

/** Wall-clock-bounded, remount-resilient replacement for the old
 * fixed-60-iteration loop -- see utils/lesson-interaction.ts. */
async function completeLesson(page: Page, exercises: DbExercise[]) {
  await completeLessonResilient(page, exercises, answerExercise);
}

test.describe("Level 2 Batch 2 — Module 3: Core Vocabulary II", () => {
  test("module and lessons exist, in the correct order, under Level 2", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index,levels(slug)&slug=eq.core-vocabulary-2",
    )) as {
      slug: string;
      title_en: string;
      title_fr: string;
      order_index: number;
      levels: { slug: string };
    }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Core Vocabulary II");
    expect(modules[0]!.levels.slug).toBe("basic-vocabulary-and-patterns");
    expect(modules[0]!.order_index).toBe(2);

    const lessons = await fetchModuleLessons(request, "core-vocabulary-2");
    expect(lessons.map((l) => l.slug)).toEqual(["vocabulary-3", "vocabulary-4"]);
  });

  test("Level 1 (33 lessons) and Batch 1 (5 lessons) remain completely unchanged", async ({
    request,
  }) => {
    const level1Mods = (await apiGet(
      request,
      "modules?select=id,levels!inner(slug)&levels.slug=eq.foundations-of-arabic-script",
    )) as { id: string }[];
    let total = 0;
    for (const m of level1Mods) {
      const lessons = (await apiGet(
        request,
        `lessons?select=id&module_id=eq.${m.id}`,
      )) as unknown[];
      total += lessons.length;
    }
    expect(total).toBe(33);

    const batch1Lessons1 = await fetchModuleLessons(request, "long-vowels-and-orthography");
    const batch1Lessons2 = await fetchModuleLessons(request, "core-vocabulary-1");
    expect(batch1Lessons1.length + batch1Lessons2.length).toBe(5);
  });

  test("word_frequency ranks 11-20 exist and lesson_vocabulary_words links exactly those 10 rows", async ({
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "core-vocabulary-2");
    const { client } = await createTestUserClient();
    const { data: links } = await client
      .from("lesson_vocabulary_words")
      .select("word_id, lesson_id, word_frequency(frequency_rank)")
      .in(
        "lesson_id",
        lessons.map((l) => l.id),
      );
    expect(links).toHaveLength(10);
    const ranks = (links ?? [])
      .map(
        (l) =>
          (l as unknown as { word_frequency: { frequency_rank: number } }).word_frequency
            .frequency_rank,
      )
      .sort((a, b) => a - b);
    expect(ranks).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  for (const slug of ["vocabulary-3", "vocabulary-4"]) {
    test(`lesson "${slug}" opens and its sections render in order`, async ({ page, request }) => {
      const lessons = await fetchModuleLessons(request, "core-vocabulary-2");
      const lesson = lessons.find((l) => l.slug === slug)!;
      await page.goto(`/lesson/${lesson.id}`);
      await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
    });
  }

  test("full lifecycle on vocabulary-3 (ranks 11-15): reading_check/matching, completion, and exactly FIVE new word review items", async ({
    page,
    request,
  }) => {
    // completeLessonResilient below is wall-clock-bounded up to 60s (see
    // utils/lesson-interaction.ts) and a single call can legitimately
    // overrun that by up to ~20s more if the last answer/check attempt is
    // in flight when the budget elapses -- the previous 60s left no
    // headroom for that overrun or for setup/assertion time, the exact
    // class of run #49 follow-up failure seen in
    // 26-level1-module4-sukun-shadda.spec.ts.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "core-vocabulary-2");
    const lesson = lessons.find((l) => l.slug === "vocabulary-3")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    for (const w of ["قُلْ", "هُوَ", "أَحَد", "مَلِك", "إِلَٰه"]) {
      await client.from("review_items").delete().eq("user_id", userId).eq("item_key", `word:${w}`);
    }

    const exercises = await fetchOrderedExercises(client, lesson.id);
    expect(exercises.filter((e) => e.exercise_type === "reading_check")).toHaveLength(5);
    expect(exercises.filter((e) => e.exercise_type === "matching")).toHaveLength(1);

    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${lesson.id}`);
    await completeLesson(page, exercises);

    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", lesson.id)
      .single();
    expect(progress?.status).toBe("completed");

    const { count: after } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(after).toBe((before ?? 0) + 5);
  });

  test("full lifecycle on vocabulary-4 (ranks 16-20) and its Qur'an example (113:2) resolves by FK with the real governed translation", async ({
    page,
    request,
  }) => {
    // Calls both advanceUntilVisible and completeLesson, each now
    // wall-clock-bounded (see utils/lesson-interaction.ts) instead of a
    // fixed iteration count -- headroom beyond the 30s default lets that
    // bound actually do its job.
    test.setTimeout(120_000);
    const lessons = await fetchModuleLessons(request, "core-vocabulary-2");
    const lesson = lessons.find((l) => l.slug === "vocabulary-4")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    for (const rank of [16, 17, 18, 19, 20]) {
      const w = await fetchWord(request, rank);
      await client.from("review_items").delete().eq("user_id", userId).eq("item_key", `word:${w}`);
    }

    const exercises = await fetchOrderedExercises(client, lesson.id);
    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    const ayah113_2 = await fetchAyah(request, 113, 2);

    await page.goto(`/lesson/${lesson.id}`);
    await advanceUntilVisible(page, exercises, ayah113_2.arabic_text);
    await expect(page.getByText(ayah113_2.arabic_text, { exact: true })).toBeVisible();
    await expect(page.getByText(/From the evil of that which He created/)).toBeVisible();

    // Reset progress and re-navigate, rather than a continuation of the walk
    // above: completeLesson always starts its own exerciseIndex at 0, which
    // must stay in lockstep with the player's own step position — and the
    // player resumes from the persisted last_section_index
    // (lesson.$lessonId.tsx), so a plain reload alone would resume mid-walk
    // and desync the two once a non-reading_check step (matching) is
    // reached.
    await resetLessonProgress(lesson.id);
    await page.goto(`/lesson/${lesson.id}`);
    await completeLesson(page, exercises);
    const { count: after } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(after).toBe((before ?? 0) + 5);
  });

  test("French interface: vocabulary-3 lesson and word terminology render correctly", async ({
    page,
    request,
  }) => {
    // waitForHeadingResilient below is wall-clock-bounded (default 30s,
    // see utils/lesson-interaction.ts) rather than relying on Playwright's
    // built-in 5s assertion timeout -- same French-heading hydration race
    // already proven and fixed in
    // 29-level1-module7-first-reading-practice.spec.ts.
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "core-vocabulary-2");
    const lesson = lessons.find((l) => l.slug === "vocabulary-3")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await waitForHeadingResilient(page, "Vocabulaire de base : partie 3");
      await page.getByRole("button", { name: "Suivant" }).click();
      await expect(page.getByText(/Dis/)).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("accessibility: reading_check controls are keyboard-operable with distinct accessible names", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "core-vocabulary-2");
    const lesson = lessons.find((l) => l.slug === "vocabulary-3")!;
    await resetLessonProgress(lesson.id);
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation, to word 1's section
    await page.getByRole("button", { name: "Next" }).click(); // to word 1's attached reading_check

    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(3);
    await radios.first().focus();
    await page.keyboard.press("Space");
    await expect(radios.first()).toBeChecked();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });
});

test.describe("Level 2 Batch 2 — Module 4: Short Phrases", () => {
  test("module and lessons exist, in the correct order, under Level 2", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index,levels(slug)&slug=eq.short-phrases",
    )) as {
      slug: string;
      title_en: string;
      title_fr: string;
      order_index: number;
      levels: { slug: string };
    }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Reading Short Phrases");
    expect(modules[0]!.levels.slug).toBe("basic-vocabulary-and-patterns");
    expect(modules[0]!.order_index).toBe(3);

    const lessons = await fetchModuleLessons(request, "short-phrases");
    expect(lessons.map((l) => l.slug)).toEqual([
      "phrases-of-sovereignty",
      "reading-al-ikhlas-opening",
    ]);
  });

  test("phrases-of-sovereignty uses only vocabulary already taught, resolves both Qur'an examples (114:2, 114:3) by FK, and renders RTL without clipping on mobile", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "short-phrases");
    const lesson = lessons.find((l) => l.slug === "phrases-of-sovereignty")!;
    const ayah114_2 = await fetchAyah(request, 114, 2);
    const ayah114_3 = await fetchAyah(request, 114, 3);
    await resetLessonProgress(lesson.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation

    const phrase1 = page.getByText(ayah114_2.arabic_text, { exact: true });
    await expect(phrase1).toBeVisible();
    await expect(phrase1).toHaveAttribute("dir", "rtl");
    await expect(phrase1).toHaveAttribute("lang", "ar");
    const box = await phrase1.boundingBox();
    expect(box!.width).toBeGreaterThan(0);
    await expect(page.getByText(/The Sovereign of mankind/)).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    // Section 1's attached reading_check must be answered before advancing.
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "maliki n-nas", exact: true }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText(ayah114_3.arabic_text, { exact: true })).toBeVisible();
    await expect(page.getByText(/The God of mankind/)).toBeVisible();
  });

  test("full lifecycle on phrases-of-sovereignty: completion creates ZERO new review items (no matching exercise — pure-synthesis by design)", async ({
    page,
    request,
  }) => {
    // Same headroom reasoning as vocabulary-3's full-lifecycle test above.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "short-phrases");
    const lesson = lessons.find((l) => l.slug === "phrases-of-sovereignty")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);

    const exercises = await fetchOrderedExercises(client, lesson.id);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "reading_check",
      "reading_check",
      "true_false",
      "multiple_choice",
    ]);

    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${lesson.id}`);
    await completeLesson(page, exercises);

    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", lesson.id)
      .single();
    expect(progress?.status).toBe("completed");

    const { count: after } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(after).toBe(before ?? 0);
  });

  test("full lifecycle on reading-al-ikhlas-opening (reuses ayah 112:1, already-known vocabulary only): completion creates ZERO new review items", async ({
    page,
    request,
  }) => {
    // Same reasoning as the vocabulary-4 test above: two wall-clock-bounded
    // calls (advanceUntilVisible + completeLesson) need headroom beyond
    // the 30s default.
    test.setTimeout(120_000);
    const lessons = await fetchModuleLessons(request, "short-phrases");
    const lesson = lessons.find((l) => l.slug === "reading-al-ikhlas-opening")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);

    const exercises = await fetchOrderedExercises(client, lesson.id);
    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    const ayah112_1 = await fetchAyah(request, 112, 1);

    await page.goto(`/lesson/${lesson.id}`);
    await advanceUntilVisible(page, exercises, ayah112_1.arabic_text);
    await expect(page.getByText(ayah112_1.arabic_text, { exact: true })).toBeVisible();
    await expect(page.getByText(/He is Allah/)).toBeVisible();

    // Reset progress and re-navigate before completing — see the identical
    // comment in the vocabulary-4 test above for why a plain reload alone
    // would resume mid-walk and desync completeLesson's exerciseIndex from
    // the player's actual step.
    await resetLessonProgress(lesson.id);
    await page.goto(`/lesson/${lesson.id}`);
    await completeLesson(page, exercises);
    const { count: after } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(after).toBe(before ?? 0);
  });

  test("French interface: phrases-of-sovereignty lesson renders correctly", async ({
    page,
    request,
  }) => {
    // waitForHeadingResilient below is wall-clock-bounded (default 30s,
    // see utils/lesson-interaction.ts) rather than relying on Playwright's
    // built-in 5s assertion timeout -- same French-heading hydration race
    // already proven and fixed in
    // 29-level1-module7-first-reading-practice.spec.ts.
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "short-phrases");
    const lesson = lessons.find((l) => l.slug === "phrases-of-sovereignty")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await waitForHeadingResilient(page, "Phrases de souveraineté");
      await page.getByRole("button", { name: "Suivant" }).click();
      // 114:2 (An-Nas) is part of the fr.hamidullah-crf disputed-source
      // remediation -- translation_fr is nulled, so the lesson's embedded
      // Qur'an example now shows the same explicit unavailable fallback
      // as the Reader, never the old disputed text.
      await expect(
        page.getByText("Traduction française pas encore disponible pour ce verset."),
      ).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});

test.describe("Level 2 Batch 1 -> Batch 2 progression resolver", () => {
  test("the 'vocabulary' learning-path step walks core-vocabulary-1 -> core-vocabulary-2 -> short-phrases as each module completes, then moves on into vocabulary-capstone", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);

    const bridgeLessons = await fetchModuleLessons(request, "long-vowels-and-orthography");
    const vocab1Lessons = await fetchModuleLessons(request, "core-vocabulary-1");
    const vocab2Lessons = await fetchModuleLessons(request, "core-vocabulary-2");
    const phraseLessons = await fetchModuleLessons(request, "short-phrases");
    const allLevel2Lessons = [
      ...bridgeLessons,
      ...vocab1Lessons,
      ...vocab2Lessons,
      ...phraseLessons,
    ];

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        allLevel2Lessons.map((l) => l.id),
      );

    // The "vocabulary" step only resyncs once Level 1 (foundations-of-
    // arabic-script) shows completedCount === totalCount for this user
    // (fetchStepEntryPoints' requiresLevelSlug gate — the exact
    // architectural fix this whole describe block exercises). Explicitly
    // ensuring that precondition here, rather than relying on this account
    // having already completed Level 1 via earlier specs in the same run
    // (the assumption 32-level2-batch1-...spec.ts's equivalent test makes),
    // keeps this test correct when run in isolation too.
    const level1Mods = (await apiGet(
      request,
      "modules?select=id,levels!inner(slug)&levels.slug=eq.foundations-of-arabic-script",
    )) as { id: string }[];
    const level1Lessons: { id: string }[] = [];
    for (const m of level1Mods) {
      const lessons = (await apiGet(request, `lessons?select=id&module_id=eq.${m.id}`)) as {
        id: string;
      }[];
      level1Lessons.push(...lessons);
    }
    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        level1Lessons.map((l) => l.id),
      );
    await client.from("user_lesson_progress").insert(
      level1Lessons.map((l) => ({
        user_id: userId,
        lesson_id: l.id,
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        last_section_index: 1,
        progress_percent: 100,
      })),
    );

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
      PATH_STEPS.map((step, index) => ({
        path_id: newPath!.id,
        user_id: userId,
        step_key: step,
        order_index: index,
        status: index === 0 ? "in_progress" : index === 1 ? "available" : "locked",
        progress: 0,
        lesson_id: null,
      })),
    );

    const vocabRow = page.locator("li", { hasText: "Qur'anic vocabulary" });
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

    // Complete Batch 1 (bridge + core-vocabulary-1) only -> must resolve
    // into core-vocabulary-2, never report done after just Batch 1.
    await markCompleted([...bridgeLessons, ...vocab1Lessons]);
    await page.goto("/learning-plan");
    await expect(vocabRow.getByText("In progress")).toBeVisible();
    const hrefAfterBatch1 = await vocabRow.getByRole("link").getAttribute("href");
    const vocab2LessonIds = new Set(vocab2Lessons.map((l) => l.id));
    expect(vocab2LessonIds.has(hrefAfterBatch1?.split("/lesson/")[1] ?? "")).toBe(true);

    // Complete core-vocabulary-2 too -> must resolve into short-phrases,
    // never report done before the final Batch 2 module.
    await markCompleted(vocab2Lessons);
    await page.reload();
    await expect(vocabRow.getByText("In progress")).toBeVisible();
    const hrefAfterVocab2 = await vocabRow.getByRole("link").getAttribute("href");
    const phraseLessonIds = new Set(phraseLessons.map((l) => l.id));
    expect(phraseLessonIds.has(hrefAfterVocab2?.split("/lesson/")[1] ?? "")).toBe(true);

    // Complete short-phrases too -> the resolved link must move into
    // Batch 3's vocabulary-capstone (Level 2 Batch 3 added a fifth module
    // under the same level_id after this spec was first written), never
    // report the whole "vocabulary" step done after just these four
    // modules. Full walk-to-Completed coverage across all five Level 2
    // modules lives in 35-level2-release-journey.spec.ts, so it is
    // intentionally not duplicated here.
    await markCompleted(phraseLessons);
    await page.reload();
    await expect(vocabRow.getByText("In progress")).toBeVisible();
    const hrefAfterBatch2 = await vocabRow.getByRole("link").getAttribute("href");
    const capstoneLessons = await fetchModuleLessons(request, "vocabulary-capstone");
    const capstoneLessonIds = new Set(capstoneLessons.map((l) => l.id));
    expect(capstoneLessonIds.has(hrefAfterBatch2?.split("/lesson/")[1] ?? "")).toBe(true);
  });
});

/** Mirrors localDate() in src/lib/study.ts — the app queries due items by
 * the learner's *local* calendar day, not UTC, so a row seeded with the UTC
 * date can land a day off and silently fall outside the "due today" query.
 * See the identical comment in 04-daily-study.spec.ts / 13-practice.spec.ts. */
function localDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

test.describe("Level 2 Batch 2 — vocabulary/review integration with Practice and Daily Study", () => {
  test("a word review item seeded from a Batch 2 lesson is due-able and consumable in a real Practice session", async ({
    page,
    request,
  }) => {
    test.setTimeout(30_000);
    const { client, userId } = await createTestUserClient();
    const word = await fetchWord(request, 11); // Qul
    const itemKey = `word:${word}`;
    // A clean queue, not just this one item_key: this spec file's own
    // lesson-completion tests above seed real word review items due today
    // too (via seedLessonReviewItems) — without this, the Practice session
    // would need to walk all of them, not just the one this test cares
    // about (13-practice.spec.ts establishes the same full-cleanup pattern
    // for the same reason).
    await client.from("review_items").delete().eq("user_id", userId);
    const today = localDate();
    await client.from("review_items").insert({
      user_id: userId,
      item_type: "word",
      item_key: itemKey,
      front: word,
      back: "Qul — Say",
      due_date: today,
    });

    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
    await page.getByRole("button", { name: "Start Review Session" }).click();
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
      await page.waitForTimeout(300);
    }
    await expect(page.getByText("Session complete")).toBeVisible({ timeout: 15_000 });

    const { data: after } = await client
      .from("review_items")
      .select("due_date, repetitions")
      .eq("user_id", userId)
      .eq("item_key", itemKey)
      .single();
    expect(after?.due_date).not.toBe(today);
  });

  test("a due Batch 2 word review item surfaces on the Daily Study page", async ({
    page,
    request,
  }) => {
    const { client, userId } = await createTestUserClient();
    const word = await fetchWord(request, 14); // Malik
    const itemKey = `word:${word}`;
    // Full cleanup, same reasoning as the Practice test above.
    await client.from("review_items").delete().eq("user_id", userId);
    const today = localDate();
    await client.from("review_items").insert({
      user_id: userId,
      item_type: "word",
      item_key: itemKey,
      front: word,
      back: "Malik — Sovereign, King",
      due_date: today,
    });

    await page.goto("/daily");
    await expect(page.getByText(/Item 1 of \d+/)).toBeVisible();
    await expect(
      page.getByText(word, { exact: true }).or(page.getByText("Malik — Sovereign, King")),
    ).toBeVisible();

    await client.from("review_items").delete().eq("user_id", userId).eq("item_key", itemKey);
  });
});

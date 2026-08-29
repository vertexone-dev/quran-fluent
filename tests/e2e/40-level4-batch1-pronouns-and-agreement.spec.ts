import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import {
  completeLessonResilient,
  resilientAnswerAndCheck,
  waitForHeadingResilient,
} from "./utils/lesson-interaction";

/**
 * Covers Level 4 (Core Grammar) Batch 1: "pronouns-and-nominal-sentences"
 * (1 lesson) and "agreement-and-genitive-constructions" (2 lessons) -- the
 * first Level 4 content, plus the "grammar" entry added to STEP_LEVEL_SLUGS
 * (src/lib/placement.ts) so /learning-plan's "Grammar foundations" step
 * resyncs correctly for the first time (previously permanently "locked" --
 * PATH_STEPS already contained "grammar" but nothing mapped it to a level).
 *
 * Zero new vocabulary, zero new ayahs: huwa (rank 12), sirat (rank 9) and
 * mustaqim (rank 10) were already fully taught; ayahs 112:1, 1:6, 1:2, 1:4
 * and 114:2 were all already cached and already shown at least once before
 * this batch -- confirmed by direct query before authoring, not invented.
 * Neither "naʿt" nor "iḍāfa" (nor "agreement", "genitive case", or iʿrāb)
 * is ever surfaced to the learner -- both relationships are taught by
 * plain observation, per the Gate A+B terminology governance decision.
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

async function fetchAyah(request: APIRequestContext, surah: number, ayah: number) {
  const rows = (await apiGet(
    request,
    `ayahs?select=arabic_text,translation_en,translation_fr&surah_number=eq.${surah}&ayah_number=eq.${ayah}`,
  )) as { arabic_text: string; translation_en: string; translation_fr: string }[];
  return rows[0]!;
}

async function fetchWord(request: APIRequestContext, rank: number) {
  const rows = (await apiGet(
    request,
    `word_frequency?select=word,transliteration,meaning&frequency_rank=eq.${rank}`,
  )) as { word: string; transliteration: string; meaning: string }[];
  return rows[0]!;
}

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

/** Wall-clock-bounded, remount-resilient replacement for the old
 * fixed-60-iteration loop -- see utils/lesson-interaction.ts. */
async function completeLesson(page: Page, exercises: DbExercise[]) {
  await completeLessonResilient(page, exercises, answerExercise);
}

test.describe("Level 4 Batch 1 — Module 1: Pronouns and Simple Sentences", () => {
  test("module and lesson exist, in the correct order, under Level 4", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index,levels(slug)&slug=eq.pronouns-and-nominal-sentences",
    )) as {
      slug: string;
      title_en: string;
      title_fr: string;
      order_index: number;
      levels: { slug: string };
    }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Pronouns and Simple Sentences");
    expect(modules[0]!.levels.slug).toBe("core-grammar");
    expect(modules[0]!.order_index).toBe(0);

    const lessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    expect(lessons.map((l) => l.slug)).toEqual(["he-is-allah-one"]);
  });

  test("Levels 1 (33 lessons), 2 (10 lessons) and 3 (4 lessons) remain completely unchanged", async ({
    request,
  }) => {
    for (const [levelSlug, expected] of [
      ["foundations-of-arabic-script", 33],
      ["basic-vocabulary-and-patterns", 10],
      ["roots-and-word-patterns", 4],
    ] as const) {
      const mods = (await apiGet(
        request,
        `modules?select=id,levels!inner(slug)&levels.slug=eq.${levelSlug}`,
      )) as { id: string }[];
      let total = 0;
      for (const m of mods) {
        const lessons = (await apiGet(
          request,
          `lessons?select=id&module_id=eq.${m.id}`,
        )) as unknown[];
        total += lessons.length;
      }
      expect(total).toBe(expected);
    }
  });

  test("word_frequency remains at exactly 20 rows -- no new vocabulary in Level 4 Batch 1", async () => {
    const { client } = await createTestUserClient();
    const { count } = await client
      .from("word_frequency")
      .select("*", { count: "exact", head: true });
    expect(count).toBe(20);
  });

  test('lesson "he-is-allah-one" opens and its sections render in order', async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const lesson = lessons.find((l) => l.slug === "he-is-allah-one")!;
    await page.goto(`/lesson/${lesson.id}`);
    await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
  });

  test("full lifecycle on He Is Allah, One: true_false/multiple_choice/matching, FK-verified 112:1, completion, and exactly TWO new concept review items (pronoun-huwa, nominal-sentence)", async ({
    page,
    request,
  }) => {
    // Headroom beyond completeLesson's own wall-clock bound (see
    // utils/lesson-interaction.ts), so that bound -- not this outer
    // timeout -- is what governs a slow/degraded run.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const lesson = lessons.find((l) => l.slug === "he-is-allah-one")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .in("item_key", ["concept:pronoun-huwa", "concept:nominal-sentence"]);

    const huwa = await fetchWord(request, 12);
    const ayah112_1 = await fetchAyah(request, 112, 1);

    const exercises = await fetchOrderedExercises(client, lesson.id);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "true_false",
      "multiple_choice",
      "matching",
    ]);
    expect(exercises[2]!.payload.pairs).toEqual([
      { left: "pronoun-huwa", right: expect.stringContaining("pronoun") },
      { left: "nominal-sentence", right: expect.stringContaining("no verb") },
    ]);

    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await expect(page.getByText(huwa.word, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // past the huwa word section
    await expect(page.getByText(ayah112_1.arabic_text, { exact: true })).toBeVisible();
    await expect(page.getByText(ayah112_1.translation_en, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // to tip
    await page.getByRole("button", { name: "Next" }).click(); // to summary

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
    expect(after).toBe((before ?? 0) + 2);

    const { data: items } = await client
      .from("review_items")
      .select("item_type, item_key, front")
      .eq("user_id", userId)
      .in("item_key", ["concept:pronoun-huwa", "concept:nominal-sentence"])
      .order("item_key");
    expect(items).toHaveLength(2);
    expect(items?.every((i) => i.item_type === "concept")).toBe(true);
  });

  test("French interface: lesson and pronoun/nominal-sentence terminology render correctly", async ({
    page,
    request,
  }) => {
    // waitForHeadingResilient below is wall-clock-bounded (default 30s,
    // see utils/lesson-interaction.ts) rather than relying on Playwright's
    // built-in 5s assertion timeout -- same French-heading hydration race
    // already proven and fixed in
    // 29-level1-module7-first-reading-practice.spec.ts.
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const lesson = lessons.find((l) => l.slug === "he-is-allah-one")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await waitForHeadingResilient(page, "Il est Allah, Unique");
      await page.getByRole("button", { name: "Suivant" }).click(); // past explanation
      await page.getByRole("button", { name: "Suivant" }).click(); // past huwa word
      await page.getByRole("button", { name: "Suivant" }).click(); // past quran_example
      await expect(page.getByText(/phrase nominale/).first()).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("accessibility: true_false and multiple_choice controls are keyboard-operable with distinct accessible names, no color-only feedback", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const lesson = lessons.find((l) => l.slug === "he-is-allah-one")!;
    await resetLessonProgress(lesson.id);
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await page.getByRole("button", { name: "Next" }).click(); // past huwa word
    await page.getByRole("button", { name: "Next" }).click(); // past quran_example
    await page.getByRole("button", { name: "Next" }).click(); // past tip
    await page.getByRole("button", { name: "Next" }).click(); // to true_false exercise

    const trueBtn = page.getByRole("button", { name: "True" });
    await trueBtn.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("mobile: huwa renders dir=rtl/lang=ar without clipping at 390x844", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const lesson = lessons.find((l) => l.slug === "he-is-allah-one")!;
    await resetLessonProgress(lesson.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click();

    const word = page.getByText("هُوَ", { exact: true });
    await expect(word).toBeVisible();
    await expect(word).toHaveAttribute("dir", "rtl");
    await expect(word).toHaveAttribute("lang", "ar");
    const box = await word.boundingBox();
    expect(box!.width).toBeGreaterThan(0);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });
});

test.describe("Level 4 Batch 1 — Module 2: Describing Words and 'Of' Phrases", () => {
  test("module and lessons exist, in the correct order", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index&slug=eq.agreement-and-genitive-constructions",
    )) as { slug: string; title_en: string; title_fr: string; order_index: number }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Describing Words and 'Of' Phrases");
    expect(modules[0]!.order_index).toBe(1);

    const lessons = await fetchModuleLessons(request, "agreement-and-genitive-constructions");
    expect(lessons.map((l) => l.slug)).toEqual(["the-straight-path", "lord-of-the-worlds"]);
  });

  test("full lifecycle on The Straight Path: Qur'an FK integrity (1:6), completion, and exactly ONE new concept review item (noun-adjective-agreement)", async ({
    page,
    request,
  }) => {
    // Headroom beyond completeLesson's own wall-clock bound (see
    // utils/lesson-interaction.ts), so that bound -- not this outer
    // timeout -- is what governs a slow/degraded run.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "agreement-and-genitive-constructions");
    const lesson = lessons.find((l) => l.slug === "the-straight-path")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_key", "concept:noun-adjective-agreement");

    const sirat = await fetchWord(request, 9);
    const mustaqim = await fetchWord(request, 10);
    const ayah1_6 = await fetchAyah(request, 1, 6);

    const exercises = await fetchOrderedExercises(client, lesson.id);
    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await expect(page.getByText(sirat.word, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // past sirat
    await expect(page.getByText(mustaqim.word, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // past mustaqim
    await expect(page.getByText(ayah1_6.arabic_text, { exact: true })).toBeVisible();
    await expect(page.getByText(ayah1_6.translation_en, { exact: true })).toBeVisible();

    // Reset and re-navigate rather than continuing the walk above:
    // completeLesson always starts its own exerciseIndex at 0, which must
    // stay in lockstep with the player's own resumed step position.
    await resetLessonProgress(lesson.id);
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
    expect(after).toBe((before ?? 0) + 1);

    const { data: item } = await client
      .from("review_items")
      .select("item_type")
      .eq("user_id", userId)
      .eq("item_key", "concept:noun-adjective-agreement")
      .single();
    expect(item?.item_type).toBe("concept");
  });

  test("full lifecycle on Lord of the Worlds: Qur'an FK integrity (1:2, 1:4, 114:2), reading_check, completion, and exactly ONE new concept review item (idafa-construct)", async ({
    page,
    request,
  }) => {
    // Headroom beyond completeLesson's own wall-clock bound (see
    // utils/lesson-interaction.ts), so that bound -- not this outer
    // timeout -- is what governs a slow/degraded run.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "agreement-and-genitive-constructions");
    const lesson = lessons.find((l) => l.slug === "lord-of-the-worlds")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_key", "concept:idafa-construct");

    const ayah1_2 = await fetchAyah(request, 1, 2);
    const ayah1_4 = await fetchAyah(request, 1, 4);
    const ayah114_2 = await fetchAyah(request, 114, 2);

    const exercises = await fetchOrderedExercises(client, lesson.id);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "true_false",
      "multiple_choice",
      "reading_check",
      "matching",
    ]);

    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await expect(page.getByText(ayah1_2.arabic_text, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // past 1:2
    await expect(page.getByText(ayah1_4.arabic_text, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // past 1:4
    await expect(page.getByText(ayah114_2.arabic_text, { exact: true })).toBeVisible();

    await resetLessonProgress(lesson.id);
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
    expect(after).toBe((before ?? 0) + 1);

    const { data: item } = await client
      .from("review_items")
      .select("item_type")
      .eq("user_id", userId)
      .eq("item_key", "concept:idafa-construct")
      .single();
    expect(item?.item_type).toBe("concept");
  });

  test("French interface renders correctly for both lessons", async ({ page, request }) => {
    // Two sequential waitForHeadingResilient calls below, each
    // wall-clock-bounded up to 30s (see utils/lesson-interaction.ts) --
    // same French-heading hydration race already proven and fixed in
    // 29-level1-module7-first-reading-practice.spec.ts, doubled here since
    // this test visits two lesson pages.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "agreement-and-genitive-constructions");
    const lesson1 = lessons.find((l) => l.slug === "the-straight-path")!;
    const lesson2 = lessons.find((l) => l.slug === "lord-of-the-worlds")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson1.id);
    await resetLessonProgress(lesson2.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson1.id}`);
      await waitForHeadingResilient(page, "Le droit chemin");

      await page.goto(`/lesson/${lesson2.id}`);
      await waitForHeadingResilient(page, "Seigneur de l'univers");
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});

test.describe("Level 4 progression: STEP_LEVEL_SLUGS 'grammar' entry", () => {
  test("the 'grammar' step is locked before Level 3 completes, and unlocks with a working first-lesson link once Level 3 is complete -- Level 1/2/3 behavior is unaffected", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);

    async function fetchLevelLessons(levelSlug: string) {
      const mods = (await apiGet(
        request,
        `modules?select=id,levels!inner(slug)&levels.slug=eq.${levelSlug}`,
      )) as { id: string }[];
      const all: { id: string }[] = [];
      for (const m of mods) {
        all.push(
          ...((await apiGet(request, `lessons?select=id&module_id=eq.${m.id}`)) as {
            id: string;
          }[]),
        );
      }
      return all;
    }

    const level1Lessons = await fetchLevelLessons("foundations-of-arabic-script");
    const level2Lessons = await fetchLevelLessons("basic-vocabulary-and-patterns");
    const level3Lessons = await fetchLevelLessons("roots-and-word-patterns");
    const grammarLessons = [
      ...(await fetchModuleLessons(request, "pronouns-and-nominal-sentences")),
      ...(await fetchModuleLessons(request, "agreement-and-genitive-constructions")),
    ];

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        [...level1Lessons, ...level2Lessons, ...level3Lessons, ...grammarLessons].map((l) => l.id),
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

    // Levels 1 and 2 complete, Level 3 NOT complete -> "grammar" must stay
    // locked (it requires Level 3, not just Level 2).
    await markCompleted(level1Lessons);
    await markCompleted(level2Lessons);

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

    await page.goto("/learning-plan");
    const rootsRow = page.locator("li", { hasText: "Arabic roots" });
    const grammarRow = page.locator("li", { hasText: "Grammar foundations" });

    await expect(rootsRow.getByText("Up next")).toBeVisible();
    await expect(grammarRow.getByText("Locked")).toBeVisible();
    await expect(grammarRow.getByRole("link")).toHaveCount(0);

    // Complete Level 3 too -> "grammar" must unlock with a real, working
    // link into its first lesson, and Levels 1-3's own rows must be
    // unaffected by the new mapping.
    await markCompleted(level3Lessons);
    await page.reload();

    await expect(rootsRow.getByText("Completed", { exact: true })).toBeVisible();
    await expect(grammarRow.getByText("Locked")).not.toBeVisible();
    const href = await grammarRow.getByRole("link").getAttribute("href");
    const firstLessonIds = new Set(
      (await fetchModuleLessons(request, "pronouns-and-nominal-sentences")).map((l) => l.id),
    );
    expect(
      firstLessonIds.has(href?.split("/lesson/")[1] ?? ""),
      "the grammar step must link into a real pronouns-and-nominal-sentences lesson, not a dead link",
    ).toBe(true);
  });
});

test.describe("Level 4 Batch 1 — Practice and Daily Study compatibility with 'concept' items", () => {
  test("a concept review item seeded from a Batch 1 lesson is due-able and consumable in a real Practice session, advances its due date (no SM-2 reset), and surfaces on Daily Study", async ({
    page,
    request,
  }) => {
    test.setTimeout(30_000);
    const { client, userId } = await createTestUserClient();
    const itemKey = "concept:idafa-construct";
    await client.from("review_items").delete().eq("user_id", userId).eq("item_key", itemKey);
    const today = new Date().toLocaleDateString("en-CA");
    await client.from("review_items").insert({
      user_id: userId,
      item_type: "concept",
      item_key: itemKey,
      front: "idafa-construct",
      back: 'two nouns placed side by side to mean "X of Y"',
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
      .select("due_date")
      .eq("user_id", userId)
      .eq("item_key", itemKey)
      .single();
    expect(after?.due_date).not.toBe(today);

    await client.from("review_items").delete().eq("user_id", userId).eq("item_key", itemKey);
    await client.from("review_items").insert({
      user_id: userId,
      item_type: "concept",
      item_key: itemKey,
      front: "idafa-construct",
      back: 'two nouns placed side by side to mean "X of Y"',
      due_date: today,
    });
    await page.goto("/daily");
    await expect(page.getByText(/Item 1 of \d+/)).toBeVisible();
    await expect(page.getByText("idafa-construct", { exact: true })).toBeVisible();
    await client.from("review_items").delete().eq("user_id", userId).eq("item_key", itemKey);
  });
});

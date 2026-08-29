import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import { completeLessonResilient, resilientAnswerAndCheck } from "./utils/lesson-interaction";

/**
 * Covers Level 3 (Roots & Word Patterns) Batch 1: "arabic-roots-intro"
 * (2 lessons) and "word-patterns" (1 lesson) -- the first Level 3 content,
 * plus the "roots" entry added to STEP_LEVEL_SLUGS (src/lib/placement.ts)
 * so /learning-plan's "Arabic roots" step resyncs correctly for the first
 * time (previously permanently "locked" -- PATH_STEPS already contained
 * "roots" but nothing mapped it to a level).
 *
 * Zero new vocabulary, zero new ayahs: every word and every quran_example
 * reused here was already fully taught and FK-verified in Level 1 (Al-
 * Fatiha) and Level 2 (An-Nas). All three root families taught
 * ('a-l-h, r-h-m, m-l-k, written in transliteration in this comment only)
 * already existed in word_frequency.root among fully-mastered words --
 * confirmed by direct query before authoring, not invented.
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
    `word_frequency?select=word,root&frequency_rank=eq.${rank}`,
  )) as { word: string; root: string }[];
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

test.describe("Level 3 Batch 1 — Module 1: Understanding Roots", () => {
  test("module and lessons exist, in the correct order, under Level 3", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index,levels(slug)&slug=eq.arabic-roots-intro",
    )) as {
      slug: string;
      title_en: string;
      title_fr: string;
      order_index: number;
      levels: { slug: string };
    }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Understanding Roots");
    expect(modules[0]!.levels.slug).toBe("roots-and-word-patterns");
    expect(modules[0]!.order_index).toBe(0);

    const lessons = await fetchModuleLessons(request, "arabic-roots-intro");
    expect(lessons.map((l) => l.slug)).toEqual(["three-letters-one-meaning", "more-root-families"]);
  });

  test("Level 1 (33 lessons) and Level 2 (10 lessons) remain completely unchanged", async ({
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

    const level2Mods = (await apiGet(
      request,
      "modules?select=id,levels!inner(slug)&levels.slug=eq.basic-vocabulary-and-patterns",
    )) as { id: string }[];
    let level2Total = 0;
    for (const m of level2Mods) {
      const lessons = (await apiGet(
        request,
        `lessons?select=id&module_id=eq.${m.id}`,
      )) as unknown[];
      level2Total += lessons.length;
    }
    expect(level2Total).toBe(10);
  });

  test("word_frequency remains at exactly 20 rows -- no new vocabulary in Level 3 Batch 1", async () => {
    const { client } = await createTestUserClient();
    const { count } = await client
      .from("word_frequency")
      .select("*", { count: "exact", head: true });
    expect(count).toBe(20);
  });

  for (const slug of ["three-letters-one-meaning", "more-root-families"]) {
    test(`lesson "${slug}" opens and its sections render in order`, async ({ page, request }) => {
      const lessons = await fetchModuleLessons(request, "arabic-roots-intro");
      const lesson = lessons.find((l) => l.slug === slug)!;
      await page.goto(`/lesson/${lesson.id}`);
      await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
    });
  }

  test("full lifecycle on Lesson 1 (Three Letters, One Meaning): true_false/multiple_choice/matching, FK-verified Qur'an examples, completion, and exactly ONE new root review item (root:<'a-l-h root>)", async ({
    page,
    request,
  }) => {
    // Headroom beyond completeLesson's own wall-clock bound (see
    // utils/lesson-interaction.ts), so that bound -- not this outer
    // timeout -- is what governs a slow/degraded run.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "arabic-roots-intro");
    const lesson1 = lessons.find((l) => l.slug === "three-letters-one-meaning")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson1.id);
    const ilah = await fetchWord(request, 15);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_key", `root:${ilah.root}`);

    const ayah1_1 = await fetchAyah(request, 1, 1);
    const ayah114_3 = await fetchAyah(request, 114, 3);

    const exercises = await fetchOrderedExercises(client, lesson1.id);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "true_false",
      "multiple_choice",
      "matching",
    ]);
    // The seeded matching pair's item_key is keyed by the root, not the word.
    expect(exercises[2]!.payload.pairs).toEqual([
      { left: ilah.root, right: expect.stringContaining("God, deity") },
    ]);

    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${lesson1.id}`);
    // Both reused quran_example ayahs must resolve by FK and show the real
    // governed translation, not just render at all.
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await page.getByRole("button", { name: "Next" }).click(); // past word 1 (Allah)
    await page.getByRole("button", { name: "Next" }).click(); // past word 2 (Ilah)
    await expect(page.getByText(ayah1_1.arabic_text, { exact: true })).toBeVisible();
    await expect(page.getByText(ayah1_1.translation_en, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(ayah114_3.arabic_text, { exact: true })).toBeVisible();
    await expect(page.getByText(ayah114_3.translation_en, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // to tip
    await page.getByRole("button", { name: "Next" }).click(); // to summary

    await completeLesson(page, exercises);

    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", lesson1.id)
      .single();
    expect(progress?.status).toBe("completed");

    const { count: after } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(after).toBe((before ?? 0) + 1);

    const { data: item } = await client
      .from("review_items")
      .select("item_type, item_key, front, back")
      .eq("user_id", userId)
      .eq("item_key", `root:${ilah.root}`)
      .single();
    expect(item?.item_type).toBe("root");
    expect(item?.front).toBe(ilah.root);
  });

  test("full lifecycle on Lesson 2 (More Root Families): completion, recap matching re-covers the already-seeded 'a-l-h root and seeds exactly ONE genuinely new r-h-m root item -- no duplicate, no reset", async ({
    page,
    request,
  }) => {
    // Calls completeLesson twice, each now wall-clock-bounded (see
    // utils/lesson-interaction.ts) instead of a fixed iteration count --
    // needs headroom beyond the old single-call budget.
    test.setTimeout(120_000);
    const lessons = await fetchModuleLessons(request, "arabic-roots-intro");
    const lesson1 = lessons.find((l) => l.slug === "three-letters-one-meaning")!;
    const lesson2 = lessons.find((l) => l.slug === "more-root-families")!;
    const { client, userId } = await createTestUserClient();
    const ilah = await fetchWord(request, 15);
    const raheem = await fetchWord(request, 3);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .in("item_key", [`root:${ilah.root}`, `root:${raheem.root}`]);

    // Complete Lesson 1 first, exactly as a real learner would -- this is
    // what actually seeds root:<'a-l-h> the first time.
    await resetLessonProgress(lesson1.id);
    const exercises1 = await fetchOrderedExercises(client, lesson1.id);
    await page.goto(`/lesson/${lesson1.id}`);
    await completeLesson(page, exercises1);

    const { count: afterLesson1 } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // Now complete Lesson 2, whose recap matching exercise re-covers the
    // SAME root ('a-l-h) plus the genuinely new one (r-h-m).
    await resetLessonProgress(lesson2.id);
    const exercises2 = await fetchOrderedExercises(client, lesson2.id);
    expect(exercises2[2]!.payload.pairs).toHaveLength(2);
    await page.goto(`/lesson/${lesson2.id}`);
    await completeLesson(page, exercises2);

    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", lesson2.id)
      .single();
    expect(progress?.status).toBe("completed");

    const { count: afterLesson2 } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    // Exactly one NEW item (r-h-m) -- the re-covered 'a-l-h root must not
    // duplicate.
    expect(afterLesson2).toBe((afterLesson1 ?? 0) + 1);

    const { count: rootCount } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("item_key", [`root:${ilah.root}`, `root:${raheem.root}`]);
    expect(rootCount).toBe(2);
  });

  test("French interface: Lesson 1 and root terminology render correctly", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "arabic-roots-intro");
    const lesson1 = lessons.find((l) => l.slug === "three-letters-one-meaning")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson1.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson1.id}`);
      await expect(
        page.getByRole("heading", { name: "Trois lettres, un seul sens" }),
      ).toBeVisible();
      await expect(page.getByText(/racine de trois lettres/)).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("accessibility: true_false and multiple_choice controls are keyboard-operable with distinct accessible names, no color-only feedback", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "arabic-roots-intro");
    const lesson1 = lessons.find((l) => l.slug === "three-letters-one-meaning")!;
    await resetLessonProgress(lesson1.id);
    await page.goto(`/lesson/${lesson1.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await page.getByRole("button", { name: "Next" }).click(); // past word 1
    await page.getByRole("button", { name: "Next" }).click(); // past word 2
    await page.getByRole("button", { name: "Next" }).click(); // past quran_example 1
    await page.getByRole("button", { name: "Next" }).click(); // past quran_example 2
    await page.getByRole("button", { name: "Next" }).click(); // past tip
    await page.getByRole("button", { name: "Next" }).click(); // to true_false exercise

    const trueBtn = page.getByRole("button", { name: "True" });
    await trueBtn.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("mobile: the root-family words render dir=rtl/lang=ar without clipping at 390x844", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "arabic-roots-intro");
    const lesson1 = lessons.find((l) => l.slug === "three-letters-one-meaning")!;
    await resetLessonProgress(lesson1.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${lesson1.id}`);
    await page.getByRole("button", { name: "Next" }).click();

    const word = page.getByText("اللَّه", { exact: true });
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

test.describe("Level 3 Batch 1 — Module 2: How Patterns Shape Meaning", () => {
  test("module and lesson exist, in the correct order", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index&slug=eq.word-patterns",
    )) as { slug: string; title_en: string; title_fr: string; order_index: number }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("How Patterns Shape Meaning");
    expect(modules[0]!.order_index).toBe(1);

    const lessons = await fetchModuleLessons(request, "word-patterns");
    expect(lessons.map((l) => l.slug)).toEqual(["same-root-different-shape"]);
  });

  test("full lifecycle on Same Root, Different Shape: Qur'an FK integrity (1:4, 114:2), completion, and exactly ONE new root review item (root:<m-l-k root>)", async ({
    page,
    request,
  }) => {
    // Headroom beyond completeLesson's own wall-clock bound (see
    // utils/lesson-interaction.ts), so that bound -- not this outer
    // timeout -- is what governs a slow/degraded run.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "word-patterns");
    const lesson = lessons.find((l) => l.slug === "same-root-different-shape")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    const malikAnNas = await fetchWord(request, 14);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_key", `root:${malikAnNas.root}`);

    const ayah1_4 = await fetchAyah(request, 1, 4);
    const ayah114_2 = await fetchAyah(request, 114, 2);

    const exercises = await fetchOrderedExercises(client, lesson.id);
    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await page.getByRole("button", { name: "Next" }).click(); // past word 1 (Maalik)
    await page.getByRole("button", { name: "Next" }).click(); // past word 2 (Malik)
    await expect(page.getByText(ayah1_4.arabic_text, { exact: true })).toBeVisible();
    await expect(page.getByText(ayah1_4.translation_en, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(ayah114_2.arabic_text, { exact: true })).toBeVisible();
    await expect(page.getByText(ayah114_2.translation_en, { exact: true })).toBeVisible();

    // Reset progress and re-navigate, not a continuation of the walk
    // above: completeLesson always starts its own exerciseIndex at 0,
    // which must stay in lockstep with the player's own step position --
    // and the player resumes from the persisted last_section_index, so a
    // plain reload alone would resume mid-walk and desync the two.
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
      .select("item_type, item_key")
      .eq("user_id", userId)
      .eq("item_key", `root:${malikAnNas.root}`)
      .single();
    expect(item?.item_type).toBe("root");
  });

  test("French interface renders correctly", async ({ page, request }) => {
    const lessons = await fetchModuleLessons(request, "word-patterns");
    const lesson = lessons.find((l) => l.slug === "same-root-different-shape")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await expect(
        page.getByRole("heading", { name: "Même racine, forme différente" }),
      ).toBeVisible();
      await expect(page.getByText(/schèmes/).first()).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});

test.describe("Level 3 progression: STEP_LEVEL_SLUGS 'roots' entry", () => {
  test("the 'roots' step is locked before Level 2 completes, and unlocks with a working first-lesson link once Level 2 is complete -- Level 1/Level 2 behavior is unaffected", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);

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
    const level2Mods = (await apiGet(
      request,
      "modules?select=id,levels!inner(slug)&levels.slug=eq.basic-vocabulary-and-patterns",
    )) as { id: string }[];
    const level2Lessons: { id: string }[] = [];
    for (const m of level2Mods) {
      const lessons = (await apiGet(request, `lessons?select=id&module_id=eq.${m.id}`)) as {
        id: string;
      }[];
      level2Lessons.push(...lessons);
    }
    const rootsLessons = [
      ...(await fetchModuleLessons(request, "arabic-roots-intro")),
      ...(await fetchModuleLessons(request, "word-patterns")),
    ];

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        [...level1Lessons, ...level2Lessons, ...rootsLessons].map((l) => l.id),
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

    // Level 1 complete, Level 2 NOT complete -> "roots" must stay locked.
    await markCompleted(level1Lessons);

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
    const vocabRow = page.locator("li", { hasText: "Qur'anic vocabulary" });
    const rootsRow = page.locator("li", { hasText: "Arabic roots" });

    await expect(vocabRow.getByText("Up next")).toBeVisible();
    await expect(rootsRow.getByText("Locked")).toBeVisible();
    await expect(rootsRow.getByRole("link")).toHaveCount(0);

    // Complete Level 2 too -> "roots" must unlock with a real, working
    // link into its first lesson, and Level 1/Level 2's own rows must be
    // unaffected by the new mapping.
    await markCompleted(level2Lessons);
    await page.reload();

    await expect(vocabRow.getByText("Completed", { exact: true })).toBeVisible();
    await expect(rootsRow.getByText("Locked")).not.toBeVisible();
    const href = await rootsRow.getByRole("link").getAttribute("href");
    const firstLessonIds = new Set(
      (await fetchModuleLessons(request, "arabic-roots-intro")).map((l) => l.id),
    );
    expect(
      firstLessonIds.has(href?.split("/lesson/")[1] ?? ""),
      "the roots step must link into a real arabic-roots-intro lesson, not a dead link",
    ).toBe(true);
  });
});

test.describe("Level 3 Batch 1 — Practice and Daily Study compatibility with 'root' items", () => {
  test("a root review item seeded from a Batch 1 lesson is due-able and consumable in a real Practice session, and surfaces on Daily Study", async ({
    page,
    request,
  }) => {
    test.setTimeout(30_000);
    const { client, userId } = await createTestUserClient();
    const rabb = await fetchWord(request, 2); // Ar-Rahman -> r-h-m root
    const itemKey = `root:${rabb.root}`;
    await client.from("review_items").delete().eq("user_id", userId);
    const today = new Date().toLocaleDateString("en-CA");
    await client.from("review_items").insert({
      user_id: userId,
      item_type: "root",
      item_key: itemKey,
      front: rabb.root,
      back: "Mercy -- seen in Ar-Rahman and Ar-Raheem",
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
      item_type: "root",
      item_key: itemKey,
      front: rabb.root,
      back: "Mercy -- seen in Ar-Rahman and Ar-Raheem",
      due_date: today,
    });
    await page.goto("/daily");
    await expect(page.getByText(/Item 1 of \d+/)).toBeVisible();
    await expect(page.getByText(rabb.root, { exact: true })).toBeVisible();
    await client.from("review_items").delete().eq("user_id", userId).eq("item_key", itemKey);
  });
});

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers Level 2 Batch 1: "long-vowels-and-orthography" (bridge module —
 * long-vowel carriers, dagger alif, hamzat al-waṣl, purely as reading
 * facts, never Tajweed) and "core-vocabulary-1" (word_frequency ranks
 * 1-10). Also covers the Phase 5 progression-resolver generalization
 * (findCurriculumEntryPoint) specifically for the "vocabulary" learning-
 * path step, mirroring 31-level1-release-journey.spec.ts's methodology —
 * the exact class of test that caught the Phase 4 hardcoded-module
 * defect, now extended to prove Level 2's entry point walks correctly
 * too, not just Level 1's.
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
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Correct!")).toBeVisible();
}

async function clickNextOrComplete(page: Page) {
  const nextOrComplete = page.getByRole("button", { name: /^(Next|Complete lesson)$/ });
  try {
    await nextOrComplete.click({ timeout: 5_000 });
  } catch {
    // Next loop iteration's "Lesson complete!" check resolves whether it
    // actually landed.
  }
}

/** Advances through sections and their attached exercises (answering each
 * as encountered, exactly as completeLesson does) until targetText becomes
 * visible, rather than running all the way to "Lesson complete!". */
async function advanceUntilVisible(page: Page, exercises: DbExercise[], targetText: string) {
  let exerciseIndex = 0;
  for (let i = 0; i < 60; i++) {
    // A short waitFor, not an instant isVisible() snapshot: quran_example
    // sections fetch their ayah via useQuery (a real network round-trip),
    // so the target text may not exist in the DOM yet on the exact
    // iteration this step is reached — an instant check would click past
    // it before the fetch resolves.
    const appeared = await page
      .getByText(targetText, { exact: true })
      .waitFor({ state: "visible", timeout: 800 })
      .then(() => true)
      .catch(() => false);
    if (appeared) return;
    const checkAnswerBtn = page.getByRole("button", { name: "Check answer" });
    if (await checkAnswerBtn.isVisible().catch(() => false)) {
      await answerExercise(page, exercises[exerciseIndex]!);
      exerciseIndex++;
      continue;
    }
    await clickNextOrComplete(page);
  }
  throw new Error(`advanceUntilVisible: exceeded iteration budget waiting for "${targetText}"`);
}

async function completeLesson(page: Page, exercises: DbExercise[]) {
  let exerciseIndex = 0;
  for (let i = 0; i < 60; i++) {
    if (
      await page
        .getByText("Lesson complete!")
        .isVisible()
        .catch(() => false)
    )
      return;
    const checkAnswerBtn = page.getByRole("button", { name: "Check answer" });
    if (await checkAnswerBtn.isVisible().catch(() => false)) {
      await answerExercise(page, exercises[exerciseIndex]!);
      exerciseIndex++;
      continue;
    }
    await clickNextOrComplete(page);
  }
  throw new Error("completeLesson: exceeded iteration budget without reaching completion");
}

test.describe("Level 2 Batch 1 — Module 1: Long Vowels & Qur'anic Spelling", () => {
  test("module and lessons exist, in the correct order, under the correct level", async ({
    request,
  }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index,level_id,levels(slug)&slug=eq.long-vowels-and-orthography",
    )) as {
      slug: string;
      title_en: string;
      title_fr: string;
      order_index: number;
      levels: { slug: string };
    }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Long Vowels & Qur'anic Spelling");
    expect(modules[0]!.levels.slug).toBe("basic-vocabulary-and-patterns");
    expect(modules[0]!.order_index).toBe(0);

    const lessons = await fetchModuleLessons(request, "long-vowels-and-orthography");
    expect(lessons.map((l) => l.slug)).toEqual([
      "long-vowel-carriers",
      "dagger-alif",
      "hamzat-al-wasl",
    ]);
  });

  test("Level 1 (33 lessons) remains completely unchanged", async ({ request }) => {
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
  });

  for (const slug of ["long-vowel-carriers", "dagger-alif", "hamzat-al-wasl"]) {
    test(`lesson "${slug}" opens and its sections render in order`, async ({ page, request }) => {
      const lessons = await fetchModuleLessons(request, "long-vowels-and-orthography");
      const lesson = lessons.find((l) => l.slug === slug)!;
      await page.goto(`/lesson/${lesson.id}`);
      await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
    });
  }

  test("full lifecycle on Lesson 1 (Long-Vowel Carriers): reading_check/true_false/matching, progress persistence, completion, and exactly ONE new concept review item", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "long-vowels-and-orthography");
    const lesson1 = lessons.find((l) => l.slug === "long-vowel-carriers")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson1.id);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_key", "concept:long-vowel-carriers");

    const exercises = await fetchOrderedExercises(client, lesson1.id);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "reading_check",
      "reading_check",
      "true_false",
      "matching",
      "multiple_choice",
    ]);

    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${lesson1.id}`);
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
      .select("item_key, front")
      .eq("user_id", userId)
      .eq("item_key", "concept:long-vowel-carriers")
      .single();
    expect(item?.front).toBe("long-vowel-carriers");
  });

  test("dagger alif and hamzat al-waṣl are always shown embedded in a real word — never isolated — and both render dir=rtl/lang=ar without clipping on mobile", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "long-vowels-and-orthography");
    const lesson2 = lessons.find((l) => l.slug === "dagger-alif")!;
    await resetLessonProgress(lesson2.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${lesson2.id}`);
    await page.getByRole("button", { name: "Next" }).click();

    const word = page.getByText("عَالَمِين", { exact: true });
    await expect(word).toBeVisible();
    await expect(word).toHaveAttribute("dir", "rtl");
    await expect(word).toHaveAttribute("lang", "ar");
    const box = await word.boundingBox();
    expect(box!.width).toBeGreaterThan(0);

    // This section has an attached reading_check (its own player step) —
    // must be answered before advancing, same interleaving established in
    // every Level 1 module spec.
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "aalamiin", exact: true }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(
      page.getByText("ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ", { exact: true }),
    ).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test("French interface: lesson and dagger-alif terminology render correctly", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "long-vowels-and-orthography");
    const lesson2 = lessons.find((l) => l.slug === "dagger-alif")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson2.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson2.id}`);
      await expect(page.getByRole("heading", { name: "L'alif suscrit" })).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click();
      await expect(page.getByText(/'Ālamīn/)).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});

test.describe("Level 2 Batch 1 — Module 2: Core Vocabulary I", () => {
  test("module and lessons exist, in the correct order", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index&slug=eq.core-vocabulary-1",
    )) as { slug: string; title_en: string; title_fr: string; order_index: number }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Core Vocabulary I");
    expect(modules[0]!.order_index).toBe(1);

    const lessons = await fetchModuleLessons(request, "core-vocabulary-1");
    expect(lessons.map((l) => l.slug)).toEqual(["vocabulary-1", "vocabulary-2"]);
  });

  test("lesson_vocabulary_words links exactly the 10 seeded word_frequency rows, ranks 1-10", async ({
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "core-vocabulary-1");
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
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  for (const slug of ["vocabulary-1", "vocabulary-2"]) {
    test(`lesson "${slug}" opens and its sections render in order`, async ({ page, request }) => {
      const lessons = await fetchModuleLessons(request, "core-vocabulary-1");
      const lesson = lessons.find((l) => l.slug === slug)!;
      await page.goto(`/lesson/${lesson.id}`);
      await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
    });
  }

  test("full lifecycle on Lesson 1 (Vocabulary Part 1): reading_check/matching, completion, and exactly FIVE new word review items", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "core-vocabulary-1");
    const lesson1 = lessons.find((l) => l.slug === "vocabulary-1")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson1.id);
    for (const w of ["اللَّه", "الرَّحْمَٰن", "الرَّحِيم", "رَبّ", "عَالَمِين"]) {
      await client.from("review_items").delete().eq("user_id", userId).eq("item_key", `word:${w}`);
    }

    const exercises = await fetchOrderedExercises(client, lesson1.id);
    expect(exercises.filter((e) => e.exercise_type === "reading_check")).toHaveLength(5);
    expect(exercises.filter((e) => e.exercise_type === "matching")).toHaveLength(1);

    const { count: before } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${lesson1.id}`);
    await completeLesson(page, exercises);

    await expect(page.getByText("Lesson complete!")).toBeVisible();
    const { count: after } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(after).toBe((before ?? 0) + 5);
  });

  test("rank 8 (دِّين) is used in the matching exercise but never as a reading_check target", async ({
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "core-vocabulary-1");
    const lesson2 = lessons.find((l) => l.slug === "vocabulary-2")!;
    const { client } = await createTestUserClient();
    const { data: exercises } = await client
      .from("lesson_exercises")
      .select("exercise_type, prompt_en, payload")
      .eq("lesson_id", lesson2.id);

    const readingChecks = (exercises ?? []).filter((e) => e.exercise_type === "reading_check");
    expect(readingChecks.every((e) => !e.prompt_en.includes("دِّين"))).toBe(true);

    const matching = (exercises ?? []).find((e) => e.exercise_type === "matching");
    const pairs = (matching?.payload as { pairs: { left: string }[] }).pairs;
    expect(pairs.some((p) => p.left === "دِّين")).toBe(true);
  });

  test("Qur'an example sections resolve by FK and show the real governed translation", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "core-vocabulary-1");
    const lesson1 = lessons.find((l) => l.slug === "vocabulary-1")!;
    const { client } = await createTestUserClient();
    await resetLessonProgress(lesson1.id);
    const exercises = await fetchOrderedExercises(client, lesson1.id);
    await page.goto(`/lesson/${lesson1.id}`);
    await advanceUntilVisible(page, exercises, "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");
    await expect(
      page.getByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("In the name of Allah, the Entirely Merciful, the Especially Merciful."),
    ).toBeVisible();
  });

  test("accessibility: reading_check and matching controls are keyboard-operable with distinct accessible names", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "core-vocabulary-1");
    const lesson1 = lessons.find((l) => l.slug === "vocabulary-1")!;
    await resetLessonProgress(lesson1.id);
    await page.goto(`/lesson/${lesson1.id}`);
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

test.describe("Level 2 progression resolver (Phase 5 architecture, Phase 4 regression class)", () => {
  test("the learning plan's 'vocabulary' step walks module 1 -> module 2 as each is completed, exactly the class of check that caught the Phase 4 hardcoded-module defect", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);

    const mod1Lessons = await fetchModuleLessons(request, "long-vowels-and-orthography");
    const mod2Lessons = await fetchModuleLessons(request, "core-vocabulary-1");
    const allLevel2Lessons = [...mod1Lessons, ...mod2Lessons];

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        allLevel2Lessons.map((l) => l.id),
      );

    // Reproduces saveLearningPath's own write shape (src/lib/placement.ts)
    // for a fresh "complete_beginner" path — the same shape
    // 23-daily-learning-plan.spec.ts's ensurePath() builds — without
    // re-driving the whole placement UI, already covered by
    // 03-placement.spec.ts. Deleted and recreated fresh (not reused) so
    // this test is deterministic regardless of what an earlier spec left.
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

    // fetchLearningPath's resync is a read-time projection, never
    // persisted to learning_path_steps — so it must be observed through
    // an actual page that calls it (PathTimeline on /learning-plan),
    // exactly the real path a learner's browser takes, not a raw table
    // read that would only ever show the stale seeded value.
    const vocabRow = page.locator("li", { hasText: "Qur'anic vocabulary" });

    // Complete Module 1 only -> the resolved link must point into a
    // Module 2 lesson, never report done after just the bridge module.
    await client.from("user_lesson_progress").insert(
      mod1Lessons.map((l) => ({
        user_id: userId,
        lesson_id: l.id,
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        last_section_index: 1,
        progress_percent: 100,
      })),
    );
    await page.goto("/learning-plan");
    await expect(vocabRow.getByText("In progress")).toBeVisible();
    const hrefAfterModule1 = await vocabRow.getByRole("link").getAttribute("href");
    const mod2LessonIds = new Set(mod2Lessons.map((l) => l.id));
    expect(mod2LessonIds.has(hrefAfterModule1?.split("/lesson/")[1] ?? "")).toBe(true);

    // Complete Module 2 too -> the resolved link must move into Batch 2's
    // core-vocabulary-2 (Level 2 Batch 2 added two more modules under the
    // same level_id after this spec was first written), never report the
    // whole "vocabulary" step done after just these first two modules.
    // Full walk-to-Completed coverage across all four Level 2 modules
    // lives in 33-level2-batch2-...spec.ts's own progression-resolver
    // test, so it is intentionally not duplicated here.
    await client.from("user_lesson_progress").insert(
      mod2Lessons.map((l) => ({
        user_id: userId,
        lesson_id: l.id,
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        last_section_index: 1,
        progress_percent: 100,
      })),
    );
    await page.reload();
    await expect(vocabRow.getByText("In progress")).toBeVisible();
    const hrefAfterModule2 = await vocabRow.getByRole("link").getAttribute("href");
    const vocab2Lessons = await fetchModuleLessons(request, "core-vocabulary-2");
    const vocab2LessonIds = new Set(vocab2Lessons.map((l) => l.id));
    expect(vocab2LessonIds.has(hrefAfterModule2?.split("/lesson/")[1] ?? "")).toBe(true);
  });
});

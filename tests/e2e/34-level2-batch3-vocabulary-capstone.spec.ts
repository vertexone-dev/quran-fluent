import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import { completeLessonResilient, resilientAnswerAndCheck } from "./utils/lesson-interaction";

/**
 * Covers Level 2 Batch 3: "vocabulary-capstone" — the fifth and final
 * Level 2 module, a deliberately small pure-synthesis capstone reading the
 * opening ayah of two different surahs (Al-Falaq 113:1, An-Nas 114:1),
 * both sharing the identical "Qul a'udhu bi-Rabbi + X" formula. Every
 * content word (Qul, Rabb, al-Falaq, an-Nas) is an exact-substring match
 * of an already-taught word_frequency lemma; "a'udhu" is the one
 * unavoidable new word, deliberately kept context-only (never added to
 * word_frequency, never used in a matching/review-item exercise). No
 * matching exercise exists anywhere in this module, so completion must
 * create zero new review items.
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

test.describe("Level 2 Batch 3 — Module 5: Vocabulary Capstone", () => {
  test("module and lesson exist, in the correct order, under Level 2", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index,levels(slug)&slug=eq.vocabulary-capstone",
    )) as {
      slug: string;
      title_en: string;
      title_fr: string;
      order_index: number;
      levels: { slug: string };
    }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Vocabulary Capstone");
    expect(modules[0]!.levels.slug).toBe("basic-vocabulary-and-patterns");
    expect(modules[0]!.order_index).toBe(4);

    const lessons = await fetchModuleLessons(request, "vocabulary-capstone");
    expect(lessons.map((l) => l.slug)).toEqual(["capstone-reading"]);
  });

  test("Level 1 (33 lessons) and Batch 1+2 (9 lessons) remain completely unchanged", async ({
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

    let batch12Total = 0;
    for (const slug of [
      "long-vowels-and-orthography",
      "core-vocabulary-1",
      "core-vocabulary-2",
      "short-phrases",
    ]) {
      batch12Total += (await fetchModuleLessons(request, slug)).length;
    }
    expect(batch12Total).toBe(9);
  });

  test("word_frequency remains at exactly 20 rows -- no new vocabulary added by the capstone", async () => {
    const { client } = await createTestUserClient();
    const { count } = await client
      .from("word_frequency")
      .select("*", { count: "exact", head: true });
    expect(count).toBe(20);
  });

  test("lesson opens and its sections render in order", async ({ page, request }) => {
    const lessons = await fetchModuleLessons(request, "vocabulary-capstone");
    const lesson = lessons.find((l) => l.slug === "capstone-reading")!;
    await page.goto(`/lesson/${lesson.id}`);
    await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
  });

  test("both capstone ayahs (113:1, 114:1) resolve by FK, show the real governed translation, render RTL without clipping on mobile, and 'a'udhu' never appears as a selectable answer choice", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "vocabulary-capstone");
    const lesson = lessons.find((l) => l.slug === "capstone-reading")!;
    const ayah113_1 = await fetchAyah(request, 113, 1);
    const ayah114_1 = await fetchAyah(request, 114, 1);
    await resetLessonProgress(lesson.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation

    const ayah1 = page.getByText(ayah113_1.arabic_text, { exact: true });
    await expect(ayah1).toBeVisible();
    await expect(ayah1).toHaveAttribute("dir", "rtl");
    await expect(ayah1).toHaveAttribute("lang", "ar");
    const box = await ayah1.boundingBox();
    expect(box!.width).toBeGreaterThan(0);
    await expect(page.getByText(/I seek refuge in the Lord of daybreak/)).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    // Section 1's attached reading_check must be answered before advancing.
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "qul a'udhu birabbi l-falaq", exact: true }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // to tip
    await page.getByRole("button", { name: "Next" }).click(); // to ayah 2

    await expect(page.getByText(ayah114_1.arabic_text, { exact: true })).toBeVisible();
    await expect(page.getByText(/I seek refuge in the Lord of mankind/)).toBeVisible();

    const { client } = await createTestUserClient();
    const { data: exercises } = await client
      .from("lesson_exercises")
      .select("exercise_type, prompt_en, payload")
      .eq("lesson_id", lesson.id);
    // "a'udhu" legitimately appears in each reading_check's prompt (the
    // full ayah text, "X reads:") -- that tests sentence-level reading
    // fluency, not word recall, matching Level 1/Batch 1/2 precedent for
    // quran_example reading_check exercises. The real governance check is
    // that it never appears as a selectable answer choice anywhere --
    // i.e. it is never presented as a recallable, mastered vocabulary
    // item on its own.
    const readingChecks = (exercises ?? []).filter((e) => e.exercise_type === "reading_check");
    const choiceText = readingChecks.flatMap((e) => (e.payload as { choices: string[] }).choices);
    expect(choiceText.some((c) => c.includes("أَعُوذُ") || c.includes("اعوذ"))).toBe(false);
  });

  test("full lifecycle: reading_check x2, true_false, multiple_choice; completion; and ZERO new review items (no matching exercise -- pure-synthesis capstone by design)", async ({
    page,
    request,
  }) => {
    // Headroom beyond completeLesson's own wall-clock bound (see
    // utils/lesson-interaction.ts), so that bound -- not this outer
    // timeout -- is what governs a slow/degraded run.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "vocabulary-capstone");
    const lesson = lessons.find((l) => l.slug === "capstone-reading")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);

    const exercises = await fetchOrderedExercises(client, lesson.id);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "reading_check",
      "reading_check",
      "true_false",
      "multiple_choice",
    ]);
    expect(exercises.some((e) => e.exercise_type === "matching")).toBe(false);

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

  test("French interface: lesson and capstone terminology render correctly", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "vocabulary-capstone");
    const lesson = lessons.find((l) => l.slug === "capstone-reading")!;
    const ayah113_1 = await fetchAyah(request, 113, 1);
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await expect(page.getByRole("heading", { name: "Lire deux nouveaux versets" })).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click();
      await expect(page.getByText(ayah113_1.translation_fr, { exact: true })).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("accessibility: reading_check controls are keyboard-operable with distinct accessible names, no color-only feedback", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "vocabulary-capstone");
    const lesson = lessons.find((l) => l.slug === "capstone-reading")!;
    await resetLessonProgress(lesson.id);
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation, to ayah 1
    await page.getByRole("button", { name: "Next" }).click(); // to ayah 1's attached reading_check

    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(3);
    await radios.first().focus();
    await page.keyboard.press("Space");
    await expect(radios.first()).toBeChecked();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("Practice and Daily Study remain unaffected by a module with no review-seeding exercises", async ({
    page,
  }) => {
    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
    await page.goto("/daily");
    await expect(page.getByRole("main")).toBeVisible();
  });
});

test.describe("Level 2 Batch 2 -> Batch 3 progression resolver", () => {
  test("the 'vocabulary' step moves from short-phrases into vocabulary-capstone once Batch 2 is complete", async ({
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

    const bridgeLessons = await fetchModuleLessons(request, "long-vowels-and-orthography");
    const vocab1Lessons = await fetchModuleLessons(request, "core-vocabulary-1");
    const vocab2Lessons = await fetchModuleLessons(request, "core-vocabulary-2");
    const phraseLessons = await fetchModuleLessons(request, "short-phrases");
    const capstoneLessons = await fetchModuleLessons(request, "vocabulary-capstone");
    const allLevel2Lessons = [
      ...bridgeLessons,
      ...vocab1Lessons,
      ...vocab2Lessons,
      ...phraseLessons,
      ...capstoneLessons,
    ];

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        [...level1Lessons, ...allLevel2Lessons].map((l) => l.id),
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

    // Level 1 must be complete for the "vocabulary" step to resync at all.
    await markCompleted(level1Lessons);
    // All of Batch 1 + Batch 2 complete, capstone not yet started.
    await markCompleted([...bridgeLessons, ...vocab1Lessons, ...vocab2Lessons, ...phraseLessons]);

    // fetchLearningPath's resync is a read-time projection over an
    // existing learning_paths/learning_path_steps row -- without one, the
    // PathTimeline never renders this li at all (see the identical setup
    // in 33-...spec.ts's own resolver test).
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
    await page.goto("/learning-plan");
    await expect(vocabRow.getByText("In progress")).toBeVisible();
    const href = await vocabRow.getByRole("link").getAttribute("href");
    const capstoneLessonIds = new Set(capstoneLessons.map((l) => l.id));
    expect(capstoneLessonIds.has(href?.split("/lesson/")[1] ?? "")).toBe(true);
  });
});

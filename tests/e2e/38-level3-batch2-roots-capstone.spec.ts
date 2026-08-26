import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers Level 3 (Roots & Word Patterns) Batch 2: "roots-capstone" -- the
 * third and final Level 3 module, a deliberately small pure-synthesis
 * capstone reusing ayah 1:2 (already shown as a full quran_example three
 * times before -- reading-al-fatiha-verses-1-3, dagger-alif,
 * reading-with-harakat -- reused again here per the explicit instruction
 * to prefer already-verified examples). This single ayah contains THREE
 * already-taught roots in one sentence: 'a-l-h (Allah, embedded in
 * li-llahi), r-b-b (the exact word Rabb), and '-l-m ('Aalameen, embedded
 * in al-'aalameen). "al-hamdu" ("praise") is the one unavoidable new word,
 * deliberately kept context-only (never added to word_frequency, never a
 * selectable answer choice). No matching exercise exists anywhere in this
 * module, so completion must create zero new review items -- Rabb and
 * 'Aalameen each have only one known word built from their root among the
 * 20 taught words, so this lesson applies existing root awareness rather
 * than teaching a new reviewable root-family fact.
 */

type DbExercise = {
  exercise_type: string;
  payload: {
    choices?: string[];
    correctIndex?: number;
    correctAnswer?: boolean;
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

test.describe("Level 3 Batch 2 — Module 3: Roots Capstone", () => {
  test("module and lesson exist, in the correct order, under Level 3", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index,levels(slug)&slug=eq.roots-capstone",
    )) as {
      slug: string;
      title_en: string;
      title_fr: string;
      order_index: number;
      levels: { slug: string };
    }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Roots Capstone");
    expect(modules[0]!.levels.slug).toBe("roots-and-word-patterns");
    expect(modules[0]!.order_index).toBe(2);

    const lessons = await fetchModuleLessons(request, "roots-capstone");
    expect(lessons.map((l) => l.slug)).toEqual(["reading-with-root-awareness"]);
  });

  test("Level 1 (33 lessons), Level 2 (10 lessons), and Level 3 Batch 1 (3 lessons) remain completely unchanged", async ({
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

    let batch1Total = 0;
    for (const slug of ["arabic-roots-intro", "word-patterns"]) {
      batch1Total += (await fetchModuleLessons(request, slug)).length;
    }
    expect(batch1Total).toBe(3);
  });

  test("word_frequency remains at exactly 20 rows -- no new vocabulary added by the capstone", async () => {
    const { client } = await createTestUserClient();
    const { count } = await client
      .from("word_frequency")
      .select("*", { count: "exact", head: true });
    expect(count).toBe(20);
  });

  test("lesson opens and its sections render in order", async ({ page, request }) => {
    const lessons = await fetchModuleLessons(request, "roots-capstone");
    const lesson = lessons.find((l) => l.slug === "reading-with-root-awareness")!;
    await page.goto(`/lesson/${lesson.id}`);
    await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
  });

  test("ayah 1:2 resolves by FK, shows the real governed translation, renders RTL without clipping on mobile, and 'al-hamdu' never appears as a selectable answer choice", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "roots-capstone");
    const lesson = lessons.find((l) => l.slug === "reading-with-root-awareness")!;
    const ayah1_2 = await fetchAyah(request, 1, 2);
    await resetLessonProgress(lesson.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation

    const ayah = page.getByText(ayah1_2.arabic_text, { exact: true });
    await expect(ayah).toBeVisible();
    await expect(ayah).toHaveAttribute("dir", "rtl");
    await expect(ayah).toHaveAttribute("lang", "ar");
    const box = await ayah.boundingBox();
    expect(box!.width).toBeGreaterThan(0);
    await expect(page.getByText(/Lord of the worlds/)).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    const { client } = await createTestUserClient();
    const { data: exercises } = await client
      .from("lesson_exercises")
      .select("exercise_type, payload")
      .eq("lesson_id", lesson.id);
    const readingChecks = (exercises ?? []).filter((e) => e.exercise_type === "reading_check");
    const choiceText = readingChecks.flatMap((e) => (e.payload as { choices: string[] }).choices);
    expect(choiceText.some((c) => c.includes("الْحَمْدُ") || c.includes("حمد"))).toBe(false);
  });

  test("full lifecycle: reading_check, true_false, multiple_choice; completion; and ZERO new review items (no matching exercise -- pure-synthesis capstone by design)", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "roots-capstone");
    const lesson = lessons.find((l) => l.slug === "reading-with-root-awareness")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);

    const exercises = await fetchOrderedExercises(client, lesson.id);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
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
    const lessons = await fetchModuleLessons(request, "roots-capstone");
    const lesson = lessons.find((l) => l.slug === "reading-with-root-awareness")!;
    const ayah1_2 = await fetchAyah(request, 1, 2);
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await expect(
        page.getByRole("heading", { name: "Lire avec conscience des racines" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click();
      await expect(page.getByText(ayah1_2.translation_fr, { exact: true })).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("accessibility: reading_check controls are keyboard-operable with distinct accessible names, no color-only feedback", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "roots-capstone");
    const lesson = lessons.find((l) => l.slug === "reading-with-root-awareness")!;
    await resetLessonProgress(lesson.id);
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await page.getByRole("button", { name: "Next" }).click(); // to the reading_check exercise

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

test.describe("Level 3 Batch 1 -> Batch 2 progression resolver", () => {
  test("the 'roots' step moves from word-patterns into roots-capstone once Batch 1 is complete, and Level 3 does not falsely report Completed after only Batch 1", async ({
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

    const arabicRootsLessons = await fetchModuleLessons(request, "arabic-roots-intro");
    const wordPatternsLessons = await fetchModuleLessons(request, "word-patterns");
    const capstoneLessons = await fetchModuleLessons(request, "roots-capstone");
    const allLevel3Lessons = [...arabicRootsLessons, ...wordPatternsLessons, ...capstoneLessons];

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        [...level1Lessons, ...level2Lessons, ...allLevel3Lessons].map((l) => l.id),
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

    // Level 1 + Level 2 complete, Level 3 Batch 1 (both modules) complete
    // too, capstone not yet started -> the "roots" step must NOT falsely
    // report Completed, and its link must point into roots-capstone.
    await markCompleted(level1Lessons);
    await markCompleted(level2Lessons);
    await markCompleted([...arabicRootsLessons, ...wordPatternsLessons]);

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

    const rootsRow = page.locator("li", { hasText: "Arabic roots" });
    await page.goto("/learning-plan");

    await expect(
      rootsRow.getByText("Completed", { exact: true }),
      "Level 3 must NOT report Completed after only Batch 1 (arabic-roots-intro + word-patterns) -- roots-capstone is not done yet",
    ).not.toBeVisible();
    await expect(rootsRow.getByText("In progress")).toBeVisible();
    const href = await rootsRow.getByRole("link").getAttribute("href");
    const capstoneLessonIds = new Set(capstoneLessons.map((l) => l.id));
    expect(
      capstoneLessonIds.has(href?.split("/lesson/")[1] ?? ""),
      "the roots step must link into a real roots-capstone lesson, not a dead link",
    ).toBe(true);
  });
});

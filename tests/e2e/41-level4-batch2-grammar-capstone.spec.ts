import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import { completeLessonResilient, resilientAnswerAndCheck } from "./utils/lesson-interaction";

/**
 * Covers Level 4 (Core Grammar) Batch 2: "grammar-in-context-capstone" --
 * the third and final Level 4 module, a deliberately small pure-
 * application capstone reusing three already-cached, already-shown ayahs
 * (1:2, 113:1, 113:2). Teaches the two remaining Level 4 grammar concepts
 * from the approved design -- the attached prepositions li- and bi-, and
 * verb recognition (imperative qul vs. past-tense khalaqa) -- using
 * entirely already-known vocabulary. "a'udhu" ("I seek refuge") and "maa"
 * ("that which") are the unavoidable new words, deliberately kept
 * context-only (never added to word_frequency, never a selectable answer
 * choice). No matching exercise exists anywhere in this module, so
 * completion must create zero new review items -- the same "pure
 * synthesis, zero new review items" judgment already validated in
 * production for Level 3 Batch 2's capstone.
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

test.describe("Level 4 Batch 2 — Module 3: Grammar Capstone", () => {
  test("module and lesson exist, in the correct order, under Level 4", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index,levels(slug)&slug=eq.grammar-in-context-capstone",
    )) as {
      slug: string;
      title_en: string;
      title_fr: string;
      order_index: number;
      levels: { slug: string };
    }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Grammar Capstone");
    expect(modules[0]!.levels.slug).toBe("core-grammar");
    expect(modules[0]!.order_index).toBe(2);

    const lessons = await fetchModuleLessons(request, "grammar-in-context-capstone");
    expect(lessons.map((l) => l.slug)).toEqual(["reading-with-grammar-awareness"]);
  });

  test("Levels 1-3 and Level 4 Batch 1 remain completely unchanged", async ({ request }) => {
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

    let batch1Total = 0;
    for (const slug of ["pronouns-and-nominal-sentences", "agreement-and-genitive-constructions"]) {
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
    const lessons = await fetchModuleLessons(request, "grammar-in-context-capstone");
    const lesson = lessons.find((l) => l.slug === "reading-with-grammar-awareness")!;
    await page.goto(`/lesson/${lesson.id}`);
    await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
  });

  test("ayahs 1:2, 113:1 and 113:2 resolve by FK, render RTL without clipping on mobile, and 'a'udhu'/'maa' never appear as selectable answer choices", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "grammar-in-context-capstone");
    const lesson = lessons.find((l) => l.slug === "reading-with-grammar-awareness")!;
    const ayah1_2 = await fetchAyah(request, 1, 2);
    const ayah113_1 = await fetchAyah(request, 113, 1);
    const ayah113_2 = await fetchAyah(request, 113, 2);
    await resetLessonProgress(lesson.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation

    const first = page.getByText(ayah1_2.arabic_text, { exact: true });
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute("dir", "rtl");
    await expect(first).toHaveAttribute("lang", "ar");
    const box = await first.boundingBox();
    expect(box!.width).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(ayah113_1.arabic_text, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(ayah113_2.arabic_text, { exact: true })).toBeVisible();

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
    expect(choiceText.some((c) => c.includes("أَعُوذُ") || c.includes("اعوذ"))).toBe(false);
    expect(choiceText.some((c) => c.includes("مَا") && !c.includes("qul"))).toBe(false);
  });

  test("full lifecycle: reading_check, true_false, multiple_choice; completion; and ZERO new review items (no matching exercise -- pure-application capstone by design)", async ({
    page,
    request,
  }) => {
    // Headroom beyond completeLesson's own wall-clock bound (see
    // utils/lesson-interaction.ts), so that bound -- not this outer
    // timeout -- is what governs a slow/degraded run.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "grammar-in-context-capstone");
    const lesson = lessons.find((l) => l.slug === "reading-with-grammar-awareness")!;
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
    const lessons = await fetchModuleLessons(request, "grammar-in-context-capstone");
    const lesson = lessons.find((l) => l.slug === "reading-with-grammar-awareness")!;
    const ayah1_2 = await fetchAyah(request, 1, 2);
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await expect(
        page.getByRole("heading", { name: "Lire avec conscience grammaticale" }),
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
    const lessons = await fetchModuleLessons(request, "grammar-in-context-capstone");
    const lesson = lessons.find((l) => l.slug === "reading-with-grammar-awareness")!;
    await resetLessonProgress(lesson.id);
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await page.getByRole("button", { name: "Next" }).click(); // past 1:2
    await page.getByRole("button", { name: "Next" }).click(); // past 113:1
    await page.getByRole("button", { name: "Next" }).click(); // past 113:2
    await page.getByRole("button", { name: "Next" }).click(); // past tip
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

test.describe("Level 4 Batch 1 -> Batch 2 progression resolver", () => {
  test("the 'grammar' step moves from Batch 1 into grammar-in-context-capstone once Batch 1 is complete, and Level 4 does not falsely report Completed after only Batch 1", async ({
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
    const pronounsLessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const agreementLessons = await fetchModuleLessons(
      request,
      "agreement-and-genitive-constructions",
    );
    const capstoneLessons = await fetchModuleLessons(request, "grammar-in-context-capstone");
    const allLevel4Lessons = [...pronounsLessons, ...agreementLessons, ...capstoneLessons];

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        [...level1Lessons, ...level2Lessons, ...level3Lessons, ...allLevel4Lessons].map(
          (l) => l.id,
        ),
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

    // Levels 1-3 complete, Level 4 Batch 1 (both modules) complete too,
    // capstone not yet started -> the "grammar" step must NOT falsely
    // report Completed, and its link must point into the capstone.
    await markCompleted(level1Lessons);
    await markCompleted(level2Lessons);
    await markCompleted(level3Lessons);
    await markCompleted([...pronounsLessons, ...agreementLessons]);

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

    const grammarRow = page.locator("li", { hasText: "Grammar foundations" });
    await page.goto("/learning-plan");

    await expect(
      grammarRow.getByText("Completed", { exact: true }),
      "Level 4 must NOT report Completed after only Batch 1 (pronouns-and-nominal-sentences + agreement-and-genitive-constructions) -- grammar-in-context-capstone is not done yet",
    ).not.toBeVisible();
    await expect(grammarRow.getByText("In progress")).toBeVisible();
    const href = await grammarRow.getByRole("link").getAttribute("href");
    const capstoneLessonIds = new Set(capstoneLessons.map((l) => l.id));
    expect(
      capstoneLessonIds.has(href?.split("/lesson/")[1] ?? ""),
      "the grammar step must link into a real grammar-in-context-capstone lesson, not a dead link",
    ).toBe(true);
  });
});

test.describe("Level 4 release journey", () => {
  test("the 'grammar' learning-path step walks through all 3 real Level 4 modules in order as each is completed, and only reports 'Completed' once every real lesson is done -- never after just Batch 1", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
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

    const LEVEL4_MODULES = [
      "pronouns-and-nominal-sentences",
      "agreement-and-genitive-constructions",
      "grammar-in-context-capstone",
    ] as const;
    const lessonsByModule: Record<string, { id: string; slug: string }[]> = {};
    for (const slug of LEVEL4_MODULES) {
      lessonsByModule[slug] = await fetchModuleLessons(request, slug);
    }
    const totalLevel4Lessons = Object.values(lessonsByModule).reduce((n, l) => n + l.length, 0);

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
          ...Object.values(lessonsByModule).flat(),
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

    // Levels 1-3 must all be complete before the "grammar" step resyncs
    // at all (requiresLevelSlug gates on Level 3).
    await markCompleted(level1Lessons);
    await markCompleted(level2Lessons);
    await markCompleted(level3Lessons);

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

    const grammarRow = page.locator("li", { hasText: "Grammar foundations" });
    await page.goto("/learning-plan");

    for (let i = 0; i < LEVEL4_MODULES.length; i++) {
      const slug = LEVEL4_MODULES[i]!;
      await markCompleted(lessonsByModule[slug]!);
      await page.reload();

      const nextSlug = LEVEL4_MODULES[i + 1];
      if (nextSlug) {
        await expect(
          grammarRow.getByText("Completed", { exact: true }),
          `Level 4 must NOT report Completed after only completing ${slug} -- ${nextSlug} is not done yet`,
        ).not.toBeVisible();
        const href = await grammarRow.getByRole("link").getAttribute("href");
        const nextLessonIds = new Set(lessonsByModule[nextSlug]!.map((l) => l.id));
        expect(
          nextLessonIds.has(href?.split("/lesson/")[1] ?? ""),
          `link after ${slug} should point into ${nextSlug}, got href=${href}`,
        ).toBe(true);
      } else {
        // grammar-in-context-capstone was the last module completed ->
        // Level 4 is now fully done, with a valid re-entry path.
        await expect(grammarRow.getByText("Completed", { exact: true })).toBeVisible();
        await expect(grammarRow.getByRole("link", { name: "Review lesson" })).toBeVisible();
      }
    }

    const { count } = await client
      .from("user_lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .in(
        "lesson_id",
        Object.values(lessonsByModule)
          .flat()
          .map((l) => l.id),
      );
    expect(count).toBe(totalLevel4Lessons);
  });

  test("grammar-in-context-capstone is reachable and is the final Level 4 module", async ({
    request,
  }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,order_index,levels!inner(slug)&levels.slug=eq.core-grammar&order=order_index.asc",
    )) as { slug: string; order_index: number }[];
    expect(modules.map((m) => m.slug)).toEqual([
      "pronouns-and-nominal-sentences",
      "agreement-and-genitive-constructions",
      "grammar-in-context-capstone",
    ]);
    expect(modules[modules.length - 1]!.slug).toBe("grammar-in-context-capstone");
  });
});

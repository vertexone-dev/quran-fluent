import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import { completeLessonResilient, resilientAnswerAndCheck } from "./utils/lesson-interaction";

/**
 * Covers Level 5 (Guided Āyah Comprehension) Batch 1: Module 1
 * (attached-particles: wa-, al-, fī, min, ʿalā, bi-, li-) and Module 2
 * (verbal-sentences-past: past-tense verb recognition, verb-first sentence
 * shape, maa, and a guided decomposition capstone of Al-Falaq 113:2).
 *
 * The renamed level (levels.number=5, slug guided-ayah-comprehension,
 * formerly the empty "reading-comprehension" placeholder) and the new
 * STEP_LEVEL_SLUGS.ayah_comprehension entry (src/lib/placement.ts) are the
 * only application-code-adjacent changes; everything else is curriculum
 * content. This spec deliberately does not re-test the generic
 * lesson-completion/review-item-seeding machinery already covered
 * extensively by specs 21-23 and 40-42 -- it covers what is new here:
 * gating, rendering in both locales, canonical-ayah FK resolution, and
 * that adding a new STEP_LEVEL_SLUGS entry does not regress Level 4.
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
    } else {
      throw new Error(`answerExercise: unhandled exercise_type "${t}"`);
    }
  });
}

test.describe("Level 5 Batch 1 progression", () => {
  test("ayah_comprehension is gated behind core-grammar completion, then becomes a real, linkable step", async ({
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
    const pronounsLessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const agreementLessons = await fetchModuleLessons(
      request,
      "agreement-and-genitive-constructions",
    );
    const capstoneLessons = await fetchModuleLessons(request, "grammar-in-context-capstone");
    const allLevel4Lessons = [...pronounsLessons, ...agreementLessons, ...capstoneLessons];
    const level5Lessons = await fetchLevelLessons(request, "guided-ayah-comprehension");
    const attachedParticlesLessons = await fetchModuleLessons(request, "attached-particles");

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
          ...allLevel4Lessons,
          ...level5Lessons,
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

    // Levels 1-3 complete, Level 4 Batch 1 complete, but the capstone
    // (grammar-in-context-capstone) is NOT complete -> core-grammar is not
    // fully done -> ayah_comprehension must stay locked, no real link.
    await markCompleted(level1Lessons);
    await markCompleted(level2Lessons);
    await markCompleted(level3Lessons);
    await markCompleted([...pronounsLessons, ...agreementLessons]);
    await resetPathTo("grammar");

    const ayahRowLocked = page.locator("li", { hasText: "Ayah comprehension" });
    await page.goto("/learning-plan");
    await expect(ayahRowLocked.getByText("Locked", { exact: true })).toBeVisible();
    await expect(ayahRowLocked.getByRole("link")).toHaveCount(0);

    // Now complete Level 4 fully (including the capstone) -> core-grammar
    // is fully done -> ayah_comprehension must become a real, linkable
    // step pointing into the first Level 5 Batch 1 lesson.
    await markCompleted(capstoneLessons);
    await resetPathTo("grammar");

    const ayahRow = page.locator("li", { hasText: "Ayah comprehension" });
    await page.goto("/learning-plan");
    await expect(ayahRow.getByText("Up next", { exact: true })).toBeVisible();
    const href = await ayahRow.getByRole("link").getAttribute("href");
    const level5LessonIds = new Set(attachedParticlesLessons.map((l) => l.id));
    expect(
      level5LessonIds.has(href?.split("/lesson/")[1] ?? ""),
      "the ayah_comprehension step must link into a real attached-particles lesson, not a dead link",
    ).toBe(true);
  });

  test("existing Level 4 'grammar' step still reports Completed correctly after the ayah_comprehension mapping was added", async ({
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

    await client.from("user_lesson_progress").insert(
      [...level1Lessons, ...level2Lessons, ...level3Lessons, ...allLevel4Lessons].map((l) => ({
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
    await client.from("learning_path_steps").insert({
      path_id: newPath!.id,
      user_id: userId,
      step_key: "grammar",
      order_index: 6,
      status: "in_progress",
      progress: 0,
      lesson_id: null,
    });

    const grammarRow = page.locator("li", { hasText: "Grammar foundations" });
    await page.goto("/learning-plan");
    await expect(grammarRow.getByText("Completed", { exact: true })).toBeVisible();
  });
});

test.describe("Level 5 Batch 1 — Module 1: attached-particles", () => {
  test("renders correctly in English", async ({ page, request }) => {
    const lessons = await fetchModuleLessons(request, "attached-particles");
    const lesson = lessons.find((l) => l.slug === "attached-prefixes-wa-al-bi-li")!;
    await resetLessonProgress(lesson.id);

    await page.goto(`/lesson/${lesson.id}`);
    await expect(
      page.getByRole("heading", { name: "Attached Prefixes: wa-, al-, bi-, li-" }),
    ).toBeVisible();
    await expect(
      page.getByText("four tiny prefixes that attach directly to the front of a word"),
    ).toBeVisible();
  });

  test("renders correctly in French, with no English leakage", async ({ page, request }) => {
    const lessons = await fetchModuleLessons(request, "attached-particles");
    const lesson = lessons.find((l) => l.slug === "attached-prefixes-wa-al-bi-li")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await expect(
        page.getByRole("heading", { name: "Préfixes attachés : wa-, al-, bi-, li-" }),
      ).toBeVisible();
      await expect(
        page.getByText("quatre minuscules préfixes qui s'attachent directement"),
      ).toBeVisible();
      // No English leakage: the distinctive English explanation wording
      // must not appear anywhere on a fully French-resolved lesson.
      await expect(
        page.getByText("four tiny prefixes that attach directly to the front of a word"),
      ).not.toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});

test.describe("Level 5 Batch 1 — Module 2: verbal-sentences-past", () => {
  test("the guided-decomposition capstone's authentic āyah reference resolves from the canonical dataset, and its exercise flow completes and persists progress", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const ayahs = (await apiGet(
      request,
      "ayahs?select=arabic_text&surah_number=eq.113&ayah_number=eq.2",
    )) as { arabic_text: string }[];
    const canonicalText = ayahs[0]!.arabic_text;

    const lessons = await fetchModuleLessons(request, "verbal-sentences-past");
    const lesson = lessons.find((l) => l.slug === "guided-decomposition-al-falaq-2")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);

    await page.goto(`/lesson/${lesson.id}`);
    await expect(
      page.getByRole("heading", { name: "Guided Decomposition: Sūrah Al-Falaq, Āyah 2" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // past explanation, to quran_example
    // The quran_example section must render the exact canonical Arabic
    // fetched live from the ayahs table, not a hand-typed copy.
    await expect(page.getByText(canonicalText, { exact: true })).toBeVisible();

    const exercises = (await apiGet(
      request,
      `lesson_exercises?select=exercise_type,payload&lesson_id=eq.${lesson.id}&order=order_index.asc`,
    )) as DbExercise[];
    expect(exercises).toHaveLength(3);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "reading_check",
      "multiple_choice",
      "true_false",
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
  });
});

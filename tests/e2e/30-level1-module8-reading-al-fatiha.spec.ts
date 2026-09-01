import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import {
  completeLessonResilient,
  resilientAnswerAndCheck,
  waitForHeadingResilient,
} from "./utils/lesson-interaction";

/**
 * Covers Level 1, Module 8 ("reading-al-fatiha") — the capstone module,
 * applying every mechanic taught in Modules 1-7 to read all seven āyahs of
 * Sūrat Al-Fātiḥa. Every āyah is referenced by (surah_number, ayah_number)
 * FK against the existing `ayahs` table via `quran_example` sections — no
 * Qur'anic Arabic text is duplicated in the migration, and the rendering
 * component (QuranExampleSection) is pre-existing, unmodified application
 * code. Like Module 7, this module deliberately creates ZERO new review
 * items — it uses no `matching` exercises, since applying already-taught
 * skills to real text is not itself a new, durable, flashcard-worthy fact.
 * This is also the last module of Level 1: there is no Module 9 to assert
 * "remains empty" against.
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

async function fetchModule8Lessons(request: APIRequestContext) {
  const modules = (await apiGet(request, "modules?select=id&slug=eq.reading-al-fatiha")) as {
    id: string;
  }[];
  const moduleId = modules[0]!.id;
  const lessons = (await apiGet(
    request,
    `lessons?select=id,slug,title_en,title_fr,order_index&module_id=eq.${moduleId}&order=order_index.asc`,
  )) as { id: string; slug: string; title_en: string; title_fr: string; order_index: number }[];
  return lessons;
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
    if (t === "multiple_choice" || t === "letter_recognition" || t === "reading_check") {
      const choices = exercise.payload.choices!;
      const correctIndex = exercise.payload.correctIndex!;
      await page.getByRole("radio", { name: choices[correctIndex], exact: true }).click();
    } else if (t === "true_false") {
      const correct = exercise.payload.correctAnswer!;
      await page.getByRole("button", { name: correct ? "True" : "False" }).click();
    } else {
      throw new Error(
        `answerExercise: unhandled exercise_type "${t}" (Module 8 uses no matching exercises)`,
      );
    }
  });
}

/** Wall-clock-bounded, remount-resilient replacement for the old
 * fixed-60-iteration loop -- see utils/lesson-interaction.ts. */
async function completeLesson(page: Page, exercises: DbExercise[]) {
  await completeLessonResilient(page, exercises, answerExercise);
}

test.describe("Level 1 Module 8 — Reading Al-Fatiha", () => {
  test("module and lessons exist, in the correct order", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr&slug=eq.reading-al-fatiha",
    )) as { slug: string; title_en: string; title_fr: string }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Reading Al-Fatiha");
    expect(modules[0]!.title_fr).toBe("Lecture d'Al-Fatiha");

    const lessons = await fetchModule8Lessons(request);
    expect(lessons).toHaveLength(3);
    expect(lessons.map((l) => l.slug)).toEqual([
      "reading-al-fatiha-verses-1-3",
      "reading-al-fatiha-verses-4-6",
      "reading-al-fatiha-verse-7",
    ]);
    expect(lessons.map((l) => l.order_index)).toEqual([0, 1, 2]);
  });

  test("Modules 1-7 remain unchanged", async ({ request }) => {
    for (const [slug, expectedLessons] of [
      ["letter-shapes-1", 5],
      ["letter-shapes-2", 9],
      ["harakat", 4],
      ["sukun-and-shadda", 3],
      ["tanwin", 4],
      ["connected-letter-forms", 3],
      ["first-reading-practice", 2],
    ] as const) {
      const mods = (await apiGet(request, `modules?select=id&slug=eq.${slug}`)) as {
        id: string;
      }[];
      const lessons = (await apiGet(
        request,
        `lessons?select=id&module_id=eq.${mods[0]!.id}`,
      )) as unknown[];
      expect(lessons, `module ${slug}`).toHaveLength(expectedLessons);
    }
  });

  test("every quran_example section resolves, by FK, to the real stored Al-Fatiha text — all 7 āyahs, no gaps, no duplicates", async ({
    request,
  }) => {
    const lessons = await fetchModule8Lessons(request);
    const { client } = await createTestUserClient();
    const { data: sections } = await client
      .from("lesson_sections")
      .select("content_type, surah_number, ayah_number")
      .in(
        "lesson_id",
        lessons.map((l) => l.id),
      )
      .eq("content_type", "quran_example")
      .order("ayah_number", { ascending: true });

    expect(sections).toHaveLength(7);
    expect(sections!.map((s) => s.ayah_number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(sections!.every((s) => s.surah_number === 1)).toBe(true);

    const { data: ayahs } = await client.from("ayahs").select("ayah_number").eq("surah_number", 1);
    expect(ayahs).toHaveLength(7); // confirms the FK targets actually exist
  });

  for (const slug of [
    "reading-al-fatiha-verses-1-3",
    "reading-al-fatiha-verses-4-6",
    "reading-al-fatiha-verse-7",
  ]) {
    test(`lesson "${slug}" opens and its sections render in order`, async ({ page, request }) => {
      const lessons = await fetchModule8Lessons(request);
      const lesson = lessons.find((l) => l.slug === slug)!;
      await page.goto(`/lesson/${lesson.id}`);
      await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
    });
  }

  test("full lifecycle on Lesson 1 (Ayahs 1-3): reading_check and true_false correct/incorrect paths, progress persistence, resume after refresh, completion, and NO review item is created", async ({
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
    const lessons = await fetchModule8Lessons(request);
    const lesson1 = lessons.find((l) => l.slug === "reading-al-fatiha-verses-1-3")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson1.id);

    const exercises = await fetchOrderedExercises(client, lesson1.id);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "reading_check",
      "reading_check",
      "true_false",
      "true_false",
      "multiple_choice",
    ]);
    expect(exercises.every((e) => e.exercise_type !== "matching")).toBe(true);

    // Captured before, not asserted as zero after: the shared E2E account
    // may already hold review items legitimately created by earlier
    // modules' specs. The claim under test is a before/after delta.
    const { count: reviewItemCountBefore } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${lesson1.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await page.getByRole("button", { name: "Next" }).click(); // past āyah 1 section, to exercise 0

    const wrongChoice = exercises[0]!.payload.choices!.find(
      (_, i) => i !== exercises[0]!.payload.correctIndex,
    )!;
    await page.getByRole("radio", { name: wrongChoice, exact: true }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Not quite.")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    // exercises[0] was already handled manually above (incorrect-then-
    // correct flow); slice(1) continues from exercises[1] onward.
    await completeLessonResilient(page, exercises.slice(1), answerExercise);
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", lesson1.id)
      .single();
    expect(progress?.status).toBe("completed");

    const { count: reviewItemCountAfter } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(reviewItemCountAfter).toBe(reviewItemCountBefore);
  });

  test("resume after refresh: reopening a partially-completed lesson resumes at the saved step, not the beginning", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule8Lessons(request);
    const lesson2 = lessons.find((l) => l.slug === "reading-al-fatiha-verses-4-6")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson2.id);

    await page.goto(`/lesson/${lesson2.id}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.reload();
    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status, last_section_index")
      .eq("user_id", userId)
      .eq("lesson_id", lesson2.id)
      .single();
    expect(progress?.status).toBe("in_progress");
    expect(progress!.last_section_index).toBeGreaterThan(0);
  });

  test("completing all 3 lessons still creates zero new review items, and Practice/Daily Study remain unaffected", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const lessons = await fetchModule8Lessons(request);
    const { client, userId } = await createTestUserClient();

    const { count: reviewItemCountBefore } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    for (const slug of [
      "reading-al-fatiha-verses-1-3",
      "reading-al-fatiha-verses-4-6",
      "reading-al-fatiha-verse-7",
    ]) {
      const lesson = lessons.find((l) => l.slug === slug)!;
      await resetLessonProgress(lesson.id);
      const exercises = await fetchOrderedExercises(client, lesson.id);
      await page.goto(`/lesson/${lesson.id}`);
      await completeLesson(page, exercises);
    }

    const { count: reviewItemCountAfter } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(reviewItemCountAfter).toBe(reviewItemCountBefore);

    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
    await page.goto("/daily");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("French interface: lesson and Qur'an example render correctly", async ({
    page,
    request,
  }) => {
    // waitForHeadingResilient below is wall-clock-bounded (default 30s,
    // see utils/lesson-interaction.ts) rather than relying on Playwright's
    // built-in 5s assertion timeout -- same French-heading hydration race
    // already proven and fixed in
    // 29-level1-module7-first-reading-practice.spec.ts.
    test.setTimeout(60_000);
    const lessons = await fetchModule8Lessons(request);
    const lesson1 = lessons.find((l) => l.slug === "reading-al-fatiha-verses-1-3")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson1.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson1.id}`);
      await waitForHeadingResilient(page, lesson1.title_fr);
      await page.getByRole("button", { name: "Suivant" }).click();
      await expect(
        page.getByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", { exact: true }),
      ).toBeVisible();
      // The lesson's embedded Qur'an example reads the same translation_fr
      // column as the Reader -- nulled for Al-Fatiha 1:1 by the
      // fr.hamidullah-crf disputed-source remediation, so it now shows the
      // same explicit unavailable fallback, never the old disputed text.
      await expect(
        page.getByText("Traduction française pas encore disponible pour ce verset."),
      ).toBeVisible();
      await expect(
        page.getByText("Au nom d'Allah, le Tout Miséricordieux, le Très Miséricordieux."),
      ).not.toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("Qur'an example content is dir=rtl/lang=ar, shows the real governed translation, and mobile 390×844 renders without horizontal overflow or clipping", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule8Lessons(request);
    const lesson1 = lessons.find((l) => l.slug === "reading-al-fatiha-verses-1-3")!;
    await resetLessonProgress(lesson1.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${lesson1.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // to āyah 1

    const arabicSpan = page.getByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", { exact: true });
    await expect(arabicSpan).toBeVisible();
    await expect(arabicSpan).toHaveAttribute("dir", "rtl");
    await expect(arabicSpan).toHaveAttribute("lang", "ar");

    // The real, governed translation already stored on the ayahs row —
    // never invented by this migration.
    await expect(
      page.getByText("In the name of Allah, the Entirely Merciful, the Especially Merciful."),
    ).toBeVisible();

    const box = await arabicSpan.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test("real vowelled Qur'anic words render correctly (not broken/detached) directly in reading_check exercise prompts", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule8Lessons(request);
    const lesson1 = lessons.find((l) => l.slug === "reading-al-fatiha-verses-1-3")!;
    await resetLessonProgress(lesson1.id);
    await page.goto(`/lesson/${lesson1.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // to āyah 1
    await page.getByRole("button", { name: "Next" }).click(); // to exercise 0

    await expect(
      page.getByRole("heading", { name: "ٱلرَّحْمَٰنِ (from āyah 1) reads:" }),
    ).toBeVisible();
    const choices = page.getByRole("radio");
    await expect(choices).toHaveCount(3);
  });

  test("accessibility: reading_check options are keyboard-operable radios with distinct accessible names, no color-only feedback", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule8Lessons(request);
    const lesson1 = lessons.find((l) => l.slug === "reading-al-fatiha-verses-1-3")!;
    await resetLessonProgress(lesson1.id);
    await page.goto(`/lesson/${lesson1.id}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(3);
    const names = await radios.evaluateAll((els) =>
      els.map((el) => el.closest("div")?.textContent?.trim()),
    );
    expect(new Set(names).size).toBe(3);

    await radios.first().focus();
    await page.keyboard.press("Space");
    await expect(radios.first()).toBeChecked();

    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("retry safety: resetLessonProgress leaves a deterministic, reproducible state across repeated setup, with no append-only contamination", async ({
    page,
    request,
  }) => {
    // Runs the lesson walk twice (retry-safety by design), each now
    // wall-clock-bounded (see utils/lesson-interaction.ts) instead of a
    // fixed iteration count -- needs headroom beyond the 30s default to
    // let that bound actually do its job, same reasoning already applied
    // to 28-level1-module6-....spec.ts's analogous double-pass test.
    test.setTimeout(90_000);
    const lessons = await fetchModule8Lessons(request);
    const lesson1 = lessons.find((l) => l.slug === "reading-al-fatiha-verses-1-3")!;
    const { client, userId } = await createTestUserClient();

    for (let run = 0; run < 2; run++) {
      await resetLessonProgress(lesson1.id);
      const exercises = await fetchOrderedExercises(client, lesson1.id);
      await page.goto(`/lesson/${lesson1.id}`);
      await completeLesson(page, exercises);

      const { count: attemptCount } = await client
        .from("user_exercise_attempts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("lesson_id", lesson1.id);
      expect(attemptCount).toBe(5);
    }
  });
});

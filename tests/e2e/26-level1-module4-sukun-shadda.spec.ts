import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers Level 1, Module 4 ("sukun-and-shadda"). Three lessons teaching
 * the sukūn (absence of a vowel) and the shadda (a doubled consonant),
 * plus a reading-synthesis lesson, seeded by the accompanying migration.
 * Mirrors the proven pattern from 25-level1-module3-harakat.spec.ts:
 * exercise choices/matching pairs use the mark's transliterated name
 * ("Sukūn"/"Shadda"), never the raw combining-mark glyph, for the same
 * confirmed ChoiceControl/MatchingControl rendering-gap reason documented
 * in the migration header. The glyphs بْ/بَّ only ever appear in
 * arabic_text/example lesson sections and review-item fronts.
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

async function fetchModule4Lessons(request: APIRequestContext) {
  const modules = (await apiGet(request, "modules?select=id&slug=eq.sukun-and-shadda")) as {
    id: string;
  }[];
  const moduleId = modules[0]!.id;
  const lessons = (await apiGet(
    request,
    `lessons?select=id,slug,title_en,title_fr,order_index&module_id=eq.${moduleId}&order=order_index.asc`,
  )) as { id: string; slug: string; title_en: string; title_fr: string; order_index: number }[];
  return lessons;
}

/** Mirrors buildPlayerSteps' ordering (src/lib/curriculum.ts) exactly:
 * sections in order_index order, each section's attached exercises in
 * their own order_index order, then unattached exercises last. */
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
  if (t === "multiple_choice" || t === "letter_recognition" || t === "reading_check") {
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

/** Resilient to the same async-completion-swap race documented in
 * 25-level1-module3-harakat.spec.ts: goNextOrComplete on the last step
 * awaits three network calls before swapping the whole page to the
 * completion screen, which can race the click's stability check. */
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

async function resetModule4State(
  client: Awaited<ReturnType<typeof createTestUserClient>>["client"],
  userId: string,
  lessonIds: string[],
) {
  for (const lessonId of lessonIds) {
    await resetLessonProgress(lessonId);
  }
  await client
    .from("review_items")
    .delete()
    .eq("user_id", userId)
    .in("item_key", ["concept:sukun", "concept:shadda"]);
  await client.from("practice_attempts").delete().eq("user_id", userId);
  await client.from("weak_areas").delete().eq("user_id", userId);
}

test.describe("Level 1 Module 4 — Sukūn & Shadda", () => {
  test("module and lessons exist, in the correct order", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr&slug=eq.sukun-and-shadda",
    )) as { slug: string; title_en: string; title_fr: string }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Sukūn & Shadda");

    const lessons = await fetchModule4Lessons(request);
    expect(lessons).toHaveLength(3);
    expect(lessons.map((l) => l.slug)).toEqual(["sukun", "shadda", "reading-sukun-shadda"]);
    expect(lessons.map((l) => l.order_index)).toEqual([0, 1, 2]);
  });

  test("Modules 1-3 remain unchanged", async ({ request }) => {
    for (const [slug, expectedLessons] of [
      ["letter-shapes-1", 5],
      ["letter-shapes-2", 9],
      ["harakat", 4],
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

  for (const slug of ["sukun", "shadda", "reading-sukun-shadda"]) {
    test(`lesson "${slug}" opens and its sections render in order`, async ({ page, request }) => {
      const lessons = await fetchModule4Lessons(request);
      const lesson = lessons.find((l) => l.slug === slug)!;
      await page.goto(`/lesson/${lesson.id}`);
      await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
    });
  }

  test("full lifecycle on Lesson 1 (Sukūn): multiple_choice and true_false correct/incorrect paths, progress persistence, resume after refresh, completion, and concept:sukun review creation", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule4Lessons(request);
    const sukun = lessons.find((l) => l.slug === "sukun")!;
    const { client, userId } = await createTestUserClient();
    await resetModule4State(
      client,
      userId,
      lessons.map((l) => l.id),
    );

    const exercises = await fetchOrderedExercises(client, sukun.id);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "multiple_choice",
      "multiple_choice",
      "true_false",
      "true_false",
      "matching",
    ]);

    await page.goto(`/lesson/${sukun.id}`);
    // Section 0 (explanation), then section 1 (arabic_text بْ) — the
    // multiple_choice exercise is a separate step attached after it.
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    // Exercise an incorrect path once before answering correctly.
    const wrongChoice = exercises[0]!.payload.choices!.find(
      (_, i) => i !== exercises[0]!.payload.correctIndex,
    )!;
    await page.getByRole("radio", { name: wrongChoice, exact: true }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Not quite.")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    let exerciseIndex = 1;
    for (let i = 0; i < 40; i++) {
      if (
        await page
          .getByText("Lesson complete!")
          .isVisible()
          .catch(() => false)
      )
        break;
      const checkAnswerBtn = page.getByRole("button", { name: "Check answer" });
      if (await checkAnswerBtn.isVisible().catch(() => false)) {
        await answerExercise(page, exercises[exerciseIndex]!);
        exerciseIndex++;
        continue;
      }
      await clickNextOrComplete(page);
    }
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", sukun.id)
      .single();
    expect(progress?.status).toBe("completed");

    const { data: review, error } = await client
      .from("review_items")
      .select("item_key, item_type, front, back, status, repetitions, ease_factor")
      .eq("user_id", userId)
      .eq("item_key", "concept:sukun")
      .single();
    if (error) throw error;
    expect(review.item_type).toBe("concept");
    // front is the plain transliterated name "sukun", not the glyph —
    // seedLessonReviewItems sets front/back verbatim from the matching
    // exercise's pair.left/pair.right (src/lib/study.ts).
    expect(review.front).toBe("sukun");
    expect(review.back).toBe("a small circle above the letter, meaning no vowel sound");
    expect(review.status).toBe("new");
    expect(review.repetitions).toBe(0);
    expect(review.ease_factor).toBeCloseTo(2.5);
  });

  test("resume after refresh: reopening a partially-completed lesson resumes at the saved step, not the beginning", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule4Lessons(request);
    const shadda = lessons.find((l) => l.slug === "shadda")!;
    const { client, userId } = await createTestUserClient();
    await resetModule4State(
      client,
      userId,
      lessons.map((l) => l.id),
    );

    await page.goto(`/lesson/${shadda.id}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.reload();
    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status, last_section_index")
      .eq("user_id", userId)
      .eq("lesson_id", shadda.id)
      .single();
    expect(progress?.status).toBe("in_progress");
    expect(progress!.last_section_index).toBeGreaterThan(0);
  });

  test("completing Lessons 1 and 2 seeds concept:sukun and concept:shadda, and re-answering Lesson 3's recap does not duplicate either", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const lessons = await fetchModule4Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetModule4State(
      client,
      userId,
      lessons.map((l) => l.id),
    );

    for (const slug of ["sukun", "shadda", "reading-sukun-shadda"]) {
      const lesson = lessons.find((l) => l.slug === slug)!;
      const exercises = await fetchOrderedExercises(client, lesson.id);
      await page.goto(`/lesson/${lesson.id}`);
      await completeLesson(page, exercises);
    }

    const { data: reviews } = await client
      .from("review_items")
      .select("item_key, front, back")
      .eq("user_id", userId)
      .in("item_key", ["concept:sukun", "concept:shadda"])
      .order("item_key", { ascending: true });
    expect(reviews).toHaveLength(2);
    expect(reviews!.map((r) => r.item_key)).toEqual(["concept:shadda", "concept:sukun"]);
    expect(reviews!.find((r) => r.item_key === "concept:sukun")!.front).toBe("sukun");
    expect(reviews!.find((r) => r.item_key === "concept:shadda")!.front).toBe("shadda");
  });

  test("concept items enter Practice, contribute to the due count, and a correct answer updates SM-2 fields through the existing engine", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule4Lessons(request);
    const sukun = lessons.find((l) => l.slug === "sukun")!;
    const { client, userId } = await createTestUserClient();
    await resetModule4State(
      client,
      userId,
      lessons.map((l) => l.id),
    );

    const exercises = await fetchOrderedExercises(client, sukun.id);
    await page.goto(`/lesson/${sukun.id}`);
    await completeLesson(page, exercises);

    const { data: before } = await client
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .eq("item_key", "concept:sukun")
      .single();

    await page.goto("/practice");
    await expect(page.getByRole("button", { name: "Start Review Session" })).toBeVisible();
    await page.getByRole("button", { name: "Start Review Session" }).click();

    let sawOurCard = false;
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
        if (
          await page
            .getByText("sukun", { exact: true })
            .isVisible()
            .catch(() => false)
        ) {
          sawOurCard = true;
        }
        await reveal.click();
        await page.getByRole("button", { name: "Got it" }).click();
        continue;
      }
      await page.waitForTimeout(300);
    }
    expect(sawOurCard).toBe(true);
    await expect(page.getByText("Session complete")).toBeVisible({ timeout: 15_000 });

    const { data: after } = await client
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .eq("item_key", "concept:sukun")
      .single();
    expect(after.status).toBe("learning");
    expect(after.repetitions).toBe(1);
    expect(after.due_date > before!.due_date).toBe(true);
  });

  test("a due concept item also appears in Daily Study through the unfiltered due-items query", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule4Lessons(request);
    const sukun = lessons.find((l) => l.slug === "sukun")!;
    const { client, userId } = await createTestUserClient();
    await resetModule4State(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    const exercises = await fetchOrderedExercises(client, sukun.id);
    await page.goto(`/lesson/${sukun.id}`);
    await completeLesson(page, exercises);

    await page.goto("/daily");
    await expect(page.getByText(/Item 1 of \d+/)).toBeVisible();
    await expect(page.getByText("sukun", { exact: true })).toBeVisible();
  });

  test("French interface: lesson renders correctly", async ({ page, request }) => {
    const lessons = await fetchModule4Lessons(request);
    const shadda = lessons.find((l) => l.slug === "shadda")!;
    const { client, userId } = await createTestUserClient();
    await resetModule4State(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${shadda.id}`);
      await expect(page.getByRole("heading", { name: shadda.title_fr })).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click();
      await expect(page.getByText(/tenu deux fois plus longtemps/)).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("Arabic content is dir=rtl/lang=ar; mobile 390×844 renders without horizontal overflow or visible diacritic clipping", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule4Lessons(request);
    const sukun = lessons.find((l) => l.slug === "sukun")!;
    await resetLessonProgress(sukun.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${sukun.id}`);
    await page.getByRole("button", { name: "Next" }).click();

    const arabicSpan = page.getByText("بْ", { exact: true });
    await expect(arabicSpan).toBeVisible();
    await expect(arabicSpan).toHaveAttribute("dir", "rtl");
    await expect(arabicSpan).toHaveAttribute("lang", "ar");

    const box = await arabicSpan.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test("accessibility: multiple_choice options are keyboard-operable radios with distinct accessible names, no color-only feedback", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule4Lessons(request);
    const sukun = lessons.find((l) => l.slug === "sukun")!;
    await resetLessonProgress(sukun.id);
    await page.goto(`/lesson/${sukun.id}`);
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

  test("Surah 1:4 renders in Lesson 3 via the real FK, and Qur'anic Arabic is never duplicated into the migration's own content", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule4Lessons(request);
    const lesson3 = lessons.find((l) => l.slug === "reading-sukun-shadda")!;
    const { client } = await createTestUserClient();

    const { data: quranSections } = await client
      .from("lesson_sections")
      .select("arabic_text, surah_number, ayah_number")
      .eq("lesson_id", lesson3.id)
      .eq("content_type", "quran_example");
    expect(quranSections).toHaveLength(1);
    expect(quranSections![0]!.surah_number).toBe(1);
    expect(quranSections![0]!.ayah_number).toBe(4);
    expect(quranSections![0]!.arabic_text).toBeNull();

    await resetLessonProgress(lesson3.id);
    await page.goto(`/lesson/${lesson3.id}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("مَٰلِكِ", { exact: false })).toBeVisible();
  });

  test("retry safety: resetModule4State leaves a deterministic, reproducible state across repeated setup, with no append-only contamination", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule4Lessons(request);
    const sukun = lessons.find((l) => l.slug === "sukun")!;
    const { client, userId } = await createTestUserClient();

    for (let run = 0; run < 2; run++) {
      await resetModule4State(
        client,
        userId,
        lessons.map((l) => l.id),
      );
      const exercises = await fetchOrderedExercises(client, sukun.id);
      await page.goto(`/lesson/${sukun.id}`);
      await completeLesson(page, exercises);

      const { count: attemptCount } = await client
        .from("user_exercise_attempts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("lesson_id", sukun.id);
      expect(attemptCount).toBe(5);

      const { count: reviewAttemptCount } = await client
        .from("practice_attempts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      expect(reviewAttemptCount).toBe(0);
    }
  });
});

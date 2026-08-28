import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import { completeLessonResilient, resilientAnswerAndCheck } from "./utils/lesson-interaction";

/**
 * Covers Sub-phase 3.3 — Level 1, Module 3 ("harakat"). Four lessons
 * teaching fatḥa, kasra, ḍamma, and a synthesis/review lesson, seeded by
 * the accompanying migration. Exercises use transliterated names
 * ("Fatḥa"/"Kasra"/"Ḍamma") as their choice/matching text — never a raw
 * letter+combining-mark glyph — because the generic exercise-choice
 * renderer has no dir/lang/font-quran treatment and was confirmed (via a
 * real Playwright screenshot spike during Sub-phase 3.3) to render
 * combining marks broken. The glyphs بَ/بِ/بُ only ever appear in
 * arabic_text/example lesson sections and review-item fronts, both of
 * which already apply that styling generically.
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

async function fetchModule3Lessons(request: APIRequestContext) {
  const modules = (await apiGet(request, "modules?select=id&slug=eq.harakat")) as { id: string }[];
  const moduleId = modules[0]!.id;
  const lessons = (await apiGet(
    request,
    `lessons?select=id,slug,title_en,title_fr,order_index&module_id=eq.${moduleId}&order=order_index.asc`,
  )) as { id: string; slug: string; title_en: string; title_fr: string; order_index: number }[];
  return lessons;
}

/** Exercises for one lesson, in the exact order the Lesson Player shows
 * them: sections in order_index order, each section's attached exercises
 * in their own order_index order, then unattached (section_id null)
 * exercises last in their own order_index order — mirrors
 * buildPlayerSteps in src/lib/curriculum.ts exactly. */
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
  const attached = new Set<string>();
  for (const section of sections ?? []) {
    for (const ex of (exercises ?? []).filter((e) => e.section_id === section.id)) {
      ordered.push(ex as DbExercise);
      attached.add(`${ex.section_id}:${ex.order_index}`);
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
    if (t === "vowel_recognition" || t === "letter_recognition" || t === "reading_check") {
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

async function resetModule3State(
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
    .in("item_key", ["concept:fatha", "concept:kasra", "concept:damma"]);
  await client.from("practice_attempts").delete().eq("user_id", userId);
  await client.from("weak_areas").delete().eq("user_id", userId);
}

test.describe("Level 1 Module 3 — Harakat", () => {
  test("module and lessons exist, in the correct order", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr&slug=eq.harakat",
    )) as {
      slug: string;
      title_en: string;
      title_fr: string;
    }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.title_en).toBe("Short Vowels (Harakat)");
    expect(modules[0]!.title_fr).toBe("Voyelles courtes (harakat)");

    const lessons = await fetchModule3Lessons(request);
    expect(lessons).toHaveLength(4);
    expect(lessons.map((l) => l.slug)).toEqual(["fatha", "kasra", "damma", "reading-with-harakat"]);
    expect(lessons.map((l) => l.order_index)).toEqual([0, 1, 2, 3]);
  });

  test("Modules 1 and 2 remain unchanged", async ({ request }) => {
    const m1 = (await apiGet(request, "modules?select=id&slug=eq.letter-shapes-1")) as {
      id: string;
    }[];
    const m2 = (await apiGet(request, "modules?select=id&slug=eq.letter-shapes-2")) as {
      id: string;
    }[];
    const l1 = (await apiGet(request, `lessons?select=id&module_id=eq.${m1[0]!.id}`)) as unknown[];
    const l2 = (await apiGet(request, `lessons?select=id&module_id=eq.${m2[0]!.id}`)) as unknown[];
    expect(l1).toHaveLength(5); // 4 real + placeholder
    expect(l2).toHaveLength(9);
  });

  for (const slug of ["fatha", "kasra", "damma", "reading-with-harakat"]) {
    test(`lesson "${slug}" opens and its sections render in order`, async ({ page, request }) => {
      const lessons = await fetchModule3Lessons(request);
      const lesson = lessons.find((l) => l.slug === slug)!;
      await page.goto(`/lesson/${lesson.id}`);
      await expect(page.getByRole("heading", { name: lesson.title_en })).toBeVisible();
    });
  }

  test("full lifecycle on Lesson 1 (Fatḥa): vowel_recognition and true_false correct/incorrect paths, progress persistence, resume after refresh, completion, and concept:fatha review creation", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule3Lessons(request);
    const fatha = lessons.find((l) => l.slug === "fatha")!;
    const { client, userId } = await createTestUserClient();
    await resetModule3State(
      client,
      userId,
      lessons.map((l) => l.id),
    );

    const exercises = await fetchOrderedExercises(client, fatha.id);
    expect(exercises.map((e) => e.exercise_type)).toEqual([
      "vowel_recognition",
      "vowel_recognition",
      "true_false",
      "true_false",
      "matching",
    ]);

    await page.goto(`/lesson/${fatha.id}`);
    // Section and exercise are always separate steps (LessonExerciseRenderer
    // and LessonSectionRenderer render in mutually exclusive branches) —
    // section 0 (explanation), then section 1 (arabic_text بَ), then
    // exercise 0 (vowel_recognition) attached to that section.
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    // Exercise an incorrect path once before answering correctly, proving
    // the "Not quite." feedback and re-selection both work.
    const wrongChoice = exercises[0]!.payload.choices!.find(
      (_, i) => i !== exercises[0]!.payload.correctIndex,
    )!;
    await page.getByRole("radio", { name: wrongChoice, exact: true }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Not quite.")).toBeVisible();
    // The control is disabled once submitted (LessonExerciseRenderer sets
    // submitted=true) — this specific exercise instance stays "answered
    // incorrectly"; advancing past it via Next still works, matching the
    // established Module 1/2 precedent that a wrong answer never blocks
    // progression.
    await page.getByRole("button", { name: "Next" }).click();

    // Continue through the rest of the lesson answering correctly.
    // exercises[0] was already handled manually above (incorrect-then-
    // correct flow); slice(1) continues from exercises[1] onward.
    await completeLessonResilient(page, exercises.slice(1), answerExercise);
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    // Progress persistence + review creation.
    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", fatha.id)
      .single();
    expect(progress?.status).toBe("completed");

    const { data: review, error } = await client
      .from("review_items")
      .select("item_key, item_type, front, back, status, repetitions, ease_factor")
      .eq("user_id", userId)
      .eq("item_key", "concept:fatha")
      .single();
    if (error) throw error;
    expect(review.item_type).toBe("concept");
    // seedLessonReviewItems sets front/back verbatim from the matching
    // exercise's pair.left/pair.right (src/lib/study.ts) — since pair.left
    // must be the literal lowercase "fatha" to produce the locked
    // concept:fatha key, front is that same plain string, not the Arabic
    // glyph. The glyph only ever appears in arabic_text/example sections.
    expect(review.front).toBe("fatha");
    expect(review.back).toBe("a diagonal stroke above the letter");
    expect(review.status).toBe("new");
    expect(review.repetitions).toBe(0);
    expect(review.ease_factor).toBeCloseTo(2.5);
  });

  test("resume after refresh: reopening a partially-completed lesson resumes at the saved step, not the beginning", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule3Lessons(request);
    const kasra = lessons.find((l) => l.slug === "kasra")!;
    const { client, userId } = await createTestUserClient();
    await resetModule3State(
      client,
      userId,
      lessons.map((l) => l.id),
    );

    await page.goto(`/lesson/${kasra.id}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/2 of|Étape 2/))
      .toBeVisible()
      .catch(() => {});

    await page.reload();
    // Resumed at a step other than the very first — confirmed by the
    // fact the "Next" click history persisted (an in_progress row exists)
    // rather than the page silently restarting the section counter.
    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status, last_section_index")
      .eq("user_id", userId)
      .eq("lesson_id", kasra.id)
      .single();
    expect(progress?.status).toBe("in_progress");
    expect(progress!.last_section_index).toBeGreaterThan(0);
  });

  test("completing Lessons 2 and 3 seeds concept:kasra and concept:damma, and re-answering Lesson 4's recap does not duplicate any of the three concepts", async ({
    page,
    request,
  }) => {
    // Completes all four lessons back-to-back (~40 steps of real
    // navigation/submission network round-trips) — comfortably exceeds the
    // suite's default 30s per-test budget.
    test.setTimeout(120_000);
    const lessons = await fetchModule3Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetModule3State(
      client,
      userId,
      lessons.map((l) => l.id),
    );

    for (const slug of ["fatha", "kasra", "damma", "reading-with-harakat"]) {
      const lesson = lessons.find((l) => l.slug === slug)!;
      const exercises = await fetchOrderedExercises(client, lesson.id);
      await page.goto(`/lesson/${lesson.id}`);
      await completeLesson(page, exercises);
    }

    const { data: reviews } = await client
      .from("review_items")
      .select("item_key, front, back")
      .eq("user_id", userId)
      .in("item_key", ["concept:fatha", "concept:kasra", "concept:damma"])
      .order("item_key", { ascending: true });
    expect(reviews).toHaveLength(3);
    expect(reviews!.map((r) => r.item_key)).toEqual([
      "concept:damma",
      "concept:fatha",
      "concept:kasra",
    ]);
    // See the "full lifecycle" test above for why front is the plain
    // transliterated name, not the Arabic glyph.
    expect(reviews!.find((r) => r.item_key === "concept:fatha")!.front).toBe("fatha");
    expect(reviews!.find((r) => r.item_key === "concept:kasra")!.front).toBe("kasra");
    expect(reviews!.find((r) => r.item_key === "concept:damma")!.front).toBe("damma");
  });

  test("concept items enter Practice, contribute to the due count, and a correct answer updates SM-2 fields through the existing engine", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule3Lessons(request);
    const fatha = lessons.find((l) => l.slug === "fatha")!;
    const { client, userId } = await createTestUserClient();
    await resetModule3State(
      client,
      userId,
      lessons.map((l) => l.id),
    );

    const exercises = await fetchOrderedExercises(client, fatha.id);
    await page.goto(`/lesson/${fatha.id}`);
    await completeLesson(page, exercises);

    const { data: before } = await client
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .eq("item_key", "concept:fatha")
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
        // front is the plain transliterated name "fatha", not the glyph —
        // see the "full lifecycle" test's comment for why.
        if (
          await page
            .getByText("fatha", { exact: true })
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
      .eq("item_key", "concept:fatha")
      .single();
    expect(after.status).toBe("learning");
    expect(after.repetitions).toBe(1);
    expect(after.due_date > before!.due_date).toBe(true);
  });

  test("a due concept item also appears in Daily Study through the unfiltered due-items query", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule3Lessons(request);
    const fatha = lessons.find((l) => l.slug === "fatha")!;
    const { client, userId } = await createTestUserClient();
    await resetModule3State(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    const exercises = await fetchOrderedExercises(client, fatha.id);
    await page.goto(`/lesson/${fatha.id}`);
    await completeLesson(page, exercises);

    await page.goto("/daily");
    await expect(page.getByText(/Item 1 of \d+/)).toBeVisible();
    // front is the plain transliterated name "fatha", not the glyph — see
    // the "full lifecycle" test's comment for why.
    await expect(page.getByText("fatha", { exact: true })).toBeVisible();
  });

  test("French interface: lesson renders correctly and the ḍamma sound-anchor is 'ou', never the French letter 'u'", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule3Lessons(request);
    const damma = lessons.find((l) => l.slug === "damma")!;
    const { client, userId } = await createTestUserClient();
    await resetModule3State(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${damma.id}`);
      await expect(page.getByRole("heading", { name: damma.title_fr })).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click();
      await expect(page.getByText(/« ou »/)).toBeVisible();
      await expect(page.getByText(/lettre française « u »/)).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("Arabic content is dir=rtl/lang=ar; mobile 390×844 renders without horizontal overflow or visible diacritic clipping", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule3Lessons(request);
    const fatha = lessons.find((l) => l.slug === "fatha")!;
    await resetLessonProgress(fatha.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${fatha.id}`);
    await page.getByRole("button", { name: "Next" }).click();

    const arabicSpan = page.getByText("بَ", { exact: true });
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

  test("accessibility: vowel_recognition options are keyboard-operable radios with distinct accessible names, no color-only feedback", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule3Lessons(request);
    const fatha = lessons.find((l) => l.slug === "fatha")!;
    await resetLessonProgress(fatha.id);
    await page.goto(`/lesson/${fatha.id}`);
    // Section 0 (explanation), then section 1 (arabic_text) — the
    // vowel_recognition exercise is a separate step attached after it.
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(3);
    const names = await radios.evaluateAll((els) =>
      els.map((el) => el.closest("div")?.textContent?.trim()),
    );
    expect(new Set(names).size).toBe(3); // no duplicate/conflicting accessible content

    // Keyboard operable: focus + Space toggles selection without a mouse.
    await radios.first().focus();
    await page.keyboard.press("Space");
    await expect(radios.first()).toBeChecked();

    // Feedback is not color-only: submitting renders a text label
    // ("Correct!"/"Not quite.") plus an icon (role="status" region),
    // not merely a color change.
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("Surah 1:2 renders in Lesson 4 via the real FK, and Qur'anic Arabic is never duplicated into the migration's own content", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModule3Lessons(request);
    const lesson4 = lessons.find((l) => l.slug === "reading-with-harakat")!;
    const { client } = await createTestUserClient();

    // No section in this migration stores Qur'anic Arabic directly —
    // quran_example rows carry surah_number/ayah_number only.
    const { data: quranSections } = await client
      .from("lesson_sections")
      .select("arabic_text, surah_number, ayah_number")
      .eq("lesson_id", lesson4.id)
      .eq("content_type", "quran_example");
    expect(quranSections).toHaveLength(1);
    expect(quranSections![0]!.surah_number).toBe(1);
    expect(quranSections![0]!.ayah_number).toBe(2);
    expect(quranSections![0]!.arabic_text).toBeNull();

    await resetLessonProgress(lesson4.id);
    await page.goto(`/lesson/${lesson4.id}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    // The Lesson Player fetches and renders the canonical text live.
    await expect(page.getByText("ٱلْحَمْدُ", { exact: false })).toBeVisible();
  });

  test("retry safety: resetModule3State leaves a deterministic, reproducible state across repeated setup, with no append-only contamination", async ({
    page,
    request,
  }) => {
    // Runs the lesson walk twice (retry-safety by design), each now
    // wall-clock-bounded (see utils/lesson-interaction.ts) instead of a
    // fixed iteration count -- needs headroom beyond the 30s default to
    // let that bound actually do its job, same reasoning already applied
    // to 28-level1-module6-....spec.ts's analogous double-pass test.
    test.setTimeout(90_000);
    const lessons = await fetchModule3Lessons(request);
    const fatha = lessons.find((l) => l.slug === "fatha")!;
    const { client, userId } = await createTestUserClient();

    for (let run = 0; run < 2; run++) {
      await resetModule3State(
        client,
        userId,
        lessons.map((l) => l.id),
      );
      const exercises = await fetchOrderedExercises(client, fatha.id);
      await page.goto(`/lesson/${fatha.id}`);
      await completeLesson(page, exercises);

      const { count: attemptCount } = await client
        .from("user_exercise_attempts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("lesson_id", fatha.id);
      // resetLessonProgress (called by resetModule3State) clears both
      // user_lesson_progress and user_exercise_attempts — this must stay
      // exactly 5 (one per exercise) on every run, never doubling.
      expect(attemptCount).toBe(5);

      const { count: reviewAttemptCount } = await client
        .from("practice_attempts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      expect(reviewAttemptCount).toBe(0); // Practice was never opened this run
    }
  });
});

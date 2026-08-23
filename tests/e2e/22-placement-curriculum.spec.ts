import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createTestUserClient } from "./utils/db";

/**
 * Covers Sub-phase 2.6 — placement -> curriculum integration. Verifies
 * that learning_path_steps.lesson_id (new, additive, nullable FK) points
 * the 'alphabet' step at a real Level 1 lesson — always the first
 * not-yet-completed one, regardless of placement level, since Level 1 is
 * the only real curriculum that exists and the placement test's own
 * letter-recognition coverage is too thin to safely skip it for any
 * scorer (see Sub-phase 2.6's own audit). Every other step's lesson_id
 * stays null: Modules 3-8 have no real content to link to.
 */

const CORRECT_INDEXES = [0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 1];
const QUESTION_COUNT = CORRECT_INDEXES.length;

/** Mirrors src/locales/{en,fr}/learning.ts — the whole placement flow
 * renders in the interface language active at the time it's driven, so a
 * French-session test cannot reuse the English button labels. */
const COPY = {
  en: {
    start: "Start the placement test",
    continue: "Continue",
    resultStep: "Your recommended starting point",
    startRecommended: "Start recommended course",
  },
  fr: {
    start: "Commencer le test de niveau",
    continue: "Continuer",
    resultStep: "Votre point de départ recommandé",
    startRecommended: "Commencer le parcours recommandé",
  },
} as const;

async function answerAll(
  page: Page,
  pickIndex: (correct: number, questionIndex: number) => number,
  locale: "en" | "fr" = "en",
) {
  const copy = COPY[locale];
  for (let i = 0; i < QUESTION_COUNT; i++) {
    const options = page.locator("main button[aria-pressed]");
    const isLast = i === QUESTION_COUNT - 1;
    const nextButton = page.getByRole("button", { name: isLast ? copy.resultStep : copy.continue });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await options.nth(pickIndex(CORRECT_INDEXES[i]!, i)).click();
      try {
        await expect(nextButton).toBeEnabled({ timeout: 2_000 });
        break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
    await nextButton.click();
  }
}

async function apiGet(request: APIRequestContext, path: string) {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const res = await request.get(`${url}/rest/v1/${path}`, { headers: { apikey: anonKey } });
  return res.json();
}

/** All real (non-placeholder) Level 1 lesson ids, in module/lesson order. */
async function fetchRealLevel1Lessons(request: APIRequestContext) {
  const modules = (await apiGet(
    request,
    "modules?select=id,order_index&slug=in.(letter-shapes-1,letter-shapes-2)&order=order_index.asc",
  )) as { id: string; order_index: number }[];
  const lessons: { id: string; slug: string; order_index: number; module_id: string }[] = [];
  for (const m of modules) {
    const rows = (await apiGet(
      request,
      `lessons?select=id,slug,order_index,module_id&module_id=eq.${m.id}&slug=neq.schema-validation-placeholder&order=order_index.asc`,
    )) as { id: string; slug: string; order_index: number; module_id: string }[];
    lessons.push(...rows);
  }
  return lessons;
}

/** Wipes progress for every real Level 1 lesson, so "first incomplete" is deterministic. */
async function resetAllLevel1Progress(request: APIRequestContext) {
  const { client, userId } = await createTestUserClient();
  const lessons = await fetchRealLevel1Lessons(request);
  await client
    .from("user_lesson_progress")
    .delete()
    .eq("user_id", userId)
    .in(
      "lesson_id",
      lessons.map((l) => l.id),
    );
  return lessons;
}

async function retakePlacement(
  page: Page,
  pickIndex: (correct: number, questionIndex: number) => number,
  locale: "en" | "fr" = "en",
) {
  const copy = COPY[locale];
  await page.goto("/placement");
  await page.getByRole("button", { name: copy.start }).click();
  await answerAll(page, pickIndex, locale);
  await page.getByRole("button", { name: copy.startRecommended }).click();
  await expect(page).toHaveURL(/\/learning-plan/, { timeout: 10_000 });
}

/** learning_paths/learning_path_steps are RLS-protected (owner-only), so
 * this must go through the authenticated test-user client, not the plain
 * apikey-only apiGet used for public curriculum tables. */
async function fetchAlphabetStep(client: SupabaseClient, userId: string) {
  const { data: path, error: pathError } = await client
    .from("learning_paths")
    .select("id")
    .eq("user_id", userId)
    .single();
  if (pathError) throw pathError;
  const { data: step, error: stepError } = await client
    .from("learning_path_steps")
    .select("id, step_key, status, progress, lesson_id")
    .eq("path_id", path.id)
    .eq("step_key", "alphabet")
    .single();
  if (stepError) throw stepError;
  return step;
}

test.describe("placement -> curriculum integration", () => {
  test("a zero-score placement maps the alphabet step to the first real Level 1 lesson (safe beginner entry point)", async ({
    page,
    request,
  }) => {
    const lessons = await resetAllLevel1Progress(request);
    await retakePlacement(page, (correct) => (correct + 1) % 4);

    const { client, userId } = await createTestUserClient();
    const step = await fetchAlphabetStep(client, userId);
    expect(step.status).toBe("available");
    expect(step.progress).toBe(0);
    expect(step.lesson_id).toBe(lessons[0]!.id);
  });

  test("a perfect-score placement maps to the SAME real entry point, per the approved conservative policy — it does not fabricate a Module 3-8 destination", async ({
    page,
    request,
  }) => {
    const lessons = await resetAllLevel1Progress(request);
    await retakePlacement(page, (correct) => correct);

    const { client, userId } = await createTestUserClient();
    const step = await fetchAlphabetStep(client, userId);
    // Even at "Intermediate Qur'anic Arabic," the entry point is still a
    // real Level 1 lesson: the placement test's 2 raw letter questions
    // cannot prove mastery of all 28 isolated letter shapes, and no
    // Module 3-8 content exists to send this learner to instead.
    expect(step.lesson_id).toBe(lessons[0]!.id);
    expect(step.status).toBe("available");
  });

  test("the alphabet step's lesson_id references a real row in lessons (deterministic linkage, not a guess)", async ({
    page,
    request,
  }) => {
    await resetAllLevel1Progress(request);
    await retakePlacement(page, (correct) => (correct + 1) % 4);

    const { client, userId } = await createTestUserClient();
    const step = await fetchAlphabetStep(client, userId);
    const lessonRows = (await apiGet(
      request,
      `lessons?select=id,slug&id=eq.${step.lesson_id}`,
    )) as { id: string; slug: string }[];
    expect(lessonRows).toHaveLength(1);
    expect(lessonRows[0]!.slug).toBe("alif-the-first-letter");
  });

  test("the learning-plan CTA opens the real linked lesson", async ({ page, request }) => {
    await resetAllLevel1Progress(request);
    await retakePlacement(page, (correct) => (correct + 1) % 4);

    await page.goto("/learning-plan");
    await expect(page.getByRole("heading", { name: "My learning path" })).toBeVisible();
    await page.getByRole("link", { name: "Start lesson" }).first().click();
    await expect(page).toHaveURL(/\/lesson\/[0-9a-f-]{36}/);
    await expect(
      page.getByRole("heading", { level: 1, name: "The First Letter: Alif" }),
    ).toBeVisible();
  });

  test("completing the linked lesson advances the recommendation to the next incomplete lesson, and does not force replay", async ({
    page,
    request,
  }) => {
    const lessons = await resetAllLevel1Progress(request);
    await retakePlacement(page, (correct) => (correct + 1) % 4);

    // Complete the first real lesson (Alif) directly.
    await page.goto(`/lesson/${lessons[0]!.id}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "ا" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "False" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Complete lesson" }).click();
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    // Retake placement so the path (and its lesson_id) recomputes against
    // this new completion — proving it advances, not that it replays.
    await retakePlacement(page, (correct) => (correct + 1) % 4);

    const { client, userId } = await createTestUserClient();
    const step = await fetchAlphabetStep(client, userId);
    expect(step.lesson_id).toBe(lessons[1]!.id);
    expect(step.status).toBe("in_progress");
    expect(step.progress).toBeGreaterThan(0);
    expect(step.progress).toBeLessThan(100);
  });

  test("retaking placement never erases completed lesson progress", async ({ page, request }) => {
    const lessons = await resetAllLevel1Progress(request);
    await retakePlacement(page, (correct) => (correct + 1) % 4);

    await page.goto(`/lesson/${lessons[0]!.id}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "ا" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "False" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Complete lesson" }).click();
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    // Retake placement with a totally different score profile.
    await retakePlacement(page, (correct) => correct);

    const { client, userId } = await createTestUserClient();
    const { data, error } = await client
      .from("user_lesson_progress")
      .select("status, completed_at")
      .eq("user_id", userId)
      .eq("lesson_id", lessons[0]!.id)
      .single();
    if (error) throw error;
    expect(data.status).toBe("completed");
    expect(data.completed_at).not.toBeNull();
  });

  test("a legacy step row with no lesson_id renders read-only, without an actionable link or a crash", async ({
    page,
    request,
  }) => {
    await resetAllLevel1Progress(request);
    await retakePlacement(page, (correct) => (correct + 1) % 4);

    const { client, userId } = await createTestUserClient();
    const { data: path, error: pathError } = await client
      .from("learning_paths")
      .select("id")
      .eq("user_id", userId)
      .single();
    if (pathError) throw pathError;
    // harakat has no real content behind it regardless of this sub-phase —
    // simulates a step saved before the lesson_id column existed.
    const { error } = await client
      .from("learning_path_steps")
      .update({ lesson_id: null })
      .eq("path_id", path.id)
      .eq("step_key", "harakat");
    if (error) throw error;

    await page.goto("/learning-plan");
    await expect(page.getByText("Harakat", { exact: true })).toBeVisible();
    const harakatCard = page.locator("li", { hasText: "Harakat" });
    await expect(harakatCard.getByRole("link")).toHaveCount(0);
  });

  test("no fake links into Modules 3-8: every non-alphabet step has lesson_id null after a fresh save", async ({
    page,
    request,
  }) => {
    await resetAllLevel1Progress(request);
    await retakePlacement(page, (correct) => (correct + 1) % 4);

    const { client, userId } = await createTestUserClient();
    const { data: path, error: pathError } = await client
      .from("learning_paths")
      .select("id")
      .eq("user_id", userId)
      .single();
    if (pathError) throw pathError;
    const { data: steps, error: stepsError } = await client
      .from("learning_path_steps")
      .select("step_key, lesson_id")
      .eq("path_id", path.id)
      .neq("step_key", "alphabet");
    if (stepsError) throw stepsError;
    expect(steps).toHaveLength(8);
    for (const s of steps) {
      expect(s.lesson_id, `step ${s.step_key} should have no lesson_id`).toBeNull();
    }
  });

  test("another user cannot read this user's learning_path_steps", async ({ request }) => {
    const { client } = await createTestUserClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const forgedUserId = "00000000-0000-0000-0000-000000000000";
    const res = await request.get(
      `${url}/rest/v1/learning_path_steps?select=*&user_id=eq.${forgedUserId}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${session!.access_token}`,
        },
      },
    );
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual([]);
  });

  test("French interface renders the learning plan and lesson CTA correctly", async ({
    page,
    request,
  }) => {
    await resetAllLevel1Progress(request);
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await retakePlacement(page, (correct) => (correct + 1) % 4, "fr");
      await page.goto("/learning-plan");
      // level: 1 — the page's own French translation for the h1 title and
      // the h2 "path" section heading happen to be the same string
      // ("Mon parcours d'apprentissage"), a pre-existing content overlap
      // unrelated to this sub-phase; scoping by level avoids the
      // ambiguity rather than asserting on either heading's uniqueness.
      await expect(
        page.getByRole("heading", { level: 1, name: "Mon parcours d'apprentissage" }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Commencer la leçon" }).first()).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the learning plan renders without horizontal overflow and the lesson CTA is reachable", async ({
      page,
      request,
    }) => {
      await resetAllLevel1Progress(request);
      await retakePlacement(page, (correct) => (correct + 1) % 4);

      await page.goto("/learning-plan");
      await expect(page.getByRole("link", { name: "Start lesson" }).first()).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasOverflow).toBe(false);
    });
  });

  test("retry safety: resetAllLevel1Progress and a fresh placement retake leave a deterministic, reproducible entry point", async ({
    page,
    request,
  }) => {
    const lessons = await resetAllLevel1Progress(request);
    await retakePlacement(page, (correct) => (correct + 1) % 4);

    const { client, userId } = await createTestUserClient();
    const first = await fetchAlphabetStep(client, userId);
    expect(first.lesson_id).toBe(lessons[0]!.id);

    // Repeating the exact same reset + retake sequence must land on the
    // same result — no dependence on prior test/attempt ordering.
    await resetAllLevel1Progress(request);
    await retakePlacement(page, (correct) => (correct + 1) % 4);
    const second = await fetchAlphabetStep(client, userId);
    expect(second.lesson_id).toBe(lessons[0]!.id);
    expect(second.status).toBe("available");
  });
});

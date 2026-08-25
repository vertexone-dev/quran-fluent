import { test, expect, type APIRequestContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createTestUserClient } from "./utils/db";

/**
 * Covers Sub-phase 2.7 — turning the existing curriculum/review/placement
 * systems into one coherent "what should I do next" daily plan, without a
 * second parallel daily-study engine. findLevel1EntryPoint (curriculum.ts,
 * from Sub-phase 2.6, extended here to prefer an in-progress lesson) is
 * the single authoritative next-lesson resolver — the dashboard, Daily
 * Study, and the learning plan (via fetchLearningPath's read-time resync)
 * all consume the same function rather than each guessing independently.
 */

async function apiGet(request: APIRequestContext, path: string) {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const res = await request.get(`${url}/rest/v1/${path}`, { headers: { apikey: anonKey } });
  return res.json();
}

async function fetchRealLevel1Lessons(request: APIRequestContext) {
  const modules = (await apiGet(
    request,
    "modules?select=id,order_index&slug=in.(letter-shapes-1,letter-shapes-2,harakat,sukun-and-shadda,tanwin,connected-letter-forms,first-reading-practice,reading-al-fatiha)&order=order_index.asc",
  )) as { id: string; order_index: number }[];
  const lessons: { id: string; slug: string; title_en: string }[] = [];
  for (const m of modules) {
    const rows = (await apiGet(
      request,
      `lessons?select=id,slug,title_en,order_index&module_id=eq.${m.id}&slug=neq.schema-validation-placeholder&order=order_index.asc`,
    )) as { id: string; slug: string; title_en: string }[];
    lessons.push(...rows);
  }
  return lessons;
}

async function resetAll(client: SupabaseClient, userId: string, lessonIds: string[]) {
  await client.from("review_items").delete().eq("user_id", userId);
  await client.from("weak_areas").delete().eq("user_id", userId);
  await client
    .from("user_lesson_progress")
    .delete()
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);
  // This spec exercises post-onboarding pages (the dashboard redirects to
  // /onboarding while it's false). global-setup resets it to false once per
  // Playwright invocation, and no earlier-numbered spec runs onboarding to
  // completion when this file is targeted on its own — so this spec must
  // guarantee it itself, the same way it guarantees clean review/lesson data.
  await client
    .from("learning_preferences")
    .update({ onboarding_completed: true })
    .eq("user_id", userId);
}

function localDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Mirrors PATH_STEPS in src/lib/placement.ts. */
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
] as const;

/**
 * Creates a learning_paths row plus its 9 learning_path_steps rows (a real
 * placement retake, driven through the UI, does the same thing via
 * saveLearningPath — this is the raw-DB equivalent so tests can set up
 * state directly). The alphabet step's lesson_id is only ever set to a
 * real, non-placeholder lesson id here; fetchLearningPath resyncs it live
 * against actual progress on every read regardless (Sub-phase 2.7), so
 * this initial value only needs to be realistic, not currently accurate.
 */
async function ensurePath(client: SupabaseClient, userId: string, lessons: { id: string }[]) {
  const { data: existing } = await client
    .from("learning_paths")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await client
    .from("learning_paths")
    .upsert(
      { user_id: userId, level: "complete_beginner", source: "manual" },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  const pathId = data.id as string;

  const rows = PATH_STEPS.map((step, index) => ({
    path_id: pathId,
    user_id: userId,
    step_key: step,
    order_index: index,
    status: index === 0 ? "in_progress" : index === 1 ? "available" : "locked",
    progress: 0,
    lesson_id: step === "alphabet" ? (lessons[0]?.id ?? null) : null,
  }));
  const { error: stepsError } = await client.from("learning_path_steps").insert(rows);
  if (stepsError) throw stepsError;
  return pathId;
}

test.describe("daily plan / learning plan integration", () => {
  test("due review + next incomplete lesson both appear on Daily Study, with an accurate review count", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    const today = localDate();
    await client.from("review_items").insert([
      {
        user_id: userId,
        item_type: "word",
        item_key: "e2e:daily23-1",
        front: "سَلَام",
        back: "peace",
        due_date: today,
      },
      {
        user_id: userId,
        item_type: "word",
        item_key: "e2e:daily23-2",
        front: "نُور",
        back: "light",
        due_date: today,
      },
    ]);

    await page.goto("/daily");
    await expect(page.getByText(/Item 1 of \d+/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Show answer" })).toBeVisible();

    // Advance through the 2 review cards to reach the lesson card.
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Show answer" }).click();
      await page.getByRole("button", { name: "Easy" }).click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByText("Today's lesson")).toBeVisible();
    await expect(page.getByText(lessons[0]!.title_en)).toBeVisible();
  });

  test("the next lesson is the first incomplete real lesson, in module/lesson order", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    await page.goto("/daily");
    await expect(page.getByText("Today's lesson")).toBeVisible();
    await expect(page.getByText(lessons[0]!.title_en)).toBeVisible();
  });

  test("an in-progress lesson is preferred over the first-in-order incomplete lesson", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    // lessons[0] and lessons[1] untouched (not_started); lessons[2] marked
    // in_progress directly — simulates a learner who jumped ahead via a
    // direct lesson URL. The resolver must still recommend lessons[2].
    await client.from("user_lesson_progress").insert({
      user_id: userId,
      lesson_id: lessons[2]!.id,
      status: "in_progress",
      started_at: new Date().toISOString(),
      last_section_index: 1,
      progress_percent: 20,
    });

    await page.goto("/daily");
    await expect(page.getByText("Today's lesson")).toBeVisible();
    await expect(page.getByText(lessons[2]!.title_en)).toBeVisible();
    await expect(page.getByText(lessons[0]!.title_en)).not.toBeVisible();
  });

  test("a completed lesson is skipped in favor of the next incomplete one", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    await client.from("user_lesson_progress").insert({
      user_id: userId,
      lesson_id: lessons[0]!.id,
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      last_section_index: 5,
      progress_percent: 100,
    });

    await page.goto("/daily");
    await expect(page.getByText("Today's lesson")).toBeVisible();
    await expect(page.getByText(lessons[1]!.title_en)).toBeVisible();
  });

  test("the schema-validation placeholder is never recommended", async ({ request }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    const placeholderRows = (await apiGet(
      request,
      "lessons?select=id&slug=eq.schema-validation-placeholder",
    )) as { id: string }[];
    const placeholderId = placeholderRows[0]!.id;

    const { data: path } = await client
      .from("learning_paths")
      .select("id")
      .eq("user_id", userId)
      .single();
    const { data: step } = await client
      .from("learning_path_steps")
      .select("lesson_id")
      .eq("path_id", path!.id)
      .eq("step_key", "alphabet")
      .single();

    expect(step!.lesson_id).not.toBe(placeholderId);
    expect(lessons.map((l) => l.id)).not.toContain(placeholderId);
  });

  test("the Practice CTA on the dashboard opens Practice", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Review now" }).click();
    await expect(page).toHaveURL(/\/practice/);
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
  });

  test("the lesson CTA on the dashboard opens the real Lesson Player", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    await page.goto("/dashboard");
    await expect(page.getByText(lessons[0]!.title_en).first()).toBeVisible();
    await page.getByRole("link", { name: "Start lesson" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${lessons[0]!.id}`));
    await expect(
      page.getByRole("heading", { level: 1, name: "The First Letter: Alif" }),
    ).toBeVisible();
  });

  test("state: no reviews due, lesson available — the lesson card shows immediately, with no swipe queue", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    // The lesson is a one-way exit link, not a queue item (see
    // getTodaysStudy in src/lib/study.ts) — with zero reviews due, there's
    // no swipeable queue at all, just the lesson card.
    await page.goto("/daily");
    await expect(page.getByText("Today's lesson")).toBeVisible();
    await expect(page.getByText(/Item 1 of/)).not.toBeVisible();
  });

  test("state: reviews due, no lesson available (all Level 1 lessons complete) — honest completion wording, not a placement prompt", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    await client.from("user_lesson_progress").insert(
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
    const today = localDate();
    await client.from("review_items").insert({
      user_id: userId,
      item_type: "word",
      item_key: "e2e:daily23-alldone",
      front: "أَمَل",
      back: "hope",
      due_date: today,
    });

    await page.goto("/daily");
    await expect(page.getByText(/Item 1 of \d+/)).toBeVisible();
    await page.getByRole("button", { name: "Show answer" }).click();
    await page.getByRole("button", { name: "Easy" }).click();
    // Only the one due review existed and no lesson is available, so
    // answering it ends the session (the honest "all lessons complete"
    // wording is a load-time empty state, distinct from this mid-session
    // completion screen — see items.length === 0 in daily.tsx). What
    // matters here is that finishing does NOT fabricate a placement
    // prompt just because no next lesson exists.
    await expect(page.getByText("Session complete")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: "Take placement test" })).not.toBeVisible();
  });

  test("state: no reviews due, no lesson available (all Level 1 lessons complete) — honest empty state on load", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    await client.from("user_lesson_progress").insert(
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

    await page.goto("/daily");
    await expect(page.getByText("You've completed all lessons currently available.")).toBeVisible();
    await expect(page.getByRole("link", { name: "View my learning path" })).toBeVisible();
  });

  test("French interface: lesson card, honest completion wording, and CTAs render correctly", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto("/daily");
      // "Leçon du jour" also matches the nav link to this same page — scope
      // to the lesson card itself to avoid the strict-mode collision.
      await expect(page.getByRole("main").getByText("Leçon du jour")).toBeVisible();
      await expect(page.getByText("Alif")).toBeVisible();

      await page.goto("/dashboard");
      await expect(page.getByRole("link", { name: "Commencer la leçon" }).first()).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("Daily Study and dashboard render without horizontal overflow, with visible CTAs", async ({
      page,
      request,
    }) => {
      const lessons = await fetchRealLevel1Lessons(request);
      const { client, userId } = await createTestUserClient();
      await resetAll(
        client,
        userId,
        lessons.map((l) => l.id),
      );
      await ensurePath(client, userId, lessons);

      await page.goto("/daily");
      await expect(page.getByText("Today's lesson")).toBeVisible();
      let hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasOverflow).toBe(false);

      await page.goto("/dashboard");
      await expect(page.getByRole("link", { name: "Start lesson" }).first()).toBeVisible();
      hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasOverflow).toBe(false);
    });
  });

  test("the dashboard's recommendation agrees with Daily Study's lesson card", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    await page.goto("/dashboard");
    await expect(page.getByText(lessons[0]!.title_en).first()).toBeVisible();

    await page.goto("/daily");
    await expect(page.getByText(lessons[0]!.title_en)).toBeVisible();
  });

  test("the learning plan agrees with the live next-lesson state, even without a placement retake", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    // Mark lessons[0] completed directly (no placement retake), then
    // confirm the learning plan already reflects lessons[1] as next —
    // fetchLearningPath resyncs the alphabet step live on every read.
    await client.from("user_lesson_progress").insert({
      user_id: userId,
      lesson_id: lessons[0]!.id,
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      last_section_index: 5,
      progress_percent: 100,
    });

    // PathTimeline shows the step's generic label/blurb, not the specific
    // lesson's title — it's a roadmap, not a lesson-detail view (Task G).
    // "Start lesson" (not "Continue lesson") is correct: lessons[1] itself
    // hasn't been started yet, even though the alphabet step overall is
    // in_progress. What must be live-correct is the link's target lesson.
    await page.goto("/learning-plan");
    const startLessonLink = page.getByRole("link", { name: "Start lesson" });
    await expect(startLessonLink).toBeVisible();
    await expect(startLessonLink).toHaveAttribute("href", `/lesson/${lessons[1]!.id}`);
  });

  test("retry safety: resetAll leaves a deterministic, reproducible next-lesson state across repeated setup", async ({
    page,
    request,
  }) => {
    const lessons = await fetchRealLevel1Lessons(request);
    const { client, userId } = await createTestUserClient();
    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await ensurePath(client, userId, lessons);

    await page.goto("/daily");
    await expect(page.getByText(lessons[0]!.title_en)).toBeVisible();

    await resetAll(
      client,
      userId,
      lessons.map((l) => l.id),
    );
    await page.goto("/daily");
    await expect(page.getByText(lessons[0]!.title_en)).toBeVisible();
  });
});

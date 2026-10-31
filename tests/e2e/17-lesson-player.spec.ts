import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers Sub-phase 2.2 — the first real lesson player, built against the
 * 2.1 curriculum schema. There is exactly one real lesson row in
 * production right now: the schema-validation placeholder seeded by
 * migration 20260822110000 (module "Letter Shapes I", one explanation
 * section, one multiple_choice exercise with payload
 * {"choices":["A","B"],"correctIndex":0}). These tests exercise the
 * player generically against that real row rather than inventing fixture
 * content of their own — the exact strings below are the seed's own
 * committed text, not guesses.
 */

const PLACEHOLDER_TITLE_EN = "[Schema validation placeholder — not real lesson content]";
const PLACEHOLDER_SECTION_BODY_EN =
  "[Placeholder content inserted only to validate the lesson_sections schema end-to-end. Real Level 1 lesson content has not been authored yet.]";
const PLACEHOLDER_PROMPT_EN = "[Schema validation placeholder]";

async function fetchPlaceholderLessonId(request: APIRequestContext): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const res = await request.get(
    `${url}/rest/v1/lessons?select=id&slug=eq.schema-validation-placeholder`,
    { headers: { apikey: anonKey } },
  );
  const rows = (await res.json()) as { id: string }[];
  if (rows.length !== 1) throw new Error("Schema-validation placeholder lesson not found.");
  return rows[0]!.id;
}

/**
 * Waits for the specific GET that resolves `progress` in
 * lesson.$lessonId.tsx (fetchLessonProgress -> user_lesson_progress),
 * fired to the appropriate `page.goto`/`page.reload()` via Promise.all.
 *
 * This is NOT the same race already fixed in ab40375/13a58c4 (spec 29/30):
 * those waited for the *write* (the "Next" click's POST) before reading
 * state back, because nothing else was blocking page.reload() from racing
 * ahead of persistPosition()'s fire-and-forget enqueue. Here, the previous
 * test in this file already confirmed via a direct DB read that the write
 * had landed well before this test runs, so a write-wait would not touch
 * this test's own failure mode. What this test actually does on every
 * fresh mount is *read* that already-persisted state back -- gated by
 * fetchLessonProgress's own `enabled: Boolean(user?.id) && Boolean(lesson)`,
 * which makes the progress fetch wait for the lesson fetch to resolve
 * first, i.e. two sequential round trips, not one. Invisible against
 * local/CI's near-zero latency; real against production's. Waiting for
 * this response is the read-side equivalent of the proven write-side
 * pattern, applied to the actual bottleneck this test has.
 */
function waitForProgressRead(page: Page) {
  return page.waitForResponse(
    (res) =>
      res.url().includes("/rest/v1/user_lesson_progress") && res.request().method() === "GET",
  );
}

/**
 * Diagnostic evidence attached only when the resumed-exercise assertion
 * fails, so a future failure doesn't require pulling the production trace
 * to tell apart:
 *  - a missing/delayed persistence response (the wait above itself times
 *    out with its own distinct error, before this ever runs)
 *  - an incorrect persisted section index (persistedProgress below)
 *  - a loading-state problem (stillLoading)
 *  - a client-side resume/rendering problem (persisted data and load
 *    state both look right, but sectionBodyVisible shows step 0 anyway)
 * Never itself throws or changes pass/fail: every read is independently
 * guarded, and a failure here is reported as "unknown" rather than
 * replacing the real assertion error.
 */
async function attachResumeDiagnostics(page: Page, lessonId: string): Promise<void> {
  const diagnostics: Record<string, unknown> = {};
  try {
    const { client, userId } = await createTestUserClient();
    const { data, error } = await client
      .from("user_lesson_progress")
      .select("status, last_section_index, progress_percent")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    diagnostics.persistedProgress = error ? `query error: ${error.message}` : data;
  } catch (e) {
    diagnostics.persistedProgress = `unavailable: ${(e as Error).message}`;
  }
  diagnostics.stillLoading = await page
    .locator(".animate-pulse")
    .first()
    .isVisible()
    .catch(() => "unknown");
  diagnostics.sectionBodyVisible = await page
    .getByText(PLACEHOLDER_SECTION_BODY_EN)
    .isVisible()
    .catch(() => "unknown");
  await test.info().attach("resume-diagnostics", {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: "application/json",
  });
}

async function assertResumedAtExerciseStep(page: Page, lessonId: string): Promise<void> {
  try {
    await expect(page.getByText(PLACEHOLDER_PROMPT_EN)).toBeVisible();
  } catch (e) {
    await attachResumeDiagnostics(page, lessonId);
    throw e;
  }
}

test.describe("lesson player", () => {
  test("an invalid (non-UUID) lesson id fails safely with a not-found state", async ({ page }) => {
    await page.goto("/lesson/not-a-real-id");
    await expect(page.getByText("Lesson not found")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to learning plan" })).toBeVisible();
  });

  test("a well-formed but nonexistent lesson id fails safely with a not-found state", async ({
    page,
  }) => {
    await page.goto("/lesson/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Lesson not found")).toBeVisible();
  });

  test("a Qur'anic example section loads the real canonical ayah text in RTL, never invented text", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchPlaceholderLessonId(request);

    // Isolated: replaces this one page load's sections/exercises with a
    // synthetic single quran_example section pointing at the real,
    // already-verified Al-Fatiha 1:1 row. No database write happens —
    // this only rewrites what the client receives, exactly like the
    // interception pattern in 14-translation-fallback.spec.ts.
    await page.route("**/rest/v1/lesson_sections*", async (route) => {
      const response = await route.fetch();
      const real = (await response.json()) as { created_at: string; updated_at: string }[];
      const synthetic = [
        {
          id: "00000000-0000-0000-0000-0000000000e2",
          lesson_id: lessonId,
          order_index: 0,
          content_type: "quran_example",
          body_en: null,
          body_fr: null,
          arabic_text: null,
          surah_number: 1,
          ayah_number: 1,
          metadata: {},
          created_at: real[0]?.created_at ?? new Date().toISOString(),
          updated_at: real[0]?.updated_at ?? new Date().toISOString(),
        },
      ];
      await route.fulfill({ response, json: synthetic });
    });
    await page.route("**/rest/v1/lesson_exercises*", async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, json: [] });
    });

    await page.goto(`/lesson/${lessonId}`);

    const arabic = page.locator('[dir="rtl"][lang="ar"]').first();
    await expect(arabic).toBeVisible();
    // The Bismillah, Al-Fatiha 1:1 — real canonical text fetched live via
    // fetchAyah(), never duplicated/hand-typed in this test or the schema.
    await expect(arabic).toContainText("بِسْمِ");
    await expect(page.getByText("Surah 1, Ayah 1")).toBeVisible();
  });

  test.describe.serial("full lifecycle on the real placeholder lesson", () => {
    let lessonId: string;

    test.beforeAll(async ({ request }) => {
      lessonId = await fetchPlaceholderLessonId(request);
    });

    test("opens the lesson, shows title and module context, and renders the section before the exercise", async ({
      page,
    }) => {
      // Guards against a Playwright retry of this serial group: without
      // this, a retry would re-answer the exercise on top of the
      // abandoned attempt's row (user_exercise_attempts is append-only),
      // and the count assertion two tests down would see 4 instead of 2.
      await resetLessonProgress(lessonId);
      await page.goto(`/lesson/${lessonId}`);
      await expect(
        page.getByRole("heading", { level: 1, name: PLACEHOLDER_TITLE_EN }),
      ).toBeVisible();
      await expect(page.getByText("Letter Shapes I (ا–ز)")).toBeVisible();

      // Step 0: the section, not the exercise.
      await expect(page.getByText(PLACEHOLDER_SECTION_BODY_EN)).toBeVisible();
      await expect(page.getByText(PLACEHOLDER_PROMPT_EN)).not.toBeVisible();

      await page.getByRole("button", { name: "Next" }).click();

      // Step 1: the exercise, attached to that section, not the section body.
      await expect(page.getByText(PLACEHOLDER_PROMPT_EN)).toBeVisible();
      await expect(page.getByText(PLACEHOLDER_SECTION_BODY_EN)).not.toBeVisible();
    });

    test("starting the lesson persisted an in_progress progress row", async () => {
      const { client, userId } = await createTestUserClient();
      const { data, error } = await client
        .from("user_lesson_progress")
        .select("status, started_at, progress_percent")
        .eq("user_id", userId)
        .eq("lesson_id", lessonId)
        .single();
      if (error) throw error;
      expect(data.status).toBe("in_progress");
      expect(data.started_at).not.toBeNull();
      expect(data.progress_percent).toBeGreaterThan(0);
    });

    test("refreshing the page resumes at the saved exercise step, not the beginning", async ({
      page,
    }) => {
      await Promise.all([waitForProgressRead(page), page.goto(`/lesson/${lessonId}`)]);
      await assertResumedAtExerciseStep(page, lessonId);

      await Promise.all([waitForProgressRead(page), page.reload()]);
      await assertResumedAtExerciseStep(page, lessonId);
      await expect(page.getByText(PLACEHOLDER_SECTION_BODY_EN)).not.toBeVisible();
    });

    test("answering the exercise correctly shows feedback and records a correct attempt", async ({
      page,
    }) => {
      await page.goto(`/lesson/${lessonId}`);
      await page.getByRole("radio", { name: "A" }).click();
      await page.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();

      const { client, userId } = await createTestUserClient();
      const { data, error } = await client
        .from("user_exercise_attempts")
        .select("correct")
        .eq("user_id", userId)
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      expect(data.correct).toBe(true);
    });

    test("answering again after a fresh load records a second, incorrect attempt", async ({
      page,
    }) => {
      await page.goto(`/lesson/${lessonId}`);
      await page.getByRole("radio", { name: "B" }).click();
      await page.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByText("Not quite.")).toBeVisible();

      const { client, userId } = await createTestUserClient();
      const { data, error, count } = await client
        .from("user_exercise_attempts")
        .select("correct", { count: "exact" })
        .eq("user_id", userId)
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      expect(count).toBe(2);
      expect(data[0]?.correct).toBe(false);
    });

    test("completing the lesson shows the completion screen and persists completed status", async ({
      page,
    }) => {
      await page.goto(`/lesson/${lessonId}`);
      await page.getByRole("radio", { name: "A" }).click();
      await page.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();

      await page.getByRole("button", { name: "Complete lesson" }).click();
      await expect(page.getByText("Lesson complete!")).toBeVisible();

      const { client, userId } = await createTestUserClient();
      const { data, error } = await client
        .from("user_lesson_progress")
        .select("status, completed_at, progress_percent")
        .eq("user_id", userId)
        .eq("lesson_id", lessonId)
        .single();
      if (error) throw error;
      expect(data.status).toBe("completed");
      expect(data.completed_at).not.toBeNull();
      expect(data.progress_percent).toBe(100);
    });

    test("reopening a completed lesson shows the completion screen immediately", async ({
      page,
    }) => {
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.getByText("Lesson complete!")).toBeVisible();
      await expect(page.getByText(PLACEHOLDER_SECTION_BODY_EN)).not.toBeVisible();
    });
  });

  test("one user cannot read or write another user's lesson progress or exercise attempts", async ({
    request,
  }) => {
    const { client } = await createTestUserClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const forgedUserId = "00000000-0000-0000-0000-000000000000";
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${session!.access_token}`,
      "Content-Type": "application/json",
    };

    for (const table of ["user_lesson_progress", "user_exercise_attempts"]) {
      const res = await request.get(`${url}/rest/v1/${table}?select=*&user_id=eq.${forgedUserId}`, {
        headers,
      });
      expect(res.ok()).toBe(true);
      expect(await res.json()).toEqual([]);
    }

    const updateRes = await request.patch(
      `${url}/rest/v1/user_lesson_progress?user_id=eq.${forgedUserId}`,
      { headers: { ...headers, Prefer: "return=representation" }, data: { status: "in_progress" } },
    );
    expect(updateRes.ok()).toBe(true);
    expect(await updateRes.json()).toEqual([]);
  });

  test("the lesson player renders correctly with the French interface", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchPlaceholderLessonId(request);
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      // The lesson is already completed by the serial block above — its
      // French completion copy is real i18n content, not a guess.
      await expect(page.getByText("Leçon terminée !")).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the lesson player renders without horizontal overflow on a small screen", async ({
      page,
      request,
    }) => {
      const lessonId = await fetchPlaceholderLessonId(request);
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.getByText("Lesson complete!")).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasOverflow).toBe(false);

      const backButton = page.getByRole("link", { name: "Back to learning plan" });
      await expect(backButton).toBeVisible();
      await expect(backButton).toBeInViewport();
    });
  });
});

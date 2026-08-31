import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers the lesson-position persistence race fixed in
 * createSerialLatestQueue (src/lib/curriculum.ts), wired into
 * src/routes/_authenticated/lesson.$lessonId.tsx.
 *
 * Previously, every step change fired an un-awaited, unsequenced
 * Supabase upsert to user_lesson_progress. Two navigations issued close
 * together raced two concurrent writes to the same (user_id, lesson_id)
 * row with no ordering guarantee -- an older, slower write could resolve
 * after a newer, faster one and silently regress the persisted position
 * (or, worse, revert a completed lesson back to in_progress). The fix
 * serializes all position writes through one queue that (a) never has
 * more than one write in flight, and (b) always ends on the most
 * recently requested position, not the highest one -- backward
 * navigation must be preserved, not clamped.
 *
 * The queue's own ordering logic already has deterministic, sleep-free
 * unit coverage with manually-controlled promises (src/lib/curriculum.test.ts).
 * This file proves it's wired correctly into the real component against
 * the real database, including forcing a real out-of-order network
 * response via route interception -- not hoping rapid clicks happen to
 * race.
 *
 * Reuses the schema-validation placeholder lesson row (the one real
 * lesson id every environment has), but replaces its sections/exercises
 * for just this page load via interception -- exactly the pattern
 * 17-lesson-player.spec.ts already uses for its Qur'anic-example test.
 * No database write, no curriculum content change.
 */

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

/** Replaces the placeholder lesson's sections with `sectionCount` plain
 * "explanation" sections and zero exercises, for this page load only --
 * a lesson with no answer-gated steps, so Next/Previous can be clicked
 * freely to exercise pure navigation-race scenarios. */
async function mockSectionOnlyLesson(
  page: Page,
  lessonId: string,
  sectionCount: number,
): Promise<void> {
  const now = new Date().toISOString();
  const synthetic = Array.from({ length: sectionCount }, (_, i) => ({
    id: crypto.randomUUID(),
    lesson_id: lessonId,
    order_index: i,
    content_type: "explanation",
    body_en: `Race-test section ${i}`,
    body_fr: `Section de test ${i}`,
    arabic_text: null,
    surah_number: null,
    ayah_number: null,
    metadata: {},
    created_at: now,
    updated_at: now,
  }));
  await page.route("**/rest/v1/lesson_sections*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(synthetic),
    });
  });
  await page.route("**/rest/v1/lesson_exercises*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
}

/** Delays only the position-write request that persists `targetIndex`
 * (an in_progress upsert) by `delayMs` before letting it reach the real
 * database -- a controlled, deterministic way to force a specific write
 * to resolve later than writes issued after it, without any sleep in
 * the test's own control flow. */
async function delayPositionWrite(page: Page, targetIndex: number, delayMs: number): Promise<void> {
  await page.route("**/rest/v1/user_lesson_progress*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }
    const raw = request.postDataJSON() as unknown;
    const body = (Array.isArray(raw) ? raw[0] : raw) as
      { last_section_index?: number; status?: string } | undefined;
    if (body?.status === "in_progress" && body.last_section_index === targetIndex) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await route.continue();
  });
}

async function fetchProgress(
  userId: string,
  lessonId: string,
): Promise<{ status: string; last_section_index: number } | undefined> {
  const { client } = await createTestUserClient();
  const { data } = await client
    .from("user_lesson_progress")
    .select("status, last_section_index")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  return data ?? undefined;
}

test.describe("lesson position persistence race", () => {
  test("clicking Next twice quickly settles at the final position, 0 -> 1 -> 2", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchPlaceholderLessonId(request);
    await resetLessonProgress(lessonId);
    await mockSectionOnlyLesson(page, lessonId, 4);
    const { userId } = await createTestUserClient();

    await page.goto(`/lesson/${lessonId}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Race-test section 2")).toBeVisible();

    await expect
      .poll(async () => (await fetchProgress(userId, lessonId))?.last_section_index)
      .toBe(2);
  });

  test("backward navigation after forward navigation persists the backward position, not the highest seen", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchPlaceholderLessonId(request);
    await resetLessonProgress(lessonId);
    await mockSectionOnlyLesson(page, lessonId, 4);
    const { userId } = await createTestUserClient();

    await page.goto(`/lesson/${lessonId}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Race-test section 2")).toBeVisible();
    await expect
      .poll(async () => (await fetchProgress(userId, lessonId))?.last_section_index)
      .toBe(2);

    // Deliberately go back -- the durable position must follow the user
    // backward, not stay clamped at the highest index ever reached.
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByText("Race-test section 1")).toBeVisible();

    await expect
      .poll(async () => (await fetchProgress(userId, lessonId))?.last_section_index)
      .toBe(1);
  });

  test("rapid alternating Next/Previous settles on whatever step the user was actually left on", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchPlaceholderLessonId(request);
    await resetLessonProgress(lessonId);
    await mockSectionOnlyLesson(page, lessonId, 4);
    const { userId } = await createTestUserClient();

    await page.goto(`/lesson/${lessonId}`);
    // 0 -> 1 -> 2 -> 1 -> 2 -> 3, clicked back to back with no waiting.
    const next = page.getByRole("button", { name: "Next" });
    const previous = page.getByRole("button", { name: "Previous" });
    await next.click();
    await next.click();
    await previous.click();
    await next.click();
    await next.click();
    await expect(page.getByText("Race-test section 3")).toBeVisible();

    await expect
      .poll(async () => (await fetchProgress(userId, lessonId))?.last_section_index)
      .toBe(3);
  });

  test("refreshing after the position write has settled resumes at the exact latest position", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchPlaceholderLessonId(request);
    await resetLessonProgress(lessonId);
    await mockSectionOnlyLesson(page, lessonId, 4);
    const { userId } = await createTestUserClient();

    await page.goto(`/lesson/${lessonId}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect
      .poll(async () => (await fetchProgress(userId, lessonId))?.last_section_index)
      .toBe(2);

    await page.reload();
    await expect(page.getByText("Race-test section 2")).toBeVisible();
  });

  test("a write delayed longer than the next navigation's write still cannot become the final durable state", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchPlaceholderLessonId(request);
    await resetLessonProgress(lessonId);
    await mockSectionOnlyLesson(page, lessonId, 4);
    // The write persisting index 1 (the first Next click) is deliberately
    // held back well past when the second Next click's write would
    // naturally resolve -- a genuine, controlled out-of-order backend
    // timing, not a hopeful race.
    await delayPositionWrite(page, 1, 2_500);
    const { userId } = await createTestUserClient();

    await page.goto(`/lesson/${lessonId}`);
    await page.getByRole("button", { name: "Next" }).click(); // -> 1, write delayed 2.5s
    await page.getByRole("button", { name: "Next" }).click(); // -> 2, write queued behind it
    await expect(page.getByText("Race-test section 2")).toBeVisible();

    // Once everything settles, the final durable position reflects the
    // *later* navigation (2), never the artificially-delayed-but-earlier
    // one (1) landing last and winning.
    await expect
      .poll(async () => (await fetchProgress(userId, lessonId))?.last_section_index, {
        timeout: 6_000,
      })
      .toBe(2);
  });

  test("completing a lesson immediately after a navigation whose write is still pending never leaves the lesson stuck in_progress", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchPlaceholderLessonId(request);
    await resetLessonProgress(lessonId);
    await mockSectionOnlyLesson(page, lessonId, 3); // steps 0, 1, 2 (2 is last)
    // The write for step 1 is held back -- long enough that, without the
    // fix, the completion write below would land and then get silently
    // reverted back to in_progress once this stale write finally arrives.
    await delayPositionWrite(page, 1, 3_000);
    const { userId } = await createTestUserClient();

    await page.goto(`/lesson/${lessonId}`);
    await page.getByRole("button", { name: "Next" }).click(); // 0 -> 1, write delayed
    await page.getByRole("button", { name: "Next" }).click(); // 1 -> 2 (last step)
    await expect(page.getByText("Race-test section 2")).toBeVisible();
    await page.getByRole("button", { name: "Complete lesson" }).click(); // 2 -> completed

    await expect(page.getByText("Lesson complete!")).toBeVisible({
      timeout: 8_000,
    });

    // The delayed step-1 write has long since resolved by now. Confirm
    // it did not win: status is completed, not reverted to in_progress.
    await expect
      .poll(async () => (await fetchProgress(userId, lessonId))?.status, { timeout: 2_000 })
      .toBe("completed");
  });
});

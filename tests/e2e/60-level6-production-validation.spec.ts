import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import { completeLessonResilient, resilientAnswerAndCheck } from "./utils/lesson-interaction";

/**
 * Dedicated PRODUCTION-ONLY authenticated validation for Level 6
 * ("al-fatiha-surah-study"), closing the gap found in Production
 * Validation #18: the curated production spec list in
 * production-validation.yml predates Level 6 and never included
 * tests/e2e/58-level6-batch1-al-fatiha-surah-study.spec.ts, so no
 * authenticated production check of Level 6 had ever run.
 *
 * Deliberately a SEPARATE, narrower spec from 58, not 58 itself -- by
 * explicit safety audit (see the fix/level6-production-validation PR
 * description). Two of spec 58's tests are unsafe to run standalone
 * against the shared production E2E account:
 *   - "surah_mastery is locked before Level 5 completes, and unlocks..."
 *     wholesale-deletes and rebuilds learning_paths/learning_path_steps
 *     and marks Levels 1-4 fully completed, with no restoration -- safe
 *     only inside the local/CI suite's own global-setup reset lifecycle
 *     (which wipes the whole account before every run), not as a
 *     standalone production dispatch.
 *   - "KNOWN GAP: a Level 6 lesson URL is directly reachable..." deletes
 *     the account's Level 5 progress with no restoration.
 * Every test below is either read-only, or writes only through the same
 * account-scoped, RLS-governed, self-resetting pattern spec 58's other
 * (already production-trusted) per-lesson tests use -- the same shape as
 * specs 17-41/51/15, which already run against production in this exact
 * workflow today.
 *
 * Gating is exercised, not weakened: this spec never fakes Level 1-5
 * completion. Instead:
 *   - The "learning plan exposes Level 6" check takes the REAL placement
 *     UI flow (the same established, already-production-trusted mechanism
 *     tests/e2e/22-placement-curriculum.spec.ts already uses) to obtain a
 *     genuine learning_paths row. All five placement outcomes
 *     (complete_beginner..intermediate_quranic) start no later than Level
 *     4 ("grammar" -- see src/lib/placement.ts LEVEL_START_STEP), so no
 *     placement answer can ever unlock Level 6: asserting it shows
 *     "Locked" afterward is a true, conservative check, not a weakened
 *     one.
 *   - Lesson-content checks reach Level 6 pages via the same documented,
 *     pre-existing systemic gap spec 58's own "KNOWN GAP" test names (no
 *     level in this app enforces prerequisite gating at the URL/route
 *     layer -- LEVEL6-CONTENT-LEDGER.md §5.3) -- not a new hole introduced
 *     here, and not the account's Level 5 progress.
 *
 * production-only: skipped everywhere else, the same guard
 * tests/e2e/51-production-quran-smoke.spec.ts already uses.
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

async function fetchModuleLessons(request: APIRequestContext, moduleSlug: string) {
  const modules = (await apiGet(request, `modules?select=id&slug=eq.${moduleSlug}`)) as {
    id: string;
  }[];
  if (modules.length === 0) {
    throw new Error(
      `fetchModuleLessons: module "${moduleSlug}" was not found. The Level 6 migration ` +
        `(supabase/migrations/20260918100000_401cbe5f-...sql) is missing from this database.`,
    );
  }
  const moduleId = modules[0]!.id;
  return (await apiGet(
    request,
    `lessons?select=id,slug,title_en,title_fr,order_index&module_id=eq.${moduleId}&order=order_index.asc`,
  )) as { id: string; slug: string; title_en: string; title_fr: string; order_index: number }[];
}

async function fetchLessonExercises(request: APIRequestContext, lessonId: string) {
  return (await apiGet(
    request,
    `lesson_exercises?select=id,exercise_type,payload,review_item_type&lesson_id=eq.${lessonId}&order=order_index.asc`,
  )) as (DbExercise & { id: string; review_item_type: string })[];
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

async function completeLesson(page: Page, exercises: DbExercise[]) {
  await completeLessonResilient(page, exercises, answerExercise);
}

/** Mirrors tests/e2e/22-placement-curriculum.spec.ts's own retakePlacement
 * helper -- the same established, already-production-trusted mechanism for
 * obtaining a real learning_paths row, never a raw DB insert. */
async function retakePlacement(page: Page, pickIndex: (correct: number) => number) {
  const CORRECT_INDEXES = [0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 1];
  await page.goto("/placement");
  await page.getByRole("button", { name: "Start the placement test" }).click();
  for (let i = 0; i < CORRECT_INDEXES.length; i++) {
    const options = page.locator("main button[aria-pressed]");
    const isLast = i === CORRECT_INDEXES.length - 1;
    const nextButton = page.getByRole("button", {
      name: isLast ? "Your recommended starting point" : "Continue",
    });
    await options.nth(pickIndex(CORRECT_INDEXES[i]!)).click();
    await expect(nextButton).toBeEnabled({ timeout: 5_000 });
    await nextButton.click();
  }
  await page.getByRole("button", { name: "Start recommended course" }).click();
  await expect(page).toHaveURL(/\/learning-plan/, { timeout: 10_000 });
}

test.describe("Level 6 production validation", () => {
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL,
    "production-only: exercises the live deployed Level 6 module against the real production database",
  );

  let consoleErrors: string[] = [];
  let failedRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    failedRequests = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on("requestfailed", (req) => {
      if (req.failure()?.errorText === "net::ERR_ABORTED") return; // benign nav/route cancellation
      failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
    });
    page.on("response", (res) => {
      if (res.status() >= 500) failedRequests.push(`${res.status()} ${res.url()}`);
    });
  });

  // Combines spec 58's own afterEach precedent (always reset the shared
  // account's interface_language back to English, unconditionally, so a
  // failure mid-French-test never leaks into a later test) with the
  // page-error/failed-request assertions every test in this file needs.
  test.afterEach(async () => {
    expect(consoleErrors, `unexpected console errors: ${consoleErrors.join("; ")}`).toEqual([]);
    expect(
      failedRequests,
      `failed critical network requests: ${failedRequests.join("; ")}`,
    ).toEqual([]);
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
  });

  test("module and its 3 lessons exist in production, in order", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,order_index,levels(slug,number)&slug=eq.al-fatiha-surah-study",
    )) as { slug: string; order_index: number; levels: { slug: string; number: number } }[];
    expect(modules).toHaveLength(1);
    expect(modules[0]!.levels.number).toBe(6);
    expect(modules[0]!.levels.slug).toBe("quranic-comprehension");

    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    expect(lessons.map((l) => l.slug)).toEqual([
      "al-fatiha-orientation-and-structure",
      "al-fatiha-tracing-meaning",
      "al-fatiha-synthesis-praise-and-petition",
    ]);
  });

  test("a freshly-placed account sees Level 6 correctly Locked on the learning plan (real gating, not weakened)", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // Every placement outcome starts no later than Level 4 ("grammar"),
    // so this can never accidentally unlock Level 6 -- see this file's own
    // header comment. pickIndex deliberately picks a wrong answer for
    // every question (a conservative, deterministic "complete_beginner"
    // result), matching retakePlacement's own established shape.
    await retakePlacement(page, (correct) => (correct + 1) % 4);

    const surahRow = page.locator("li", { hasText: "Surah mastery" });
    await expect(surahRow.getByText("Locked")).toBeVisible();
    await expect(surahRow.getByRole("link")).toHaveCount(0);
  });

  test("Lesson 1 renders the real canonical ayah 1:1 and RTL Arabic, and grades an exercise correctly, seeding review items", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const lesson1 = lessons.find((l) => l.slug === "al-fatiha-orientation-and-structure")!;
    await resetLessonProgress(lesson1.id);
    const { client, userId } = await createTestUserClient();
    await client.from("review_items").delete().eq("user_id", userId).like("item_key", "%Ayat%");

    const exercises = await fetchLessonExercises(request, lesson1.id);
    expect(exercises).toHaveLength(3);

    await page.goto(`/lesson/${lesson1.id}`);
    await expect(
      page.getByRole("heading", { name: "Al-Fatiha: The Complete Surah" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText("In the name of Allah, the Entirely Merciful, the Especially Merciful."),
    ).toBeVisible();
    // The real, governed Arabic text -- never invented -- rendered RTL.
    const ayahText = page.locator("[lang='ar']").first();
    await expect(ayahText).toBeVisible();
    await expect(ayahText).toHaveAttribute("dir", "rtl");

    await completeLesson(page, exercises);
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    const { data: progress } = await client
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", lesson1.id)
      .single();
    expect(progress?.status).toBe("completed");

    const { data: reviewItems } = await client
      .from("review_items")
      .select("item_key, item_type")
      .eq("user_id", userId)
      .in("item_key", ["concept:Ayat 1-4", "concept:Ayat 5-7", "concept:The turning word"]);
    expect(reviewItems).toHaveLength(3);
    expect(reviewItems?.every((r) => r.item_type === "concept")).toBe(true);
  });

  test("Lessons 2 and 3 (capstone) also open and complete correctly, capstone seeding zero new review items", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const lesson2 = lessons.find((l) => l.slug === "al-fatiha-tracing-meaning")!;
    const capstone = lessons.find((l) => l.slug === "al-fatiha-synthesis-praise-and-petition")!;
    const { client, userId } = await createTestUserClient();

    await resetLessonProgress(lesson2.id);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .in("item_key", ["concept:Ayah 3", "concept:Ayah 4", "concept:Ayah 6"]);
    const lesson2Exercises = await fetchLessonExercises(request, lesson2.id);
    expect(lesson2Exercises).toHaveLength(3);

    await page.goto(`/lesson/${lesson2.id}`);
    await expect(
      page.getByRole("heading", { name: "Tracing Meaning, Ayah by Ayah" }),
    ).toBeVisible();
    await completeLesson(page, lesson2Exercises);
    await expect(page.getByText("Lesson complete!")).toBeVisible();
    const { data: lesson2ReviewItems } = await client
      .from("review_items")
      .select("item_key")
      .eq("user_id", userId)
      .in("item_key", ["concept:Ayah 3", "concept:Ayah 4", "concept:Ayah 6"]);
    expect(lesson2ReviewItems).toHaveLength(3);

    await resetLessonProgress(capstone.id);
    const capstoneExercises = await fetchLessonExercises(request, capstone.id);
    expect(capstoneExercises).toHaveLength(3);
    const { count: beforeCount } = await client
      .from("review_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${capstone.id}`);
    await expect(
      page.getByRole("heading", { name: "Synthesis: From Praise to Petition" }),
    ).toBeVisible();
    await completeLesson(page, capstoneExercises);
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    const { count: afterCount } = await client
      .from("review_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(afterCount).toBe(beforeCount);
  });

  test("reloading mid-lesson resumes at the same exercise, not the beginning", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const lesson1 = lessons.find((l) => l.slug === "al-fatiha-orientation-and-structure")!;
    await resetLessonProgress(lesson1.id);
    const exercises = await fetchLessonExercises(request, lesson1.id);

    await page.goto(`/lesson/${lesson1.id}`);
    for (let i = 0; i < 8; i++) {
      if (
        await page
          .getByRole("button", { name: "Check answer" })
          .isVisible()
          .catch(() => false)
      ) {
        break;
      }
      await page
        .getByRole("button", { name: /^(Next|Complete lesson)$/ })
        .click({ timeout: 2_000 })
        .catch(() => {});
      await page.waitForTimeout(300);
    }
    await answerExercise(page, exercises[0]!);
    await page.getByRole("button", { name: "Next" }).click();

    await page.reload();
    await expect(page.getByRole("button", { name: "Check answer" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "True" })).toBeVisible();
    await expect(page.getByRole("button", { name: "False" })).toBeVisible();
    await expect(page.getByRole("radio", { name: exercises[0]!.payload.choices![0]! })).toHaveCount(
      0,
    );
  });

  test("renders correctly in French, including the real Arabic text", async ({ page, request }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const lesson1 = lessons.find((l) => l.slug === "al-fatiha-orientation-and-structure")!;
    await resetLessonProgress(lesson1.id);

    await page.goto(`/lesson/${lesson1.id}`);
    await expect(
      page.getByRole("heading", { name: "Al-Fatiha : la sourate complète" }),
    ).toBeVisible();
    await expect(
      page.getByText("Vous avez déjà lu à voix haute les sept versets d'Al-Fatiha", {
        exact: false,
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Suivant" }).click();
    const ayahText = page.locator("[lang='ar']").first();
    await expect(ayahText).toBeVisible();
    await expect(ayahText).toHaveAttribute("dir", "rtl");
  });

  test("lesson completion cannot write outside the designated E2E account's own rows (RLS)", async ({
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const lesson1 = lessons.find((l) => l.slug === "al-fatiha-orientation-and-structure")!;
    const { client } = await createTestUserClient();
    // A nonexistent user_id -- never a real second account -- proves the
    // authenticated, publishable-key client's writes are RLS-scoped to its
    // own account and cannot touch any other user's rows, without needing
    // real second-account credentials this repo does not provide to tests.
    const foreignUserId = "00000000-0000-0000-0000-000000000000";
    const { data, error } = await client
      .from("user_lesson_progress")
      .update({ progress_percent: 50 })
      .eq("user_id", foreignUserId)
      .eq("lesson_id", lesson1.id)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  for (const viewport of [
    { width: 390, height: 844, label: "390x844" },
    { width: 768, height: 1024, label: "768x1024" },
    { width: 1440, height: 900, label: "1440x900" },
  ]) {
    test(`renders without horizontal overflow at ${viewport.label}`, async ({ page, request }) => {
      const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
      const lesson2 = lessons.find((l) => l.slug === "al-fatiha-tracing-meaning")!;
      await resetLessonProgress(lesson2.id);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/lesson/${lesson2.id}`);
      await expect(
        page.getByRole("heading", { name: "Tracing Meaning, Ayah by Ayah" }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

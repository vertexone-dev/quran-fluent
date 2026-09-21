import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";
import {
  advanceUntilVisibleResilient,
  completeLessonResilient,
  resilientAnswerAndCheck,
} from "./utils/lesson-interaction";

/**
 * Covers Level 6 ("quranic-comprehension") Batch 1: Module 1
 * (al-fatiha-surah-study), the first-ever Level 6 content -- three lessons
 * studying Al-Fatiha as a complete surah. See LEVEL6-CONTENT-LEDGER.md for
 * the full source ledger and open human-review items this content is
 * still waiting on; this spec verifies the migration behaves correctly, not
 * that the content itself is approved.
 *
 * CONTAINMENT (production incident, PR #31/main commit 5b50be3): the
 * STEP_LEVEL_SLUGS.surah_mastery activation wiring this file's gating test
 * originally proved was removed from src/lib/placement.ts after PR #31
 * merged to main before its required human review completed. That gating
 * test now proves the opposite -- that surah_mastery stays locked and
 * linkless even once Level 5 is complete -- while every other test in this
 * file (content, exercises, i18n, accessibility, layout) is unaffected and
 * continues to exercise this batch's lesson content directly by module/
 * lesson slug, independent of learning-path reachability.
 *
 * Deliberately does not re-test the generic lesson-completion/resume/
 * review-item-seeding machinery beyond what's needed to confirm this
 * batch's own content exercises it correctly -- that machinery is already
 * covered extensively by specs 17 and 21-23.
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
      `fetchModuleLessons: module "${moduleSlug}" was not found in the test database. ` +
        `The Level 6 migration (supabase/migrations/20260918100000_401cbe5f-...sql) is ` +
        `missing from test database -- it must be applied before this spec runs. This is ` +
        `not a lesson-player or content bug; it means the test environment's Supabase ` +
        `instance was never migrated with this batch's content, or was reset since.`,
    );
  }
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

async function markCompleted(
  client: Awaited<ReturnType<typeof createTestUserClient>>["client"],
  userId: string,
  lessons: { id: string }[],
) {
  if (lessons.length === 0) return;
  await client.from("user_lesson_progress").upsert(
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
}

test.describe("Level 6 Batch 1 — al-fatiha-surah-study", () => {
  // Unconditional, not just at the end of the French test: an inline
  // reset-to-English as a test's last statement is skipped whenever that
  // same test fails earlier, which would leave the shared account stuck
  // in French for every test that runs after it in this file (and beyond,
  // per 55-dashboard-mobile-greeting.spec.ts's own precedent bug of the
  // same shape). afterEach always runs, pass or fail.
  test.afterEach(async () => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
  });

  test("module and lessons exist, in the correct order, under Level 6", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,title_en,title_fr,order_index,levels(slug,number)&slug=eq.al-fatiha-surah-study",
    )) as {
      slug: string;
      title_en: string;
      order_index: number;
      levels: { slug: string; number: number };
    }[];
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

  // CONTAINMENT (production incident, PR #31/main commit 5b50be3): this
  // test originally mirrored 37-level3-batch1's own STEP_LEVEL_SLUGS gating
  // precedent, proving surah_mastery unlocked with a real, clickable
  // first-lesson link once Level 5 completed. That activation wiring was
  // removed from src/lib/placement.ts's STEP_LEVEL_SLUGS map (see the
  // CONTAINMENT comment there) after PR #31 merged to main before its
  // required qualified human Qur'an-content/French review completed. This
  // test now proves the containment itself: surah_mastery must stay
  // locked, with zero link, even once Level 5 is fully complete -- not
  // just before it, as originally asserted. The underlying Level 6 lesson
  // content (migration, module, lessons) is untouched and still directly
  // fetchable by slug, as the other tests in this file continue to prove;
  // only its reachability through the learning path is withheld.
  test("surah_mastery stays locked, with zero link, even once Level 5 is complete (Level 6 activation withheld pending human review)", async ({
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
    const level4Lessons = await fetchLevelLessons(request, "core-grammar");
    const level5Lessons = await fetchLevelLessons(request, "guided-ayah-comprehension");
    const level6Lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");

    const allLessons = [
      ...level1Lessons,
      ...level2Lessons,
      ...level3Lessons,
      ...level4Lessons,
      ...level5Lessons,
      ...level6Lessons,
    ];
    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        allLessons.map((l) => l.id),
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

    // Levels 1-4 complete, Level 5 NOT complete -> surah_mastery must stay
    // locked, with zero link.
    await markCompleted(client, userId, level1Lessons);
    await markCompleted(client, userId, level2Lessons);
    await markCompleted(client, userId, level3Lessons);
    await markCompleted(client, userId, level4Lessons);
    await resetPathTo("ayah_comprehension");

    await page.goto("/learning-plan");
    const surahRow = page.locator("li", { hasText: "Surah mastery" });
    await expect(surahRow.getByText("Locked")).toBeVisible();
    await expect(surahRow.getByRole("link")).toHaveCount(0);

    // Now complete Level 5 too -> surah_mastery must stay locked and
    // linkless regardless (the containment case this test exists to
    // prove). Before the containment fix, this is exactly the point where
    // the step used to unlock with a real, clickable first-lesson link.
    await markCompleted(client, userId, level5Lessons);
    await resetPathTo("ayah_comprehension");

    await page.goto("/learning-plan");
    const surahRowAfterLevel5 = page.locator("li", { hasText: "Surah mastery" });
    await expect(surahRowAfterLevel5.getByText("Locked")).toBeVisible();
    await expect(surahRowAfterLevel5.getByRole("link")).toHaveCount(0);

    // The underlying content itself is untouched -- still directly
    // fetchable by module slug, confirmed by the other tests in this file.
    // Only its reachability through the learning path is withheld.
    expect(level6Lessons.length).toBeGreaterThan(0);
  });

  test("Lesson 1 renders the real canonical ayah 1:1 and all three exercises grade correctly, seeding the matching exercise's review items", async ({
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
    expect(exercises.filter((e) => e.exercise_type === "matching")).toHaveLength(1);

    await page.goto(`/lesson/${lesson1.id}`);
    await expect(
      page.getByRole("heading", { name: "Al-Fatiha: The Complete Surah" }),
    ).toBeVisible();

    // The lesson player shows one section/exercise per step ("Step 1 of
    // 7"); the quran_example section for 1:1 is step 2, not visible until
    // advancing past the opening explanation section.
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText("In the name of Allah, the Entirely Merciful, the Especially Merciful."),
    ).toBeVisible();
    // The real, governed Arabic text for 1:1 -- never invented text --
    // rendered RTL.
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

    // The matching exercise must have seeded exactly 3 concept review
    // items, keyed by its pairs' left-hand labels -- verified against the
    // exact keys authored in the migration, not guessed.
    const { data: reviewItems } = await client
      .from("review_items")
      .select("item_key, item_type")
      .eq("user_id", userId)
      .in("item_key", ["concept:Ayat 1-4", "concept:Ayat 5-7", "concept:The turning word"]);
    expect(reviewItems).toHaveLength(3);
    expect(reviewItems?.every((r) => r.item_type === "concept")).toBe(true);
  });

  test("Lesson 2 renders ayat 1:3, 1:4 and 1:6 -- new in the surah's own arc, even though Level 4 already glossed 1:4/1:6's phrases -- and its own matching exercise seeds review items", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const lesson2 = lessons.find((l) => l.slug === "al-fatiha-tracing-meaning")!;
    await resetLessonProgress(lesson2.id);
    const { client, userId } = await createTestUserClient();
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .in("item_key", ["concept:Ayah 3", "concept:Ayah 4", "concept:Ayah 6"]);

    const exercises = await fetchLessonExercises(request, lesson2.id);
    expect(exercises).toHaveLength(3);

    await page.goto(`/lesson/${lesson2.id}`);
    await expect(
      page.getByRole("heading", { name: "Tracing Meaning, Ayah by Ayah" }),
    ).toBeVisible();

    // Sections play one per step; 1:4's and 1:6's governed translation
    // text sit on later steps than the opening explanation.
    await advanceUntilVisibleResilient(
      page,
      exercises,
      "Sovereign of the Day of Recompense.",
      answerExercise,
    );
    await expect(page.getByText("Sovereign of the Day of Recompense.")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    // Section's own body prose quotes the ayah inline ("Ayah 6 -- 'Guide
    // us to the straight path' -- is the request...", mounted
    // immediately) and the section's own translation text is the same
    // phrase plus a trailing " -" (ayahs.translation_en for 1:6 is "Guide
    // us to the straight path -", mounted only once the ayah query
    // resolves) -- a bare substring match is ambiguous between them once
    // both are present (confirmed: this genuinely races, and CI's slower
    // timing consistently loses it, unlike a fast local machine, where
    // the assertion's very first check usually beats the query). Include
    // the trailing " -" so this can only match the translation text,
    // exactly how the "Sovereign of the Day of Recompense." check two
    // lines up already disambiguates via its own trailing period.
    await expect(page.getByText("Guide us to the straight path -")).toBeVisible();

    await completeLesson(page, exercises);
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    const { data: reviewItems } = await client
      .from("review_items")
      .select("item_key")
      .eq("user_id", userId)
      .in("item_key", ["concept:Ayah 3", "concept:Ayah 4", "concept:Ayah 6"]);
    expect(reviewItems).toHaveLength(3);
  });

  // Capstone: mirrors the Level 3/4/5 capstone precedent (pure synthesis,
  // zero matching exercises, zero new review items).
  test("the capstone lesson completes without creating any new review items", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const capstone = lessons.find((l) => l.slug === "al-fatiha-synthesis-praise-and-petition")!;
    await resetLessonProgress(capstone.id);
    const { client, userId } = await createTestUserClient();

    const exercises = await fetchLessonExercises(request, capstone.id);
    expect(exercises).toHaveLength(3);
    expect(exercises.some((e) => e.exercise_type === "matching")).toBe(false);

    const { count: beforeCount } = await client
      .from("review_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    await page.goto(`/lesson/${capstone.id}`);
    await expect(
      page.getByRole("heading", { name: "Synthesis: From Praise to Petition" }),
    ).toBeVisible();
    await completeLesson(page, exercises);
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
    // Advance through the sections and answer the first exercise only.
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
    // Exercise 0 is multiple_choice (radio choices); exercise 1 is
    // true_false (True/False buttons). Resuming correctly means exercise
    // 1's UI is what reappears after reload -- not exercise 0's, which
    // would mean the player silently restarted the lesson instead of
    // resuming past the already-answered step.
    await expect(page.getByRole("button", { name: "Check answer" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "True" })).toBeVisible();
    await expect(page.getByRole("button", { name: "False" })).toBeVisible();
    await expect(page.getByRole("radio", { name: exercises[0]!.payload.choices![0]! })).toHaveCount(
      0,
    );
  });

  test("renders correctly in French, including the real Arabic text and the existing translation-unavailable fallback for Al-Fatiha (Kazimirski has no local/CI data -- see LEVEL6-CONTENT-LEDGER.md §3.1)", async ({
    page,
    request,
  }) => {
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

    // Step 2 (the quran_example section for 1:1): the real Arabic text
    // still renders (governed, FK-fetched); the French Qur'an-text
    // translation is not available in this environment -- the existing,
    // pre-Level-6 fallback string shows instead of a blank or broken
    // section.
    await page.getByRole("button", { name: "Suivant" }).click();
    const ayahText = page.locator("[lang='ar']").first();
    await expect(ayahText).toBeVisible();
    await expect(
      page.getByText("Traduction française pas encore disponible pour ce verset."),
    ).toBeVisible();
  });

  // Regression coverage for the owner-controlled content-reduction pass
  // (LEVEL6-OWNER-REVIEW-CHECKLIST.md): asserts the specific neutral
  // wording that replaced every instance extending a "praise" claim to
  // ayah 4, and the "concrete" exercise-wording fix, actually render --
  // not just that exercises still grade correctly (answerExercise's
  // matching-exercise lookup already re-validates that generically by
  // reading whatever text is live in the DB, which would pass even if a
  // future edit silently reintroduced the disputed wording). This test
  // exists specifically to fail if that happens.
  test("the disputed 'ayah 4 is still praise' claim and the ayah-6/7 'concrete' ambiguity are not present, in English or French", async ({
    page,
    request,
  }) => {
    // Six lesson navigations (three lessons x two languages), more than
    // any other test in this file -- the default 30s test timeout is not
    // enough.
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const lesson1 = lessons.find((l) => l.slug === "al-fatiha-orientation-and-structure")!;
    const lesson2 = lessons.find((l) => l.slug === "al-fatiha-tracing-meaning")!;
    const capstone = lessons.find((l) => l.slug === "al-fatiha-synthesis-praise-and-petition")!;

    // Earlier tests in this file complete all three of these lessons;
    // reopening a completed lesson shows the completion screen immediately,
    // not its content, so this test needs its own clean slate for each.
    await resetLessonProgress(lesson1.id);
    await resetLessonProgress(lesson2.id);
    await resetLessonProgress(capstone.id);

    await page.goto(`/lesson/${lesson1.id}`);
    const lesson1Exercises = await fetchLessonExercises(request, lesson1.id);
    await advanceUntilVisibleResilient(
      page,
      lesson1Exercises,
      /Ayat 1 to 4 describe Allah, naming who He is\./,
      answerExercise,
    );
    await expect(page.getByText("Ayat 1 to 4 describe Allah, naming who He is.")).toBeVisible();
    await expect(page.getByText("Ayat 1 to 4 praise Allah", { exact: false })).not.toBeVisible();

    await resetLessonProgress(lesson2.id);
    await page.goto(`/lesson/${lesson2.id}`);
    const lesson2Exercises = await fetchLessonExercises(request, lesson2.id);
    await advanceUntilVisibleResilient(
      page,
      lesson2Exercises,
      /Like ayat 1 through 3, it describes Allah in the third person\./,
      answerExercise,
    );
    await expect(
      page.getByText("Like ayat 1 through 3, it describes Allah in the third person."),
    ).toBeVisible();
    await expect(page.getByText("It is still praise", { exact: false })).not.toBeVisible();

    await resetLessonProgress(capstone.id);
    await page.goto(`/lesson/${capstone.id}`);
    const capstoneExercises = await fetchLessonExercises(request, capstone.id);
    await advanceUntilVisibleResilient(
      page,
      capstoneExercises,
      /Which ayah first names the specific request/,
      answerExercise,
    );
    await expect(
      page.getByText(
        "Which ayah first names the specific request -- what exactly are we asking Allah for?",
      ),
    ).toBeVisible();
    await expect(page.getByText("makes the request concrete", { exact: false })).not.toBeVisible();

    // French: the same three checks, same lessons, French interface.
    // advanceUntilVisibleResilient/answerExercise only recognize English
    // button names ("Next"/"Complete lesson"/"Check answer"), so they
    // cannot drive a French-locale UI -- click "Suivant" directly the
    // fixed number of times needed to reach each target section, matching
    // this file's own existing French test's pattern (plain clicks, no
    // exercise answering needed since every target here is a section that
    // comes before this lesson's first exercise).
    async function clickSuivant(times: number) {
      for (let i = 0; i < times; i++) {
        await page.getByRole("button", { name: "Suivant" }).click();
      }
    }

    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      await resetLessonProgress(lesson1.id);
      await page.goto(`/lesson/${lesson1.id}`);
      await clickSuivant(2); // S0 -> S1 (quran_example 1:1) -> S2 (target)
      await expect(
        page.getByText("Les versets 1 à 4 décrivent Allah, en disant qui Il est."),
      ).toBeVisible();
      await expect(
        page.getByText("Les versets 1 à 4 louent Allah", { exact: false }),
      ).not.toBeVisible();

      await resetLessonProgress(lesson2.id);
      await page.goto(`/lesson/${lesson2.id}`);
      await clickSuivant(2); // S0 -> S1 (quran_example 1:3) -> S2 (target, ayah 4)
      await expect(
        page.getByText("Comme les versets 1 à 3, il décrit Allah à la troisième personne."),
      ).toBeVisible();
      await expect(page.getByText("encore de la louange", { exact: false })).not.toBeVisible();

      await resetLessonProgress(capstone.id);
      await page.goto(`/lesson/${capstone.id}`);
      await clickSuivant(4); // S0 -> S1 -> S2 -> S3 -> E0 (target, first exercise)
      await expect(
        page.getByText(
          "Quel verset nomme en premier la demande précise — que demandons-nous exactement à Allah ?",
        ),
      ).toBeVisible();
      await expect(
        page.getByText("rend la demande concrète pour la première fois", { exact: false }),
      ).not.toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("renders without horizontal overflow at 390x844", async ({ page, request }) => {
    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const lesson2 = lessons.find((l) => l.slug === "al-fatiha-tracing-meaning")!;
    // An earlier test in this file completes lesson2; reopening a
    // completed lesson shows the completion screen immediately, not its
    // content, so this test needs its own clean slate.
    await resetLessonProgress(lesson2.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lesson/${lesson2.id}`);
    await expect(
      page.getByRole("heading", { name: "Tracing Meaning, Ayah by Ayah" }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("exercise choices are keyboard-operable and have accessible names", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const capstone = lessons.find((l) => l.slug === "al-fatiha-synthesis-praise-and-petition")!;
    await resetLessonProgress(capstone.id);
    const exercises = await fetchLessonExercises(request, capstone.id);

    await page.goto(`/lesson/${capstone.id}`);
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
    // First exercise is multiple_choice -- its radio options must each
    // have a real accessible name (the choice text), reachable by
    // keyboard, not just by mouse click.
    const firstChoice = page.getByRole("radio", { name: exercises[0]!.payload.choices![0]! });
    await expect(firstChoice).toBeVisible();
    await firstChoice.focus();
    await expect(firstChoice).toBeFocused();
    await page.keyboard.press("Space");
    await expect(firstChoice).toBeChecked();
  });

  // Documents a real, pre-existing, systemic finding (LEVEL6-CONTENT-
  // LEDGER.md §5.3): no level in this app enforces prerequisite gating at
  // the URL/route layer. This is not new to Level 6 and this batch does
  // not fix it -- this test exists so a future fix (or a future
  // regression making it worse) is visible here, not just in the ledger.
  test("KNOWN GAP: a Level 6 lesson URL is directly reachable without completing Level 5 (systemic, pre-existing, not fixed by this batch)", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "al-fatiha-surah-study");
    const lesson1 = lessons.find((l) => l.slug === "al-fatiha-orientation-and-structure")!;
    const { client, userId } = await createTestUserClient();
    // Ensure this account has NOT completed Level 5.
    const level5Lessons = await fetchLevelLessons(request, "guided-ayah-comprehension");
    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        level5Lessons.map((l) => l.id),
      );

    await page.goto(`/lesson/${lesson1.id}`);
    // Today, this renders the real lesson content -- the same
    // no-server-side-gating behavior every other level in this app has.
    await expect(
      page.getByRole("heading", { name: "Al-Fatiha: The Complete Surah" }),
    ).toBeVisible();
  });
});

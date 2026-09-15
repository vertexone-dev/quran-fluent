import { test, expect, type APIRequestContext } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Level 2 final release-audit journey — the one integration gap that no
 * per-batch spec (32-35) exercises: what a real learner actually sees on
 * /dashboard immediately after finishing Level 1, before they ever learn
 * that /learning-plan exists.
 *
 * findLevel1EntryPoint (src/lib/curriculum.ts) is Level-1-scoped by
 * design and always will be -- it is what the dashboard's "Continue
 * Learning" card queries. The audit question is not "does the dashboard
 * know about Level 2" (it deliberately doesn't), but "does the dashboard,
 * once Level 1's own entry point reports completedCount === totalCount,
 * leave the learner at a dead end, or hand them off correctly?"
 *
 * Reading src/routes/_authenticated/dashboard.tsx shows the intended
 * design: once lessonEntryPoint exists but completedCount === totalCount,
 * the card renders the deliberately-hedged copy "You've completed all
 * lessons currently available." (not "all lessons complete" -- it never
 * claims there is nothing left) alongside a "View my learning path"
 * button/link to /learning-plan, which is where the already-proven
 * Level 2 resolver (specs 32-35) picks up correctly. This test verifies
 * that handoff actually renders and works end to end in a real browser,
 * rather than trusting the source reading alone.
 */

const LEVEL2_MODULES = [
  "long-vowels-and-orthography",
  "core-vocabulary-1",
  "core-vocabulary-2",
  "short-phrases",
  "vocabulary-capstone",
] as const;

async function apiGet(request: APIRequestContext, path: string) {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const res = await request.get(`${url}/rest/v1/${path}`, { headers: { apikey: anonKey } });
  return res.json();
}

async function fetchModuleLessons(request: APIRequestContext, slug: string) {
  const mods = (await apiGet(request, `modules?select=id&slug=eq.${slug}`)) as { id: string }[];
  return (await apiGet(request, `lessons?select=id,slug&module_id=eq.${mods[0]!.id}`)) as {
    id: string;
    slug: string;
  }[];
}

test.describe("Level 2 release audit: Level 1 -> Level 2 dashboard/learning-plan handoff", () => {
  test("learner who finishes Level 1 sees an honest, non-dead-end dashboard state that hands off correctly into Level 2 via /learning-plan, and the handoff still works once Level 2 is fully done too", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);

    const level1Mods = (await apiGet(
      request,
      "modules?select=id,levels!inner(slug)&levels.slug=eq.foundations-of-arabic-script",
    )) as { id: string }[];
    const level1Lessons: { id: string }[] = [];
    for (const m of level1Mods) {
      const lessons = (await apiGet(request, `lessons?select=id&module_id=eq.${m.id}`)) as {
        id: string;
      }[];
      level1Lessons.push(...lessons);
    }

    const lessonsByModule: Record<string, { id: string; slug: string }[]> = {};
    for (const slug of LEVEL2_MODULES) {
      lessonsByModule[slug] = await fetchModuleLessons(request, slug);
    }
    const allLevel2Lessons = Object.values(lessonsByModule).flat();

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        [...level1Lessons, ...allLevel2Lessons].map((l) => l.id),
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

    // Level 1 complete, Level 2 untouched -- the exact moment a real
    // learner would land back on /dashboard after their last Level 1
    // lesson.
    await markCompleted(level1Lessons);

    // A learning_paths/learning_path_steps row is required for
    // /learning-plan's PathTimeline to render the "vocabulary" step at
    // all (see the identical setup in specs 32-35) -- without it the
    // handoff link would 404 into an empty plan, which would itself be a
    // real defect, so this is part of what's under test, not a
    // workaround for it.
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
      PATH_STEPS.map((step, index) => ({
        path_id: newPath!.id,
        user_id: userId,
        step_key: step,
        order_index: index,
        status: index === 0 ? "in_progress" : index === 1 ? "available" : "locked",
        progress: 0,
        lesson_id: null,
      })),
    );

    await page.goto("/dashboard");

    // Must NOT still show a stale in-progress Level 1 lesson, and must
    // NOT claim total completion with no next step -- the actual, honest
    // design.
    await expect(page.getByText("You've completed all lessons currently available.")).toBeVisible();
    const handoffLink = page.getByRole("link", { name: "View my learning path" });
    await expect(
      handoffLink,
      "the dashboard must offer a working, non-dead-end escape hatch once Level 1 is done",
    ).toBeVisible();

    await handoffLink.click();
    await expect(page).toHaveURL(/\/learning-plan$/);

    // "Up next", not "In progress": this is the very first, zero-progress
    // visit to Level 2 (unlike specs 32-35's resolver tests, which only
    // ever check *after* some Level 2 progress already exists -- "In
    // progress" only appears once completedCount > 0 for the step). What
    // matters here is that the step is not "Locked" and offers a real,
    // working link -- not the exact status label.
    const vocabRow = page.locator("li", { hasText: "Qur'anic vocabulary" });
    await expect(vocabRow.getByText("Up next")).toBeVisible();
    await expect(vocabRow.getByText("Locked")).not.toBeVisible();
    const href = await vocabRow.getByRole("link").getAttribute("href");
    const module1LessonIds = new Set(
      lessonsByModule["long-vowels-and-orthography"]!.map((l) => l.id),
    );
    expect(
      module1LessonIds.has(href?.split("/lesson/")[1] ?? ""),
      "the learning-plan handoff must land on a real Level 2 lesson, not a dead link",
    ).toBe(true);

    // Now complete all of Level 2 too, and confirm the dashboard remains
    // in a sane, honest, non-broken state afterward (it is not expected
    // to ever mention Level 2 by name -- findLevel1EntryPoint is
    // deliberately Level-1-scoped -- but it must not error, must not
    // silently regress to a stale/blank state, and the same working
    // hand-off link must still be present).
    await markCompleted(allLevel2Lessons);
    await page.goto("/dashboard");
    await expect(page.getByText("You've completed all lessons currently available.")).toBeVisible();
    await expect(page.getByRole("link", { name: "View my learning path" })).toBeVisible();

    await page.goto("/learning-plan");
    await expect(vocabRow.getByText("Completed", { exact: true })).toBeVisible();
    await expect(vocabRow.getByRole("link", { name: "Review lesson" })).toBeVisible();
  });
});

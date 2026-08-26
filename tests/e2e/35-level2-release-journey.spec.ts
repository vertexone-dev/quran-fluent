import { test, expect, type APIRequestContext } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Level 2 release-journey smoke test — the Level 2 counterpart to
 * 31-level1-release-journey.spec.ts, proving the entire Level 2 module
 * chain end-to-end in one fresh walk, rather than relying on the
 * per-batch resolver checks in specs 32-34 (each of which only proves one
 * step of the chain).
 *
 * Unlike Level 1, the dashboard's "Continue learning" CTA is wired to
 * findLevel1EntryPoint specifically (src/routes/_authenticated/
 * dashboard.tsx) and never surfaces Level 2 lessons — this is pre-existing
 * behavior from Phase 4, unrelated to Level 2's own content batches, and
 * out of scope here (no Level 3/dashboard navigation work was requested).
 * The correct, already-proven mechanism for Level 2's own entry-point
 * resolution is the "vocabulary" step on /learning-plan's PathTimeline
 * (fetchStepEntryPoints / findCurriculumEntryPoint), exactly as specs
 * 32-34's own resolver tests already use — this spec just walks that same
 * mechanism across the *entire* chain in a single test, from a
 * Level-1-complete, Level-2-untouched starting state through to Level 2's
 * final "Completed" status.
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

test.describe("Level 2 release journey", () => {
  test("the 'vocabulary' learning-path step walks through all 5 real Level 2 modules in order as each is completed, and only reports 'Completed' once every real lesson is done", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
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
    const totalLevel2Lessons = Object.values(lessonsByModule).reduce((n, l) => n + l.length, 0);

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        [...level1Lessons, ...Object.values(lessonsByModule).flat()].map((l) => l.id),
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

    // Level 1 must be complete before the "vocabulary" step resyncs at
    // all (fetchStepEntryPoints' requiresLevelSlug gate).
    await markCompleted(level1Lessons);

    // fetchLearningPath's resync is a read-time projection over an
    // existing learning_paths/learning_path_steps row -- without one, the
    // PathTimeline never renders this li at all (see the identical setup
    // in 32/33/34-...spec.ts's own resolver tests).
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

    const vocabRow = page.locator("li", { hasText: "Qur'anic vocabulary" });
    await page.goto("/learning-plan");

    for (let i = 0; i < LEVEL2_MODULES.length; i++) {
      const slug = LEVEL2_MODULES[i]!;
      await markCompleted(lessonsByModule[slug]!);
      await page.reload();

      const nextSlug = LEVEL2_MODULES[i + 1];
      if (nextSlug) {
        await expect(
          vocabRow.getByText("In progress"),
          `after completing ${slug}, expected the vocabulary step still In progress`,
        ).toBeVisible();
        const href = await vocabRow.getByRole("link").getAttribute("href");
        const nextLessonIds = new Set(lessonsByModule[nextSlug]!.map((l) => l.id));
        expect(
          nextLessonIds.has(href?.split("/lesson/")[1] ?? ""),
          `link after ${slug} should point into ${nextSlug}, got href=${href}`,
        ).toBe(true);
      } else {
        // vocabulary-capstone was the last module completed -> Level 2 is
        // now fully done.
        await expect(vocabRow.getByText("Completed", { exact: true })).toBeVisible();
        await expect(vocabRow.getByRole("link", { name: "Review lesson" })).toBeVisible();
      }
    }

    const { count } = await client
      .from("user_lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .in(
        "lesson_id",
        Object.values(lessonsByModule)
          .flat()
          .map((l) => l.id),
      );
    expect(count).toBe(totalLevel2Lessons);
  });

  test("vocabulary-capstone is reachable and is the final Level 2 module", async ({ request }) => {
    // Scoped to Level 2 specifically: order_index is unique per level, not
    // globally (see the identical comment in
    // 31-level1-release-journey.spec.ts).
    const modules = (await apiGet(
      request,
      "modules?select=slug,order_index,levels!inner(slug)&levels.slug=eq.basic-vocabulary-and-patterns&order=order_index.asc",
    )) as { slug: string; order_index: number }[];
    expect(modules.map((m) => m.slug)).toEqual(LEVEL2_MODULES);
    expect(modules[modules.length - 1]!.slug).toBe("vocabulary-capstone");
  });
});

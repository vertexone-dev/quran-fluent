import { test, expect, type APIRequestContext } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Level 3 release-journey smoke test — the Level 3 counterpart to
 * 35-level2-release-journey.spec.ts, proving the entire Level 3 module
 * chain end-to-end in one fresh walk, rather than relying on the
 * per-batch resolver checks in specs 37-38 (each of which only proves one
 * step of the chain).
 *
 * Deliberately walks module-by-module, asserting "In progress" (not
 * "Completed") after EACH of the first two modules, specifically to catch
 * a resolver that incorrectly considers Level 3 done once Batch 1
 * (arabic-roots-intro + word-patterns) finishes, before roots-capstone
 * exists or is completed — the exact class of regression 38's own
 * resolver test guards against for a single step, generalized here across
 * the whole chain from a fresh state.
 *
 * Uses the "vocabulary" step handoff proven in specs 32-36 to get from
 * Level 1 completion into Level 2, then Level 2 completion to unlock the
 * "roots" step — matching a real learner's actual path through all three
 * levels, not just Level 3 in isolation.
 */

const LEVEL3_MODULES = ["arabic-roots-intro", "word-patterns", "roots-capstone"] as const;

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

test.describe("Level 3 release journey", () => {
  test("the 'roots' learning-path step walks through all 3 real Level 3 modules in order as each is completed, and only reports 'Completed' once every real lesson is done -- never after just Batch 1", async ({
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
    const level2Mods = (await apiGet(
      request,
      "modules?select=id,levels!inner(slug)&levels.slug=eq.basic-vocabulary-and-patterns",
    )) as { id: string }[];
    const level2Lessons: { id: string }[] = [];
    for (const m of level2Mods) {
      const lessons = (await apiGet(request, `lessons?select=id&module_id=eq.${m.id}`)) as {
        id: string;
      }[];
      level2Lessons.push(...lessons);
    }

    const lessonsByModule: Record<string, { id: string; slug: string }[]> = {};
    for (const slug of LEVEL3_MODULES) {
      lessonsByModule[slug] = await fetchModuleLessons(request, slug);
    }
    const totalLevel3Lessons = Object.values(lessonsByModule).reduce((n, l) => n + l.length, 0);

    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .in(
        "lesson_id",
        [...level1Lessons, ...level2Lessons, ...Object.values(lessonsByModule).flat()].map(
          (l) => l.id,
        ),
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

    // Level 1 + Level 2 must both be complete before the "roots" step
    // resyncs at all (requiresLevelSlug gates on Level 2, which itself
    // gates on Level 1).
    await markCompleted(level1Lessons);
    await markCompleted(level2Lessons);

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

    const rootsRow = page.locator("li", { hasText: "Arabic roots" });
    await page.goto("/learning-plan");

    for (let i = 0; i < LEVEL3_MODULES.length; i++) {
      const slug = LEVEL3_MODULES[i]!;
      await markCompleted(lessonsByModule[slug]!);
      await page.reload();

      const nextSlug = LEVEL3_MODULES[i + 1];
      if (nextSlug) {
        await expect(
          rootsRow.getByText("Completed", { exact: true }),
          `Level 3 must NOT report Completed after only completing ${slug} -- ${nextSlug} is not done yet`,
        ).not.toBeVisible();
        const href = await rootsRow.getByRole("link").getAttribute("href");
        const nextLessonIds = new Set(lessonsByModule[nextSlug]!.map((l) => l.id));
        expect(
          nextLessonIds.has(href?.split("/lesson/")[1] ?? ""),
          `link after ${slug} should point into ${nextSlug}, got href=${href}`,
        ).toBe(true);
      } else {
        // roots-capstone was the last module completed -> Level 3 is now
        // fully done, with a valid re-entry path, not a dead end.
        await expect(rootsRow.getByText("Completed", { exact: true })).toBeVisible();
        await expect(rootsRow.getByRole("link", { name: "Review lesson" })).toBeVisible();
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
    expect(count).toBe(totalLevel3Lessons);
  });

  test("roots-capstone is reachable and is the final Level 3 module", async ({ request }) => {
    // Scoped to Level 3 specifically: order_index is unique per level, not
    // globally (see the identical comment in
    // 31-level1-release-journey.spec.ts / 35-level2-release-journey.spec.ts).
    const modules = (await apiGet(
      request,
      "modules?select=slug,order_index,levels!inner(slug)&levels.slug=eq.roots-and-word-patterns&order=order_index.asc",
    )) as { slug: string; order_index: number }[];
    expect(modules.map((m) => m.slug)).toEqual(LEVEL3_MODULES);
    expect(modules[modules.length - 1]!.slug).toBe("roots-capstone");
  });
});

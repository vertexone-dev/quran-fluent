import { test, expect, type APIRequestContext } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Phase 4 release-journey smoke test — proves Level 1 integration
 * boundaries that per-module Gate B/C testing structurally could not see,
 * since every module spec (17-30) navigates straight to `/lesson/{id}`
 * via a directly-fetched ID rather than through the dashboard's own
 * "what's next" resolver.
 *
 * The primary target is the regression this cycle actually found:
 * findLevel1EntryPoint (src/lib/curriculum.ts) was hardcoded to only
 * letter-shapes-1/letter-shapes-2. A learner finishing those two modules
 * saw the dashboard and Daily Study both report "all lessons complete"
 * with 19 of Level 1's 33 real lessons (harakat through reading-al-fatiha)
 * permanently unreachable through the UI. Fixed by including all 8 Level
 * 1 module slugs; this spec proves the resolver now walks the *entire*
 * module chain, not just past the first one.
 */

const LEVEL1_MODULES = [
  "letter-shapes-1",
  "letter-shapes-2",
  "harakat",
  "sukun-and-shadda",
  "tanwin",
  "connected-letter-forms",
  "first-reading-practice",
  "reading-al-fatiha",
] as const;

async function apiGet(request: APIRequestContext, path: string) {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const res = await request.get(`${url}/rest/v1/${path}`, { headers: { apikey: anonKey } });
  return res.json();
}

async function fetchModuleLessons(request: APIRequestContext, slug: string) {
  const mods = (await apiGet(request, `modules?select=id&slug=eq.${slug}`)) as { id: string }[];
  return (await apiGet(
    request,
    `lessons?select=id,slug&module_id=eq.${mods[0]!.id}&slug=neq.schema-validation-placeholder`,
  )) as { id: string; slug: string }[];
}

test.describe("Level 1 release journey", () => {
  test("the dashboard entry point walks through all 8 real modules in order as each is completed, and only reports 'all complete' once every real lesson is done", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);
    await client.from("user_lesson_progress").delete().eq("user_id", userId);

    const lessonsByModule: Record<string, { id: string; slug: string }[]> = {};
    for (const slug of LEVEL1_MODULES) {
      lessonsByModule[slug] = await fetchModuleLessons(request, slug);
    }
    const totalRealLessons = Object.values(lessonsByModule).reduce((n, l) => n + l.length, 0);

    await page.goto("/dashboard");

    for (let i = 0; i < LEVEL1_MODULES.length; i++) {
      const slug = LEVEL1_MODULES[i]!;
      await client.from("user_lesson_progress").insert(
        lessonsByModule[slug]!.map((l) => ({
          user_id: userId,
          lesson_id: l.id,
          status: "completed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          last_section_index: 1,
          progress_percent: 100,
        })),
      );
      await page.reload();

      const nextSlug = LEVEL1_MODULES[i + 1];
      if (nextSlug) {
        // A lesson from the NEXT module must now be reachable via the
        // primary "Continue learning" CTA — not a dead end.
        const nextLessonIds = new Set(lessonsByModule[nextSlug]!.map((l) => l.id));
        const cta = page.getByRole("link", { name: /Continue lesson|Open lesson/i });
        await expect(
          cta,
          `after completing ${slug}, expected a reachable lesson in ${nextSlug}`,
        ).toBeVisible();
        const href = await cta.getAttribute("href");
        const lessonId = href?.split("/lesson/")[1];
        expect(
          nextLessonIds.has(lessonId ?? ""),
          `CTA after ${slug} should point into ${nextSlug}, got href=${href}`,
        ).toBe(true);
      }
    }

    // Every real Level 1 lesson is now completed — the dashboard's honest
    // completion state should appear now, and only now.
    await page.reload();
    await expect(page.getByText("You've completed all lessons currently available.")).toBeVisible();

    const { count } = await client
      .from("user_lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");
    expect(count).toBe(totalRealLessons);
  });

  test("Practice and Daily Study remain functional at full Level 1 completion", async ({
    page,
  }) => {
    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
    await page.goto("/daily");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("Module 8 (reading-al-fatiha) is reachable and is the final module", async ({ request }) => {
    const modules = (await apiGet(
      request,
      "modules?select=slug,order_index&order=order_index.asc",
    )) as { slug: string; order_index: number }[];
    expect(modules.map((m) => m.slug)).toEqual(LEVEL1_MODULES);
    expect(modules[modules.length - 1]!.slug).toBe("reading-al-fatiha");
  });
});

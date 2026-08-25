import { test, expect, type APIRequestContext } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers Sub-phase 2.4 — the first chunk of Level 1 Module 2 ("Letter
 * Shapes II"), seeded by migration 20260824100000. Five real lessons
 * (Sīn/Shīn; Ṣād/Ḍād; Ṭā'/Ẓā'; ʿAyn/Ghayn; Fā'/Qāf), each a two-letter
 * dot-pair using the exact section/exercise template proven by the
 * Sub-phase 2.3 pilot's own Lesson 4. This chunk deliberately covers only
 * 10 of the module's 17 letters — the module is not yet complete, and
 * nothing here claims otherwise.
 */

async function apiGet(request: APIRequestContext, path: string) {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const res = await request.get(`${url}/rest/v1/${path}`, { headers: { apikey: anonKey } });
  return res.json();
}

async function fetchLessonId(request: APIRequestContext, slug: string): Promise<string> {
  const rows = (await apiGet(request, `lessons?select=id&slug=eq.${slug}`)) as { id: string }[];
  if (rows.length !== 1) throw new Error(`Lesson "${slug}" not found.`);
  return rows[0]!.id;
}

test.describe("Level 1 Module 2 (Letter Shapes II, chunk 1)", () => {
  test("the 5 chunk-1 lessons exist, in order, at the start of the module", async ({ request }) => {
    const moduleRows = (await apiGet(request, "modules?select=id&slug=eq.letter-shapes-2")) as {
      id: string;
    }[];
    const moduleId = moduleRows[0]!.id;

    // Scoped to the first 5 (chunk 1's own lessons), not "every lesson in
    // the module" — chunk 2 legitimately added 4 more after this shipped.
    const lessons = (await apiGet(
      request,
      `lessons?select=slug,order_index&module_id=eq.${moduleId}&order=order_index.asc&limit=5`,
    )) as { slug: string; order_index: number }[];

    expect(lessons.map((l) => l.slug)).toEqual([
      "sin-and-shin",
      "sad-and-dad",
      "ta2-and-za2",
      "ayn-and-ghayn",
      "fa2-and-qaf",
    ]);
    expect(lessons.map((l) => l.order_index)).toEqual([0, 1, 2, 3, 4]);
  });

  test("the pilot module (letter-shapes-1) is unchanged and no other module received content", async ({
    request,
  }) => {
    const pilotModule = (await apiGet(request, "modules?select=id&slug=eq.letter-shapes-1")) as {
      id: string;
    }[];
    const pilotLessons = (await apiGet(
      request,
      `lessons?select=slug&module_id=eq.${pilotModule[0]!.id}`,
    )) as unknown[];
    expect(pilotLessons.length).toBe(5); // 4 real + placeholder, unchanged from 2.3

    const otherModules = (await apiGet(
      request,
      "modules?select=id,slug&slug=neq.letter-shapes-1&slug=neq.letter-shapes-2&slug=neq.harakat&slug=neq.sukun-and-shadda&slug=neq.tanwin&slug=neq.connected-letter-forms",
    )) as { id: string; slug: string }[];
    expect(otherModules.length).toBe(2);
    for (const m of otherModules) {
      const lessons = (await apiGet(
        request,
        `lessons?select=id&module_id=eq.${m.id}`,
      )) as unknown[];
      expect(lessons, `module ${m.slug} should still have zero lessons`).toEqual([]);
    }
  });

  test("Lesson 1 (Sīn & Shīn) sections render in order, in English", async ({ page, request }) => {
    const lessonId = await fetchLessonId(request, "sin-and-shin");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);

    await expect(page.getByRole("heading", { level: 1, name: "Sīn & Shīn: س ش" })).toBeVisible();
    await expect(page.getByText("These two letters share the same base shape")).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText("Sīn (س) has no dots at all — just three small teeth."),
    ).toBeVisible();
  });

  test("a letter_recognition exercise renders real choices and a matching exercise renders real pairs", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "sad-and-dad");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);

    // Steps: explanation(0), ص(1), letter_recognition(2, attached to 1).
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Which letter has NO dot?")).toBeVisible();
    await expect(page.getByRole("radio", { name: "ص" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "ض" })).toBeVisible();
  });

  test("Lesson 4 (ʿAyn & Ghayn) renders the special ʿ character correctly in French", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "ayn-and-ghayn");
    await resetLessonProgress(lessonId);
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(
        page.getByRole("heading", { level: 1, name: "ʿAyn et Ghayn : ع غ" }),
      ).toBeVisible();
      await expect(
        page.getByText("une forme courbe et ouverte — imaginez un petit crochet"),
      ).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("Arabic letter content renders RTL while the interface stays LTR", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "sin-and-shin");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await page.getByRole("button", { name: "Next" }).click();
    const arabic = page.locator('[dir="rtl"][lang="ar"]').first();
    await expect(arabic).toBeVisible();
    await expect(arabic).toHaveText("س");
  });

  test.describe
    .serial("full lifecycle on Lesson 3 (Ṭā' & Ẓā'), including a matching exercise as the final completion step", () => {
    let lessonId: string;

    test.beforeAll(async ({ request }) => {
      lessonId = await fetchLessonId(request, "ta2-and-za2");
    });

    test("starting the lesson persists in_progress", async ({ page }) => {
      await resetLessonProgress(lessonId);
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.getByRole("heading", { level: 1, name: "Ṭā' & Ẓā': ط ظ" })).toBeVisible();

      const { client, userId } = await createTestUserClient();
      await expect
        .poll(async () => {
          const { data } = await client
            .from("user_lesson_progress")
            .select("status")
            .eq("user_id", userId)
            .eq("lesson_id", lessonId)
            .single();
          return data?.status;
        })
        .toBe("in_progress");
    });

    test("refreshing mid-exercise resumes at the same step", async ({ page }) => {
      await page.goto(`/lesson/${lessonId}`);
      // Steps: explanation(0), ط(1), letter_recognition(2, attached to 1).
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText("Which letter has NO dot?")).toBeVisible();

      // Position is persisted fire-and-forget (not awaited by the click
      // handler), so the UI can advance before the write lands. Reloading
      // immediately after only confirming local UI state races that write
      // — wait for the database to actually reflect step 2 first, so the
      // reload has something real to resume from.
      const { client, userId } = await createTestUserClient();
      await expect
        .poll(async () => {
          const { data } = await client
            .from("user_lesson_progress")
            .select("last_section_index")
            .eq("user_id", userId)
            .eq("lesson_id", lessonId)
            .single();
          return data?.last_section_index;
        })
        .toBe(2);

      await page.reload();
      await expect(page.getByText("Which letter has NO dot?")).toBeVisible();
    });

    test("answering the first exercise correctly records a correct attempt", async ({ page }) => {
      await page.goto(`/lesson/${lessonId}`);
      await page.getByRole("radio", { name: "ط" }).click();
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

    test("advancing to and answering the second exercise incorrectly records an incorrect attempt", async ({
      page,
    }) => {
      await page.goto(`/lesson/${lessonId}`);
      // Resumes on the first exercise's step — but only *position*
      // persists across a fresh load, not per-exercise answered state (an
      // established, documented player behavior since Sub-phase 2.2), so
      // it resumes unanswered and must be answered again before Next
      // unlocks, exactly like the pilot's equivalent test.
      await expect(page.getByText("Which letter has NO dot?")).toBeVisible();
      await page.getByRole("radio", { name: "ط" }).click();
      await page.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();

      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText("Which letter has one dot above?")).toBeVisible();

      // Wrong answer on purpose: ط has no dot, so it is not the letter
      // with a dot above.
      await page.getByRole("radio", { name: "ط" }).click();
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
      expect(count).toBe(3);
      expect(data[0]?.correct).toBe(false);

      // The two Next clicks above persist position fire-and-forget (the
      // same asymmetry documented in the previous test) — wait for the
      // write to actually land before the next test navigates fresh, or
      // that navigation can race it and resume at a stale, earlier step.
      await expect
        .poll(async () => {
          const { data: progress } = await client
            .from("user_lesson_progress")
            .select("last_section_index")
            .eq("user_id", userId)
            .eq("lesson_id", lessonId)
            .single();
          return progress?.last_section_index;
        })
        .toBe(4);
    });

    test("completing the lesson via the final matching exercise persists completed status", async ({
      page,
    }) => {
      await page.goto(`/lesson/${lessonId}`);
      // Resumes on the second exercise's step, unanswered again (see the
      // previous test's comment on why) — answer it before advancing
      // through tip and summary to the final matching exercise.
      await expect(page.getByText("Which letter has one dot above?")).toBeVisible();
      await page.getByRole("radio", { name: "ظ" }).click();
      await page.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();

      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText("Match each letter to its name.")).toBeVisible();

      const comboboxes = page.getByRole("combobox");
      await comboboxes.nth(0).click();
      await page.getByRole("option", { name: "Ṭā'" }).click();
      await comboboxes.nth(1).click();
      await page.getByRole("option", { name: "Ẓā'" }).click();
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

    test("reopening the completed lesson shows the completion screen immediately", async ({
      page,
    }) => {
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.getByText("Lesson complete!")).toBeVisible();
    });
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("a module-2 lesson renders without horizontal overflow on a small screen", async ({
      page,
      request,
    }) => {
      const lessonId = await fetchLessonId(request, "sad-and-dad");
      await resetLessonProgress(lessonId);
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.getByRole("heading", { level: 1, name: "Ṣād & Ḍād: ص ض" })).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasOverflow).toBe(false);
    });
  });
});

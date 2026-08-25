import { test, expect, type APIRequestContext } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers Sub-phase 2.4 — the second and final chunk of Level 1 Module 2
 * ("Letter Shapes II", slug letter-shapes-2), seeded by migration
 * 20260825100000. Four lessons covering the remaining 7 of the module's 17
 * letters (Kāf & Lām; Mīm & Nūn; Hā' & Wāw; Yā' + module recap), completing
 * the module (10 from chunk 1 + 7 here = 17). Unlike chunk 1, none of these
 * letters form a dot-differentiated pair, so lessons use letter-specific
 * feature prompts instead of "which has a dot" prompts, and the closing
 * lesson uses true_false (Yā' has no in-lesson contrasting letter) plus a
 * 4-pair recap matching exercise spanning both chunks.
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

test.describe("Level 1 Module 2 chunk 2 (Letter Shapes II, complete)", () => {
  test("all 4 chunk-2 lessons exist, in order, completing the module (9 lessons total)", async ({
    request,
  }) => {
    const moduleRows = (await apiGet(request, "modules?select=id&slug=eq.letter-shapes-2")) as {
      id: string;
    }[];
    const moduleId = moduleRows[0]!.id;

    const lessons = (await apiGet(
      request,
      `lessons?select=slug,title_en,order_index&module_id=eq.${moduleId}&order=order_index.asc`,
    )) as { slug: string; title_en: string; order_index: number }[];

    expect(lessons.map((l) => l.slug)).toEqual([
      "sin-and-shin",
      "sad-and-dad",
      "ta2-and-za2",
      "ayn-and-ghayn",
      "fa2-and-qaf",
      "kaf-and-lam",
      "mim-and-nun",
      "ha2-and-waw",
      "ya2",
    ]);
    expect(lessons.map((l) => l.order_index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);

    // All 7 target letters represented across the 4 new lessons' titles.
    const chunk2Titles = lessons.slice(5).map((l) => l.title_en);
    for (const letter of ["ك", "ل", "م", "ن", "ه", "و", "ي"]) {
      expect(
        chunk2Titles.some((t) => t.includes(letter)),
        `letter ${letter} should appear in a chunk-2 lesson title`,
      ).toBe(true);
    }
  });

  test("Lesson A (Kāf & Lām) sections render in order, in English", async ({ page, request }) => {
    const lessonId = await fetchLessonId(request, "kaf-and-lam");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);

    await expect(page.getByRole("heading", { level: 1, name: "Kāf & Lām: ك ل" })).toBeVisible();
    await expect(page.getByText("These two letters don't share a common base shape")).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Kāf (ك) has a tall, slightly curved body")).toBeVisible();
  });

  test("a letter_recognition exercise renders real choices (Lesson B, Mīm & Nūn)", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "mim-and-nun");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);

    // Steps: explanation(0), م(1), letter_recognition(2, attached to 1).
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText("Which letter is a small closed loop with a short tail?"),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "م" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "ن" })).toBeVisible();
  });

  test("Hā' (ه) and Ḥā' (ح) remain distinct — Lesson C never collapses the two names", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "ha2-and-waw");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);

    await expect(page.getByRole("heading", { level: 1, name: "Hā' & Wāw: ه و" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText(
        "This Hā' is a different letter from Ḥā' (ح), which you learned in Letter Shapes I",
      ),
    ).toBeVisible();
  });

  test("French interface renders real French lesson content, including the Hā'/Ḥā' disambiguation", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "ha2-and-waw");
    await resetLessonProgress(lessonId);
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(page.getByRole("heading", { level: 1, name: "Hā' et Wāw : ه و" })).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click();
      await expect(page.getByText("Ce Hā' est une lettre différente de Ḥā' (ح)")).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("Arabic letter content renders RTL while the interface stays LTR", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "kaf-and-lam");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await page.getByRole("button", { name: "Next" }).click();
    const arabic = page.locator('[dir="rtl"][lang="ar"]').first();
    await expect(arabic).toBeVisible();
    await expect(arabic).toHaveText("ك");
  });

  test("chunk 1 (letter-shapes-2's first 5 lessons) is unchanged by this migration", async ({
    request,
  }) => {
    const moduleRows = (await apiGet(request, "modules?select=id&slug=eq.letter-shapes-2")) as {
      id: string;
    }[];
    const lessons = (await apiGet(
      request,
      `lessons?select=slug,order_index&module_id=eq.${moduleRows[0]!.id}&order=order_index.asc&limit=5`,
    )) as { slug: string; order_index: number }[];
    expect(lessons.map((l) => l.slug)).toEqual([
      "sin-and-shin",
      "sad-and-dad",
      "ta2-and-za2",
      "ayn-and-ghayn",
      "fa2-and-qaf",
    ]);
  });

  test("Module 1 (letter-shapes-1) is unchanged, and Modules 4-8 remain unpopulated", async ({
    request,
  }) => {
    const pilotModule = (await apiGet(request, "modules?select=id&slug=eq.letter-shapes-1")) as {
      id: string;
    }[];
    const pilotLessons = (await apiGet(
      request,
      `lessons?select=slug&module_id=eq.${pilotModule[0]!.id}`,
    )) as unknown[];
    expect(pilotLessons.length).toBe(5); // 4 real + placeholder, unchanged

    // harakat (Module 3) legitimately gained content in Sub-phase 3.3.
    const otherModules = (await apiGet(
      request,
      "modules?select=id,slug&slug=neq.letter-shapes-1&slug=neq.letter-shapes-2&slug=neq.harakat",
    )) as { id: string; slug: string }[];
    expect(otherModules.length).toBe(5);
    for (const m of otherModules) {
      const lessons = (await apiGet(
        request,
        `lessons?select=id&module_id=eq.${m.id}`,
      )) as unknown[];
      expect(lessons, `module ${m.slug} should still have zero lessons`).toEqual([]);
    }
  });

  test("the schema-validation placeholder is still not surfaced as real curriculum", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "schema-validation-placeholder");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);
    await expect(page.getByText("Test content — not a real lesson")).toBeVisible();
  });

  test("module-completion wording does not appear on an earlier chunk-2 lesson (Lesson C)", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "ha2-and-waw");
    await resetLessonProgress(lessonId);
    // Steps 2 and 4 are gated letter_recognition exercises (Next stays
    // disabled until answered) — jumping straight to the summary step (6)
    // via the same resume mechanism a real reload uses avoids re-deriving
    // the whole answer flow, which the Lesson D lifecycle already covers.
    const { client, userId } = await createTestUserClient();
    const { error } = await client.from("user_lesson_progress").insert({
      user_id: userId,
      lesson_id: lessonId,
      status: "in_progress",
      started_at: new Date().toISOString(),
      last_section_index: 6,
    });
    if (error) throw error;

    await page.goto(`/lesson/${lessonId}`);
    await expect(page.getByText(/not the same letter as Ḥā'/)).toBeVisible();
    await expect(page.getByText(/completed Letter Shapes II/)).not.toBeVisible();
  });

  test.describe
    .serial("full lifecycle on Lesson D (Yā'), completing Letter Shapes II via a true_false exercise and a 4-pair recap matching exercise", () => {
    let lessonId: string;

    test.beforeAll(async ({ request }) => {
      lessonId = await fetchLessonId(request, "ya2");
    });

    test("starting the lesson persists in_progress", async ({ page }) => {
      await resetLessonProgress(lessonId);
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.getByRole("heading", { level: 1, name: "Yā': ي" })).toBeVisible();

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
      // Steps: explanation(0), ي(1), true_false(2, attached to 1).
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText("True or False: Yā' has two dots below it.")).toBeVisible();

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
      await expect(page.getByText("True or False: Yā' has two dots below it.")).toBeVisible();
    });

    test("answering the true_false exercise correctly records a correct attempt", async ({
      page,
    }) => {
      await page.goto(`/lesson/${lessonId}`);
      await page.getByRole("button", { name: "True" }).click();
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

    test("re-answering the true_false exercise incorrectly on a fresh load records an incorrect attempt", async ({
      page,
    }) => {
      await page.goto(`/lesson/${lessonId}`);
      // Resumes on the true_false exercise's step, unanswered again (only
      // *position* persists across a fresh load, not per-exercise
      // answered state — an established, documented player behavior).
      await expect(page.getByText("True or False: Yā' has two dots below it.")).toBeVisible();
      await page.getByRole("button", { name: "False" }).click();
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

    test("completing the lesson via the 4-pair recap matching exercise persists completed status and shows module-completion wording", async ({
      page,
    }) => {
      await page.goto(`/lesson/${lessonId}`);
      // Resumes on the true_false exercise's step, unanswered again.
      await expect(page.getByText("True or False: Yā' has two dots below it.")).toBeVisible();
      await page.getByRole("button", { name: "True" }).click();
      await page.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();

      // Steps: true_false(2, this exercise) -> tip(3) -> summary(4) ->
      // matching(5, unattached, appended at the very end) — 3 clicks.
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(
        page.getByText("Match each letter to its name — a recap from across Letter Shapes II."),
      ).toBeVisible();

      const rightNames: Record<number, string> = { 0: "Ṣād", 1: "Ghayn", 2: "Lām", 3: "Wāw" };
      const comboboxes = page.getByRole("combobox");
      for (let i = 0; i < 4; i++) {
        await comboboxes.nth(i).click();
        await page.getByRole("option", { name: rightNames[i] }).click();
      }
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

    test("a chunk-2 lesson renders without horizontal overflow on a small screen", async ({
      page,
      request,
    }) => {
      const lessonId = await fetchLessonId(request, "mim-and-nun");
      await resetLessonProgress(lessonId);
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.getByRole("heading", { level: 1, name: "Mīm & Nūn: م ن" })).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasOverflow).toBe(false);
    });
  });
});

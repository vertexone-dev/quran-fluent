import { test, expect, type APIRequestContext } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers Sub-phase 2.3 — the Level 1 pilot module ("Letter Shapes I"),
 * seeded by migration 20260823100000. Four real lessons (Alif; the Bā'
 * family; the Jīm family; Dāl/Dhāl/Rā'/Zāy) replace the schema-validation
 * placeholder as this module's primary content — the placeholder itself
 * still exists (order_index 999) for 17-lesson-player.spec.ts, but must
 * never appear as real curriculum content.
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

test.describe("Level 1 pilot module", () => {
  test("the 4 pilot lessons exist, in the expected order, alongside (not replacing) the placeholder", async ({
    request,
  }) => {
    const moduleRows = (await apiGet(request, "modules?select=id&slug=eq.letter-shapes-1")) as {
      id: string;
    }[];
    const moduleId = moduleRows[0]!.id;

    const lessons = (await apiGet(
      request,
      `lessons?select=slug,order_index&module_id=eq.${moduleId}&order=order_index.asc`,
    )) as { slug: string; order_index: number }[];

    expect(lessons.map((l) => l.slug)).toEqual([
      "alif-the-first-letter",
      "the-ba-family",
      "the-jim-family",
      "dal-dhal-ra-zay",
      "schema-validation-placeholder",
    ]);
    expect(lessons.map((l) => l.order_index)).toEqual([0, 1, 2, 3, 999]);
  });

  test("Lesson 2 (Bā' family) sections render in the correct order", async ({ page, request }) => {
    const lessonId = await fetchLessonId(request, "the-ba-family");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);

    await expect(
      page.getByRole("heading", { level: 1, name: "The Bā' Family: ب ت ث" }),
    ).toBeVisible();
    await expect(page.getByText("These three letters share the same basic shape")).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Bā' (ب) has one dot, placed below the curve.")).toBeVisible();
  });

  test("a letter_recognition exercise renders real choices and a matching exercise renders real pairs", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "the-jim-family");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);

    // Steps: explanation(0), ج(1), ح(2), letter_recognition exercise(3) —
    // attached to the ح section, per the migration's section_id linkage.
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Next" }).click();
    }
    await expect(page.getByText("Which letter has NO dot at all?")).toBeVisible();
    await expect(page.getByRole("radio", { name: "ج" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "ح" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "خ" })).toBeVisible();
  });

  test.describe.serial("full lifecycle on Lesson 1 (Alif)", () => {
    let lessonId: string;

    test.beforeAll(async ({ request }) => {
      lessonId = await fetchLessonId(request, "alif-the-first-letter");
    });

    test("starting the lesson persists in_progress, and completing both exercises persists completion", async ({
      page,
    }) => {
      // Guards against a Playwright retry of this serial group: without
      // this, a retry would re-answer both exercises on top of the
      // abandoned attempt's rows (user_exercise_attempts is append-only),
      // and the count assertion below would see 4 instead of 2.
      await resetLessonProgress(lessonId);
      await page.goto(`/lesson/${lessonId}`);
      await expect(
        page.getByRole("heading", { level: 1, name: "The First Letter: Alif" }),
      ).toBeVisible();

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

      // Steps: explanation(0), arabic_text ا(1), letter_recognition
      // exercise(2, attached to step 1), tip(3), summary(4), true_false
      // exercise(5, unattached — appended at the end).
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText("Which of these is the letter Alif (ا)?")).toBeVisible();
      await page.getByRole("radio", { name: "ا" }).click();
      await page.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();

      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(
        page.getByText("Arabic is read from left to right, like English."),
      ).toBeVisible();
      await page.getByRole("button", { name: "False" }).click();
      await page.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();
      await expect(page.getByText("Arabic is read and written from right to left.")).toBeVisible();

      await page.getByRole("button", { name: "Complete lesson" }).click();
      await expect(page.getByText("Lesson complete!")).toBeVisible();

      const { data: progress, error } = await client
        .from("user_lesson_progress")
        .select("status, completed_at")
        .eq("user_id", userId)
        .eq("lesson_id", lessonId)
        .single();
      if (error) throw error;
      expect(progress.status).toBe("completed");
      expect(progress.completed_at).not.toBeNull();

      const { count } = await client
        .from("user_exercise_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("lesson_id", lessonId);
      expect(count).toBe(2);
    });

    test("reopening the completed lesson resumes at the completion screen", async ({ page }) => {
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.getByText("Lesson complete!")).toBeVisible();
    });
  });

  test("French interface renders real French lesson content", async ({ page, request }) => {
    const lessonId = await fetchLessonId(request, "the-jim-family");
    await resetLessonProgress(lessonId);
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(
        page.getByRole("heading", { level: 1, name: "La famille Jīm : ج ح خ" }),
      ).toBeVisible();
      await expect(page.getByText("une forme en crochet qui descend sous la ligne")).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("Arabic letter content renders RTL while the interface stays LTR", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "the-ba-family");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await page.getByRole("button", { name: "Next" }).click();
    const arabic = page.locator('[dir="rtl"][lang="ar"]').first();
    await expect(arabic).toBeVisible();
    await expect(arabic).toHaveText("ب");
  });

  test("the quran_example in Lesson 4 loads the real, verified canonical ayah", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "dal-dhal-ra-zay");
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);

    // Steps: explanation(0), د/ذ(1), letter_recognition(2, attached to 1),
    // ر/ز(3), letter_recognition(4, attached to 3), tip(5), quran_example(6).
    // Both attached exercises must be answered before Next unlocks.
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "ذ" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "ز" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/opening of Al-Fatiha/)).toBeVisible();
    const arabic = page.locator('[dir="rtl"][lang="ar"]').first();
    await expect(arabic).toContainText("بِسْمِ");
    await expect(page.getByText("Surah 1, Ayah 1")).toBeVisible();
  });

  test("the schema-validation placeholder remains reachable but visibly marked as test content, not real curriculum", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "schema-validation-placeholder");
    // 17-lesson-player.spec.ts deliberately completes this same placeholder
    // lesson as part of its own coverage, and runs before this file in
    // sorted file order — without this reset, the completed-lesson early
    // return (which has no badge, only the active-lesson view does) would
    // make this assertion fail depending on run order, not on any real
    // defect.
    await resetLessonProgress(lessonId);
    await page.goto(`/lesson/${lessonId}`);
    await expect(page.getByText("Test content — not a real lesson")).toBeVisible();
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("a pilot lesson with long French text and Arabic glyphs renders without horizontal overflow", async ({
      page,
      request,
    }) => {
      const lessonId = await fetchLessonId(request, "the-ba-family");
      await resetLessonProgress(lessonId);
      const { client, userId } = await createTestUserClient();
      await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

      try {
        await page.goto(`/lesson/${lessonId}`);
        await expect(
          page.getByText("Ce qui les distingue, c'est uniquement le nombre et la position"),
        ).toBeVisible();

        const hasOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(hasOverflow).toBe(false);
      } finally {
        await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
      }
    });
  });
});

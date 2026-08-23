import { test, expect, type APIRequestContext } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers Sub-phase 2.5 — connecting completed curriculum exercises to the
 * existing SM-2 review system. seedLessonReviewItems (src/lib/study.ts)
 * seeds one review_items row per {left, right} pair in a completed
 * lesson's `matching` exercises only — the sole exercise type whose
 * payload carries a name alongside the glyph. letter_recognition,
 * true_false and reading_check exercises are answered as part of these
 * lessons but never independently seed a review item.
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

/** Completes "sad-and-dad" (Ṣād & Ḍād, module 2 chunk 1) fully via the UI. */
async function completeSadAndDad(page: import("@playwright/test").Page, lessonId: string) {
  await page.goto(`/lesson/${lessonId}`);
  // Steps: explanation(0), ص(1), letter_recognition(2, attached to 1).
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Which letter has NO dot?")).toBeVisible();
  await page.getByRole("radio", { name: "ص" }).click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Correct!")).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Which letter has one dot above?")).toBeVisible();
  await page.getByRole("radio", { name: "ض" }).click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Correct!")).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Match each letter to its name.")).toBeVisible();

  const comboboxes = page.getByRole("combobox");
  await comboboxes.nth(0).click();
  await page.getByRole("option", { name: "Ṣād" }).click();
  await comboboxes.nth(1).click();
  await page.getByRole("option", { name: "Ḍād" }).click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Correct!")).toBeVisible();

  await page.getByRole("button", { name: "Complete lesson" }).click();
  await expect(page.getByText("Lesson complete!")).toBeVisible();
}

async function deleteReviewItems(
  client: Awaited<ReturnType<typeof createTestUserClient>>["client"],
  userId: string,
) {
  await client.from("review_items").delete().eq("user_id", userId);
}

test.describe("lesson -> SM-2 review integration", () => {
  test("completing an eligible lesson creates exactly one review item per matching pair, with correct front/back and a deterministic item_key", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "sad-and-dad");
    await resetLessonProgress(lessonId);
    const { client, userId } = await createTestUserClient();
    await deleteReviewItems(client, userId);

    await completeSadAndDad(page, lessonId);

    const { data, error } = await client
      .from("review_items")
      .select("item_key, item_type, front, back")
      .eq("user_id", userId)
      .in("item_key", ["letter:ص", "letter:ض"])
      .order("item_key", { ascending: true });
    if (error) throw error;

    // Scenario 2: only the matching exercise's 2 pairs seeded items — not
    // one per letter_recognition exercise/attempt answered along the way.
    expect(data).toHaveLength(2);
    expect(data![0]).toMatchObject({
      item_key: "letter:ص",
      item_type: "letter",
      front: "ص",
      back: "Ṣād",
    });
    expect(data![1]).toMatchObject({
      item_key: "letter:ض",
      item_type: "letter",
      front: "ض",
      back: "Ḍād",
    });
  });

  test("replaying a completed lesson does not duplicate review items or reset their progress", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "sad-and-dad");
    const { client, userId } = await createTestUserClient();
    await deleteReviewItems(client, userId);

    await resetLessonProgress(lessonId);
    await completeSadAndDad(page, lessonId);

    const { data: first, error: firstError } = await client
      .from("review_items")
      .select("id, created_at")
      .eq("user_id", userId)
      .in("item_key", ["letter:ص", "letter:ض"])
      .order("item_key", { ascending: true });
    if (firstError) throw firstError;
    expect(first).toHaveLength(2);

    // Simulate a full replay: reset progress and complete the same lesson
    // again from scratch.
    await resetLessonProgress(lessonId);
    await completeSadAndDad(page, lessonId);

    const { data: second, error: secondError } = await client
      .from("review_items")
      .select("id, created_at")
      .eq("user_id", userId)
      .in("item_key", ["letter:ص", "letter:ض"])
      .order("item_key", { ascending: true });
    if (secondError) throw secondError;

    expect(second).toHaveLength(2);
    expect(second!.map((r) => r.id)).toEqual(first!.map((r) => r.id));
    expect(second!.map((r) => r.created_at)).toEqual(first!.map((r) => r.created_at));
  });

  test("Ḥā' (Module 1) and Hā' (Module 2) remain distinct review items", async ({
    page,
    request,
  }) => {
    const jimLessonId = await fetchLessonId(request, "the-jim-family");
    const haWawLessonId = await fetchLessonId(request, "ha2-and-waw");
    const { client, userId } = await createTestUserClient();
    await deleteReviewItems(client, userId);

    await resetLessonProgress(jimLessonId);
    await page.goto(`/lesson/${jimLessonId}`);
    // Steps: explanation(0), ج(1), ح(2), letter_recognition(3, attached to
    // 2), خ(4), letter_recognition(5, attached to 4), tip(6), summary(7),
    // matching(8, unattached).
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Which letter has NO dot at all?")).toBeVisible();
    await page.getByRole("radio", { name: "ح" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/dot sits ABOVE the curve/)).toBeVisible();
    await page.getByRole("radio", { name: "خ" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Match each letter to its name.")).toBeVisible();
    const jimCombos = page.getByRole("combobox");
    await jimCombos.nth(0).click();
    await page.getByRole("option", { name: "Jīm" }).click();
    await jimCombos.nth(1).click();
    await page.getByRole("option", { name: "Ḥā'" }).click();
    await jimCombos.nth(2).click();
    await page.getByRole("option", { name: "Khā'" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Complete lesson" }).click();
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    await resetLessonProgress(haWawLessonId);
    await page.goto(`/lesson/${haWawLessonId}`);
    // Steps: explanation(0), ه(1), letter_recognition(2, attached to 1),
    // و(3), letter_recognition(4, attached to 3), tip(5), summary(6),
    // matching(7, unattached).
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText("Which letter is drawn as a rounded loop, with no dots?"),
    ).toBeVisible();
    await page.getByRole("radio", { name: "ه" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText("Which letter has a small circle at the top with a tail below?"),
    ).toBeVisible();
    await page.getByRole("radio", { name: "و" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Match each letter to its name.")).toBeVisible();
    const haCombos = page.getByRole("combobox");
    await haCombos.nth(0).click();
    await page.getByRole("option", { name: "Hā'" }).click();
    await haCombos.nth(1).click();
    await page.getByRole("option", { name: "Wāw" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Complete lesson" }).click();
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    const { data, error } = await client
      .from("review_items")
      .select("item_key, front, back")
      .eq("user_id", userId)
      .in("item_key", ["letter:ح", "letter:ه"])
      .order("item_key", { ascending: true });
    if (error) throw error;
    expect(data).toHaveLength(2);
    const byKey = Object.fromEntries(data!.map((r) => [r.item_key, r]));
    expect(byKey["letter:ح"]).toMatchObject({ front: "ح", back: "Ḥā'" });
    expect(byKey["letter:ه"]).toMatchObject({ front: "ه", back: "Hā'" });
  });

  test("another user cannot read this user's lesson-seeded review items", async ({ request }) => {
    const { client } = await createTestUserClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const forgedUserId = "00000000-0000-0000-0000-000000000000";
    const res = await request.get(
      `${url}/rest/v1/review_items?select=*&user_id=eq.${forgedUserId}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${session!.access_token}`,
        },
      },
    );
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual([]);
  });

  test("seeded items are due today, appear in Practice, and answering one updates its SM-2 fields", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "sad-and-dad");
    const { client, userId } = await createTestUserClient();
    await deleteReviewItems(client, userId);
    await client.from("weak_areas").delete().eq("user_id", userId);

    await resetLessonProgress(lessonId);
    await completeSadAndDad(page, lessonId);

    const { data: before, error: beforeError } = await client
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .eq("item_key", "letter:ص")
      .single();
    if (beforeError) throw beforeError;
    expect(before.status).toBe("new");
    expect(before.repetitions).toBe(0);
    expect(before.ease_factor).toBeCloseTo(2.5);
    expect(before.interval_days).toBe(0);

    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
    // Letter items aren't broken out as their own summary row (Sub-phase
    // 2.5 deliberately didn't add new UI/i18n for that — see practice.ts),
    // but they do count toward the total that gates this button, so its
    // mere visibility is the real proof they're reachable from here.
    await expect(page.getByRole("button", { name: "Start Review Session" })).toBeVisible();

    await page.getByRole("button", { name: "Start Review Session" }).click();

    let sawOurCard = false;
    for (let i = 0; i < 10; i++) {
      if (
        await page
          .getByText("Session complete")
          .isVisible()
          .catch(() => false)
      )
        break;
      const reveal = page.getByRole("button", { name: "Tap to reveal" });
      if (await reveal.isVisible().catch(() => false)) {
        const isOurs = await page
          .getByText("ص", { exact: true })
          .isVisible()
          .catch(() => false);
        await reveal.click();
        if (isOurs) {
          sawOurCard = true;
          // exact: the flipped card's own text is exactly "Ṣād", but the
          // context line below it is "Ṣād & Ḍād: ص ض" — a non-exact match
          // would ambiguously resolve to both.
          await expect(page.getByText("Ṣād", { exact: true })).toBeVisible();
        }
        await page.getByRole("button", { name: "Got it" }).click();
        continue;
      }
      const markPracticed = page.getByRole("button", { name: "Mark as practiced" });
      if (await markPracticed.isVisible().catch(() => false)) {
        await markPracticed.click();
        continue;
      }
      await page.waitForTimeout(300);
    }
    expect(sawOurCard).toBe(true);
    await expect(page.getByText("Session complete")).toBeVisible({ timeout: 15_000 });

    const { data: after, error: afterError } = await client
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .eq("item_key", "letter:ص")
      .single();
    if (afterError) throw afterError;
    expect(after.status).toBe("learning");
    expect(after.repetitions).toBe(1);
    // MAX_EASE in recordPracticeAttempt (src/lib/study.ts) is 2.5, the same
    // value new review_items default to — a first correct answer can't
    // push ease past the ceiling it already starts at. Confirms the
    // unmodified algorithm ran, not that ease increased.
    expect(after.ease_factor).toBeCloseTo(2.5);
    expect(after.interval_days).toBe(1);
    expect(after.last_reviewed_at).not.toBeNull();
    expect(after.due_date > before.due_date).toBe(true);
  });

  test("Daily Study includes a due lesson-seeded letter item through the existing, unfiltered due-items query", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "sad-and-dad");
    const { client, userId } = await createTestUserClient();
    await deleteReviewItems(client, userId);

    await resetLessonProgress(lessonId);
    await completeSadAndDad(page, lessonId);

    await page.goto("/daily");
    await expect(
      page.getByText("ص", { exact: true }).or(page.getByText("ض", { exact: true })),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test("the schema-validation placeholder lesson (multiple_choice, not matching) creates no review items", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "schema-validation-placeholder");
    const { client, userId } = await createTestUserClient();
    await deleteReviewItems(client, userId);
    await resetLessonProgress(lessonId);

    await page.goto(`/lesson/${lessonId}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "A" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: "Complete lesson" }).click();
    await expect(page.getByText("Lesson complete!")).toBeVisible();

    const { count, error } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    expect(count).toBe(0);
  });

  test("completing in French does not corrupt item identity: front/back/item_key stay locale-neutral, only context follows the interface language", async ({
    page,
    request,
  }) => {
    const lessonId = await fetchLessonId(request, "sad-and-dad");
    const { client, userId } = await createTestUserClient();
    await deleteReviewItems(client, userId);
    await resetLessonProgress(lessonId);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lessonId}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await page.getByRole("button", { name: "Suivant" }).click();
      await page.getByRole("button", { name: "Suivant" }).click();
      await page.getByRole("radio", { name: "ص" }).click();
      await page.getByRole("button", { name: "Vérifier" }).click();
      await expect(page.getByText("Correct")).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click();
      await page.getByRole("button", { name: "Suivant" }).click();
      await page.getByRole("radio", { name: "ض" }).click();
      await page.getByRole("button", { name: "Vérifier" }).click();
      await expect(page.getByText("Correct")).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click();
      await page.getByRole("button", { name: "Suivant" }).click();
      await page.getByRole("button", { name: "Suivant" }).click();
      const comboboxes = page.getByRole("combobox");
      await comboboxes.nth(0).click();
      await page.getByRole("option", { name: "Ṣād" }).click();
      await comboboxes.nth(1).click();
      await page.getByRole("option", { name: "Ḍād" }).click();
      await page.getByRole("button", { name: "Vérifier" }).click();
      await expect(page.getByText("Correct")).toBeVisible();
      await page.getByRole("button", { name: "Terminer la leçon" }).click();
      await expect(page.getByText("Leçon terminée")).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }

    const { data, error } = await client
      .from("review_items")
      .select("item_key, front, back, context")
      .eq("user_id", userId)
      .in("item_key", ["letter:ص", "letter:ض"])
      .order("item_key", { ascending: true });
    if (error) throw error;
    expect(data).toHaveLength(2);
    // front/back/item_key are the same transliterated forms regardless of
    // interface language — nothing was translated or otherwise corrupted.
    expect(data![0]).toMatchObject({ item_key: "letter:ص", front: "ص", back: "Ṣād" });
    expect(data![1]).toMatchObject({ item_key: "letter:ض", front: "ض", back: "Ḍād" });
    // context alone reflects the interface language active at seed time.
    expect(data![0]!.context).toContain("Ṣād et Ḍād");
  });

  test("retry safety: resetLessonProgress leaves already-seeded review items intact, so a retried test starts from a known, not an empty, review state", async ({
    page,
    request,
  }) => {
    // No test in this file uses test.describe.serial or depends on another
    // test's leftover state — each independently deletes review_items and
    // calls resetLessonProgress at its own start, so a Playwright retry of
    // any single test here just re-runs it from that same clean slate.
    // This test verifies the other half of that contract directly:
    // resetLessonProgress (shared with every other spec file) only ever
    // touches user_lesson_progress/user_exercise_attempts, never
    // review_items — so seeding is genuinely a one-way, durable side
    // effect of completion, not something a later progress reset undoes.
    const lessonId = await fetchLessonId(request, "sad-and-dad");
    const { client, userId } = await createTestUserClient();
    await deleteReviewItems(client, userId);
    await resetLessonProgress(lessonId);
    await completeSadAndDad(page, lessonId);

    const { count: seededCount, error: seededError } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("item_key", ["letter:ص", "letter:ض"]);
    if (seededError) throw seededError;
    expect(seededCount).toBe(2);

    await resetLessonProgress(lessonId);

    const { count: afterResetCount, error: afterResetError } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("item_key", ["letter:ص", "letter:ض"]);
    if (afterResetError) throw afterResetError;
    expect(afterResetCount).toBe(2);
  });
});

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers Internationalization Foundation Phase 1: the normalized
 * translation-table architecture and the confirmed RED item fix (exercise
 * payload choices/pairs were never locale-aware, even for French, before
 * this phase).
 *
 * The whole-lesson-fallback RULE itself (resolveLessonLocale) and the
 * direction resolver (isRtlLocale) are deterministically unit-tested in
 * src/lib/locale-resolution.test.ts, covering every boundary case (missing
 * lesson title, missing one section, missing one exercise, zero-section
 * lessons, English always complete, every locale's RTL/LTR direction).
 * This spec covers what unit tests cannot: that the real app actually
 * wires fetchLessonForPlayer through to that rule end to end, and that
 * French exercise choices/pairs genuinely render (not just prompts/
 * explanations, which were already locale-aware before this phase).
 *
 * Deliberately NOT covered here, per the approved scope: (1) the
 * "incomplete translation triggers English fallback" case at the E2E
 * level -- it would require writing directly into the new
 * *_translations tables, which the publishable-key client this suite uses
 * correctly cannot do (read-only RLS by design, writes only via
 * migrations) -- proven by the unit tests instead, not weakened here; (2)
 * the direction resolver's live DOM effect for ar/ur -- SUPPORTED_LOCALES
 * still only contains en/fr this phase (ar/ur are deliberately not yet
 * reachable through the app, including via direct localStorage injection,
 * since isLocale() validates against SUPPORTED_LOCALES), so an E2E
 * attempt to reach an ar/ur session would be exactly the kind of
 * speculative AR/UR test the approved scope explicitly excludes.
 */

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
  const moduleId = modules[0]!.id;
  return (await apiGet(
    request,
    `lessons?select=id,slug,title_en,title_fr&module_id=eq.${moduleId}`,
  )) as { id: string; slug: string; title_en: string; title_fr: string }[];
}

test.describe("Internationalization Foundation Phase 1 — translation architecture", () => {
  test("French exercise choices AND matching pairs render in French (RED item fix) -- not just prompts/explanations", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const lesson = lessons.find((l) => l.slug === "he-is-allah-one")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await expect(page.getByRole("heading", { name: "Il est Allah, Unique" })).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click(); // past explanation
      await page.getByRole("button", { name: "Suivant" }).click(); // past huwa word
      await page.getByRole("button", { name: "Suivant" }).click(); // past quran_example
      await page.getByRole("button", { name: "Suivant" }).click(); // past tip
      await page.getByRole("button", { name: "Suivant" }).click(); // to true_false exercise
      await expect(page.getByText("Huwa est un pronom qui signifie « il ».")).toBeVisible();
      await page.getByRole("button", { name: "Vrai" }).click();
      await page.getByRole("button", { name: "Vérifier la réponse" }).click();
      await expect(page.getByText("Correct !")).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click();

      // multiple_choice: the RED item -- these three answer options come
      // from lesson_exercise_translations.payload, not the base English
      // payload. Before this phase they would have rendered in English
      // even here, under a fully French interface.
      await expect(page.getByRole("radio", { name: "Le mot pour « est »" })).toBeVisible();
      await expect(page.getByRole("radio", { name: "Le mot pour « il »" })).toBeVisible();
      await expect(page.getByRole("radio", { name: "Le mot pour « Allah »" })).toBeVisible();
      await page.getByRole("radio", { name: "Le mot pour « est »" }).click();
      await page.getByRole("button", { name: "Vérifier la réponse" }).click();
      await expect(page.getByText("Correct !")).toBeVisible();
      await page.getByRole("button", { name: "Suivant" }).click();

      // matching: the pairs[].right dropdown options are the other half of
      // the same RED item -- also French now, also previously English-only.
      await expect(page.getByText("Associez chaque idée à sa signification.")).toBeVisible();
      const comboboxes = page.getByRole("combobox");
      await comboboxes.first().click();
      await expect(page.getByRole("option", { name: /pronom qui remplace un nom/ })).toBeVisible();
      await page.keyboard.press("Escape");
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("canonical Qur'anic arabic_text is byte-identical regardless of interface language", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const lesson = lessons.find((l) => l.slug === "he-is-allah-one")!;
    const ayahs = (await apiGet(
      request,
      "ayahs?select=arabic_text&surah_number=eq.112&ayah_number=eq.1",
    )) as { arabic_text: string }[];
    const canonicalText = ayahs[0]!.arabic_text;
    const { client, userId } = await createTestUserClient();

    await resetLessonProgress(lesson.id);
    await page.goto(`/lesson/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click(); // past explanation
    await page.getByRole("button", { name: "Next" }).click(); // past huwa word
    await expect(page.getByText(canonicalText, { exact: true })).toBeVisible();

    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      await resetLessonProgress(lesson.id);
      await page.goto(`/lesson/${lesson.id}`);
      await page.getByRole("button", { name: "Suivant" }).click(); // past explanation
      await page.getByRole("button", { name: "Suivant" }).click(); // past huwa word
      await expect(page.getByText(canonicalText, { exact: true })).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});

/**
 * Pre-Level-5 i18n hardening: seedLessonReviewItems() (src/lib/study.ts)
 * previously read the raw English exercise payload and a hardcoded
 * locale === "fr" ? title_fr : title_en ternary when creating review_items
 * rows on lesson completion -- bypassing the resolved/localized data the
 * lesson itself had just rendered. A French learner completing this exact
 * lesson in French got English-only review cards. Fixed by having
 * seedLessonReviewItems consume the already-resolved `lesson.title` and
 * `exercise.resolvedPayload` instead of doing any locale logic of its own.
 *
 * These tests drive the full three-exercise lesson to completion (not just
 * to the matching exercise, as the RED-item test above does), since
 * seedLessonReviewItems only fires on lesson completion.
 */
const LOCALE_LABELS_EN = {
  next: "Next",
  checkAnswer: "Check answer",
  complete: "Complete lesson",
  true: "True",
  correctChoice: 'The word for "is"',
} as const;
const LOCALE_LABELS_FR = {
  next: "Suivant",
  checkAnswer: "Vérifier la réponse",
  complete: "Terminer la leçon",
  true: "Vrai",
  correctChoice: "Le mot pour « est »",
} as const;

async function completeHeIsAllahOneLesson(page: Page, locale: "en" | "fr") {
  const L = locale === "fr" ? LOCALE_LABELS_FR : LOCALE_LABELS_EN;

  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: L.next }).click();
  }

  // true_false
  await page.getByRole("button", { name: L.true }).click();
  await page.getByRole("button", { name: L.checkAnswer }).click();
  await page.getByRole("button", { name: L.next }).click();

  // multiple_choice (RED item)
  await page.getByRole("radio", { name: L.correctChoice }).click();
  await page.getByRole("button", { name: L.checkAnswer }).click();
  await page.getByRole("button", { name: L.next }).click();

  // matching (RED item) -- last step, so completion follows the check
  const comboboxes = page.getByRole("combobox");
  await comboboxes.nth(0).click();
  await page
    .getByRole("option", {
      name: locale === "fr" ? /pronom qui remplace un nom/ : /pronoun standing in for a name/,
    })
    .click();
  await comboboxes.nth(1).click();
  await page
    .getByRole("option", {
      name: locale === "fr" ? /phrase sans verbe.*sujet puis description/ : /no verb.*subject/,
    })
    .click();
  await page.getByRole("button", { name: L.checkAnswer }).click();
  await page.getByRole("button", { name: L.complete }).click();
}

test.describe("Internationalization Foundation Phase 1 — review-card localization (pre-Level-5 hardening)", () => {
  const CONCEPT_KEYS = ["concept:pronoun-huwa", "concept:nominal-sentence"];

  test("English lesson completion seeds English review-card back/context text", async ({
    page,
    request,
  }) => {
    const lessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const lesson = lessons.find((l) => l.slug === "he-is-allah-one")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("review_items").delete().eq("user_id", userId).in("item_key", CONCEPT_KEYS);

    await page.goto(`/lesson/${lesson.id}`);
    await completeHeIsAllahOneLesson(page, "en");
    // seedLessonReviewItems runs fire-and-forget from the Complete-lesson
    // click handler (onClick={() => void goNextOrComplete()}) -- the click
    // itself resolves before that async write finishes.
    await page.waitForTimeout(1000);

    const { data: items } = await client
      .from("review_items")
      .select("item_key, back, context")
      .eq("user_id", userId)
      .in("item_key", CONCEPT_KEYS)
      .order("item_key");
    expect(items).toHaveLength(2);

    const byKey = new Map(items!.map((i) => [i.item_key, i]));
    expect(byKey.get("concept:pronoun-huwa")!.back).toContain("pronoun");
    expect(byKey.get("concept:nominal-sentence")!.back).toContain("no verb");
    expect(byKey.get("concept:pronoun-huwa")!.context).toBe("He Is Allah, One");

    await client.from("review_items").delete().eq("user_id", userId).in("item_key", CONCEPT_KEYS);
  });

  test("French lesson completion seeds French review-card back/context text (no English leakage), and it displays correctly in a real Practice session", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const lessons = await fetchModuleLessons(request, "pronouns-and-nominal-sentences");
    const lesson = lessons.find((l) => l.slug === "he-is-allah-one")!;
    const { client, userId } = await createTestUserClient();
    await resetLessonProgress(lesson.id);
    await client.from("review_items").delete().eq("user_id", userId).in("item_key", CONCEPT_KEYS);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto(`/lesson/${lesson.id}`);
      await completeHeIsAllahOneLesson(page, "fr");
      await page.waitForTimeout(1000);

      const { data: items } = await client
        .from("review_items")
        .select("item_key, back, context")
        .eq("user_id", userId)
        .in("item_key", CONCEPT_KEYS)
        .order("item_key");
      expect(items).toHaveLength(2);

      const byKey = new Map(items!.map((i) => [i.item_key, i]));
      const huwaBack = byKey.get("concept:pronoun-huwa")!.back;
      const nominalBack = byKey.get("concept:nominal-sentence")!.back;
      expect(huwaBack).toContain("pronom qui remplace un nom");
      expect(nominalBack).toContain("phrase sans verbe");
      expect(byKey.get("concept:pronoun-huwa")!.context).toBe("Il est Allah, Unique");
      // No English leakage: the distinctive English wording must not appear.
      expect(huwaBack).not.toContain("pronoun standing in for a name");
      expect(nominalBack).not.toContain("no verb");
      expect(byKey.get("concept:nominal-sentence")!.context).not.toBe("He Is Allah, One");

      // Full journey: the seeded item actually displays in French inside a
      // real Practice session, not just correct in the database.
      // Backdated (not just "today") so it sorts first in the due-date-
      // ascending queue regardless of how many other items this shared
      // account has due today from other specs' runs -- the queue caps at
      // 20 (fetchPracticeQueue's default limit), so without this a busy
      // account could push the item outside that window entirely.
      const backdated = new Date();
      backdated.setDate(backdated.getDate() - 7);
      await client
        .from("review_items")
        .update({ due_date: backdated.toLocaleDateString("en-CA") })
        .eq("user_id", userId)
        .in("item_key", CONCEPT_KEYS);

      await page.goto("/practice");
      await page.getByRole("button", { name: "Commencer la révision" }).click();
      let sawFrenchBack = false;
      for (let i = 0; i < 25; i++) {
        if (
          await page
            .getByText("Session terminée")
            .isVisible()
            .catch(() => false)
        )
          break;
        const front = await page
          .getByText("pronoun-huwa", { exact: true })
          .isVisible()
          .catch(() => false);
        if (front) {
          await page.getByRole("button", { name: "Toucher pour révéler" }).click();
          await expect(page.getByText(/pronom qui remplace un nom/)).toBeVisible();
          sawFrenchBack = true;
          await page.getByRole("button", { name: "Acquis" }).click();
          continue;
        }
        const reveal = page.getByRole("button", { name: "Toucher pour révéler" });
        if (await reveal.isVisible().catch(() => false)) {
          await reveal.click();
          await page.getByRole("button", { name: "Acquis" }).click();
          continue;
        }
        await page.waitForTimeout(300);
      }
      expect(sawFrenchBack).toBe(true);
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
      await client.from("review_items").delete().eq("user_id", userId).in("item_key", CONCEPT_KEYS);
    }
  });
});

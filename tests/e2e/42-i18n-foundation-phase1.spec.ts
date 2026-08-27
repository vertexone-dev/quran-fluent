import { test, expect, type APIRequestContext } from "@playwright/test";

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

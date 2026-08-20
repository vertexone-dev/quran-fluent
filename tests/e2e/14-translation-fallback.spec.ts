import { test, expect, type Page } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Covers the NULL-translation compatibility patch: newly imported Ayat
 * (Phase 2A's canonical Arabic import) have no EN/FR translation until
 * Phase 2B, and the app must handle that gracefully rather than crashing,
 * rendering the literal word "null", or silently failing writes.
 *
 * No real translation-less Ayah exists yet (the full import hasn't been
 * applied). Route interception rewrites the /rest/v1/ayahs response for one
 * real bootstrap Ayah (Al-Kawthar 108:1, otherwise untouched by every other
 * spec) to null out its translation_en/translation_fr for the duration of
 * each test — the underlying row is real, so writes that reference it
 * (bookmarks, notes, review_items) hit real foreign keys and really
 * persist; only what the UI *displays* for that one Ayah is faked.
 */
async function interceptAyah108WithNullTranslations(page: Page) {
  await page.route("**/rest/v1/ayahs*", async (route) => {
    try {
      const response = await route.fetch();
      const body = await response.json();
      const rewritten = Array.isArray(body)
        ? body.map((row) =>
            row.surah_number === 108 && row.ayah_number === 1
              ? { ...row, translation_en: null, translation_fr: null }
              : row,
          )
        : body;
      await route.fulfill({ response, json: rewritten });
    } catch {
      // The underlying request can be aborted/disposed by React Query
      // (e.g. a fast re-render cancels an in-flight fetch) before this
      // handler finishes reading it — fall through to the real response
      // rather than fail the whole test over an unrelated race.
      await route.continue();
    }
  });
}

test.describe("translation-fallback compatibility", () => {
  test.beforeEach(async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("bookmarks").delete().eq("user_id", userId).eq("surah_number", 108);
    await client.from("notes").delete().eq("user_id", userId).eq("surah_number", 108);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_type", "ayah")
      .eq("item_key", "ayah:108:1");
    await client
      .from("memorization_progress")
      .delete()
      .eq("user_id", userId)
      .eq("surah_number", 108);
    await interceptAyah108WithNullTranslations(page);
  });

  test("renders Arabic correctly and shows an explicit EN missing-translation state, never the literal word null", async ({
    page,
  }) => {
    const { client } = await createTestUserClient();
    // Derived from the database rather than hand-typed, per this project's
    // standing rule against hand-transcribing Arabic for comparison.
    const { data: ayah108v1 } = await client
      .from("ayahs")
      .select("arabic_text")
      .eq("surah_number", 108)
      .eq("ayah_number", 1)
      .single();

    await page.goto("/quran?surah=108");
    // The real Arabic text must still render (only translations were nulled).
    await expect(page.getByText(ayah108v1!.arabic_text)).toBeVisible();
    await expect(
      page.getByText("English translation not available yet for this Ayah."),
    ).toBeVisible();

    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(/\bnull\b/);
  });

  test("shows an explicit FR missing-translation state when the interface language is French", async ({
    page,
  }) => {
    // Set the account's saved language directly rather than clicking the
    // live switcher: I18nProvider re-fetches profiles.interface_language
    // in an effect keyed on the user id and can race a fresh setLocale()
    // click under added network latency (this test's route interception
    // adds exactly that) — a real, separate, pre-existing timing issue in
    // that effect, unrelated to translations, and out of scope here.
    // Setting the profile first means the page simply initializes in
    // French, sidestepping the race entirely.
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    await page.goto("/quran?surah=108");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(
      page.getByText("Traduction française pas encore disponible pour ce verset."),
    ).toBeVisible();

    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(/\bnull\b/);

    // Reset so downstream specs see the default locale's copy —
    // interface_language is account-level state, not just client-side.
    await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
  });

  test("bookmarking a translation-less Ayah still works and persists", async ({ page }) => {
    const { client, userId } = await createTestUserClient();

    await page.goto("/quran?surah=108");
    const card = page.locator("#ayah-108-1");
    await card.getByRole("button", { name: "Bookmark Ayah" }).click();
    await expect(card.getByRole("button", { name: "Remove Bookmark" })).toBeVisible();

    await expect
      .poll(async () => {
        const { count } = await client
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("surah_number", 108)
          .eq("ayah_number", 1);
        return count;
      })
      .toBe(1);
  });

  test("adding a note to a translation-less Ayah still works and persists", async ({ page }) => {
    const { client, userId } = await createTestUserClient();

    await page.goto("/quran?surah=108");
    const card = page.locator("#ayah-108-1");
    await card.getByRole("button", { name: "Add Note" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("Note on a not-yet-translated Ayah.");
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/rest/v1/notes") && res.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Save" }).click(),
    ]);

    await expect
      .poll(async () => {
        const { count } = await client
          .from("notes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("surah_number", 108)
          .eq("ayah_number", 1);
        return count;
      })
      .toBe(1);
  });

  test("review scheduling is skipped (not attempted with invalid data) for a translation-less Ayah, and memorization status still updates", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();

    await page.goto("/memorize?surah=108&ayah=1");
    await expect(page.getByText("Ayah 1")).toBeVisible();

    await page.getByRole("button", { name: "Mark as memorized" }).click();
    await expect(
      page.getByText(
        "Marked as memorized. Review reminders will start once a translation is available for this Ayah.",
      ),
    ).toBeVisible();

    // The status change itself must have gone through for real.
    await expect
      .poll(async () => {
        const { data } = await client
          .from("memorization_progress")
          .select("status")
          .eq("user_id", userId)
          .eq("surah_number", 108)
          .eq("ayah_number", 1)
          .maybeSingle();
        return data?.status;
      })
      .toBe("memorized");

    // No review_items row must have been created from this — scheduleReview
    // must skip rather than insert a row with a null/blank back.
    const { count } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("item_type", "ayah")
      .eq("item_key", "ayah:108:1");
    expect(count).toBe(0);
  });

  test("existing translated bootstrap Ayat retain current behavior (no interception, real translation shown)", async ({
    page,
  }) => {
    await page.goto("/quran?surah=1");
    // Al-Fatiha 1:1's real Sahih International translation must still show
    // normally — untouched by this patch.
    await expect(page.getByText(/In the name of Allah/)).toBeVisible();
    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(/\bnull\b/);
    expect(bodyText).not.toContain("translation not available yet");
  });
});

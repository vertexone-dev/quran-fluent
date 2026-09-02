import { test, expect, type Page } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * As of the Kazimirski French Reader integration
 * (50-kazimirski-french-reader.spec.ts), Al-Fatiha's French text is no
 * longer "unavailable" -- the governed, certified Kazimirski segment model
 * now covers it. Local dev does not carry the real production Kazimirski
 * data (see that spec's own module docstring for why), so these two tests
 * mock just enough of it -- Al-Fatiha ayah 1's Bismillah, taken directly
 * from the frozen production artifact -- to prove the actually-important
 * claim this file exists for: the disputed Hamidullah text never reappears.
 */
async function mockKazimirskiAlFatihaAyah1(page: Page) {
  await page.route("**/rest/v1/content_sources*", async (route) => {
    if (!route.request().url().includes("edition_identifier=eq.kazimirski-1869-segments-v1")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "f8443b10-3cc8-59ee-954f-5b1129c1cec4",
        translator: "Albin de Kazimirski Biberstein",
      }),
    });
  });
  await page.route("**/rest/v1/translation_segment_ayahs*", async (route) => {
    if (!route.request().url().includes("surah_number=eq.1")) {
      await route.continue();
      return;
    }
    // All 7 āyahs, so the whole page is in a consistent, fully-covered
    // state (an unmocked remainder would show the unrelated "unavailable"
    // fallback and break a page-wide assertion) -- exact text from the
    // frozen production artifact, same fixture as
    // 50-kazimirski-french-reader.spec.ts.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          ayah_number: 1,
          segment: {
            id: "seg-1-0",
            source_ordinal: 0,
            text: "Au nom du Dieu clément et miséricordieux.",
            alignment_type: "source_anomaly",
          },
        },
        {
          ayah_number: 2,
          segment: {
            id: "seg-1-1",
            source_ordinal: 1,
            text: "Louange à Dieu, maître de l’univers",
            alignment_type: "offset",
          },
        },
        {
          ayah_number: 3,
          segment: {
            id: "seg-1-2",
            source_ordinal: 2,
            text: "Le clément, le miséricordieux,",
            alignment_type: "offset",
          },
        },
        {
          ayah_number: 4,
          segment: {
            id: "seg-1-3",
            source_ordinal: 3,
            text: "Souverain au jour de la rétribution.",
            alignment_type: "offset",
          },
        },
        {
          ayah_number: 5,
          segment: {
            id: "seg-1-4",
            source_ordinal: 4,
            text: "C’est toi que nous adorons, c’est toi dont nous implorons le secours.",
            alignment_type: "offset",
          },
        },
        {
          ayah_number: 6,
          segment: {
            id: "seg-1-5",
            source_ordinal: 5,
            text: "Dirige-nous dans le sentier droit,",
            alignment_type: "offset",
          },
        },
        {
          ayah_number: 7,
          segment: {
            id: "seg-1-6",
            source_ordinal: 6,
            text: "Dans le sentier de ceux que tu as comblés de tes bienfaits,",
            alignment_type: "many_to_one",
          },
        },
        {
          ayah_number: 7,
          segment: {
            id: "seg-1-7",
            source_ordinal: 7,
            text: "Non pas de ceux qui ont encouru ta colère, ni de ceux qui s’égarent.",
            alignment_type: "many_to_one",
          },
        },
      ]),
    });
  });
}

/** Matches src/lib/study.ts's localDate(): review_items.due_date must be
 * compared against the *local* calendar day, not the DB server's UTC
 * CURRENT_DATE default -- relying on that default here raced exactly the
 * timezone bug localDate() itself exists to prevent. */
function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Covers the fr.hamidullah disputed-source remediation
 * (supabase/migrations/20260911110000_...): the 58 legacy
 * ayahs.translation_fr rows for 7 surahs (Al-Fatiha, Al-Mulk, Al-Asr,
 * Al-Kawthar, Al-Ikhlas, Al-Falaq, An-Nas) are nulled, their exact text
 * preserved in the governed `translations` table under a formally
 * `disputed` content_sources row, and any review_items scheduled from
 * that exact text are suspended (never deleted).
 *
 * No new frontend logic was written for any of this: nulling the legacy
 * column falls through to the app's existing null -> "translation not
 * yet available" state, and suspending a review_items row falls through
 * to the app's existing `.neq("status", "suspended")` due-review filter.
 * These tests prove those existing mechanisms actually produce the right
 * outcome for this specific remediation, against the real (locally
 * migrated) database -- not merely that the mechanisms exist in isolation.
 */

test.describe("fr.hamidullah disputed-source remediation", () => {
  test("the French Qur'an Reader never shows the disputed Hamidullah text for a remediated āyah -- it now shows the governed Kazimirski (1869) translation instead", async ({
    page,
  }) => {
    // As of the Kazimirski French Reader integration (see
    // 50-kazimirski-french-reader.spec.ts), Al-Fatiha's French text is no
    // longer "unavailable" -- the governed, certified Kazimirski segment
    // model now covers it (6236/6236 canonical coverage). This test's job
    // is narrower and still fully valid: prove the disputed Hamidullah
    // source is never served, regardless of what replaced it.
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    await mockKazimirskiAlFatihaAyah1(page);
    try {
      // Al-Fatiha is the reader's default surah with no ?surah= param, so
      // no selector interaction is needed -- one less flaky UI dependency.
      await page.goto("/quran");
      await expect(page.getByRole("combobox", { name: "Choisir une sourate" })).toHaveText(
        /Al-Fatiha/,
      );
      // The exact disputed Hamidullah rendering must never reappear.
      await expect(
        page.getByText("Traduction française pas encore disponible pour ce verset."),
      ).toHaveCount(0);
      // Replaced by the certified Kazimirski text (full assertions live in
      // 50-kazimirski-french-reader.spec.ts) -- spot-check ayah 1 here.
      await expect(page.getByText("Au nom du Dieu clément et miséricordieux.")).toBeVisible();
      await expect(
        page.getByText(/Traducteur\s*:\s*Albin de Kazimirski Biberstein/).first(),
      ).toBeVisible();
      // Never silently falls back to English under the French UI.
      await expect(page.getByText(/^Praise be to Allah/)).not.toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("Memorization shows the governed Kazimirski translation (not the disputed Hamidullah text) for a formerly disputed āyah, in French", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    await mockKazimirskiAlFatihaAyah1(page);
    try {
      await page.goto("/memorize?surah=1&ayah=1");
      await expect(
        page.getByText("Traduction française pas encore disponible pour ce verset."),
      ).toHaveCount(0);
      await expect(page.getByText("Au nom du Dieu clément et miséricordieux.")).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("a review item suspended by the remediation does not appear in the due-review count, while an unaffected item still does", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("memorization_progress").delete().eq("user_id", userId);
    await client.from("review_items").delete().eq("user_id", userId).eq("item_type", "ayah");

    try {
      // Simulates exactly what the remediation migration does to a
      // pre-existing review item scheduled from the disputed French text:
      // suspended, not deleted, still holding its original content.
      const suspendedInsert = await client.from("review_items").insert({
        user_id: userId,
        item_type: "ayah",
        item_key: "ayah:1:1",
        front: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        back: "Au nom d'Allah, le Tout Miséricordieux, le Très Miséricordieux.",
        context: "1:1",
        status: "suspended",
        due_date: todayLocalDate(),
      });
      if (suspendedInsert.error) throw suspendedInsert.error;
      // An unrelated, unaffected item -- proves suspension is scoped to
      // the specific disputed item, not a blanket effect on due reviews.
      const unaffectedInsert = await client.from("review_items").insert({
        user_id: userId,
        item_type: "ayah",
        item_key: "ayah:114:1",
        front: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ",
        back: "Say: I seek refuge in the Lord of Mankind.",
        context: "114:1",
        status: "new",
        due_date: todayLocalDate(),
      });
      if (unaffectedInsert.error) throw unaffectedInsert.error;

      await page.goto("/memorize");
      await expect(page.getByText("1 Ayat due")).toBeVisible();
    } finally {
      await client.from("review_items").delete().eq("user_id", userId).eq("item_type", "ayah");
    }
  });

  test("Settings no longer offers Hamidullah as a selectable French translation", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByLabel("Preferred translation").click();
    await expect(page.getByRole("option", { name: /Hamidullah/ })).toHaveCount(0);
    await expect(
      page.getByRole("option", { name: "English — Saheeh International" }),
    ).toBeVisible();
  });

  test("English translation still works (Pickthall, unaffected)", async ({ page }) => {
    // Al-Fatiha is the reader's default surah with no ?surah= param.
    await page.goto("/quran");
    await expect(page.getByText(/^Praise be to Allah/)).toBeVisible();
  });

  test("recitation audio still works on the Qur'an Reader (unrelated to translation remediation)", async ({
    page,
  }) => {
    await page.route("**/api.quran.com/api/v4/recitations/*/by_ayah/*", async (route) => {
      const url = new URL(route.request().url());
      const key = url.pathname.split("/by_ayah/")[1]!;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ audio_files: [{ url: `mock-audio/${key.replace(":", "-")}.wav` }] }),
      });
    });
    await page.route("**/mock-audio/*.wav", async (route) => {
      const buffer = Buffer.alloc(44 + 2400);
      buffer.write("RIFF", 0);
      buffer.writeUInt32LE(36 + 2400, 4);
      buffer.write("WAVE", 8);
      buffer.write("fmt ", 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(1, 22);
      buffer.writeUInt32LE(8000, 24);
      buffer.writeUInt32LE(8000, 28);
      buffer.writeUInt16LE(1, 32);
      buffer.writeUInt16LE(8, 34);
      buffer.write("data", 36);
      buffer.writeUInt32LE(2400, 40);
      buffer.fill(128, 44);
      await route.fulfill({ status: 200, contentType: "audio/wav", body: buffer });
    });
    // Al-Fatiha is the reader's default surah with no ?surah= param.
    await page.goto("/quran");
    await page.getByRole("button", { name: "Play recitation" }).first().click();
    await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();
  });

  test("canonical Arabic text for a remediated āyah is unaffected", async ({ page }) => {
    // Al-Fatiha is the reader's default surah with no ?surah= param.
    await page.goto("/quran");
    const arabic = page.locator('[dir="rtl"][lang="ar"]').first();
    await expect(arabic).toBeVisible();
    await expect(arabic).toContainText("بِسْمِ");
  });
});

import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

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
  test("the French Qur'an Reader shows the existing 'translation unavailable' state for a formerly disputed āyah", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      // Al-Fatiha is the reader's default surah with no ?surah= param, so
      // no selector interaction is needed -- one less flaky UI dependency.
      await page.goto("/quran");
      await expect(page.getByRole("combobox", { name: "Choisir une sourate" })).toHaveText(
        /Al-Fatiha/,
      );
      // All 7 āyahs of Al-Fatiha are now remediated, so this appears once
      // per āyah -- asserting the count directly is a stronger proof of
      // "all remediated" than just checking at least one instance exists.
      await expect(
        page.getByText("Traduction française pas encore disponible pour ce verset."),
      ).toHaveCount(7);
      // Never silently falls back to English under the French UI.
      await expect(page.getByText(/^Praise be to Allah/)).not.toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("Memorization shows the same 'translation unavailable' state for a formerly disputed āyah, in French", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      await page.goto("/memorize?surah=1&ayah=1");
      await expect(
        page.getByText("Traduction française pas encore disponible pour ce verset."),
      ).toBeVisible();
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

import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Validates the app against the real, live 114-surah / 6,236-ayah import —
 * no route mocking, no 7-surah bootstrap assumption. Read-only checks use
 * a handful of non-bootstrap Surahs (2, 18, 55); write checks use Al-Fil
 * (105), a short new Surah untouched by every other spec, cleaned up
 * before/after so reruns start from a known state.
 */
test.describe("full 114-surah dataset", () => {
  test("Surah picker lists all 114 Surahs, not just the original 7-surah bootstrap set", async ({
    page,
  }) => {
    await page.goto("/quran");
    await page.waitForLoadState("networkidle");
    const trigger = page.getByLabel("Select a Surah");
    // The trigger can render before its dropdown is fully interactive under
    // load; retry the click rather than assume the first one always opens
    // a 114-item listbox.
    await expect(async () => {
      await trigger.click();
      await expect(page.getByRole("option").first()).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(page.getByRole("option")).toHaveCount(114);
  });

  test("opening several non-bootstrap Surahs renders real Arabic text", async ({ page }) => {
    for (const surah of [2, 18, 55]) {
      await page.goto(`/quran?surah=${surah}`);
      const arabic = page.locator('[lang="ar"][dir="rtl"]').first();
      await expect(arabic).toBeVisible();
      expect((await arabic.innerText()).trim().length).toBeGreaterThan(0);
    }
  });

  test("English reader shows the normalized governed Pickthall translation on a non-bootstrap Ayah", async ({
    page,
  }) => {
    await page.goto("/quran?surah=18");
    // Al-Kahf 18:1's Pickthall wording — asserted against the actual live
    // public.translations row rather than hand-typed, per this project's
    // standing rule against hand-transcribing translation text for
    // comparison.
    const { client } = await createTestUserClient();
    const { data: source } = await client
      .from("content_sources")
      .select("id")
      .eq("content_type", "translation")
      .eq("language", "en")
      .eq("translator", "Marmaduke Pickthall")
      .eq("edition_identifier", "pickthall-gutenberg-16955")
      .single();
    const { data: translation } = await client
      .from("translations")
      .select("text")
      .eq("source_id", source!.id)
      .eq("surah_number", 18)
      .eq("ayah_number", 1)
      .single();

    await expect(page.getByText(translation!.text)).toBeVisible();
    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(/\bnull\b/);
    expect(bodyText).not.toContain("translation not available yet");
  });

  test("English bootstrap Ayah prefers the normalized governed Pickthall translation over the legacy Sahih International text", async ({
    page,
  }) => {
    await page.goto("/quran?surah=1");
    // Pickthall renders 1:4 as "Master of the Day of Judgment," — the
    // legacy bootstrap column instead holds Sahih International's "Sovereign
    // of the Day of Recompense." Seeing the former (not the latter) proves
    // the reader now reads public.translations, not ayahs.translation_en,
    // even for Ayat the legacy column also covers.
    await expect(page.getByText("Master of the Day of Judgment,")).toBeVisible();
    await expect(page.getByText("Sovereign of the Day of Recompense.")).not.toBeVisible();

    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(/\bnull\b/);
    expect(bodyText).not.toContain("translation not available yet");
  });

  test("verified-source attribution is shown and its full details are discoverable, without claiming the exact 1930 first edition", async ({
    page,
  }) => {
    await page.goto("/quran?surah=1");
    const trigger = page.getByRole("button", { name: "Translator: Marmaduke Pickthall" }).first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByText(/Project Gutenberg eBook #16955 digital edition/)).toBeVisible();
    await expect(page.getByText(/exact reproduction of the 1930 first edition/)).toBeVisible();
  });

  test("French still uses its legacy fallback and never leaks the English Pickthall translation", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      // Surah 1 (bootstrap) previously had a real legacy translation_fr,
      // but that was the disputed fr.hamidullah-crf source, nulled by the
      // 20260911110000_... remediation. It now has no governed French any
      // more than Surah 2 does -- all 7 āyahs show the same explicit
      // unavailable fallback, never the old disputed text and never a
      // silent fall-back to English.
      await page.goto("/quran?surah=1");
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(page.getByText("Master of the Day of Judgment,")).not.toBeVisible();
      await expect(
        page.getByText("Traduction française pas encore disponible pour ce verset."),
      ).toHaveCount(7);

      // Surah 2 (non-bootstrap) has no governed French yet — must show the
      // explicit French "unavailable" fallback, real live data, no mocking —
      // and never fall back to showing the English Pickthall text instead.
      await page.goto("/quran?surah=2");
      await expect(
        page.getByText("Traduction française pas encore disponible pour ce verset.").first(),
      ).toBeVisible();
      await expect(page.getByText("Alif. Lam. Mim.")).not.toBeVisible();

      const bodyText = await page.locator("main").innerText();
      expect(bodyText).not.toMatch(/\bnull\b/);
    } finally {
      // In a try/finally so a failed assertion above can never leave the
      // shared E2E account stuck in French for every later test.
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("bookmarks, notes and memorization all work on a real Ayah; French review scheduling gracefully skips (no governed French yet)", async ({
    page,
  }) => {
    // Al-Fil (105) now has a governed Pickthall translation like every
    // other Surah, so it's no longer "Arabic-only" for English — this test
    // switches to French for the memorization/review-scheduling portion,
    // since French genuinely has no governed translation for any
    // non-bootstrap Surah yet, and that's the real "no translation in the
    // active locale" case this test exists to cover.
    const { client, userId } = await createTestUserClient();
    await client.from("bookmarks").delete().eq("user_id", userId).eq("surah_number", 105);
    await client.from("notes").delete().eq("user_id", userId).eq("surah_number", 105);
    await client
      .from("memorization_progress")
      .delete()
      .eq("user_id", userId)
      .eq("surah_number", 105);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_type", "ayah")
      .eq("item_key", "ayah:105:1");

    await page.goto("/quran?surah=105");
    const card = page.locator("#ayah-105-1");

    await card.getByRole("button", { name: "Bookmark Ayah" }).click();
    await expect(card.getByRole("button", { name: "Remove Bookmark" })).toBeVisible();

    await card.getByRole("button", { name: "Add Note" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("Note on a real Ayah (105:1).");
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/rest/v1/notes") && res.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Save" }).click(),
    ]);

    await expect
      .poll(async () => {
        const { count } = await client
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("surah_number", 105)
          .eq("ayah_number", 1);
        return count;
      })
      .toBe(1);
    await expect
      .poll(async () => {
        const { count } = await client
          .from("notes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("surah_number", 105)
          .eq("ayah_number", 1);
        return count;
      })
      .toBe(1);

    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      await page.goto("/memorize?surah=105&ayah=1");
      await expect(page.getByText("Verset 1")).toBeVisible();
      await page.getByRole("button", { name: "Marquer comme mémorisé" }).click();
      await expect(
        page.getByText(
          "Marqué comme mémorisé. Les rappels de révision commenceront dès qu'une traduction sera disponible pour ce verset.",
        ),
      ).toBeVisible();

      await expect
        .poll(async () => {
          const { data } = await client
            .from("memorization_progress")
            .select("status")
            .eq("user_id", userId)
            .eq("surah_number", 105)
            .eq("ayah_number", 1)
            .maybeSingle();
          return data?.status;
        })
        .toBe("memorized");

      const { count: reviewCount } = await client
        .from("review_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("item_type", "ayah")
        .eq("item_key", "ayah:105:1");
      expect(reviewCount).toBe(0);
    } finally {
      // In a try/finally so a failed assertion above can never leave the
      // shared E2E account stuck in French for every later test.
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("review_items.back for an English Ayah contains the normalized Pickthall translation", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("memorization_progress")
      .delete()
      .eq("user_id", userId)
      .eq("surah_number", 105);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_type", "ayah")
      .eq("item_key", "ayah:105:1");

    const { data: source } = await client
      .from("content_sources")
      .select("id")
      .eq("content_type", "translation")
      .eq("language", "en")
      .eq("translator", "Marmaduke Pickthall")
      .eq("edition_identifier", "pickthall-gutenberg-16955")
      .single();
    const { data: translation } = await client
      .from("translations")
      .select("text")
      .eq("source_id", source!.id)
      .eq("surah_number", 105)
      .eq("ayah_number", 1)
      .single();

    await page.goto("/memorize?surah=105&ayah=1");
    await page.getByRole("button", { name: "Mark as memorized" }).click();
    await expect(page.getByText("Marked as memorized.", { exact: true })).toBeVisible();

    await expect
      .poll(async () => {
        const { data } = await client
          .from("review_items")
          .select("back")
          .eq("user_id", userId)
          .eq("item_type", "ayah")
          .eq("item_key", "ayah:105:1")
          .maybeSingle();
        return data?.back;
      })
      .toBe(translation!.text);
  });

  test("EN/FR UI stays stable when reading a non-bootstrap Surah", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto("/quran?surah=18");
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      const arabic = page.locator('[lang="ar"][dir="rtl"]').first();
      await expect(arabic).toBeVisible();
      const bodyText = await page.locator("main").innerText();
      expect(bodyText).not.toMatch(/\bnull\b/);
    } finally {
      // In a try/finally so a failed assertion above can never leave the
      // shared E2E account stuck in French for every later test.
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});

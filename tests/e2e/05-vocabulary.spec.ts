import { test, expect, type APIRequestContext } from "@playwright/test";

import { createTestUserClient, countRows } from "./utils/db";
import { fillUntil } from "./utils/retry";

async function apiGet(request: APIRequestContext, path: string) {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const res = await request.get(`${url}/rest/v1/${path}`, { headers: { apikey: anonKey } });
  return res.json();
}

test.describe("vocabulary (Qur'an word browser)", () => {
  test("search narrows the word list", async ({ page }) => {
    await page.goto("/quran");
    await expect(page.getByRole("heading", { name: "Most frequent Qur'anic words" })).toBeVisible();

    await fillUntil(page.getByPlaceholder("Search words…"), "Lord", async () => {
      await expect(page.getByText("Rabb", { exact: true })).toBeVisible({ timeout: 3_000 });
      await expect(page.getByText("Ṣirāṭ", { exact: true })).not.toBeVisible();
    });
  });

  test("saving a word creates user_vocabulary and a review_items row; removing deletes both", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();

    await page.goto("/quran");
    await fillUntil(page.getByPlaceholder("Search words…"), "Rabb", () =>
      expect(page.getByText("رَبّ", { exact: true })).toBeVisible({ timeout: 3_000 }),
    );

    await page.getByRole("button", { name: "Save for review" }).first().click();
    await expect(page.getByRole("button", { name: "Saved" }).first()).toBeVisible();

    await expect.poll(async () => countRows(client, "user_vocabulary", userId)).toBeGreaterThan(0);
    await expect.poll(async () => countRows(client, "review_items", userId)).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Saved" }).first().click();
    await expect(page.getByRole("button", { name: "Save for review" }).first()).toBeVisible();
    await expect.poll(async () => countRows(client, "user_vocabulary", userId)).toBe(0);
  });
});

/**
 * Yellow-debt cleanup: seedVocabularyToReviews() (src/lib/study.ts)
 * previously read the raw legacy word_frequency.meaning/meaning_fr columns
 * via a hardcoded locale === "fr" ? word.meaning_fr : word.meaning ternary.
 * Fixed by wiring fetchWordFrequency() (src/lib/vocabulary.ts) to join
 * word_frequency_translations and resolve a `resolvedMeaning` field via the
 * same resolveTranslation() used throughout the curriculum data layer --
 * seedVocabularyToReviews now just reads that already-resolved value, with
 * no locale parameter and no branching of its own. The vocabulary browser's
 * own meaning display was updated the same way, closing a second, adjacent
 * inconsistency where it always showed English plus a conditional French
 * line underneath rather than one resolved value.
 *
 * "Fallback behavior" (locale requested but not yet translated) is not
 * re-tested here: resolveTranslation() is exhaustively unit-tested for
 * exactly this contract in locale-resolution.test.ts, this wiring calls it
 * unmodified, and the publishable-key client this suite uses cannot write
 * directly into word_frequency_translations to construct an incomplete-
 * translation fixture (read-only RLS by design) -- the same constraint
 * already documented for lesson content in 42-i18n-foundation-phase1.spec.ts.
 */
test.describe("vocabulary review-card localization (pre-Level-5 hardening, part 2)", () => {
  const ITEM_KEY_PREFIX = "word:";

  test("English: saved word seeds an English review card", async ({ page, request }) => {
    const words = (await apiGet(request, "word_frequency?select=id,transliteration")) as {
      id: string;
      transliteration: string | null;
    }[];
    const word = words.find((w) => w.transliteration === "Ar-Raḥīm")!;
    const itemKey = `${ITEM_KEY_PREFIX}${word.id}`;
    const { client, userId } = await createTestUserClient();
    await client.from("user_vocabulary").delete().eq("user_id", userId).eq("word_id", word.id);
    await client.from("review_items").delete().eq("user_id", userId).eq("item_key", itemKey);

    await page.goto("/quran");
    await fillUntil(page.getByPlaceholder("Search words…"), "Raḥīm", async () => {
      await expect(page.getByText("Ar-Raḥīm", { exact: true })).toBeVisible({ timeout: 3_000 });
      // Confirms the search actually narrowed the list -- without this,
      // "Ar-Raḥīm" being visible is trivially true even in the unfiltered
      // list, and .first() below could grab an unrelated word's button.
      await expect(page.getByText("Allāh", { exact: true })).not.toBeVisible();
    });
    await expect(page.getByText("The Most Merciful", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save for review" }).first().click();
    await expect(page.getByRole("button", { name: "Saved" }).first()).toBeVisible();

    await expect
      .poll(async () => {
        const { data } = await client
          .from("review_items")
          .select("back, context")
          .eq("user_id", userId)
          .eq("item_key", itemKey)
          .maybeSingle();
        return data;
      })
      .toMatchObject({ back: expect.stringContaining("The Most Merciful") });

    await client.from("user_vocabulary").delete().eq("user_id", userId).eq("word_id", word.id);
    await client.from("review_items").delete().eq("user_id", userId).eq("item_key", itemKey);
  });

  test("French: saved word seeds a French review card (no English leakage), and it displays correctly in a real Practice session", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const words = (await apiGet(request, "word_frequency?select=id,transliteration")) as {
      id: string;
      transliteration: string | null;
    }[];
    const word = words.find((w) => w.transliteration === "Ar-Raḥīm")!;
    const itemKey = `${ITEM_KEY_PREFIX}${word.id}`;
    const { client, userId } = await createTestUserClient();
    await client.from("user_vocabulary").delete().eq("user_id", userId).eq("word_id", word.id);
    await client.from("review_items").delete().eq("user_id", userId).eq("item_key", itemKey);
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    try {
      await page.goto("/quran");
      await fillUntil(page.getByPlaceholder("Rechercher des mots…"), "Raḥīm", async () => {
        await expect(page.getByText("Ar-Raḥīm", { exact: true })).toBeVisible({ timeout: 3_000 });
        await expect(page.getByText("Allāh", { exact: true })).not.toBeVisible();
      });
      // The card itself must show only the French meaning -- no English
      // leakage in the vocabulary browser's own display either.
      await expect(page.getByText("Le Très Miséricordieux", { exact: true })).toBeVisible();
      await expect(page.getByText("The Most Merciful", { exact: true })).not.toBeVisible();

      await page.getByRole("button", { name: "Enregistrer pour réviser" }).first().click();
      await expect(page.getByRole("button", { name: "Enregistré" }).first()).toBeVisible();

      await expect
        .poll(async () => {
          const { data } = await client
            .from("review_items")
            .select("back, context")
            .eq("user_id", userId)
            .eq("item_key", itemKey)
            .maybeSingle();
          return data;
        })
        .not.toBeNull();
      const { data: item } = await client
        .from("review_items")
        .select("back, context")
        .eq("user_id", userId)
        .eq("item_key", itemKey)
        .single();
      expect(item!.back).toContain("Le Très Miséricordieux");
      expect(item!.back).not.toContain("The Most Merciful");

      // Full journey: displays correctly in a real Practice session.
      // Backdated well past "-7 days" (the offset other specs' analogous
      // checks use) so this item doesn't tie with theirs for position in
      // the due-date-ascending, 20-item-capped queue on this shared
      // account -- a tie could push either item outside that window.
      const backdated = new Date();
      backdated.setDate(backdated.getDate() - 30);
      await client
        .from("review_items")
        .update({ due_date: backdated.toLocaleDateString("en-CA") })
        .eq("user_id", userId)
        .eq("item_key", itemKey);

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
        // Reveal whatever card is current and check its back text -- more
        // robust than pre-matching the Arabic front text (exact Arabic-text
        // matching is fragile across API-fetched vs DOM-rendered strings).
        const reveal = page.getByRole("button", { name: "Toucher pour révéler" });
        if (await reveal.isVisible().catch(() => false)) {
          await reveal.click();
          if (
            await page
              .getByText(/Le Très Miséricordieux/)
              .isVisible()
              .catch(() => false)
          ) {
            sawFrenchBack = true;
          }
          await page.getByRole("button", { name: "Acquis" }).click();
          continue;
        }
        await page.waitForTimeout(300);
      }
      expect(sawFrenchBack).toBe(true);
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
      await client.from("user_vocabulary").delete().eq("user_id", userId).eq("word_id", word.id);
      await client.from("review_items").delete().eq("user_id", userId).eq("item_key", itemKey);
    }
  });
});

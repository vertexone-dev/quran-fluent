import { test, expect, type Page } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Settings had no dedicated coverage before this file. Focused on the two
 * defects this audit found and fixed -- the daily-goal field accepting any
 * value with no upper bound, and a failed load silently falling through to
 * a form full of blank/default values with no error state at all -- plus a
 * basic save-and-persist happy path for the page's other controls, since
 * neither existed.
 */

/**
 * Local dev has no real Kazimirski data (see
 * 50-kazimirski-french-reader.spec.ts's own module docstring), so this
 * mocks just enough of it -- Al-Fatiha's 7 āyahs, the same frozen
 * production fixture 49-french-translation-remediation.spec.ts and
 * 50-kazimirski-french-reader.spec.ts already use -- to prove the saved
 * translation preference actually reaches the reader. The English/
 * Pickthall side below needs no mocking: it's real, fully-covered local
 * data (Phase 2B covers all 6,236 Ayat).
 */
async function mockKazimirskiAlFatiha(page: Page) {
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
test.describe("settings", () => {
  test.afterEach(async () => {
    // Leaves the daily goal, first name, reciter and transliteration
    // toggle changed; other specs that read them (e.g. dashboard/progress
    // goal displays, and 55-dashboard-mobile-greeting.spec.ts's
    // generic-fallback-name assertion) expect the account's normal
    // baseline, not whatever this file's tests last saved. first_name
    // back to null (not a guessed string) is what resolveGreetingName's
    // own null/empty branch expects; preferred_reciter and
    // show_transliteration back to their column's own schema default.
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({
        daily_goal_minutes: 10,
        preferred_reciter: "mishary_alafasy",
        show_transliteration: true,
      })
      .eq("user_id", userId);
    await client.from("profiles").update({ first_name: null }).eq("id", userId);
  });

  // Regression test: min={1} max={240} on this field were HTML/spinner
  // hints only -- typing e.g. 99999 directly set daily_goal_minutes to
  // 99999 with nothing else in the save path re-checking it. Confirmed
  // against the database, not just the input's own displayed value.
  test("a daily-goal value above 240 is clamped before it can be saved", async ({ page }) => {
    await page.goto("/settings");
    const dailyGoal = page.getByLabel("Daily goal (minutes)");
    await dailyGoal.fill("99999");
    await expect(dailyGoal).toHaveValue("240");

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();

    const { client, userId } = await createTestUserClient();
    const { data } = await client
      .from("learning_preferences")
      .select("daily_goal_minutes")
      .eq("user_id", userId)
      .single();
    expect(data?.daily_goal_minutes).toBe(240);
  });

  // Regression test: fetchLearnerSnapshot (src/lib/learner.ts) never
  // checked .error on any of its three queries, so a failed load still
  // resolved "successfully" with an all-null snapshot -- isError never
  // became true, and this page had no branch for it anyway. The form
  // rendered with every field at its blank initial state instead of the
  // learner's real saved values, one Save click away from overwriting
  // them. Both the missing isError branch and the swallowed error are
  // fixed; this asserts the visible, user-facing symptom either could
  // cause: no silent blank form, and Retry actually recovers.
  test("a failed load shows an error state and never falls through to a blank form", async ({
    page,
  }) => {
    // Settings' own query is capped at retry:1, but it isn't the only
    // consumer of the profiles table: src/lib/i18n.tsx independently fetches
    // interface_language for the same user on mount. Blanket-aborting every
    // /rest/v1/profiles* request (the only way to deterministically fail
    // this page's load) fails that fetch too, and real browser measurement
    // (repeated runs against the dev server) showed the combined retries
    // and connection contention push this page's own isError past 15s,
    // typically resolving around 20s. Generous, measured timeouts here
    // rather than a tight one that assumes a single isolated query.
    test.setTimeout(60_000);

    let blocked = true;
    await page.route("**/rest/v1/profiles*", (route) => {
      if (blocked) return route.abort("failed");
      return route.continue();
    });

    await page.goto("/settings");
    await expect(page.getByText("Couldn't load your settings.")).toBeVisible({ timeout: 35_000 });
    // The form -- and critically, its Save button -- must not be reachable
    // while the real data failed to load.
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await expect(page.getByLabel("First name")).toHaveCount(0);

    blocked = false;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("changing the first name and reciter persists after reload", async ({ page }) => {
    const { client, userId } = await createTestUserClient();

    await page.goto("/settings");
    await page.getByLabel("First name").fill("Test Learner");
    await page.getByLabel("Preferred reciter").click();
    await page.getByRole("option", { name: "Mahmoud Khalil Al-Husary" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("First name")).toHaveValue("Test Learner");
    await expect(page.getByLabel("Preferred reciter")).toContainText("Mahmoud Khalil Al-Husary");

    const { data: profile } = await client
      .from("profiles")
      .select("first_name")
      .eq("id", userId)
      .single();
    expect(profile?.first_name).toBe("Test Learner");
    const { data: prefs } = await client
      .from("learning_preferences")
      .select("preferred_reciter")
      .eq("user_id", userId)
      .single();
    expect(prefs?.preferred_reciter).toBe("husary");
  });

  // Regression test for the preferred-translation wiring
  // (resolvePreferredTranslationLocale in src/lib/quran.ts): proves the
  // saved preference actually controls the reader, independently of the
  // interface-language switch, and survives a reload -- not just that it
  // round-trips through Settings' own form state.
  test("saved translation preference overrides interface language and persists across reload", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    const { data: before } = await client
      .from("learning_preferences")
      .select("preferred_translation")
      .eq("user_id", userId)
      .single();
    // Falls back to the column's own schema default ("en_sahih" -- the
    // column is NOT NULL) only in the practically-impossible case this
    // select returns nothing for the shared test account; never null.
    const originalPreferredTranslation = before?.preferred_translation ?? "en_sahih";
    await mockKazimirskiAlFatiha(page);

    try {
      // 1-2: select Kazimirski (French) and save, while still under the
      // English interface.
      await page.goto("/settings");
      await page.getByLabel("Preferred translation").click();
      await page.getByRole("option", { name: "French — Kazimirski (1869)" }).click();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();

      // 3-4: the reader shows French under the English interface, and it
      // survives a reload (not just this one in-memory save).
      await page.goto("/quran");
      await expect(page.getByText("Au nom du Dieu clément et miséricordieux.")).toBeVisible();
      await expect(page.getByText(/^Praise be to Allah/)).not.toBeVisible();

      await page.reload();
      await expect(page.getByText("Au nom du Dieu clément et miséricordieux.")).toBeVisible();

      const { data: afterKazimirski } = await client
        .from("learning_preferences")
        .select("preferred_translation")
        .eq("user_id", userId)
        .single();
      expect(afterKazimirski?.preferred_translation).toBe("kazimirski-1869-segments-v1");

      await page.goto("/settings");
      await expect(page.getByLabel("Preferred translation")).toContainText("Kazimirski");

      // 6-7: switch to Pickthall (English) and save, then flip the
      // interface to French -- English must still win, proving the
      // override works in the other direction too.
      await page.getByLabel("Preferred translation").click();
      await page.getByRole("option", { name: "English — Pickthall" }).click();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();

      await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
      await page.goto("/quran");
      await expect(page.getByText(/^Praise be to Allah/)).toBeVisible();
      await expect(page.getByText("Au nom du Dieu clément et miséricordieux.")).not.toBeVisible();
    } finally {
      // 8: restore exactly what was there before this test, not a
      // hardcoded value -- this test must never change what any other
      // spec sees afterward.
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
      await client
        .from("learning_preferences")
        .update({ preferred_translation: originalPreferredTranslation })
        .eq("user_id", userId);
    }
  });

  // Regression test for the show_transliteration load fix
  // (resolveShowTransliteration in src/lib/quran.ts): Settings previously
  // always showed the toggle "on" regardless of what was actually saved
  // (defect #1). The reader itself deliberately shows nothing for this
  // preference -- no per-ayah transliteration data exists anywhere (the
  // `ayahs` table has no such column), and a per-ayah "not available" note
  // was explicitly rejected as noisy UX -- so this only covers Settings:
  // loading the real saved value, the explanatory hint instead of a false
  // promise of immediate content, persistence after reload, and no
  // interference with the independently saved translation preference.
  test("transliteration toggle loads the real saved value, shows its unavailable-today hint, and persists after reload", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    // Seeded to false (the opposite of the schema default) so loading
    // Settings next is a real test of defect #1 -- the toggle must show
    // *this* saved value, not its own useState(true) placeholder.
    await client
      .from("learning_preferences")
      .update({ show_transliteration: false, preferred_translation: "en_sahih" })
      .eq("user_id", userId);

    try {
      await page.goto("/settings");
      await expect(page.getByLabel("Show transliteration")).toHaveAttribute(
        "aria-checked",
        "false",
      );
      // Must be honest that enabling it doesn't mean content appears
      // immediately -- never implies the reader will show anything yet.
      await expect(
        page.getByText(
          "Ayah-by-ayah transliteration isn't available in the Qur'an Reader yet. Your preference is saved and will take effect as soon as it launches.",
        ),
      ).toBeVisible();

      // Flip it on and save.
      await page.getByLabel("Show transliteration").click();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();

      // Persists after reload, not just this in-memory save.
      await page.reload();
      await expect(page.getByLabel("Show transliteration")).toHaveAttribute("aria-checked", "true");

      // The reader renders no transliteration row at all, enabled or not
      // -- no fabricated content, and no repeated "unavailable" message
      // either. Scoped to the Ayah cards themselves (each has
      // id="ayah-{surah}-{ayah}" -- see AyahCard.tsx), not the whole page:
      // /quran's own static copy legitimately mentions "transliteration"
      // twice (the page intro and the vocabulary section intro, both
      // pre-existing and unrelated to AyahCard), so a page-wide search
      // would always find matches that have nothing to do with what this
      // assertion is actually checking.
      await page.goto("/quran");
      await expect(page.locator('[id^="ayah-"]').getByText(/[Tt]ransliteration/)).toHaveCount(0);

      // No regression to the independently saved translation preference:
      // switching it to Kazimirski must keep working, and must not affect
      // the transliteration toggle (proves the two preferences don't
      // interfere with each other).
      await page.goto("/settings");
      await page.getByLabel("Preferred translation").click();
      await page.getByRole("option", { name: "French — Kazimirski (1869)" }).click();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();
      await expect(page.getByLabel("Show transliteration")).toHaveAttribute("aria-checked", "true");

      const { data: prefs } = await client
        .from("learning_preferences")
        .select("show_transliteration, preferred_translation")
        .eq("user_id", userId)
        .single();
      expect(prefs?.show_transliteration).toBe(true);
      expect(prefs?.preferred_translation).toBe("kazimirski-1869-segments-v1");
    } finally {
      // afterEach already restores show_transliteration to the schema
      // default, but it never touches preferred_translation (the sibling
      // test above restores its own, more precisely, since it can't
      // assume what was there before) -- this test set it to "en_sahih"
      // itself above, so restoring that exact value here is what
      // actually happened before this test touched it.
      await client
        .from("learning_preferences")
        .update({ preferred_translation: "en_sahih" })
        .eq("user_id", userId);
    }
  });
});

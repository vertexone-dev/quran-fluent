import { test, expect, type Page } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Covers the governed Kazimirski (1869) French translation resolver's
 * integration into the Reader — the certified production import
 * (supabase/migrations/20260912100000_..., 6239 segments / 6396 joins,
 * 6236/6236 canonical coverage, content_sources id
 * f8443b10-3cc8-59ee-954f-5b1129c1cec4).
 *
 * Local dev does not carry the real, production-shaped Kazimirski-v1 data
 * (it still has an unrelated Phase 3 prototype fixture under a different
 * edition_identifier and an older join-table shape) — production itself is
 * already certified and independently re-verified multiple times elsewhere
 * in this project. Following this codebase's own established convention
 * (see 14-translation-fallback.spec.ts, 49-french-translation-remediation
 * .spec.ts), these tests use route interception to serve exact, real
 * production data (taken directly from the frozen artifact,
 * scripts/quran-import/kazimirski/generated/kazimirski-production-import.json)
 * for two representative Surahs, so what's under test is the resolver +
 * Reader integration itself, not a live database round trip. Al-Fatiha
 * covers the straightforward shapes (direct/offset/source_anomaly plus one
 * many_to_one ayah); Surah 106 (Quraish) covers the complex "compound mixed
 * split+merge" shape — a segment spanning two ayahs where the second ayah
 * also carries its own additional segment, which is exactly the case that
 * would duplicate text if the resolver didn't respect segment-span "home
 * ayah" semantics (see src/lib/kazimirski.ts and its unit tests).
 */

const KAZIMIRSKI_SOURCE_ID = "f8443b10-3cc8-59ee-954f-5b1129c1cec4";

type FixtureSegment = { id: string; source_ordinal: number; text: string; alignment_type: string };
type FixtureJoin = { ayah_number: number; segment: FixtureSegment };

const AL_FATIHA_JOINS: FixtureJoin[] = [
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
];

const QURAISH_JOINS: FixtureJoin[] = [
  {
    ayah_number: 1,
    segment: {
      id: "seg-106-1",
      source_ordinal: 1,
      text: "À l’union des KOREICHITES ;",
      alignment_type: "direct",
    },
  },
  {
    ayah_number: 2,
    segment: {
      id: "seg-106-2",
      source_ordinal: 2,
      text: "À leur union, pour envoyer des caravanes pendant l’hiver et l’été !",
      alignment_type: "direct",
    },
  },
  {
    ayah_number: 3,
    segment: {
      id: "seg-106-3",
      source_ordinal: 3,
      text: "Qu’ils servent le Dieu de ce temple, le Dieu qui les a nourris et préservés de la famine,",
      alignment_type: "compound",
    },
  },
  {
    ayah_number: 4,
    segment: {
      id: "seg-106-3",
      source_ordinal: 3,
      text: "Qu’ils servent le Dieu de ce temple, le Dieu qui les a nourris et préservés de la famine,",
      alignment_type: "compound",
    },
  },
  {
    ayah_number: 4,
    segment: {
      id: "seg-106-4",
      source_ordinal: 4,
      text: "Et qui les a délivrés des alarmes.",
      alignment_type: "compound",
    },
  },
];

async function mockKazimirskiSource(page: Page) {
  await page.route("**/rest/v1/content_sources*", async (route) => {
    const url = route.request().url();
    if (!url.includes("edition_identifier=eq.kazimirski-1869-segments-v1")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: KAZIMIRSKI_SOURCE_ID,
        translator: "Albin de Kazimirski Biberstein",
      }),
    });
  });
}

async function mockKazimirskiSurah(page: Page, surahNumber: number, joins: FixtureJoin[]) {
  await page.route("**/rest/v1/translation_segment_ayahs*", async (route) => {
    const url = route.request().url();
    if (!url.includes(`surah_number=eq.${surahNumber}`)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(joins),
    });
  });
}

async function setFrench(
  client: Awaited<ReturnType<typeof createTestUserClient>>["client"],
  userId: string,
) {
  await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
}
async function resetToEnglish(
  client: Awaited<ReturnType<typeof createTestUserClient>>["client"],
  userId: string,
) {
  await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
}

test.describe("Kazimirski governed French Reader integration", () => {
  test("Al-Fatiha: straightforward mapping (direct/offset/source_anomaly) plus a many_to_one ayah, in source order", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await setFrench(client, userId);
    await mockKazimirskiSource(page);
    await mockKazimirskiSurah(page, 1, AL_FATIHA_JOINS);
    try {
      await page.goto("/quran");
      await expect(page.getByRole("combobox", { name: "Choisir une sourate" })).toHaveText(
        /Al-Fatiha/,
      );
      await expect(page.getByText("Au nom du Dieu clément et miséricordieux.")).toBeVisible();
      await expect(page.getByText("Louange à Dieu, maître de l’univers")).toBeVisible();
      await expect(page.getByText("Le clément, le miséricordieux,")).toBeVisible();
      await expect(page.getByText("Souverain au jour de la rétribution.")).toBeVisible();
      await expect(
        page.getByText("C’est toi que nous adorons, c’est toi dont nous implorons le secours."),
      ).toBeVisible();
      await expect(page.getByText("Dirige-nous dans le sentier droit,")).toBeVisible();
      // many_to_one ayah 7: two 1869 segments composed in source order,
      // joined by a single space -- never reordered, never edited.
      await expect(
        page.getByText(
          "Dans le sentier de ceux que tu as comblés de tes bienfaits, Non pas de ceux qui ont encouru ta colère, ni de ceux qui s’égarent.",
        ),
      ).toBeVisible();
      // Never silently falls back to English under the French UI.
      await expect(page.getByText(/^Praise be to Allah/)).not.toBeVisible();
      // Correct attribution, not the disputed Hamidullah source.
      await expect(page.getByText(/Traducteur\s*:\s*Albin de Kazimirski Biberstein/)).toHaveCount(
        7,
      );
      await page
        .getByRole("button", { name: /Traducteur/ })
        .first()
        .click();
      await expect(page.getByText(/Le Koran, Charpentier, édition de 1869/)).toBeVisible();
    } finally {
      await resetToEnglish(client, userId);
    }
  });

  test("Surah 106 (Quraish): compound mixed split+merge does not duplicate the shared segment's text", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await setFrench(client, userId);
    await mockKazimirskiSource(page);
    await mockKazimirskiSurah(page, 106, QURAISH_JOINS);
    try {
      await page.goto("/quran?surah=106");
      await expect(page.getByText("À l’union des KOREICHITES ;")).toBeVisible();
      await expect(
        page.getByText("À leur union, pour envoyer des caravanes pendant l’hiver et l’été !"),
      ).toBeVisible();
      // Ayah 3 (the segment's home) renders the shared text exactly once.
      await expect(
        page.getByText(
          "Qu’ils servent le Dieu de ce temple, le Dieu qui les a nourris et préservés de la famine,",
        ),
      ).toHaveCount(1);
      // Ayah 4 renders ONLY its own additional segment's text -- the shared
      // segment's text (already shown on ayah 3) must not be repeated here.
      await expect(page.getByText("Et qui les a délivrés des alarmes.")).toBeVisible();
      await expect(
        page.getByText(
          "Qu’ils servent le Dieu de ce temple, le Dieu qui les a nourris et préservés de la famine, Et qui les a délivrés des alarmes.",
        ),
      ).toHaveCount(0);
    } finally {
      await resetToEnglish(client, userId);
    }
  });

  test("English translation is unaffected by the French Kazimirski integration (Pickthall, unchanged)", async ({
    page,
  }) => {
    // Al-Fatiha is the reader's default surah with no ?surah= param.
    await page.goto("/quran");
    await expect(page.getByText(/^Praise be to Allah/)).toBeVisible();
    await expect(page.getByText(/Translator:\s*Marmaduke Pickthall/).first()).toBeVisible();
  });

  test("canonical Arabic text is unaffected and RTL is preserved under the French UI", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await setFrench(client, userId);
    await mockKazimirskiSource(page);
    await mockKazimirskiSurah(page, 1, AL_FATIHA_JOINS);
    try {
      await page.goto("/quran");
      const arabic = page.locator('[dir="rtl"][lang="ar"]').first();
      await expect(arabic).toBeVisible();
      await expect(arabic).toContainText("بِسْمِ");
    } finally {
      await resetToEnglish(client, userId);
    }
  });

  test("Reader remains usable at 390x844 with French Kazimirski translation shown", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await setFrench(client, userId);
    await mockKazimirskiSource(page);
    await mockKazimirskiSurah(page, 1, AL_FATIHA_JOINS);
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/quran");
      await expect(page.getByText("Au nom du Dieu clément et miséricordieux.")).toBeVisible();
      const arabic = page.locator('[dir="rtl"][lang="ar"]').first();
      await expect(arabic).toBeVisible();
    } finally {
      await resetToEnglish(client, userId);
    }
  });

  test("fallback: an ayah with no Kazimirski coverage still shows the existing 'unavailable' state, not a crash or literal null", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await setFrench(client, userId);
    await mockKazimirskiSource(page);
    await mockKazimirskiSurah(page, 108, []); // no coverage at all for this surah
    try {
      await page.goto("/quran?surah=108");
      await expect(
        page.getByText("Traduction française pas encore disponible pour ce verset."),
      ).toHaveCount(3);
      const bodyText = await page.textContent("body");
      expect(bodyText).not.toMatch(/\bnull\b/);
    } finally {
      await resetToEnglish(client, userId);
    }
  });
});

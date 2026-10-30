import { beforeEach, describe, expect, test, vi } from "vitest";

import { resolvePreferredTranslationLocale, resolveShowTransliteration } from "./quran";
import { KAZIMIRSKI_EDITION_ID } from "./kazimirski";
import { PICKTHALL_EDITION_ID } from "./translations";

// ---------------------------------------------------------------------------
// resolvePreferredTranslationLocale -- pure, no network, no mocking needed.
// ---------------------------------------------------------------------------
describe("resolvePreferredTranslationLocale", () => {
  test("no saved preference falls back to the interface locale (today's exact behavior)", () => {
    expect(resolvePreferredTranslationLocale(null, "en")).toBe("en");
    expect(resolvePreferredTranslationLocale(undefined, "fr")).toBe("fr");
  });

  test("an unrecognized/foreign value also falls back to the interface locale", () => {
    expect(resolvePreferredTranslationLocale("fr_hamidullah", "en")).toBe("en");
    expect(resolvePreferredTranslationLocale("some_unknown_value", "fr")).toBe("fr");
  });

  test("Pickthall preference resolves to English regardless of interface locale", () => {
    expect(resolvePreferredTranslationLocale(PICKTHALL_EDITION_ID, "en")).toBe("en");
    expect(resolvePreferredTranslationLocale(PICKTHALL_EDITION_ID, "fr")).toBe("en");
  });

  test("Kazimirski preference resolves to French regardless of interface locale", () => {
    expect(resolvePreferredTranslationLocale(KAZIMIRSKI_EDITION_ID, "en")).toBe("fr");
    expect(resolvePreferredTranslationLocale(KAZIMIRSKI_EDITION_ID, "fr")).toBe("fr");
  });

  // "en_sahih" is learning_preferences.preferred_translation's schema
  // default (NOT NULL DEFAULT 'en_sahih'), untouched for every learner who
  // never actively saved a choice -- effectively every existing learner,
  // since the old Settings page only ever offered it pre-selected.
  // Treating it as "prefer English" would silently flip every existing
  // French-interface learner's reader to English the moment this
  // shipped, with no action on their part -- exactly the regression this
  // function exists to prevent, so it must be indistinguishable from "no
  // preference at all".
  test("legacy en_sahih schema default falls back to the interface locale, same as no preference", () => {
    expect(resolvePreferredTranslationLocale("en_sahih", "fr")).toBe("fr");
    expect(resolvePreferredTranslationLocale("en_sahih", "en")).toBe("en");
  });

  // Regression guard: the Settings page's own default-translation display
  // (settings.index.tsx) must call this exact function with the learner's
  // *current* interface locale to decide what to show for "no saved
  // preference" -- a French-interface learner with nothing saved is
  // actually served Kazimirski by the reader, so the dropdown must not
  // hardcode Pickthall as if it were a fixed, locale-independent default.
  test("no saved preference under a French interface resolves to French, not a hardcoded English default", () => {
    expect(resolvePreferredTranslationLocale(null, "fr")).toBe("fr");
    expect(resolvePreferredTranslationLocale(undefined, "fr")).toBe("fr");
  });
});

// ---------------------------------------------------------------------------
// resolveShowTransliteration -- pure, no network, no mocking needed.
// ---------------------------------------------------------------------------
describe("resolveShowTransliteration", () => {
  test("an explicit saved value round-trips unchanged", () => {
    expect(resolveShowTransliteration(true)).toBe(true);
    expect(resolveShowTransliteration(false)).toBe(false);
  });

  // true is learning_preferences.show_transliteration's own schema default
  // (BOOLEAN NOT NULL DEFAULT true) -- used here for a guest, an unset
  // preference, or while it simply hasn't loaded yet, so none of those
  // cases is ever mistaken for an explicit "off".
  test("missing/unloaded (null or undefined) falls back to the schema default of true", () => {
    expect(resolveShowTransliteration(null)).toBe(true);
    expect(resolveShowTransliteration(undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fetchAyahsWithTranslations -- mocks the exact Supabase calls it makes
// (content_sources, ayahs, translations, translation_segment_ayahs), keyed
// by table name, following the same pattern as curriculum.test.ts.
// ---------------------------------------------------------------------------

type MockResponse = { data: unknown; error: null };

function makeChain(response: MockResponse) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "order", "abortSignal"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain["maybeSingle"] = vi.fn(async () => response);
  chain["then"] = (
    resolve: (value: MockResponse) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(resolve, reject);
  return chain;
}

function mockSupabaseClient(responsesByTable: Record<string, MockResponse>) {
  return {
    supabase: {
      from: vi.fn((table: string) =>
        makeChain(responsesByTable[table] ?? { data: [], error: null }),
      ),
    },
  };
}

const AYAHS = [
  {
    id: "ayah-1",
    surah_number: 1,
    ayah_number: 1,
    arabic_text: "بِسْمِ اللَّهِ",
    translation_en: null,
    translation_fr: null,
  },
  {
    id: "ayah-2",
    surah_number: 1,
    ayah_number: 2,
    arabic_text: "الْحَمْدُ لِلَّهِ",
    translation_en: null,
    translation_fr: null,
  },
];

const PICKTHALL_SOURCE = {
  data: { id: "pickthall-id", translator: "Marmaduke Pickthall" },
  error: null,
};
const KAZIMIRSKI_SOURCE = {
  data: { id: "kazimirski-id", translator: "Albin de Kazimirski Biberstein" },
  error: null,
};

const PICKTHALL_TRANSLATIONS = {
  data: [
    { ayah_number: 1, text: "In the name of Allah" },
    { ayah_number: 2, text: "Praise be to Allah" },
  ],
  error: null,
};

const KAZIMIRSKI_SEGMENTS = {
  data: [
    { ayah_number: 1, segment: { id: "seg-1", source_ordinal: 1, text: "Au nom de Dieu" } },
    { ayah_number: 2, segment: { id: "seg-2", source_ordinal: 1, text: "Louange à Dieu" } },
  ],
  error: null,
};

async function loadWithMock(responsesByTable: Record<string, MockResponse>) {
  vi.resetModules();
  vi.doMock("@/integrations/supabase/client", () => mockSupabaseClient(responsesByTable));
  return import("./quran");
}

describe("fetchAyahsWithTranslations", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("default behavior, English interface, no saved preference: resolves Pickthall", async () => {
    const { fetchAyahsWithTranslations } = await loadWithMock({
      ayahs: { data: AYAHS, error: null },
      content_sources: PICKTHALL_SOURCE,
      translations: PICKTHALL_TRANSLATIONS,
    });
    const result = await fetchAyahsWithTranslations(1, "en");
    expect(result[0]!.resolvedTranslation).toBe("In the name of Allah");
    expect(result[0]!.translationSource?.translator).toBe("Marmaduke Pickthall");
  });

  test("default behavior, French interface, no saved preference: resolves Kazimirski", async () => {
    const { fetchAyahsWithTranslations } = await loadWithMock({
      ayahs: { data: AYAHS, error: null },
      content_sources: KAZIMIRSKI_SOURCE,
      translation_segment_ayahs: KAZIMIRSKI_SEGMENTS,
    });
    const result = await fetchAyahsWithTranslations(1, "fr");
    expect(result[0]!.resolvedTranslation).toBe("Au nom de Dieu");
    expect(result[0]!.translationSource?.translator).toBe("Albin de Kazimirski Biberstein");
  });

  test("saved Pickthall preference wins even under a French interface -- the independence the task requires", async () => {
    const { fetchAyahsWithTranslations } = await loadWithMock({
      ayahs: { data: AYAHS, error: null },
      content_sources: PICKTHALL_SOURCE,
      translations: PICKTHALL_TRANSLATIONS,
    });
    const result = await fetchAyahsWithTranslations(1, "fr", undefined, PICKTHALL_EDITION_ID);
    expect(result[0]!.resolvedTranslation).toBe("In the name of Allah");
    expect(result[0]!.translationSource?.translator).toBe("Marmaduke Pickthall");
  });

  test("saved Kazimirski preference wins even under an English interface -- the independence the task requires", async () => {
    const { fetchAyahsWithTranslations } = await loadWithMock({
      ayahs: { data: AYAHS, error: null },
      content_sources: KAZIMIRSKI_SOURCE,
      translation_segment_ayahs: KAZIMIRSKI_SEGMENTS,
    });
    const result = await fetchAyahsWithTranslations(1, "en", undefined, KAZIMIRSKI_EDITION_ID);
    expect(result[0]!.resolvedTranslation).toBe("Au nom de Dieu");
    expect(result[0]!.translationSource?.translator).toBe("Albin de Kazimirski Biberstein");
  });

  test("an unrecognized/legacy preference never changes attribution from the interface-locale default", async () => {
    const { fetchAyahsWithTranslations } = await loadWithMock({
      ayahs: { data: AYAHS, error: null },
      content_sources: PICKTHALL_SOURCE,
      translations: PICKTHALL_TRANSLATIONS,
    });
    const result = await fetchAyahsWithTranslations(1, "en", undefined, "some_unknown_value");
    expect(result[0]!.translationSource?.translator).toBe("Marmaduke Pickthall");
  });
});

import { describe, expect, test } from "vitest";

import { TRANSLATION_NAMES, translationLabel } from "./translation-labels";

describe("translationLabel", () => {
  test("returns the established label for en_sahih in both locales", () => {
    expect(translationLabel("en_sahih", "en")).toBe("English — Saheeh International");
    expect(translationLabel("en_sahih", "fr")).toBe("Anglais — Saheeh International");
  });

  test("every entry in TRANSLATION_NAMES has both an English and a French label", () => {
    for (const labels of Object.values(TRANSLATION_NAMES)) {
      expect(labels.en.length).toBeGreaterThan(0);
      expect(labels.fr.length).toBeGreaterThan(0);
    }
  });

  test("falls back to a generic, locale-aware label for an unrecognized/legacy value", () => {
    // e.g. a stale "fr_hamidullah" preference from before that source was
    // removed from the settings page -- never guessed at, never invented.
    expect(translationLabel("fr_hamidullah", "en")).toBe("Configured source: fr_hamidullah");
    expect(translationLabel("fr_hamidullah", "fr")).toBe("Source configurée : fr_hamidullah");
  });

  test("never claims an unrecognized value means Pickthall or any other specific edition", () => {
    const result = translationLabel("some_unknown_value", "en");
    expect(result).not.toContain("Pickthall");
    expect(result).toContain("some_unknown_value");
  });
});

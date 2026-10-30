import { describe, expect, test } from "vitest";

import { KAZIMIRSKI_EDITION_ID } from "./kazimirski";
import { PICKTHALL_EDITION_ID } from "./translations";
import { TRANSLATION_NAMES, translationLabel } from "./translation-labels";

describe("translationLabel", () => {
  test("returns the Pickthall label for the real governed English edition", () => {
    expect(translationLabel(PICKTHALL_EDITION_ID, "en")).toBe("English — Pickthall");
    expect(translationLabel(PICKTHALL_EDITION_ID, "fr")).toBe("Anglais — Pickthall");
  });

  test("returns the Kazimirski label for the real governed French edition", () => {
    expect(translationLabel(KAZIMIRSKI_EDITION_ID, "en")).toBe("French — Kazimirski (1869)");
    expect(translationLabel(KAZIMIRSKI_EDITION_ID, "fr")).toBe("Français — Kazimirski (1869)");
  });

  test("labels the legacy en_sahih value as Pickthall, matching how it now resolves", () => {
    // "en_sahih" never had real content behind it (see resolvePreferredTranslationLocale
    // in quran.ts, which treats it as "prefer English"/Pickthall) -- the label must agree.
    expect(translationLabel("en_sahih", "en")).toBe("English — Pickthall");
    expect(translationLabel("en_sahih", "fr")).toBe("Anglais — Pickthall");
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

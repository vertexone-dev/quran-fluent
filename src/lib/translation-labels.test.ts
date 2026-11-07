import { describe, expect, test } from "vitest";

import { KAZIMIRSKI_EDITION_ID } from "./kazimirski";
import { PICKTHALL_EDITION_ID } from "./translations";
import { TRANSLATION_NAMES, translationLabel } from "./translation-labels";

describe("translationLabel", () => {
  test("returns the Pickthall label for the real governed English edition", () => {
    expect(translationLabel(PICKTHALL_EDITION_ID, "en")).toBe("English — Pickthall");
    expect(translationLabel(PICKTHALL_EDITION_ID, "fr")).toBe("Anglais — Pickthall");
    expect(translationLabel(PICKTHALL_EDITION_ID, "ar")).toBe("الإنجليزية — بيكثال");
  });

  test("returns the Kazimirski label for the real governed French edition", () => {
    expect(translationLabel(KAZIMIRSKI_EDITION_ID, "en")).toBe("French — Kazimirski (1869)");
    expect(translationLabel(KAZIMIRSKI_EDITION_ID, "fr")).toBe("Français — Kazimirski (1869)");
    expect(translationLabel(KAZIMIRSKI_EDITION_ID, "ar")).toBe("الفرنسية — كازيمرسكي (1869)");
  });

  test("labels the legacy en_sahih schema default honestly, not as a specific edition", () => {
    // "en_sahih" is the untouched NOT NULL DEFAULT every learner who never
    // actively saved a choice still has -- resolvePreferredTranslationLocale
    // (quran.ts) treats it as "no preference at all" (falls back to the
    // interface locale), so the label must never claim it means Pickthall
    // or any other specific edition.
    expect(translationLabel("en_sahih", "en")).toBe("Not set — follows interface language");
    expect(translationLabel("en_sahih", "fr")).toBe("Non défini — suit la langue de l'interface");
    expect(translationLabel("en_sahih", "ar")).toBe("غير محدد — يتبع لغة الواجهة");
  });

  test("every entry in TRANSLATION_NAMES has an English, French and Arabic label", () => {
    for (const labels of Object.values(TRANSLATION_NAMES)) {
      expect(labels.en.length).toBeGreaterThan(0);
      expect(labels.fr.length).toBeGreaterThan(0);
      expect(labels.ar.length).toBeGreaterThan(0);
    }
  });

  test("falls back to a generic, locale-aware label for an unrecognized/legacy value", () => {
    // e.g. a stale "fr_hamidullah" preference from before that source was
    // removed from the settings page -- never guessed at, never invented.
    expect(translationLabel("fr_hamidullah", "en")).toBe("Configured source: fr_hamidullah");
    expect(translationLabel("fr_hamidullah", "fr")).toBe("Source configurée : fr_hamidullah");
    expect(translationLabel("fr_hamidullah", "ar")).toBe("المصدر المُهيَّأ: fr_hamidullah");
  });

  test("never claims an unrecognized value means Pickthall or any other specific edition", () => {
    const result = translationLabel("some_unknown_value", "en");
    expect(result).not.toContain("Pickthall");
    expect(result).toContain("some_unknown_value");
  });
});

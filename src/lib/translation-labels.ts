import type { Locale } from "@/locales";
import { KAZIMIRSKI_EDITION_ID } from "@/lib/kazimirski";
import { PICKTHALL_EDITION_ID } from "@/lib/translations";

/**
 * Presentation-only labels for `learning_preferences.preferred_translation`
 * values -- keyed identically to the `value`s used by the translation
 * <Select> on the settings page (src/routes/_authenticated/settings.index.tsx),
 * and to that column's actual stored values. Only ever used to display a
 * stored preference, never to change or match it (see
 * resolvePreferredTranslationLocale in src/lib/quran.ts for that).
 *
 * Keyed by the exact edition_identifier each resolver
 * (resolveVerifiedEnglishSource / resolveApprovedFrenchSource) resolves
 * against, imported from those modules rather than retyped here, so a
 * label can never drift from the source it actually describes.
 *
 * "en_sahih" is a legacy stored value from before this preference was
 * wired to the reader -- it named a translation ("Saheeh International")
 * that was never actually servable (no content_sources row ever existed
 * for it). resolvePreferredTranslationLocale treats it as "prefer
 * English" for continuity with whatever a learner who saved it intended,
 * so it's labeled the same as the real Pickthall entry here instead of
 * surfacing the now-meaningless original name.
 *
 * Any other stored value (e.g. a legacy "fr_hamidullah" from before French
 * was removed from the settings page) has no established, verified meaning
 * here, so it is deliberately NOT guessed at: translationLabel() below
 * falls back to a generic, locale-aware label for anything not in this map
 * rather than inventing a name.
 */
export const TRANSLATION_NAMES: Record<string, Record<Locale, string>> = {
  [PICKTHALL_EDITION_ID]: { en: "English — Pickthall", fr: "Anglais — Pickthall" },
  [KAZIMIRSKI_EDITION_ID]: {
    en: "French — Kazimirski (1869)",
    fr: "Français — Kazimirski (1869)",
  },
  en_sahih: { en: "English — Pickthall", fr: "Anglais — Pickthall" },
};

export function translationLabel(value: string, locale: Locale): string {
  const known = TRANSLATION_NAMES[value];
  if (known) return known[locale];
  return locale === "fr" ? `Source configurée : ${value}` : `Configured source: ${value}`;
}

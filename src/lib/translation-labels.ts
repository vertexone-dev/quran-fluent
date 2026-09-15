import type { Locale } from "@/locales";

/**
 * Presentation-only labels for `learning_preferences.preferred_translation`
 * values -- keyed identically to the `value`s used by the translation
 * <Select> on the settings page (src/routes/_authenticated/settings.tsx),
 * and to that column's actual stored values. Only ever used to display a
 * stored preference, never to change or match it.
 *
 * "en_sahih" is Saheeh International (an English translation) -- confirmed
 * from the settings page's own pre-existing <Select> option, not assumed.
 * This is a distinct edition from the governed Pickthall translation the
 * Qur'an reader itself serves (src/lib/translations.ts's
 * resolveVerifiedEnglishSource(), content_sources.edition_identifier
 * "pickthall-gutenberg-16955") -- the two are unrelated, and this
 * preference does not currently change which translation the reader shows.
 *
 * Any other stored value (e.g. a legacy "fr_hamidullah" from before French
 * was removed from the settings page -- see that page's own comment) has
 * no established, verified meaning here, so it is deliberately NOT guessed
 * at: translationLabel() below falls back to a generic, locale-aware label
 * for anything not in this map rather than inventing a name.
 */
export const TRANSLATION_NAMES: Record<string, Record<Locale, string>> = {
  en_sahih: { en: "English — Saheeh International", fr: "Anglais — Saheeh International" },
};

export function translationLabel(value: string, locale: Locale): string {
  const known = TRANSLATION_NAMES[value];
  if (known) return known[locale];
  return locale === "fr" ? `Source configurée : ${value}` : `Configured source: ${value}`;
}

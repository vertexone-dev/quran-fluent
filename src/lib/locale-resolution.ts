/**
 * Pure locale-resolution logic shared by the curriculum data layer
 * (src/lib/curriculum.ts) and the i18n provider (src/lib/i18n.tsx). Kept in
 * its own dependency-free module -- no Supabase client, no React -- so it
 * can be unit-tested directly (Internationalization Foundation Phase 1)
 * without pulling in module-level I/O side effects.
 */

export type Locale = string;

/**
 * Generalized replacement for the old binary pickLocale(en, fr, locale) --
 * given a set of per-locale translation rows (from one of the
 * *_translations tables), returns the row matching `locale`, falling back
 * to English, then null if neither exists. Scales to any locale set (en,
 * fr, ar, ur, id, ...) with zero per-language code change: adding a
 * language means adding translation rows, never touching this function or
 * any of its callers.
 */
export function resolveTranslation<T extends { locale: string }>(
  rows: readonly T[] | null | undefined,
  locale: Locale,
): T | null {
  if (!rows || rows.length === 0) return null;
  return rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === "en") ?? null;
}

/**
 * The stricter fallback rule for curriculum CONTENT (as opposed to UI
 * chrome, which keeps its existing per-key t()/d fallback): a lesson is
 * rendered entirely in the requested locale only if EVERY one of its own
 * parts (its own title, every section, every exercise) has a translation
 * row in that locale -- otherwise the whole lesson renders in English, so a
 * learner never sees a section in French sandwiched between two sections
 * that silently fell back to English. English itself is always "complete"
 * by definition, since every row above was originally authored in English.
 */
export function resolveLessonLocale(
  locale: Locale,
  hasLessonTranslation: boolean,
  sectionIds: readonly string[],
  sectionLocales: ReadonlyMap<string, ReadonlySet<Locale>>,
  exerciseIds: readonly string[],
  exerciseLocales: ReadonlyMap<string, ReadonlySet<Locale>>,
): Locale {
  if (locale === "en") return "en";
  const lessonOk = hasLessonTranslation;
  const sectionsOk = sectionIds.every((id) => sectionLocales.get(id)?.has(locale));
  const exercisesOk = exerciseIds.every((id) => exerciseLocales.get(id)?.has(locale));
  return lessonOk && sectionsOk && exercisesOk ? locale : "en";
}

/**
 * Global app-direction foundation for the future Arabic/Urdu interface
 * locales -- keyed by every locale the i18n architecture targets, not just
 * the two currently SUPPORTED_LOCALES, so enabling ar/ur later needs no
 * change here. Every locale not listed (en, fr, id) is LTR. This governs
 * the *application shell's* direction only -- canonical Qur'anic/Arabic
 * content keeps its own local `dir="rtl" lang="ar"` marking on the specific
 * elements that carry it, completely independent of this setting.
 */
const RTL_LOCALES: ReadonlySet<string> = new Set(["ar", "ur"]);

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(locale);
}

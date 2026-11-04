/**
 * Pure decision logic for where the Reading screen should resume, kept out
 * of ReadingScreen.tsx so it can be unit tested without a DOM/React
 * rendering environment (see home-dashboard.ts for the same convention).
 *
 * This single function is the one place that distinguishes the three ways
 * a reader can land on a Surah:
 *  - Continue Reading (Home card): no explicit target ayah, saved position
 *    matches this surah -> resume there.
 *  - Opening a Surah from the list: no explicit target ayah; if the saved
 *    position belongs to a *different* surah, it must never be applied
 *    here (there is nothing to "continue" in a surah the reader didn't
 *    just leave) -- so this returns null (start at the top) instead of
 *    silently overriding the reader's intentional navigation.
 *  - Opening a bookmarked ayah: an explicit target ayah always wins,
 *    regardless of any saved position.
 */
export type ReadingPosition = {
  surahNumber: number;
  ayahNumber: number;
  updatedAt: string;
};

function inRange(ayahNumber: number, ayahCount: number): boolean {
  return Number.isInteger(ayahNumber) && ayahNumber >= 1 && ayahNumber <= ayahCount;
}

export function resolveResumeAyah(
  surahNumber: number,
  ayahCount: number,
  targetAyahNumber: number | undefined,
  savedPosition: ReadingPosition | null,
): number | null {
  if (targetAyahNumber != null) {
    return inRange(targetAyahNumber, ayahCount) ? targetAyahNumber : null;
  }
  if (savedPosition && savedPosition.surahNumber === surahNumber) {
    return inRange(savedPosition.ayahNumber, ayahCount) ? savedPosition.ayahNumber : null;
  }
  return null;
}

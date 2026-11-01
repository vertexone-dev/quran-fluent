/**
 * Pure selection logic for the Home Dashboard's "Continue Reading" card,
 * kept out of HomeScreen.tsx so it can be unit tested without a DOM/React
 * rendering environment (mobile/vitest.config.ts has neither configured,
 * matching this project's existing jsdom-free unit tests).
 */
import type { Surah } from "./db";

export type ReadingCardState = {
  surah: Surah | undefined;
  isContinuing: boolean;
};

/**
 * Prefers the last surah the user actually opened in the Reading screen.
 * Falls back to Al-Fatiha (surah 1) -- never to a fabricated "resume
 * position" -- when there is no reading history yet, or when a stored
 * surah number no longer matches anything in the content database.
 */
export function pickReadingCardSurah(
  surahs: Surah[],
  lastReadSurahNumber: number | null,
): ReadingCardState {
  const lastRead =
    lastReadSurahNumber != null ? surahs.find((s) => s.number === lastReadSurahNumber) : undefined;
  if (lastRead) {
    return { surah: lastRead, isContinuing: true };
  }
  return { surah: surahs.find((s) => s.number === 1), isContinuing: false };
}

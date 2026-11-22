/**
 * Phase 1 local-only persistence -- plain localStorage inside the
 * Capacitor WebView, which persists across app restarts (same WebView
 * origin every launch) without any native plugin. Deliberately local-only
 * per the approved Phase 1 decisions: Surah Favorites get no cross-device
 * sync yet, and no progress-sync table is written here at all.
 *
 * Sprint 2 adds ayah bookmarks, exact reading position, and reader
 * preferences on the same mechanism -- still plain localStorage, still
 * fully offline, still no cross-device sync.
 */
import type { Locale } from "./i18n";

const KEYS = {
  favorites: "qr.favorites.surahs",
  locale: "qr.settings.locale",
  theme: "qr.settings.theme",
  textSize: "qr.settings.textSize",
  // Pre-Sprint-2 key, surah-only. Superseded by `readingPosition` below but
  // kept readable (never written again) so an upgrading install doesn't
  // lose its existing "Continue Reading" signal -- see getLastReadSurah.
  lastReadSurah: "qr.reading.lastSurah",
  readingPosition: "qr.reading.position",
  ayahBookmarks: "qr.bookmarks.ayahs",
  readerTranslation: "qr.reader.translation",
  readerFontSizeIndex: "qr.reader.fontSizeIndex",
  reduceMotion: "qr.settings.reduceMotion",
  startScreen: "qr.settings.startScreen",
  onboardingDone: "qr.onboarding.done",
} as const;

export type ThemePreference = "light" | "dark" | "system";
export type TextSize = "small" | "medium" | "large";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private-browsing-style storage restrictions aren't expected inside a
    // Capacitor WebView, but degrade silently rather than crash the screen.
  }
}

export function getFavoriteSurahs(): Set<number> {
  return new Set(readJson<number[]>(KEYS.favorites, []));
}

export function toggleFavoriteSurah(surahNumber: number): Set<number> {
  const current = getFavoriteSurahs();
  if (current.has(surahNumber)) {
    current.delete(surahNumber);
  } else {
    current.add(surahNumber);
  }
  writeJson(KEYS.favorites, [...current]);
  return current;
}

export function getStoredLocale(): Locale | null {
  const value = readJson<string | null>(KEYS.locale, null);
  return value === "en" || value === "fr" || value === "ar" ? value : null;
}

export function setStoredLocale(locale: Locale): void {
  writeJson(KEYS.locale, locale);
}

const VALID_THEMES: readonly ThemePreference[] = ["light", "dark", "system"];

/** "dark" (Midnight Teal, the Design Lock v1.0 identity) is the default for a
 * brand-new install (QR-DESIGN-002; previously "light", Sprint 4) and for
 * any stored value that isn't one of the three valid preferences (a
 * missing key, corrupted JSON, or a foreign/legacy value all collapse to
 * the same "no valid saved preference" case) -- never "system", so a new
 * user's first screen is never silently decided by their OS appearance
 * setting. An install that already has a valid "light", "dark" or "system"
 * choice saved keeps it exactly as-is: only the nothing-valid-to-read-back
 * case changed. Stored values keep their old names; the UI labels them
 * Ivory Light (light), Midnight (dark) and Match device (system). */
export function getStoredTheme(): ThemePreference {
  const value = readJson<string | null>(KEYS.theme, null);
  return (VALID_THEMES as readonly string[]).includes(value as string)
    ? (value as ThemePreference)
    : "dark";
}

export function setStoredTheme(theme: ThemePreference): void {
  writeJson(KEYS.theme, theme);
}

const THEME_ORDER: ThemePreference[] = ["system", "light", "dark"];

/** Single source of truth for the System -> Light -> Dark -> System cycle,
 * shared by Settings' theme row and the Home header's theme toggle so the
 * two controls can never drift out of sync with each other. */
export function nextThemePreference(current: ThemePreference): ThemePreference {
  return THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]!;
}

/** Same resolution App.tsx applies to the `<html class="dark">` toggle --
 * shared so any control that needs to show the *current* light/dark state
 * (e.g. a sun/moon icon) matches what's actually on screen. */
export function resolveIsDark(theme: ThemePreference, prefersDark: boolean): boolean {
  return theme === "dark" || (theme === "system" && prefersDark);
}

const VALID_TEXT_SIZES: readonly TextSize[] = ["small", "medium", "large"];

export function getStoredTextSize(): TextSize {
  const value = readJson<string | null>(KEYS.textSize, null);
  return (VALID_TEXT_SIZES as readonly string[]).includes(value as string)
    ? (value as TextSize)
    : "medium";
}

export function setStoredTextSize(size: TextSize): void {
  writeJson(KEYS.textSize, size);
}

/** Derived from the exact reading position below, which is now the single
 * source of truth for "where did the reader last read" -- falls back to
 * the pre-Sprint-2 surah-only key only when no exact position has ever
 * been recorded yet (an install upgrading from before this existed). See
 * mobile/src/home-dashboard.ts for how the Home Dashboard's Continue
 * Reading card uses this. */
export function getLastReadSurah(): number | null {
  const position = getReadingPosition();
  if (position) return position.surahNumber;
  return readJson<number | null>(KEYS.lastReadSurah, null);
}

export type ReadingPosition = {
  surahNumber: number;
  ayahNumber: number;
  updatedAt: string;
};

function isValidReadingPosition(value: unknown): value is ReadingPosition {
  const v = value as Partial<ReadingPosition> | null;
  return (
    typeof v === "object" &&
    v !== null &&
    Number.isInteger(v.surahNumber) &&
    v.surahNumber! > 0 &&
    Number.isInteger(v.ayahNumber) &&
    v.ayahNumber! > 0 &&
    typeof v.updatedAt === "string"
  );
}

/** Exact surah+ayah position, replacing the old surah-only tracking.
 * Written both immediately on opening a lesson (so "last read" reflects
 * reality even if the reader leaves before scrolling) and as the reader
 * actually scrolls (see ReadingScreen's useCurrentAyahTracking) -- always
 * through this one function, so there is never more than one writer. */
export function getReadingPosition(): ReadingPosition | null {
  const value = readJson<unknown>(KEYS.readingPosition, null);
  return isValidReadingPosition(value) ? value : null;
}

export function setReadingPosition(surahNumber: number, ayahNumber: number): void {
  const position: ReadingPosition = {
    surahNumber,
    ayahNumber,
    updatedAt: new Date().toISOString(),
  };
  writeJson(KEYS.readingPosition, position);
}

export type AyahBookmark = {
  surahNumber: number;
  ayahNumber: number;
  createdAt: string;
};

function isValidAyahBookmark(value: unknown): value is AyahBookmark {
  const v = value as Partial<AyahBookmark> | null;
  return (
    typeof v === "object" &&
    v !== null &&
    Number.isInteger(v.surahNumber) &&
    v.surahNumber! > 0 &&
    Number.isInteger(v.ayahNumber) &&
    v.ayahNumber! > 0 &&
    typeof v.createdAt === "string"
  );
}

/** Reads the bookmark list, dropping anything malformed (a corrupted
 * entry, or an old/foreign shape) rather than letting it crash the
 * Bookmarks screen or the Reader's per-ayah toggle. Also collapses any
 * duplicate surah+ayah pairs down to one entry (keeping the earliest),
 * so a bookmark list that somehow ended up with a repeated pair -- e.g.
 * hand-edited storage -- self-heals on the very next read instead of
 * showing the same verse twice. */
export function getAyahBookmarks(): AyahBookmark[] {
  const raw = readJson<unknown[]>(KEYS.ayahBookmarks, []);
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, AyahBookmark>();
  for (const entry of raw) {
    if (!isValidAyahBookmark(entry)) continue;
    const key = `${entry.surahNumber}:${entry.ayahNumber}`;
    const existing = byKey.get(key);
    if (!existing || entry.createdAt < existing.createdAt) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()];
}

export function isAyahBookmarked(surahNumber: number, ayahNumber: number): boolean {
  return getAyahBookmarks().some(
    (b) => b.surahNumber === surahNumber && b.ayahNumber === ayahNumber,
  );
}

/** Tap-to-save, tap-again-to-remove. Removal drops *every* entry matching
 * this surah+ayah pair (not just the first), so it also repairs a
 * duplicate left over from before getAyahBookmarks started deduping on
 * read. */
export function toggleAyahBookmark(surahNumber: number, ayahNumber: number): AyahBookmark[] {
  const current = getAyahBookmarks();
  const isBookmarked = current.some(
    (b) => b.surahNumber === surahNumber && b.ayahNumber === ayahNumber,
  );
  const next = isBookmarked
    ? current.filter((b) => !(b.surahNumber === surahNumber && b.ayahNumber === ayahNumber))
    : [...current, { surahNumber, ayahNumber, createdAt: new Date().toISOString() }];
  writeJson(KEYS.ayahBookmarks, next);
  return next;
}

export type ReaderTranslation = "none" | "en" | "fr";

const READER_TRANSLATIONS: readonly ReaderTranslation[] = ["none", "en", "fr"];

export function getReaderTranslation(): ReaderTranslation {
  const value = readJson<string>(KEYS.readerTranslation, "none");
  return (READER_TRANSLATIONS as readonly string[]).includes(value)
    ? (value as ReaderTranslation)
    : "none";
}

export function setReaderTranslation(value: ReaderTranslation): void {
  writeJson(KEYS.readerTranslation, value);
}

/** `maxIndex` is passed in by the caller (ReadingScreen's own FONT_SIZES
 * list) rather than duplicated here, so the two can never drift apart; an
 * out-of-range stored value (e.g. left over from a build with fewer
 * steps) falls back to `fallbackIndex` instead of rendering an invalid
 * size. */
export function getReaderFontSizeIndex(maxIndex: number, fallbackIndex: number): number {
  const value = readJson<number>(KEYS.readerFontSizeIndex, fallbackIndex);
  return Number.isInteger(value) && value >= 0 && value <= maxIndex ? value : fallbackIndex;
}

export function setReaderFontSizeIndex(index: number): void {
  writeJson(KEYS.readerFontSizeIndex, index);
}

// ---------------------------------------------------------------------------
// QR-DESIGN-002 Stage 2: reduced motion, start screen, onboarding, and
// preference export/reset. All local-only, like every other setting here.
// ---------------------------------------------------------------------------

export type StartScreen = "home" | "quran" | "continue";
export const START_SCREENS: readonly StartScreen[] = ["home", "quran", "continue"];

export function getReduceMotion(): boolean {
  return readJson<unknown>(KEYS.reduceMotion, false) === true;
}

export function setReduceMotion(value: boolean): void {
  writeJson(KEYS.reduceMotion, value);
}

export function getStartScreen(): StartScreen {
  const value = readJson<string | null>(KEYS.startScreen, null);
  return (START_SCREENS as readonly string[]).includes(value as string)
    ? (value as StartScreen)
    : "home";
}

export function setStartScreen(value: StartScreen): void {
  writeJson(KEYS.startScreen, value);
}

export function getOnboardingDone(): boolean {
  return readJson<unknown>(KEYS.onboardingDone, false) === true;
}

export function setOnboardingDone(): void {
  writeJson(KEYS.onboardingDone, true);
}

export type PreferencesExport = {
  app: "QuranRoots";
  kind: "preferences";
  version: 1;
  preferences: {
    locale: Locale | null;
    theme: ThemePreference;
    textSize: TextSize;
    reduceMotion: boolean;
    startScreen: StartScreen;
  };
};

/** Preferences only. Bookmarks, favorites and reading position are the
 * user's data, not preferences, and are deliberately not included. */
export function exportPreferences(): PreferencesExport {
  return {
    app: "QuranRoots",
    kind: "preferences",
    version: 1,
    preferences: {
      locale: getStoredLocale(),
      theme: getStoredTheme(),
      textSize: getStoredTextSize(),
      reduceMotion: getReduceMotion(),
      startScreen: getStartScreen(),
    },
  };
}

/** Restores default preferences by removing only the preference keys.
 * Bookmarks, favorites, reading position, the reader's own translation and
 * font choices, and the onboarding flag are left untouched. */
export function resetPreferences(): void {
  for (const key of [KEYS.locale, KEYS.theme, KEYS.textSize, KEYS.reduceMotion, KEYS.startScreen]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // storage unavailable: nothing to reset
    }
  }
}

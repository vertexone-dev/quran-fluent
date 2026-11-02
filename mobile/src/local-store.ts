/**
 * Phase 1 local-only persistence -- plain localStorage inside the
 * Capacitor WebView, which persists across app restarts (same WebView
 * origin every launch) without any native plugin. Deliberately local-only
 * per the approved Phase 1 decisions: Surah Favorites get no cross-device
 * sync yet, and no progress-sync table is written here at all.
 */
import type { Locale } from "./i18n";

const KEYS = {
  favorites: "qr.favorites.surahs",
  locale: "qr.settings.locale",
  theme: "qr.settings.theme",
  textSize: "qr.settings.textSize",
  lastReadSurah: "qr.reading.lastSurah",
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
  return value === "en" || value === "fr" ? value : null;
}

export function setStoredLocale(locale: Locale): void {
  writeJson(KEYS.locale, locale);
}

export function getStoredTheme(): ThemePreference {
  return readJson<ThemePreference>(KEYS.theme, "system");
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

export function getStoredTextSize(): TextSize {
  return readJson<TextSize>(KEYS.textSize, "medium");
}

export function setStoredTextSize(size: TextSize): void {
  writeJson(KEYS.textSize, size);
}

/** Surah-level only -- the Reading screen has no per-ayah scroll-position
 * tracking, so recording a specific ayah here would be fabricated, not
 * observed. See mobile/src/home-dashboard.ts for how the Home Dashboard's
 * Continue Reading card uses this. */
export function getLastReadSurah(): number | null {
  return readJson<number | null>(KEYS.lastReadSurah, null);
}

export function setLastReadSurah(surahNumber: number): void {
  writeJson(KEYS.lastReadSurah, surahNumber);
}

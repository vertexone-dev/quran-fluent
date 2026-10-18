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

export function getStoredTextSize(): TextSize {
  return readJson<TextSize>(KEYS.textSize, "medium");
}

export function setStoredTextSize(size: TextSize): void {
  writeJson(KEYS.textSize, size);
}

// QR-DESIGN-002 Stage 4: device-local display preferences for the website
// (interface text size, reduced motion, start screen) plus export/reset.
//
// Adapted from the verified v0.5.0 Emergent preferences module, but narrowed
// to what is compatible with this app: theme stays owned by lib/theme.tsx and
// the account profile, and the interface language stays owned by lib/i18n.
// Pure functions only (no React) so they can be unit-tested; the provider in
// preferences-context.tsx does the storage and DOM work.

export type TextSize = "small" | "medium" | "large";
export type StartScreen = "home" | "quran" | "learn";

export type DisplayPreferences = {
  textSize: TextSize;
  reduceMotion: boolean;
  startScreen: StartScreen;
};

export const TEXT_SIZES: readonly TextSize[] = ["small", "medium", "large"];
export const START_SCREENS: readonly StartScreen[] = ["home", "quran", "learn"];

export const DEFAULT_PREFERENCES: DisplayPreferences = {
  textSize: "medium",
  reduceMotion: false,
  startScreen: "home",
};

export const PREFERENCES_STORAGE_KEY = "quranroots-display-preferences";
export const START_SESSION_KEY = "quranroots-start-screen-applied";

/** Root font size per text size. Tailwind sizes are rem-based, so the whole
 * interface scales; Arabic Qur'an text has its own reader controls. */
export const TEXT_SCALE: Record<TextSize, string> = {
  small: "93.75%",
  medium: "100%",
  large: "112.5%",
};

/** Route opened on the first visit to "/" in a browser session. */
export const START_SCREEN_PATH: Record<StartScreen, "/" | "/quran" | "/learn"> = {
  home: "/",
  quran: "/quran",
  learn: "/learn",
};

function pick<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

/** Accepts anything (stored JSON, hand-edited data) and returns a complete,
 * valid object. Unknown or malformed fields fall back to the defaults. */
export function sanitizePreferences(raw: unknown): DisplayPreferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    textSize: pick(TEXT_SIZES, r["textSize"], DEFAULT_PREFERENCES.textSize),
    reduceMotion:
      typeof r["reduceMotion"] === "boolean" ? r["reduceMotion"] : DEFAULT_PREFERENCES.reduceMotion,
    startScreen: pick(START_SCREENS, r["startScreen"], DEFAULT_PREFERENCES.startScreen),
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readPreferences(storage: StorageLike | null): DisplayPreferences {
  if (!storage) return DEFAULT_PREFERENCES;
  try {
    const raw = storage.getItem(PREFERENCES_STORAGE_KEY);
    return raw ? sanitizePreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(storage: StorageLike | null, prefs: DisplayPreferences): void {
  try {
    storage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(sanitizePreferences(prefs)));
  } catch {
    // Storage unavailable (private mode, quota): the preference just won't persist.
  }
}

export function clearPreferences(storage: StorageLike | null): void {
  try {
    storage?.removeItem(PREFERENCES_STORAGE_KEY);
    storage?.removeItem(START_SESSION_KEY);
  } catch {
    // nothing to clear
  }
}

export type PreferencesExport = {
  app: "QuranRoots";
  kind: "preferences";
  version: 1;
  preferences: DisplayPreferences & { theme: "light" | "dark" | "system" };
};

/** Display preferences and theme only: never account data, progress,
 * bookmarks or notes. */
export function buildPreferencesExport(
  prefs: DisplayPreferences,
  theme: "light" | "dark" | "system",
): PreferencesExport {
  return {
    app: "QuranRoots",
    kind: "preferences",
    version: 1,
    preferences: { ...sanitizePreferences(prefs), theme },
  };
}

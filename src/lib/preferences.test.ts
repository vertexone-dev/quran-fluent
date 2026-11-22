import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  START_SCREEN_PATH,
  START_SESSION_KEY,
  TEXT_SCALE,
  buildPreferencesExport,
  clearPreferences,
  readPreferences,
  sanitizePreferences,
  writePreferences,
} from "./preferences";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

describe("display preferences", () => {
  it("defaults are medium text, motion on, Home", () => {
    expect(DEFAULT_PREFERENCES).toEqual({
      textSize: "medium",
      reduceMotion: false,
      startScreen: "home",
    });
  });

  it("sanitize accepts valid values and rejects everything else", () => {
    expect(
      sanitizePreferences({ textSize: "large", reduceMotion: true, startScreen: "quran" }),
    ).toEqual({ textSize: "large", reduceMotion: true, startScreen: "quran" });
    expect(
      sanitizePreferences({ textSize: "huge", reduceMotion: "yes", startScreen: "admin" }),
    ).toEqual(DEFAULT_PREFERENCES);
    for (const bad of [null, undefined, 5, "x", []]) {
      expect(sanitizePreferences(bad)).toEqual(DEFAULT_PREFERENCES);
    }
  });

  it("text scale steps are 93.75% / 100% / 112.5%", () => {
    expect(TEXT_SCALE).toEqual({ small: "93.75%", medium: "100%", large: "112.5%" });
  });

  it("start screens map only to known public routes", () => {
    expect(START_SCREEN_PATH).toEqual({ home: "/", quran: "/quran", learn: "/learn" });
  });

  it("round-trips through storage and survives corrupted JSON", () => {
    const s = memoryStorage();
    writePreferences(s, { textSize: "small", reduceMotion: true, startScreen: "learn" });
    expect(readPreferences(s)).toEqual({
      textSize: "small",
      reduceMotion: true,
      startScreen: "learn",
    });
    s.setItem(PREFERENCES_STORAGE_KEY, "{not json");
    expect(readPreferences(s)).toEqual(DEFAULT_PREFERENCES);
    expect(readPreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it("does not throw when storage itself throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(() => readPreferences(broken)).not.toThrow();
    expect(() => writePreferences(broken, DEFAULT_PREFERENCES)).not.toThrow();
    expect(() => clearPreferences(broken)).not.toThrow();
  });

  it("clear removes the preferences and the session redirect marker only", () => {
    const s = memoryStorage({
      [PREFERENCES_STORAGE_KEY]: "{}",
      [START_SESSION_KEY]: "1",
      "quranroots-theme": "light",
    });
    clearPreferences(s);
    expect(s.map.has(PREFERENCES_STORAGE_KEY)).toBe(false);
    expect(s.map.has(START_SESSION_KEY)).toBe(false);
    expect(s.map.get("quranroots-theme")).toBe("light");
  });

  it("export contains display preferences and theme, nothing about the account", () => {
    const out = buildPreferencesExport(
      { textSize: "large", reduceMotion: true, startScreen: "quran" },
      "dark",
    );
    expect(out).toEqual({
      app: "QuranRoots",
      kind: "preferences",
      version: 1,
      preferences: { textSize: "large", reduceMotion: true, startScreen: "quran", theme: "dark" },
    });
  });
});

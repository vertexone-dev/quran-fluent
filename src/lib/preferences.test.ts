import { readFileSync } from "node:fs";
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

describe("preferences never touch account or learning data (QR-DESIGN-005)", () => {
  // Keys the app and its auth/theme layers keep in the browser. A preference
  // change, an export, or a reset must leave every one of them exactly as is.
  const OTHER_DATA: Record<string, string> = {
    "sb-localhost-auth-token": '{"access_token":"t","user":{"id":"u1"}}',
    "quranroots-theme": "light",
    "quranroots-bookmarks": '[{"surah":2,"ayah":255}]',
    "quranroots-notes": '[{"id":"n1","text":"private note"}]',
    "quranroots-progress": '{"lessonsCompleted":12}',
    "quranroots-subscription": '{"plan":"free"}',
  };

  it("write, rewrite and reset leave bookmarks, notes, progress, subscription and auth untouched", () => {
    const s = memoryStorage({ ...OTHER_DATA });
    writePreferences(s, { textSize: "large", reduceMotion: true, startScreen: "quran" });
    writePreferences(s, { textSize: "small", reduceMotion: false, startScreen: "learn" });
    s.setItem(START_SESSION_KEY, "1");
    clearPreferences(s);
    expect(Object.fromEntries(s.map)).toEqual(OTHER_DATA);
  });

  it("only writes its own keys", () => {
    const s = memoryStorage({ ...OTHER_DATA });
    writePreferences(s, { textSize: "large", reduceMotion: true, startScreen: "quran" });
    const added = [...s.map.keys()].filter((k) => !(k in OTHER_DATA));
    expect(added).toEqual([PREFERENCES_STORAGE_KEY]);
  });

  it("the export is built from preferences and theme only (no storage, no account fields)", () => {
    const out = buildPreferencesExport(
      { textSize: "medium", reduceMotion: false, startScreen: "home" },
      "system",
    );
    const text = JSON.stringify(out);
    for (const secret of ["token", "email", "note", "bookmark", "progress", "subscription"]) {
      expect(text.toLowerCase()).not.toContain(secret);
    }
  });

  // Structural guard: these two modules are pure browser-storage/DOM code. If one
  // ever imports a server client, fetches, or mentions billing, preferences could
  // start reaching account data, so fail loudly and force a review.
  it.each(["preferences.ts", "preferences-context.tsx"])(
    "%s has no server, network or billing dependency",
    (file) => {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(src).not.toMatch(
        /integrations\/supabase|@supabase|\bfetch\s*\(|XMLHttpRequest|sendBeacon/,
      );
      expect(src).not.toMatch(/billing|checkout|subscription|stripe|paddle/i);
    },
  );
});

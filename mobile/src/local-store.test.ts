import { beforeEach, describe, expect, it } from "vitest";
import {
  addReflection,
  deleteReflection,
  getReflections,
  exportPreferences,
  getAyahBookmarks,
  getOnboardingDone,
  getReduceMotion,
  getStartScreen,
  getStoredTextSize,
  resetPreferences,
  setOnboardingDone,
  setReduceMotion,
  setStartScreen,
  setStoredTextSize,
  getLastReadSurah,
  getReaderFontSizeIndex,
  getReaderTranslation,
  getReadingPosition,
  getStoredTheme,
  isAyahBookmarked,
  nextThemePreference,
  resolveIsDark,
  setReaderFontSizeIndex,
  setReaderTranslation,
  setReadingPosition,
  setStoredTheme,
  toggleAyahBookmark,
} from "./local-store";

/**
 * local-store.ts reads/writes the real browser `localStorage` global
 * directly (no injected dependency -- see its own header comment on why).
 * vitest.config.ts runs this project's unit tests under plain Node, which
 * has no `localStorage`, so this is a minimal in-memory stand-in: same
 * getItem/setItem contract, nothing more. Resetting it in beforeEach keeps
 * every test's storage state isolated from the others.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage =
    new MemoryStorage() as unknown as Storage;
});

describe("ayah bookmarks", () => {
  it("adds a bookmark on the first toggle", () => {
    toggleAyahBookmark(2, 255);
    expect(isAyahBookmarked(2, 255)).toBe(true);
    const bookmarks = getAyahBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0]).toMatchObject({ surahNumber: 2, ayahNumber: 255 });
    expect(typeof bookmarks[0]!.createdAt).toBe("string");
  });

  it("removes the bookmark on the second toggle of the same ayah", () => {
    toggleAyahBookmark(2, 255);
    toggleAyahBookmark(2, 255);
    expect(isAyahBookmarked(2, 255)).toBe(false);
    expect(getAyahBookmarks()).toHaveLength(0);
  });

  it("keeps bookmarks for different ayahs independent", () => {
    toggleAyahBookmark(1, 1);
    toggleAyahBookmark(2, 255);
    expect(getAyahBookmarks()).toHaveLength(2);
    toggleAyahBookmark(1, 1);
    expect(getAyahBookmarks()).toEqual([
      { surahNumber: 2, ayahNumber: 255, createdAt: expect.any(String) },
    ]);
  });

  it("persists across separate reads, simulating an app restart", () => {
    toggleAyahBookmark(18, 10);
    // A fresh read with no cache layer in between -- local-store.ts has
    // none, unlike the web app's createTestUserClient -- so this is
    // already what "survives an app restart" looks like here.
    expect(isAyahBookmarked(18, 10)).toBe(true);
    expect(getAyahBookmarks()).toEqual([
      { surahNumber: 18, ayahNumber: 10, createdAt: expect.any(String) },
    ]);
  });

  it("recovers from totally corrupted JSON in storage instead of throwing", () => {
    localStorage.setItem("qr.bookmarks.ayahs", "{not valid json");
    expect(() => getAyahBookmarks()).not.toThrow();
    expect(getAyahBookmarks()).toEqual([]);
  });

  it("drops malformed entries but keeps valid ones alongside them", () => {
    localStorage.setItem(
      "qr.bookmarks.ayahs",
      JSON.stringify([
        { surahNumber: 2, ayahNumber: 255, createdAt: "2026-01-01T00:00:00.000Z" },
        { surahNumber: 0, ayahNumber: 5, createdAt: "2026-01-01T00:00:00.000Z" }, // invalid surah
        { surahNumber: 3, ayahNumber: -1, createdAt: "2026-01-01T00:00:00.000Z" }, // invalid ayah
        { surahNumber: 3 }, // missing fields
        "not even an object",
        null,
      ]),
    );
    expect(getAyahBookmarks()).toEqual([
      { surahNumber: 2, ayahNumber: 255, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("collapses a duplicate surah+ayah pair left over in storage down to one entry (duplicate prevention)", () => {
    localStorage.setItem(
      "qr.bookmarks.ayahs",
      JSON.stringify([
        { surahNumber: 2, ayahNumber: 255, createdAt: "2026-01-02T00:00:00.000Z" },
        { surahNumber: 2, ayahNumber: 255, createdAt: "2026-01-01T00:00:00.000Z" },
      ]),
    );
    const bookmarks = getAyahBookmarks();
    expect(bookmarks).toHaveLength(1);
    // Keeps the earliest createdAt of the duplicate pair.
    expect(bookmarks[0]!.createdAt).toBe("2026-01-01T00:00:00.000Z");

    // And removing it clears every matching entry, not just one.
    toggleAyahBookmark(2, 255);
    expect(getAyahBookmarks()).toEqual([]);
  });
});

describe("exact reading position", () => {
  it("persists the exact surah+ayah and reports it back", () => {
    setReadingPosition(18, 42);
    const position = getReadingPosition();
    expect(position?.surahNumber).toBe(18);
    expect(position?.ayahNumber).toBe(42);
    expect(typeof position?.updatedAt).toBe("string");
  });

  it("derives getLastReadSurah from the exact position", () => {
    setReadingPosition(18, 42);
    expect(getLastReadSurah()).toBe(18);
  });

  it("falls back to the pre-Sprint-2 surah-only key when no exact position has ever been recorded", () => {
    localStorage.setItem("qr.reading.lastSurah", "7");
    expect(getReadingPosition()).toBeNull();
    expect(getLastReadSurah()).toBe(7);
  });

  it("rejects an invalid stored position (zero/negative ayah) instead of handing back nonsense", () => {
    localStorage.setItem(
      "qr.reading.position",
      JSON.stringify({ surahNumber: 1, ayahNumber: 0, updatedAt: "t" }),
    );
    expect(getReadingPosition()).toBeNull();
  });

  it("recovers from corrupted JSON in the position key", () => {
    localStorage.setItem("qr.reading.position", "{broken");
    expect(() => getReadingPosition()).not.toThrow();
    expect(getReadingPosition()).toBeNull();
  });
});

describe("theme preference", () => {
  it("defaults to dark (Midnight) for a brand-new install with nothing saved yet (QR-DESIGN-002)", () => {
    expect(getStoredTheme()).toBe("dark");
  });

  it("defaults to dark, not system, when the stored value is corrupted JSON", () => {
    localStorage.setItem("qr.settings.theme", "{not valid json");
    expect(getStoredTheme()).toBe("dark");
  });

  it("defaults to dark, not system, when the stored value isn't a recognized theme", () => {
    localStorage.setItem("qr.settings.theme", JSON.stringify("blue"));
    expect(getStoredTheme()).toBe("dark");
  });

  it("preserves an existing saved 'dark' preference across reads, simulating an app restart", () => {
    setStoredTheme("dark");
    expect(getStoredTheme()).toBe("dark");
  });

  it("preserves an existing saved 'system' preference across reads, simulating an app restart", () => {
    setStoredTheme("system");
    expect(getStoredTheme()).toBe("system");
  });

  it("preserves an explicitly saved 'light' preference the same way (not just as the fallback)", () => {
    setStoredTheme("light");
    expect(getStoredTheme()).toBe("light");
  });

  it("cycles System -> Light -> Dark -> System, the order the Settings and Home toggles share", () => {
    expect(nextThemePreference("system")).toBe("light");
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
  });

  it("resolves whether dark mode is actually active for each preference", () => {
    expect(resolveIsDark("light", true)).toBe(false);
    expect(resolveIsDark("light", false)).toBe(false);
    expect(resolveIsDark("dark", true)).toBe(true);
    expect(resolveIsDark("dark", false)).toBe(true);
    expect(resolveIsDark("system", true)).toBe(true);
    expect(resolveIsDark("system", false)).toBe(false);
  });
});

describe("reader preferences", () => {
  it("persists the translation mode", () => {
    setReaderTranslation("fr");
    expect(getReaderTranslation()).toBe("fr");
  });

  it("falls back to 'none' for a missing or invalid stored translation", () => {
    expect(getReaderTranslation()).toBe("none");
    localStorage.setItem("qr.reader.translation", JSON.stringify("de"));
    expect(getReaderTranslation()).toBe("none");
  });

  it("persists the font-size index", () => {
    setReaderFontSizeIndex(3);
    expect(getReaderFontSizeIndex(4, 1)).toBe(3);
  });

  it("falls back to the given default when the stored index is out of range", () => {
    localStorage.setItem("qr.reader.fontSizeIndex", JSON.stringify(99));
    expect(getReaderFontSizeIndex(4, 1)).toBe(1);
  });
});

describe("QR-DESIGN-002 preferences", () => {
  it("has safe defaults on a fresh install", () => {
    expect(getReduceMotion()).toBe(false);
    expect(getStartScreen()).toBe("home");
    expect(getStoredTextSize()).toBe("medium");
    expect(getOnboardingDone()).toBe(false);
  });

  it("round-trips reduce motion, start screen, text size and onboarding", () => {
    setReduceMotion(true);
    setStartScreen("continue");
    setStoredTextSize("large");
    setOnboardingDone();
    expect(getReduceMotion()).toBe(true);
    expect(getStartScreen()).toBe("continue");
    expect(getStoredTextSize()).toBe("large");
    expect(getOnboardingDone()).toBe(true);
  });

  it("falls back to defaults for hand-edited or corrupted values", () => {
    localStorage.setItem("qr.settings.startScreen", JSON.stringify("memorize"));
    localStorage.setItem("qr.settings.textSize", JSON.stringify("huge"));
    localStorage.setItem("qr.settings.reduceMotion", JSON.stringify("yes"));
    expect(getStartScreen()).toBe("home");
    expect(getStoredTextSize()).toBe("medium");
    expect(getReduceMotion()).toBe(false);
  });

  it("exports preferences only, never bookmarks or reading position", () => {
    setStoredTheme("light");
    toggleAyahBookmark(2, 255);
    setReadingPosition(2, 255);
    const out = exportPreferences();
    expect(out).toMatchObject({ app: "QuranRoots", kind: "preferences", version: 1 });
    expect(out.preferences.theme).toBe("light");
    expect(JSON.stringify(out)).not.toContain("255");
  });

  it("reset restores defaults but keeps bookmarks, reading position and onboarding", () => {
    setStoredTheme("light");
    setReduceMotion(true);
    setStartScreen("quran");
    setStoredTextSize("small");
    setOnboardingDone();
    toggleAyahBookmark(1, 3);
    setReadingPosition(2, 10);
    resetPreferences();
    expect(getStoredTheme()).toBe("dark");
    expect(getReduceMotion()).toBe(false);
    expect(getStartScreen()).toBe("home");
    expect(getStoredTextSize()).toBe("medium");
    expect(isAyahBookmarked(1, 3)).toBe(true);
    expect(getReadingPosition()).toMatchObject({ surahNumber: 2, ayahNumber: 10 });
    expect(getOnboardingDone()).toBe(true);
  });
});

describe("reflections (private, local-only)", () => {
  it("starts empty and never invents entries", () => {
    expect(getReflections()).toEqual([]);
  });

  it("saves trimmed text, newest first, with the ayah reference", () => {
    const first = addReflection(1, 1, "  one  ", () => new Date("2026-01-01T00:00:00Z"));
    const second = addReflection(2, 255, "two", () => new Date("2026-01-02T00:00:00Z"));
    expect(first?.text).toBe("one");
    expect(getReflections().map((r) => [r.surahNumber, r.ayahNumber, r.text])).toEqual([
      [2, 255, "two"],
      [1, 1, "one"],
    ]);
    expect(second?.createdAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("rejects empty or whitespace-only text", () => {
    expect(addReflection(1, 1, "   ")).toBeNull();
    expect(getReflections()).toEqual([]);
  });

  it("caps very long text", () => {
    const saved = addReflection(1, 1, "x".repeat(5000));
    expect(saved?.text.length).toBe(2000);
  });

  it("deletes one entry by id and leaves the others", () => {
    const a = addReflection(1, 1, "a", () => new Date("2026-01-01T00:00:00Z"))!;
    addReflection(1, 2, "b", () => new Date("2026-01-02T00:00:00Z"));
    deleteReflection(a.id);
    expect(getReflections().map((r) => r.text)).toEqual(["b"]);
  });

  it("ignores malformed stored entries instead of throwing", () => {
    localStorage.setItem(
      "qr.reflections",
      JSON.stringify([
        { id: 1 },
        null,
        "x",
        { id: "k", surahNumber: 1, ayahNumber: 1, text: "ok", createdAt: "2026-01-01" },
      ]),
    );
    expect(() => getReflections()).not.toThrow();
    expect(getReflections().map((r) => r.text)).toEqual(["ok"]);
    localStorage.setItem("qr.reflections", "{not json");
    expect(getReflections()).toEqual([]);
  });

  it("is not part of the preferences export and is untouched by reset", () => {
    addReflection(1, 1, "private words");
    expect(JSON.stringify(exportPreferences())).not.toContain("private words");
    resetPreferences();
    expect(getReflections()).toHaveLength(1);
  });
});

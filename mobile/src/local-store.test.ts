import { beforeEach, describe, expect, it } from "vitest";
import {
  getAyahBookmarks,
  getLastReadSurah,
  getReaderFontSizeIndex,
  getReaderTranslation,
  getReadingPosition,
  isAyahBookmarked,
  setReaderFontSizeIndex,
  setReaderTranslation,
  setReadingPosition,
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

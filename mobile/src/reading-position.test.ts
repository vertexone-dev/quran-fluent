import { describe, expect, it } from "vitest";
import { resolveResumeAyah, type ReadingPosition } from "./reading-position";

describe("resolveResumeAyah", () => {
  it("resumes at the saved ayah when no explicit target is given and the saved position belongs to this surah (Continue Reading / reopening the same surah)", () => {
    const saved: ReadingPosition = { surahNumber: 2, ayahNumber: 48, updatedAt: "t" };
    expect(resolveResumeAyah(2, 286, undefined, saved)).toBe(48);
  });

  it("does not apply a saved position from a different surah when opening a surah intentionally from the list", () => {
    const saved: ReadingPosition = { surahNumber: 2, ayahNumber: 48, updatedAt: "t" };
    expect(resolveResumeAyah(5, 120, undefined, saved)).toBeNull();
  });

  it("starts at the top when there is no saved position at all", () => {
    expect(resolveResumeAyah(1, 7, undefined, null)).toBeNull();
  });

  it("an explicit target ayah (opening a bookmark) always wins over a saved position for a different surah", () => {
    const saved: ReadingPosition = { surahNumber: 2, ayahNumber: 48, updatedAt: "t" };
    expect(resolveResumeAyah(5, 120, 30, saved)).toBe(30);
  });

  it("an explicit target ayah wins even when a saved position for the same surah also exists", () => {
    const saved: ReadingPosition = { surahNumber: 2, ayahNumber: 48, updatedAt: "t" };
    expect(resolveResumeAyah(2, 286, 10, saved)).toBe(10);
  });

  it("rejects an out-of-range explicit target ayah rather than scrolling to a nonexistent verse", () => {
    expect(resolveResumeAyah(1, 7, 999, null)).toBeNull();
    expect(resolveResumeAyah(1, 7, 0, null)).toBeNull();
    expect(resolveResumeAyah(1, 7, -1, null)).toBeNull();
  });

  it("rejects an out-of-range saved ayah (e.g. the surah's ayah count changed) rather than scrolling to a nonexistent verse", () => {
    const saved: ReadingPosition = { surahNumber: 1, ayahNumber: 999, updatedAt: "t" };
    expect(resolveResumeAyah(1, 7, undefined, saved)).toBeNull();
  });

  it("validates against the actual surah's own ayah count, not a single global maximum shared by every surah", () => {
    // Ayah 50 is out of range for Al-Fatiha (7 ayahs) but perfectly valid
    // for Al-Baqara (286 ayahs) -- the same number, two different
    // verdicts, which only holds if the check uses the real per-surah
    // count passed in by the caller rather than one fixed ceiling (e.g.
    // 286, the Qur'an's longest surah) applied to every surah alike.
    const savedAyah50: ReadingPosition = { surahNumber: 1, ayahNumber: 50, updatedAt: "t" };
    expect(resolveResumeAyah(1, 7, undefined, savedAyah50)).toBeNull();
    const savedAyah50ForBaqara: ReadingPosition = {
      surahNumber: 2,
      ayahNumber: 50,
      updatedAt: "t",
    };
    expect(resolveResumeAyah(2, 286, undefined, savedAyah50ForBaqara)).toBe(50);
  });
});

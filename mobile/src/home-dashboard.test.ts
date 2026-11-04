import { describe, expect, it } from "vitest";
import { pickReadingCardSurah } from "./home-dashboard";
import type { Surah } from "./db";

const surahs: Surah[] = [
  {
    number: 1,
    name_en: "Al-Fatiha",
    name_ar: "الفاتحة",
    name_fr: null,
    ayah_count: 7,
    revelation_type: "Meccan",
  },
  {
    number: 2,
    name_en: "Al-Baqarah",
    name_ar: "البقرة",
    name_fr: null,
    ayah_count: 286,
    revelation_type: "Medinan",
  },
];

describe("pickReadingCardSurah", () => {
  it("returns the last-read surah and marks it as continuing when it exists", () => {
    expect(pickReadingCardSurah(surahs, 2)).toEqual({ surah: surahs[1], isContinuing: true });
  });

  it("falls back to Al-Fatiha and marks it as not continuing when there is no reading history", () => {
    expect(pickReadingCardSurah(surahs, null)).toEqual({
      surah: surahs[0],
      isContinuing: false,
    });
  });

  it("falls back to Al-Fatiha when the stored surah number no longer matches the content DB", () => {
    expect(pickReadingCardSurah(surahs, 999)).toEqual({
      surah: surahs[0],
      isContinuing: false,
    });
  });
});

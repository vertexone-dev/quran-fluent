import { describe, expect, it } from "vitest";

import { formatPlural, isPluralTemplate } from "@/lib/plural";
import { foldArabicForSearch, surahName } from "@/lib/quran";

const AYAT = "one:آية واحدة|two:آيتان|few:{count} آيات|many:{count} آية|other:{count} آية";

describe("formatPlural", () => {
  it("leaves ordinary templates untouched apart from {count}", () => {
    expect(isPluralTemplate("{count} min")).toBe(false);
    expect(formatPlural("{count} min", 7, "en")).toBe("7 min");
    expect(formatPlural("{count} versets", 1, "fr")).toBe("1 versets");
  });

  it("selects Arabic singular, dual, few, many and other forms", () => {
    expect(isPluralTemplate(AYAT)).toBe(true);
    expect(formatPlural(AYAT, 1, "ar")).toBe("آية واحدة");
    expect(formatPlural(AYAT, 2, "ar")).toBe("آيتان");
    expect(formatPlural(AYAT, 3, "ar")).toBe("3 آيات");
    expect(formatPlural(AYAT, 10, "ar")).toBe("10 آيات");
    expect(formatPlural(AYAT, 11, "ar")).toBe("11 آية");
    expect(formatPlural(AYAT, 99, "ar")).toBe("99 آية");
    expect(formatPlural(AYAT, 100, "ar")).toBe("100 آية");
  });

  it("falls back to `other` for a category that is not listed (zero)", () => {
    expect(formatPlural(AYAT, 0, "ar")).toBe("0 آية");
  });
});

describe("surahName (Arabic)", () => {
  const fatiha = {
    name_en: "The Opener",
    name_fr: null,
    transliteration: "Al-Faatiha",
    name_ar: "الفاتحة",
  };
  it("returns the stored canonical Arabic name for ar only", () => {
    expect(surahName(fatiha, "ar")).toBe("الفاتحة");
    expect(surahName(fatiha, "en")).toBe("The Opener");
    expect(surahName(fatiha, "fr")).toBe("Al-Faatiha");
  });
  it("falls back to English when no Arabic name is available", () => {
    expect(surahName({ ...fatiha, name_ar: "" }, "ar")).toBe("The Opener");
    expect(surahName({ name_en: "X", name_fr: null, transliteration: null }, "ar")).toBe("X");
  });
});

describe("foldArabicForSearch", () => {
  it("lets a plain query match a stored diacritised name", () => {
    expect(foldArabicForSearch("سُورَةُ ٱلْفَاتِحَةِ")).toContain(foldArabicForSearch("الفاتحة"));
    expect(foldArabicForSearch("سُورَةُ الإِخۡلَاصِ")).toContain(foldArabicForSearch("الاخلاص"));
  });
});

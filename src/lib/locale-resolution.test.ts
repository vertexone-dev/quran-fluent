import { describe, expect, test } from "vitest";

import { isRtlLocale, resolveLessonLocale, resolveTranslation } from "./locale-resolution";

describe("resolveTranslation", () => {
  test("returns the row matching the requested locale when present", () => {
    const rows = [
      { locale: "en", title: "Hello" },
      { locale: "fr", title: "Bonjour" },
    ];
    expect(resolveTranslation(rows, "fr")?.title).toBe("Bonjour");
  });

  test("falls back to English when the requested locale is missing", () => {
    const rows = [{ locale: "en", title: "Hello" }];
    expect(resolveTranslation(rows, "fr")?.title).toBe("Hello");
  });

  test("returns null when neither the requested locale nor English exists", () => {
    const rows = [{ locale: "ar", title: "مرحبا" }];
    expect(resolveTranslation(rows, "fr")).toBeNull();
  });

  test("returns null for an empty or missing row set", () => {
    expect(resolveTranslation([], "en")).toBeNull();
    expect(resolveTranslation(undefined, "en")).toBeNull();
    expect(resolveTranslation(null, "en")).toBeNull();
  });

  test("scales to a fifth locale with no code change -- just more rows", () => {
    const rows = [
      { locale: "en", title: "Hello" },
      { locale: "fr", title: "Bonjour" },
      { locale: "ar", title: "مرحبا" },
      { locale: "ur", title: "ہیلو" },
      { locale: "id", title: "Halo" },
    ];
    expect(resolveTranslation(rows, "ur")?.title).toBe("ہیلو");
  });
});

describe("resolveLessonLocale (whole-lesson fallback contract)", () => {
  const oneSection = ["section-1"];
  const oneExercise = ["exercise-1"];

  test("English is always considered complete, regardless of coverage maps", () => {
    const result = resolveLessonLocale("en", false, oneSection, new Map(), oneExercise, new Map());
    expect(result).toBe("en");
  });

  test("uses the requested locale when the lesson, every section, and every exercise all have it", () => {
    const result = resolveLessonLocale(
      "fr",
      true,
      oneSection,
      new Map([["section-1", new Set(["fr"])]]),
      oneExercise,
      new Map([["exercise-1", new Set(["fr"])]]),
    );
    expect(result).toBe("fr");
  });

  test("falls back to English for the WHOLE lesson if the lesson's own title is missing the locale", () => {
    const result = resolveLessonLocale(
      "fr",
      false,
      oneSection,
      new Map([["section-1", new Set(["fr"])]]),
      oneExercise,
      new Map([["exercise-1", new Set(["fr"])]]),
    );
    expect(result).toBe("en");
  });

  test("falls back to English for the WHOLE lesson if even one section is missing the locale -- never a per-section mix", () => {
    const sectionIds = ["section-1", "section-2"];
    const sectionLocales = new Map([
      ["section-1", new Set(["fr"])],
      ["section-2", new Set(["en"])], // missing fr
    ]);
    const result = resolveLessonLocale(
      "fr",
      true,
      sectionIds,
      sectionLocales,
      oneExercise,
      new Map([["exercise-1", new Set(["fr"])]]),
    );
    expect(result).toBe("en");
  });

  test("falls back to English for the WHOLE lesson if even one exercise is missing the locale", () => {
    const exerciseIds = ["exercise-1", "exercise-2"];
    const exerciseLocales = new Map([
      ["exercise-1", new Set(["fr"])],
      ["exercise-2", new Set(["en"])], // missing fr
    ]);
    const result = resolveLessonLocale(
      "fr",
      true,
      oneSection,
      new Map([["section-1", new Set(["fr"])]]),
      exerciseIds,
      exerciseLocales,
    );
    expect(result).toBe("en");
  });

  test("a lesson with zero sections/exercises is trivially complete for any locale the lesson title has", () => {
    const result = resolveLessonLocale("fr", true, [], new Map(), [], new Map());
    expect(result).toBe("fr");
  });
});

describe("isRtlLocale (direction resolver)", () => {
  test("ar and ur are RTL", () => {
    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("ur")).toBe(true);
  });

  test("en, fr and id are LTR", () => {
    expect(isRtlLocale("en")).toBe(false);
    expect(isRtlLocale("fr")).toBe(false);
    expect(isRtlLocale("id")).toBe(false);
  });

  test("an unrecognized locale defaults to LTR, never throws", () => {
    expect(isRtlLocale("xx")).toBe(false);
  });
});

import { describe, expect, test } from "vitest";

import { WEAK_AREA_LABEL_KEYS } from "./study";
import { dashboard as dashboardEn } from "@/locales/en/dashboard";
import { dashboard as dashboardFr } from "@/locales/fr/dashboard";

// WEAK_AREA_LABEL_KEYS maps every raw weak_areas.area value written by
// SECTION_WEAK_AREAS (private to study.ts) to a key under
// dashboard.weakAreas in the locale dictionaries -- this is the
// presentation-only layer the dashboard uses instead of showing the raw
// stored English string. Structural test: every key it produces must
// actually exist, translated, in both locale dictionaries; nothing here
// touches a stored row.
describe("WEAK_AREA_LABEL_KEYS", () => {
  test("covers the exact 7 raw area strings SECTION_WEAK_AREAS can write", () => {
    expect(Object.keys(WEAK_AREA_LABEL_KEYS).sort()).toEqual(
      [
        "Letter recognition",
        "Letter forms",
        "Harakat",
        "Reading words",
        "Qur'anic vocabulary",
        "Ayah comprehension",
        "Grammar foundations",
      ].sort(),
    );
  });

  test("every mapped key resolves to a non-empty label in both dashboard dictionaries", () => {
    for (const key of Object.values(WEAK_AREA_LABEL_KEYS)) {
      const enLabel = (dashboardEn.weakAreas as Record<string, string>)[key];
      const frLabel = (dashboardFr.weakAreas as Record<string, string>)[key];
      expect(enLabel, `dashboardEn.weakAreas.${key}`).toBeTruthy();
      expect(frLabel, `dashboardFr.weakAreas.${key}`).toBeTruthy();
    }
  });

  test("the English 'Letter forms' raw value maps to a genuinely different French label", () => {
    const key = WEAK_AREA_LABEL_KEYS["Letter forms"]!;
    const frLabel = (dashboardFr.weakAreas as Record<string, string>)[key];
    expect(frLabel).toBe("Formes des lettres");
    expect(frLabel).not.toBe("Letter forms");
  });
});

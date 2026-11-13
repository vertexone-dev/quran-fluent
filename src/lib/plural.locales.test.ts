import { describe, expect, it } from "vitest";

import { dictionaries } from "@/locales";
import { formatPlural, isPluralTemplate } from "@/lib/plural";

// QR-WEB-015E: regression coverage for the real FR/AR count strings, so a
// future edit can't quietly bring back "1 jours" or a unit-less Arabic count.
// Wording here is a PROPOSAL from the engineering side, not native-speaker
// approved; see the PR notes.
const fr = dictionaries.fr;
const ar = dictionaries.ar;

describe("French count strings (singular for 0 and 1)", () => {
  const cases: [string, string, string][] = [
    [fr.dashboard.streak, "Série de 1 jour", "Série de 5 jours"],
    [fr.dashboard.minutesADay, "1 minute par jour", "10 minutes par jour"],
    [fr.dashboard.reviewsDue, "1 révision en attente", "3 révisions en attente"],
    [fr.dashboard.memorizationCard.memorizedCount, "1 verset mémorisé", "7 versets mémorisés"],
    [fr.memorization.overview.dueCount, "1 verset à réviser", "4 versets à réviser"],
    [fr.memorization.overview.memorizedCount, "1 verset mémorisé", "12 versets mémorisés"],
    [fr.learning.onboarding.minutesPerDay, "1 minute par jour", "15 minutes par jour"],
    [fr.learning.plan.minutes, "1 minute", "20 minutes"],
    [fr.learning.practice.today.topicsCount, "1 sujet", "2 sujets"],
    [fr.learning.practice.today.ayatCount, "1 verset", "9 versets"],
    [fr.bookmarks.count, "1 enregistré", "6 enregistrés"],
  ];
  it.each(cases)("%s", (tpl, one, many) => {
    expect(isPluralTemplate(tpl)).toBe(true);
    const singular = formatPlural(tpl, 1, "fr");
    expect(singular).toBe(one);
    expect(formatPlural(tpl, 0, "fr")).toBe(one.replace(/^(\D*)1/, "$10"));
    expect(formatPlural(tpl, Number(many.match(/\d+/)![0]), "fr")).toBe(many);
  });

  it("lesson progress agrees with the completed count and fills {total}", () => {
    const tpl = fr.learning.daily.lessonProgress;
    const vars = (completed: number) => ({ completed, total: 10 });
    expect(formatPlural(tpl, 0, "fr", vars(0))).toBe("0 leçon terminée sur 10");
    expect(formatPlural(tpl, 1, "fr", vars(1))).toBe("1 leçon terminée sur 10");
    expect(formatPlural(tpl, 3, "fr", vars(3))).toBe("3 leçons terminées sur 10");
  });
});

describe("Arabic count strings (singular, dual, few, many)", () => {
  const forms = (tpl: string) => [1, 2, 3, 11, 100].map((n) => formatPlural(tpl, n, "ar"));
  it("practice due count", () => {
    expect(forms(ar.learning.practice.today.dueCount)).toEqual([
      "مراجعة واحدة مستحقة",
      "مراجعتان مستحقتان",
      "3 مراجعات مستحقة",
      "11 مراجعة مستحقة",
      "100 مراجعة مستحقة",
    ]);
  });
  it("dashboard memorization due count", () => {
    expect(forms(ar.dashboard.memorizationCard.dueCount)).toEqual([
      "آية واحدة مستحقة للمراجعة",
      "آيتان مستحقتان للمراجعة",
      "3 آيات مستحقة للمراجعة",
      "11 آية مستحقة للمراجعة",
      "100 آية مستحقة للمراجعة",
    ]);
  });
  it("longest streak now carries its unit", () => {
    expect(forms(ar.dashboard.longest)).toEqual([
      "الأطول: يوم واحد",
      "الأطول: يومان",
      "الأطول: 3 أيام",
      "الأطول: 11 يومًا",
      "الأطول: 100 يوم",
    ]);
  });
  it("lesson progress is unchanged (no plural needed) and still fills both values", () => {
    expect(
      formatPlural(ar.learning.daily.lessonProgress, 3, "ar", { completed: 3, total: 10 }),
    ).toBe("الدروس المكتملة: 3 من 10");
  });
});

import { describe, expect, test } from "vitest";

import { reflect as ar } from "./ar/reflect";
import { reflect as en } from "./en/reflect";
import { reflect as fr } from "./fr/reflect";
import { REFLECTION_PROMPTS_REVIEW } from "./reflect-review";

// A COARSE guard, not a review. It cannot judge whether a prompt is theologically
// sound; it only keeps prompts in the agreed shape: a question, the same set in
// every language, no ruling-style wording, and no Qur'anic text mixed into a
// prompt. Human review is tracked in reflect-review.ts and
// docs/REFLECT-PROMPTS-REVIEW.md.

const LOCALES = { en, fr, ar } as const;
const RULING_WORDS: Record<string, RegExp> = {
  en: /\b(must|forbidden|prohibited|obligatory|haram|halal|sinful|permissible|ruling|fatwa|should not|have to)\b/i,
  fr: /\b(doit|devez|interdit|obligatoire|haram|halal|péché|permis|fatwa)\b/i,
  ar: /(يجب|يحرم|حرام|حلال|فرض|واجب|فتوى|يُحظر)/,
};
const ARABIC_LETTERS = /[؀-ۿ]/;

describe("Reflect prompts", () => {
  test("every language has the same number of prompts, plus the default question", () => {
    expect(en.prompts.length).toBeGreaterThanOrEqual(6);
    expect(fr.prompts.length).toBe(en.prompts.length);
    expect(ar.prompts.length).toBe(en.prompts.length);
  });

  test("the reader can reflect on what they learned and how they may apply it", () => {
    expect(en.prompts[0]?.label).toBe("What I learned");
    expect(en.prompts[1]?.label).toBe("How I may apply it");
  });

  for (const [code, dict] of Object.entries(LOCALES)) {
    test(`${code}: each prompt is a non-empty question with a unique label`, () => {
      const labels = new Set<string>();
      for (const p of [{ label: "default", question: dict.defaultQuestion }, ...dict.prompts]) {
        expect(p.question.trim().length, `${code} ${p.label}`).toBeGreaterThan(10);
        expect(/[?؟]\s*$/.test(p.question), `${code} "${p.question}" is not a question`).toBe(true);
        labels.add(p.label);
      }
      expect(labels.size).toBe(dict.prompts.length + 1);
    });

    test(`${code}: no ruling-style wording in any prompt or note`, () => {
      const texts = [
        dict.defaultQuestion,
        dict.promptsNote,
        ...dict.prompts.map((p) => p.question),
      ];
      for (const t of texts) expect(RULING_WORDS[code]!.test(t), `${code}: ${t}`).toBe(false);
    });
  }

  test("English and French prompts contain no Arabic text, so a prompt is never mistaken for an ayah", () => {
    for (const dict of [en, fr]) {
      for (const p of dict.prompts) expect(ARABIC_LETTERS.test(p.question + p.label)).toBe(false);
    }
  });

  test("the Qur'an is labelled apart from the prompt in every language", () => {
    for (const dict of Object.values(LOCALES)) {
      expect(dict.ayahSectionLabel.length).toBeGreaterThan(0);
      expect(dict.promptEyebrow).not.toBe(dict.ayahSectionLabel);
      expect(dict.privacyNote.length).toBeGreaterThan(0);
    }
  });

  test("the prompts are marked unreviewed until a named reviewer is recorded", () => {
    const r = REFLECTION_PROMPTS_REVIEW;
    if (r.status === "reviewed") {
      expect(r.reviewers.length).toBeGreaterThan(0);
      for (const x of r.reviewers) expect(x.name && x.scope && x.date).toBeTruthy();
    } else {
      expect(r.status).toBe("unreviewed");
      expect(r.required.length).toBeGreaterThan(0);
    }
  });
});

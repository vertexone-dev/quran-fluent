import { describe, expect, test } from "vitest";

import { computeRing, formatPercent } from "./memorization-progress";

describe("computeRing", () => {
  test("no records: an empty ring, never any invented progress", () => {
    const r = computeRing({ total: 286, memorized: 0, learning: 0, due: 0 });
    expect(r.empty).toBe(true);
    expect(r.memorizedFraction).toBe(0);
    expect(r.startedFraction).toBe(0);
    expect(r.remaining).toBe(286);
  });

  test("memorized, learning and remaining add up to the Surah's real ayah count", () => {
    const r = computeRing({ total: 286, memorized: 40, learning: 10, due: 3 });
    expect(r.memorized + r.learning + r.remaining).toBe(286);
    expect(r.empty).toBe(false);
  });

  test("learning ayahs are not counted as memorized", () => {
    const r = computeRing({ total: 100, memorized: 20, learning: 30, due: 0 });
    expect(r.memorizedFraction).toBeCloseTo(0.2);
    expect(r.startedFraction).toBeCloseTo(0.5);
  });

  test("revision due is a count that overlaps the other states, not a share of the ring", () => {
    const withDue = computeRing({ total: 100, memorized: 20, learning: 30, due: 15 });
    const without = computeRing({ total: 100, memorized: 20, learning: 30, due: 0 });
    expect(withDue.due).toBe(15);
    expect(withDue.remaining).toBe(without.remaining);
    expect(withDue.memorizedFraction).toBe(without.memorizedFraction);
  });

  test("bad data is clamped: never above 100%, never negative, never NaN", () => {
    const over = computeRing({ total: 7, memorized: 9, learning: 4, due: 99 });
    expect(over.memorized).toBe(7);
    expect(over.learning).toBe(0);
    expect(over.due).toBe(7);
    expect(over.memorizedFraction).toBe(1);
    const neg = computeRing({ total: 7, memorized: -3, learning: Number.NaN, due: -1 });
    expect(neg).toMatchObject({ memorized: 0, learning: 0, due: 0, empty: true });
    const none = computeRing({ total: 0, memorized: 5, learning: 5, due: 5 });
    expect(none.memorizedFraction).toBe(0);
    expect(Number.isNaN(none.startedFraction)).toBe(false);
  });

  test("fractional counts are floored, not rounded up", () => {
    expect(computeRing({ total: 10, memorized: 2.9, learning: 0, due: 0 }).memorized).toBe(2);
  });
});

describe("formatPercent", () => {
  test("zero, tiny, ordinary and full values", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1 / 6236)).toBe("<1%");
    expect(formatPercent(0.425)).toBe("42%");
    expect(formatPercent(0.999)).toBe("99%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(1.2)).toBe("100%");
    expect(formatPercent(-0.5)).toBe("0%");
  });

  test("never shows 100% unless every ayah is memorized", () => {
    const r = computeRing({ total: 286, memorized: 285, learning: 1, due: 0 });
    expect(formatPercent(r.memorizedFraction)).not.toBe("100%");
  });
});

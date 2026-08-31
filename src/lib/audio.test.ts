import { describe, expect, test } from "vitest";

import { DEFAULT_RECITER, RECITER_IDS, resolvePreferredReciter } from "./audio";

describe("resolvePreferredReciter", () => {
  test("accepts each of the 3 supported reciter keys", () => {
    for (const key of Object.keys(RECITER_IDS)) {
      expect(resolvePreferredReciter(key)).toBe(key);
    }
  });

  test("falls back to the default reciter for a missing preference", () => {
    expect(resolvePreferredReciter(undefined)).toBe(DEFAULT_RECITER);
    expect(resolvePreferredReciter(null)).toBe(DEFAULT_RECITER);
  });

  test("falls back to the default reciter for an unrecognized stored value", () => {
    expect(resolvePreferredReciter("some_unknown_reciter")).toBe(DEFAULT_RECITER);
    expect(resolvePreferredReciter("")).toBe(DEFAULT_RECITER);
  });

  test("never returns a numeric provider ID -- only a reciter key", () => {
    for (const rawValue of [undefined, null, "", "bogus", ...Object.keys(RECITER_IDS)]) {
      const result = resolvePreferredReciter(rawValue);
      expect(typeof result).toBe("string");
      expect(Object.keys(RECITER_IDS)).toContain(result);
    }
  });
});

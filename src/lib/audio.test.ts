import { describe, expect, test } from "vitest";

import {
  DEFAULT_RECITER,
  RECITER_IDS,
  RECITER_NAMES,
  reciterLabel,
  resolvePreferredReciter,
} from "./audio";

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

describe("reciterLabel", () => {
  test("returns the proper-noun reciter name for each known key, identically in every locale", () => {
    for (const [key, name] of Object.entries(RECITER_NAMES)) {
      expect(reciterLabel(key, "en")).toBe(name);
      expect(reciterLabel(key, "fr")).toBe(name);
    }
  });

  test("falls back to a generic, locale-aware label for an unrecognized value", () => {
    expect(reciterLabel("some_unknown_reciter", "en")).toBe(
      "Configured reciter: some_unknown_reciter",
    );
    expect(reciterLabel("some_unknown_reciter", "fr")).toBe(
      "Récitateur configuré : some_unknown_reciter",
    );
  });

  test("never returns the raw key unexplained for a known reciter", () => {
    for (const key of Object.keys(RECITER_IDS)) {
      expect(reciterLabel(key, "en")).not.toBe(key);
    }
  });
});

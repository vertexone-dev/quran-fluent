import { describe, expect, it } from "vitest";

import { ART_MODE, heroArt, journeysArt } from "@/design/artwork";

describe("artwork resolver (QR-WEB-006, fails closed)", () => {
  it("resolves to the CSS-only treatment outside the dev server / review mode", () => {
    // Vitest runs in mode "test": not "development", not "art-review".
    expect(ART_MODE).toBe("css");
    expect(heroArt).toBeNull();
    expect(journeysArt).toBeNull();
  });
});

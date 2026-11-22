import { describe, expect, it } from "vitest";
import { neighbouringAyahs } from "./understand";

const surahs = [
  { number: 1, ayah_count: 7 },
  { number: 2, ayah_count: 286 },
  { number: 3, ayah_count: 200 },
];

describe("neighbouringAyahs", () => {
  it("steps within a surah", () => {
    expect(neighbouringAyahs(surahs, { surah: 2, ayah: 10 })).toEqual({
      prev: { surah: 2, ayah: 9 },
      next: { surah: 2, ayah: 11 },
    });
  });
  it("crosses surah boundaries using the database's ayah counts", () => {
    expect(neighbouringAyahs(surahs, { surah: 2, ayah: 1 }).prev).toEqual({ surah: 1, ayah: 7 });
    expect(neighbouringAyahs(surahs, { surah: 2, ayah: 286 }).next).toEqual({ surah: 3, ayah: 1 });
  });
  it("has no previous at the very start and no next at the very end", () => {
    expect(neighbouringAyahs(surahs, { surah: 1, ayah: 1 }).prev).toBeNull();
    expect(neighbouringAyahs(surahs, { surah: 3, ayah: 200 }).next).toBeNull();
  });
  it("returns nothing for an ayah that does not exist", () => {
    expect(neighbouringAyahs(surahs, { surah: 2, ayah: 287 })).toEqual({ prev: null, next: null });
    expect(neighbouringAyahs(surahs, { surah: 9, ayah: 1 })).toEqual({ prev: null, next: null });
    expect(neighbouringAyahs(surahs, { surah: 2, ayah: 0 })).toEqual({ prev: null, next: null });
  });
});

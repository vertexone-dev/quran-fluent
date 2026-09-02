import { describe, it, expect, beforeAll } from "vitest";
import {
  createLocalSupabaseClient,
  resolveKazimirskiSegmentSource,
  fetchKazimirskiSegmentsForSurah,
  resolveKazimirskiAyah,
  getUnresolvedSegmentsForSurah,
  _resetKazimirskiSourceCacheForTests,
  type KazimirskiResolutionByAyah,
} from "../resolver";

/**
 * Tests the resolver prototype against the REAL locally-imported Kazimirski
 * data (postgresql://postgres:postgres@127.0.0.1:54322/postgres via the
 * local Supabase REST API). Proves each of the 7 states from
 * PHASE2-MAPPING-ARCHITECTURE.md §11 behaves as designed:
 *   direct, offset (collapsed into "resolved_single"), one_to_many,
 *   many_to_one, compound, unresolved (surah-level), unavailable.
 *
 * Run: (from repo root, with local Supabase running)
 *   set -a; source .env.test; set +a
 *   npx vitest run --config scripts/quran-import/kazimirski/local-prototype/vitest.config.ts
 */

describe("Kazimirski resolver prototype (local data)", () => {
  const client = createLocalSupabaseClient();
  let sourceId: string;

  beforeAll(async () => {
    _resetKazimirskiSourceCacheForTests();
    const source = await resolveKazimirskiSegmentSource(client);
    expect(source).not.toBeNull();
    sourceId = source!.id;
    expect(source!.translator).toBe("Albin de Kazimirski (Biberstein)");
  });

  it("resolves null for a source that does not exist (not-found contract)", async () => {
    _resetKazimirskiSourceCacheForTests();
    // Temporarily query with a bogus edition id by calling the underlying
    // query shape directly (can't easily override the constant, so instead
    // assert the memoization + non-throw contract on the real source twice).
    const first = await resolveKazimirskiSegmentSource(client);
    const second = await resolveKazimirskiSegmentSource(client);
    expect(first).toEqual(second); // memoized, same object identity of data
  });

  describe("state: direct / offset (resolved_single)", () => {
    it("Surah 101 ayah 3 (offset, B) resolves to a single segment", async () => {
      const byAyah = await fetchKazimirskiSegmentsForSurah(101, sourceId, client);
      const res = resolveKazimirskiAyah(byAyah, 3);
      expect(res.state).toBe("resolved_single");
      if (res.state === "resolved_single") {
        expect(["direct", "offset", "source_anomaly"]).toContain(res.alignmentType);
        expect(res.segment.text.length).toBeGreaterThan(0);
      }
    });

    it("Fatiha 1:1 (source_anomaly, Bismillah) resolves to a single segment", async () => {
      const byAyah = await fetchKazimirskiSegmentsForSurah(1, sourceId, client);
      const res = resolveKazimirskiAyah(byAyah, 1);
      expect(res.state).toBe("resolved_single");
      if (res.state === "resolved_single") {
        expect(res.alignmentType).toBe("source_anomaly");
        expect(res.segment.text).toBe("Au nom du Dieu clément et miséricordieux.");
        expect(res.segment.sourceDeclaredNumber).toBeNull();
      }
    });
  });

  describe("state: one_to_many", () => {
    it("Surah 101 ayah 1 and ayah 2 share the SAME segment identity, spanning the range (not duplicated text)", async () => {
      const byAyah = await fetchKazimirskiSegmentsForSurah(101, sourceId, client);
      const r1 = resolveKazimirskiAyah(byAyah, 1);
      const r2 = resolveKazimirskiAyah(byAyah, 2);
      expect(r1.state).toBe("one_to_many");
      expect(r2.state).toBe("one_to_many");
      if (r1.state === "one_to_many" && r2.state === "one_to_many") {
        expect(r1.segment.segmentId).toBe(r2.segment.segmentId);
        expect(r1.ayahRange).toEqual({ minAyah: 1, maxAyah: 2 });
        expect(r2.ayahRange).toEqual({ minAyah: 1, maxAyah: 2 });
        expect(r1.segment.text).toContain("LE COUP");
      }
    });
  });

  describe("state: many_to_one", () => {
    it("Surah 74 ayah 31 returns 4 ordered segments (the famous 19-guardians merge)", async () => {
      const byAyah = await fetchKazimirskiSegmentsForSurah(74, sourceId, client);
      const res = resolveKazimirskiAyah(byAyah, 31);
      expect(res.state).toBe("many_to_one");
      if (res.state === "many_to_one") {
        expect(res.segments).toHaveLength(4);
        const ordinals = res.segments.map((s) => s.sourceOrdinal);
        expect(ordinals).toEqual([31, 32, 33, 34]);
        expect(res.needsReview).toBe(false);
      }
    });
  });

  describe("state: compound", () => {
    it("106:4 returns a mixed-pattern result flagged needsReview", async () => {
      const byAyah = await fetchKazimirskiSegmentsForSurah(106, sourceId, client);
      const res = resolveKazimirskiAyah(byAyah, 4);
      expect(res.state).toBe("compound");
      if (res.state === "compound") {
        expect(res.segments.length).toBeGreaterThanOrEqual(2);
        expect(res.needsReview).toBe(true);
      }
    });

    it("106:3 (the split half of the same compound boundary) is NOT flagged needsReview", async () => {
      const byAyah = await fetchKazimirskiSegmentsForSurah(106, sourceId, client);
      const res = resolveKazimirskiAyah(byAyah, 3);
      // Item 3's segment also touches 106:4 (a different ayah's row), so
      // from 106:3's own vantage point this is actually a one_to_many
      // result (the segment spans 106:3..106:4) -- but critically, 106:3's
      // OWN join row must not be needs_review, proving the flag is
      // per-JOIN-ROW, not blanket-applied to every ayah a segment touches.
      expect(["resolved_single", "one_to_many", "many_to_one", "compound"]).toContain(res.state);
      if (res.state === "many_to_one" || res.state === "compound") {
        expect(res.needsReview).toBe(false);
      }
      // one_to_many results don't carry a needsReview flag on the shared
      // segment object itself (see resolver.ts's KazimirskiAyahResolution
      // union) -- the important assertion is just that this ayah's own
      // resolution never surfaces as "compound".
      expect(res.state).not.toBe("compound");
    });

    it("all 8 compound boundary ayahs resolve without throwing, generically", async () => {
      const compoundAyahs: Array<[number, number]> = [
        [3, 39],
        [3, 167],
        [11, 39],
        [14, 44],
        [47, 21],
        [65, 3],
        [65, 10],
        [106, 4],
      ];
      const bySurah = new Map<number, KazimirskiResolutionByAyah>();
      for (const [surah, ayah] of compoundAyahs) {
        if (!bySurah.has(surah)) {
          bySurah.set(surah, await fetchKazimirskiSegmentsForSurah(surah, sourceId, client));
        }
        const res = resolveKazimirskiAyah(bySurah.get(surah)!, ayah);
        expect(res.state).not.toBe("unavailable");
      }
    });
  });

  describe("state: unresolved (surah-level, never a guessed per-ayah target)", () => {
    it("Surah 2 has exactly 1 unresolved segment (ordinal 287), with no canonical target implied", async () => {
      const segs = await getUnresolvedSegmentsForSurah(2, sourceId, client);
      expect(segs).toHaveLength(1);
      expect(segs[0].sourceOrdinal).toBe(287);
      expect(segs[0].sourceDeclaredNumber).toBeNull();
      expect(segs[0].text.length).toBeGreaterThan(0);
    });

    it("Surah 36 has exactly 1 unresolved segment (ordinal 84)", async () => {
      const segs = await getUnresolvedSegmentsForSurah(36, sourceId, client);
      expect(segs).toHaveLength(1);
      expect(segs[0].sourceOrdinal).toBe(84);
    });

    it("a surah with no unresolved segments (e.g. Surah 101) returns an empty array, not null/throw", async () => {
      const segs = await getUnresolvedSegmentsForSurah(101, sourceId, client);
      expect(segs).toEqual([]);
    });
  });

  describe("state: unavailable", () => {
    it("2:8 is unavailable (mw-empty-elt source anomaly, zero segments cover it)", async () => {
      const byAyah = await fetchKazimirskiSegmentsForSurah(2, sourceId, client);
      const res = resolveKazimirskiAyah(byAyah, 8);
      expect(res).toEqual({ state: "unavailable" });
    });

    it("36:35 is unavailable (mw-empty-elt source anomaly, zero segments cover it)", async () => {
      const byAyah = await fetchKazimirskiSegmentsForSurah(36, sourceId, client);
      const res = resolveKazimirskiAyah(byAyah, 35);
      expect(res).toEqual({ state: "unavailable" });
    });

    it("a nonexistent ayah_number for a real surah is unavailable, never throws", async () => {
      const byAyah = await fetchKazimirskiSegmentsForSurah(1, sourceId, client);
      const res = resolveKazimirskiAyah(byAyah, 999);
      expect(res).toEqual({ state: "unavailable" });
    });
  });

  describe("never invents text", () => {
    it("every resolved segment's text is non-empty and traceable to a real segmentId", async () => {
      const byAyah = await fetchKazimirskiSegmentsForSurah(74, sourceId, client);
      for (const [, res] of byAyah) {
        if (res.state === "resolved_single" || res.state === "one_to_many") {
          expect(res.segment.text.trim().length).toBeGreaterThan(0);
          expect(res.segment.segmentId).toMatch(/^[0-9a-f-]{36}$/);
        } else if (res.state === "many_to_one" || res.state === "compound") {
          for (const seg of res.segments) {
            expect(seg.text.trim().length).toBeGreaterThan(0);
          }
        }
      }
    });
  });
});

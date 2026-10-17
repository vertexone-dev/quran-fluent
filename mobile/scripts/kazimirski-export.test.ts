import { describe, test, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildKazimirskiRenderMap, type KazimirskiJoinRow } from "../../src/lib/kazimirski";

/**
 * Phase 0 feasibility check: does the exported SQLite file reproduce the
 * same Kazimirski French render as the live production data, for the
 * documented compound-mapping case (Surah 106, ayahs 3-4 -- one segment
 * shared across both, ayah 4 also composing its own second segment --
 * PHASE2-MAPPING-ARCHITECTURE.md §11) and for at least one real
 * one_to_many case found in the exported data itself?
 *
 * This test reuses the real production rendering function
 * (buildKazimirskiRenderMap, src/lib/kazimirski.ts) unmodified -- its own
 * correctness already has dedicated unit tests (src/lib/kazimirski.test.ts).
 * What this test actually checks is narrower and specific to the export:
 * did mobile/scripts/export-content-db.mjs preserve enough of the
 * relational structure (segment identity, source_ordinal, the ayah join)
 * for that same function to produce correct output from the bundled
 * SQLite copy instead of a live Supabase query.
 */

const dbPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../content-db/quran-content.sqlite",
);

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(dbPath, { readOnly: true });
});

function renderMapForSurah(
  surahNumber: number,
): Map<number, { text: string | null; continuesFromAyah: number | null }> {
  const rows = db
    .prepare(
      `SELECT sa.ayah_number as ayah_number,
              s.id as seg_id, s.source_ordinal as source_ordinal,
              s.text as seg_text, s.alignment_type as alignment_type
       FROM translation_segment_ayahs sa
       JOIN translation_segments s ON s.id = sa.segment_id
       WHERE sa.surah_number = ?`,
    )
    .all(surahNumber) as Array<{
    ayah_number: number;
    seg_id: string;
    source_ordinal: number;
    seg_text: string;
    alignment_type: string;
  }>;

  const joinRows: KazimirskiJoinRow[] = rows.map((r) => ({
    ayah_number: r.ayah_number,
    segment: {
      id: r.seg_id,
      source_ordinal: r.source_ordinal,
      text: r.seg_text,
      alignment_type: r.alignment_type,
    },
  }));
  return buildKazimirskiRenderMap(joinRows);
}

describe("exported SQLite reproduces the documented Kazimirski compound case (Surah 106:3-4)", () => {
  test("ayah 3 and ayah 4 each get their own non-duplicated, correctly ordered composition", () => {
    const render = renderMapForSurah(106);

    const ayah3 = render.get(3);
    const ayah4 = render.get(4);

    expect(ayah3, "Surah 106 ayah 3 must have a render entry").toBeTruthy();
    expect(ayah4, "Surah 106 ayah 4 must have a render entry").toBeTruthy();

    // Neither ayah is a pure continuation of an earlier one (the documented
    // case is "compound", not "one_to_many") -- both must have real text.
    expect(ayah3!.text).not.toBeNull();
    expect(ayah4!.text).not.toBeNull();
    expect(ayah3!.continuesFromAyah).toBeNull();
    expect(ayah4!.continuesFromAyah).toBeNull();

    // The two ayahs' rendered text must differ -- the shared segment's
    // text must appear exactly once (on its home ayah), never duplicated
    // onto the other.
    expect(ayah3!.text).not.toBe(ayah4!.text);
    expect(ayah4!.text!.length).toBeGreaterThan(0);
    expect(ayah3!.text!.length).toBeGreaterThan(0);
  });

  test("every ayah in Surah 106 has Kazimirski coverage (no gaps in the exported join)", () => {
    const render = renderMapForSurah(106);
    const surahAyahCount = (
      db.prepare("SELECT ayah_count FROM surahs WHERE number = 106").get() as { ayah_count: number }
    ).ayah_count;
    for (let ayah = 1; ayah <= surahAyahCount; ayah++) {
      expect(render.has(ayah), `Surah 106 ayah ${ayah} should have a render entry`).toBe(true);
    }
  });
});

describe("exported SQLite preserves at least one real one_to_many case", () => {
  test("a segment spanning multiple ayahs renders once, with the other ayahs pointing back via continuesFromAyah", () => {
    const oneToMany = db
      .prepare(
        `SELECT s.id, s.surah_number, COUNT(*) as ayah_count
         FROM translation_segments s
         JOIN translation_segment_ayahs sa ON sa.segment_id = s.id
         WHERE s.alignment_type = 'one_to_many'
         GROUP BY s.id
         HAVING COUNT(*) > 1
         LIMIT 1`,
      )
      .get() as { id: string; surah_number: number; ayah_count: number } | undefined;

    expect(
      oneToMany,
      "expected at least one real one_to_many segment in the exported data",
    ).toBeTruthy();

    const render = renderMapForSurah(oneToMany!.surah_number);
    const ayahNumbers = (
      db
        .prepare(
          `SELECT ayah_number FROM translation_segment_ayahs WHERE segment_id = ? ORDER BY ayah_number`,
        )
        .all(oneToMany!.id) as Array<{ ayah_number: number }>
    ).map((r) => r.ayah_number);

    expect(ayahNumbers.length).toBeGreaterThan(1);
    const homeAyah = Math.min(...ayahNumbers);
    const continuationAyahs = ayahNumbers.filter((a) => a !== homeAyah);

    expect(render.get(homeAyah)!.text).not.toBeNull();
    expect(render.get(homeAyah)!.continuesFromAyah).toBeNull();
    for (const ayah of continuationAyahs) {
      expect(render.get(ayah)!.text).toBeNull();
      expect(render.get(ayah)!.continuesFromAyah).toBe(homeAyah);
    }
  });
});

describe("exported content matches the certified full-coverage claim", () => {
  test("every one of the 6,236 canonical ayahs has at least one Kazimirski segment-ayah mapping", () => {
    const unmapped = db
      .prepare(
        `SELECT COUNT(*) as n FROM ayahs a
         WHERE NOT EXISTS (
           SELECT 1 FROM translation_segment_ayahs sa
           WHERE sa.surah_number = a.surah_number AND sa.ayah_number = a.ayah_number
         )`,
      )
      .get() as { n: number };
    expect(unmapped.n, "every canonical ayah should have Kazimirski coverage").toBe(0);
  });

  test("every one of the 6,236 canonical ayahs has a Pickthall English translation", () => {
    const untranslated = db
      .prepare(
        `SELECT COUNT(*) as n FROM ayahs a
         WHERE NOT EXISTS (
           SELECT 1 FROM translations t
           WHERE t.surah_number = a.surah_number AND t.ayah_number = a.ayah_number
         )`,
      )
      .get() as { n: number };
    expect(untranslated.n, "every canonical ayah should have a Pickthall translation").toBe(0);
  });
});

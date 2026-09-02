import { describe, expect, test, vi, beforeEach } from "vitest";

import { buildKazimirskiRenderMap, type KazimirskiJoinRow } from "./kazimirski";

function row(
  ayah: number,
  segmentId: string,
  sourceOrdinal: number,
  text: string,
): KazimirskiJoinRow {
  return {
    ayah_number: ayah,
    segment: { id: segmentId, source_ordinal: sourceOrdinal, text, alignment_type: "direct" },
  };
}

describe("buildKazimirskiRenderMap", () => {
  test("direct mapping: one segment, one ayah, rendered as-is", () => {
    const map = buildKazimirskiRenderMap([
      row(1, "seg-1", 1, "Au nom de Dieu clément et miséricordieux."),
    ]);
    expect(map.get(1)).toEqual({
      text: "Au nom de Dieu clément et miséricordieux.",
      continuesFromAyah: null,
    });
  });

  test("one_to_many: a segment spanning multiple ayahs renders once, on the first ayah in its range", () => {
    const rows = [
      row(38, "seg-span", 40, "Ô enfants d'Adam, si des envoyés choisis parmi vous..."),
      row(39, "seg-span", 40, "Ô enfants d'Adam, si des envoyés choisis parmi vous..."),
    ];
    const map = buildKazimirskiRenderMap(rows);
    expect(map.get(38)).toEqual({
      text: "Ô enfants d'Adam, si des envoyés choisis parmi vous...",
      continuesFromAyah: null,
    });
    expect(map.get(39)).toEqual({ text: null, continuesFromAyah: 38 });
  });

  test("one_to_many: works regardless of the order rows arrive in (first = lowest ayah_number, not first-seen)", () => {
    // Deliberately fed out of ayah order to prove the "first" ayah is
    // determined by numeric minimum, not by array position.
    const rows = [row(39, "seg-span", 40, "text"), row(38, "seg-span", 40, "text")];
    const map = buildKazimirskiRenderMap(rows);
    expect(map.get(38)?.continuesFromAyah).toBeNull();
    expect(map.get(39)?.continuesFromAyah).toBe(38);
  });

  test("one_to_many spanning three ayahs: only the first renders text, the other two both continue from it", () => {
    const rows = [
      row(10, "seg-tri", 5, "texte"),
      row(11, "seg-tri", 5, "texte"),
      row(12, "seg-tri", 5, "texte"),
    ];
    const map = buildKazimirskiRenderMap(rows);
    expect(map.get(10)).toEqual({ text: "texte", continuesFromAyah: null });
    expect(map.get(11)).toEqual({ text: null, continuesFromAyah: 10 });
    expect(map.get(12)).toEqual({ text: null, continuesFromAyah: 10 });
  });

  test("compound mixed split+merge (real production shape, Surah 106 ayahs 3-4): a segment spanning two ayahs must not be duplicated when the second ayah also has its own additional segment", () => {
    // Matches the certified production data exactly: segment ordinal 3
    // joins both ayah 3 and ayah 4 (its home is ayah 3, the lower of the
    // two); ayah 4 also has its own segment ordinal 4. Ayah 4 must render
    // ONLY its own segment's text -- never the shared segment's text again.
    const rows = [
      row(
        3,
        "seg-3",
        3,
        "Qu'ils servent le Dieu de ce temple, le Dieu qui les a nourris et préservés de la famine,",
      ),
      row(
        4,
        "seg-3",
        3,
        "Qu'ils servent le Dieu de ce temple, le Dieu qui les a nourris et préservés de la famine,",
      ),
      row(4, "seg-4", 4, "Et qui les a délivrés des alarmes."),
    ];
    const map = buildKazimirskiRenderMap(rows);
    expect(map.get(3)).toEqual({
      text: "Qu'ils servent le Dieu de ce temple, le Dieu qui les a nourris et préservés de la famine,",
      continuesFromAyah: null,
    });
    // The critical assertion: ayah 4 shows ONLY its own segment's text, not
    // the shared segment's text repeated in front of it.
    expect(map.get(4)).toEqual({
      text: "Et qui les a délivrés des alarmes.",
      continuesFromAyah: null,
    });
  });

  test("many_to_one: two segments contributing to one ayah are composed in source_ordinal order", () => {
    const rows = [
      row(167, "seg-b", 2, "second historical fragment."),
      row(167, "seg-a", 1, "First historical fragment."),
    ];
    const map = buildKazimirskiRenderMap(rows);
    expect(map.get(167)).toEqual({
      text: "First historical fragment. second historical fragment.",
      continuesFromAyah: null,
    });
  });

  test("compound: composition follows the same source_ordinal ordering rule as many_to_one", () => {
    const rows = [
      {
        ...row(21, "seg-c", 30, "troisième partie"),
        segment: {
          id: "seg-c",
          source_ordinal: 30,
          text: "troisième partie",
          alignment_type: "compound",
        },
      },
      {
        ...row(21, "seg-a", 10, "première partie"),
        segment: {
          id: "seg-a",
          source_ordinal: 10,
          text: "première partie",
          alignment_type: "compound",
        },
      },
      {
        ...row(21, "seg-b", 20, "deuxième partie"),
        segment: {
          id: "seg-b",
          source_ordinal: 20,
          text: "deuxième partie",
          alignment_type: "compound",
        },
      },
    ];
    const map = buildKazimirskiRenderMap(rows);
    expect(map.get(21)).toEqual({
      text: "première partie deuxième partie troisième partie",
      continuesFromAyah: null,
    });
  });

  test("composition never alters, reorders characters within, or trims individual segment text", () => {
    const rows = [
      row(4, "seg-x", 2, "  texte avec espaces  "),
      row(4, "seg-y", 1, "Premier segment."),
    ];
    const map = buildKazimirskiRenderMap(rows);
    // Segment texts are passed through byte-for-byte; only a single joining
    // space is introduced between them -- never trimmed, never rewritten.
    expect(map.get(4)?.text).toBe("Premier segment.   texte avec espaces  ");
  });

  test("source_anomaly (e.g. Al-Fatiha's unnumbered Bismillah) renders as a normal single segment", () => {
    const anomalyRow: KazimirskiJoinRow = {
      ayah_number: 1,
      segment: {
        id: "seg-anomaly",
        source_ordinal: 0,
        text: "Au nom de Dieu clément et miséricordieux.",
        alignment_type: "source_anomaly",
      },
    };
    const map = buildKazimirskiRenderMap([anomalyRow]);
    expect(map.get(1)).toEqual({
      text: "Au nom de Dieu clément et miséricordieux.",
      continuesFromAyah: null,
    });
  });

  test("an ayah with no join rows at all is absent from the map (caller falls back to unavailable)", () => {
    const map = buildKazimirskiRenderMap([row(1, "seg-1", 1, "texte")]);
    expect(map.has(2)).toBe(false);
    expect(map.get(2)).toBeUndefined();
  });

  test("empty input produces an empty map, never throws", () => {
    const map = buildKazimirskiRenderMap([]);
    expect(map.size).toBe(0);
  });

  test("multiple independent ayahs and a one_to_many span coexist correctly in the same Surah batch", () => {
    const rows = [
      row(1, "seg-1", 1, "premier verset"),
      row(2, "seg-2", 2, "deuxième verset"),
      row(3, "seg-span", 3, "verset combiné"),
      row(4, "seg-span", 3, "verset combiné"),
      row(5, "seg-a", 5, "partie a"),
      row(5, "seg-b", 4, "partie b"),
    ];
    const map = buildKazimirskiRenderMap(rows);
    expect(map.get(1)).toEqual({ text: "premier verset", continuesFromAyah: null });
    expect(map.get(2)).toEqual({ text: "deuxième verset", continuesFromAyah: null });
    expect(map.get(3)).toEqual({ text: "verset combiné", continuesFromAyah: null });
    expect(map.get(4)).toEqual({ text: null, continuesFromAyah: 3 });
    // source_ordinal 4 ("partie b") before 5 ("partie a") -- ordering, not
    // the order the rows were listed in the input array.
    expect(map.get(5)).toEqual({ text: "partie b partie a", continuesFromAyah: null });
  });
});

describe("resolveApprovedFrenchSource (query construction — disputed-source exclusion)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("queries the exact Kazimirski edition and explicitly excludes verification_status='disputed', never referencing Hamidullah", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq"]) {
      chain[method] = vi.fn((...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      });
    }
    chain["maybeSingle"] = vi.fn(async () => ({
      data: {
        id: "f8443b10-3cc8-59ee-954f-5b1129c1cec4",
        translator: "Albin de Kazimirski Biberstein",
      },
      error: null,
    }));

    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: { from: vi.fn(() => chain) },
    }));

    const { resolveApprovedFrenchSource } = await import("./kazimirski");
    const result = await resolveApprovedFrenchSource();

    expect(result).toEqual({
      id: "f8443b10-3cc8-59ee-954f-5b1129c1cec4",
      translator: "Albin de Kazimirski Biberstein",
    });

    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    const neqCalls = calls.filter((c) => c.method === "neq").map((c) => c.args);

    expect(eqCalls).toContainEqual(["edition_identifier", "kazimirski-1869-segments-v1"]);
    expect(eqCalls).toContainEqual(["translator", "Albin de Kazimirski Biberstein"]);
    expect(eqCalls).toContainEqual(["language", "fr"]);
    expect(eqCalls).toContainEqual(["content_type", "translation"]);
    expect(neqCalls).toContainEqual(["verification_status", "disputed"]);

    // Structural proof this resolver can never target the disputed source:
    // no filter anywhere references the Hamidullah edition or translator.
    const allArgs = calls.flatMap((c) => c.args).map(String);
    expect(allArgs.some((a) => /hamidullah/i.test(a))).toBe(false);
  });
});

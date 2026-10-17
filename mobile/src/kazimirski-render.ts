/**
 * Copied unmodified from src/lib/kazimirski.ts's buildKazimirskiRenderMap
 * (the production app's own pure, network-free rendering function) --
 * duplicated here rather than imported across the build boundary, because
 * this mobile prototype is deliberately a separate, isolated build (its
 * own package.json, its own Vite config, no shared bundle with the
 * Cloudflare/Nitro app). If this logic changes in src/lib/kazimirski.ts,
 * this copy must be updated to match -- mobile/scripts/kazimirski-export.test.ts
 * already verifies the exported SQLite reproduces the real function's
 * output, which is the fidelity check that actually matters here.
 */
export type KazimirskiJoinRow = {
  ayah_number: number;
  segment: {
    id: string;
    source_ordinal: number;
    text: string;
    alignment_type: string;
  };
};

export type KazimirskiRender = {
  text: string | null;
  continuesFromAyah: number | null;
};

export type KazimirskiRenderByAyah = Map<number, KazimirskiRender>;

export function buildKazimirskiRenderMap(rows: KazimirskiJoinRow[]): KazimirskiRenderByAyah {
  const bySegment = new Map<
    string,
    { segment: KazimirskiJoinRow["segment"]; ayahNumbers: number[] }
  >();
  const byAyah = new Map<number, KazimirskiJoinRow[]>();
  for (const row of rows) {
    const seg = row.segment;
    if (!bySegment.has(seg.id)) bySegment.set(seg.id, { segment: seg, ayahNumbers: [] });
    bySegment.get(seg.id)!.ayahNumbers.push(row.ayah_number);
    if (!byAyah.has(row.ayah_number)) byAyah.set(row.ayah_number, []);
    byAyah.get(row.ayah_number)!.push(row);
  }

  const homeAyahForSegment = new Map<string, number>();
  for (const [segId, group] of bySegment)
    homeAyahForSegment.set(segId, Math.min(...group.ayahNumbers));

  const result: KazimirskiRenderByAyah = new Map();
  for (const [ayahNumber, ayahRows] of byAyah) {
    const homeHere = ayahRows.filter((r) => homeAyahForSegment.get(r.segment.id) === ayahNumber);
    if (homeHere.length === 0) {
      const homes = ayahRows.map((r) => homeAyahForSegment.get(r.segment.id)!);
      result.set(ayahNumber, { text: null, continuesFromAyah: Math.min(...homes) });
    } else {
      const ordered = [...homeHere].sort(
        (a, b) => a.segment.source_ordinal - b.segment.source_ordinal,
      );
      const composed = ordered.map((r) => r.segment.text).join(" ");
      result.set(ayahNumber, { text: composed, continuesFromAyah: null });
    }
  }
  return result;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Kazimirski French translation resolver — LOCAL PROTOTYPE ONLY.
 *
 * Mirrors src/lib/translations.ts's fetchTranslationsForSurah /
 * resolveVerifiedEnglishSource shape exactly: one batched query per surah,
 * a memoized source-id resolver, null-safe "not found" contract, and no
 * per-ayah round trips. This file is NOT imported by any route or
 * component in src/ — it lives entirely under
 * scripts/quran-import/kazimirski/local-prototype/ and is exercised only
 * by this directory's own tests, against the local Postgres instance.
 *
 * Design note on the 7 states (PHASE2-MAPPING-ARCHITECTURE.md §11):
 * `direct` and `offset` both render as a single segment and are collapsed
 * into one result shape here (the Reader doesn't need to distinguish them
 * for rendering purposes — only `alignmentType` on the result differs).
 * `one_to_many` returns the shared segment identity plus the full āyah
 * range it covers (not duplicated text). `many_to_one`/`compound` return
 * an ordered array of segments for that āyah. `unavailable` is the
 * existing null contract: no segment structurally covers this āyah at all.
 *
 * `unresolved` is NOT modeled as a per-āyah map entry, deliberately: the 2
 * genuinely unresolved Kazimirski segments (Surah 2 ordinal 287, Surah 36
 * ordinal 84) have ZERO canonical_targets — Phase 1 could not determine
 * which āyah they belong to (PHASE1-ALIGNMENT-AUDIT.md §4.2). There is
 * therefore no specific (surah, ayah) pair this resolver could honestly
 * attach an "unresolved" marker to without guessing one — exactly the
 * failure mode the governance rules forbid. Instead,
 * `getUnresolvedSegmentsForSurah` surfaces these segments at the SURAH
 * level ("this surah has N segments whose alignment is still pending
 * review"), which is the only claim the data actually supports. A future
 * UI can use this to show a surah-level banner without mis-attributing the
 * pending content to a specific āyah row.
 */

export type KazimirskiSegmentRef = {
  segmentId: string;
  sourceOrdinal: number;
  sourceDeclaredNumber: number | null;
  text: string;
  alignmentType: string;
};

export type KazimirskiAyahResolution =
  | {
      state: "resolved_single";
      alignmentType: "direct" | "offset" | "source_anomaly";
      segment: KazimirskiSegmentRef;
    }
  | {
      state: "one_to_many";
      segment: KazimirskiSegmentRef;
      ayahRange: { minAyah: number; maxAyah: number };
    }
  | { state: "many_to_one" | "compound"; segments: KazimirskiSegmentRef[]; needsReview: boolean }
  | { state: "unavailable" };

export type KazimirskiResolutionByAyah = Map<number, KazimirskiAyahResolution>;

export type KazimirskiSource = { id: string; translator: string };

const KAZIMIRSKI_SEGMENTS_EDITION_ID = "kazimirski-1869-segments-phase3";

let cachedSource: Promise<KazimirskiSource | null> | null = null;

/**
 * Resolves the local-prototype Kazimirski segment-based source by its full
 * identifying fields, mirroring resolveVerifiedEnglishSource's shape.
 * Returns null (never throws for "not found") if the local prototype
 * import hasn't been run.
 */
export function resolveKazimirskiSegmentSource(
  client: SupabaseClient,
): Promise<KazimirskiSource | null> {
  if (!cachedSource) {
    cachedSource = (async () => {
      const { data, error } = await client
        .from("content_sources")
        .select("id, translator")
        .eq("content_type", "translation")
        .eq("language", "fr")
        .eq("edition_identifier", KAZIMIRSKI_SEGMENTS_EDITION_ID)
        .maybeSingle();
      if (error) throw error;
      if (!data?.translator) return null;
      return { id: data.id, translator: data.translator };
    })();
  }
  return cachedSource;
}

/** Test-only: clears the memoized source, so tests don't leak state across runs. */
export function _resetKazimirskiSourceCacheForTests(): void {
  cachedSource = null;
}

type JoinRow = {
  surah_number: number;
  ayah_number: number;
  mapping_confidence: string;
  translation_segments: {
    id: string;
    source_ordinal: number;
    source_declared_number: number | null;
    text: string;
    alignment_type: string;
  };
};

/**
 * One batched query for every joined (segment, āyah) pair in a Surah, for
 * the Kazimirski segment source — never one request per āyah. Returns a
 * Map keyed by ayah_number; an āyah with no entry is `unavailable` (the
 * existing null → unavailable contract, unchanged) UNLESS the caller
 * treats a missing key as "not yet queried" — callers should default
 * missing keys to `{ state: "unavailable" }` explicitly, as
 * `resolveKazimirskiAyah` below does.
 */
export async function fetchKazimirskiSegmentsForSurah(
  surahNumber: number,
  sourceId: string,
  client: SupabaseClient,
  signal?: AbortSignal,
): Promise<KazimirskiResolutionByAyah> {
  let query = client
    .from("translation_segment_ayahs")
    .select(
      "surah_number, ayah_number, mapping_confidence, translation_segments!inner(id, source_ordinal, source_declared_number, text, alignment_type, source_id)",
    )
    .eq("surah_number", surahNumber)
    .eq("translation_segments.source_id", sourceId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as JoinRow[];

  // Group by segment_id first, so a one_to_many segment's multiple ayah
  // rows are recognized as sharing one segment identity.
  const bySegment = new Map<string, { seg: KazimirskiSegmentRef; ayahs: number[] }>();
  const byAyah = new Map<number, JoinRow[]>();
  for (const row of rows) {
    const seg = row.translation_segments;
    const ref: KazimirskiSegmentRef = {
      segmentId: seg.id,
      sourceOrdinal: seg.source_ordinal,
      sourceDeclaredNumber: seg.source_declared_number,
      text: seg.text,
      alignmentType: seg.alignment_type,
    };
    if (!bySegment.has(seg.id)) bySegment.set(seg.id, { seg: ref, ayahs: [] });
    bySegment.get(seg.id)!.ayahs.push(row.ayah_number);

    if (!byAyah.has(row.ayah_number)) byAyah.set(row.ayah_number, []);
    byAyah.get(row.ayah_number)!.push(row);
  }

  const result: KazimirskiResolutionByAyah = new Map();
  for (const [ayahNumber, ayahRows] of byAyah) {
    if (ayahRows.length === 1) {
      const row = ayahRows[0];
      const seg = row.translation_segments;
      const segGroup = bySegment.get(seg.id)!;
      if (segGroup.ayahs.length > 1) {
        // This segment also covers other ayahs -> one_to_many, render once
        // spanning the range, per PHASE2-MAPPING-ARCHITECTURE.md §11.
        const min = Math.min(...segGroup.ayahs);
        const max = Math.max(...segGroup.ayahs);
        result.set(ayahNumber, {
          state: "one_to_many",
          segment: segGroup.seg,
          ayahRange: { minAyah: min, maxAyah: max },
        });
      } else if (
        seg.alignment_type === "direct" ||
        seg.alignment_type === "offset" ||
        seg.alignment_type === "source_anomaly"
      ) {
        result.set(ayahNumber, {
          state: "resolved_single",
          alignmentType: seg.alignment_type as "direct" | "offset" | "source_anomaly",
          segment: segGroup.seg,
        });
      } else {
        // A single-join-row segment whose alignment_type is many_to_one or
        // compound (only 1 row for this ayah, but this IS the pattern) --
        // still render via the many_to_one/compound array shape for
        // consistency, with a 1-element array.
        result.set(ayahNumber, {
          state: seg.alignment_type === "compound" ? "compound" : "many_to_one",
          segments: [segGroup.seg],
          needsReview: row.mapping_confidence === "needs_review",
        });
      }
    } else {
      // 2+ segments joined to this one āyah -> many_to_one or compound.
      const ordered = [...ayahRows].sort(
        (a, b) => a.translation_segments.source_ordinal - b.translation_segments.source_ordinal,
      );
      const isCompound = ordered.some((r) => r.translation_segments.alignment_type === "compound");
      result.set(ayahNumber, {
        state: isCompound ? "compound" : "many_to_one",
        segments: ordered.map((r) => ({
          segmentId: r.translation_segments.id,
          sourceOrdinal: r.translation_segments.source_ordinal,
          sourceDeclaredNumber: r.translation_segments.source_declared_number,
          text: r.translation_segments.text,
          alignmentType: r.translation_segments.alignment_type,
        })),
        needsReview: ordered.some((r) => r.mapping_confidence === "needs_review"),
      });
    }
  }
  return result;
}

/**
 * Resolves a single āyah's Kazimirski state, given the already-fetched
 * per-surah map. Missing key = unavailable (no segment structurally covers
 * this āyah), the same null → "unavailable" contract every other
 * translation path in this codebase uses.
 */
export function resolveKazimirskiAyah(
  byAyah: KazimirskiResolutionByAyah,
  ayahNumber: number,
): KazimirskiAyahResolution {
  return byAyah.get(ayahNumber) ?? { state: "unavailable" };
}

/**
 * Surah-level facility for the `unresolved` state (see module docstring for
 * why this is not a per-āyah map entry). Returns every translation_segments
 * row for this surah+source with alignment_status='unresolved' -- always 0
 * canonical_targets, by construction (enforced at import time, see
 * import_kazimirski.py stage 4).
 */
export async function getUnresolvedSegmentsForSurah(
  surahNumber: number,
  sourceId: string,
  client: SupabaseClient,
): Promise<KazimirskiSegmentRef[]> {
  const { data, error } = await client
    .from("translation_segments")
    .select("id, source_ordinal, source_declared_number, text, alignment_type")
    .eq("surah_number", surahNumber)
    .eq("source_id", sourceId)
    .eq("alignment_status", "unresolved");
  if (error) throw error;
  return (data ?? []).map((seg) => ({
    segmentId: seg.id,
    sourceOrdinal: seg.source_ordinal,
    sourceDeclaredNumber: seg.source_declared_number,
    text: seg.text,
    alignmentType: seg.alignment_type,
  }));
}

/** Convenience factory for a local-instance client, for tests/scripts only. */
export function createLocalSupabaseClient(): SupabaseClient {
  const url = process.env["VITE_SUPABASE_URL"] ?? "http://127.0.0.1:54321";
  const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!key) {
    throw new Error(
      "VITE_SUPABASE_PUBLISHABLE_KEY not set -- source .env.test (local instance anon key) before running local-prototype scripts",
    );
  }
  return createClient(url, key);
}

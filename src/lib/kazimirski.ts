import { supabase } from "@/integrations/supabase/client";
import type { TranslationSource } from "@/lib/translations";

/**
 * Governed French translation resolver — Albin de Kazimirski Biberstein,
 * Le Koran (1869), segment-based (public.translation_segments /
 * public.translation_segment_ayahs). Adapted from the reviewed prototype at
 * scripts/quran-import/kazimirski/local-prototype/resolver.ts (Phase 2-5 of
 * the Kazimirski governance project) — same classification rules, restated
 * against the production edition_identifier and split into a pure
 * classify+render layer (directly unit-testable, no network) plus a thin
 * Supabase-fetching wrapper, mirroring src/lib/translations.ts's shape
 * (memoized source resolver + one batched query per Surah).
 *
 * Alignment semantics (PHASE2-MAPPING-ARCHITECTURE.md §11):
 *   direct / offset / source_anomaly: one segment, one ayah — render as-is.
 *   one_to_many: one segment spans multiple canonical ayahs. Rendered ONCE,
 *     on the first (lowest-numbered) ayah in its range — every other ayah
 *     in the range is a continuation and must never repeat the text or
 *     claim "unavailable" (see continuesFromAyah below).
 *   many_to_one / compound: 2+ segments contribute to one canonical ayah.
 *     Composed in source_ordinal order (never any other order), joined by
 *     a single space — each segment's own 1869 text is never altered,
 *     reworded, or re-punctuated.
 *   unresolved: not applicable in production — the certified import has
 *     zero unresolved segments (6236/6236 canonical coverage).
 *
 * verification_status is deliberately NOT part of the source gate below
 * (unlike resolveVerifiedEnglishSource's 'verified' requirement): the
 * production row is registered 'candidate' — Phase 5's human review
 * validated ALIGNMENT correctness, a distinct claim from translation-
 * quality sign-off (PRODUCTION-MIGRATION-IMPORT-DESIGN.md §21, open
 * question 1). Identity is instead pinned by the exact combination of
 * content_type + language + translator + edition_identifier, which
 * disambiguates at least as precisely, and an explicit
 * verification_status <> 'disputed' filter is kept anyway as defense in
 * depth: this resolver must structurally never be able to serve the
 * disputed fr.hamidullah-crf source, not merely "happen not to" because the
 * identifiers differ.
 */

const EDITION_IDENTIFIER = "kazimirski-1869-segments-v1";

export type KazimirskiSource = TranslationSource;

let cachedSource: Promise<KazimirskiSource | null> | null = null;

export function resolveApprovedFrenchSource(): Promise<KazimirskiSource | null> {
  if (!cachedSource) {
    cachedSource = (async () => {
      const { data, error } = await supabase
        .from("content_sources")
        .select("id, translator")
        .eq("content_type", "translation")
        .eq("language", "fr")
        .eq("translator", "Albin de Kazimirski Biberstein")
        .eq("edition_identifier", EDITION_IDENTIFIER)
        .neq("verification_status", "disputed")
        .maybeSingle();
      if (error) throw error;
      if (!data?.translator) return null;
      return { id: data.id, translator: data.translator };
    })();
  }
  return cachedSource;
}

/** Test-only: clears the memoized source, so tests don't leak state across runs. */
export function _resetApprovedFrenchSourceCacheForTests(): void {
  cachedSource = null;
}

/** Shape of one joined (segment, ayah) row, as fetched by
 * fetchKazimirskiRenderForSurah — also the exact shape unit tests construct
 * by hand to exercise buildKazimirskiRenderMap without any network access. */
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
  /** What to display on this ayah, or null if this ayah is a continuation
   * of a one_to_many segment already fully rendered on an earlier ayah
   * (see continuesFromAyah) — never a duplicate of that earlier text. */
  text: string | null;
  /** Set only for a one_to_many segment's non-first ayah: the ayah_number
   * where the segment's full text is actually rendered. Null otherwise. */
  continuesFromAyah: number | null;
};

export type KazimirskiRenderByAyah = Map<number, KazimirskiRender>;

/**
 * Pure: classifies and composes already-fetched join rows into a final
 * per-ayah render map. No network access — directly unit-testable with
 * hand-constructed fixture rows. An ayah_number with no entry in the
 * returned map has no Kazimirski coverage at all (caller falls back to the
 * "unavailable" state — should not occur in production given 6236/6236
 * certified coverage, but is never assumed).
 *
 * Algorithm: every segment has a "home ayah" — the lowest ayah_number it is
 * joined to. A segment's text is composed into an ayah's render ONLY on its
 * home ayah, never elsewhere. This is what makes "compound" (a real
 * production case, e.g. Surah 106 ayahs 3-4: one segment spans both, ayah 4
 * also has its own second segment) render correctly without duplication:
 * ayah 3 gets the shared segment's text (its home); ayah 4 composes only
 * its own second segment (the shared segment's home is ayah 3, so it is
 * excluded from ayah 4's composition even though it is also joined there).
 * If EVERY segment joined to an ayah has its home elsewhere (the pure
 * one_to_many case), that ayah is a continuation of the lowest such home.
 */
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
      // Every segment joined to this ayah has its full text already
      // rendered on an earlier ayah — this ayah is a pure continuation.
      const homes = ayahRows.map((r) => homeAyahForSegment.get(r.segment.id)!);
      result.set(ayahNumber, { text: null, continuesFromAyah: Math.min(...homes) });
    } else {
      // Compose only the segments whose home IS this ayah, in
      // source_ordinal order — never any other order, never including a
      // segment already rendered elsewhere. Each segment's own text is
      // passed through unmodified; a single joining space between segments
      // is the only transformation applied.
      const ordered = [...homeHere].sort(
        (a, b) => a.segment.source_ordinal - b.segment.source_ordinal,
      );
      const composed = ordered.map((r) => r.segment.text).join(" ");
      result.set(ayahNumber, { text: composed, continuesFromAyah: null });
    }
  }
  return result;
}

/**
 * One batched query for every joined (segment, ayah) pair in a Surah, for
 * the approved Kazimirski source — never one request per ayah. Mirrors
 * fetchTranslationsForSurah's shape exactly.
 */
export async function fetchKazimirskiRenderForSurah(
  surahNumber: number,
  sourceId: string,
  signal?: AbortSignal,
): Promise<KazimirskiRenderByAyah> {
  let query = supabase
    .from("translation_segment_ayahs")
    .select(
      "ayah_number, segment:translation_segments!inner(id, source_ordinal, text, alignment_type, source_id)",
    )
    .eq("surah_number", surahNumber)
    .eq("translation_segments.source_id", sourceId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return buildKazimirskiRenderMap((data ?? []) as unknown as KazimirskiJoinRow[]);
}

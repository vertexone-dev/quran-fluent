// Phase 8C.3 — pure, DB-free content-source governance checks + the Arabic
// aggregate-hash algorithm. Extracted out of scripts/validate-quran-content.mjs
// so this logic is directly unit-testable (scripts/lib/content-source-governance.test.ts)
// without a database, mirroring the existing src/lib/*.ts "pure classify/compose
// layer + thin fetching wrapper" pattern (see src/lib/kazimirski.ts).
//
// Nothing in this file reads or writes a database, a file, or an environment
// variable. Every function is a pure function of its arguments.

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Identity constants — kept in exact lockstep with the application's own
// source-resolution predicates (src/lib/kazimirski.ts resolveApprovedFrenchSource,
// src/lib/translations.ts resolveVerifiedEnglishSource) and with the Phase 8C.2
// migration (supabase/migrations/20260913100000_7872f932-….sql).
// ---------------------------------------------------------------------------

export const LEGACY_KAZIMIRSKI_EDITION = "kazimirski-1869";
export const ACTIVE_KAZIMIRSKI_EDITION = "kazimirski-1869-segments-v1";
// Exact translator string used by the app's resolver — deliberately different
// from the legacy row's "Albin de Kazimirski (Biberstein)" (with parens); see
// PHASE8C-CONTENT-SOURCE-GOVERNANCE.md §7.
export const ACTIVE_KAZIMIRSKI_TRANSLATOR = "Albin de Kazimirski Biberstein";
export const ARABIC_EDITION = "uthmani";

// The exact marker the Phase 8C.2 migration appends to the legacy row's notes
// (supabase/migrations/20260913100000_….sql, v_note_marker).
export const PHASE8C_MARKER = "\n\n[Phase 8C: ";

// ---------------------------------------------------------------------------
// Arabic aggregate-hash algorithm (Phase 8C.3 §3.8-10).
//
// Definition (deliberately simple, deliberately NOT normalizing):
//   1. Select every public.ayahs row's arabic_text.
//   2. Order by (surah_number ASC, ayah_number ASC).
//   3. Join the raw, exact stored UTF-8 strings with U+001E (RECORD SEPARATOR)
//      between them — the same separator convention already used by the
//      Kazimirski aggregate hash recorded in content_sources.notes for
//      kazimirski-1869-segments-v1 (supabase/migrations/20260912100000_….sql).
//   4. No Unicode normalization is applied. This is a deliberate choice, not
//      an oversight: nothing in this application ever legitimately writes to
//      ayahs.arabic_text, so this hash exists purely to detect ANY byte-level
//      drift in that column — including an incidental re-normalization that a
//      "meaning-preserving" NFC hash would silently ignore. (An NFC-normalized
//      variant was computed too, during authoring, independently in Node and
//      in Postgres via normalize(text, NFC) — both agreed bit-for-bit at
//      947e6e20eaaaaf936bca0c881336e29400a360bee86e541e6d986a232ff71514 — which
//      is recorded here only as proof the algorithm is well-defined and
//      reproducible, not as the value this validator checks.)
//   5. SHA-256 the UTF-8 bytes of the joined string; lowercase hex digest.
//
// This hash proves the Arabic corpus is BYTE-IDENTICAL to the state it was
// pinned in. It does NOT prove textual authenticity, correctness against any
// authoritative reference, or that the Tanzil source was itself error-free —
// that independent cross-verification is Phase 8D's job, still open (see
// PHASE8C-CONTENT-SOURCE-GOVERNANCE.md §6). A hash match only means "nothing
// has changed since certification"; it is silent on whether the certified
// text was correct.
export const ARABIC_AGGREGATE_SEPARATOR = "";

// Computed read-only against production (project wubzdnuwrhmrodwqkicg),
// 2026-09-04, over all 6236 ayahs.arabic_text rows per the algorithm above.
// Cross-checked by two independent implementations that agreed bit-for-bit:
//   Node:     rows.sort(...).map(r => r.arabic_text).join("") -> sha256
//   Postgres: encode(digest(string_agg(arabic_text, chr(30) ORDER BY
//             surah_number, ayah_number), 'sha256'), 'hex')
// If the certified Arabic corpus is ever legitimately re-imported or
// corrected, this constant must be updated alongside that change (same
// convention as EXPECTED_KAZIMIRSKI_SEGMENTS/JOINS in validate-quran-content.mjs).
export const EXPECTED_ARABIC_AGGREGATE_SHA256 =
  "ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b";

/** Pure: computes the aggregate hash for an arbitrary-order array of
 * {surah_number, ayah_number, arabic_text} rows. Sorts internally, so callers
 * never need to pre-sort (and a caller passing rows in any order gets the
 * same, correct answer). */
export function computeArabicAggregateSha256(rows) {
  const sorted = [...rows].sort(
    (a, b) => a.surah_number - b.surah_number || a.ayah_number - b.ayah_number,
  );
  const joined = sorted.map((r) => r.arabic_text).join(ARABIC_AGGREGATE_SEPARATOR);
  return createHash("sha256").update(joined, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Legacy/active Kazimirski governance checks (Phase 8C.3 §3.1-7).
// ---------------------------------------------------------------------------

/** Occurrences of `needle` in `haystack`, non-overlapping. 0 for empty/absent input. */
export function countOccurrences(haystack, needle) {
  if (!haystack || !needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

/** content_sources rows matching the legacy kazimirski-1869 identity predicate
 * (content_type/language/edition_identifier/legacy_interim) — the exact same
 * four predicates the Phase 8C.2 migration targets by. Should be exactly 1. */
export function findLegacyKazimirskiRows(contentSources) {
  return contentSources.filter(
    (c) =>
      c.content_type === "translation" &&
      c.language === "fr" &&
      c.edition_identifier === LEGACY_KAZIMIRSKI_EDITION &&
      c.legacy_interim === true,
  );
}

/** content_sources rows matching the APPLICATION's exact active-French-source
 * predicate (src/lib/kazimirski.ts resolveApprovedFrenchSource): content_type,
 * language, translator, edition_identifier, and verification_status !=
 * 'disputed'. Should be exactly 1, and it must never be able to match the
 * legacy row (different edition_identifier AND different translator string)
 * or the disputed fr.hamidullah-crf row (excluded three ways). */
export function findActiveKazimirskiRows(contentSources) {
  return contentSources.filter(
    (c) =>
      c.content_type === "translation" &&
      c.language === "fr" &&
      c.translator === ACTIVE_KAZIMIRSKI_TRANSLATOR &&
      c.edition_identifier === ACTIVE_KAZIMIRSKI_EDITION &&
      c.verification_status !== "disputed",
  );
}

/** Runs all 7 Phase 8C.3 content-source-governance checks against a
 * content_sources row array and returns a flat array of
 * {name, ok, detail} — same shape validate-quran-content.mjs's own check()
 * helper consumes, so the caller can print/aggregate them identically to
 * every other check in that script. Pure: no I/O, no side effects. */
export function checkLegacyKazimirskiGovernance(contentSources) {
  const results = [];

  const legacyRows = findLegacyKazimirskiRows(contentSources);
  results.push({
    name: "exactly one legacy kazimirski-1869 content_sources row exists",
    ok: legacyRows.length === 1,
    detail: `found ${legacyRows.length}`,
  });
  const legacy = legacyRows.length === 1 ? legacyRows[0] : null;

  results.push({
    name: "legacy kazimirski-1869 row is verification_status=deprecated",
    ok: legacy?.verification_status === "deprecated",
    detail: legacy ? `status=${legacy.verification_status}` : "legacy row not uniquely resolved",
  });

  const legacyNotes = legacy?.notes ?? "";
  const markerCount = countOccurrences(legacyNotes, PHASE8C_MARKER);
  results.push({
    name: "legacy row's Phase 8C successor marker appears exactly once",
    ok: markerCount === 1,
    detail: `found ${markerCount}`,
  });

  const namesSuccessor = legacyNotes.includes(ACTIVE_KAZIMIRSKI_EDITION);
  results.push({
    name: "legacy row's notes name the active successor (kazimirski-1869-segments-v1)",
    ok: namesSuccessor,
    detail: namesSuccessor ? "present" : "not found in notes",
  });

  const badLegacyInterim = contentSources.filter(
    (c) =>
      c.legacy_interim === true &&
      c.verification_status !== "deprecated" &&
      c.verification_status !== "disputed",
  );
  results.push({
    name: "every legacy_interim=true source is deprecated or disputed",
    ok: badLegacyInterim.length === 0,
    detail: badLegacyInterim
      .map((c) => `${c.edition_identifier}=${c.verification_status}`)
      .join(", "),
  });

  const activeRows = findActiveKazimirskiRows(contentSources);
  results.push({
    name: "active Kazimirski source resolves uniquely (app's exact identity predicate)",
    ok: activeRows.length === 1,
    detail: `found ${activeRows.length}`,
  });

  // Structural proof that the predicate itself can never resolve to the
  // legacy or disputed rows — not merely "it happens not to" on today's data.
  const noDisputedOrLegacyLeaked =
    activeRows.length === 1 &&
    activeRows.every(
      (r) =>
        r.legacy_interim !== true &&
        r.verification_status !== "disputed" &&
        r.edition_identifier !== LEGACY_KAZIMIRSKI_EDITION,
    );
  results.push({
    name: "no disputed or legacy_interim source can satisfy the active French-source predicate",
    ok: noDisputedOrLegacyLeaked,
    detail: activeRows
      .map(
        (r) =>
          `${r.edition_identifier}(legacy_interim=${r.legacy_interim},status=${r.verification_status})`,
      )
      .join(", "),
  });

  return results;
}

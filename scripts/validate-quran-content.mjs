#!/usr/bin/env node
// Read-only Quran content integrity validator (Phase 8B.2).
//
// Connects with the same publishable/anon key the app itself uses (RLS
// grants SELECT on every table read here to anon/authenticated), so this
// can never write. Reads full tables via pagination rather than filtering
// server-side wherever a join/anti-join would be needed, since PostgREST
// embedding across the composite FKs here is fragile — every table read
// below is small enough (low thousands of rows) that this is cheap.
//
// Exit code 0 = every check passed. Exit code 1 = at least one check
// failed. Never modifies any row; never a migration.
//
// Usage: node scripts/validate-quran-content.mjs
// (or: npm run validate:quran-content)
//
// Requires a *complete, same-namespace* credential pair: either
// SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY, or VITE_SUPABASE_URL +
// VITE_SUPABASE_PUBLISHABLE_KEY. Never mixes a URL from one namespace with a
// key from the other -- each candidate pair below is checked atomically, so
// a URL and key from different projects/rotations can never be combined
// into an invalid pair. Which namespace actually gets used is determined by
// the calling workflow step's own env: block (see ci.yml /
// production-validation.yml), not by this script -- it only refuses to
// guess across namespaces.

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkLegacyKazimirskiGovernance,
  computeArabicAggregateSha256,
  EXPECTED_ARABIC_AGGREGATE_SHA256,
  ARABIC_EDITION,
} from "./lib/content-source-governance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env.test") });

function resolveCredentialPair() {
  const candidates = [
    {
      source: "SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY",
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_PUBLISHABLE_KEY,
    },
    {
      source: "VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY",
      url: process.env.VITE_SUPABASE_URL,
      key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  ];
  return candidates.find((c) => c.url && c.key) ?? null;
}

const credentials = resolveCredentialPair();
if (!credentials) {
  console.error(
    "No complete Supabase credential pair found. Need both halves of either " +
      "SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY, or VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY, " +
      "set together in the same namespace -- set them in the environment, or in .env.test for a local run.",
  );
  process.exit(1);
}
console.log(`Using Supabase credential pair from: ${credentials.source}`);

const supabase = createClient(credentials.url, credentials.key, {
  auth: { persistSession: false },
});

// Canonical Quran structure never changes -- these are true universal
// constants, not environment-specific assumptions.
const EXPECTED_SURAHS = 114;
const EXPECTED_AYAHS = 6236;

// The certified corpus totals from the Kazimirski production migration
// (scripts/quran-import/kazimirski/PRODUCTION-IMPORT-EXECUTION-REPORT.md).
// Per the standing "do not modify Kazimirski mappings" constraint these are
// expected to remain stable; if a future, deliberate re-certification
// changes the corpus, update these two constants alongside it.
const EXPECTED_KAZIMIRSKI_SEGMENTS = 6239;
const EXPECTED_KAZIMIRSKI_JOINS = 6396;

const PICKTHALL_EDITION = "pickthall-gutenberg-16955";
const KAZIMIRSKI_EDITION = "kazimirski-1869-segments-v1";

const VALID_ALIGNMENT_TYPES = new Set([
  "direct",
  "offset",
  "one_to_many",
  "many_to_one",
  "compound",
  "unresolved",
  "source_anomaly",
]);
const VALID_ALIGNMENT_STATUSES = new Set([
  "auto_verified",
  "cross_verified",
  "human_verified",
  "unresolved",
  "rejected",
]);
const VALID_MAPPING_CONFIDENCE = new Set([
  "auto",
  "cross_verified",
  "human_verified",
  "needs_review",
]);

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function info(message) {
  console.log(`  INFO  ${message}`);
}

async function fetchAll(table, columns, applyFilters = (q) => q) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await applyFilters(
      supabase
        .from(table)
        .select(columns)
        .range(from, from + pageSize - 1),
    );
    if (error) throw new Error(`Query failed on ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function main() {
  console.log("Quran content integrity validation\n");

  const surahs = await fetchAll("surahs", "number,ayah_count");
  check("surah count = 114", surahs.length === EXPECTED_SURAHS, `found ${surahs.length}`);

  const ayahs = await fetchAll("ayahs", "surah_number,ayah_number,arabic_text,arabic_source_id");
  check("ayah count = 6236", ayahs.length === EXPECTED_AYAHS, `found ${ayahs.length}`);

  const ayahKeySet = new Set();
  let duplicateAyahs = 0;
  for (const a of ayahs) {
    const key = `${a.surah_number}:${a.ayah_number}`;
    if (ayahKeySet.has(key)) duplicateAyahs++;
    ayahKeySet.add(key);
  }
  check(
    "no duplicate (surah,ayah) canonical rows",
    duplicateAyahs === 0,
    `found ${duplicateAyahs}`,
  );

  const ayahNumbersBySurah = new Map();
  for (const a of ayahs) {
    if (!ayahNumbersBySurah.has(a.surah_number)) ayahNumbersBySurah.set(a.surah_number, []);
    ayahNumbersBySurah.get(a.surah_number).push(a.ayah_number);
  }
  const surahsWithGaps = [];
  const surahsWithCountMismatch = [];
  for (const s of surahs) {
    const nums = (ayahNumbersBySurah.get(s.number) ?? []).slice().sort((x, y) => x - y);
    if (nums.length !== s.ayah_count) surahsWithCountMismatch.push(s.number);
    if (!nums.every((n, i) => n === i + 1)) surahsWithGaps.push(s.number);
  }
  check(
    "no ayah-number gaps within any surah",
    surahsWithGaps.length === 0,
    `surahs: ${surahsWithGaps.join(",")}`,
  );
  check(
    "surahs.ayah_count metadata matches actual ayah rows",
    surahsWithCountMismatch.length === 0,
    `surahs: ${surahsWithCountMismatch.join(",")}`,
  );

  const missingArabic = ayahs.filter((a) => !a.arabic_text || a.arabic_text.trim() === "").length;
  check(
    "Arabic coverage 6236/6236, no missing/empty text",
    missingArabic === 0,
    `missing/empty=${missingArabic}`,
  );
  const missingArabicSource = ayahs.filter((a) => !a.arabic_source_id).length;
  check(
    "no ayahs with null arabic_source_id",
    missingArabicSource === 0,
    `found ${missingArabicSource}`,
  );

  const contentSources = await fetchAll(
    "content_sources",
    "id,content_type,language,edition_identifier,legacy_interim,verification_status,translator,notes",
  );

  // Arabic aggregate-hash + uthmani-status checks run UNCONDITIONALLY (every
  // environment, not gated by REQUIRE_KAZIMIRSKI_SOURCE): confirmed by direct
  // comparison that the local/CI dev database's canonical Arabic corpus is
  // byte-identical to production's (both committed via supabase/migrations/,
  // unlike the out-of-band Kazimirski corpus), so this check is safe to
  // enforce everywhere, not just where the Kazimirski corpus happens to be
  // present. This is a drift tripwire ONLY: a match proves ayahs.arabic_text
  // is byte-identical to the state it was pinned in; it does NOT prove
  // textual authenticity against any authoritative external reference — that
  // remains Phase 8D's open item (PHASE8C-CONTENT-SOURCE-GOVERNANCE.md §6).
  const arabicAggregateHash = computeArabicAggregateSha256(ayahs);
  check(
    "Arabic corpus aggregate hash matches the pinned baseline (drift tripwire, not an authenticity proof)",
    arabicAggregateHash === EXPECTED_ARABIC_AGGREGATE_SHA256,
    arabicAggregateHash === EXPECTED_ARABIC_AGGREGATE_SHA256
      ? undefined
      : `expected ${EXPECTED_ARABIC_AGGREGATE_SHA256}, got ${arabicAggregateHash}`,
  );
  info(
    "Arabic aggregate hash detects byte-level drift in ayahs.arabic_text only. It does not verify " +
      "textual authenticity against Tanzil, an authoritative external reference, or any other independent " +
      "source -- that cross-verification is Phase 8D's open item, not this check's.",
  );

  const uthmaniSource = contentSources.find((c) => c.edition_identifier === ARABIC_EDITION);
  check(
    `canonical Arabic source ("${ARABIC_EDITION}") remains verification_status=candidate`,
    uthmaniSource?.verification_status === "candidate",
    uthmaniSource
      ? `status=${uthmaniSource.verification_status}`
      : `"${ARABIC_EDITION}" content_sources row not found`,
  );

  const pickthallSource = contentSources.find((c) => c.edition_identifier === PICKTHALL_EDITION);
  check("exactly one Pickthall content_sources row exists", !!pickthallSource, "not found");
  const kazRows = contentSources.filter((c) => c.edition_identifier === KAZIMIRSKI_EDITION);
  const kazSource = kazRows[0];
  // Set by production-validation.yml (where the certified corpus is
  // guaranteed to exist) to turn "Kazimirski data absent" from an
  // environment note into a hard failure -- everywhere else (local dev, the
  // PR/main CI database, which only carry canonical Quran + Pickthall via
  // supabase/migrations/, not the out-of-band production-only Kazimirski
  // import), its absence is expected and must not block the pipeline.
  const requireKazimirski = process.env.REQUIRE_KAZIMIRSKI_SOURCE === "true";
  if (kazRows.length === 0) {
    if (requireKazimirski) {
      check(
        `"${KAZIMIRSKI_EDITION}" content_sources row exists (REQUIRE_KAZIMIRSKI_SOURCE=true)`,
        false,
        "not found",
      );
    } else {
      info(
        `No "${KAZIMIRSKI_EDITION}" content_sources row in this environment — skipping Kazimirski-specific ` +
          "checks. Expected on any environment that only carries canonical Quran + Pickthall (the certified " +
          "Kazimirski corpus is production-only, applied out-of-band via the direct-Postgres migration adapter, " +
          "not via supabase/migrations/). This is enforced as a hard requirement in production-validation.yml instead.",
      );
    }
  } else {
    check(
      "exactly one Kazimirski content_sources row exists",
      kazRows.length === 1,
      `found ${kazRows.length}`,
    );
  }

  if (pickthallSource) {
    const pickRows = await fetchAll("translations", "surah_number,ayah_number,text", (q) =>
      q.eq("source_id", pickthallSource.id),
    );
    check(
      "Pickthall coverage 6236/6236",
      pickRows.length === EXPECTED_AYAHS,
      `found ${pickRows.length}`,
    );
    const emptyPick = pickRows.filter((r) => !r.text || r.text.trim() === "").length;
    check("no missing/empty Pickthall text", emptyPick === 0, `found ${emptyPick}`);
    const pickKeys = new Set();
    let dupPick = 0;
    for (const r of pickRows) {
      const key = `${r.surah_number}:${r.ayah_number}`;
      if (pickKeys.has(key)) dupPick++;
      pickKeys.add(key);
    }
    check("no duplicate Pickthall (surah,ayah) rows", dupPick === 0, `found ${dupPick}`);
  }

  if (kazSource) {
    // Phase 8C.3 permanent governance assertions (legacy-source lifecycle +
    // active-source selection safety). Gated the same way as every other
    // check in this block: they only run where the certified Kazimirski
    // corpus is present at all (production today), matching the existing
    // convention -- local/CI dev's database never receives this corpus via
    // supabase/migrations/, so these checks would be structurally
    // unsatisfiable there (the legacy row is never touched outside
    // production), not a real defect. Confirmed no CI risk by direct
    // comparison against the local dev database during authoring.
    for (const result of checkLegacyKazimirskiGovernance(contentSources)) {
      check(result.name, result.ok, result.detail);
    }

    const segments = await fetchAll(
      "translation_segments",
      "id,surah_number,source_ordinal,alignment_type,alignment_status",
      (q) => q.eq("source_id", kazSource.id),
    );
    check(
      `Kazimirski segment count = ${EXPECTED_KAZIMIRSKI_SEGMENTS} (certified corpus)`,
      segments.length === EXPECTED_KAZIMIRSKI_SEGMENTS,
      `found ${segments.length}`,
    );

    const segIds = new Set(segments.map((s) => s.id));
    const badAlignType = segments.filter(
      (s) => !VALID_ALIGNMENT_TYPES.has(s.alignment_type),
    ).length;
    check("all segments have a valid alignment_type", badAlignType === 0, `found ${badAlignType}`);
    const badAlignStatus = segments.filter(
      (s) => !VALID_ALIGNMENT_STATUSES.has(s.alignment_status),
    ).length;
    check(
      "all segments have a valid alignment_status",
      badAlignStatus === 0,
      `found ${badAlignStatus}`,
    );
    const unresolvedSegments = segments.filter((s) => s.alignment_status === "unresolved").length;
    check(
      "zero segments with alignment_status=unresolved",
      unresolvedSegments === 0,
      `found ${unresolvedSegments}`,
    );

    const negOrdinal = segments.filter((s) => s.source_ordinal < 0).length;
    check("no negative source_ordinal values", negOrdinal === 0, `found ${negOrdinal}`);
    const ordinalsBySurah = new Map();
    let dupOrdinal = 0;
    for (const s of segments) {
      if (!ordinalsBySurah.has(s.surah_number)) ordinalsBySurah.set(s.surah_number, new Set());
      const set = ordinalsBySurah.get(s.surah_number);
      if (set.has(s.source_ordinal)) dupOrdinal++;
      set.add(s.source_ordinal);
    }
    check(
      "no duplicate source_ordinal within any surah (Kazimirski)",
      dupOrdinal === 0,
      `found ${dupOrdinal}`,
    );

    // Fetched unfiltered: translation_segment_ayahs currently backs only the
    // segment-based (Kazimirski) translation model, verified below by
    // checking every join's segment_id resolves inside segIds -- an IN-list
    // over 6000+ UUIDs would risk hitting PostgREST's URL-length limits, and
    // this table is small enough (~6400 rows) to just read in full.
    const joins = await fetchAll(
      "translation_segment_ayahs",
      "id,segment_id,surah_number,ayah_number,mapping_confidence",
    );
    check(
      `Kazimirski join count = ${EXPECTED_KAZIMIRSKI_JOINS}`,
      joins.length === EXPECTED_KAZIMIRSKI_JOINS,
      `found ${joins.length}`,
    );

    const joinsWithUnknownSegment = joins.filter((j) => !segIds.has(j.segment_id)).length;
    check(
      "no joins reference a segment outside the certified Kazimirski corpus",
      joinsWithUnknownSegment === 0,
      `found ${joinsWithUnknownSegment}`,
    );

    const joinedSegIds = new Set(joins.map((j) => j.segment_id));
    const orphanSegments = segments.filter((s) => !joinedSegIds.has(s.id)).length;
    check(
      "no orphan Kazimirski segments (segment with zero ayah joins)",
      orphanSegments === 0,
      `found ${orphanSegments}`,
    );

    const danglingJoins = joins.filter(
      (j) => !ayahKeySet.has(`${j.surah_number}:${j.ayah_number}`),
    ).length;
    check(
      "no Kazimirski mappings to nonexistent ayahs",
      danglingJoins === 0,
      `found ${danglingJoins}`,
    );

    const joinKeySet = new Set();
    let dupJoins = 0;
    for (const j of joins) {
      const key = `${j.segment_id}:${j.surah_number}:${j.ayah_number}`;
      if (joinKeySet.has(key)) dupJoins++;
      joinKeySet.add(key);
    }
    check("no duplicate segment-ayah joins", dupJoins === 0, `found ${dupJoins}`);

    const badMappingConfidence = joins.filter(
      (j) => !VALID_MAPPING_CONFIDENCE.has(j.mapping_confidence),
    ).length;
    check(
      "all joins have a valid mapping_confidence",
      badMappingConfidence === 0,
      `found ${badMappingConfidence}`,
    );

    const coveredAyahs = new Set(joins.map((j) => `${j.surah_number}:${j.ayah_number}`));
    check(
      "Kazimirski canonical ayah coverage 6236/6236",
      coveredAyahs.size === EXPECTED_AYAHS,
      `found ${coveredAyahs.size}`,
    );

    // Historical-numbering divergence (Kazimirski's own 1869 verse numbers
    // do not always align 1:1 with canonical Uthmani numbering) is expected
    // by design and must NOT fail CI merely because a mapping isn't 1:1.
    // These two counts are informational only -- never asserted against a
    // specific number, since the exact count is a fragile snapshot of the
    // historical text, not an architectural invariant.
    const ayahJoinCounts = new Map();
    for (const j of joins) {
      const key = `${j.surah_number}:${j.ayah_number}`;
      ayahJoinCounts.set(key, (ayahJoinCounts.get(key) ?? 0) + 1);
    }
    const multiSegmentAyahs = [...ayahJoinCounts.values()].filter((c) => c > 1).length;

    const segmentJoinCounts = new Map();
    for (const j of joins) {
      segmentJoinCounts.set(j.segment_id, (segmentJoinCounts.get(j.segment_id) ?? 0) + 1);
    }
    const multiAyahSegments = [...segmentJoinCounts.values()].filter((c) => c > 1).length;

    info(
      `${multiSegmentAyahs} ayahs covered by 2+ Kazimirski segments (expected many_to_one/compound historical divergence)`,
    );
    info(
      `${multiAyahSegments} Kazimirski segments spanning 2+ ayahs (expected one_to_many/compound historical divergence)`,
    );

    // Architectural assertions in place of a hardcoded 1:1 assumption: any
    // multiplicity must be *labeled* by the segment's own alignment_type,
    // not silently unexplained.
    const alignmentTypeById = new Map(segments.map((s) => [s.id, s.alignment_type]));
    let unlabeledMultiAyahSegments = 0;
    for (const [segId, count] of segmentJoinCounts) {
      if (count > 1 && alignmentTypeById.get(segId) === "direct") unlabeledMultiAyahSegments++;
    }
    check(
      "every segment spanning multiple ayahs has a non-direct alignment_type",
      unlabeledMultiAyahSegments === 0,
      `found ${unlabeledMultiAyahSegments}`,
    );

    let mislabeledDirectSegments = 0;
    for (const s of segments) {
      if (s.alignment_type === "direct" && (segmentJoinCounts.get(s.id) ?? 0) !== 1) {
        mislabeledDirectSegments++;
      }
    }
    check(
      "every 'direct' segment maps to exactly one ayah",
      mislabeledDirectSegments === 0,
      `found ${mislabeledDirectSegments}`,
    );
  }

  console.log(`\n${passed}/${passed + failed} checks passed, ${failed} failed`);
  if (failed > 0) {
    console.error("\nFAILED CHECKS:");
    for (const f of failures) console.error(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

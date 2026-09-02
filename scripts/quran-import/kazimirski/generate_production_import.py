#!/usr/bin/env python3
"""
Kazimirski PRODUCTION import artifact generator.

Implements PRODUCTION-MIGRATION-IMPORT-DESIGN.md §9's 17 hard gates, FAIL
CLOSED on every one -- any failure aborts with a non-zero exit and writes
NO output file (no partial artifact ever). Never touches any database for
writing; the one read-only cross-check against the local rehearsal DB (see
"DB VERIFICATION" note below) issues SELECT-only queries against
translation_segments / translation_segment_ayahs / ayahs, never INSERT/
UPDATE/DELETE anything, anywhere.

Reads:
  - texte_entier_raw.html            (frozen raw source)
  - kazimirski_alignment_manifest.json (v2, post-Phase-4 -- base per-segment
    data: text, hashes, ordinals, alignment_type, base alignment_status)
  - PHASE5-REVIEW-DECISIONS.json     (25 decisions, all APPROVE -- the sole
    authority for which specific segments/joins get promoted to
    human_verified, and their reviewer_notes/reviewed_by/reviewed_at)
  - PHASE5-TIER3-FROZEN-SAMPLE.json  (53-segment frozen sample, gate 14)
  - (read-only) local rehearsal Postgres, source_id =
    'kazimirski-1869-segments-phase3' -- ground truth for gate 9.10/9.11
    ("reconciles ... in the source DB") and gate 9.12 (source_declared_number
    NULL-preservation, which the manifest alone cannot answer -- see the
    "DB VERIFICATION" note below).

Writes: scripts/quran-import/kazimirski/generated/kazimirski-production-import.json
(only on total success -- every gate must pass).

============================================================================
DB VERIFICATION NOTE (clarifying, not deviating from, design doc §9)
============================================================================
§9's opening line says this generator "never touches any database." Read
literally-and-only as "never WRITES to a database," that holds absolutely --
every DB interaction here is a read-only SELECT. But §9's own gates 9.10/
9.11 ("reconciles ... in the source DB") and 9.12 ("wherever the DB has it
NULL") are only checkable AT ALL by reading a database -- the manifest alone
cannot answer them, since the manifest is a static, unregenerated,
pre-Phase-5 artifact (confirmed during this session: 0 human_verified rows
in the manifest; Phase 5's 25 decisions were applied directly to the
database, not back into the manifest file). This generator therefore reads
(never writes) the local rehearsal database to satisfy those two specific
gates, and documents this explicitly rather than silently reinterpreting
"never touches" to mean "never connects."

A second, real discrepancy was found and resolved by this same DB
cross-check: the manifest's source_declared_number is non-NULL (286, 83)
for the two segments (Surah 2 ordinal 286; Surah 36 ordinal 83) the project's
own governance record (PHASE5-REVIEW-DECISIONS.json, decisions phase5-001/
phase5-002) explicitly and repeatedly says must stay NULL. The live
database already reflects NULL correctly for both (confirmed during this
session -- verified against 6,239/6,239 segments, exactly these 2 differ).
Per gate 9.12's own wording ("wherever the DB HAS it NULL"), this generator
trusts the DB over the manifest for this one field, for exactly these two
rows, and refuses on any OTHER kind of source_declared_number disagreement
between manifest and DB (i.e. this is a narrow, audited, single-field
override -- not a blanket "trust the DB over the manifest").

A parallel, benign drift was also found in `extraction_source_ref` (329
rows across Surah 2 and Surah 36 -- the raw HTML `<li>` anchor position
before vs. after Phase 4's empty-`<li>` renumbering fix; content-neutral,
fully explained by PHASE4-AMENDMENTS.json). This generator prefers the DB's
extraction_source_ref (the corrected anchor) for the same reason.

Every other field (text, text_sha256, alignment_type, segment_type,
canonical join set) was independently verified byte-identical between the
manifest and the DB across all 6,239 segments / 6,396 joins before writing
this generator -- see the final report for the exact verification commands.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import kaz_prod_lib as lib  # noqa: E402


class GeneratorAbort(SystemExit):
    def __init__(self, gate: str, message: str):
        super().__init__(f"\nABORT at gate {gate}: {message}\n")


# ---------------------------------------------------------------------------
# Gate 3: raw source hash
# ---------------------------------------------------------------------------


def gate3_raw_source_hash() -> str:
    if not lib.RAW_HTML_PATH.exists():
        raise GeneratorAbort("3", f"frozen raw source file not found: {lib.RAW_HTML_PATH}")
    computed = lib.sha256_file(lib.RAW_HTML_PATH)
    if computed != lib.EXPECTED_RAW_SOURCE_SHA256:
        raise GeneratorAbort(
            "3",
            f"raw_source_sha256 mismatch: computed {computed}, expected {lib.EXPECTED_RAW_SOURCE_SHA256}",
        )
    return computed


# ---------------------------------------------------------------------------
# Manifest loading
# ---------------------------------------------------------------------------


def load_manifest() -> dict:
    if not lib.MANIFEST_PATH.exists():
        raise GeneratorAbort("0", f"manifest not found: {lib.MANIFEST_PATH}")
    with open(lib.MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    return manifest


def manifest_file_hash() -> str:
    return lib.sha256_file(lib.MANIFEST_PATH)


# ---------------------------------------------------------------------------
# Gate 4: aggregate ordered hash
# ---------------------------------------------------------------------------


def gate4_aggregate_hash(manifest: dict) -> str:
    segs_sorted = sorted(manifest["segments"], key=lambda s: (s["surah_number"], s["source_ordinal"]))
    computed = lib.aggregate_ordered_hash([s["text"] for s in segs_sorted])
    if computed != lib.EXPECTED_AGGREGATE_SEGMENT_TEXT_HASH:
        raise GeneratorAbort(
            "4",
            f"aggregate_segment_text_hash mismatch: computed {computed}, expected {lib.EXPECTED_AGGREGATE_SEGMENT_TEXT_HASH}",
        )
    if computed != manifest.get("aggregate_ordered_hash"):
        raise GeneratorAbort(
            "4",
            f"aggregate hash does not match manifest's own declared aggregate_ordered_hash "
            f"({manifest.get('aggregate_ordered_hash')}) -- manifest may be stale or tampered.",
        )
    return computed


# ---------------------------------------------------------------------------
# Gates 5-7: counts
# ---------------------------------------------------------------------------


def gate5_segment_count(manifest: dict) -> None:
    n = len(manifest["segments"])
    if n != lib.EXPECTED_SEGMENT_COUNT:
        raise GeneratorAbort("5", f"segment count {n} != expected {lib.EXPECTED_SEGMENT_COUNT}")
    if manifest.get("total_segments") != lib.EXPECTED_SEGMENT_COUNT:
        raise GeneratorAbort(
            "5", f"manifest's own declared total_segments ({manifest.get('total_segments')}) != {lib.EXPECTED_SEGMENT_COUNT}"
        )


def gate6_join_count(manifest: dict) -> int:
    n = sum(len(s["canonical_targets"]) for s in manifest["segments"])
    if n != lib.EXPECTED_JOIN_COUNT:
        raise GeneratorAbort("6", f"join count {n} != expected {lib.EXPECTED_JOIN_COUNT}")
    return n


def gate7_canonical_coverage(manifest: dict) -> None:
    covered = set()
    for s in manifest["segments"]:
        for t in s["canonical_targets"]:
            covered.add((t["surah_number"], t["ayah_number"]))
    if len(covered) != lib.EXPECTED_CANONICAL_AYAHS:
        raise GeneratorAbort(
            "7", f"canonical coverage {len(covered)}/{lib.EXPECTED_CANONICAL_AYAHS} != expected 6236/6236"
        )
    if manifest.get("total_canonical_ayahs_covered") != lib.EXPECTED_CANONICAL_AYAHS:
        raise GeneratorAbort(
            "7",
            f"manifest's own declared total_canonical_ayahs_covered "
            f"({manifest.get('total_canonical_ayahs_covered')}) != {lib.EXPECTED_CANONICAL_AYAHS}",
        )


# ---------------------------------------------------------------------------
# Gate 2: unresolved/canonical_targets consistency
# ---------------------------------------------------------------------------


def gate2_unresolved_consistency(manifest: dict) -> None:
    for s in manifest["segments"]:
        has_targets = bool(s["canonical_targets"])
        if s["alignment_type"] == "unresolved" and has_targets:
            raise GeneratorAbort(
                "2",
                f"segment {s['surah_number']}:{s['source_ordinal']} is alignment_type=unresolved "
                f"but has {len(s['canonical_targets'])} canonical_targets -- a guess slipped through.",
            )
        if s["alignment_type"] != "unresolved" and not has_targets:
            raise GeneratorAbort(
                "2",
                f"segment {s['surah_number']}:{s['source_ordinal']} is alignment_type="
                f"{s['alignment_type']} but has zero canonical_targets.",
            )


# ---------------------------------------------------------------------------
# Gate 8/9: decisions ledger
# ---------------------------------------------------------------------------


def load_decisions() -> list[dict]:
    if not lib.DECISIONS_PATH.exists():
        raise GeneratorAbort("0", f"decisions ledger not found: {lib.DECISIONS_PATH}")
    with open(lib.DECISIONS_PATH, "r", encoding="utf-8") as f:
        doc = json.load(f)
    return doc["decisions"]


def gate8_all_approve(decisions: list[dict]) -> None:
    if len(decisions) != lib.EXPECTED_DECISIONS_COUNT:
        raise GeneratorAbort("8", f"expected exactly {lib.EXPECTED_DECISIONS_COUNT} decisions, found {len(decisions)}")
    ids = [d["decision_id"] for d in decisions]
    if len(set(ids)) != len(ids):
        raise GeneratorAbort("8", "duplicate decision_id found in ledger")
    non_approve = [d["decision_id"] for d in decisions if d.get("decision") != "APPROVE"]
    if non_approve:
        raise GeneratorAbort(
            "8",
            f"one or more decisions are not APPROVE ({non_approve}) -- Phase 5 is all-or-nothing, "
            f"no partial-approval import path exists.",
        )


def parse_decision_promotions(decisions: list[dict]) -> tuple[dict, dict]:
    """Returns (segment_promotions, join_promotions).

    segment_promotions: {(surah, ordinal): decision_record} -> alignment_status='human_verified'
    join_promotions:    {(surah, ordinal, ayah): decision_record} -> mapping_confidence='human_verified'

    Derivation, per decision tier (validated against the live rehearsal DB
    during this implementation session -- see module docstring):
      - Tier 1 (phase5-001, phase5-002): `mapping_after` keys "ordinal_N" ->
        segment promotion only. Tier 1 decisions do NOT promote the join
        row's mapping_confidence (confirmed: the DB's mapping_confidence for
        these 4 joins is unchanged from its pre-Phase-5 value).
      - Tier 2 (phase5-003..010): `join_rows_updated` -> join promotion only
        (Tier 2 explicitly, textually, leaves translation_segments.
        alignment_status untouched -- see decision phase5-003's own scope).
      - Tier 3 (phase5-011..025): `segments_updated` -> segment promotion;
        `join_rows_updated` -> join promotion.
    """
    seg_promotions: dict[tuple[int, int], dict] = {}
    join_promotions: dict[tuple[int, int, int], dict] = {}

    for dec in decisions:
        did = dec["decision_id"]
        record = {
            "decision_id": did,
            "reviewer": dec["reviewer"],
            "review_date": dec["review_date"],
            "reviewer_notes": dec["reviewer_notes"],
        }
        if "tier1" in did:
            m = re.search(r"surah(\d+)", did)
            if not m:
                raise GeneratorAbort("9", f"could not parse surah number from Tier 1 decision_id {did!r}")
            surah = int(m.group(1))
            for key, after in dec["mapping_after"].items():
                om = re.search(r"ordinal_(\d+)", key)
                if not om:
                    raise GeneratorAbort("9", f"could not parse ordinal from Tier 1 mapping_after key {key!r} in {did}")
                ordinal = int(om.group(1))
                if after.get("alignment_status") != "human_verified":
                    raise GeneratorAbort("9", f"Tier 1 decision {did} key {key} does not declare alignment_status=human_verified")
                seg_promotions[(surah, ordinal)] = record
        elif "tier2" in did:
            for jr in dec["join_rows_updated"]:
                ordinal = jr["segment_ordinal"]
                ts, ta = jr["target"].split(":")
                join_promotions[(int(ts), ordinal, int(ta))] = record
        elif "tier3" in did:
            m = re.search(r"t3-s(\d+)", did)
            if not m:
                raise GeneratorAbort("9", f"could not parse surah number from Tier 3 decision_id {did!r}")
            surah = int(m.group(1))
            for su in dec["segments_updated"]:
                seg_promotions[(surah, su["source_ordinal"])] = record
            for jr in dec["join_rows_updated"]:
                ordinal = jr["segment_ordinal"]
                ts, ta = jr["target"].split(":")
                join_promotions[(int(ts), ordinal, int(ta))] = record
        else:
            raise GeneratorAbort("9", f"decision_id {did!r} does not match any known tier pattern (tier1/tier2/tier3)")

    return seg_promotions, join_promotions


def gate9_reconciliation_counts(seg_promotions: dict, join_promotions: dict) -> None:
    if len(seg_promotions) != lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS:
        raise GeneratorAbort(
            "9",
            f"decisions ledger reconciles to {len(seg_promotions)} promoted segments, "
            f"expected exactly {lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS}",
        )
    if len(join_promotions) != lib.EXPECTED_HUMAN_VERIFIED_JOINS:
        raise GeneratorAbort(
            "9",
            f"decisions ledger reconciles to {len(join_promotions)} promoted joins, "
            f"expected exactly {lib.EXPECTED_HUMAN_VERIFIED_JOINS}",
        )


def gate13_tier2_target_joins(decisions: list[dict], join_promotions: dict) -> None:
    tier2_promoted = {
        k for k, v in join_promotions.items() if "tier2" in v["decision_id"]
    }
    if len(tier2_promoted) != lib.EXPECTED_TIER2_HUMAN_VERIFIED_JOINS:
        raise GeneratorAbort(
            "13",
            f"Tier 2 decisions promote {len(tier2_promoted)} joins, expected exactly "
            f"{lib.EXPECTED_TIER2_HUMAN_VERIFIED_JOINS}",
        )
    off_target = {(s, a) for (s, _o, a) in tier2_promoted} - lib.TIER2_COMPOUND_BOUNDARY_AYAHS
    if off_target:
        raise GeneratorAbort("13", f"Tier 2 promoted joins target ayah(s) outside the 8 known compound boundaries: {off_target}")
    # Sibling-join check: for every Tier2-decision segment, any OTHER join of
    # that same segment that the decision did NOT list must remain
    # unpromoted (never silently swept up alongside the disputed one).
    tier2_segment_ordinals_by_surah: dict[tuple[int, int], set[int]] = {}
    for dec in decisions:
        if "tier2" not in dec["decision_id"]:
            continue
        for jr in dec["join_rows_updated"]:
            ts, ta = jr["target"].split(":")
            tier2_segment_ordinals_by_surah.setdefault((int(ts), jr["segment_ordinal"]), set()).add(int(ta))
    # (Concrete verification of "sibling stays untouched" happens in
    # gate15_build_final_records once the full per-join table is built --
    # see the explicit ordinal-33 -> 3:38 assertion there.)


# ---------------------------------------------------------------------------
# DB verification (read-only)
# ---------------------------------------------------------------------------


def db_human_verified_segments(db_url: str) -> set[tuple[int, int]]:
    out = lib.psql(
        db_url,
        f"SELECT surah_number, source_ordinal FROM translation_segments "
        f"WHERE source_id = (SELECT id FROM content_sources WHERE edition_identifier='{lib.PROTOTYPE_EDITION_IDENTIFIER}') "
        f"AND alignment_status='human_verified';",
    )
    result = set()
    for line in out.strip().splitlines():
        if not line.strip():
            continue
        s, o = line.split("\t")
        result.add((int(s), int(o)))
    return result


def db_human_verified_joins(db_url: str) -> set[tuple[int, int, int]]:
    out = lib.psql(
        db_url,
        f"SELECT ts.surah_number, ts.source_ordinal, tsa.ayah_number "
        f"FROM translation_segment_ayahs tsa JOIN translation_segments ts ON ts.id = tsa.segment_id "
        f"WHERE ts.source_id = (SELECT id FROM content_sources WHERE edition_identifier='{lib.PROTOTYPE_EDITION_IDENTIFIER}') "
        f"AND tsa.mapping_confidence='human_verified';",
    )
    result = set()
    for line in out.strip().splitlines():
        if not line.strip():
            continue
        s, o, a = line.split("\t")
        result.add((int(s), int(o), int(a)))
    return result


def db_segment_fields(db_url: str) -> dict[tuple[int, int], dict]:
    out = lib.psql(
        db_url,
        f"SELECT surah_number, source_ordinal, COALESCE(source_declared_number::text,''), "
        f"extraction_source_ref, alignment_type, text_sha256, segment_type "
        f"FROM translation_segments "
        f"WHERE source_id = (SELECT id FROM content_sources WHERE edition_identifier='{lib.PROTOTYPE_EDITION_IDENTIFIER}');",
    )
    result = {}
    for line in out.strip().splitlines():
        if not line.strip():
            continue
        s, o, decl, ref, atype, hsh, stype = line.split("\t")
        result[(int(s), int(o))] = {
            "source_declared_number": None if decl == "" else int(decl),
            "extraction_source_ref": ref,
            "alignment_type": atype,
            "text_sha256": hsh,
            "segment_type": stype,
        }
    return result


def db_canonical_ayahs_count(db_url: str) -> int:
    return lib.psql_int(db_url, "SELECT count(*) FROM ayahs;")


def db_valid_ayah_pairs(db_url: str) -> set[tuple[int, int]]:
    out = lib.psql(db_url, "SELECT surah_number, ayah_number FROM ayahs;")
    result = set()
    for line in out.strip().splitlines():
        if not line.strip():
            continue
        s, a = line.split("\t")
        result.add((int(s), int(a)))
    return result


def gate10_11_db_reconciliation(db_url: str, seg_promotions: dict, join_promotions: dict) -> dict:
    db_segs = db_human_verified_segments(db_url)
    if len(db_segs) != lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS:
        raise GeneratorAbort("10", f"source DB has {len(db_segs)} human_verified segments, expected {lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS}")
    ledger_keys = set(seg_promotions.keys())
    if ledger_keys != db_segs:
        raise GeneratorAbort(
            "10",
            f"decisions-ledger-derived promoted segment set does not exactly match the source DB's "
            f"human_verified segment set. Ledger-only: {sorted(ledger_keys - db_segs)[:10]}; "
            f"DB-only: {sorted(db_segs - ledger_keys)[:10]}",
        )

    db_joins = db_human_verified_joins(db_url)
    if len(db_joins) != lib.EXPECTED_HUMAN_VERIFIED_JOINS:
        raise GeneratorAbort("11", f"source DB has {len(db_joins)} human_verified joins, expected {lib.EXPECTED_HUMAN_VERIFIED_JOINS}")
    ledger_join_keys = set(join_promotions.keys())
    if ledger_join_keys != db_joins:
        raise GeneratorAbort(
            "11",
            f"decisions-ledger-derived promoted join set does not exactly match the source DB's "
            f"human_verified join set. Ledger-only: {sorted(ledger_join_keys - db_joins)[:10]}; "
            f"DB-only: {sorted(db_joins - ledger_join_keys)[:10]}",
        )
    return {"db_segs": db_segs, "db_joins": db_joins}


def gate12_declared_number_and_ref_reconciliation(
    manifest: dict, db_fields: dict[tuple[int, int], dict]
) -> dict[tuple[int, int], dict]:
    """Cross-checks manifest vs DB for source_declared_number, extraction_source_ref,
    and the immutable identity fields (text_sha256, alignment_type, segment_type).
    Returns the resolved per-segment override dict to apply on top of the manifest.

    FAIL CLOSED: any mismatch NOT in the two explicitly-known,
    already-audited categories aborts generation.
    """
    overrides: dict[tuple[int, int], dict] = {}
    unexplained: list[str] = []

    for s in manifest["segments"]:
        key = (s["surah_number"], s["source_ordinal"])
        db = db_fields.get(key)
        if db is None:
            raise GeneratorAbort("12", f"segment {key} present in manifest but not found in source DB")

        if db["text_sha256"] != s["text_sha256"]:
            unexplained.append(f"{key}: text_sha256 manifest={s['text_sha256']} db={db['text_sha256']}")
        if db["alignment_type"] != s["alignment_type"]:
            unexplained.append(f"{key}: alignment_type manifest={s['alignment_type']} db={db['alignment_type']}")
        if db["segment_type"] != s["segment_type"]:
            unexplained.append(f"{key}: segment_type manifest={s['segment_type']} db={db['segment_type']}")

        manifest_decl = s["source_declared_number"]
        db_decl = db["source_declared_number"]
        resolved_decl = manifest_decl
        if manifest_decl != db_decl:
            if db_decl is None:
                # Known, audited category: DB's NULL wins (gate 9.12).
                resolved_decl = None
                if key not in lib.KNOWN_NULL_DECLARED_NUMBER_SEGMENTS:
                    unexplained.append(
                        f"{key}: UNEXPECTED new DB-NULL source_declared_number divergence "
                        f"(manifest={manifest_decl}) not in the known/audited set {lib.KNOWN_NULL_DECLARED_NUMBER_SEGMENTS}"
                    )
            else:
                unexplained.append(f"{key}: source_declared_number manifest={manifest_decl} db={db_decl} (neither side NULL)")

        resolved_ref = db["extraction_source_ref"]  # DB's corrected anchor always preferred

        overrides[key] = {"source_declared_number": resolved_decl, "extraction_source_ref": resolved_ref}

    if unexplained:
        raise GeneratorAbort("12", "unexplained manifest/DB divergence(s):\n  " + "\n  ".join(unexplained[:20]))

    # Verify the two known-NULL segments really did resolve to NULL.
    for key in lib.KNOWN_NULL_DECLARED_NUMBER_SEGMENTS:
        if overrides.get(key, {}).get("source_declared_number") is not None:
            raise GeneratorAbort("12", f"expected {key} to resolve to source_declared_number=NULL, got {overrides.get(key)}")

    return overrides


def gate15_domain_check(value: str, domain: set[str], field: str, context: str) -> None:
    if value not in domain:
        raise GeneratorAbort("15", f"{context}: {field}={value!r} outside closed domain {sorted(domain)}")


def gate16_join_targets_resolve(joins: list[dict], valid_ayah_pairs: set[tuple[int, int]]) -> None:
    bad = [
        (j["surah_number"], j["ayah_number"])
        for j in joins
        if (j["surah_number"], j["ayah_number"]) not in valid_ayah_pairs
    ]
    if bad:
        raise GeneratorAbort("16", f"{len(bad)} join(s) target a (surah,ayah) not present in ayahs: {bad[:10]}")


def gate14_tier3_frozen_sample(final_segments_by_key: dict, final_joins_by_segment_key: dict) -> None:
    if not lib.TIER3_FROZEN_SAMPLE_PATH.exists():
        raise GeneratorAbort("14", f"frozen Tier 3 sample not found: {lib.TIER3_FROZEN_SAMPLE_PATH}")
    with open(lib.TIER3_FROZEN_SAMPLE_PATH, "r", encoding="utf-8") as f:
        sample = json.load(f)
    segs = sample["segments"]
    if len(segs) != lib.EXPECTED_TIER3_FROZEN_SAMPLE_SIZE:
        raise GeneratorAbort("14", f"frozen Tier 3 sample has {len(segs)} segments, expected {lib.EXPECTED_TIER3_FROZEN_SAMPLE_SIZE}")

    mismatches = []
    for entry in segs:
        key = (entry["surah_number"], entry["source_ordinal"])
        final = final_segments_by_key.get(key)
        if final is None:
            mismatches.append(f"{key}: not found in generated output")
            continue
        if final["text_sha256"] != entry["text_sha256"]:
            mismatches.append(f"{key}: text_sha256 differs")
        if final["alignment_type"] != entry["alignment_type"]:
            mismatches.append(f"{key}: alignment_type differs ({final['alignment_type']} vs {entry['alignment_type']})")
        if final["source_declared_number"] != entry["source_declared_number"]:
            mismatches.append(
                f"{key}: source_declared_number differs ({final['source_declared_number']} vs {entry['source_declared_number']})"
            )
        expected_targets = {(t["surah_number"], t["ayah_number"]) for t in entry["canonical_targets"]}
        actual_targets = {(j["surah_number"], j["ayah_number"]) for j in final_joins_by_segment_key.get(key, [])}
        if expected_targets != actual_targets:
            mismatches.append(f"{key}: canonical_targets differ ({actual_targets} vs {expected_targets})")

    if mismatches:
        raise GeneratorAbort("14", "Tier 3 frozen sample mismatch(es):\n  " + "\n  ".join(mismatches[:20]))


# ---------------------------------------------------------------------------
# Main build
# ---------------------------------------------------------------------------


def build_artifact(db_url: str) -> dict:
    raw_sha = gate3_raw_source_hash()
    manifest = load_manifest()
    gate5_segment_count(manifest)
    agg_hash = gate4_aggregate_hash(manifest)
    join_count_manifest = gate6_join_count(manifest)
    gate7_canonical_coverage(manifest)
    gate2_unresolved_consistency(manifest)

    for s in manifest["segments"]:
        gate15_domain_check(s["alignment_type"], lib.VALID_ALIGNMENT_TYPES, "alignment_type", f"segment {s['surah_number']}:{s['source_ordinal']}")
        gate15_domain_check(s["alignment_status"], lib.VALID_ALIGNMENT_STATUSES, "alignment_status", f"segment {s['surah_number']}:{s['source_ordinal']}")
        gate15_domain_check(s["segment_type"], lib.VALID_SEGMENT_TYPES, "segment_type", f"segment {s['surah_number']}:{s['source_ordinal']}")
        for t in s["canonical_targets"]:
            gate15_domain_check(t["mapping_confidence"], lib.VALID_MAPPING_CONFIDENCE, "mapping_confidence", f"join {s['surah_number']}:{s['source_ordinal']}->{t['surah_number']}:{t['ayah_number']}")

    decisions = load_decisions()
    gate8_all_approve(decisions)
    seg_promotions, join_promotions = parse_decision_promotions(decisions)
    gate9_reconciliation_counts(seg_promotions, join_promotions)
    gate13_tier2_target_joins(decisions, join_promotions)

    lib.assert_local_db(db_url)
    gate10_11_db_reconciliation(db_url, seg_promotions, join_promotions)
    db_fields = db_segment_fields(db_url)
    db_ayahs_count = db_canonical_ayahs_count(db_url)
    if db_ayahs_count != lib.EXPECTED_CANONICAL_AYAHS:
        raise GeneratorAbort("0", f"source DB ayahs count {db_ayahs_count} != expected {lib.EXPECTED_CANONICAL_AYAHS}")
    valid_ayah_pairs = db_valid_ayah_pairs(db_url)

    overrides = gate12_declared_number_and_ref_reconciliation(manifest, db_fields)

    # ------------------------------------------------------------------
    # Build final per-segment / per-join records (gate 17 sort order).
    # ------------------------------------------------------------------
    segs_sorted = sorted(manifest["segments"], key=lambda s: (s["surah_number"], s["source_ordinal"]))

    final_segments = []
    final_segments_by_key: dict[tuple[int, int], dict] = {}
    for s in segs_sorted:
        key = (s["surah_number"], s["source_ordinal"])
        override = overrides[key]
        promo = seg_promotions.get(key)
        record = {
            "id": str(lib.segment_id(s["surah_number"], s["source_ordinal"])),
            "surah_number": s["surah_number"],
            "segment_type": s["segment_type"],
            "source_ordinal": s["source_ordinal"],
            "source_declared_number": override["source_declared_number"],
            "text": s["text"],
            "text_sha256": s["text_sha256"],
            "extraction_source_ref": override["extraction_source_ref"],
            "alignment_type": s["alignment_type"],
            "alignment_status": "human_verified" if promo else s["alignment_status"],
            "reviewer_notes": promo["reviewer_notes"] if promo else None,
            "reviewed_by": promo["reviewer"] if promo else None,
            "reviewed_at": f"{promo['review_date']}T00:00:00+00:00" if promo else None,
        }
        final_segments.append(record)
        final_segments_by_key[key] = record

    final_joins = []
    final_joins_by_segment_key: dict[tuple[int, int], list[dict]] = {}
    for s in segs_sorted:
        surah = s["surah_number"]
        ordinal = s["source_ordinal"]
        targets_sorted = sorted(s["canonical_targets"], key=lambda t: t["ayah_number"])
        for t in targets_sorted:
            jkey = (surah, ordinal, t["ayah_number"])
            jpromo = join_promotions.get(jkey)
            jrecord = {
                "id": str(lib.join_id(surah, ordinal, t["ayah_number"])),
                "segment_id": str(lib.segment_id(surah, ordinal)),
                "segment_key": f"{surah}:{ordinal}",
                "surah_number": t["surah_number"],
                "ayah_number": t["ayah_number"],
                "mapping_confidence": "human_verified" if jpromo else t["mapping_confidence"],
                "reviewer_notes": jpromo["reviewer_notes"] if jpromo else None,
                "reviewed_by": jpromo["reviewer"] if jpromo else None,
                "reviewed_at": f"{jpromo['review_date']}T00:00:00+00:00" if jpromo else None,
            }
            final_joins.append(jrecord)
            final_joins_by_segment_key.setdefault((surah, ordinal), []).append(jrecord)

    gate16_join_targets_resolve(final_joins, valid_ayah_pairs)
    gate14_tier3_frozen_sample(final_segments_by_key, final_joins_by_segment_key)

    # Explicit sibling-join check (gate 13's second half), concretely, for
    # the worked example the design doc itself cites (decision phase5-003):
    # segment 3:33's join to 3:38 must stay untouched (mapping_confidence
    # != human_verified via this decision) while its join to 3:39 is
    # promoted.
    sib_33_to_38 = next((j for j in final_joins_by_segment_key.get((3, 33), []) if j["ayah_number"] == 38), None)
    sib_33_to_39 = next((j for j in final_joins_by_segment_key.get((3, 33), []) if j["ayah_number"] == 39), None)
    if sib_33_to_38 is None or sib_33_to_39 is None:
        raise GeneratorAbort("13", "expected worked example joins (3:33->3:38, 3:33->3:39) not found in generated output")
    if sib_33_to_38["mapping_confidence"] == "human_verified":
        raise GeneratorAbort("13", "sibling join 3:33->3:38 was incorrectly promoted to human_verified (out of Tier 2 scope)")
    if sib_33_to_39["mapping_confidence"] != "human_verified":
        raise GeneratorAbort("13", "in-scope Tier 2 join 3:33->3:39 was NOT promoted to human_verified")

    # Two known-NULL segments must be NULL in the final output too.
    for key in lib.KNOWN_NULL_DECLARED_NUMBER_SEGMENTS:
        if final_segments_by_key[key]["source_declared_number"] is not None:
            raise GeneratorAbort("12", f"final output has non-NULL source_declared_number for known-NULL segment {key}")

    if len(final_segments) != lib.EXPECTED_SEGMENT_COUNT:
        raise GeneratorAbort("5", f"final segment count {len(final_segments)} != {lib.EXPECTED_SEGMENT_COUNT}")
    if len(final_joins) != lib.EXPECTED_JOIN_COUNT:
        raise GeneratorAbort("6", f"final join count {len(final_joins)} != {lib.EXPECTED_JOIN_COUNT}")

    hv_segments_final = sum(1 for s in final_segments if s["alignment_status"] == "human_verified")
    hv_joins_final = sum(1 for j in final_joins if j["mapping_confidence"] == "human_verified")
    if hv_segments_final != lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS:
        raise GeneratorAbort("9", f"final output has {hv_segments_final} human_verified segments, expected {lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS}")
    if hv_joins_final != lib.EXPECTED_HUMAN_VERIFIED_JOINS:
        raise GeneratorAbort("9", f"final output has {hv_joins_final} human_verified joins, expected {lib.EXPECTED_HUMAN_VERIFIED_JOINS}")

    content_source = {
        "id": str(lib.content_source_id()),
        "content_type": "translation",
        "provider_name": "Wikisource (fr.wikisource.org)",
        "dataset_name": "Le Koran (traduction de Kazimirski)",
        "edition_identifier": lib.EDITION_IDENTIFIER,
        "language": "fr",
        "translator": "Albin de Kazimirski Biberstein",
        "version": "Charpentier, Paris, 1869 printing (translation first published 1840)",
        "license_name": "Public domain",
        "license_url": None,
        "attribution_required": True,
        "modification_restricted": False,
        "source_url": "https://fr.wikisource.org/wiki/Le_Koran_(Traduction_de_Kazimirski)/Texte_entier",
        "retrieved_at": "2026-09-01T14:50:33.734994+00:00",
        "public_domain": True,
        "legacy_interim": False,
        "verification_status": "candidate",
    }

    artifact_core = {
        "schema_version": lib.SCHEMA_VERSION,
        "generator_version": lib.GENERATOR_VERSION,
        "raw_source_sha256": raw_sha,
        "aggregate_segment_text_hash": agg_hash,
        "manifest_hash": manifest_file_hash(),
        "source_segment_count": len(final_segments),
        "join_count": len(final_joins),
        "canonical_coverage": f"{lib.EXPECTED_CANONICAL_AYAHS}/{lib.EXPECTED_CANONICAL_AYAHS}",
        "provenance_reference": "scripts/quran-import/kazimirski/ (Phase 1-5), PHASE5-REVIEW-DECISIONS.json (25 decisions)",
        "review_reconciliation": {
            "decisions_count": len(decisions),
            "human_verified_segments": hv_segments_final,
            "human_verified_joins": hv_joins_final,
            "tier2_human_verified_joins": lib.EXPECTED_TIER2_HUMAN_VERIFIED_JOINS,
        },
        "id_strategy": {
            "deviation_from_design_section": "§11 (design recommended fresh gen_random_uuid() at import time; this project overrides with deterministic UUIDv5, see kaz_prod_lib.py module docstring)",
            "namespace_uuid": str(lib.KAZIMIRSKI_UUID_NAMESPACE),
            "segment_id_formula": "uuid5(namespace, f'segment:{edition_identifier}:{surah_number}:{source_ordinal}')",
            "join_id_formula": "uuid5(namespace, f'join:{edition_identifier}:{surah_number}:{source_ordinal}:{ayah_number}')",
            "content_source_id_formula": "uuid5(namespace, f'source:{edition_identifier}')",
        },
        "content_source": content_source,
        "segments": final_segments,
        "joins": final_joins,
    }
    return artifact_core


def canonical_payload_bytes(artifact_core: dict) -> bytes:
    return json.dumps(artifact_core, sort_keys=True, ensure_ascii=False).encode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db-url", default=lib.DEFAULT_DB_URL)
    parser.add_argument("--out", default=str(lib.ARTIFACT_PATH))
    parser.add_argument(
        "--no-write", action="store_true", help="run all gates and print the canonical payload hash, but do not write the artifact file"
    )
    args = parser.parse_args()

    try:
        artifact_core = build_artifact(args.db_url)
    except GeneratorAbort:
        raise
    except Exception as exc:  # noqa: BLE001
        raise GeneratorAbort("UNEXPECTED", f"{type(exc).__name__}: {exc}") from exc

    payload_bytes = canonical_payload_bytes(artifact_core)
    canonical_payload_sha256 = lib.sha256_text(payload_bytes.decode("utf-8"))

    from datetime import datetime, timezone

    generated_at = datetime.now(timezone.utc).isoformat()

    full_artifact = dict(artifact_core)
    full_artifact["canonical_payload_sha256"] = canonical_payload_sha256
    full_artifact["generated_at"] = generated_at

    print(f"All 17 gates PASSED.")
    print(f"  segments: {artifact_core['source_segment_count']}")
    print(f"  joins: {artifact_core['join_count']}")
    print(f"  canonical_coverage: {artifact_core['canonical_coverage']}")
    print(f"  human_verified_segments: {artifact_core['review_reconciliation']['human_verified_segments']}")
    print(f"  human_verified_joins: {artifact_core['review_reconciliation']['human_verified_joins']}")
    print(f"  canonical_payload_sha256: {canonical_payload_sha256}")

    if args.no_write:
        return

    lib.GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = Path(args.out)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(full_artifact, f, indent=2, ensure_ascii=False, sort_keys=False)
        f.write("\n")
    print(f"Wrote {out_path}")
    print(f"Full-file SHA256: {lib.sha256_file(out_path)}")


if __name__ == "__main__":
    main()

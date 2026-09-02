#!/usr/bin/env python3
"""
Kazimirski French translation — Phase 3 LOCAL PROTOTYPE importer.

Implements the 7-stage design of PHASE2-MAPPING-ARCHITECTURE.md §8, with
every abort condition from that section's table implemented as a real,
executed check that halts the run — no repair/fallback branch anywhere.

SAFETY (non-negotiable, enforced in code, not just by convention):
  - Refuses to run against any DB_URL host other than 127.0.0.1/localhost.
  - Never runs `supabase db push` or anything --linked; talks to Postgres
    only via plain `psql` subprocess calls against the local instance.
  - Never writes canonical Arabic (ayahs.arabic_text) or touches Pickthall
    rows -- this script INSERTs only into translation_segments,
    translation_segment_ayahs, and (idempotently, if missing) one
    content_sources row for Kazimirski's segment-based edition.
  - Never marks any alignment_status='human_verified' -- that value never
    appears anywhere in this script; the manifest itself never produces it
    either (see generate_manifest.py).
  - Never writes a canonical_targets guess for the 2 unresolved segments --
    enforced structurally: this script inserts translation_segment_ayahs
    rows exactly and only from the manifest's own canonical_targets arrays,
    and a segment with alignment_type='unresolved' + alignment_status=
    'unresolved' whose manifest entry has any canonical_targets at all is
    itself an abort condition (stage 4), not something silently accepted.

Usage:
  python3 import_kazimirski.py [--manifest PATH] [--db-url URL]
                                [--dry-run]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import unicodedata
import uuid
from pathlib import Path

HERE = Path(__file__).parent
KAZ_DIR = HERE.parent
sys.path.insert(0, str(KAZ_DIR))

from kazimirski_html_extract import extract_all_segments, aggregate_ordered_hash  # noqa: E402

DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DEFAULT_MANIFEST = KAZ_DIR / "kazimirski_alignment_manifest.json"
DEFAULT_HTML = KAZ_DIR / "texte_entier_raw.html"

VALID_ALIGNMENT_TYPES = {
    "direct", "offset", "one_to_many", "many_to_one", "compound", "unresolved", "source_anomaly",
}
VALID_ALIGNMENT_STATUSES = {
    "auto_verified", "cross_verified", "human_verified", "unresolved", "rejected",
}
VALID_MAPPING_CONFIDENCE = {"auto", "cross_verified", "human_verified", "needs_review"}

# The importer must NEVER be capable of writing alignment_status =
# 'human_verified' by itself -- this local prototype's manifest generator
# never produces it, and this constant documents the invariant explicitly
# so a future edit can grep for it.
FORBIDDEN_SELF_ASSIGNED_STATUS = "human_verified"


class ImportAbort(SystemExit):
    def __init__(self, stage: str, message: str):
        super().__init__(f"\nABORT at stage {stage}: {message}\n")


def assert_local_db(db_url: str) -> None:
    if not any(h in db_url for h in ("127.0.0.1", "localhost")):
        raise ImportAbort("0-SAFETY", f"refusing to run against non-local DB_URL: {db_url!r}")
    if "--linked" in db_url:
        raise ImportAbort("0-SAFETY", "refusing: --linked must never appear anywhere near this script")


def psql(db_url: str, sql: str, tuples_only: bool = True) -> str:
    args = ["psql", db_url, "-v", "ON_ERROR_STOP=1"]
    if tuples_only:
        args += ["-t", "-A", "-F", "\t"]
    args += ["-c", sql]
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise ImportAbort("DB", f"psql command failed: {result.stderr.strip()}")
    return result.stdout


def psql_file(db_url: str, sql_path: Path) -> None:
    args = ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-f", str(sql_path)]
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise ImportAbort("WRITE", f"psql -f failed (transaction rolled back):\n{result.stdout}\n{result.stderr}")


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    s = str(value).replace("\\", "\\\\").replace("'", "''")
    return f"'{s}'"


def sql_uuid_array(uuids: list[str]) -> str:
    if not uuids:
        return "ARRAY[]::uuid[]"
    items = ", ".join(sql_literal(u) for u in uuids)
    return f"ARRAY[{items}]::uuid[]"


# ---------------------------------------------------------------------------
# Stages 1-4: pure validation, no DB writes.
# ---------------------------------------------------------------------------

def stage1_parse(html_path: Path) -> tuple[list, str, str]:
    """Fresh, independent re-parse of the frozen raw artifact."""
    segments, html_text, sha256_hex = extract_all_segments(html_path)
    if len(segments) != 6240:
        raise ImportAbort("1-PARSE", f"expected 6240 physical segments, fresh parse found {len(segments)}")
    surahs = {s.surah_number for s in segments}
    if surahs != set(range(1, 115)):
        raise ImportAbort("1-PARSE", f"expected 114 surahs 1..114, found {sorted(surahs)}")
    return segments, html_text, sha256_hex


def stage2_validate_counts_order(fresh_segments: list, manifest: dict) -> None:
    """Per surah: extracted segment count must equal manifest's declared
    count for that surah PLUS any explicitly-declared excluded-empty
    positions for that surah (mw-empty-elt source anomaly, see
    generate_manifest.py / NORMALIZATION-REPORT.md); source_ordinal gapless
    across the union of the two; no duplicates."""
    fresh_by_surah: dict[int, list[int]] = {}
    for s in fresh_segments:
        fresh_by_surah.setdefault(s.surah_number, []).append(s.source_ordinal)

    manifest_numbered_by_surah: dict[int, list[int]] = {}
    for seg in manifest["segments"]:
        if seg["segment_type"] != "numbered":
            continue
        manifest_numbered_by_surah.setdefault(seg["surah_number"], []).append(seg["source_ordinal"])

    excluded_by_surah: dict[int, list[int]] = {}
    for ex in manifest.get("excluded_empty_source_segments", []):
        excluded_by_surah.setdefault(ex["surah_number"], []).append(ex["source_ordinal"])

    for surah in range(1, 115):
        fresh_ordinals = sorted(fresh_by_surah.get(surah, []))
        manifest_ordinals = sorted(manifest_numbered_by_surah.get(surah, []))
        excluded_ordinals = sorted(excluded_by_surah.get(surah, []))
        combined_ordinals = sorted(manifest_ordinals + excluded_ordinals)

        if len(fresh_ordinals) != len(set(fresh_ordinals)):
            raise ImportAbort("2-COUNTS", f"surah {surah}: duplicate source_ordinal in fresh extraction")
        if fresh_ordinals != list(range(1, len(fresh_ordinals) + 1)):
            raise ImportAbort("2-COUNTS", f"surah {surah}: fresh source_ordinal not gapless 1..N: {fresh_ordinals[:5]}...")
        if fresh_ordinals != combined_ordinals:
            raise ImportAbort(
                "2-COUNTS",
                f"surah {surah}: extracted segment count/order {len(fresh_ordinals)} != manifest's "
                f"declared {len(manifest_ordinals)} + excluded-empty {len(excluded_ordinals)} "
                f"(unexpected source count)",
            )


def stage3_load_manifest_verify_hash(manifest_path: Path, fresh_sha256: str) -> dict:
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    if manifest.get("source_artifact_sha256") != fresh_sha256:
        raise ImportAbort(
            "3-MANIFEST",
            f"manifest's source_artifact_sha256 ({manifest.get('source_artifact_sha256')}) != "
            f"freshly computed hash ({fresh_sha256}) -- raw artifact changed since manifest review",
        )
    required_top = {"source_artifact_sha256", "aggregate_ordered_hash", "total_segments",
                     "total_canonical_ayahs_covered", "segments"}
    missing = required_top - set(manifest.keys())
    if missing:
        raise ImportAbort("3-MANIFEST", f"manifest missing required top-level keys: {missing}")
    return manifest


def stage4_validate_mappings(fresh_segments: list, manifest: dict, valid_ayahs: set[tuple[int, int]]) -> None:
    fresh_by_key = {(s.surah_number, s.source_ordinal): s.text for s in fresh_segments}

    seen_manifest_keys = set()
    for seg in manifest["segments"]:
        key = (seg["surah_number"], seg["source_ordinal"])
        if key in seen_manifest_keys:
            raise ImportAbort("4-MAPPINGS", f"duplicate manifest entry for {key}")
        seen_manifest_keys.add(key)

        if seg["alignment_type"] not in VALID_ALIGNMENT_TYPES:
            raise ImportAbort("4-MAPPINGS", f"{key}: invalid alignment_type {seg['alignment_type']!r}")
        if seg["alignment_status"] not in VALID_ALIGNMENT_STATUSES:
            raise ImportAbort("4-MAPPINGS", f"{key}: invalid alignment_status {seg['alignment_status']!r}")
        if seg["alignment_status"] == FORBIDDEN_SELF_ASSIGNED_STATUS:
            raise ImportAbort(
                "4-MAPPINGS",
                f"{key}: manifest declares alignment_status='human_verified' -- this importer must "
                f"NEVER write that status; a human must set it directly on an already-imported row",
            )

        # text_sha256 must match recomputed hash of the manifest's own text.
        recomputed = hashlib.sha256(seg["text"].encode("utf-8")).hexdigest()
        if recomputed != seg["text_sha256"]:
            raise ImportAbort("4-MAPPINGS", f"{key}: manifest text_sha256 does not match recomputed hash of its own text")

        if not seg["text"].strip():
            raise ImportAbort("4-MAPPINGS", f"{key}: empty text")

        # missing source segment: every numbered manifest segment must exist
        # in the fresh extraction, with matching text_sha256 (lost source
        # text / accidental normalization guard).
        if seg["segment_type"] == "numbered":
            if key not in fresh_by_key:
                raise ImportAbort("4-MAPPINGS", f"{key}: manifest references a segment the fresh extraction doesn't have")
            fresh_text = fresh_by_key[key]
            fresh_hash = hashlib.sha256(fresh_text.encode("utf-8")).hexdigest()
            if fresh_hash != seg["text_sha256"]:
                raise ImportAbort(
                    "4-MAPPINGS",
                    f"{key}: text_sha256 mismatch between manifest and fresh re-extraction "
                    f"(lost source text or accidental normalization)",
                )
        elif seg["segment_type"] == "unnumbered_preamble":
            if seg["surah_number"] != 1 or seg["source_ordinal"] != 0:
                raise ImportAbort("4-MAPPINGS", f"{key}: unexpected unnumbered_preamble location")
        else:
            raise ImportAbort("4-MAPPINGS", f"{key}: invalid segment_type {seg['segment_type']!r}")

        # canonical targets: must reference real (surah, ayah); cardinality
        # rules per alignment_type; unresolved must have zero targets, ever.
        targets = seg["canonical_targets"]
        for t in targets:
            tk = (t["surah_number"], t["ayah_number"])
            if tk not in valid_ayahs:
                raise ImportAbort("4-MAPPINGS", f"{key}: canonical target {tk} does not exist in ayahs table")
            if t["mapping_confidence"] not in VALID_MAPPING_CONFIDENCE:
                raise ImportAbort("4-MAPPINGS", f"{key}: invalid mapping_confidence {t['mapping_confidence']!r}")
            if t["mapping_confidence"] == FORBIDDEN_SELF_ASSIGNED_STATUS:
                raise ImportAbort("4-MAPPINGS", f"{key}: join row mapping_confidence must never be human_verified from this importer")

        if seg["alignment_type"] == "unresolved":
            if len(targets) != 0:
                raise ImportAbort(
                    "4-MAPPINGS",
                    f"{key}: alignment_type=unresolved but manifest declares {len(targets)} canonical_targets "
                    f"-- a guessed target for an unresolved segment is never permitted",
                )
        elif seg["alignment_type"] in ("direct", "offset", "source_anomaly"):
            if len(targets) != 1:
                raise ImportAbort("4-MAPPINGS", f"{key}: alignment_type={seg['alignment_type']} must have exactly 1 target, found {len(targets)}")
        elif seg["alignment_type"] == "one_to_many":
            if len(targets) < 2:
                raise ImportAbort("4-MAPPINGS", f"{key}: alignment_type=one_to_many must have >=2 targets, found {len(targets)}")
        elif seg["alignment_type"] in ("many_to_one",):
            if len(targets) != 1:
                raise ImportAbort("4-MAPPINGS", f"{key}: alignment_type=many_to_one must have exactly 1 target (the shared ayah), found {len(targets)}")
        elif seg["alignment_type"] == "compound":
            if len(targets) < 1:
                raise ImportAbort("4-MAPPINGS", f"{key}: alignment_type=compound must have >=1 target, found {len(targets)}")

    # Validate the documented excluded-empty-source-segment list (the
    # mw-empty-elt anomaly, see generate_manifest.py / NORMALIZATION-REPORT.md):
    # each must genuinely be empty in the fresh extraction (re-verify, don't
    # trust the manifest's own claim), must not appear in `segments`, and
    # must not be silently un-covering an ayah some OTHER segment already
    # covers (checked at stage 7 via the coverage-count reconciliation).
    excluded_keys = set()
    for ex in manifest.get("excluded_empty_source_segments", []):
        ekey = (ex["surah_number"], ex["source_ordinal"])
        if ekey in seen_manifest_keys:
            raise ImportAbort("4-MAPPINGS", f"{ekey}: listed as both an excluded-empty segment AND a normal segment")
        if ekey not in fresh_by_key:
            raise ImportAbort("4-MAPPINGS", f"{ekey}: excluded-empty segment not found in fresh extraction at all")
        if fresh_by_key[ekey].strip():
            raise ImportAbort(
                "4-MAPPINGS",
                f"{ekey}: manifest claims this is an empty-source anomaly but fresh re-extraction found "
                f"non-empty text -- this would be silently dropping real content, refusing",
            )
        excluded_keys.add(ekey)

    # every physical fresh segment must have a manifest entry OR be a
    # documented excluded-empty segment -- no segment silently absent.
    for fkey in fresh_by_key:
        if fkey not in seen_manifest_keys and fkey not in excluded_keys:
            raise ImportAbort("4-MAPPINGS", f"fresh-extracted segment {fkey} has no manifest entry and is not a documented exclusion")

    if manifest["total_segments"] != len(manifest["segments"]):
        raise ImportAbort("4-MAPPINGS", "manifest's declared total_segments != actual segments array length")
    if len(manifest["segments"]) + len(manifest.get("excluded_empty_source_segments", [])) != 6241:
        raise ImportAbort("4-MAPPINGS", "segments + excluded_empty_source_segments != 6241 (1 Fatiha + 6240 CSV-derived)")


def fetch_valid_ayahs(db_url: str) -> set[tuple[int, int]]:
    out = psql(db_url, "SELECT surah_number, ayah_number FROM ayahs;")
    valid = set()
    for line in out.splitlines():
        if not line.strip():
            continue
        s, a = line.split("\t")
        valid.add((int(s), int(a)))
    if len(valid) != 6236:
        raise ImportAbort("4-MAPPINGS", f"expected 6236 rows in ayahs table, found {len(valid)}")
    return valid


# ---------------------------------------------------------------------------
# Content source registration (idempotent, additive only)
# ---------------------------------------------------------------------------

KAZIMIRSKI_SEGMENTS_EDITION_ID = "kazimirski-1869-segments-phase3"


def resolve_content_source_id(db_url: str, dry_run: bool) -> str:
    existing = psql(
        db_url,
        f"SELECT id FROM content_sources WHERE edition_identifier = {sql_literal(KAZIMIRSKI_SEGMENTS_EDITION_ID)};",
    ).strip()
    if existing:
        print(f"content_sources row already exists: {existing} (reusing, not modifying)")
        return existing

    new_id = str(uuid.uuid4())
    notes = (
        "Phase 3 segment-based Kazimirski FR source (translation_segments + "
        "translation_segment_ayahs), distinct from the pre-existing legacy_interim "
        "flat-table candidate row (edition_identifier='kazimirski-1869') left "
        "untouched by this import. Provenance per PHASE1-ALIGNMENT-AUDIT.md §1: "
        "Charpentier 1869 printing, Wikisource Avancement=V, Harvard/Google Books "
        "scan 3XSe413MJyQC, public domain (translator died 1887). Source artifact "
        "texte_entier_raw.html SHA-256: "
        "38f94de9e95b8163949d68e69c150ae14343f8799006b58c1fc44fc17f9d0b92. "
        "LOCAL PROTOTYPE ONLY -- verification_status='candidate', not reviewed for "
        "production; alignment mapping data has 2 genuinely unresolved segments "
        "(Surah 2 ordinal 287, Surah 36 ordinal 84) with zero canonical targets, "
        "2 further genuinely uncovered ayahs (2:8, 36:35) caused by empty "
        "<li class=\"mw-empty-elt\"> source anomalies (excluded from import entirely, "
        "no segment/join row exists for them -- see NORMALIZATION-REPORT.md), and "
        "~17 compound-boundary join rows flagged needs_review pending human "
        "sign-off. Local canonical coverage: 6234/6236. See "
        "scripts/quran-import/kazimirski/PHASE1-ALIGNMENT-AUDIT.md and "
        "PHASE2-MAPPING-ARCHITECTURE.md for full governance record."
    )
    insert_sql = f"""
INSERT INTO content_sources (
  id, content_type, provider_name, dataset_name, edition_identifier, language,
  translator, version, license_name, license_url, attribution_required,
  modification_restricted, source_url, retrieved_at, public_domain,
  legacy_interim, verification_status, notes
) VALUES (
  {sql_literal(new_id)}, 'translation', 'Wikisource (Wikimedia)', 'Le Koran',
  {sql_literal(KAZIMIRSKI_SEGMENTS_EDITION_ID)}, 'fr',
  'Albin de Kazimirski (Biberstein)', 'Librairie Charpentier, 1869 edition (segment-mapped)',
  'Public Domain', NULL, false, false,
  'https://fr.wikisource.org/wiki/Le_Koran_(Traduction_de_Kazimirski)/Texte_entier',
  now(), true, false, 'candidate', {sql_literal(notes)}
);
"""
    if dry_run:
        print("[dry-run] would insert content_sources row:")
        print(insert_sql)
        return new_id

    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as f:
        f.write("BEGIN;\n" + insert_sql + "\nCOMMIT;\n")
        path = Path(f.name)
    try:
        psql_file(db_url, path)
    finally:
        path.unlink(missing_ok=True)
    print(f"created content_sources row: {new_id}")
    return new_id


# ---------------------------------------------------------------------------
# Stages 5-6: write, inside one transaction with stage-7 checks embedded as
# RAISE EXCEPTION postconditions, so a stage-7 failure rolls back atomically.
# ---------------------------------------------------------------------------

def build_write_sql(manifest: dict, source_id: str) -> tuple[str, dict]:
    segment_uuids: dict[tuple[int, int], str] = {}
    seg_rows = []
    join_rows = []

    for seg in manifest["segments"]:
        key = (seg["surah_number"], seg["source_ordinal"])
        seg_id = str(uuid.uuid4())
        segment_uuids[key] = seg_id
        seg_rows.append(
            "(" + ", ".join([
                sql_literal(seg_id),
                sql_literal(source_id),
                sql_literal(seg["surah_number"]),
                sql_literal(seg["segment_type"]),
                sql_literal(seg["source_ordinal"]),
                sql_literal(seg["source_declared_number"]),
                sql_literal(seg["text"]),
                sql_literal(seg["text_sha256"]),
                sql_literal(seg["extraction_source_ref"]),
                sql_literal(seg["alignment_type"]),
                sql_literal(seg["alignment_status"]),
                sql_literal(seg.get("reviewer_notes")),
            ]) + ")"
        )
        for t in seg["canonical_targets"]:
            join_rows.append(
                "(" + ", ".join([
                    sql_literal(str(uuid.uuid4())),
                    sql_literal(seg_id),
                    sql_literal(t["surah_number"]),
                    sql_literal(t["ayah_number"]),
                    sql_literal(t["mapping_confidence"]),
                ]) + ")"
            )

    def chunked(rows, size=400):
        for i in range(0, len(rows), size):
            yield rows[i:i + size]

    sql_parts = ["BEGIN;\n"]
    for chunk in chunked(seg_rows):
        sql_parts.append(
            "INSERT INTO translation_segments (id, source_id, surah_number, segment_type, "
            "source_ordinal, source_declared_number, text, text_sha256, extraction_source_ref, "
            "alignment_type, alignment_status, reviewer_notes) VALUES\n"
            + ",\n".join(chunk) + ";\n"
        )
    for chunk in chunked(join_rows):
        sql_parts.append(
            "INSERT INTO translation_segment_ayahs (id, segment_id, surah_number, ayah_number, "
            "mapping_confidence) VALUES\n"
            + ",\n".join(chunk) + ";\n"
        )

    # Stage 7 postcondition checks, as hard RAISE EXCEPTION gates inside the
    # same transaction -- any failure rolls back the whole import atomically.
    expected_total_segments = len(manifest["segments"])
    expected_total_joins = sum(len(s["canonical_targets"]) for s in manifest["segments"])
    expected_coverage = manifest["total_canonical_ayahs_covered"]
    expected_agg_hash = manifest["aggregate_ordered_hash"]

    sql_parts.append(f"""
DO $$
DECLARE
  seg_count integer;
  join_count integer;
  coverage_count integer;
  orphan_joins integer;
  cardinality_violations integer;
BEGIN
  SELECT count(*) INTO seg_count FROM translation_segments WHERE source_id = {sql_literal(source_id)};
  IF seg_count <> {expected_total_segments} THEN
    RAISE EXCEPTION 'STAGE7 FAIL: segment count % != manifest total %', seg_count, {expected_total_segments};
  END IF;

  SELECT count(*) INTO join_count FROM translation_segment_ayahs tsa
    JOIN translation_segments ts ON ts.id = tsa.segment_id
    WHERE ts.source_id = {sql_literal(source_id)};
  IF join_count <> {expected_total_joins} THEN
    RAISE EXCEPTION 'STAGE7 FAIL: join row count % != manifest total %', join_count, {expected_total_joins};
  END IF;

  SELECT count(DISTINCT (tsa.surah_number, tsa.ayah_number)) INTO coverage_count
    FROM translation_segment_ayahs tsa
    JOIN translation_segments ts ON ts.id = tsa.segment_id
    WHERE ts.source_id = {sql_literal(source_id)};
  IF coverage_count <> {expected_coverage} THEN
    RAISE EXCEPTION 'STAGE7 FAIL: canonical coverage % != manifest declared %', coverage_count, {expected_coverage};
  END IF;

  SELECT count(*) INTO orphan_joins FROM translation_segment_ayahs tsa
    WHERE NOT EXISTS (SELECT 1 FROM translation_segments ts WHERE ts.id = tsa.segment_id);
  IF orphan_joins <> 0 THEN
    RAISE EXCEPTION 'STAGE7 FAIL: % orphaned join rows found', orphan_joins;
  END IF;

  SELECT count(*) INTO cardinality_violations FROM (
    SELECT ts.id FROM translation_segments ts
    LEFT JOIN translation_segment_ayahs tsa ON tsa.segment_id = ts.id
    WHERE ts.source_id = {sql_literal(source_id)}
    GROUP BY ts.id, ts.alignment_type
    HAVING
      (ts.alignment_type IN ('direct','offset','source_anomaly') AND count(tsa.id) <> 1)
      OR (ts.alignment_type = 'unresolved' AND count(tsa.id) <> 0)
      OR (ts.alignment_type = 'one_to_many' AND count(tsa.id) < 2)
      OR (ts.alignment_type = 'many_to_one' AND count(tsa.id) <> 1)
  ) v;
  IF cardinality_violations <> 0 THEN
    RAISE EXCEPTION 'STAGE7 FAIL: % segments have a mapping cardinality mismatch', cardinality_violations;
  END IF;
END $$;
""")

    sql_parts.append("\nCOMMIT;\n")
    return "".join(sql_parts), segment_uuids


def stage7_post_commit_report(db_url: str, source_id: str, manifest: dict) -> dict:
    """Read-only report queries, run AFTER commit, independent of the
    in-transaction DO-block checks -- defense in depth, and produces the
    numbers the task's step 5 gate requires."""
    seg_count = int(psql(db_url, f"SELECT count(*) FROM translation_segments WHERE source_id = {sql_literal(source_id)};").strip())
    join_count = int(psql(
        db_url,
        f"SELECT count(*) FROM translation_segment_ayahs tsa JOIN translation_segments ts ON ts.id=tsa.segment_id "
        f"WHERE ts.source_id = {sql_literal(source_id)};",
    ).strip())
    unresolved_count = int(psql(
        db_url,
        f"SELECT count(*) FROM translation_segments WHERE source_id = {sql_literal(source_id)} AND alignment_status='unresolved';",
    ).strip())
    coverage = int(psql(
        db_url,
        f"SELECT count(DISTINCT (tsa.surah_number, tsa.ayah_number)) FROM translation_segment_ayahs tsa "
        f"JOIN translation_segments ts ON ts.id=tsa.segment_id WHERE ts.source_id = {sql_literal(source_id)};",
    ).strip())
    by_type_raw = psql(
        db_url,
        f"SELECT alignment_type, count(*) FROM translation_segments WHERE source_id = {sql_literal(source_id)} "
        f"GROUP BY alignment_type ORDER BY alignment_type;",
    )
    by_type = {}
    for line in by_type_raw.splitlines():
        if not line.strip():
            continue
        t, c = line.split("\t")
        by_type[t] = int(c)

    rows_raw = psql(
        db_url,
        f"SELECT surah_number, source_ordinal, text FROM translation_segments WHERE source_id = {sql_literal(source_id)} "
        f"ORDER BY surah_number, source_ordinal;",
        tuples_only=False,
    )
    # For the aggregate hash we need exact text with tabs/newlines intact;
    # tuples_only text output is fragile for that, so fetch via COPY instead.
    return {
        "segments_inserted": seg_count,
        "join_rows": join_count,
        "unresolved_segments": unresolved_count,
        "canonical_coverage": coverage,
        "by_alignment_type": by_type,
    }


def recompute_db_aggregate_hash(db_url: str, source_id: str) -> str:
    """Computes the aggregate ordered hash entirely inside Postgres (via
    pgcrypto's digest()), avoiding any client-side COPY/text re-escaping
    pitfalls: string_agg with the exact \\x1e delimiter, in
    (surah_number, source_ordinal) order, sha256'd, hex-encoded -- the same
    definition as kazimirski_html_extract.aggregate_ordered_hash()."""
    sql = (
        "SELECT encode(digest("
        "  (SELECT string_agg(text, E'\\x1e' ORDER BY surah_number, source_ordinal) "
        f"   FROM translation_segments WHERE source_id = {sql_literal(source_id)}),"
        "  'sha256'), 'hex');"
    )
    out = psql(db_url, sql).strip()
    if not out:
        raise ImportAbort("7-VERIFY", "aggregate hash recompute returned empty result")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--html", type=Path, default=DEFAULT_HTML)
    ap.add_argument("--db-url", default=DEFAULT_DB_URL)
    ap.add_argument("--dry-run", action="store_true", help="validate only, no DB writes")
    args = ap.parse_args()

    assert_local_db(args.db_url)

    print("=== Stage 1: PARSE (fresh, independent re-extraction) ===")
    fresh_segments, html_text, fresh_sha256 = stage1_parse(args.html)
    print(f"  {len(fresh_segments)} segments, sha256={fresh_sha256}")

    print("=== Stage 3: LOAD MANIFEST + verify artifact hash ===")
    manifest = stage3_load_manifest_verify_hash(args.manifest, fresh_sha256)
    print(f"  manifest total_segments={manifest['total_segments']}")

    print("=== Stage 2: VALIDATE SOURCE COUNTS/ORDER ===")
    stage2_validate_counts_order(fresh_segments, manifest)
    print("  OK: per-surah counts/order match")

    print("=== Stage 4: VALIDATE MAPPINGS ===")
    valid_ayahs = fetch_valid_ayahs(args.db_url)
    stage4_validate_mappings(fresh_segments, manifest, valid_ayahs)
    print("  OK: all mappings validated")

    if args.dry_run:
        print("\n--dry-run: stopping before any DB write.")
        return

    print("=== Resolve content_sources row ===")
    source_id = resolve_content_source_id(args.db_url, dry_run=False)

    existing_segs = int(psql(args.db_url, f"SELECT count(*) FROM translation_segments WHERE source_id = {sql_literal(source_id)};").strip())
    if existing_segs > 0:
        raise ImportAbort(
            "5-WRITE",
            f"{existing_segs} translation_segments rows already exist for source_id={source_id} -- "
            f"this importer never upserts/repairs; truncate deliberately first if you intend to re-import",
        )

    print("=== Stages 5-6: WRITE SEGMENTS + JOINS (one transaction, stage-7 checks as postconditions) ===")
    sql_text, segment_uuids = build_write_sql(manifest, source_id)
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as f:
        f.write(sql_text)
        sql_path = Path(f.name)
    try:
        psql_file(args.db_url, sql_path)
    finally:
        sql_path.unlink(missing_ok=True)
    print("  committed.")

    print("=== Stage 7: INTEGRITY VERIFICATION (post-commit, read-only, independent of in-tx checks) ===")
    report = stage7_post_commit_report(args.db_url, source_id, manifest)
    db_agg_hash = recompute_db_aggregate_hash(args.db_url, source_id)
    if db_agg_hash != manifest["aggregate_ordered_hash"]:
        raise ImportAbort(
            "7-VERIFY",
            f"post-commit aggregate hash {db_agg_hash} != manifest's {manifest['aggregate_ordered_hash']}",
        )
    report["aggregate_hash_match"] = True
    report["source_id"] = source_id

    print(json.dumps(report, indent=2))
    print("\nIMPORT SUCCEEDED.")


if __name__ == "__main__":
    main()

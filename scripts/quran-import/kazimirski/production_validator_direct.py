#!/usr/bin/env python3
"""
Kazimirski PRODUCTION validator -- direct Postgres connection port.

validate_kazimirski_import.py's own validate() is NOT modified and is NOT
callable against production (it calls kaz_prod_lib.assert_local_db()
internally, correctly, by design). This module is a deliberate, near-
line-for-line port of the exact same 21 checks and exact same SQL query
text, executed via a psycopg connection instead of local `psql` --
proven equivalent by a dedicated rehearsal test that runs BOTH validators
against the same disposable database state and diffs every figure, not
merely "by inspection".
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import kaz_prod_lib as lib  # noqa: E402
import psycopg  # noqa: E402


def load_artifact(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_direct(conn: psycopg.Connection, schema: str, artifact_path: Path) -> tuple[bool, dict]:
    """Read-only. Returns (all_passed, report) where report contains every
    figure this validator computed, for external comparison/logging (never
    including any credential -- only query results)."""
    artifact = load_artifact(artifact_path)
    runner = lib.CheckRunner("kazimirski-validator-direct")
    report: dict = {}

    src_id = artifact["content_source"]["id"]

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM public.content_sources WHERE edition_identifier=%s;", (lib.EDITION_IDENTIFIER,))
        n_sources = cur.fetchone()[0]
    runner.check("exactly one Kazimirski content_sources row", n_sources == 1, f"found {n_sources}")
    report["n_sources"] = n_sources

    with conn.cursor() as cur:
        cur.execute("SELECT id, verification_status FROM public.content_sources WHERE edition_identifier=%s;", (lib.EDITION_IDENTIFIER,))
        row = cur.fetchone()
    if row:
        db_id, db_status = str(row[0]), row[1]
        runner.check("content_sources id matches deterministic id", db_id == src_id, f"db={db_id} artifact={src_id}")
        runner.check("verification_status = candidate", db_status == "candidate", f"found {db_status}")
        report["db_id"] = db_id
        report["db_status"] = db_status

    with conn.cursor() as cur:
        cur.execute(f"SELECT count(*) FROM {schema}.translation_segments WHERE source_id=%s;", (src_id,))
        n_segments = cur.fetchone()[0]
    runner.check("segment count = 6239", n_segments == lib.EXPECTED_SEGMENT_COUNT, f"found {n_segments}")
    report["n_segments"] = n_segments

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT count(*) FROM {schema}.translation_segment_ayahs tsa "
            f"JOIN {schema}.translation_segments ts ON ts.id=tsa.segment_id WHERE ts.source_id=%s;",
            (src_id,),
        )
        n_joins = cur.fetchone()[0]
    runner.check("join count = 6396", n_joins == lib.EXPECTED_JOIN_COUNT, f"found {n_joins}")
    report["n_joins"] = n_joins

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT count(DISTINCT (tsa.surah_number, tsa.ayah_number)) FROM {schema}.translation_segment_ayahs tsa "
            f"JOIN {schema}.translation_segments ts ON ts.id=tsa.segment_id WHERE ts.source_id=%s;",
            (src_id,),
        )
        coverage = cur.fetchone()[0]
    runner.check("canonical coverage = 6236/6236", coverage == lib.EXPECTED_CANONICAL_AYAHS, f"found {coverage}/{lib.EXPECTED_CANONICAL_AYAHS}")
    report["coverage"] = coverage

    with conn.cursor() as cur:
        cur.execute(f"SELECT count(*) FROM {schema}.translation_segments WHERE source_id=%s AND alignment_status='unresolved';", (src_id,))
        n_unresolved = cur.fetchone()[0]
    runner.check("zero segments with alignment_status=unresolved", n_unresolved == 0, f"found {n_unresolved}")

    def breakdown(sql: str) -> dict[str, int]:
        with conn.cursor() as cur:
            cur.execute(sql, (src_id,))
            return {k: v for k, v in cur.fetchall()}

    at_breakdown = breakdown(f"SELECT alignment_type, count(*) FROM {schema}.translation_segments WHERE source_id=%s GROUP BY 1;")
    as_breakdown = breakdown(f"SELECT alignment_status, count(*) FROM {schema}.translation_segments WHERE source_id=%s GROUP BY 1;")
    mc_breakdown = breakdown(
        f"SELECT mapping_confidence, count(*) FROM {schema}.translation_segment_ayahs tsa "
        f"JOIN {schema}.translation_segments ts ON ts.id=tsa.segment_id WHERE ts.source_id=%s GROUP BY 1;"
    )
    print(f"alignment_type breakdown: {at_breakdown}")
    print(f"alignment_status breakdown: {as_breakdown}")
    print(f"mapping_confidence breakdown: {mc_breakdown}")
    report["at_breakdown"] = at_breakdown
    report["as_breakdown"] = as_breakdown
    report["mc_breakdown"] = mc_breakdown

    runner.check("alignment_type breakdown sums to 6239", sum(at_breakdown.values()) == lib.EXPECTED_SEGMENT_COUNT, str(at_breakdown))
    runner.check("alignment_status breakdown sums to 6239", sum(as_breakdown.values()) == lib.EXPECTED_SEGMENT_COUNT, str(as_breakdown))
    runner.check("mapping_confidence breakdown sums to 6396", sum(mc_breakdown.values()) == lib.EXPECTED_JOIN_COUNT, str(mc_breakdown))
    runner.check(
        "no enum value outside the closed domain",
        set(at_breakdown) <= lib.VALID_ALIGNMENT_TYPES and set(as_breakdown) <= lib.VALID_ALIGNMENT_STATUSES and set(mc_breakdown) <= lib.VALID_MAPPING_CONFIDENCE,
    )

    hv_segments = as_breakdown.get("human_verified", 0)
    hv_joins = mc_breakdown.get("human_verified", 0)
    runner.check("human_verified segments = 57", hv_segments == lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS, f"found {hv_segments}")
    runner.check("human_verified joins = 80", hv_joins == lib.EXPECTED_HUMAN_VERIFIED_JOINS, f"found {hv_joins}")

    # Matches validate_kazimirski_import.py's own construction exactly (a
    # literal tuple-IN-list) -- safe here since the values are hardcoded
    # constants from kaz_prod_lib.py, never user input.
    tier2_pairs = ",".join(f"({s},{a})" for s, a in sorted(lib.TIER2_COMPOUND_BOUNDARY_AYAHS))
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT count(*) FROM {schema}.translation_segment_ayahs tsa "
            f"JOIN {schema}.translation_segments ts ON ts.id=tsa.segment_id "
            f"WHERE ts.source_id=%s AND tsa.mapping_confidence='human_verified' "
            f"AND (tsa.surah_number, tsa.ayah_number) IN ({tier2_pairs});",
            (src_id,),
        )
        tier2_hv = cur.fetchone()[0]
    runner.check("Tier 2 human_verified joins = 17", tier2_hv == lib.EXPECTED_TIER2_HUMAN_VERIFIED_JOINS, f"found {tier2_hv}")

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT surah_number, source_ordinal, text FROM {schema}.translation_segments WHERE source_id=%s "
            f"ORDER BY surah_number, source_ordinal;",
            (src_id,),
        )
        rows = cur.fetchall()
    texts = [r[2] for r in rows]
    agg_hash = lib.aggregate_ordered_hash(texts) if len(texts) == lib.EXPECTED_SEGMENT_COUNT else None
    runner.check(
        "aggregate segment text hash matches frozen value",
        agg_hash == lib.EXPECTED_AGGREGATE_SEGMENT_TEXT_HASH,
        f"computed={agg_hash} expected={lib.EXPECTED_AGGREGATE_SEGMENT_TEXT_HASH} (from {len(texts)} rows)",
    )

    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*), encode(digest(coalesce(string_agg(arabic_text, E'\\x1e' ORDER BY surah_number, ayah_number), ''), 'sha256'), 'hex') FROM public.ayahs;"
        )
        ayahs_count, ayahs_hash = cur.fetchone()
    runner.check("canonical ayahs count = 6236", ayahs_count == lib.EXPECTED_CANONICAL_AYAHS, f"found {ayahs_count}")
    print(f"ayahs content hash: {ayahs_hash}")
    report["ayahs_count"] = ayahs_count
    report["ayahs_hash"] = ayahs_hash

    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*), encode(digest(coalesce(string_agg(t.text, E'\\x1e' ORDER BY t.surah_number, t.ayah_number), ''), 'sha256'), 'hex') "
            "FROM public.translations t JOIN public.content_sources cs ON cs.id=t.source_id "
            "WHERE cs.edition_identifier='pickthall-gutenberg-16955' AND cs.verification_status='verified';"
        )
        pick_count, pick_hash = cur.fetchone()
    runner.check("Pickthall count = 6236", pick_count == lib.EXPECTED_CANONICAL_AYAHS, f"found {pick_count}")
    print(f"Pickthall content hash: {pick_hash}")
    report["pickthall_count"] = pick_count
    report["pickthall_hash"] = pick_hash

    artifact_seg_ids = {s["id"] for s in artifact["segments"]}
    with conn.cursor() as cur:
        cur.execute(f"SELECT id FROM {schema}.translation_segments WHERE source_id=%s;", (src_id,))
        db_seg_ids = {str(r[0]) for r in cur.fetchall()}
    unexpected_segs = db_seg_ids - artifact_seg_ids
    missing_segs = artifact_seg_ids - db_seg_ids
    runner.check("zero unexpected segment rows (in DB, not in artifact)", len(unexpected_segs) == 0, f"found {len(unexpected_segs)}")
    runner.check("zero missing segment rows (in artifact, not in DB)", len(missing_segs) == 0, f"found {len(missing_segs)}")

    artifact_join_ids = {j["id"] for j in artifact["joins"]}
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT tsa.id FROM {schema}.translation_segment_ayahs tsa "
            f"JOIN {schema}.translation_segments ts ON ts.id=tsa.segment_id WHERE ts.source_id=%s;",
            (src_id,),
        )
        db_join_ids = {str(r[0]) for r in cur.fetchall()}
    unexpected_joins = db_join_ids - artifact_join_ids
    missing_joins = artifact_join_ids - db_join_ids
    runner.check("zero unexpected join rows (in DB, not in artifact)", len(unexpected_joins) == 0, f"found {len(unexpected_joins)}")
    runner.check("zero missing join rows (in artifact, not in DB)", len(missing_joins) == 0, f"found {len(missing_joins)}")

    print(f"\n[{runner.name}] {runner.passed}/{runner.passed + runner.failed} passed, {runner.failed} failed")
    report["passed"] = runner.passed
    report["failed"] = runner.failed
    return runner.failed == 0, report

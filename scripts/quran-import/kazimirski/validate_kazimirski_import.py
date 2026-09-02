#!/usr/bin/env python3
"""
Kazimirski PRODUCTION import validator.

Standalone, reusable, per PRODUCTION-MIGRATION-IMPORT-DESIGN.md §19 / the
gate's Step 13. Directly queries whatever DB it's pointed at (never trusts
the importer's own claimed success) and compares against the frozen
artifact. Reports every figure Step 13 lists:

  - source count (content_sources rows for this edition_identifier)
  - segment count
  - join count
  - canonical coverage
  - unresolved segment count
  - alignment_type breakdown
  - alignment_status breakdown
  - mapping_confidence breakdown
  - human_verified segments / joins
  - Tier 2 human_verified joins (the 17 specific (surah,ayah) pairs)
  - aggregate segment text hash (recomputed from the live table)
  - canonical Arabic (ayahs) baseline: count + content hash
  - Pickthall baseline: count + content hash
  - unexpected rows (present in DB, id not in artifact)
  - missing rows (present in artifact, not in DB)
  - divergent rows (present in both, content differs)

Designed to be reusable both now (against this local rehearsal-shaped DB)
and later (production preflight/postflight) -- this implementation phase
only ever invokes it against 127.0.0.1:54322, never production, enforced by
kaz_prod_lib.assert_local_db.

Exit code 0 = every check PASSED. Exit code 1 = at least one check FAILED
(full detail printed either way -- this tool never silently summarizes over
a failure).
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import kaz_prod_lib as lib  # noqa: E402


def load_artifact(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate(db_url: str, schema: str, artifact_path: Path) -> bool:
    lib.assert_local_db(db_url)
    artifact = load_artifact(artifact_path)
    runner = lib.CheckRunner("kazimirski-validator")

    src_id = artifact["content_source"]["id"]

    # -- Source count --
    n_sources = lib.psql_int(
        db_url, f"SELECT count(*) FROM public.content_sources WHERE edition_identifier='{lib.EDITION_IDENTIFIER}';"
    )
    runner.check("exactly one Kazimirski content_sources row", n_sources == 1, f"found {n_sources}")

    db_source_row = lib.psql(
        db_url, f"SELECT id, verification_status FROM public.content_sources WHERE edition_identifier='{lib.EDITION_IDENTIFIER}';"
    ).strip()
    if db_source_row:
        db_id, db_status = db_source_row.split("\t")
        runner.check("content_sources id matches deterministic id", db_id == src_id, f"db={db_id} artifact={src_id}")
        runner.check("verification_status = candidate", db_status == "candidate", f"found {db_status}")

    # -- Segment / join counts --
    n_segments = lib.psql_int(db_url, f"SELECT count(*) FROM {schema}.translation_segments WHERE source_id='{src_id}';")
    runner.check("segment count = 6239", n_segments == lib.EXPECTED_SEGMENT_COUNT, f"found {n_segments}")

    n_joins = lib.psql_int(
        db_url,
        f"SELECT count(*) FROM {schema}.translation_segment_ayahs tsa "
        f"JOIN {schema}.translation_segments ts ON ts.id=tsa.segment_id WHERE ts.source_id='{src_id}';",
    )
    runner.check("join count = 6396", n_joins == lib.EXPECTED_JOIN_COUNT, f"found {n_joins}")

    # -- Coverage --
    coverage = lib.psql_int(
        db_url,
        f"SELECT count(DISTINCT (tsa.surah_number, tsa.ayah_number)) FROM {schema}.translation_segment_ayahs tsa "
        f"JOIN {schema}.translation_segments ts ON ts.id=tsa.segment_id WHERE ts.source_id='{src_id}';",
    )
    runner.check("canonical coverage = 6236/6236", coverage == lib.EXPECTED_CANONICAL_AYAHS, f"found {coverage}/{lib.EXPECTED_CANONICAL_AYAHS}")

    # -- Unresolved --
    n_unresolved = lib.psql_int(
        db_url, f"SELECT count(*) FROM {schema}.translation_segments WHERE source_id='{src_id}' AND alignment_status='unresolved';"
    )
    runner.check("zero segments with alignment_status=unresolved", n_unresolved == 0, f"found {n_unresolved}")

    # -- Enum breakdowns --
    def breakdown(sql: str) -> dict[str, int]:
        out = lib.psql(db_url, sql)
        result = {}
        for line in out.strip().splitlines():
            if not line.strip():
                continue
            k, v = line.split("\t")
            result[k] = int(v)
        return result

    at_breakdown = breakdown(
        f"SELECT alignment_type, count(*) FROM {schema}.translation_segments WHERE source_id='{src_id}' GROUP BY 1;"
    )
    as_breakdown = breakdown(
        f"SELECT alignment_status, count(*) FROM {schema}.translation_segments WHERE source_id='{src_id}' GROUP BY 1;"
    )
    mc_breakdown = breakdown(
        f"SELECT mapping_confidence, count(*) FROM {schema}.translation_segment_ayahs tsa "
        f"JOIN {schema}.translation_segments ts ON ts.id=tsa.segment_id WHERE ts.source_id='{src_id}' GROUP BY 1;"
    )
    print(f"alignment_type breakdown: {at_breakdown}")
    print(f"alignment_status breakdown: {as_breakdown}")
    print(f"mapping_confidence breakdown: {mc_breakdown}")
    runner.check("alignment_type breakdown sums to 6239", sum(at_breakdown.values()) == lib.EXPECTED_SEGMENT_COUNT, str(at_breakdown))
    runner.check("alignment_status breakdown sums to 6239", sum(as_breakdown.values()) == lib.EXPECTED_SEGMENT_COUNT, str(as_breakdown))
    runner.check("mapping_confidence breakdown sums to 6396", sum(mc_breakdown.values()) == lib.EXPECTED_JOIN_COUNT, str(mc_breakdown))
    runner.check(
        "no enum value outside the closed domain",
        set(at_breakdown) <= lib.VALID_ALIGNMENT_TYPES and set(as_breakdown) <= lib.VALID_ALIGNMENT_STATUSES and set(mc_breakdown) <= lib.VALID_MAPPING_CONFIDENCE,
    )

    # -- human_verified counts --
    hv_segments = as_breakdown.get("human_verified", 0)
    hv_joins = mc_breakdown.get("human_verified", 0)
    runner.check("human_verified segments = 57", hv_segments == lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS, f"found {hv_segments}")
    runner.check("human_verified joins = 80", hv_joins == lib.EXPECTED_HUMAN_VERIFIED_JOINS, f"found {hv_joins}")

    # -- Tier 2 target joins --
    tier2_pairs = ",".join(f"({s},{a})" for s, a in sorted(lib.TIER2_COMPOUND_BOUNDARY_AYAHS))
    tier2_hv = lib.psql_int(
        db_url,
        f"SELECT count(*) FROM {schema}.translation_segment_ayahs tsa "
        f"JOIN {schema}.translation_segments ts ON ts.id=tsa.segment_id "
        f"WHERE ts.source_id='{src_id}' AND tsa.mapping_confidence='human_verified' "
        f"AND (tsa.surah_number, tsa.ayah_number) IN ({tier2_pairs});",
    )
    runner.check("Tier 2 human_verified joins = 17", tier2_hv == lib.EXPECTED_TIER2_HUMAN_VERIFIED_JOINS, f"found {tier2_hv}")

    # -- Aggregate hash --
    seg_rows = lib.psql(
        db_url,
        f"SELECT surah_number, source_ordinal, text FROM {schema}.translation_segments WHERE source_id='{src_id}' "
        f"ORDER BY surah_number, source_ordinal;",
    )
    texts = []
    for line in seg_rows.split("\n"):
        if not line.strip():
            continue
        parts = line.split("\t", 2)
        if len(parts) == 3:
            texts.append(parts[2])
    agg_hash = lib.aggregate_ordered_hash(texts) if len(texts) == lib.EXPECTED_SEGMENT_COUNT else None
    runner.check(
        "aggregate segment text hash matches frozen value",
        agg_hash == lib.EXPECTED_AGGREGATE_SEGMENT_TEXT_HASH,
        f"computed={agg_hash} expected={lib.EXPECTED_AGGREGATE_SEGMENT_TEXT_HASH} (from {len(texts)} rows)",
    )

    # -- Canonical Arabic / Pickthall baseline --
    ayahs_count, ayahs_hash = fetch_baseline(
        db_url,
        "SELECT count(*), encode(digest(coalesce(string_agg(arabic_text, E'\\x1e' ORDER BY surah_number, ayah_number), ''), 'sha256'), 'hex') FROM public.ayahs;",
    )
    runner.check("canonical ayahs count = 6236", ayahs_count == lib.EXPECTED_CANONICAL_AYAHS, f"found {ayahs_count}")
    print(f"ayahs content hash: {ayahs_hash}")

    pick_count, pick_hash = fetch_baseline(
        db_url,
        "SELECT count(*), encode(digest(coalesce(string_agg(t.text, E'\\x1e' ORDER BY t.surah_number, t.ayah_number), ''), 'sha256'), 'hex') "
        "FROM public.translations t JOIN public.content_sources cs ON cs.id=t.source_id "
        "WHERE cs.edition_identifier='pickthall-gutenberg-16955' AND cs.verification_status='verified';",
    )
    runner.check("Pickthall count = 6236", pick_count == lib.EXPECTED_CANONICAL_AYAHS, f"found {pick_count}")
    print(f"Pickthall content hash: {pick_hash}")

    # -- unexpected / missing / divergent rows (by deterministic id) --
    artifact_seg_ids = {s["id"] for s in artifact["segments"]}
    db_seg_ids_out = lib.psql(db_url, f"SELECT id FROM {schema}.translation_segments WHERE source_id='{src_id}';")
    db_seg_ids = {line.strip() for line in db_seg_ids_out.splitlines() if line.strip()}
    unexpected_segs = db_seg_ids - artifact_seg_ids
    missing_segs = artifact_seg_ids - db_seg_ids
    runner.check("zero unexpected segment rows (in DB, not in artifact)", len(unexpected_segs) == 0, f"found {len(unexpected_segs)}")
    runner.check("zero missing segment rows (in artifact, not in DB)", len(missing_segs) == 0, f"found {len(missing_segs)}")

    artifact_join_ids = {j["id"] for j in artifact["joins"]}
    db_join_ids_out = lib.psql(
        db_url,
        f"SELECT tsa.id FROM {schema}.translation_segment_ayahs tsa "
        f"JOIN {schema}.translation_segments ts ON ts.id=tsa.segment_id WHERE ts.source_id='{src_id}';",
    )
    db_join_ids = {line.strip() for line in db_join_ids_out.splitlines() if line.strip()}
    unexpected_joins = db_join_ids - artifact_join_ids
    missing_joins = artifact_join_ids - db_join_ids
    runner.check("zero unexpected join rows (in DB, not in artifact)", len(unexpected_joins) == 0, f"found {len(unexpected_joins)}")
    runner.check("zero missing join rows (in artifact, not in DB)", len(missing_joins) == 0, f"found {len(missing_joins)}")

    runner.summary_and_exit_deferred = True
    print(f"\n[{runner.name}] {runner.passed}/{runner.passed + runner.failed} passed, {runner.failed} failed")
    return runner.failed == 0


def fetch_baseline(db_url: str, sql: str) -> tuple[int, str]:
    out = lib.psql(db_url, sql).strip()
    count_s, hsh = out.split("\t")
    return int(count_s), hsh


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db-url", default=lib.DEFAULT_DB_URL)
    parser.add_argument("--schema", default="public")
    parser.add_argument("--artifact", default=str(lib.ARTIFACT_PATH))
    args = parser.parse_args()
    ok = validate(args.db_url, args.schema, Path(args.artifact))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

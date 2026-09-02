#!/usr/bin/env python3
"""
Kazimirski PRODUCTION ADAPTER -- local rehearsal test suite.

Proves, entirely against a disposable local Postgres schema (never against
production, never touching the shared local dev DB's own Phase 3 prototype
tables), that production_adapter.py's SQL-generation path is semantically
equivalent to the reviewed import_production_kazimirski.py path, that the
generated SQL is atomic (forced-failure proof), idempotent-by-refusal
(never duplicates), and rollback-compatible.

Run directly:
    python3 scripts/quran-import/kazimirski/tests/test_production_adapter_rehearsal.py
"""
from __future__ import annotations

import copy
import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
KAZ_DIR = HERE.parent
sys.path.insert(0, str(KAZ_DIR))

import kaz_prod_lib as lib  # noqa: E402
import import_production_kazimirski as imp  # noqa: E402
import production_adapter as adapter  # noqa: E402
import rollback_kazimirski as rb  # noqa: E402
import validate_kazimirski_import as val  # noqa: E402

DB_URL = lib.DEFAULT_DB_URL
TEST_SCHEMA = "kaz_adapter_rehearsal_test"

runner = lib.CheckRunner("kazimirski-adapter-rehearsal")


def q(sql: str) -> str:
    return lib.psql(DB_URL, sql)


def qi(sql: str) -> int:
    return lib.psql_int(DB_URL, sql)


def teardown(quiet: bool = False) -> None:
    if not quiet:
        print("\n--- Teardown: restoring local DB to its pre-suite state ---")
    q(f"DROP SCHEMA IF EXISTS {TEST_SCHEMA} CASCADE;")
    q(f"DELETE FROM public.content_sources WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';")


def setup() -> None:
    teardown(quiet=True)
    q(f"CREATE SCHEMA {TEST_SCHEMA};")
    q(f"GRANT USAGE ON SCHEMA {TEST_SCHEMA} TO anon, authenticated;")
    apply_migration_to_test_schema()


def apply_migration_to_test_schema() -> None:
    sql_text = lib.MIGRATION_FILE_PATH.read_text(encoding="utf-8")
    rendered = lib.render_migration_for_test_schema(sql_text, TEST_SCHEMA)
    lib.psql_text(DB_URL, rendered)


# ---------------------------------------------------------------------------
# Facts gathering (mirrors what an MCP-based orchestrator would populate,
# but sourced from local psql here purely for testing the adapter itself)
# ---------------------------------------------------------------------------


def gather_facts(schema: str, artifact: dict) -> dict:
    src_row_text = q(
        f"SELECT id, verification_status FROM public.content_sources WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';"
    ).strip()
    content_source_row = None
    if src_row_text:
        parts = src_row_text.split("\t")
        content_source_row = {"id": parts[0], "verification_status": parts[1]}

    seg_ids = [s["id"] for s in artifact["segments"]]
    join_ids = [j["id"] for j in artifact["joins"]]

    seg_rows = q(
        f"SELECT id, source_id, surah_number, source_ordinal, source_declared_number, text_sha256, alignment_type, alignment_status "
        f"FROM {schema}.translation_segments WHERE id = ANY(ARRAY[{','.join(chr(39)+s+chr(39) for s in seg_ids)}]::uuid[]);"
    )
    existing_segments_detail = {}
    for line in seg_rows.strip().splitlines():
        if not line.strip():
            continue
        p = line.split("\t")
        existing_segments_detail[p[0]] = p[1:]

    join_rows = q(
        f"SELECT id, segment_id, surah_number, ayah_number, mapping_confidence "
        f"FROM {schema}.translation_segment_ayahs WHERE id = ANY(ARRAY[{','.join(chr(39)+j+chr(39) for j in join_ids)}]::uuid[]);"
    )
    existing_joins_detail = {}
    for line in join_rows.strip().splitlines():
        if not line.strip():
            continue
        p = line.split("\t")
        existing_joins_detail[p[0]] = p[1:]

    pre_ayahs = imp.fetch_baseline(DB_URL, imp.db_ayahs_baseline_sql(schema))
    pre_pickthall = imp.fetch_baseline(DB_URL, imp.db_pickthall_baseline_sql(schema))

    return {
        "schema": schema,
        "tables_exist": True,
        "content_source_row": content_source_row,
        "existing_segment_ids": list(existing_segments_detail.keys()),
        "existing_segments_detail": existing_segments_detail,
        "existing_join_ids": list(existing_joins_detail.keys()),
        "existing_joins_detail": existing_joins_detail,
        "pre_ayahs": list(pre_ayahs),
        "pre_pickthall": list(pre_pickthall),
    }


def write_facts_file(facts: dict) -> Path:
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8")
    json.dump(facts, f)
    f.close()
    return Path(f.name)


# ---------------------------------------------------------------------------
# 1-6: classify_state equivalence (adapter port vs. original)
# ---------------------------------------------------------------------------


def test_classify_state_equivalence(artifact: dict) -> None:
    facts = gather_facts(TEST_SCHEMA, artifact)
    state_orig, detail_orig = imp.classify_state(DB_URL, TEST_SCHEMA, artifact)
    state_adapter, detail_adapter = adapter.classify_state_from_facts(facts, artifact)
    runner.check("1. classify_state equivalence: state matches (fresh, state A)", state_orig == state_adapter == "A", f"orig={state_orig} adapter={state_adapter}")
    runner.check("2. classify_state equivalence: detail matches", detail_orig == detail_adapter, f"orig={detail_orig} adapter={detail_adapter}")


# ---------------------------------------------------------------------------
# 7-11: SQL generation equivalence (byte-for-byte, same function, same inputs)
# ---------------------------------------------------------------------------


def test_sql_generation_equivalence(artifact: dict) -> tuple[str, dict, dict]:
    facts = gather_facts(TEST_SCHEMA, artifact)
    facts_path = write_facts_file(facts)
    try:
        adapter_sql, summary = adapter.generate_production_sql(Path(lib.ARTIFACT_PATH), facts_path, schema=TEST_SCHEMA)
    finally:
        facts_path.unlink(missing_ok=True)

    pre_ayahs = tuple(facts["pre_ayahs"])
    pre_pickthall = tuple(facts["pre_pickthall"])
    # Use the SAME classify_state()-determined flag on both sides of the
    # comparison -- the migration file itself inserts the content_sources row
    # as part of schema application, so by the time this test runs it
    # already exists (content_source_pre_exists=True is correct reality, not
    # a discrepancy). Hardcoding False here would compare the adapter against
    # a scenario that cannot actually occur.
    _, orig_detail = imp.classify_state(DB_URL, TEST_SCHEMA, artifact)
    original_sql = imp.build_import_transaction_sql(TEST_SCHEMA, artifact, pre_ayahs, pre_pickthall, content_source_pre_exists=bool(orig_detail.get("content_source_pre_exists")))

    runner.check("3. adapter-generated SQL byte-for-byte identical to original importer's build_import_transaction_sql output", adapter_sql == original_sql)
    runner.check("4. adapter summary reports expected segment count", summary["expected_segments_inserted"] == lib.EXPECTED_SEGMENT_COUNT)
    runner.check("5. adapter summary reports expected join count", summary["expected_joins_inserted"] == lib.EXPECTED_JOIN_COUNT)
    runner.check("6. adapter summary sql_sha256 matches independent recomputation", summary["sql_sha256"] == __import__("hashlib").sha256(adapter_sql.encode("utf-8")).hexdigest())
    return adapter_sql, summary, facts


# ---------------------------------------------------------------------------
# 12-16: execute adapter-generated SQL against disposable schema, validate
# ---------------------------------------------------------------------------


def test_execute_and_validate(adapter_sql: str, artifact: dict) -> None:
    lib.psql_text(DB_URL, adapter_sql)

    src_id = str(lib.content_source_id())
    n_sources = qi(f"SELECT count(*) FROM public.content_sources WHERE id = '{src_id}';")
    n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id = '{src_id}';")
    n_joins = qi(
        f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segment_ayahs tsa "
        f"JOIN {TEST_SCHEMA}.translation_segments ts ON ts.id = tsa.segment_id WHERE ts.source_id = '{src_id}';"
    )
    runner.check("7. adapter import: exactly one Kazimirski content_sources row", n_sources == 1)
    runner.check("8. adapter import: segment count = 6239", n_segs == lib.EXPECTED_SEGMENT_COUNT, f"got {n_segs}")
    runner.check("9. adapter import: join count = 6396", n_joins == lib.EXPECTED_JOIN_COUNT, f"got {n_joins}")

    validation_ok = val.validate(DB_URL, TEST_SCHEMA, lib.ARTIFACT_PATH)
    runner.check("10. validator: full validation passes against adapter-imported data", validation_ok is True)

    ayahs_count, ayahs_hash = imp.fetch_baseline(DB_URL, imp.db_ayahs_baseline_sql(TEST_SCHEMA))
    pick_count, pick_hash = imp.fetch_baseline(DB_URL, imp.db_pickthall_baseline_sql(TEST_SCHEMA))
    runner.check("11. canonical Arabic fingerprint unchanged after adapter import", ayahs_count == 6236 and ayahs_hash == "ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b")
    runner.check("12. Pickthall fingerprint unchanged after adapter import", pick_count == 6236 and pick_hash == "501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f")


# ---------------------------------------------------------------------------
# 13: forced mid-transaction failure -> full rollback proof
# ---------------------------------------------------------------------------


def test_forced_failure_rollback(artifact: dict) -> None:
    # Corrupt an in-memory copy: drop one join so every INSERT succeeds but the
    # postcondition join-count guard (expects EXPECTED_JOIN_COUNT exactly)
    # fails -- a genuine failure after all data-modifying statements have
    # already run inside the same transaction, proving full rollback.
    corrupted = copy.deepcopy(artifact)
    removed = corrupted["joins"].pop()
    corrupted["join_count"] = len(corrupted["joins"])  # keep internally consistent; EXPECTED_JOIN_COUNT constant still 6396

    pre_ayahs = imp.fetch_baseline(DB_URL, imp.db_ayahs_baseline_sql(TEST_SCHEMA))
    pre_pickthall = imp.fetch_baseline(DB_URL, imp.db_pickthall_baseline_sql(TEST_SCHEMA))
    bad_sql = imp.build_import_transaction_sql(TEST_SCHEMA, corrupted, pre_ayahs, pre_pickthall, content_source_pre_exists=False)

    failed_as_expected = False
    try:
        lib.psql_text(DB_URL, bad_sql)
    except lib.DbError:
        failed_as_expected = True
    runner.check("13. forced failure: corrupted transaction (one join short) raises and does not commit", failed_as_expected)

    src_id = str(lib.content_source_id())
    n_sources = qi(f"SELECT count(*) FROM public.content_sources WHERE id = '{src_id}';")
    n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id = '{src_id}';")
    n_joins = qi(
        f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segment_ayahs tsa "
        f"JOIN {TEST_SCHEMA}.translation_segments ts ON ts.id = tsa.segment_id WHERE ts.source_id = '{src_id}';"
    )
    runner.check("14. forced failure: content_sources = 0 after rollback", n_sources == 0, f"got {n_sources}")
    runner.check("15. forced failure: segments = 0 after rollback", n_segs == 0, f"got {n_segs}")
    runner.check("16. forced failure: joins = 0 after rollback", n_joins == 0, f"got {n_joins}")


# ---------------------------------------------------------------------------
# 17-18: duplicate/re-execution behavior (must refuse, never duplicate)
# ---------------------------------------------------------------------------


def test_duplicate_refusal(artifact: dict) -> None:
    # Generate fresh SQL from CURRENT facts (content_sources row was deleted
    # by the forced-failure test's cleanup, so this is a real, current
    # state-A condition -- reusing an earlier SQL string captured under a
    # different starting condition would be invalid, not a real test).
    facts = gather_facts(TEST_SCHEMA, artifact)
    facts_path = write_facts_file(facts)
    try:
        fresh_sql, _ = adapter.generate_production_sql(Path(lib.ARTIFACT_PATH), facts_path, schema=TEST_SCHEMA)
    finally:
        facts_path.unlink(missing_ok=True)
    lib.psql_text(DB_URL, fresh_sql)  # real import, state A -> committed

    facts = gather_facts(TEST_SCHEMA, artifact)
    facts_path = write_facts_file(facts)
    refused = False
    try:
        adapter.generate_production_sql(Path(lib.ARTIFACT_PATH), facts_path, schema=TEST_SCHEMA)
    except adapter.AdapterAbort:
        refused = True
    finally:
        facts_path.unlink(missing_ok=True)
    runner.check("17. duplicate re-execution: adapter refuses to generate SQL when state is B (exact existing)", refused)

    src_id = str(lib.content_source_id())
    n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id = '{src_id}';")
    runner.check("18. duplicate re-execution: segment count still exactly 6239 (no duplication)", n_segs == lib.EXPECTED_SEGMENT_COUNT, f"got {n_segs}")


# ---------------------------------------------------------------------------
# 19: rollback compatibility with adapter-created data
# ---------------------------------------------------------------------------


def test_rollback_compatibility() -> None:
    rb.rollback(DB_URL, TEST_SCHEMA)
    src_id = str(lib.content_source_id())
    status = q(f"SELECT verification_status FROM public.content_sources WHERE id = '{src_id}';").strip()
    n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id = '{src_id}';")
    n_joins = qi(
        f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segment_ayahs tsa "
        f"JOIN {TEST_SCHEMA}.translation_segments ts ON ts.id = tsa.segment_id WHERE ts.source_id = '{src_id}';"
    )
    runner.check("19. rollback compatibility: existing rollback_kazimirski.py works unmodified against adapter-created data", status == "deprecated" and n_segs == 0 and n_joins == 0, f"status={status} segs={n_segs} joins={n_joins}")


# ---------------------------------------------------------------------------
# 20: full row-level comparison, original importer path vs adapter path
# ---------------------------------------------------------------------------


def dump_all_rows(schema: str, src_id: str) -> tuple[list, list]:
    seg_dump = q(
        f"SELECT id, source_id, surah_number, segment_type, source_ordinal, source_declared_number, text_sha256, "
        f"extraction_source_ref, alignment_type, alignment_status, reviewer_notes, reviewed_by "
        f"FROM {schema}.translation_segments WHERE source_id = '{src_id}' ORDER BY surah_number, source_ordinal;"
    )
    join_dump = q(
        f"SELECT tsa.id, tsa.segment_id, tsa.surah_number, tsa.ayah_number, tsa.mapping_confidence, tsa.reviewer_notes, tsa.reviewed_by "
        f"FROM {schema}.translation_segment_ayahs tsa JOIN {schema}.translation_segments ts ON ts.id = tsa.segment_id "
        f"WHERE ts.source_id = '{src_id}' ORDER BY tsa.surah_number, tsa.ayah_number, tsa.id;"
    )
    return seg_dump.splitlines(), join_dump.splitlines()


def test_full_row_comparison(artifact: dict) -> None:
    # Path A: reimport via the adapter (state is currently F post-rollback from
    # test 19 -- reset to clean state A first by fully clearing, matching what
    # a fresh environment looks like).
    q(f"DELETE FROM public.content_sources WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';")
    facts = gather_facts(TEST_SCHEMA, artifact)
    facts_path = write_facts_file(facts)
    try:
        adapter_sql, _ = adapter.generate_production_sql(Path(lib.ARTIFACT_PATH), facts_path, schema=TEST_SCHEMA)
    finally:
        facts_path.unlink(missing_ok=True)
    lib.psql_text(DB_URL, adapter_sql)
    src_id = str(lib.content_source_id())
    adapter_segs, adapter_joins = dump_all_rows(TEST_SCHEMA, src_id)

    rb.rollback(DB_URL, TEST_SCHEMA)
    q(f"DELETE FROM public.content_sources WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';")

    # Path B: reimport via the original importer's own run_import(), same artifact.
    exit_code = imp.run_import(DB_URL, TEST_SCHEMA, lib.ARTIFACT_PATH, dry_run=False, recover_after_rollback=False)
    original_segs, original_joins = dump_all_rows(TEST_SCHEMA, src_id)

    runner.check("20. full row comparison: original importer path succeeded", exit_code == 0)
    runner.check("21. full row comparison: segment rows byte-for-byte identical between original importer and adapter", adapter_segs == original_segs, f"adapter={len(adapter_segs)} rows, original={len(original_segs)} rows, first diff at index {next((i for i in range(min(len(adapter_segs),len(original_segs))) if adapter_segs[i]!=original_segs[i]), 'n/a')}")
    runner.check("22. full row comparison: join rows byte-for-byte identical between original importer and adapter", adapter_joins == original_joins, f"adapter={len(adapter_joins)} rows, original={len(original_joins)} rows")


def main() -> None:
    setup()
    try:
        artifact = imp.load_and_validate_artifact(lib.ARTIFACT_PATH)
        test_classify_state_equivalence(artifact)
        adapter_sql, summary, facts = test_sql_generation_equivalence(artifact)
        test_execute_and_validate(adapter_sql, artifact)
        rb.rollback(DB_URL, TEST_SCHEMA)  # reset to clean before forced-failure test
        q(f"DELETE FROM public.content_sources WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';")
        test_forced_failure_rollback(artifact)
        test_duplicate_refusal(artifact)
        test_rollback_compatibility()
        test_full_row_comparison(artifact)
    finally:
        teardown()
    runner.summary_and_exit()


if __name__ == "__main__":
    main()

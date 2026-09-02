#!/usr/bin/env python3
"""
Kazimirski DIRECT POSTGRES ADAPTER -- local rehearsal test suite.

Everything here runs against a disposable local Postgres schema
(kaz_direct_rehearsal_test) inside the same local dev cluster, connected to
via the LOCAL DB_URL only (never production). The env-var credential path
is exercised using a throwaway local env var pointing at the same local
DB_URL, so the "read only from env" contract is tested for real without
touching anything sensitive.

Run directly:
    python3 scripts/quran-import/kazimirski/tests/test_direct_postgres_adapter_rehearsal.py
"""
from __future__ import annotations

import copy
import hashlib
import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
KAZ_DIR = HERE.parent
sys.path.insert(0, str(KAZ_DIR))

import kaz_prod_lib as lib  # noqa: E402
import import_production_kazimirski as imp  # noqa: E402
import direct_postgres_adapter as dpa  # noqa: E402
import rollback_kazimirski as rb  # noqa: E402
import validate_kazimirski_import as val  # noqa: E402

import psycopg  # noqa: E402

DB_URL = lib.DEFAULT_DB_URL
TEST_SCHEMA = "kaz_direct_rehearsal_test"
ENV_VAR_NAME = "KAZ_TEST_LOCAL_DB_URL"

runner = lib.CheckRunner("kazimirski-direct-postgres-adapter-rehearsal")


def q(sql: str) -> str:
    return lib.psql(DB_URL, sql)


def qi(sql: str) -> int:
    return lib.psql_int(DB_URL, sql)


def teardown(quiet: bool = False) -> None:
    if not quiet:
        print("\n--- Teardown: restoring local DB to its pre-suite state ---")
    q(f"DROP SCHEMA IF EXISTS {TEST_SCHEMA} CASCADE;")
    q(f"DELETE FROM public.content_sources WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';")
    os.environ.pop(ENV_VAR_NAME, None)


def setup() -> None:
    teardown(quiet=True)
    q(f"CREATE SCHEMA {TEST_SCHEMA};")
    q(f"GRANT USAGE ON SCHEMA {TEST_SCHEMA} TO anon, authenticated;")
    sql_text = lib.MIGRATION_FILE_PATH.read_text(encoding="utf-8")
    rendered = lib.render_migration_for_test_schema(sql_text, TEST_SCHEMA)
    lib.psql_text(DB_URL, rendered)


# ---------------------------------------------------------------------------
# 1: credentials from env var only
# ---------------------------------------------------------------------------


def test_env_var_credentials() -> None:
    os.environ.pop(ENV_VAR_NAME, None)
    missing_raised = False
    try:
        dpa.get_db_url_from_env(ENV_VAR_NAME)
    except dpa.DirectAdapterError:
        missing_raised = True
    runner.check("1. get_db_url_from_env refuses when the env var is unset", missing_raised)

    os.environ[ENV_VAR_NAME] = DB_URL
    got = dpa.get_db_url_from_env(ENV_VAR_NAME)
    runner.check("2. get_db_url_from_env returns exactly the env var's value", got == DB_URL)


# ---------------------------------------------------------------------------
# 3-6: connection identity / database checks
# ---------------------------------------------------------------------------


def test_connection_identity(conn: psycopg.Connection) -> None:
    meta = dpa.verify_connection_identity(conn, {"host_contains": "127.0.0.1", "dbname": "postgres", "min_content_sources": 4, "max_content_sources": 10})
    runner.check("3. verify_connection_identity passes with correct expectations", meta["host"] is not None)

    wrong_dbname = False
    try:
        dpa.verify_connection_identity(conn, {"dbname": "definitely_not_the_right_db"})
    except dpa.DirectAdapterRefusal:
        wrong_dbname = True
    runner.check("4. verify_connection_identity refuses on dbname mismatch", wrong_dbname)

    wrong_host = False
    try:
        dpa.verify_connection_identity(conn, {"host_contains": "not-a-real-host.example.com"})
    except dpa.DirectAdapterRefusal:
        wrong_host = True
    runner.check("5. verify_connection_identity refuses on host mismatch", wrong_host)

    # Pooler-style match: the expected substring appears only in the
    # connected user (e.g. postgres.<ref> against a pooler host), never the
    # host itself -- must still PASS, since Supabase legitimately issues
    # connection strings this way. Uses the real connected user's own value
    # so this test works regardless of which local Postgres user this
    # rehearsal runs as.
    real_user = dpa.connection_metadata(conn)["user"]
    pooler_style_passed = True
    try:
        dpa.verify_connection_identity(conn, {"host_contains": real_user})
    except dpa.DirectAdapterRefusal:
        pooler_style_passed = False
    runner.check("5b. verify_connection_identity passes when the expected substring is only in the user, not the host (pooler-style)", pooler_style_passed)

    neither_matches = False
    try:
        dpa.verify_connection_identity(conn, {"host_contains": "totally-unrelated-string-xyz"})
    except dpa.DirectAdapterRefusal:
        neither_matches = True
    runner.check("5c. verify_connection_identity still refuses when the substring matches neither host nor user", neither_matches)

    wrong_bounds = False
    try:
        dpa.verify_connection_identity(conn, {"min_content_sources": 999})
    except dpa.DirectAdapterRefusal:
        wrong_bounds = True
    runner.check("6. verify_connection_identity refuses when data-level sanity bound fails", wrong_bounds)

    # Never exposes the password even though the DSN in DB_URL contains one.
    assert "password" not in meta
    runner.check("7. verify_connection_identity's returned metadata never includes a password field", "password" not in meta)


# ---------------------------------------------------------------------------
# 8-9: byte-identical SQL source from build_import_transaction_sql()
# ---------------------------------------------------------------------------


def test_sql_byte_identical(conn: psycopg.Connection, artifact: dict) -> None:
    identity = {"host_contains": "127.0.0.1"}
    result = dpa.run_direct_import(conn, TEST_SCHEMA, lib.ARTIFACT_PATH, identity, execute=False)
    runner.check("8. plan-only run_direct_import reports state A and does not execute", result.executed is False and result.state == "A")

    facts = dpa.gather_facts_live(conn, TEST_SCHEMA, artifact)
    independent_sql = imp.build_import_transaction_sql(
        TEST_SCHEMA, artifact, tuple(facts["pre_ayahs"]), tuple(facts["pre_pickthall"]),
        content_source_pre_exists=bool(result.detail.get("content_source_pre_exists")),
    )
    independent_hash = hashlib.sha256(independent_sql.encode("utf-8")).hexdigest()
    runner.check("9. adapter's planned SQL hash byte-for-byte identical to build_import_transaction_sql() called directly", result.sql_sha256 == independent_hash)


# ---------------------------------------------------------------------------
# 10-13: successful commit
# ---------------------------------------------------------------------------


def test_successful_commit(conn: psycopg.Connection, artifact: dict) -> None:
    identity = {"host_contains": "127.0.0.1"}
    result = dpa.run_direct_import(conn, TEST_SCHEMA, lib.ARTIFACT_PATH, identity, execute=True)
    runner.check("10. run_direct_import(execute=True) reports executed=True", result.executed is True)

    src_id = str(lib.content_source_id())
    n_sources = qi(f"SELECT count(*) FROM public.content_sources WHERE id = '{src_id}';")
    n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id = '{src_id}';")
    n_joins = qi(
        f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segment_ayahs tsa "
        f"JOIN {TEST_SCHEMA}.translation_segments ts ON ts.id = tsa.segment_id WHERE ts.source_id = '{src_id}';"
    )
    runner.check("11. successful commit: 1 content_sources row, 6239 segments, 6396 joins", n_sources == 1 and n_segs == lib.EXPECTED_SEGMENT_COUNT and n_joins == lib.EXPECTED_JOIN_COUNT, f"{n_sources}/{n_segs}/{n_joins}")

    validation_ok = val.validate(DB_URL, TEST_SCHEMA, lib.ARTIFACT_PATH)
    runner.check("12. validator passes against direct-postgres-adapter-imported data", validation_ok is True)

    ayahs_count, ayahs_hash = imp.fetch_baseline(DB_URL, imp.db_ayahs_baseline_sql(TEST_SCHEMA))
    pick_count, pick_hash = imp.fetch_baseline(DB_URL, imp.db_pickthall_baseline_sql(TEST_SCHEMA))
    runner.check("13. canonical Arabic + Pickthall fingerprints unchanged", ayahs_count == 6236 and ayahs_hash == "ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b" and pick_count == 6236 and pick_hash == "501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f")


# ---------------------------------------------------------------------------
# 14: duplicate/import-existing refusal
# ---------------------------------------------------------------------------


def test_duplicate_refusal(conn: psycopg.Connection, artifact: dict) -> None:
    identity = {"host_contains": "127.0.0.1"}
    refused = False
    try:
        dpa.run_direct_import(conn, TEST_SCHEMA, lib.ARTIFACT_PATH, identity, execute=True)
    except dpa.DirectAdapterRefusal:
        refused = True
    runner.check("14. run_direct_import refuses (state B) rather than duplicating an existing import", refused)

    src_id = str(lib.content_source_id())
    n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id = '{src_id}';")
    runner.check("15. segment count still exactly 6239 after refused duplicate attempt", n_segs == lib.EXPECTED_SEGMENT_COUNT, f"got {n_segs}")


# ---------------------------------------------------------------------------
# 16-19: rollback after a genuine mid-import SQL error (FK violation)
# ---------------------------------------------------------------------------


def test_rollback_after_sql_error(conn: psycopg.Connection, artifact: dict) -> None:
    rb.rollback(DB_URL, TEST_SCHEMA)
    q(f"DELETE FROM public.content_sources WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';")

    corrupted = copy.deepcopy(artifact)
    corrupted["segments"][100]["surah_number"] = 9999  # violates translation_segments_surah_number_fkey mid-batch

    facts = dpa.gather_facts_live(conn, TEST_SCHEMA, artifact)
    bad_sql = imp.build_import_transaction_sql(TEST_SCHEMA, corrupted, tuple(facts["pre_ayahs"]), tuple(facts["pre_pickthall"]), content_source_pre_exists=False)

    raised = False
    try:
        with conn.cursor() as cur:
            cur.execute(bad_sql)
    except Exception:  # noqa: BLE001
        raised = True
        conn.rollback()
    runner.check("16. genuine SQL error (FK violation) mid-script raises", raised)

    src_id = str(lib.content_source_id())
    n_sources = qi(f"SELECT count(*) FROM public.content_sources WHERE id = '{src_id}';")
    n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id = '{src_id}';")
    n_joins = qi(
        f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segment_ayahs tsa "
        f"JOIN {TEST_SCHEMA}.translation_segments ts ON ts.id = tsa.segment_id WHERE ts.source_id = '{src_id}';"
    )
    runner.check("17. after SQL-error rollback: content_sources = 0", n_sources == 0, f"got {n_sources}")
    runner.check("18. after SQL-error rollback: segments = 0", n_segs == 0, f"got {n_segs}")
    runner.check("19. after SQL-error rollback: joins = 0", n_joins == 0, f"got {n_joins}")

    # Connection must be usable again after the explicit rollback.
    with conn.cursor() as cur:
        cur.execute("SELECT 1;")
        (one,) = cur.fetchone()
    runner.check("20. connection usable again immediately after conn.rollback()", one == 1)


# ---------------------------------------------------------------------------
# 21-23: rollback after a postcondition error (via run_direct_import's own path)
# ---------------------------------------------------------------------------


def test_rollback_after_postcondition_error(conn: psycopg.Connection, artifact: dict) -> None:
    corrupted = copy.deepcopy(artifact)
    corrupted["joins"].pop()  # every INSERT succeeds; postcondition join-count guard fails

    facts = dpa.gather_facts_live(conn, TEST_SCHEMA, artifact)
    bad_sql = imp.build_import_transaction_sql(TEST_SCHEMA, corrupted, tuple(facts["pre_ayahs"]), tuple(facts["pre_pickthall"]), content_source_pre_exists=False)

    raised = False
    try:
        with conn.cursor() as cur:
            cur.execute(bad_sql)
    except Exception:  # noqa: BLE001
        raised = True
        conn.rollback()
    runner.check("21. postcondition RAISE EXCEPTION (join count mismatch) raises", raised)

    src_id = str(lib.content_source_id())
    n_sources = qi(f"SELECT count(*) FROM public.content_sources WHERE id = '{src_id}';")
    n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id = '{src_id}';")
    runner.check("22. after postcondition-error rollback: content_sources = 0", n_sources == 0, f"got {n_sources}")
    runner.check("23. after postcondition-error rollback: segments = 0", n_segs == 0, f"got {n_segs}")


# ---------------------------------------------------------------------------
# 24-25: no commit on client exception (connection-level failure, not SQL-level)
# ---------------------------------------------------------------------------


def test_no_commit_on_client_exception(artifact: dict) -> None:
    # A fresh, separate connection deliberately closed before use, to force a
    # genuine client/connection-level exception (not a server-side SQL error).
    os.environ[ENV_VAR_NAME] = DB_URL
    dead_conn = dpa.connect(dpa.get_db_url_from_env(ENV_VAR_NAME))
    dead_conn.close()

    client_exception_raised = False
    try:
        dpa.run_direct_import(dead_conn, TEST_SCHEMA, lib.ARTIFACT_PATH, {}, execute=True)
    except Exception:  # noqa: BLE001 -- psycopg.OperationalError/InterfaceError or dpa's own wrapping
        client_exception_raised = True
    runner.check("24. client/connection-level exception (closed connection) raised, not silently ignored", client_exception_raised)

    # Confirm on the REAL connection that nothing was written as a side effect.
    src_id = str(lib.content_source_id())
    n_sources = qi(f"SELECT count(*) FROM public.content_sources WHERE id = '{src_id}';")
    runner.check("25. no commit occurred as a result of the client exception", n_sources == 0, f"got {n_sources}")


def main() -> None:
    setup()
    conn = None
    try:
        test_env_var_credentials()
        artifact = imp.load_and_validate_artifact(lib.ARTIFACT_PATH)

        conn = dpa.connect(DB_URL)
        test_connection_identity(conn)
        test_sql_byte_identical(conn, artifact)
        test_successful_commit(conn, artifact)
        test_duplicate_refusal(conn, artifact)
        test_rollback_after_sql_error(conn, artifact)
        test_rollback_after_postcondition_error(conn, artifact)
        test_no_commit_on_client_exception(artifact)
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass
        teardown()
    runner.summary_and_exit()


if __name__ == "__main__":
    main()

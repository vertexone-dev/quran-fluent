#!/usr/bin/env python3
"""
Kazimirski DIRECT POSTGRES production execution adapter.

Built under "KAZIMIRSKI PRODUCTION EXECUTION -- DIRECT POSTGRES ADAPTER".
The Supabase Management-API/MCP channel (production_adapter.py) remains
rejected: its transaction atomicity could not be empirically established
without either touching production or paying for a disposable branch (see
PRODUCTION-EXECUTION-CHANNEL-ADAPTATION-REPORT.md). This module instead
talks to Postgres directly over the wire protocol via `psycopg` (v3) --
no Management API intermediary, no MCP tool, no assumptions about how a
third party's private backend forwards a query string.

WHY THIS CAN BE ATOMICITY-PROVEN WHERE THE MCP CHANNEL COULD NOT:
psycopg is a direct, standard, widely-used PostgreSQL wire-protocol client
-- there is no private intermediary whose internal behavior is opaque.
Empirically proven, this gate, against the local rehearsal Postgres
instance (127.0.0.1:54322): a single `cursor.execute()` call containing a
multi-statement string with explicit `BEGIN; ... COMMIT;` and a forced
mid-script `RAISE EXCEPTION` correctly leaves zero rows behind (full
rollback), and a successful equivalent script correctly commits. See
tests/test_direct_postgres_adapter_rehearsal.py for the reproducible proof.

ONE IMPORTANT OPERATIONAL CAVEAT, DOCUMENTED HONESTLY: this was proven
against a direct (non-pooled) Postgres connection. Supabase also offers a
connection-pooler endpoint (PgBouncer, historically defaulting to
"transaction mode" on port 6543), which can interact differently with
session-level multi-statement scripts. Whoever eventually supplies the
production DB_URL for real execution MUST supply the direct/session-mode
connection endpoint, not the transaction-mode pooler endpoint -- this
module does not and cannot verify which kind of endpoint a given DB_URL
points to, so that responsibility is explicit and external.

SAFETY / SCOPE (all requirements from the gate):
  - src/, assert_local_db(), import_production_kazimirski.py,
    rollback_kazimirski.py, validate_kazimirski_import.py: NOT imported for
    modification, NOT touched. import_production_kazimirski is imported
    ONLY to reuse load_and_validate_artifact() and
    build_import_transaction_sql() unchanged -- this module does not
    reimplement SQL generation.
  - production_adapter.classify_state_from_facts() is reused (already
    proven equivalent to the real classify_state() by a dedicated 22/22
    test suite) -- this module supplies it with LIVE facts gathered over
    this same psycopg connection instead of an MCP-populated facts file.
  - Credentials: read ONLY from an environment variable via
    get_db_url_from_env(). Never written to any file, never included in
    any exception message, never printed, never logged. Every function in
    this module that could theoretically expose the DSN has been written
    to pass through only non-secret connection metadata (host/port/dbname/
    user -- never password) in any return value or log line.
  - One psycopg connection for the entire operation, autocommit=True at
    the driver level so the ONLY transaction boundary is the explicit
    `BEGIN; ... COMMIT;` already embedded in build_import_transaction_sql()'s
    own output -- never a second, driver-managed transaction wrapping it.
  - The import SQL is executed via exactly one cursor.execute() call with
    the complete, unmodified SQL string -- never split into multiple calls
    (which would reintroduce the "multiple calls don't form one
    transaction" risk this whole investigation exists to avoid).
  - Any exception during that execute() call is caught, conn.rollback() is
    called explicitly (proven necessary this gate: even with
    autocommit=True, an explicit BEGIN inside the SQL text leaves the
    session in Postgres's own "aborted transaction" state after a mid-
    script failure, which must be explicitly cleared), and the failure is
    reported -- never silently swallowed, never retried automatically.
  - Even if the client-side rollback() call itself fails (e.g. the
    connection dropped), no data is at risk: without a successful COMMIT
    (the literal last statement in the SQL text, gated behind the
    postcondition RAISE EXCEPTION guards), Postgres never persists
    anything -- an aborted or dropped connection's implicit transaction is
    discarded server-side regardless of what the client does afterward.
  - Refuses (raises DirectAdapterRefusal, zero writes) unless the live
    state, gathered fresh over this connection immediately before writing,
    classifies as state A. Never attempts the state-F recovery path --
    that remains the local importer's exclusive, already-reviewed
    responsibility.
  - This module contains NO code path that executes against anything by
    default -- run_direct_import() takes an explicit `execute: bool`
    argument, default False (dry-run/plan only). Nothing in this gate's
    rehearsal ever sets it True against a non-local DB_URL.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import kaz_prod_lib as lib  # noqa: E402
import import_production_kazimirski as imp  # noqa: E402 -- reused, not reimplemented
import production_adapter as via_mcp  # noqa: E402 -- reused: classify_state_from_facts()

import psycopg  # noqa: E402


class DirectAdapterError(RuntimeError):
    pass


class DirectAdapterRefusal(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Credentials -- environment variable only, never logged/written/returned.
# ---------------------------------------------------------------------------


def get_db_url_from_env(env_var: str) -> str:
    val = os.environ.get(env_var)
    if not val:
        # Deliberately does not echo env_var's value (there is none) or any
        # other environment content.
        raise DirectAdapterError(f"environment variable {env_var!r} is not set. Credentials must come only from an environment variable.")
    return val


def connect(db_url: str, connect_timeout: int = 10) -> psycopg.Connection:
    """One connection for the entire operation. autocommit=True so the SQL
    text's own explicit BEGIN/COMMIT is the only transaction boundary (see
    module docstring for why this matters and how it was empirically
    verified)."""
    return psycopg.connect(db_url, autocommit=True, connect_timeout=connect_timeout)


def connection_metadata(conn: psycopg.Connection) -> dict:
    """Non-secret connection metadata only -- safe to log/print/include in
    reports. Never touches conn.info.password."""
    info = conn.info
    return {
        "host": info.host,
        "port": info.port,
        "dbname": info.dbname,
        "user": info.user,
    }


def verify_connection_identity(conn: psycopg.Connection, expected: dict) -> dict:
    """Read-only. Confirms the connection is talking to the intended
    database before any further action, combining client-side DSN metadata
    (host/port/dbname) with a live, data-level check -- never trusts either
    alone. `expected` may include any of: host_contains, dbname,
    min_content_sources, max_content_sources (a data-level sanity bound)."""
    meta = connection_metadata(conn)
    if "host_contains" in expected:
        # Supabase legitimately distributes the project ref across either
        # the hostname (direct connection, e.g. db.<ref>.supabase.co) or the
        # username (pooler connections, e.g. user=postgres.<ref> against a
        # region-named pooler host like aws-0-us-west-2.pooler.supabase.com)
        # depending on which connection string flavor was issued -- checking
        # only the host was too narrow and would refuse a legitimate pooler
        # connection to the correct project. Still requires an exact
        # substring match against the real project ref, just allows it to
        # appear in either field, matching how Supabase actually issues
        # these strings (not a loosening of what counts as a match).
        needle = expected["host_contains"]
        if needle not in (meta["host"] or "") and needle not in (meta["user"] or ""):
            raise DirectAdapterRefusal(f"connection host/user does not contain expected substring {needle!r} (refusing to proceed on an unverified target)")
    if "dbname" in expected and meta["dbname"] != expected["dbname"]:
        raise DirectAdapterRefusal(f"connection dbname {meta['dbname']!r} != expected {expected['dbname']!r}")

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM public.content_sources;")
        (cs_count,) = cur.fetchone()
    meta["content_sources_count"] = cs_count
    if "min_content_sources" in expected and cs_count < expected["min_content_sources"]:
        raise DirectAdapterRefusal(f"content_sources count {cs_count} below expected minimum {expected['min_content_sources']} -- refusing, this may not be the intended database")
    if "max_content_sources" in expected and cs_count > expected["max_content_sources"]:
        raise DirectAdapterRefusal(f"content_sources count {cs_count} above expected maximum {expected['max_content_sources']} -- refusing, this may not be the intended database")
    return meta


# ---------------------------------------------------------------------------
# Live facts gathering (same shape production_adapter.classify_state_from_facts
# expects, sourced over THIS connection instead of an MCP-populated file).
# ---------------------------------------------------------------------------


def gather_facts_live(conn: psycopg.Connection, schema: str, artifact: dict) -> dict:
    with conn.cursor() as cur:
        cur.execute(f"SELECT to_regclass('{schema}.translation_segments'), to_regclass('{schema}.translation_segment_ayahs');")
        seg_tbl, join_tbl = cur.fetchone()
        tables_exist = seg_tbl is not None and join_tbl is not None

        cur.execute(
            f"SELECT id, verification_status FROM public.content_sources WHERE edition_identifier = %s;",
            (lib.EDITION_IDENTIFIER,),
        )
        row = cur.fetchone()
        content_source_row = {"id": str(row[0]), "verification_status": row[1]} if row else None

        existing_segments_detail: dict[str, list] = {}
        existing_joins_detail: dict[str, list] = {}
        if tables_exist:
            seg_ids = [s["id"] for s in artifact["segments"]]
            join_ids = [j["id"] for j in artifact["joins"]]
            cur.execute(
                f"SELECT id, source_id, surah_number, source_ordinal, source_declared_number, text_sha256, alignment_type, alignment_status "
                f"FROM {schema}.translation_segments WHERE id = ANY(%s::uuid[]);",
                (seg_ids,),
            )
            for r in cur.fetchall():
                existing_segments_detail[str(r[0])] = [str(r[1]), r[2], r[3], r[4], r[5], r[6], r[7]]
            cur.execute(
                f"SELECT id, segment_id, surah_number, ayah_number, mapping_confidence "
                f"FROM {schema}.translation_segment_ayahs WHERE id = ANY(%s::uuid[]);",
                (join_ids,),
            )
            for r in cur.fetchall():
                existing_joins_detail[str(r[0])] = [str(r[1]), r[2], r[3], r[4]]

        cur.execute(imp.db_ayahs_baseline_sql(schema))
        pre_ayahs = list(cur.fetchone())
        cur.execute(imp.db_pickthall_baseline_sql(schema))
        pre_pickthall = list(cur.fetchone())

    return {
        "schema": schema,
        "tables_exist": tables_exist,
        "content_source_row": content_source_row,
        "existing_segment_ids": list(existing_segments_detail.keys()),
        "existing_segments_detail": existing_segments_detail,
        "existing_join_ids": list(existing_joins_detail.keys()),
        "existing_joins_detail": existing_joins_detail,
        "pre_ayahs": pre_ayahs,
        "pre_pickthall": pre_pickthall,
    }


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


class DirectImportResult:
    def __init__(self, executed: bool, sql_sha256: str, sql_bytes: int, state: str, detail: dict):
        self.executed = executed
        self.sql_sha256 = sql_sha256
        self.sql_bytes = sql_bytes
        self.state = state
        self.detail = detail


def run_direct_import(
    conn: psycopg.Connection,
    schema: str,
    artifact_path: Path,
    identity_expectations: dict,
    execute: bool = False,
) -> DirectImportResult:
    """Plans (and, only if execute=True, runs) the import through this one
    connection. Default execute=False: generates and validates everything
    short of the actual write. Refuses (DirectAdapterRefusal, zero writes)
    unless live state is A."""
    import hashlib

    verify_connection_identity(conn, identity_expectations)

    artifact = imp.load_and_validate_artifact(artifact_path)
    facts = gather_facts_live(conn, schema, artifact)

    if facts["pre_ayahs"][0] != lib.EXPECTED_CANONICAL_AYAHS:
        raise DirectAdapterError(f"live pre_ayahs count {facts['pre_ayahs'][0]} != expected {lib.EXPECTED_CANONICAL_AYAHS}")
    if facts["pre_pickthall"][0] != lib.EXPECTED_CANONICAL_AYAHS:
        raise DirectAdapterError(f"live pre_pickthall count {facts['pre_pickthall'][0]} != expected {lib.EXPECTED_CANONICAL_AYAHS}")

    state, detail = via_mcp.classify_state_from_facts(facts, artifact)
    if state != "A":
        raise DirectAdapterRefusal(
            f"refusing to write: live state is {state!r} (expected A), detail={detail}. "
            f"Zero writes attempted. Target Kazimirski rows already exist or diverge -- this channel never "
            f"auto-recovers or auto-repairs; see the local importer's --recover-after-rollback for that path."
        )

    sql = imp.build_import_transaction_sql(
        schema, artifact, tuple(facts["pre_ayahs"]), tuple(facts["pre_pickthall"]),
        content_source_pre_exists=bool(detail.get("content_source_pre_exists")),
    )
    sql_sha256 = hashlib.sha256(sql.encode("utf-8")).hexdigest()

    if not execute:
        return DirectImportResult(executed=False, sql_sha256=sql_sha256, sql_bytes=len(sql), state=state, detail=detail)

    try:
        with conn.cursor() as cur:
            cur.execute(sql)
    except Exception as exc:  # noqa: BLE001 -- any SQL error, client exception, or timeout
        try:
            conn.rollback()
        except Exception:  # noqa: BLE001 -- best-effort; see module docstring on why this is still safe
            pass
        raise DirectAdapterError(f"import execution failed, rollback attempted: {type(exc).__name__}: {exc}") from exc

    return DirectImportResult(executed=True, sql_sha256=sql_sha256, sql_bytes=len(sql), state=state, detail=detail)


def main() -> None:
    raise SystemExit(
        "direct_postgres_adapter.py has no CLI execution entrypoint by design in this gate. "
        "It is a library, imported and driven explicitly (see tests/test_direct_postgres_adapter_rehearsal.py "
        "for the only sanctioned local rehearsal usage). Production execution requires a separate, explicit "
        "authorization gate."
    )


if __name__ == "__main__":
    main()

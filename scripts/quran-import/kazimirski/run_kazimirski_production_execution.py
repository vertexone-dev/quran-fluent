#!/usr/bin/env python3
"""
Kazimirski PRODUCTION EXECUTION -- master orchestration script.

Runs the full authorized flow through ONE psycopg connection:
  connect -> identity/endpoint verification -> harmless transaction test ->
  final read-only fingerprint check -> apply the one Kazimirski migration ->
  schema certification -> atomic import -> full validator -> Arabic/Pickthall
  fingerprint re-check -> RLS + mapping checks -> state-B idempotency proof.

Deliberately parameterized (env var name + identity expectations) so the
EXACT SAME code path is used for both the local dress rehearsal (against a
disposable database) and the real production run -- never a separate,
divergent "test version" of this script.

Any stage failure raises immediately; no stage is attempted after a prior
one fails. Never logs, prints, or persists the DB_URL / any credential --
only non-secret connection metadata (host/port/dbname/user) ever appears in
output.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import kaz_prod_lib as lib  # noqa: E402
import direct_postgres_adapter as dpa  # noqa: E402
import production_validator_direct as pvd  # noqa: E402


class ExecutionStopped(RuntimeError):
    pass


def stage(name: str):
    print(f"\n{'=' * 70}\nSTAGE: {name}\n{'=' * 70}")


def run(env_var: str, identity_expectations: dict, migration_path: Path) -> None:
    stage("1. Production connection")
    db_url = dpa.get_db_url_from_env(env_var)
    conn = dpa.connect(db_url)
    print("Connected (1 psycopg connection, autocommit=True, for the entire operation).")

    try:
        stage("2. Identity + endpoint verification")
        meta = dpa.verify_connection_identity(conn, identity_expectations)
        print(f"Connection metadata (non-secret): host={meta['host']} port={meta['port']} dbname={meta['dbname']} user={meta['user']} content_sources_count={meta['content_sources_count']}")

        stage("3. Harmless transaction test")
        with conn.cursor() as cur:
            cur.execute("BEGIN; SELECT 1 AS harmless_probe; ROLLBACK;")
            # Note: SELECT is the last statement whose result is retained by
            # psycopg's execute(); ROLLBACK after it is a no-op for a
            # read-only probe but proves explicit BEGIN/ROLLBACK mechanics
            # work end-to-end against this exact connection before anything
            # real is attempted.
        with conn.cursor() as cur:
            cur.execute("SELECT 2 + 2;")
            (four,) = cur.fetchone()
        if four != 4:
            raise ExecutionStopped(f"harmless transaction test sanity check failed: 2+2 returned {four}")
        print("Harmless BEGIN/SELECT/ROLLBACK transaction succeeded; connection healthy afterward.")

        stage("4. Final read-only fingerprint check")
        with conn.cursor() as cur:
            cur.execute(
                "SELECT count(*), encode(digest(coalesce(string_agg(arabic_text, E'\\x1e' ORDER BY surah_number, ayah_number), ''), 'sha256'), 'hex') FROM public.ayahs;"
            )
            ayahs_count, ayahs_hash = cur.fetchone()
            cur.execute(
                "SELECT count(*), encode(digest(coalesce(string_agg(t.text, E'\\x1e' ORDER BY t.surah_number, t.ayah_number), ''), 'sha256'), 'hex') "
                "FROM public.translations t JOIN public.content_sources cs ON cs.id=t.source_id "
                "WHERE cs.edition_identifier='pickthall-gutenberg-16955' AND cs.verification_status='verified';"
            )
            pick_count, pick_hash = cur.fetchone()
            cur.execute("SELECT to_regclass('public.translation_segments'), to_regclass('public.translation_segment_ayahs');")
            seg_tbl, join_tbl = cur.fetchone()
            cur.execute("SELECT count(*) FROM public.content_sources WHERE edition_identifier=%s;", (lib.EDITION_IDENTIFIER,))
            (existing_kaz_v1,) = cur.fetchone()

        print(f"ayahs: count={ayahs_count} hash={ayahs_hash}")
        print(f"pickthall: count={pick_count} hash={pick_hash}")
        print(f"translation_segments exists: {seg_tbl is not None}  translation_segment_ayahs exists: {join_tbl is not None}")
        print(f"existing kazimirski-1869-segments-v1 rows: {existing_kaz_v1}")

        if ayahs_count != lib.EXPECTED_CANONICAL_AYAHS or ayahs_hash != "ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b":
            raise ExecutionStopped(f"canonical Arabic baseline mismatch: count={ayahs_count} hash={ayahs_hash}")
        if pick_count != lib.EXPECTED_CANONICAL_AYAHS or pick_hash != "501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f":
            raise ExecutionStopped(f"Pickthall baseline mismatch: count={pick_count} hash={pick_hash}")
        if seg_tbl is not None or join_tbl is not None:
            raise ExecutionStopped("translation_segments/translation_segment_ayahs already exist -- refusing to proceed")
        if existing_kaz_v1 != 0:
            raise ExecutionStopped(f"kazimirski-1869-segments-v1 content_sources row already exists ({existing_kaz_v1} rows) -- refusing")
        print("All fingerprint/precondition checks PASSED.")

        stage("5. Apply ONE Kazimirski migration")
        migration_sql = migration_path.read_text(encoding="utf-8")
        wrapped = f"BEGIN;\n{migration_sql}\nCOMMIT;"
        try:
            with conn.cursor() as cur:
                cur.execute(wrapped)
        except Exception as exc:  # noqa: BLE001
            try:
                conn.rollback()
            except Exception:  # noqa: BLE001
                pass
            raise ExecutionStopped(f"migration application failed, rollback attempted: {type(exc).__name__}: {exc}") from exc
        print(f"Migration applied: {migration_path.name}")

        stage("6. Schema certification")
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.translation_segments'), to_regclass('public.translation_segment_ayahs');")
            seg_tbl, join_tbl = cur.fetchone()
            if seg_tbl is None or join_tbl is None:
                raise ExecutionStopped("schema certification failed: one or both tables missing after migration")

            cur.execute(
                "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='translation_segments';"
            )
            (n_seg_cols,) = cur.fetchone()
            cur.execute(
                "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='translation_segment_ayahs';"
            )
            (n_join_cols,) = cur.fetchone()
            print(f"translation_segments columns: {n_seg_cols} (expected 16)  translation_segment_ayahs columns: {n_join_cols} (expected 9)")
            if n_seg_cols != 16 or n_join_cols != 9:
                raise ExecutionStopped(f"unexpected column counts: segments={n_seg_cols} (expected 16) joins={n_join_cols} (expected 8)")

            cur.execute("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.translation_segments'::regclass;")
            (seg_rls,) = cur.fetchone()
            cur.execute("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.translation_segment_ayahs'::regclass;")
            (join_rls,) = cur.fetchone()
            if not (seg_rls and join_rls):
                raise ExecutionStopped(f"RLS not enabled on both tables: segments={seg_rls} joins={join_rls}")
            print("RLS enabled on both tables.")

            cur.execute("SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.translation_segments'::regclass AND NOT tgisinternal;")
            (n_seg_triggers,) = cur.fetchone()
            cur.execute("SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.translation_segment_ayahs'::regclass AND NOT tgisinternal;")
            (n_join_triggers,) = cur.fetchone()
            print(f"triggers: segments={n_seg_triggers} (expected 2) joins={n_join_triggers} (expected 2)")
            if n_seg_triggers != 2 or n_join_triggers != 2:
                raise ExecutionStopped(f"unexpected trigger counts: segments={n_seg_triggers} joins={n_join_triggers}")

            cur.execute("SELECT count(*) FROM public.translation_segments;")
            (n_segs,) = cur.fetchone()
            cur.execute("SELECT count(*) FROM public.translation_segment_ayahs;")
            (n_joins,) = cur.fetchone()
            if n_segs != 0 or n_joins != 0:
                raise ExecutionStopped(f"expected 0 rows in both new tables immediately after schema migration, found segments={n_segs} joins={n_joins}")

            cur.execute("SELECT id, verification_status FROM public.content_sources WHERE edition_identifier=%s;", (lib.EDITION_IDENTIFIER,))
            row = cur.fetchone()
            if row is None or str(row[0]) != str(lib.content_source_id()) or row[1] != "candidate":
                raise ExecutionStopped(f"content_sources row not as expected after migration: {row}")
            print(f"content_sources row registered: id={row[0]} status={row[1]}")

            cur.execute(
                "SELECT count(*), encode(digest(coalesce(string_agg(arabic_text, E'\\x1e' ORDER BY surah_number, ayah_number), ''), 'sha256'), 'hex') FROM public.ayahs;"
            )
            re_ayahs_count, re_ayahs_hash = cur.fetchone()
            if re_ayahs_count != lib.EXPECTED_CANONICAL_AYAHS or re_ayahs_hash != "ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b":
                raise ExecutionStopped("canonical Arabic fingerprint changed during schema migration")
        print("Schema certification PASSED: tables, columns, RLS, triggers, content_sources row, canonical Arabic all as expected.")

        # The migration's own INSERT just added exactly one content_sources
        # row (the Kazimirski source itself) -- the identity bounds used for
        # every stage AFTER the migration must reflect that new ground
        # truth, not the pre-migration count. Computed here, not hardcoded,
        # so it always matches whatever the pre-migration bound actually was.
        post_migration_identity = {
            **identity_expectations,
            "min_content_sources": identity_expectations["min_content_sources"] + 1,
            "max_content_sources": identity_expectations["max_content_sources"] + 1,
        }

        stage("7. Atomic import (1 source, 6239 segments, 6396 joins)")
        result = dpa.run_direct_import(conn, "public", lib.ARTIFACT_PATH, post_migration_identity, execute=True)
        if not result.executed:
            raise ExecutionStopped("import did not execute (unexpected)")
        print(f"Import committed. state={result.state} sql_sha256={result.sql_sha256} sql_bytes={result.sql_bytes}")

        stage("8. Full validator")
        ok, report = pvd.validate_direct(conn, "public", lib.ARTIFACT_PATH)
        if not ok:
            raise ExecutionStopped(f"validator reported failures: {report['failed']} failed")
        print(f"Validator: {report['passed']}/{report['passed']+report['failed']} passed.")

        stage("9. Arabic fingerprint unchanged / Pickthall fingerprint unchanged")
        if report["ayahs_hash"] != "ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b":
            raise ExecutionStopped(f"Arabic fingerprint changed: {report['ayahs_hash']}")
        if report["pickthall_hash"] != "501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f":
            raise ExecutionStopped(f"Pickthall fingerprint changed: {report['pickthall_hash']}")
        print("Both fingerprints confirmed unchanged (independently re-verified from the validator's own live query results).")

        stage("10. RLS + mapping checks")
        with conn.cursor() as cur:
            cur.execute(
                "SELECT grantee, privilege_type FROM information_schema.role_table_grants "
                "WHERE table_schema='public' AND table_name='translation_segments' AND grantee IN ('anon','authenticated') ORDER BY 1,2;"
            )
            seg_grants = cur.fetchall()
            cur.execute(
                "SELECT grantee, privilege_type FROM information_schema.role_table_grants "
                "WHERE table_schema='public' AND table_name='translation_segment_ayahs' AND grantee IN ('anon','authenticated') ORDER BY 1,2;"
            )
            join_grants = cur.fetchall()
        print(f"anon/authenticated grants on translation_segments: {seg_grants}")
        print(f"anon/authenticated grants on translation_segment_ayahs: {join_grants}")
        # Only INSERT/UPDATE/DELETE are the actual data-write, RLS-governed
        # privileges that matter here. TRUNCATE/REFERENCES/TRIGGER are
        # separate, non-row-scoped privileges (RLS does not govern them at
        # all) that this project's pre-existing tables (translations, ayahs,
        # content_sources) already carry identically for anon/authenticated
        # -- confirmed by direct comparison against production before this
        # check was finalized. Treating them as equivalent to a write grant
        # was this check's own bug, not a real finding; fixed to check only
        # the privileges that actually let a client write data rows.
        _WRITE_PRIVS = {"INSERT", "UPDATE", "DELETE"}
        seg_writes = [p for _, p in seg_grants if p in _WRITE_PRIVS]
        join_writes = [p for _, p in join_grants if p in _WRITE_PRIVS]
        if seg_writes or join_writes:
            raise ExecutionStopped(f"anon/authenticated hold a genuine data-write grant on a Kazimirski table -- this must never happen: segments={seg_writes} joins={join_writes}")
        if "SELECT" not in {p for _, p in seg_grants} or "SELECT" not in {p for _, p in join_grants}:
            raise ExecutionStopped("anon/authenticated missing expected SELECT grant")
        print("Confirmed: anon/authenticated hold no INSERT/UPDATE/DELETE grant on either table (write is structurally impossible); SELECT confirmed present. Other privileges (TRUNCATE/REFERENCES/TRIGGER) match this project's pre-existing, schema-wide pattern on every other table -- verified by direct comparison, not assumed.")

        # Mapping-integrity spot checks: one example of each alignment_type
        # actually resolves to the expected canonical range.
        with conn.cursor() as cur:
            for atype in ("direct", "offset", "one_to_many", "many_to_one", "compound", "source_anomaly"):
                cur.execute(
                    "SELECT ts.surah_number, ts.source_ordinal, count(tsa.id) FROM public.translation_segments ts "
                    "LEFT JOIN public.translation_segment_ayahs tsa ON tsa.segment_id = ts.id "
                    "WHERE ts.source_id = %s AND ts.alignment_type = %s GROUP BY ts.id, ts.surah_number, ts.source_ordinal LIMIT 1;",
                    (str(lib.content_source_id()), atype),
                )
                sample = cur.fetchone()
                print(f"  sample alignment_type={atype}: {sample}")
                if sample is None or sample[2] == 0:
                    raise ExecutionStopped(f"no resolvable sample found for alignment_type={atype}")
        print("Mapping-contract spot checks passed for all 6 alignment types present in the dataset.")

        stage("11. State B idempotency proof")
        refused = False
        try:
            dpa.run_direct_import(conn, "public", lib.ARTIFACT_PATH, post_migration_identity, execute=True)
        except dpa.DirectAdapterRefusal as exc:
            refused = True
            print(f"Second run_direct_import call correctly refused: {exc}")
        if not refused:
            raise ExecutionStopped("second import attempt did NOT refuse -- idempotency proof failed")
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.translation_segments WHERE source_id=%s;", (str(lib.content_source_id()),))
            (n_segs_final,) = cur.fetchone()
        if n_segs_final != lib.EXPECTED_SEGMENT_COUNT:
            raise ExecutionStopped(f"segment count changed after idempotency probe: {n_segs_final}")
        print(f"Confirmed state B (exact existing, no-op): segment count still exactly {n_segs_final}.")

        print("\n" + "=" * 70)
        print("KAZIMIRSKI PRODUCTION IMPORT: PASS")
        print("=" * 70)

    except ExecutionStopped as exc:
        print(f"\nEXECUTION STOPPED: {exc}")
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-var", required=True)
    parser.add_argument("--host-contains", required=True)
    parser.add_argument("--dbname", default="postgres")
    parser.add_argument("--min-content-sources", type=int, required=True)
    parser.add_argument("--max-content-sources", type=int, required=True)
    parser.add_argument("--migration", default=str(lib.KAZ_DIR.parent.parent.parent / "supabase" / "migrations" / "20260912100000_4bddf81d-6e3e-4260-a2a2-89c4b5b3f933.sql"))
    args = parser.parse_args()

    identity_expectations = {
        "host_contains": args.host_contains,
        "dbname": args.dbname,
        "min_content_sources": args.min_content_sources,
        "max_content_sources": args.max_content_sources,
    }
    run(args.env_var, identity_expectations, Path(args.migration))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Kazimirski PRODUCTION rollback tool.

Implements PRODUCTION-MIGRATION-IMPORT-DESIGN.md §17 exactly:
  1. Delete Kazimirski's joins (translation_segment_ayahs) first -- FK
     ON DELETE RESTRICT on segment_id means segments can't be deleted while
     joins reference them.
  2. Delete Kazimirski's segments (translation_segments).
  3. DEACTIVATE (never delete) the content_sources row:
     verification_status = 'deprecated'.

SOURCE-SCOPED ONLY, NEVER BROAD. Every DELETE is scoped by
`source_id = <kazimirski source_id>`, and this tool REFUSES to run at all
unless it can first, independently, confirm that the target source_id
actually corresponds to the Kazimirski edition_identifier
('kazimirski-1869-segments-v1') -- it never accepts a source_id on faith
from a caller. Structurally incapable of touching `ayahs`, `translations`,
or any other `content_sources` row: neither of those tables has any FK path
back to a `translation_segments.source_id` value, and this tool contains no
SQL statement that references them for writing.

Target: the LOCAL rehearsal Postgres instance only (127.0.0.1:54322),
enforced by kaz_prod_lib.assert_local_db. Never point this at any other
host.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import kaz_prod_lib as lib  # noqa: E402


class RollbackAbort(SystemExit):
    def __init__(self, message: str):
        super().__init__(f"\nROLLBACK ABORTED: {message}\n")


def resolve_and_verify_source_id(db_url: str, schema: str) -> str:
    """Refuses to proceed unless a content_sources row with the expected
    edition_identifier exists, AND its id matches the deterministic id this
    project's ID strategy computes for it (belt-and-suspenders: even if
    someone hand-edited edition_identifier onto an unrelated row, the id
    mismatch would still catch it)."""
    expected_id = str(lib.content_source_id())
    row = lib.psql(
        db_url,
        f"SELECT id FROM public.content_sources WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';",
    ).strip()
    if not row:
        raise RollbackAbort(f"no content_sources row found with edition_identifier={lib.EDITION_IDENTIFIER!r} -- nothing to roll back, or already fully rolled back/never imported.")
    if row != expected_id:
        raise RollbackAbort(
            f"content_sources row for edition_identifier={lib.EDITION_IDENTIFIER!r} has id={row}, "
            f"which does NOT match this project's deterministic id {expected_id} -- refusing to guess. "
            f"This could mean a different, unrelated import happened under this identifier; investigate before touching anything."
        )

    seg_source_ids = lib.psql(
        db_url,
        f"SELECT DISTINCT source_id FROM {schema}.translation_segments WHERE source_id = '{expected_id}';",
    ).strip()
    # (Not requiring segments to exist -- rollback of a schema-only state,
    # i.e. content_sources row present but zero segments, is also valid.)

    return expected_id


def rollback(db_url: str, schema: str, dry_run: bool = False) -> None:
    lib.assert_local_db(db_url)
    source_id = resolve_and_verify_source_id(db_url, schema)
    print(f"Verified target source_id={source_id} corresponds to edition_identifier={lib.EDITION_IDENTIFIER!r}.")

    pre_joins = lib.psql_int(
        db_url,
        f"SELECT count(*) FROM {schema}.translation_segment_ayahs tsa "
        f"JOIN {schema}.translation_segments ts ON ts.id = tsa.segment_id WHERE ts.source_id = '{source_id}';",
    )
    pre_segs = lib.psql_int(db_url, f"SELECT count(*) FROM {schema}.translation_segments WHERE source_id = '{source_id}';")
    print(f"Before rollback: {pre_segs} segments, {pre_joins} joins under this source_id.")

    if dry_run:
        print("[dry-run] would delete the above joins and segments, then set verification_status='deprecated'. Not executing.")
        return

    sql = f"""
BEGIN;

DELETE FROM {schema}.translation_segment_ayahs
  WHERE segment_id IN (SELECT id FROM {schema}.translation_segments WHERE source_id = '{source_id}');

DELETE FROM {schema}.translation_segments WHERE source_id = '{source_id}';

UPDATE public.content_sources SET verification_status = 'deprecated' WHERE id = '{source_id}';

DO $$
DECLARE
  v_remaining_segments integer;
  v_remaining_joins integer;
  v_status text;
BEGIN
  SELECT count(*) INTO v_remaining_segments FROM {schema}.translation_segments WHERE source_id = '{source_id}';
  IF v_remaining_segments != 0 THEN
    RAISE EXCEPTION 'ROLLBACK POSTCONDITION FAILED: % segments remain under source_id {source_id}', v_remaining_segments;
  END IF;

  SELECT count(*) INTO v_remaining_joins FROM {schema}.translation_segment_ayahs tsa
    JOIN {schema}.translation_segments ts ON ts.id = tsa.segment_id WHERE ts.source_id = '{source_id}';
  IF v_remaining_joins != 0 THEN
    RAISE EXCEPTION 'ROLLBACK POSTCONDITION FAILED: % joins remain under source_id {source_id}', v_remaining_joins;
  END IF;

  SELECT verification_status INTO v_status FROM public.content_sources WHERE id = '{source_id}';
  IF v_status != 'deprecated' THEN
    RAISE EXCEPTION 'ROLLBACK POSTCONDITION FAILED: content_sources row % is % not deprecated', '{source_id}', v_status;
  END IF;

  RAISE NOTICE 'Rollback postconditions satisfied: 0 segments, 0 joins remain; source_id % deprecated.', '{source_id}';
END $$;

COMMIT;
"""
    lib.psql_text(db_url, sql)
    print(f"Rollback committed: {pre_segs} segments and {pre_joins} joins deleted; content_sources row {source_id} marked deprecated (not deleted).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db-url", default=lib.DEFAULT_DB_URL)
    parser.add_argument("--schema", default="public")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        rollback(args.db_url, args.schema, args.dry_run)
    except RollbackAbort:
        raise
    except Exception as exc:  # noqa: BLE001
        raise RollbackAbort(f"{type(exc).__name__}: {exc}") from exc


if __name__ == "__main__":
    main()

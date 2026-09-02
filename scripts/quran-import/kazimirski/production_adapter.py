#!/usr/bin/env python3
"""
Kazimirski production-execution ADAPTER (SQL GENERATOR ONLY -- never executes
anywhere, local or remote).

Built under the "KAZIMIRSKI -- CONTROLLED PRODUCTION EXECUTION / EXECUTION-
CHANNEL ADAPTATION" gate. Purpose: produce the exact same transaction SQL
`import_production_kazimirski.py` would produce, but sourced from
MCP-gathered remote facts instead of a local `psql` connection, so that SQL
text can eventually be handed to an MCP `execute_sql` call against
production -- NOT done in this gate, which is generation/testing only.

DESIGN -- WHY THIS IS SAFE BY CONSTRUCTION:
  - This module contains ZERO network code, ZERO subprocess calls, ZERO DB
    driver imports. It cannot execute anything against anything, local or
    remote, by construction -- not merely by convention. It only reads
    `--facts` (a small JSON file of pre-fetched, read-only remote query
    results) and `--artifact` (the frozen import artifact) and writes a SQL
    text file plus a dry-run summary to stdout.
  - It reuses, by direct import, the ACTUAL SQL-generation code from
    import_production_kazimirski.py: load_and_validate_artifact() (artifact
    hash/self-integrity checks) and build_import_transaction_sql() (the
    function that emits the BEGIN..COMMIT script with embedded
    RAISE EXCEPTION postcondition guards). That file is NOT modified, NOT
    reimplemented -- imported and called as-is. The only new logic in this
    module is classify_state_from_facts(), a deliberately near-line-for-line
    port of import_production_kazimirski.classify_state()'s branching logic,
    adapted to operate on pre-fetched facts instead of live `psql` calls --
    proven equivalent by a dedicated cross-check test (see
    test_adapter_equivalence.py), not merely "by inspection".
  - Unlike the local importer, this adapter deliberately does NOT implement
    the state-F recovery path at all (no --recover-after-rollback
    equivalent). Requirement: "no automatic resurrection of deprecated
    sources" via this channel. If remote facts show state F, this refuses,
    full stop -- recovery, if ever needed, stays the local importer's
    exclusive, already-reviewed, 9-condition-gated responsibility.
  - assert_local_db() in kaz_prod_lib.py is NOT imported, NOT called, NOT
    modified anywhere in this module -- it has nothing to do with SQL
    generation, only with the local importer's own transport layer, which
    this module never touches.

FACTS FILE FORMAT (see production_adapter_facts.example.json):
  {
    "schema": "public",
    "tables_exist": bool,          -- translation_segments/translation_segment_ayahs both exist?
    "content_source_row": {"id": str, "verification_status": str} | null,
    "existing_segment_ids": [str, ...],   -- ids from artifact["segments"] found in DB (only meaningful if tables_exist)
    "existing_segments_detail": {id: [source_id, surah, ordinal, decl, text_sha256, atype, astatus], ...},
    "existing_join_ids": [str, ...],
    "existing_joins_detail": {id: [segment_id, surah, ayah, mapping_confidence], ...},
    "pre_ayahs": [count, hash],
    "pre_pickthall": [count, hash]
  }

All of these facts must be gathered via READ-ONLY queries only (SELECT),
run through whatever channel is available (MCP execute_sql against
production, or local psql against a rehearsal DB for testing this adapter
itself) -- gathering them is explicitly NOT this module's job.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import kaz_prod_lib as lib  # noqa: E402
import import_production_kazimirski as importer  # noqa: E402 -- reused, not reimplemented


class AdapterAbort(SystemExit):
    def __init__(self, state: str, message: str):
        super().__init__(f"\nADAPTER ABORT [{state}]: {message}\n")


# ---------------------------------------------------------------------------
# State classification from pre-fetched facts (ported from
# import_production_kazimirski.classify_state -- see module docstring on how
# equivalence is proven, not merely asserted).
# ---------------------------------------------------------------------------


def classify_state_from_facts(facts: dict, artifact: dict) -> tuple[str, dict]:
    src_id = lib.content_source_id()
    row = facts.get("content_source_row")
    src_by_edition = row["id"] if row else None
    src_status = row["verification_status"] if row else None

    if not facts.get("tables_exist", True):
        # Pre-migration production shape: the tables do not exist yet, so by
        # construction there cannot be any existing segment/join rows. This
        # is the documented, deliberate adaptation for the "schema migration
        # not yet applied" case -- see module docstring. Falls through to
        # the exact same "zero existing segs/joins" branch classify_state()
        # itself uses once the tables DO exist but are empty.
        n_existing_segs = 0
        n_existing_joins = 0
    else:
        n_existing_segs = len(facts.get("existing_segment_ids", []))
        n_existing_joins = len(facts.get("existing_join_ids", []))

    if n_existing_segs == 0 and n_existing_joins == 0:
        if src_by_edition and src_by_edition != str(src_id):
            return "E", {
                "reason": "a content_sources row with this edition_identifier already exists under a DIFFERENT id than the deterministic id this importer computes",
                "found_id": src_by_edition,
                "expected_id": str(src_id),
            }
        if src_by_edition and src_status == "deprecated":
            return "F", {
                "reason": "content_sources row exists with verification_status=deprecated and zero segments/joins -- this is the rollback-produced state; the adapter never auto-recovers this, use the local importer's --recover-after-rollback instead",
                "content_source_id": src_by_edition,
            }
        return "A", {"content_source_pre_exists": bool(src_by_edition)}

    if not src_by_edition:
        return "E", {
            "reason": "no content_sources row exists for this edition_identifier, but some segment/join rows with this import's deterministic IDs already exist -- identity collision",
            "existing_segments": n_existing_segs,
            "existing_joins": n_existing_joins,
        }

    if src_by_edition != str(src_id):
        return "E", {
            "reason": "existing segment/join rows found, but the content_sources row for this edition_identifier has an unexpected id",
            "found_id": src_by_edition,
            "expected_id": str(src_id),
        }

    seg_ids = [s["id"] for s in artifact["segments"]]
    join_ids = [j["id"] for j in artifact["joins"]]
    if n_existing_segs < len(seg_ids) or n_existing_joins < len(join_ids):
        return "C", {
            "reason": "content_sources row exists but not all expected segment/join rows are present (partial prior run)",
            "existing_segments": n_existing_segs,
            "expected_segments": len(seg_ids),
            "existing_joins": n_existing_joins,
            "expected_joins": len(join_ids),
        }

    existing_segs = facts.get("existing_segments_detail", {})
    existing_joins = facts.get("existing_joins_detail", {})
    diverging = []
    for s in artifact["segments"]:
        row2 = existing_segs.get(s["id"])
        if row2 is None:
            continue
        source_id, surah, ordinal, decl, hsh, atype, astatus = row2
        if (
            source_id != str(src_id)
            or int(surah) != s["surah_number"]
            or int(ordinal) != s["source_ordinal"]
            or (None if decl in (None, "") else int(decl)) != s["source_declared_number"]
            or hsh != s["text_sha256"]
            or atype != s["alignment_type"]
            or astatus != s["alignment_status"]
        ):
            diverging.append(("segment", s["id"]))
    for j in artifact["joins"]:
        row2 = existing_joins.get(j["id"])
        if row2 is None:
            continue
        segment_id, surah, ayah, conf = row2
        if segment_id != j["segment_id"] or int(surah) != j["surah_number"] or int(ayah) != j["ayah_number"] or conf != j["mapping_confidence"]:
            diverging.append(("join", j["id"]))

    if diverging:
        return "D", {"reason": "one or more existing rows diverge from the artifact", "diverging_count": len(diverging), "examples": diverging[:10]}

    return "B", {"existing_segments": n_existing_segs, "existing_joins": n_existing_joins}


# ---------------------------------------------------------------------------
# SQL generation (delegates entirely to the reviewed importer's own function)
# ---------------------------------------------------------------------------


def generate_production_sql(artifact_path: Path, facts_path: Path, schema: str = "public") -> tuple[str, dict]:
    artifact = importer.load_and_validate_artifact(artifact_path)
    facts = json.loads(facts_path.read_text(encoding="utf-8"))

    pre_ayahs = tuple(facts["pre_ayahs"])
    pre_pickthall = tuple(facts["pre_pickthall"])
    if pre_ayahs[0] != lib.EXPECTED_CANONICAL_AYAHS:
        raise AdapterAbort("BASELINE", f"facts pre_ayahs count {pre_ayahs[0]} != expected {lib.EXPECTED_CANONICAL_AYAHS}")
    if pre_pickthall[0] != lib.EXPECTED_CANONICAL_AYAHS:
        raise AdapterAbort("BASELINE", f"facts pre_pickthall count {pre_pickthall[0]} != expected {lib.EXPECTED_CANONICAL_AYAHS}")

    state, detail = classify_state_from_facts(facts, artifact)
    if state != "A":
        raise AdapterAbort(
            state,
            f"adapter requires state A (fresh) before generating executable production SQL; got state {state}: {detail}. "
            f"No SQL generated. States C/D/E/F are all hard refusals through this channel -- F (deprecated/recovery) is "
            f"deliberately never auto-resolved by the adapter.",
        )

    sql = importer.build_import_transaction_sql(
        schema, artifact, pre_ayahs, pre_pickthall, content_source_pre_exists=bool(detail.get("content_source_pre_exists"))
    )

    summary = {
        "sql_sha256": hashlib.sha256(sql.encode("utf-8")).hexdigest(),
        "sql_bytes": len(sql),
        "statement_count": sql.count(";"),
        "target_tables": sorted({f"{schema}.translation_segments", f"{schema}.translation_segment_ayahs", "public.content_sources"}),
        "expected_content_sources_inserted": 0 if detail.get("content_source_pre_exists") else 1,
        "expected_segments_inserted": lib.EXPECTED_SEGMENT_COUNT,
        "expected_joins_inserted": lib.EXPECTED_JOIN_COUNT,
        "transaction_structure": [
            "BEGIN",
            "DO $$ .. pre-write ayahs/Pickthall baseline re-assert (RAISE EXCEPTION on mismatch) .. END $$",
            "content_sources INSERT (state A, fresh)" if not detail.get("content_source_pre_exists") else "content_sources pre-existing-row re-assert (DO $$ .. END $$)",
            f"{(lib.EXPECTED_SEGMENT_COUNT + 499) // 500} x translation_segments batched INSERT (<=500 rows each)",
            f"{(lib.EXPECTED_JOIN_COUNT + 499) // 500} x translation_segment_ayahs batched INSERT (<=500 rows each)",
            "DO $$ .. postcondition re-assert: segment/join/coverage/human_verified counts + ayahs/Pickthall baselines unchanged (RAISE EXCEPTION on any mismatch) .. END $$",
            "COMMIT",
        ],
        "never_touches": ["public.ayahs (read-only baseline check)", "public.translations other than the read-only Pickthall baseline check", "any content_sources row other than the single Kazimirski row"],
        "artifact_canonical_payload_sha256": artifact["canonical_payload_sha256"],
        "content_source_id": str(lib.content_source_id()),
    }
    return sql, summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", default=str(lib.ARTIFACT_PATH))
    parser.add_argument("--facts", required=True, help="path to a facts JSON file (see module docstring for format)")
    parser.add_argument("--schema", default="public")
    parser.add_argument("--out", help="write generated SQL text to this path (never printed to stdout in full)")
    parser.add_argument("--dry-run", action="store_true", help="only print the summary (hash/counts/structure), do not require --out")
    args = parser.parse_args()

    sql, summary = generate_production_sql(Path(args.artifact), Path(args.facts), args.schema)

    print(json.dumps(summary, indent=2))

    if args.out:
        Path(args.out).write_text(sql, encoding="utf-8")
        print(f"\n[adapter] SQL written to {args.out} ({len(sql)} bytes). NOT executed by this script -- generation only.")
    elif not args.dry_run:
        print("\n[adapter] no --out given and not --dry-run; SQL was generated in-memory only, not written or executed anywhere.")


if __name__ == "__main__":
    main()

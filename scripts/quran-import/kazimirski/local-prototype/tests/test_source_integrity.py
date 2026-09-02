#!/usr/bin/env python3
"""
Step 9: Source text integrity tests.

Proves and reports, against the REAL imported local database:
  - every imported segment's text_sha256 (as stored) matches what the
    manifest declared for it (full diff over all rows, not a sample)
  - the aggregate ordered hash computed from the IMPORTED rows matches the
    frozen artifact's aggregate hash from step 2 (already re-confirmed
    here independently of the importer's own stage-7 check)
  - zero segments have text differing from the manifest (full diff)
  - zero segments were dropped (count match, accounting for the 2
    documented mw-empty-elt exclusions -- see NORMALIZATION-REPORT.md)
  - zero segments were unexpectedly duplicated: UNIQUE(source_id,
    surah_number, source_ordinal) is enforced by the DB constraint, but
    this test verifies it wasn't silently violated by checking actual row
    counts too (independent of trusting the constraint alone).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
LOCAL_PROTO = HERE.parent
KAZ_DIR = LOCAL_PROTO.parent
sys.path.insert(0, str(LOCAL_PROTO))
sys.path.insert(0, str(KAZ_DIR))

import import_kazimirski as ik  # noqa: E402

DB_URL = ik.DEFAULT_DB_URL
MANIFEST_PATH = KAZ_DIR / "kazimirski_alignment_manifest.json"

passed = 0
failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"PASS: {name}")
        passed += 1
    else:
        print(f"FAIL: {name} {detail}")
        failed += 1


def main():
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)

    source_id = ik.psql(
        DB_URL, "SELECT id FROM content_sources WHERE edition_identifier='kazimirski-1869-segments-phase3';"
    ).strip()
    check("source_id resolved", bool(source_id))

    # --- Full diff: every DB row's (surah, ordinal, text_sha256) vs manifest ---
    db_rows_raw = ik.psql(
        DB_URL,
        f"SELECT surah_number, source_ordinal, text_sha256 FROM translation_segments "
        f"WHERE source_id='{source_id}' ORDER BY surah_number, source_ordinal;",
    )
    db_rows = {}
    for line in db_rows_raw.splitlines():
        if not line.strip():
            continue
        s, o, h = line.split("\t")
        db_rows[(int(s), int(o))] = h

    manifest_rows = {(s["surah_number"], s["source_ordinal"]): s["text_sha256"] for s in manifest["segments"]}

    check("row count matches: DB segments == manifest segments", len(db_rows) == len(manifest_rows),
          f"db={len(db_rows)} manifest={len(manifest_rows)}")

    missing_in_db = set(manifest_rows) - set(db_rows)
    extra_in_db = set(db_rows) - set(manifest_rows)
    check("zero manifest segments missing from DB", len(missing_in_db) == 0, str(sorted(missing_in_db)[:10]))
    check("zero unexpected extra segments in DB", len(extra_in_db) == 0, str(sorted(extra_in_db)[:10]))

    hash_mismatches = [k for k in (set(db_rows) & set(manifest_rows)) if db_rows[k] != manifest_rows[k]]
    check(
        f"FULL DIFF: all {len(set(db_rows) & set(manifest_rows))} common rows have matching text_sha256 (0 mismatches)",
        len(hash_mismatches) == 0,
        f"{len(hash_mismatches)} mismatches, e.g. {hash_mismatches[:5]}",
    )

    # --- text_sha256 stored actually matches the stored text itself (DB-side recompute) ---
    bad_self_hash = int(ik.psql(
        DB_URL,
        f"SELECT count(*) FROM translation_segments WHERE source_id='{source_id}' "
        f"AND text_sha256 <> encode(digest(text, 'sha256'), 'hex');",
    ).strip())
    check("every stored text_sha256 matches sha256(stored text) recomputed in Postgres", bad_self_hash == 0, f"{bad_self_hash} mismatches")

    # --- No two rows share (surah_number, source_ordinal) for this source_id ---
    dup_count = int(ik.psql(
        DB_URL,
        f"SELECT count(*) FROM (SELECT surah_number, source_ordinal FROM translation_segments "
        f"WHERE source_id='{source_id}' GROUP BY surah_number, source_ordinal HAVING count(*) > 1) d;",
    ).strip())
    check("zero duplicate (surah_number, source_ordinal) pairs (verified independently of the UNIQUE constraint)", dup_count == 0, f"{dup_count} dup groups")

    # --- Aggregate ordered hash: DB-computed vs manifest-declared ---
    db_agg_hash = ik.recompute_db_aggregate_hash(DB_URL, source_id)
    check(
        "aggregate ordered hash (DB-computed) == manifest's declared aggregate_ordered_hash",
        db_agg_hash == manifest["aggregate_ordered_hash"],
        f"db={db_agg_hash} manifest={manifest['aggregate_ordered_hash']}",
    )

    # --- Aggregate ordered hash: DB-computed vs freshly re-parsed raw artifact (independent of manifest) ---
    fresh_segments, _, fresh_sha = ik.stage1_parse(ik.DEFAULT_HTML)
    check("frozen artifact SHA-256 unchanged since manifest generation", fresh_sha == manifest["source_artifact_sha256"])

    excluded_keys = {(e["surah_number"], e["source_ordinal"]) for e in manifest.get("excluded_empty_source_segments", [])}
    fresh_by_key = {(s.surah_number, s.source_ordinal): s.text for s in fresh_segments}
    ordered_keys = sorted(k for k in fresh_by_key if k not in excluded_keys)
    # Fatiha preamble (surah=1, ordinal=0) isn't part of fresh HTML <li> extraction;
    # append it using the same sourcing the manifest itself used.
    from kazimirski_html_extract import extract_bismillah_surah1, aggregate_ordered_hash
    html_text = Path(ik.DEFAULT_HTML).read_text(encoding="utf-8")
    bismillah = extract_bismillah_surah1(html_text)
    texts_in_manifest_order = [bismillah] + [fresh_by_key[k] for k in ordered_keys]
    independent_hash = aggregate_ordered_hash(texts_in_manifest_order)
    check(
        "aggregate ordered hash recomputed FRESH from raw artifact (independent of manifest AND of DB) matches manifest's",
        independent_hash == manifest["aggregate_ordered_hash"],
        f"independent={independent_hash} manifest={manifest['aggregate_ordered_hash']}",
    )

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

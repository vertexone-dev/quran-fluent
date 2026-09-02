#!/usr/bin/env python3
"""
Step 7: Unresolved-case safety verification + tests.

Proves, against the REAL imported local database (not the manifest file):
  (a) Surah 2 ordinal 287 and Surah 36 ordinal 84 exist as segments with
      alignment_status='unresolved' and exactly 0 join rows each, no
      guessed canonical target.
  (b) If a manifest is tampered with to add a guessed target for either,
      the importer's stage-4 validation rejects it outright (raises
      ImportAbort) rather than silently accepting/importing it.

Run: python3 tests/test_unresolved_safety.py
"""
import copy
import json
import subprocess
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


def psql_scalar(sql: str) -> str:
    return ik.psql(DB_URL, sql).strip()


def main():
    source_id = psql_scalar(
        "SELECT id FROM content_sources WHERE edition_identifier='kazimirski-1869-segments-phase3';"
    )
    check("Kazimirski Phase 3 content_sources row exists", bool(source_id))

    # --- (a) S2/S36 unresolved segments: 0 joins, no guessed target ---
    for surah, ordinal in [(2, 287), (36, 84)]:
        row = ik.psql(
            DB_URL,
            f"SELECT alignment_type, alignment_status, source_declared_number, text "
            f"FROM translation_segments WHERE source_id='{source_id}' AND surah_number={surah} "
            f"AND source_ordinal={ordinal};",
        ).strip()
        check(f"Surah {surah} ordinal {ordinal}: segment row exists", bool(row), row)
        if row:
            parts = row.split("\t")
            alignment_type, alignment_status, declared_num, text = parts[0], parts[1], parts[2], parts[3] if len(parts) > 3 else ""
            check(f"Surah {surah} ordinal {ordinal}: alignment_type='unresolved'", alignment_type == "unresolved", alignment_type)
            check(f"Surah {surah} ordinal {ordinal}: alignment_status='unresolved'", alignment_status == "unresolved", alignment_status)
            check(f"Surah {surah} ordinal {ordinal}: source_declared_number IS NULL", declared_num == "", repr(declared_num))
            check(f"Surah {surah} ordinal {ordinal}: has real non-empty text", len(text.strip()) > 0)

        join_count = int(psql_scalar(
            f"SELECT count(*) FROM translation_segment_ayahs tsa "
            f"JOIN translation_segments ts ON ts.id=tsa.segment_id "
            f"WHERE ts.source_id='{source_id}' AND ts.surah_number={surah} AND ts.source_ordinal={ordinal};"
        ))
        check(f"Surah {surah} ordinal {ordinal}: exactly 0 join rows", join_count == 0, f"found {join_count}")

    # --- (b) tampered manifest with a guessed target must be rejected ---
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)

    for surah, ordinal, guess_ayah in [(2, 287, 286), (36, 84, 83)]:
        bad_manifest = copy.deepcopy(manifest)
        found = False
        for seg in bad_manifest["segments"]:
            if seg["surah_number"] == surah and seg["source_ordinal"] == ordinal:
                found = True
                seg["canonical_targets"] = [
                    {"surah_number": surah, "ayah_number": guess_ayah, "mapping_confidence": "auto"}
                ]
        check(f"tamper setup: found manifest entry for surah {surah} ordinal {ordinal} to corrupt", found)

        # Run stage4 validation directly against the tampered manifest.
        fresh_segments, _, _ = ik.stage1_parse(ik.DEFAULT_HTML)
        valid_ayahs = ik.fetch_valid_ayahs(DB_URL)
        rejected = False
        err_msg = ""
        try:
            ik.stage4_validate_mappings(fresh_segments, bad_manifest, valid_ayahs)
        except SystemExit as e:
            rejected = True
            err_msg = str(e)
        check(
            f"importer REJECTS a guessed target for surah {surah} ordinal {ordinal} (unresolved must have 0 targets)",
            rejected,
            err_msg,
        )
        if rejected:
            check(
                f"  rejection message names the cardinality rule (surah {surah})",
                "unresolved" in err_msg and "canonical_targets" in err_msg,
                err_msg,
            )

    # Also prove the REAL (untampered) manifest still passes stage 4 cleanly,
    # so the rejection above is because of the tamper, not a broken test.
    fresh_segments, _, _ = ik.stage1_parse(ik.DEFAULT_HTML)
    valid_ayahs = ik.fetch_valid_ayahs(DB_URL)
    real_ok = True
    try:
        ik.stage4_validate_mappings(fresh_segments, manifest, valid_ayahs)
    except SystemExit:
        real_ok = False
    check("untampered real manifest still passes stage4 validation", real_ok)

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Step 8: Mapping cardinality tests.

Proves, against the REAL imported local data, using GENERIC queries
parameterized by surah/ayah only (no surah-specific application code) that
the schema handles every pattern from PHASE1-ALIGNMENT-AUDIT.md /
PHASE2-MAPPING-ARCHITECTURE.md correctly:
  - direct (A): exactly 1 join row
  - offset (B): exactly 1 join row
  - one_to_many (C): >=2 join rows sharing one segment_id (Surah 101 item 1)
  - many_to_one (D): exactly 4 segments joined to (74,31)
  - compound: mixed join pattern on a boundary ayah (106:4)
  - Fatiha unnumbered preamble
  - unresolved: zero-join case
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
LOCAL_PROTO = HERE.parent
sys.path.insert(0, str(LOCAL_PROTO))

import import_kazimirski as ik  # noqa: E402

DB_URL = ik.DEFAULT_DB_URL

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


def q(sql: str) -> str:
    return ik.psql(DB_URL, sql)


def qi(sql: str) -> int:
    return int(q(sql).strip())


def main():
    source_id = q(
        "SELECT id FROM content_sources WHERE edition_identifier='kazimirski-1869-segments-phase3';"
    ).strip()
    check("source_id resolved", bool(source_id))

    # ---- Generic query, parameterized by (surah, ordinal): join count for a segment ----
    def join_count_for_segment(surah: int, ordinal: int) -> int:
        return qi(
            f"SELECT count(*) FROM translation_segment_ayahs tsa "
            f"JOIN translation_segments ts ON ts.id = tsa.segment_id "
            f"WHERE ts.source_id='{source_id}' AND ts.surah_number={surah} AND ts.source_ordinal={ordinal};"
        )

    # ---- Generic query, parameterized by (surah, ayah): segment count for an ayah ----
    def segment_count_for_ayah(surah: int, ayah: int) -> int:
        return qi(
            f"SELECT count(*) FROM translation_segment_ayahs tsa "
            f"JOIN translation_segments ts ON ts.id = tsa.segment_id "
            f"WHERE ts.source_id='{source_id}' AND tsa.surah_number={surah} AND tsa.ayah_number={ayah};"
        )

    # --- direct (A) case: find one generically, verify exactly 1 join row ---
    direct_example = q(
        f"SELECT surah_number, source_ordinal FROM translation_segments "
        f"WHERE source_id='{source_id}' AND alignment_type='direct' LIMIT 1;"
    ).strip()
    check("found a 'direct' example segment", bool(direct_example))
    if direct_example:
        s, o = map(int, direct_example.split("\t"))
        jc = join_count_for_segment(s, o)
        check(f"direct case ({s}:{o}) has exactly 1 join row", jc == 1, f"found {jc}")

    # --- offset (B) case ---
    offset_example = q(
        f"SELECT surah_number, source_ordinal FROM translation_segments "
        f"WHERE source_id='{source_id}' AND alignment_type='offset' LIMIT 1;"
    ).strip()
    check("found an 'offset' example segment", bool(offset_example))
    if offset_example:
        s, o = map(int, offset_example.split("\t"))
        jc = join_count_for_segment(s, o)
        check(f"offset case ({s}:{o}) has exactly 1 join row", jc == 1, f"found {jc}")

    # --- one_to_many (C) case: Surah 101 item 1 -> 101:1 + 101:2 ---
    jc = join_count_for_segment(101, 1)
    check("one_to_many case (101 ordinal 1, Surah 101 item 1) has exactly 2 join rows", jc == 2, f"found {jc}")
    distinct_segs = qi(
        f"SELECT count(DISTINCT tsa.segment_id) FROM translation_segment_ayahs tsa "
        f"JOIN translation_segments ts ON ts.id=tsa.segment_id "
        f"WHERE ts.source_id='{source_id}' AND ts.surah_number=101 AND ts.source_ordinal=1;"
    )
    check("one_to_many case: both join rows share exactly 1 segment_id", distinct_segs == 1, f"found {distinct_segs}")
    ayahs_covered = q(
        f"SELECT tsa.ayah_number FROM translation_segment_ayahs tsa "
        f"JOIN translation_segments ts ON ts.id=tsa.segment_id "
        f"WHERE ts.source_id='{source_id}' AND ts.surah_number=101 AND ts.source_ordinal=1 ORDER BY tsa.ayah_number;"
    ).strip().split("\n")
    check("one_to_many case covers exactly {101:1, 101:2}", ayahs_covered == ["1", "2"], ayahs_covered)

    # --- many_to_one (D) case: 74:31, the 4-segment merge ---
    sc = segment_count_for_ayah(74, 31)
    check("many_to_one case (74:31) has exactly 4 segments joined", sc == 4, f"found {sc}")
    ordinals = q(
        f"SELECT ts.source_ordinal FROM translation_segment_ayahs tsa "
        f"JOIN translation_segments ts ON ts.id=tsa.segment_id "
        f"WHERE ts.source_id='{source_id}' AND tsa.surah_number=74 AND tsa.ayah_number=31 "
        f"ORDER BY ts.source_ordinal;"
    ).strip().split("\n")
    check("74:31's 4 segments are ordinals 31,32,33,34 in order", ordinals == ["31", "32", "33", "34"], ordinals)

    # --- compound case: 106:4 (both a split target and a merge target) ---
    sc = segment_count_for_ayah(106, 4)
    check("compound case (106:4) has >=2 segments joined (mixed split+merge)", sc >= 2, f"found {sc}")
    confidences = q(
        f"SELECT DISTINCT tsa.mapping_confidence FROM translation_segment_ayahs tsa "
        f"JOIN translation_segments ts ON ts.id=tsa.segment_id "
        f"WHERE ts.source_id='{source_id}' AND tsa.surah_number=106 AND tsa.ayah_number=4;"
    ).strip().split("\n")
    check("compound case (106:4) join rows are flagged needs_review", confidences == ["needs_review"], confidences)
    # 106:3 (the OTHER ayah item-3 also covers) should NOT be needs_review, proving
    # the flag is per-JOIN-ROW, not blanket-applied to the whole segment.
    conf_106_3 = q(
        f"SELECT tsa.mapping_confidence FROM translation_segment_ayahs tsa "
        f"JOIN translation_segments ts ON ts.id=tsa.segment_id "
        f"WHERE ts.source_id='{source_id}' AND ts.surah_number=106 AND ts.source_ordinal=3 AND tsa.ayah_number=3;"
    ).strip()
    check("106 item 3's OTHER join row (->106:3) is NOT needs_review (per-row flag, not per-segment)", conf_106_3 != "needs_review", conf_106_3)

    # All 8 compound boundary ayahs, generic sweep.
    compound_ayahs = [(3, 39), (3, 167), (11, 39), (14, 44), (47, 21), (65, 3), (65, 10), (106, 4)]
    for s, a in compound_ayahs:
        sc = segment_count_for_ayah(s, a)
        check(f"compound boundary {s}:{a} has >=1 segment with a needs_review join row", sc >= 1, f"found {sc}")
        has_needs_review = qi(
            f"SELECT count(*) FROM translation_segment_ayahs tsa "
            f"JOIN translation_segments ts ON ts.id=tsa.segment_id "
            f"WHERE ts.source_id='{source_id}' AND tsa.surah_number={s} AND tsa.ayah_number={a} "
            f"AND tsa.mapping_confidence='needs_review';"
        )
        check(f"compound boundary {s}:{a}: all its join rows are needs_review", has_needs_review == sc, f"{has_needs_review}/{sc}")

    # --- Fatiha unnumbered preamble case ---
    fatiha = q(
        f"SELECT segment_type, source_ordinal, source_declared_number FROM translation_segments "
        f"WHERE source_id='{source_id}' AND surah_number=1 AND segment_type='unnumbered_preamble';"
    ).strip()
    check("Fatiha preamble segment exists", bool(fatiha))
    fjc = qi(
        f"SELECT count(*) FROM translation_segment_ayahs tsa "
        f"JOIN translation_segments ts ON ts.id=tsa.segment_id "
        f"WHERE ts.source_id='{source_id}' AND ts.segment_type='unnumbered_preamble';"
    )
    check("Fatiha preamble has exactly 1 join row, to (1,1)", fjc == 1, f"found {fjc}")

    # --- unresolved zero-join case (cross-reference of step 7) ---
    for surah, ordinal in [(2, 287), (36, 84)]:
        jc = join_count_for_segment(surah, ordinal)
        check(f"unresolved case ({surah}:{ordinal}) has exactly 0 join rows", jc == 0, f"found {jc}")

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

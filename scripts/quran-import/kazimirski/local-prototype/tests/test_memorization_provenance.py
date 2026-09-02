#!/usr/bin/env python3
"""
Step 12: Memorization provenance prototype + tests.

Prototypes the behavior PHASE2-MAPPING-ARCHITECTURE.md §12 describes for
`review_items`: creating a review item for a Kazimirski-backed āyah
populates `back` (a rendered snapshot -- concatenated with a boundary
marker for many_to_one/compound cases, per §6's Reader UX recommendation)
AND `translation_source_id` AND `translation_segment_ids` (an ordered
array), alongside the existing `back` column, without changing its NOT
NULL meaning.

This is a TEST/SCRIPT PROTOTYPE ONLY -- src/lib/memorization.ts's real
`scheduleReview` is NOT modified. This script proves the DATA MODEL and
round-trip behavior work against the real local schema; wiring it into the
actual app is explicitly out of scope for this phase.

Uses the existing local e2e test user (auth.users) and writes/deletes its
own clearly-namespaced review_items rows (item_key prefixed
'kazimirski-phase3-proto-test:') so it never collides with real E2E test
data and cleans up after itself either way (try/finally).
"""
import subprocess
import sys
import uuid
from pathlib import Path

HERE = Path(__file__).parent
LOCAL_PROTO = HERE.parent
sys.path.insert(0, str(LOCAL_PROTO))

import import_kazimirski as ik  # noqa: E402

DB_URL = ik.DEFAULT_DB_URL
BOUNDARY_MARKER = " ¶ "  # PHASE2 §6: "a subtle pilcrow or spacing" between originally-separate segments

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


def qrows(sql: str) -> list[list[str]]:
    out = q(sql)
    return [line.split("\t") for line in out.splitlines() if line.strip()]


def render_kazimirski_back(segment_texts_in_order: list[str]) -> str:
    """Mirrors resolver.ts's rendering rule (PHASE2 §6): a single segment
    renders as-is; 2+ segments (many_to_one/compound) concatenate in
    source_ordinal order with a visible boundary marker between them, so a
    reader/reviewer can tell these were originally separate printed items."""
    if len(segment_texts_in_order) == 1:
        return segment_texts_in_order[0]
    return BOUNDARY_MARKER.join(segment_texts_in_order)


def main():
    source_id = q(
        "SELECT id FROM content_sources WHERE edition_identifier='kazimirski-1869-segments-phase3';"
    ).strip()
    check("Kazimirski Phase 3 source resolved", bool(source_id))

    user_id = q("SELECT id FROM auth.users ORDER BY email LIMIT 1;").strip()
    check("local test user resolved", bool(user_id))

    created_item_keys = []

    def cleanup():
        for key in created_item_keys:
            q(f"DELETE FROM review_items WHERE user_id='{user_id}' AND item_key={ik.sql_literal(key)};")

    try:
        # =========================================================
        # Case A: one_to_many (Surah 101 item 1 -> 101:1 + 101:2)
        # =========================================================
        rows = qrows(
            f"SELECT id, text FROM translation_segments WHERE source_id='{source_id}' "
            f"AND surah_number=101 AND source_ordinal=1;"
        )
        check("one_to_many source segment found (101 ordinal 1)", len(rows) == 1)
        seg_id, seg_text = rows[0]
        back_a = render_kazimirski_back([seg_text])
        seg_ids_a = [seg_id]

        arabic_101_1 = q("SELECT arabic_text FROM ayahs WHERE surah_number=101 AND ayah_number=1;").strip()
        item_key_a = "kazimirski-phase3-proto-test:ayah:101:1"
        created_item_keys.append(item_key_a)
        q(f"""
INSERT INTO review_items (id, user_id, item_type, item_key, front, back, context, translation_source_id, translation_segment_ids)
VALUES (
  {ik.sql_literal(str(uuid.uuid4()))}, {ik.sql_literal(user_id)}, 'ayah', {ik.sql_literal(item_key_a)},
  {ik.sql_literal(arabic_101_1)}, {ik.sql_literal(back_a)}, '101:1',
  {ik.sql_literal(source_id)}, {ik.sql_uuid_array(seg_ids_a)}
);
""")
        stored = qrows(
            f"SELECT back, translation_source_id, translation_segment_ids FROM review_items "
            f"WHERE user_id='{user_id}' AND item_key={ik.sql_literal(item_key_a)};"
        )[0]
        check("one_to_many: stored back == rendered single-segment text", stored[0] == back_a)
        check("one_to_many: stored translation_source_id == Kazimirski source", stored[1] == source_id)
        check("one_to_many: stored translation_segment_ids has exactly 1 element", stored[2].strip("{}") == seg_id)

        # =========================================================
        # Case B: many_to_one (74:31, the 4-segment merge)
        # =========================================================
        rows = qrows(
            f"SELECT ts.id, ts.text FROM translation_segments ts "
            f"JOIN translation_segment_ayahs tsa ON tsa.segment_id = ts.id "
            f"WHERE ts.source_id='{source_id}' AND tsa.surah_number=74 AND tsa.ayah_number=31 "
            f"ORDER BY ts.source_ordinal;"
        )
        check("many_to_one: found 4 contributing segments for 74:31", len(rows) == 4, f"found {len(rows)}")
        seg_ids_b = [r[0] for r in rows]
        seg_texts_b = [r[1] for r in rows]
        back_b = render_kazimirski_back(seg_texts_b)
        check("many_to_one: rendered back contains all 4 segments' text", all(t in back_b for t in seg_texts_b))
        check("many_to_one: rendered back uses the boundary marker (3 markers for 4 segments)", back_b.count(BOUNDARY_MARKER) == 3)

        arabic_74_31 = q("SELECT arabic_text FROM ayahs WHERE surah_number=74 AND ayah_number=31;").strip()
        item_key_b = "kazimirski-phase3-proto-test:ayah:74:31"
        created_item_keys.append(item_key_b)
        q(f"""
INSERT INTO review_items (id, user_id, item_type, item_key, front, back, context, translation_source_id, translation_segment_ids)
VALUES (
  {ik.sql_literal(str(uuid.uuid4()))}, {ik.sql_literal(user_id)}, 'ayah', {ik.sql_literal(item_key_b)},
  {ik.sql_literal(arabic_74_31)}, {ik.sql_literal(back_b)}, '74:31',
  {ik.sql_literal(source_id)}, {ik.sql_uuid_array(seg_ids_b)}
);
""")
        stored_b = qrows(
            f"SELECT back, translation_segment_ids FROM review_items "
            f"WHERE user_id='{user_id}' AND item_key={ik.sql_literal(item_key_b)};"
        )[0]
        check("many_to_one: stored back == rendered 4-segment concatenation", stored_b[0] == back_b)
        stored_ids_b = stored_b[1].strip("{}").split(",")
        check("many_to_one: stored translation_segment_ids preserves source_ordinal order", stored_ids_b == seg_ids_b, f"{stored_ids_b} vs {seg_ids_b}")

        # =========================================================
        # Provenance fully recoverable: re-derive `back` purely from the
        # stored translation_segment_ids, independent of the `back` column.
        # =========================================================
        recovered_rows = qrows(
            f"SELECT ts.id, ts.text FROM translation_segments ts "
            f"WHERE ts.id = ANY({ik.sql_uuid_array(stored_ids_b)}::uuid[]) "
            f"ORDER BY array_position({ik.sql_uuid_array(stored_ids_b)}::uuid[], ts.id);"
        )
        recovered_back = render_kazimirski_back([r[1] for r in recovered_rows])
        check(
            "provenance fully recoverable: re-deriving `back` from translation_segment_ids alone reproduces the stored back exactly",
            recovered_back == stored_b[0],
        )

        # =========================================================
        # Pre-existing (legacy) row simulation: both new columns NULL.
        # =========================================================
        item_key_legacy = "kazimirski-phase3-proto-test:legacy-simulated-row"
        created_item_keys.append(item_key_legacy)
        q(f"""
INSERT INTO review_items (id, user_id, item_type, item_key, front, back, context)
VALUES (
  {ik.sql_literal(str(uuid.uuid4()))}, {ik.sql_literal(user_id)}, 'ayah', {ik.sql_literal(item_key_legacy)},
  'ARABIC-PLACEHOLDER', 'Pickthall or legacy-column back text, no provenance captured', '1:1'
);
""")
        legacy_row = qrows(
            f"SELECT back, translation_source_id, translation_segment_ids, status, due_date FROM review_items "
            f"WHERE user_id='{user_id}' AND item_key={ik.sql_literal(item_key_legacy)};"
        )[0]
        check("legacy row: insert succeeded without providing new columns (both stay NULL, no NOT NULL violation)", True)
        check("legacy row: back is still populated and NOT NULL as before", legacy_row[0] == "Pickthall or legacy-column back text, no provenance captured")
        check("legacy row: translation_source_id is NULL", legacy_row[1] == "")
        check("legacy row: translation_segment_ids is NULL", legacy_row[2] == "")
        check("legacy row: default status/due_date still populate normally (unaffected by the new columns)", legacy_row[3] == "new" and bool(legacy_row[4]))

    finally:
        cleanup()
        remaining = qrows(
            f"SELECT count(*) FROM review_items WHERE user_id='{user_id}' AND item_key LIKE 'kazimirski-phase3-proto-test:%';"
        )
        check("cleanup: all test review_items rows removed, zero left behind", remaining[0][0] == "0")

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

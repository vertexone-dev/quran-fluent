"""
Phase 4 correction generator.

Root cause (see PHASE4 report): Phase 3's extraction pipeline reserved a physical
source_ordinal slot for the spurious <li class="mw-empty-elt"> found in the raw
Wikisource HTML at exactly two locations (Surah 2, after real item 6; Surah 36,
after real item 34). These empty <li> elements have been proven -- via the actual
1869 Charpentier page-scan image (page 3 of the djvu, matching the Google Books
3XSe413MJyQC provenance), independent cross-check against the local governed
Pickthall English translation at >15 points spanning both surahs, and exact
structural reconciliation against Phase 1's own A/B/C/D classification counts --
to NOT correspond to any missing verse text. Every canonical ayah in both surahs
already has real, complete Kazimirski French text present in the source.

This script regenerates the correct source_ordinal / source_declared_number /
alignment_type / alignment_status / translation_segment_ayahs targets for every
segment in Surah 2 and Surah 36, using Phase 1's already content-verified
declared_num -> canonical_ayah_range classification (segment_classification_full.csv),
re-indexed to exclude the spurious empty <li> from the physical position count.

No translation_segments.text or text_sha256 value is read or written by this
script (those are immutable and untouched). Only ordinal/declared-number/
alignment metadata and the join table are affected.
"""
import csv
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../kazimirski
CLASS_TO_TYPE = {'A': 'direct', 'B': 'offset', 'C': 'one_to_many', 'D': 'many_to_one'}


def load_csv_map(surah):
    m = {}
    with open(os.path.join(BASE, 'segment_classification_full.csv'), newline='', encoding='utf-8') as f:
        r = csv.DictReader(f)
        for row in r:
            if row['surah'] == str(surah) and row['kazimirski_item_declared_num'] != 'EXTRA-1':
                m[int(row['kazimirski_item_declared_num'])] = (row['canonical_ayah_range'], row['classification'])
    return m


def parse_range(rng):
    if '-' in rng:
        a, b = rng.split('-')
        return list(range(int(a.split(':')[1]), int(b.split(':')[1]) + 1))
    return [int(rng.split(':')[1])]


REVIEWER_NOTE = (
    "Phase 4 (AI-agent primary-source investigation, not human review): the source "
    "<li class=\"mw-empty-elt\"> at this surah's physical position (Surah 2 pos 7 / "
    "Surah 36 pos 35) was proven via (1) direct inspection of the actual 1869 "
    "Charpentier page scan (Wikisource djvu page image, matching Google Books ID "
    "3XSe413MJyQC provenance) showing continuous, gapless printed verse numbers with "
    "no missing content, (2) independent cross-check against the local governed "
    "Pickthall English translation at >15 points spanning the full surah, and (3) "
    "exact structural reconciliation matching Phase 1's own classification counts "
    "(A/B/C/D per surah_alignment_matrix.csv) once the ordinal is corrected to "
    "exclude the spurious empty <li> from the position count. This segment's true "
    "source_ordinal/source_declared_number and canonical target were re-derived "
    "accordingly. alignment_status=cross_verified reflects AI-agent multi-signal "
    "verification; this is explicitly NOT human_verified -- reviewed_by/reviewed_at "
    "remain NULL pending an actual French-literate human reviewer."
)


def main():
    surah2_map = load_csv_map(2)
    surah36_map = load_csv_map(36)

    lines = []
    lines.append("-- Phase 4 correction: fix systematic +1 ordinal-slot bug caused by spurious")
    lines.append("-- <li class=\"mw-empty-elt\"> elements in Surah 2 (after real item 6) and")
    lines.append("-- Surah 36 (after real item 34). See PHASE4-AMENDMENTS.json for the reviewable")
    lines.append("-- amendment record and the Phase 4 report for the full evidence chain.")
    lines.append("BEGIN;")
    lines.append("")

    note_sql = REVIEWER_NOTE.replace("'", "''")

    for surah, gap_after, decl_map in [(2, 6, surah2_map), (36, 34, surah36_map)]:
        lines.append(f"-- ===== Surah {surah}: shift ordinals >= {gap_after + 2} down by 1"
                     f" (2-step, avoids transient unique-constraint collision) =====")
        lines.append(
            f"UPDATE translation_segments SET source_ordinal = source_ordinal + 100000, "
            f"source_declared_number = source_declared_number + 100000 "
            f"WHERE surah_number = {surah} AND source_ordinal >= {gap_after + 2};"
        )
        lines.append(
            f"UPDATE translation_segments SET source_ordinal = source_ordinal - 100001, "
            f"source_declared_number = source_declared_number - 100001 "
            f"WHERE surah_number = {surah} AND source_ordinal >= {gap_after + 1 + 100000};"
        )
        lines.append("")
        lines.append(f"-- Update alignment_type/status/reviewer_notes for ALL surah {surah} segments")
        lines.append(f"-- per Phase 1's verified declared_num -> classification mapping (now correctly indexed).")
        for decl_num in sorted(decl_map):
            _, cls = decl_map[decl_num]
            atype = CLASS_TO_TYPE[cls]
            lines.append(
                f"UPDATE translation_segments SET alignment_type = '{atype}', "
                f"alignment_status = 'cross_verified', reviewer_notes = '{note_sql}' "
                f"WHERE surah_number = {surah} AND source_ordinal = {decl_num};"
            )
        lines.append("")
        lines.append(f"-- Rebuild join rows for surah {surah} from Phase 1's verified mapping")
        lines.append(
            f"DELETE FROM translation_segment_ayahs WHERE segment_id IN "
            f"(SELECT id FROM translation_segments WHERE surah_number = {surah});"
        )
        for decl_num in sorted(decl_map):
            rng, _ = decl_map[decl_num]
            for ayah in parse_range(rng):
                lines.append(
                    f"INSERT INTO translation_segment_ayahs (segment_id, surah_number, ayah_number, mapping_confidence) "
                    f"SELECT id, {surah}, {ayah}, 'cross_verified' FROM translation_segments "
                    f"WHERE surah_number = {surah} AND source_ordinal = {decl_num};"
                )
        lines.append("")

    lines.append("-- ===== Postcondition checks =====")
    lines.append("DO $$")
    lines.append("DECLARE")
    lines.append("  bad_count integer;")
    lines.append("BEGIN")
    lines.append("  SELECT count(*) INTO bad_count FROM translation_segments WHERE surah_number IN (2,36) AND alignment_status = 'unresolved';")
    lines.append("  IF bad_count <> 0 THEN RAISE EXCEPTION 'Postcondition failed: % segments still unresolved in surah 2/36', bad_count; END IF;")
    lines.append("")
    lines.append("  SELECT count(DISTINCT ayah_number) INTO bad_count FROM translation_segment_ayahs WHERE surah_number = 2;")
    lines.append("  IF bad_count <> 286 THEN RAISE EXCEPTION 'Postcondition failed: surah 2 covers % distinct ayahs, expected 286', bad_count; END IF;")
    lines.append("")
    lines.append("  SELECT count(DISTINCT ayah_number) INTO bad_count FROM translation_segment_ayahs WHERE surah_number = 36;")
    lines.append("  IF bad_count <> 83 THEN RAISE EXCEPTION 'Postcondition failed: surah 36 covers % distinct ayahs, expected 83', bad_count; END IF;")
    lines.append("")
    lines.append("  SELECT count(*) INTO bad_count FROM (SELECT surah_number, source_ordinal, count(*) c FROM translation_segments WHERE surah_number IN (2,36) GROUP BY 1,2 HAVING count(*) > 1) x;")
    lines.append("  IF bad_count <> 0 THEN RAISE EXCEPTION 'Postcondition failed: % duplicate source_ordinal rows', bad_count; END IF;")
    lines.append("")
    lines.append("  RAISE NOTICE 'Phase 4 correction postconditions PASSED';")
    lines.append("END $$;")
    lines.append("")
    lines.append("COMMIT;")

    sql = "\n".join(lines)
    out_path = os.path.join(BASE, 'phase4', '003_phase4_surah2_36_correction.sql')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(sql)
    print("wrote", out_path, "bytes:", len(sql), "lines:", len(lines))

    json.dump({str(k): v for k, v in surah2_map.items()},
               open(os.path.join(BASE, 'phase4', 'surah2_declared_map.json'), 'w'),
               ensure_ascii=False, indent=1)
    json.dump({str(k): v for k, v in surah36_map.items()},
               open(os.path.join(BASE, 'phase4', 'surah36_declared_map.json'), 'w'),
               ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()

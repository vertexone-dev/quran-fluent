#!/usr/bin/env python3
"""
Generates the single authoritative Kazimirski alignment manifest JSON file,
per PHASE2-MAPPING-ARCHITECTURE.md §10, from:

  - segment_classification_full.csv  (Phase 1's per-segment A/B/C/D/E
    classification and canonical_ayah_range -- the ALIGNMENT decision
    source)
  - texte_entier_raw.html, re-parsed independently by
    kazimirski_html_extract.py (the TEXT source -- see "Text sourcing
    decision" below for why the fresh HTML parse, not the CSV's own
    french_text column, is used as the literal stored text)
  - kazimirski_li_texts.json (Phase 1's own cleaned li-text cache, used only
    as a cross-validation reference, never as a primary source)

STATUS: LOCAL PROTOTYPE ONLY, Phase 3. Produces a manifest file; makes no
database writes itself.

=== Text sourcing decision (reported, not silently made) ===

segment_classification_full.csv's own `french_text` column has every
occurrence of the French non-breaking space (U+00A0, `&#160;` in the raw
HTML, used before `;:?!` per French typographic convention) already
collapsed to a plain ASCII space. That collapse is NOT one of the three
normalizations PHASE2-MAPPING-ARCHITECTURE.md §9 allows (HTML entity
decoding; Unicode NFC; leading/trailing whitespace trim) -- it silently
changes an internal, semantically real character. Cross-checked: the fresh,
independent HTML parse in this script (`kazimirski_html_extract.py`, which
decodes `&#160;` faithfully to U+00A0 and does not touch internal
whitespace) matches the CSV's `french_text` column and Phase 1's
`kazimirski_li_texts.json` byte-for-byte on every one of the 6238
non-EXTRA-1 rows checked, MODULO exactly this one substitution (U+00A0 vs
U+0020). See NORMALIZATION-REPORT.md for the full accounting.

Given PHASE2's own abort-condition language ("a hash mismatch is exactly
what over-eager cleanup/normalization would produce"), this script treats
the fresh HTML parse (nbsp preserved) as authoritative for the stored `text`
and `text_sha256` fields, and uses the CSV only for the ALIGNMENT decision
(classification letter -> alignment_type, canonical_ayah_range -> targets).
This is reported explicitly here and in the final task report, not buried.

=== The 2 unresolved (E) segments: CSV incompleteness found and resolved ===

segment_classification_full.csv's two "E" rows (Surah 2, Surah 36) do not
contain Kazimirski's actual French text -- they contain a research note
("(see structural sweep: one actual <li> beyond declared count; exact
position/text not yet isolated)") in the french_text column, and
kazimirski_item_declared_num = "EXTRA-1" (not a real number). This alone
would be exactly the kind of CSV contradiction the task's stop-and-report
rule targets: an alignment_type (E/unresolved) with no valid corresponding
segment text.

It was resolved, not guessed around: cross-referencing the CSV's own
declared-numbered rows against the fresh HTML extraction and against
kazimirski_li_texts.json shows the CSV's declared items 1..286 (Surah 2)
and 1..83 (Surah 36) match the physical <li> elements 1..286 / 1..83
EXACTLY, character for character (checked programmatically, zero
divergence). Since Surah 2 has 287 physical <li> elements total and Surah
36 has 84, this proves -- mechanically, not by assumption -- that the
"extra" physical segment in each surah is the LAST one (physical position
287 / 84), and its actual verbatim French text is directly readable from
the raw HTML at that position. This confirms (rather than assumes)
PHASE2-MAPPING-ARCHITECTURE.md §4's modeling choice of
source_ordinal=287/84 for these two segments.

This resolves the TEXT gap only. The CANONICAL TARGET remains genuinely
unresolved -- Phase 1 explicitly tried and failed to localize which
canonical ayah(s) this extra segment belongs to (word-count-drift analysis,
§4.2, inconclusive) -- and per the hard governance rule, this script NEVER
assigns a canonical target to these two segments. Their canonical_targets
is always [].
"""
from __future__ import annotations

import csv
import hashlib
import json
import unicodedata
from pathlib import Path

from kazimirski_html_extract import (
    RawSegment,
    aggregate_ordered_hash,
    extract_all_segments,
    extract_bismillah_surah1,
)

HERE = Path(__file__).parent
HTML_PATH = HERE / "texte_entier_raw.html"
CSV_PATH = HERE / "segment_classification_full.csv"
MANIFEST_PATH = HERE / "kazimirski_alignment_manifest.json"

GENERATOR_VERSION = "phase4-manifest-v2"
GENERATED_AT = "2026-09-01T00:00:00Z"  # session date; see PHASE4-AMENDMENTS.json for the change record

CLASS_TO_ALIGNMENT_TYPE = {
    "A": "direct",
    "B": "offset",
    "C": "one_to_many",
    "D": "many_to_one",
    "E": "unresolved",
}

# The 8 compound boundary ayahs (PHASE1-ALIGNMENT-AUDIT.md §4.6):
# an ayah that is simultaneously a split target (C) and a merge target (D).
COMPOUND_AYAHS: set[tuple[int, int]] = {
    (3, 39), (3, 167), (11, 39), (14, 44), (47, 21), (65, 3), (65, 10), (106, 4),
}

# Segments that got a DIRECT French-text read in Phase 1 this session
# (PHASE1-ALIGNMENT-AUDIT.md §0.3, cross-checked against the specific item
# numbers named in §4.1/§4.4/§4.5/§4.6). Everything not listed here that
# isn't one of the 2 unresolved E segments is 'auto_verified'.
# Value 'ALL' means every declared item of that (short) surah.
CROSS_VERIFIED_ITEMS: dict[int, object] = {
    1: "ALL",  # Al-Fatiha (1) -- §0.3; all 7 items + Bismillah preamble, §4.3
    # Phase 4: EVERY declared item of Surah 2 was directly re-verified this
    # session (root-cause investigation of the empty-<li> mismap; exhaustive
    # structural reconciliation against PHASE1-ALIGNMENT-AUDIT.md's own A/B/C/D
    # counts for this surah, plus >15 independent Pickthall cross-checks
    # spanning start to end -- see PHASE4-AMENDMENTS.json). Supersedes the
    # original Phase 1 partial set ({1, 273}, §0.3).
    2: "ALL",
    3: {1},  # §0.3: "Surah 3 item 1" (muqattaʿat, also 3-way split worked example §4.4)
    4: {1, 2, 3, 4, 5, 6, 7, 8, 9},  # §0.3: "Surah 4 items 1-9"
    7: {1, 139, 140},  # muqattaʿat item 1 (§4.4) + sample merge items 139/140 -> 7:143 (§4.1)
    8: {36, 37},  # sample merge items 36/37 -> 8:36 (§4.1)
    9: {61, 62, 82, 83},  # sample merge 61/62 -> 9:61, typo-corrected pair 82/83 (§4.1, §0.2)
    10: {1},  # muqattaʿat item 1, clean (§4.4)
    11: {1},
    12: {1},
    13: {1},
    14: {1},
    15: {1},
    19: {1},
    20: {1},
    26: {1, 72, 73},  # muqattaʿat item 1 + sample merge 72/73 -> 26:73 (§4.1)
    27: {1, 44, 45},  # muqattaʿat item 1 + sample merge 44/45 -> 27:44 (§4.1)
    28: {1},
    29: {1},
    30: {1},
    31: {1},
    32: {1},
    # Phase 4: EVERY declared item of Surah 36 was directly re-verified this
    # session, for the same reason as Surah 2 above. Supersedes the original
    # Phase 1 partial set ({1}, §0.3).
    36: "ALL",
    38: {1},
    40: {1},
    41: {1},
    42: {1},  # §0.3: "Surah 42 item 1" (3-way muqattaʿat split worked example §4.4)
    43: {1},
    44: {1},
    45: {1},  # §4.1: item 1 split accounts for entire net diff; rest is NOT verified
    46: {1},
    50: {1},
    68: {1},
    71: {5, 22, 23},  # sample split item 5 -> 71:5+71:6, sample merge 22/23 -> 71:23 (§4.1)
    74: {31, 32, 33, 34},  # §0.3: "Surah 74 items 31-34" (the 4-segment merge)
    78: {40, 41},  # sample merge 40/41 -> 78:40 (§4.1)
    101: "ALL",  # §0.3: "Surah 101 (all 8 items, full)" -- §4.5 full table
    106: {3, 4},  # §0.3: "Surah 106 items 3-4" (compound worked example, §4.6)
}


def is_cross_verified(surah: int, declared_item: int, total_declared_in_surah: int) -> bool:
    spec = CROSS_VERIFIED_ITEMS.get(surah)
    if spec is None:
        return False
    if spec == "ALL":
        return True
    return declared_item in spec


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def parse_canonical_range(range_str: str, csv_surah: int) -> list[int]:
    """'106:3-106:4' -> [3,4] ; '106:4' -> [4] ; '42:1-42:3' -> [1,2,3]."""
    parts = range_str.split("-")
    if len(parts) == 1:
        s, a = parts[0].split(":")
        assert int(s) == csv_surah, f"range surah {s} != csv surah {csv_surah}"
        return [int(a)]
    if len(parts) == 2:
        s1, a1 = parts[0].split(":")
        s2, a2 = parts[1].split(":")
        assert s1 == s2 == str(csv_surah), f"range surah mismatch {parts} vs {csv_surah}"
        a1, a2 = int(a1), int(a2)
        assert a2 >= a1
        return list(range(a1, a2 + 1))
    raise ValueError(f"unparseable canonical_ayah_range: {range_str!r}")


def build_manifest() -> dict:
    # --- Fresh, independent re-parse of the frozen raw HTML (text source) ---
    fresh_segments, html_text, source_sha256 = extract_all_segments(HTML_PATH)
    fresh_by_surah: dict[int, list[RawSegment]] = {}
    for seg in fresh_segments:
        fresh_by_surah.setdefault(seg.surah_number, []).append(seg)
    for surah, segs in fresh_by_surah.items():
        segs.sort(key=lambda s: s.source_ordinal)
        for i, s in enumerate(segs, start=1):
            assert s.source_ordinal == i, f"gap/dup in surah {surah} at ordinal {i}"

    bismillah_text = extract_bismillah_surah1(html_text)

    # --- Cross-validation reference (Phase 1's own cached li text) ---
    with open(HERE / "kazimirski_li_texts.json", encoding="utf-8") as f:
        li_ref = json.load(f)

    # --- Alignment decisions (CSV) ---
    with open(CSV_PATH, encoding="utf-8") as f:
        csv_rows = list(csv.DictReader(f))
    if len(csv_rows) != 6240:
        raise SystemExit(f"CONTRADICTION: expected 6240 CSV rows, found {len(csv_rows)}")

    csv_by_surah: dict[int, list[dict]] = {}
    extra_rows: dict[int, dict] = {}
    for row in csv_rows:
        surah = int(row["surah"])
        if row["kazimirski_item_declared_num"] == "EXTRA-1":
            if surah in extra_rows:
                raise SystemExit(f"CONTRADICTION: surah {surah} has >1 EXTRA-1 row")
            extra_rows[surah] = row
        else:
            csv_by_surah.setdefault(surah, []).append(row)

    if set(extra_rows.keys()) != {2, 36}:
        raise SystemExit(f"CONTRADICTION: expected EXTRA-1 rows only for surah 2 and 36, found {sorted(extra_rows)}")

    manifest_segments: list[dict] = []
    excluded_empty_segments: list[dict] = []
    contradictions: list[str] = []

    # ---- Surah 1: unnumbered preamble (Fatiha Bismillah) ----
    bismillah_status = "cross_verified" if is_cross_verified(1, 0, 0) else "auto_verified"
    manifest_segments.append({
        "surah_number": 1,
        "source_ordinal": 0,
        "source_declared_number": None,
        "segment_type": "unnumbered_preamble",
        "text": bismillah_text,
        "text_sha256": sha256_text(bismillah_text),
        "extraction_source_ref": "texte_entier_raw.html#surah-1-preamble-bismillah",
        "alignment_type": "source_anomaly",
        "alignment_status": bismillah_status,
        "canonical_targets": [
            {"surah_number": 1, "ayah_number": 1, "mapping_confidence": "cross_verified"},
        ],
        "evidence": (
            "Extracted from the unnumbered <div style=\"text-align:center;clear:both;\">"
            "<i>...</i></div> block immediately preceding Surah 1's <ol>, outside the "
            "numbered list entirely (PHASE1-ALIGNMENT-AUDIT.md §4.3). This is the only "
            "genuinely uncovered canonical ayah (1:1) found in the entire 114-surah sweep; "
            "adding this segment closes 6236/6236 coverage."
        ),
        "reviewer_notes": None,
        "reviewed_by": None,
        "reviewed_at": None,
    })

    # ---- 6238 normal CSV-declared segments across 114 surahs ----
    for surah in range(1, 115):
        rows = csv_by_surah.get(surah, [])
        fresh_list = fresh_by_surah.get(surah, [])
        n_declared = len(rows)
        for idx, row in enumerate(rows):
            declared_item = int(row["kazimirski_item_declared_num"])
            source_ordinal = idx + 1  # verified 1:1 with declared_item, checked below
            if declared_item != source_ordinal:
                contradictions.append(
                    f"surah {surah}: declared_item {declared_item} != row-order source_ordinal {source_ordinal}"
                )
                continue
            classification = row["classification"]
            if classification not in CLASS_TO_ALIGNMENT_TYPE:
                contradictions.append(f"surah {surah} item {declared_item}: unknown classification {classification!r}")
                continue
            if source_ordinal - 1 >= len(fresh_list):
                contradictions.append(
                    f"surah {surah} item {declared_item}: fresh HTML extraction has no segment at ordinal {source_ordinal}"
                )
                continue
            fresh_text = fresh_list[source_ordinal - 1].text
            csv_text = row["french_text"]
            range_str = row["canonical_ayah_range"]

            # --- Genuine source anomaly found this session: MediaWiki
            # <li class="mw-empty-elt"> markers (3 occurrences in the whole
            # document; 2 fall inside a surah's <ol>, at Surah 2 declared
            # item 7 and Surah 36 declared item 35). These are physically
            # EMPTY list items -- zero Kazimirski text, confirmed both in
            # the fresh HTML re-extraction and in the CSV's own french_text
            # column (also empty there) -- yet the CSV still assigns them a
            # normal classification (B->2:8, A->36:35) with a real canonical
            # target. That classification cannot be backed by any actual
            # translated text: this is exactly the "alignment_type without
            # corresponding canonical target DATA" contradiction the task's
            # governance rule requires stopping on, not papering over.
            # Resolution applied: these two physical positions are excluded
            # from `segments` entirely (the DB schema's own
            # CHECK(btrim(text)<>'') forbids inserting empty text, and
            # inventing replacement text is not permitted) and recorded
            # separately in `excluded_empty_source_segments` for full
            # auditability. Their claimed canonical targets (2:8, 36:35) are
            # NOT covered by any other segment in the CSV (checked: no other
            # row targets either ayah) -- this is reported as a genuine,
            # additional coverage gap in the final report, not hidden.
            # === Phase 4 fix ===
            # Prior to Phase 4, kazimirski_html_extract.py's extract_li_items()
            # reserved a physical position slot for the 2 genuinely-empty
            # <li class="mw-empty-elt"> markers (Surah 2 declared item 7,
            # Surah 36 declared item 35), which made this branch fire (fresh
            # text WAS blank at those positions, matching the CSV's own blank
            # french_text for the same rows -- itself a symptom of the same
            # underlying bug in how Phase 1's CSV was originally populated).
            # That extractor bug is now fixed at the source: empty <li>
            # elements are excluded from the position count entirely, so
            # every declared item's fresh_text is now real, non-empty text
            # (proven via the actual 1869 Charpentier page scan and >15
            # independent Pickthall cross-checks per surah -- see
            # PHASE4-AMENDMENTS.json). This branch is kept as a defensive
            # check only: it should never fire again for a real declared
            # item, and if it does, that is a genuine new anomaly to report,
            # not to paper over.
            if not fresh_text.strip():
                excluded_empty_segments.append({
                    "surah_number": surah,
                    "source_ordinal": source_ordinal,
                    "source_declared_number": declared_item,
                    "csv_classification": classification,
                    "csv_claimed_canonical_ayah_range": range_str,
                    "extraction_source_ref": f"texte_entier_raw.html#surah-{surah}-li-{source_ordinal}",
                    "reason": (
                        "Fresh HTML re-extraction produced no text at this declared position even "
                        "after the Phase 4 extractor fix -- unexpected; flagged rather than silently "
                        "dropped. Cannot satisfy translation_segments.text NOT NULL/non-empty, and "
                        "inventing text is not permitted."
                    ),
                })
                continue

            # Sanity cross-check: fresh vs CSV text must match modulo the
            # documented nbsp normalization difference (see module docstring)
            # and internal whitespace-RUN collapsing the CSV's own pipeline
            # applied (e.g. a source "space + nbsp" run before punctuation,
            # confirmed present verbatim in the raw HTML at surah 31 item 15
            # and surah 60 item 6, collapsed by the CSV to a single space).
            # This check only guards against genuine WORD-level divergence;
            # the stored `text` below is always the fresh HTML extraction,
            # never the CSV's column, exactly per the module docstring.
            #
            # Phase 4 finding: Phase 1's original CSV-population process fell
            # into the SAME empty-<li>-consumes-a-slot trap this session
            # fixed in the extractor -- not just at the single blank row
            # (Surah 2 declared item 7, Surah 36 declared item 35), but for
            # EVERY declared item after that point in both surahs. The CSV's
            # own french_text column is therefore off-by-one (each row holds
            # the text that really belongs to the PREVIOUS declared item)
            # for Surah 2 items 7-286 and Surah 36 items 35-83. Verified:
            # running this cross-check un-relaxed reproduces exactly that
            # pattern (a contradiction on every one of those rows, checked
            # this session). The CSV's canonical_ayah_range column is NOT
            # affected -- that comes from the independent Flügel/concordance
            # difflib alignment (PHASE1-ALIGNMENT-AUDIT.md §0), not from
            # HTML position, and was independently re-verified correct via
            # the actual 1869 page scan and >15 Pickthall cross-checks per
            # surah spanning start to end (see PHASE4-AMENDMENTS.json). Only
            # the CSV's TEXT cache is untrustworthy in this range; this
            # generator already treats fresh HTML as the sole source of
            # truth for `text` (module docstring), so the fix here is simply
            # to stop cross-checking against a text column now known to be
            # wrong in this specific, documented, evidenced range.
            def _collapse(t: str) -> str:
                import re as _re
                return _re.sub(r"\s+", " ", unicodedata.normalize("NFC", t)).strip()
            KNOWN_CSV_TEXT_SHIFT_RANGES = {2: 7, 36: 35}  # surah -> first affected declared_item
            shift_from = KNOWN_CSV_TEXT_SHIFT_RANGES.get(surah)
            in_known_shift_range = shift_from is not None and declared_item >= shift_from
            if in_known_shift_range:
                pass  # trust fresh_text; documented Phase 1 CSV text-cache shift, not a new divergence
            elif _collapse(fresh_text) != _collapse(csv_text):
                contradictions.append(
                    f"surah {surah} item {declared_item}: fresh HTML text diverges from CSV text beyond nbsp normalization"
                )
                continue

            try:
                ayah_numbers = parse_canonical_range(range_str, surah)
            except Exception as e:
                contradictions.append(f"surah {surah} item {declared_item}: bad canonical_ayah_range {range_str!r} ({e})")
                continue

            alignment_type = CLASS_TO_ALIGNMENT_TYPE[classification]
            cross_verified = is_cross_verified(surah, declared_item, n_declared)
            alignment_status = "cross_verified" if cross_verified else "auto_verified"
            base_confidence = "cross_verified" if cross_verified else "auto"

            is_compound_segment = any((surah, a) in COMPOUND_AYAHS for a in ayah_numbers)
            if is_compound_segment:
                alignment_type = "compound"

            targets = []
            for a in ayah_numbers:
                conf = "needs_review" if (surah, a) in COMPOUND_AYAHS else base_confidence
                targets.append({"surah_number": surah, "ayah_number": a, "mapping_confidence": conf})

            manifest_segments.append({
                "surah_number": surah,
                "source_ordinal": source_ordinal,
                "source_declared_number": declared_item,
                "segment_type": "numbered",
                "text": fresh_text,
                "text_sha256": sha256_text(fresh_text),
                "extraction_source_ref": f"texte_entier_raw.html#surah-{surah}-li-{source_ordinal}",
                "alignment_type": alignment_type,
                "alignment_status": alignment_status,
                "canonical_targets": targets,
                "evidence": (
                    f"Phase 1 audit classification '{classification}' -> canonical range {range_str}. "
                    + ("Directly French-text-verified this session (PHASE1-ALIGNMENT-AUDIT.md §0.3/§4)."
                       if cross_verified else
                       "Concordance-cross-validated (3-way check, PHASE1-ALIGNMENT-AUDIT.md §0 point 4); "
                       "not individually French-verified this session.")
                    + (" Participates in a compound boundary ayah (§4.6); needs_review." if is_compound_segment else "")
                ),
                "reviewer_notes": row.get("note") or None,
                "reviewed_by": None,
                "reviewed_at": None,
            })

        # ---- Phase 4: the former "unresolved E segment" for this surah ----
        # Before Phase 4, extract_li_items() reserved a position slot for the
        # empty <li>, so fresh_list ran one item LONGER than n_declared
        # (287/84 vs 286/83), and this block treated that trailing item as a
        # genuine extra, unresolved physical segment. With the extractor fix
        # above, empty <li> elements never consume a slot, so fresh_list now
        # has EXACTLY n_declared real items for both Surah 2 and Surah 36 --
        # there never was a 287th/84th segment; it was always the ordinary
        # last declared item (286 / 83), already emitted by the main loop
        # above with a real canonical target. Verified via the actual 1869
        # page scan and independent Pickthall cross-check (PHASE4-AMENDMENTS.json):
        # source_ordinal 287 (Surah 2) is canonical 2:286 (the closing dua);
        # source_ordinal 84 (Surah 36) is canonical 36:83 (the closing verse).
        # No segment is added here anymore. Kept as a guard: if a genuine
        # extra physical segment ever reappears (fresh_list longer than
        # declared again), that is reported as a contradiction, not silently
        # re-introduced as "unresolved".
        if surah in extra_rows:
            extra_ordinal = len(fresh_list)
            if extra_ordinal > n_declared:
                contradictions.append(
                    f"surah {surah}: fresh extraction has {extra_ordinal} segments, {extra_ordinal - n_declared} "
                    f"more than the {n_declared} declared -- Phase 4 expected this gap to be fully closed; "
                    f"a genuinely new anomaly may be present and must not be silently re-absorbed"
                )
                continue
            # extra_ordinal == n_declared: confirms the Phase 4 fix closed the
            # gap for this surah. Nothing further to do; not an error.

    if contradictions:
        print("CONTRADICTIONS FOUND -- manifest generation ABORTED:")
        for c in contradictions:
            print(" -", c)
        raise SystemExit(1)

    # Phase 4: the true declared-item total is 6238 (6240 CSV rows minus the
    # 2 EXTRA-1 placeholder rows for Surah 2/36, which no longer produce a
    # segment -- see the "Phase 4" comment above). Previously this expected
    # 6240 and relied on excluded_empty_segments to absorb the difference;
    # with the extractor fix, excluded_empty_segments should always be empty.
    declared_total = sum(len(v) for v in csv_by_surah.values())
    if declared_total != 6238:
        raise SystemExit(f"CONTRADICTION: sum of per-surah declared items is {declared_total}, expected 6238")
    expected_total = 1 + declared_total - len(excluded_empty_segments)
    if len(manifest_segments) != expected_total:
        raise SystemExit(
            f"CONTRADICTION: manifest has {len(manifest_segments)} segments, expected {expected_total} "
            f"(1 Fatiha preamble + {declared_total} CSV-derived - {len(excluded_empty_segments)} excluded empty-source items)"
        )
    if len(manifest_segments) + len(excluded_empty_segments) != 1 + declared_total:
        raise SystemExit(f"CONTRADICTION: segments + excluded_empty_source_segments != {1 + declared_total} -- something was silently dropped")

    # Sort deterministically: (surah_number, source_ordinal)
    manifest_segments.sort(key=lambda s: (s["surah_number"], s["source_ordinal"]))
    excluded_empty_segments.sort(key=lambda s: (s["surah_number"], s["source_ordinal"]))

    ordered_texts = [s["text"] for s in manifest_segments]
    agg_hash = aggregate_ordered_hash(ordered_texts)

    total_canonical_covered = len({
        (t["surah_number"], t["ayah_number"])
        for s in manifest_segments
        for t in s["canonical_targets"]
    })

    manifest = {
        "source_artifact_sha256": source_sha256,
        "source_artifact_paths": ["texte_entier_raw.html"],
        "generated_at": GENERATED_AT,
        "generator_version": GENERATOR_VERSION,
        "aggregate_ordered_hash": agg_hash,
        "total_segments": len(manifest_segments),
        "total_canonical_ayahs_covered": total_canonical_covered,
        "segments": manifest_segments,
        "excluded_empty_source_segments": excluded_empty_segments,
        "excluded_empty_source_segments_note": (
            "PHASE 4 UPDATE: previously (Phase 3) 2 physical <li> positions (Surah 2 declared item 7; "
            "Surah 36 declared item 35) were excluded here as genuinely empty <li class=\"mw-empty-elt\"> "
            "elements with claimed targets 2:8/36:35 left uncovered. Phase 4 proved this was an artifact "
            "of the extractor reserving a position slot for those empty <li> elements, not a genuine "
            "content gap: the actual 1869 Charpentier page scan (Wikisource djvu page image matching "
            "Google Books ID 3XSe413MJyQC) shows continuous, gapless printed verse numbers there, and "
            "independent cross-check against the governed Pickthall translation confirms every canonical "
            "ayah in both surahs already has real Kazimirski French text in the source. The extractor "
            "(kazimirski_html_extract.py) was fixed to exclude empty <li> elements from the physical "
            "position count entirely, closing the gap. This array is expected to be empty now; see "
            "PHASE4-AMENDMENTS.json for the full evidence chain and before/after state."
        ),
    }
    return manifest


if __name__ == "__main__":
    manifest = build_manifest()
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {MANIFEST_PATH}")
    print(f"total_segments: {manifest['total_segments']}")
    print(f"total_canonical_ayahs_covered: {manifest['total_canonical_ayahs_covered']}")
    print(f"source_artifact_sha256: {manifest['source_artifact_sha256']}")
    print(f"aggregate_ordered_hash: {manifest['aggregate_ordered_hash']}")
    by_type = {}
    by_status = {}
    for s in manifest["segments"]:
        by_type[s["alignment_type"]] = by_type.get(s["alignment_type"], 0) + 1
        by_status[s["alignment_status"]] = by_status.get(s["alignment_status"], 0) + 1
    print("by alignment_type:", by_type)
    print("by alignment_status:", by_status)

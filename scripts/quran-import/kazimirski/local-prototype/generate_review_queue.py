#!/usr/bin/env python3
"""
Step 10: Human review queue generation (JSON + Markdown), 3 tiers.

Reads the REAL imported local database (translation_segments,
translation_segment_ayahs) plus read-only canonical Arabic
(ayahs.arabic_text) to build a review queue that a French-literate human
reviewer will work through. This script never sets reviewer_decision or
reviewer_notes -- both are always emitted null/empty; that is the human's
job, not this script's.

Tier 1: the 2 unresolved segments (Surah 2 ordinal 287, Surah 36 ordinal 84).
Tier 2: every segment/join row participating in the 8 compound boundary
        ayahs (3:39, 3:167, 11:39, 14:44, 47:21, 65:3, 65:10, 106:4).
Tier 3: a stratified sample covering >=15-20% of the ~74 "concordance-only"
        surahs (zero cross_verified segments) -- mixing short/long by
        ayah_count tercile, deterministic (no randomness), selecting each
        sampled surah's C/D/one_to_many/many_to_one items (the items an
        audit would actually want a human to look at; plain A/B items in
        a concordance-only surah carry no elevated review value).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
KAZ_DIR = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(KAZ_DIR))

import import_kazimirski as ik  # noqa: E402

DB_URL = ik.DEFAULT_DB_URL
OUT_JSON = HERE / "review_queue.json"
OUT_MD = HERE / "review_queue.md"

COMPOUND_AYAHS = [(3, 39), (3, 167), (11, 39), (14, 44), (47, 21), (65, 3), (65, 10), (106, 4)]


def q(sql: str) -> str:
    return ik.psql(DB_URL, sql)


def qrows(sql: str) -> list[list[str]]:
    out = q(sql)
    return [line.split("\t") for line in out.splitlines() if line.strip()]


def main():
    source_id = q(
        "SELECT id FROM content_sources WHERE edition_identifier='kazimirski-1869-segments-phase3';"
    ).strip()
    if not source_id:
        raise SystemExit("Kazimirski Phase 3 content_sources row not found -- run the import first")

    # ---------------- Tier 1 ----------------
    tier1 = []
    for surah, ordinal in [(2, 287), (36, 84)]:
        rows = qrows(
            f"SELECT id, text, alignment_type, alignment_status FROM translation_segments "
            f"WHERE source_id='{source_id}' AND surah_number={surah} AND source_ordinal={ordinal};"
        )
        if not rows:
            raise SystemExit(f"Tier 1: expected segment ({surah},{ordinal}) not found in DB")
        seg_id, text, atype, astatus = rows[0]
        tier1.append({
            "tier": 1,
            "surah_number": surah,
            "segments": [{"segment_id": seg_id, "source_ordinal": ordinal, "text": text}],
            "canonical_targets": [],
            "canonical_arabic_reference": None,
            "alignment_classification": atype,
            "alignment_status": astatus,
            "evidence": (
                f"One more physical <li> ({ordinal}) than Kazimirski's own declared count for this "
                f"surah (PHASE1-ALIGNMENT-AUDIT.md §4.2). Word-count-drift localization attempted, "
                f"reported inconclusive. Canonical target genuinely unknown -- never guessed."
            ),
            "reason_review_needed": (
                "UNRESOLVED: this segment's canonical āyah target has not been determined. Requires "
                "direct sentence-by-sentence reading of Kazimirski's French against a verse reference "
                "to locate where in the surah this extra segment's content actually belongs."
            ),
            "reviewer_decision": None,
            "reviewer_notes": None,
        })

    # ---------------- Tier 2 ----------------
    tier2 = []
    for surah, ayah in COMPOUND_AYAHS:
        arabic = q(f"SELECT arabic_text FROM ayahs WHERE surah_number={surah} AND ayah_number={ayah};").strip()
        seg_rows = qrows(
            f"SELECT ts.id, ts.source_ordinal, ts.text, ts.alignment_type, tsa.mapping_confidence "
            f"FROM translation_segment_ayahs tsa JOIN translation_segments ts ON ts.id=tsa.segment_id "
            f"WHERE ts.source_id='{source_id}' AND tsa.surah_number={surah} AND tsa.ayah_number={ayah} "
            f"ORDER BY ts.source_ordinal;"
        )
        segments = [
            {"segment_id": r[0], "source_ordinal": int(r[1]), "text": r[2], "alignment_type": r[3], "mapping_confidence": r[4]}
            for r in seg_rows
        ]
        tier2.append({
            "tier": 2,
            "surah_number": surah,
            "ayah_number": ayah,
            "segments": segments,
            "canonical_targets": [{"surah_number": surah, "ayah_number": ayah}],
            "canonical_arabic_reference": arabic,
            "alignment_classification": "compound",
            "evidence": (
                f"{surah}:{ayah} is one of the 8 compound boundary āyahs identified in "
                f"PHASE1-ALIGNMENT-AUDIT.md §4.6 -- simultaneously a split target and a merge target, "
                f"so the clean one-classification-per-āyah model breaks down."
            ),
            "reason_review_needed": (
                "COMPOUND BOUNDARY: this āyah receives content from more than one Kazimirski segment "
                "via overlapping split/merge patterns. The exact partition of meaning between the "
                "contributing segments is not mechanically decidable and needs an editorial decision "
                "by a French-literate reviewer comparing against the canonical Arabic."
            ),
            "reviewer_decision": None,
            "reviewer_notes": None,
        })

    # ---------------- Tier 3 ----------------
    # Pool: surahs with ZERO cross_verified segments in this import.
    all_surahs = qrows(
        f"SELECT surah_number, count(*) FILTER (WHERE alignment_status='cross_verified') AS cv_count "
        f"FROM translation_segments WHERE source_id='{source_id}' GROUP BY surah_number ORDER BY surah_number;"
    )
    pool = [int(s) for s, cv in all_surahs if int(cv) == 0]

    ayah_counts = {int(s): int(c) for s, c in qrows("SELECT number, ayah_count FROM surahs;")}
    pool_sorted = sorted(pool, key=lambda s: ayah_counts[s])
    n = len(pool_sorted)
    tercile = max(1, n // 3)
    short = pool_sorted[:tercile]
    medium = pool_sorted[tercile:2 * tercile]
    long_ = pool_sorted[2 * tercile:]

    target_frac = 0.20
    target_n = max(1, -(-int(n * target_frac) // 1))  # ceil

    def evenly_spaced(lst, k):
        if k <= 0 or not lst:
            return []
        if k >= len(lst):
            return list(lst)
        step = len(lst) / k
        return [lst[int(i * step)] for i in range(k)]

    per_stratum = max(1, -(-target_n // 3))
    sample = sorted(set(
        evenly_spaced(short, per_stratum) + evenly_spaced(medium, per_stratum) + evenly_spaced(long_, per_stratum)
    ))
    # Top up deterministically (smallest surah number first from remaining pool) if rounding left us short.
    if len(sample) < target_n:
        for s in pool_sorted:
            if s not in sample:
                sample.append(s)
            if len(sample) >= target_n:
                break
        sample = sorted(sample)

    tier3 = []
    compound_surahs = {s for s, _ in COMPOUND_AYAHS}
    for surah in sample:
        item_rows = qrows(
            f"SELECT ts.id, ts.source_ordinal, ts.text, ts.alignment_type, tsa.surah_number, tsa.ayah_number, tsa.mapping_confidence "
            f"FROM translation_segments ts JOIN translation_segment_ayahs tsa ON tsa.segment_id = ts.id "
            f"WHERE ts.source_id='{source_id}' AND ts.surah_number={surah} "
            f"AND ts.alignment_type IN ('one_to_many','many_to_one','compound') "
            f"ORDER BY ts.source_ordinal;"
        )
        by_segment: dict[str, dict] = {}
        for seg_id, ordinal, text, atype, tsurah, tayah, conf in item_rows:
            entry = by_segment.setdefault(seg_id, {
                "segment_id": seg_id, "source_ordinal": int(ordinal), "text": text,
                "alignment_type": atype, "canonical_targets": [],
            })
            entry["canonical_targets"].append({"surah_number": int(tsurah), "ayah_number": int(tayah), "mapping_confidence": conf})

        segs = sorted(by_segment.values(), key=lambda e: e["source_ordinal"])
        # Note: a sampled surah with zero split/merge items still gets an
        # entry (with an empty flagged_segments list) so the queue's surah
        # count always matches the stratified sample's declared size --
        # "no C/D items" is itself a reportable fact (this surah is A/B-only
        # per the audit), not a reason to silently drop it from the queue.

        arabic_refs = {}
        for seg in segs:
            for t in seg["canonical_targets"]:
                key = (t["surah_number"], t["ayah_number"])
                if key not in arabic_refs:
                    arabic_refs[key] = q(
                        f"SELECT arabic_text FROM ayahs WHERE surah_number={key[0]} AND ayah_number={key[1]};"
                    ).strip()

        tier3.append({
            "tier": 3,
            "surah_number": surah,
            "ayah_count": ayah_counts[surah],
            "already_touched_by_tier2": surah in compound_surahs,
            "flagged_segments": segs,
            "canonical_arabic_reference_by_ayah": {f"{k[0]}:{k[1]}": v for k, v in arabic_refs.items()},
            "alignment_classification": "concordance-cross-validated only (no direct French read this session)",
            "evidence": (
                "PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way "
                "concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column "
                "Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text "
                "read against a canonical French Quran reference."
            ),
            "reason_review_needed": (
                "STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs "
                "(PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) "
                "to give the reviewer representative coverage rather than an arbitrary first-N. Only "
                "this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its "
                "plain direct/offset items carry no elevated review value."
                + ("" if segs else " This surah has ZERO split/merge segments -- every item is a plain "
                   "direct/offset (A/B) mapping; included here for stratified-sample completeness, not "
                   "because any specific item looks doubtful.")
            ),
            "reviewer_decision": None,
            "reviewer_notes": None,
        })

    manifest_meta = {
        "concordance_only_pool_size": n,
        "sample_size": len(sample),
        "sample_fraction": round(len(sample) / n, 4) if n else None,
        "sampled_surahs": sample,
        "note": (
            "All 29 muqattaʿat surahs already have a directly-French-verified item 1 "
            "(PHASE1-ALIGNMENT-AUDIT.md §4.4) and are therefore NOT in the concordance-only pool -- "
            "none needed muqattaʿat-priority promotion into this sample."
        ),
    }

    review_queue = {
        "generated_from": "REAL imported local database (translation_segments/translation_segment_ayahs), not the manifest file",
        "source_id": source_id,
        "tier1_unresolved": tier1,
        "tier2_compound_boundaries": tier2,
        "tier3_stratified_sample": tier3,
        "tier3_sampling_metadata": manifest_meta,
    }

    OUT_JSON.write_text(json.dumps(review_queue, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_JSON}")
    print(f"tier1={len(tier1)} tier2={len(tier2)} tier3_surahs={len(tier3)} (pool={n}, sample_frac={manifest_meta['sample_fraction']})")

    write_markdown(review_queue)
    print(f"Wrote {OUT_MD}")


def write_markdown(rq: dict) -> None:
    lines = []
    lines.append("# Kazimirski French Translation — Human Review Queue (Phase 3 local prototype)")
    lines.append("")
    lines.append(
        "Generated from the REAL imported local database, not the manifest file. "
        "`reviewer_decision` and `reviewer_notes` are intentionally blank throughout — "
        "this is the human reviewer's job, never pre-filled by this script."
    )
    lines.append("")

    lines.append("## Tier 1 — Unresolved segments (2)")
    lines.append("")
    for e in rq["tier1_unresolved"]:
        seg = e["segments"][0]
        lines.append(f"### Surah {e['surah_number']}, source_ordinal {seg['source_ordinal']} (segment `{seg['segment_id']}`)")
        lines.append("")
        lines.append(f"- **French text**: {seg['text']}")
        lines.append(f"- **Canonical targets**: none (unresolved)")
        lines.append(f"- **Alignment**: {e['alignment_classification']} / {e['alignment_status']}")
        lines.append(f"- **Evidence**: {e['evidence']}")
        lines.append(f"- **Reason review needed**: {e['reason_review_needed']}")
        lines.append(f"- **Reviewer decision**: _(blank)_")
        lines.append(f"- **Reviewer notes**: _(blank)_")
        lines.append("")

    lines.append("## Tier 2 — Compound boundary āyahs (8)")
    lines.append("")
    for e in rq["tier2_compound_boundaries"]:
        lines.append(f"### {e['surah_number']}:{e['ayah_number']}")
        lines.append("")
        lines.append(f"- **Canonical Arabic**: {e['canonical_arabic_reference']}")
        lines.append(f"- **Contributing segments** (in source_ordinal order):")
        for seg in e["segments"]:
            lines.append(f"  - ordinal {seg['source_ordinal']} (`{seg['segment_id']}`, {seg['alignment_type']}, {seg['mapping_confidence']}): {seg['text']}")
        lines.append(f"- **Evidence**: {e['evidence']}")
        lines.append(f"- **Reason review needed**: {e['reason_review_needed']}")
        lines.append(f"- **Reviewer decision**: _(blank)_")
        lines.append(f"- **Reviewer notes**: _(blank)_")
        lines.append("")

    meta = rq["tier3_sampling_metadata"]
    lines.append(f"## Tier 3 — Stratified sample of concordance-only surahs ({len(rq['tier3_stratified_sample'])} of {meta['concordance_only_pool_size']} pool, {meta['sample_fraction']*100:.1f}%)")
    lines.append("")
    lines.append(f"Sampled surahs: {meta['sampled_surahs']}")
    lines.append("")
    lines.append(meta["note"])
    lines.append("")
    for e in rq["tier3_stratified_sample"]:
        lines.append(f"### Surah {e['surah_number']} ({e['ayah_count']} āyahs){' — also in Tier 2' if e['already_touched_by_tier2'] else ''}")
        lines.append("")
        lines.append("Flagged (split/merge) segments:" if e["flagged_segments"] else "Flagged (split/merge) segments: _none — every item in this surah is a plain direct/offset mapping_")
        for seg in e["flagged_segments"]:
            targets = ", ".join(f"{t['surah_number']}:{t['ayah_number']}" for t in seg["canonical_targets"])
            lines.append(f"  - ordinal {seg['source_ordinal']} (`{seg['segment_id']}`, {seg['alignment_type']}) -> {targets}: {seg['text']}")
        lines.append(f"- **Evidence**: {e['evidence']}")
        lines.append(f"- **Reason review needed**: {e['reason_review_needed']}")
        lines.append(f"- **Reviewer decision**: _(blank)_")
        lines.append(f"- **Reviewer notes**: _(blank)_")
        lines.append("")

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Load the approved Kazimirski segments and mappings into a DISPOSABLE local database
(QR-DESIGN-007E), from files committed to this repository.

It reuses the repository's own import generator for everything that does not need a
database: the frozen-source hash, the manifest gates (segment count, aggregate hash, join
count, canonical coverage, unresolved consistency), the human review decisions and their
promotions (25 decisions), and the deterministic uuid5 ids. It skips only the gates that
reconcile against a "rehearsal" database (gates 10-12 and 16), because that database is,
by default, the owner's long-running local stack and is neither available nor wanted here.

Safety: it refuses any database that is not 127.0.0.1 on a port outside 54320-54329 (the
owner's local Supabase range). It never reads production, never connects to the owner's
stack, and loads everything in ONE transaction, so the schema's own constraints and
triggers (including the cross-surah guard and the foreign key to ayahs) validate it.

  python3 load-kazimirski-disposable.py --port 55432

The text of each segment comes from the committed manifest and is checked against its
recorded SHA-256 before any SQL is written.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import subprocess
import sys
import tempfile
from pathlib import Path

KAZ = Path(__file__).resolve().parents[3] / "scripts" / "quran-import" / "kazimirski"
sys.path.insert(0, str(KAZ))

import generate_production_import as g  # noqa: E402  (the repository's own generator)
import kaz_prod_lib as lib  # noqa: E402


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    text = str(value)
    tag = "$qr007e$"
    if tag in text:
        raise SystemExit(f"refusing: text contains the quoting tag {tag}")
    return f"{tag}{text}{tag}"


def build_records():
    """Mirrors generate_production_import.build_artifact for the exported fields, without
    the rehearsal-database gates. Returns (segments, joins)."""
    g.gate3_raw_source_hash()
    manifest = g.load_manifest()
    g.gate5_segment_count(manifest)
    g.gate4_aggregate_hash(manifest)
    g.gate6_join_count(manifest)
    g.gate7_canonical_coverage(manifest)
    g.gate2_unresolved_consistency(manifest)
    decisions = g.load_decisions()
    g.gate8_all_approve(decisions)
    seg_promotions, join_promotions = g.parse_decision_promotions(decisions)
    g.gate9_reconciliation_counts(seg_promotions, join_promotions)
    g.gate13_tier2_target_joins(decisions, join_promotions)

    segs, joins = [], []
    for s in sorted(manifest["segments"], key=lambda x: (x["surah_number"], x["source_ordinal"])):
        key = (s["surah_number"], s["source_ordinal"])
        if hashlib.sha256(s["text"].encode("utf-8")).hexdigest() != s["text_sha256"]:
            raise SystemExit(f"segment {key}: text does not match its recorded SHA-256")
        promo = seg_promotions.get(key)
        declared = None if key in lib.KNOWN_NULL_DECLARED_NUMBER_SEGMENTS else s["source_declared_number"]
        segs.append({
            "id": str(lib.segment_id(*key)), "surah_number": key[0], "segment_type": s["segment_type"],
            "source_ordinal": key[1], "source_declared_number": declared, "text": s["text"],
            "text_sha256": s["text_sha256"], "extraction_source_ref": s["extraction_source_ref"],
            "alignment_type": s["alignment_type"],
            "alignment_status": "human_verified" if promo else s["alignment_status"],
            "reviewer_notes": promo["reviewer_notes"] if promo else None,
            "reviewed_by": promo["reviewer"] if promo else None,
            "reviewed_at": f"{promo['review_date']}T00:00:00+00:00" if promo else None,
        })
        for t in sorted(s["canonical_targets"], key=lambda t: t["ayah_number"]):
            jpromo = join_promotions.get((key[0], key[1], t["ayah_number"]))
            joins.append({
                "id": str(lib.join_id(key[0], key[1], t["ayah_number"])), "segment_id": str(lib.segment_id(*key)),
                "surah_number": t["surah_number"], "ayah_number": t["ayah_number"],
                "mapping_confidence": "human_verified" if jpromo else t["mapping_confidence"],
                "reviewer_notes": jpromo["reviewer_notes"] if jpromo else None,
                "reviewed_by": jpromo["reviewer"] if jpromo else None,
                "reviewed_at": f"{jpromo['review_date']}T00:00:00+00:00" if jpromo else None,
            })
    if (len(segs), len(joins)) != (lib.EXPECTED_SEGMENT_COUNT, lib.EXPECTED_JOIN_COUNT):
        raise SystemExit(f"unexpected counts: {len(segs)} segments, {len(joins)} joins")
    hv_s = sum(1 for s in segs if s["alignment_status"] == "human_verified")
    hv_j = sum(1 for j in joins if j["mapping_confidence"] == "human_verified")
    if (hv_s, hv_j) != (lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS, lib.EXPECTED_HUMAN_VERIFIED_JOINS):
        raise SystemExit(f"unexpected human_verified counts: {hv_s} segments, {hv_j} joins")
    return segs, joins


def to_sql(segs, joins) -> str:
    ts = ("id, source_id, surah_number, segment_type, source_ordinal, source_declared_number, text, text_sha256, "
          "extraction_source_ref, alignment_type, alignment_status, reviewer_notes, reviewed_by, reviewed_at")
    src = "(SELECT id FROM public.content_sources WHERE edition_identifier = 'kazimirski-1869-segments-v1')"
    out = ["BEGIN;"]
    out.append(f"DO $$ BEGIN IF (SELECT count(*) FROM public.translation_segments) <> 0 THEN RAISE EXCEPTION 'translation_segments is not empty'; END IF; "
               f"IF {src} <> '{lib.content_source_id()}' THEN RAISE EXCEPTION 'segment source id differs from the import formula'; END IF; END $$;")
    for s in segs:
        v = [sql_literal(s["id"]) + "::uuid", src, sql_literal(s["surah_number"]), sql_literal(s["segment_type"]),
             sql_literal(s["source_ordinal"]), sql_literal(s["source_declared_number"]), sql_literal(s["text"]),
             sql_literal(s["text_sha256"]), sql_literal(s["extraction_source_ref"]), sql_literal(s["alignment_type"]),
             sql_literal(s["alignment_status"]), sql_literal(s["reviewer_notes"]), sql_literal(s["reviewed_by"]),
             (sql_literal(s["reviewed_at"]) + "::timestamptz") if s["reviewed_at"] else "NULL"]
        out.append(f"INSERT INTO public.translation_segments ({ts}) VALUES ({', '.join(v)});")
    tj = "id, segment_id, surah_number, ayah_number, mapping_confidence, reviewer_notes, reviewed_by, reviewed_at"
    for j in joins:
        v = [sql_literal(j["id"]) + "::uuid", sql_literal(j["segment_id"]) + "::uuid", sql_literal(j["surah_number"]),
             sql_literal(j["ayah_number"]), sql_literal(j["mapping_confidence"]), sql_literal(j["reviewer_notes"]),
             sql_literal(j["reviewed_by"]), (sql_literal(j["reviewed_at"]) + "::timestamptz") if j["reviewed_at"] else "NULL"]
        out.append(f"INSERT INTO public.translation_segment_ayahs ({tj}) VALUES ({', '.join(v)});")
    out.append("COMMIT;")
    return "\n".join(out) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--user", default="postgres")
    ap.add_argument("--psql", default="psql")
    a = ap.parse_args()
    if 54320 <= a.port <= 54329:
        raise SystemExit(f"refusing port {a.port}: it is in the owner's local Supabase range (54320-54329)")
    segs, joins = build_records()
    sql = to_sql(segs, joins)
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as f:
        f.write(sql)
        path = f.name
    try:
        env = dict(os.environ, PGPASSWORD=os.environ.get("PGPASSWORD", "postgres"))
        r = subprocess.run([a.psql, "-h", "127.0.0.1", "-p", str(a.port), "-U", a.user, "-d", "postgres",
                            "-v", "ON_ERROR_STOP=1", "-q", "-f", path], env=env, capture_output=True, text=True)
    finally:
        os.unlink(path)
    if r.returncode != 0:
        print(r.stderr.strip()[:1500], file=sys.stderr)
        return 1
    print(f"loaded {len(segs)} segments and {len(joins)} mappings (human_verified: "
          f"{sum(s['alignment_status'] == 'human_verified' for s in segs)} / {sum(j['mapping_confidence'] == 'human_verified' for j in joins)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())

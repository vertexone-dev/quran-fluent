#!/usr/bin/env python3
"""
Kazimirski PRODUCTION importer.

FAIL CLOSED (PRODUCTION-MIGRATION-IMPORT-DESIGN.md §K/L, gate Step 8-11):
  - Validates the complete artifact (schema version, both source hashes, the
    artifact's own canonical_payload_sha256 self-check, all counts, review
    totals) BEFORE any write.
  - Establishes canonical-Arabic and Pickthall baselines (row COUNT *and* a
    content-level aggregate hash, not count alone) before writing, and
    re-verifies both again immediately after writing, INSIDE the same
    transaction, before commit -- implemented as one single `psql -f`
    invocation whose SQL text contains explicit BEGIN ... COMMIT and
    RAISE EXCEPTION guards, so a baseline mismatch anywhere aborts the whole
    transaction atomically (nothing partial is ever visible to a concurrent
    reader).
  - Implements the exact 6-state idempotency model (5 states from the
    design's gate Step 9, plus state F added to close the
    rollback-then-re-import gap documented in
    PRODUCTION-LOCAL-REHEARSAL-REPORT.md §17/§24):
      A. absent            -> import
      B. exists and matches -> verified no-op
      C. partial            -> STOP
      D. diverges           -> STOP
      E. identity collision -> STOP
      F. deprecated, zero segments/joins (rollback-produced state) -> STOP,
         unless the caller explicitly passed --recover-after-rollback, in
         which case a narrowly-scoped, explicit recovery path runs instead
         (see check_recovery_eligibility() below).
    never a broad UPSERT that silently reconciles divergence.
  - Single transaction for content_sources + all segments + all joins,
    batched ~500 rows/statement internally, but atomic as a whole. The
    recovery path (state F + --recover-after-rollback) reactivates
    verification_status back to the artifact's declared value INSIDE this
    same transaction, so a failure partway through the segment/join inserts
    rolls the reactivation back too -- the row is left exactly as rollback
    left it (deprecated) if anything goes wrong.

============================================================================
RECOVERY MODE (--recover-after-rollback) -- rollback-then-re-import gap fix
============================================================================
PRODUCTION-LOCAL-REHEARSAL-REPORT.md §17/§24 documented a genuine, safe
(fail-closed, zero writes) but operationally awkward gap: after
rollback_kazimirski.py runs, content_sources.verification_status is
'deprecated' with zero dependent segments/joins. A normal import attempt
used to reach classify_state()'s state A (zero rows -> "looks like a fresh
schema-migration-only state") and only fail deep inside the transaction's
own re-assert DO block, with a raw Postgres exception rather than a clean,
named refusal.

classify_state() now recognizes this exact shape as its own distinct state,
'F', and refuses cleanly and by name -- still fail-closed by default, no
behavior change for a normal (non-recovery) invocation. Recovery is only
possible via the explicit, opt-in --recover-after-rollback flag, and even
then only after check_recovery_eligibility() independently re-verifies, by
direct query (never inferred from classify_state() or trusted from the
caller), ALL of the following -- refusing by name on the first that fails:

  1. The existing content_sources row's `id` matches the deterministic
     expected source id exactly.
  2. Its `edition_identifier` matches the expected value exactly.
  3. + 7. Every other provenance field the migration's INSERT sets
     (content_type, provider_name, dataset_name, language, translator,
     version, license_name, license_url, attribution_required,
     modification_restricted, source_url, retrieved_at, public_domain,
     legacy_interim) matches the artifact's declared content_source values
     exactly -- implemented as ONE unified per-field comparison (this code
     path does not structurally distinguish "identity" fields from "other
     provenance" fields beyond edition_identifier, which condition 2 checks
     separately for a clearer error message); the diverging field name(s)
     are always named explicitly in the refusal.
  4. Zero translation_segments rows currently reference this source_id.
  5. Zero translation_segment_ayahs rows currently reference any segment
     under this source_id (checked independently, not merely inferred from
     condition 4, even though it is structurally implied by the FK).
  6. verification_status is exactly 'deprecated' -- not merely
     "not-candidate"; any other unexpected value refuses.
  7. (see 3.)
  8. The artifact's own declared hashes (raw_source_sha256,
     aggregate_segment_text_hash) match the approved, hardcoded values --
     already enforced unconditionally for every import by
     load_and_validate_artifact() before recovery is even considered;
     re-asserted here defensively.
  9. The caller explicitly requested recovery -- enforced structurally:
     check_recovery_eligibility() is never called unless
     --recover-after-rollback was passed AND classify_state() independently
     determined the DB is in state F. It can never trigger as a side effect
     of a normal import attempt.

If all 9 hold, the import proceeds exactly like a fresh state-A import
(reactivating verification_status back to 'candidate' first), inside one
transaction. If ANY fails, zero writes occur and the process exits non-zero
naming exactly which condition failed.

Target: the LOCAL rehearsal Postgres instance only (127.0.0.1:54322),
enforced by kaz_prod_lib.assert_local_db on every DB call. Never point this
at any other host.

--schema lets the two Kazimirski-owned tables be targeted at an isolated,
disposable schema instead of `public` for local testing purposes (see
kaz_prod_lib.py's "test-schema DDL rendering" section for why this local
rehearsal DB cannot currently host a second `public.translation_segments`
under the real production migration without colliding with the pre-existing
Phase 3 prototype tables of the same name). `content_sources`, `ayahs`, and
`translations` are ALWAYS the real `public` tables, in every mode --
they are never duplicated per test schema.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import kaz_prod_lib as lib  # noqa: E402

BATCH_SIZE = 500


class ImportAbort(SystemExit):
    def __init__(self, state: str, message: str):
        super().__init__(f"\nABORT [{state}]: {message}\n")


# ---------------------------------------------------------------------------
# Artifact validation (no DB access)
# ---------------------------------------------------------------------------


def load_and_validate_artifact(artifact_path: Path) -> dict:
    if not artifact_path.exists():
        raise ImportAbort("ARTIFACT", f"artifact not found: {artifact_path}")
    with open(artifact_path, "r", encoding="utf-8") as f:
        artifact = json.load(f)

    if artifact.get("schema_version") != lib.SCHEMA_VERSION:
        raise ImportAbort("ARTIFACT", f"schema_version {artifact.get('schema_version')!r} != expected {lib.SCHEMA_VERSION!r}")

    # Recompute raw_source_sha256 fresh from the frozen HTML -- never trust
    # the artifact's own claim without independently reproducing it.
    raw_sha = lib.sha256_file(lib.RAW_HTML_PATH)
    if raw_sha != artifact["raw_source_sha256"] or raw_sha != lib.EXPECTED_RAW_SOURCE_SHA256:
        raise ImportAbort("ARTIFACT", f"raw_source_sha256 mismatch: file={raw_sha} artifact={artifact['raw_source_sha256']} expected={lib.EXPECTED_RAW_SOURCE_SHA256}")

    segs_sorted = sorted(artifact["segments"], key=lambda s: (s["surah_number"], s["source_ordinal"]))
    agg_hash = lib.aggregate_ordered_hash([s["text"] for s in segs_sorted])
    if agg_hash != artifact["aggregate_segment_text_hash"] or agg_hash != lib.EXPECTED_AGGREGATE_SEGMENT_TEXT_HASH:
        raise ImportAbort("ARTIFACT", f"aggregate_segment_text_hash mismatch: computed={agg_hash} artifact={artifact['aggregate_segment_text_hash']}")

    # Self-integrity: recompute the canonical payload hash the generator
    # declared, over everything except generated_at/canonical_payload_sha256
    # themselves.
    core = {k: v for k, v in artifact.items() if k not in ("generated_at", "canonical_payload_sha256")}
    recomputed_payload_hash = lib.sha256_text(json.dumps(core, sort_keys=True, ensure_ascii=False))
    if recomputed_payload_hash != artifact.get("canonical_payload_sha256"):
        raise ImportAbort(
            "ARTIFACT",
            f"artifact self-integrity check failed: recomputed canonical_payload_sha256={recomputed_payload_hash} "
            f"!= declared={artifact.get('canonical_payload_sha256')} -- the artifact may have been hand-edited after generation.",
        )

    if artifact["source_segment_count"] != lib.EXPECTED_SEGMENT_COUNT or len(artifact["segments"]) != lib.EXPECTED_SEGMENT_COUNT:
        raise ImportAbort("ARTIFACT", f"segment count mismatch: declared={artifact['source_segment_count']} actual={len(artifact['segments'])} expected={lib.EXPECTED_SEGMENT_COUNT}")
    if artifact["join_count"] != lib.EXPECTED_JOIN_COUNT or len(artifact["joins"]) != lib.EXPECTED_JOIN_COUNT:
        raise ImportAbort("ARTIFACT", f"join count mismatch: declared={artifact['join_count']} actual={len(artifact['joins'])} expected={lib.EXPECTED_JOIN_COUNT}")
    if artifact["canonical_coverage"] != f"{lib.EXPECTED_CANONICAL_AYAHS}/{lib.EXPECTED_CANONICAL_AYAHS}":
        raise ImportAbort("ARTIFACT", f"canonical_coverage {artifact['canonical_coverage']!r} != expected 6236/6236")

    rr = artifact["review_reconciliation"]
    if rr["human_verified_segments"] != lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS:
        raise ImportAbort("ARTIFACT", f"human_verified_segments {rr['human_verified_segments']} != {lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS}")
    if rr["human_verified_joins"] != lib.EXPECTED_HUMAN_VERIFIED_JOINS:
        raise ImportAbort("ARTIFACT", f"human_verified_joins {rr['human_verified_joins']} != {lib.EXPECTED_HUMAN_VERIFIED_JOINS}")
    if rr["tier2_human_verified_joins"] != lib.EXPECTED_TIER2_HUMAN_VERIFIED_JOINS:
        raise ImportAbort("ARTIFACT", f"tier2_human_verified_joins {rr['tier2_human_verified_joins']} != {lib.EXPECTED_TIER2_HUMAN_VERIFIED_JOINS}")

    for s in artifact["segments"]:
        if s["alignment_type"] not in lib.VALID_ALIGNMENT_TYPES:
            raise ImportAbort("ARTIFACT", f"segment {s['surah_number']}:{s['source_ordinal']} alignment_type {s['alignment_type']!r} outside domain")
        if s["alignment_status"] not in lib.VALID_ALIGNMENT_STATUSES:
            raise ImportAbort("ARTIFACT", f"segment {s['surah_number']}:{s['source_ordinal']} alignment_status {s['alignment_status']!r} outside domain")
        if s["segment_type"] not in lib.VALID_SEGMENT_TYPES:
            raise ImportAbort("ARTIFACT", f"segment {s['surah_number']}:{s['source_ordinal']} segment_type {s['segment_type']!r} outside domain")
    for j in artifact["joins"]:
        if j["mapping_confidence"] not in lib.VALID_MAPPING_CONFIDENCE:
            raise ImportAbort("ARTIFACT", f"join {j['segment_key']}->{j['ayah_number']} mapping_confidence {j['mapping_confidence']!r} outside domain")

    for key in lib.KNOWN_NULL_DECLARED_NUMBER_SEGMENTS:
        matching = [s for s in artifact["segments"] if (s["surah_number"], s["source_ordinal"]) == key]
        if not matching or matching[0]["source_declared_number"] is not None:
            raise ImportAbort("ARTIFACT", f"expected {key} to have source_declared_number=NULL in the artifact")

    return artifact


# ---------------------------------------------------------------------------
# Baselines (read-only, used both pre-write and, embedded in the SQL script,
# post-write)
# ---------------------------------------------------------------------------


def db_ayahs_baseline_sql(schema: str) -> str:
    return (
        "SELECT count(*), encode(digest(coalesce(string_agg(arabic_text, E'\\x1e' ORDER BY surah_number, ayah_number), ''), 'sha256'), 'hex') "
        "FROM public.ayahs;"
    )


def db_pickthall_baseline_sql(schema: str) -> str:
    return (
        "SELECT count(*), encode(digest(coalesce(string_agg(t.text, E'\\x1e' ORDER BY t.surah_number, t.ayah_number), ''), 'sha256'), 'hex') "
        "FROM public.translations t JOIN public.content_sources cs ON cs.id = t.source_id "
        "WHERE cs.edition_identifier = 'pickthall-gutenberg-16955' AND cs.verification_status = 'verified';"
    )


def fetch_baseline(db_url: str, sql: str) -> tuple[int, str]:
    out = lib.psql(db_url, sql).strip()
    count_s, hsh = out.split("\t")
    return int(count_s), hsh


# ---------------------------------------------------------------------------
# Idempotency-state classification (read-only)
# ---------------------------------------------------------------------------


def classify_state(db_url: str, schema: str, artifact: dict) -> tuple[str, dict]:
    """Returns (state, detail) where state in {'A','B','C','D','E','F'}."""
    src_id = lib.content_source_id()
    src_row = lib.psql(
        db_url,
        f"SELECT id, verification_status FROM public.content_sources WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';",
    ).strip()
    src_rows = [tuple(line.split("\t")) for line in src_row.splitlines() if line.strip()]
    src_by_edition = None
    src_status = None
    if len(src_rows) == 1:
        src_by_edition, src_status = src_rows[0]
    elif len(src_rows) > 1:
        # More than one content_sources row shares this edition_identifier --
        # an identity-collision shape regardless of any individual row's
        # status. Preserve the prior behavior of joining all found ids into
        # one string (guaranteed not to equal a single deterministic uuid),
        # which the id-mismatch check just below turns into state E.
        src_by_edition = "\n".join(r[0] for r in src_rows)

    seg_ids = [s["id"] for s in artifact["segments"]]
    join_ids = [j["id"] for j in artifact["joins"]]

    existing_seg_rows = lib.psql(
        db_url,
        f"SELECT id, source_id, surah_number, source_ordinal, source_declared_number, text_sha256, alignment_type, alignment_status "
        f"FROM {schema}.translation_segments WHERE id = ANY(ARRAY[{','.join(chr(39)+s+chr(39) for s in seg_ids)}]::uuid[]);",
    )
    existing_segs = {}
    for line in existing_seg_rows.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        existing_segs[parts[0]] = parts

    existing_join_rows = lib.psql(
        db_url,
        f"SELECT id, segment_id, surah_number, ayah_number, mapping_confidence "
        f"FROM {schema}.translation_segment_ayahs WHERE id = ANY(ARRAY[{','.join(chr(39)+j+chr(39) for j in join_ids)}]::uuid[]);",
    )
    existing_joins = {}
    for line in existing_join_rows.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        existing_joins[parts[0]] = parts

    n_existing_segs = len(existing_segs)
    n_existing_joins = len(existing_joins)

    # Zero rows present is state A regardless of whether the content_sources
    # row already exists: the normal, expected flow is schema migration
    # (which registers the content_sources row as part of §7/§13's design --
    # "the data is present and queryable immediately after import but not
    # yet eligible ...") THEN a separate import step that fills in the
    # segments/joins. A content_sources row with zero dependent rows is not
    # "partial" -- there is nothing to be partial about yet.
    if n_existing_segs == 0 and n_existing_joins == 0:
        if src_by_edition and src_by_edition != str(src_id):
            return "E", {
                "reason": "a content_sources row with this edition_identifier already exists under a DIFFERENT id than the deterministic id this importer computes",
                "found_id": src_by_edition,
                "expected_id": str(src_id),
            }
        if src_by_edition and src_status == "deprecated":
            # The exact shape rollback_kazimirski.py leaves behind: the
            # content_sources row present under the correct deterministic id,
            # deprecated, zero dependent segments/joins. This is NOT the
            # normal "schema migration just ran" shape (which leaves the row
            # 'candidate') -- classified as its own distinct state so a
            # normal import refuses cleanly and by name, rather than reaching
            # state A and failing deep inside the transaction's own
            # re-assert block. See check_recovery_eligibility() for the only
            # sanctioned way past this state.
            return "F", {
                "reason": "content_sources row exists with verification_status=deprecated and zero segments/joins -- this is the rollback-produced state; normal import will not auto-resolve it, use --recover-after-rollback",
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
        # Structurally shouldn't happen (translation_segments.source_id has an
        # FK to content_sources.id, so rows matching our deterministic segment
        # ids could only exist under our deterministic source_id) -- checked
        # anyway, fail closed rather than assume.
        return "E", {
            "reason": "existing segment/join rows found, but the content_sources row for this edition_identifier has an unexpected id",
            "found_id": src_by_edition,
            "expected_id": str(src_id),
        }

    if n_existing_segs < len(seg_ids) or n_existing_joins < len(join_ids):
        return "C", {
            "reason": "content_sources row exists but not all expected segment/join rows are present (partial prior run)",
            "existing_segments": n_existing_segs,
            "expected_segments": len(seg_ids),
            "existing_joins": n_existing_joins,
            "expected_joins": len(join_ids),
        }

    # All rows present by ID -- verify content matches exactly (divergence check).
    diverging = []
    for s in artifact["segments"]:
        row = existing_segs.get(s["id"])
        if row is None:
            continue
        _id, source_id, surah, ordinal, decl, hsh, atype, astatus = row
        if (
            source_id != str(src_id)
            or int(surah) != s["surah_number"]
            or int(ordinal) != s["source_ordinal"]
            or (None if decl == "" else int(decl)) != s["source_declared_number"]
            or hsh != s["text_sha256"]
            or atype != s["alignment_type"]
            or astatus != s["alignment_status"]
        ):
            diverging.append(("segment", s["id"]))
    for j in artifact["joins"]:
        row = existing_joins.get(j["id"])
        if row is None:
            continue
        _id, segment_id, surah, ayah, conf = row
        if segment_id != j["segment_id"] or int(surah) != j["surah_number"] or int(ayah) != j["ayah_number"] or conf != j["mapping_confidence"]:
            diverging.append(("join", j["id"]))

    if diverging:
        return "D", {"reason": "one or more existing rows diverge from the artifact", "diverging_count": len(diverging), "examples": diverging[:10]}

    return "B", {"existing_segments": n_existing_segs, "existing_joins": n_existing_joins}


# ---------------------------------------------------------------------------
# Recovery-eligibility check (state F only, --recover-after-rollback only)
# ---------------------------------------------------------------------------

# The exact set of content_sources columns the migration's INSERT (and the
# generator's artifact["content_source"]) both declare, excluding id (checked
# separately, condition 1), verification_status (checked separately,
# condition 6 -- it is EXPECTED to differ pre-recovery, that's the whole
# point), retrieved_at (checked separately via epoch comparison -- text
# formatting differs between Postgres's own rendering and the artifact's ISO
# string), and notes/created_at (not declared by the artifact at all, not
# part of its identity contract).
_PROVENANCE_TEXT_FIELDS = [
    "content_type",
    "provider_name",
    "dataset_name",
    "language",
    "translator",
    "version",
    "license_name",
    "license_url",
    "source_url",
]
_PROVENANCE_BOOL_FIELDS = [
    "attribution_required",
    "modification_restricted",
    "public_domain",
    "legacy_interim",
]


def check_recovery_eligibility(db_url: str, schema: str, artifact: dict) -> dict:
    """Read-only. Independently re-verifies, by direct query, every one of
    the 9 recovery conditions documented in this module's docstring. Raises
    ImportAbort("RECOVERY", ...) naming exactly which condition failed on the
    first one that does. Never writes anything. Returns a small dict of
    confirmed facts on total success."""
    cs = artifact["content_source"]
    expected_id = str(lib.content_source_id())

    select_cols = ["id"] + _PROVENANCE_TEXT_FIELDS + _PROVENANCE_BOOL_FIELDS + ["verification_status"]
    row_text = lib.psql(
        db_url,
        f"SELECT {', '.join(select_cols)} FROM public.content_sources "
        f"WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';",
    ).strip()

    # Condition 1 (existence + exact deterministic id match).
    if not row_text:
        raise ImportAbort(
            "RECOVERY",
            f"condition 1 failed: no content_sources row found for edition_identifier={lib.EDITION_IDENTIFIER!r} -- nothing to recover.",
        )
    row_lines = [ln for ln in row_text.splitlines() if ln.strip()]
    if len(row_lines) != 1:
        raise ImportAbort(
            "RECOVERY",
            f"condition 1 failed: expected exactly one content_sources row for edition_identifier={lib.EDITION_IDENTIFIER!r}, found {len(row_lines)}.",
        )
    values = row_lines[0].split("\t")
    db = dict(zip(select_cols, values))

    if db["id"] != expected_id:
        raise ImportAbort(
            "RECOVERY",
            f"condition 1 failed: content_sources row id {db['id']} != deterministic expected id {expected_id}. Refusing to guess.",
        )

    # Condition 2 (edition_identifier itself -- always true by construction of
    # the WHERE clause above, but re-asserted explicitly and named separately
    # from the bundled provenance check below, per the design's own numbering).
    if lib.EDITION_IDENTIFIER != cs["edition_identifier"]:
        raise ImportAbort(
            "RECOVERY",
            f"condition 2 failed: edition_identifier {lib.EDITION_IDENTIFIER!r} != artifact's declared {cs['edition_identifier']!r}.",
        )

    # Conditions 3 + 7 (every other provenance field, one unified per-field
    # comparison -- see module docstring for why this is one check, not two).
    diverging_fields: list[str] = []
    for field in _PROVENANCE_TEXT_FIELDS:
        db_val = db[field]
        expected_val = cs.get(field) or ""
        if db_val != expected_val:
            diverging_fields.append(f"{field} (db={db_val!r} expected={expected_val!r})")
    for field in _PROVENANCE_BOOL_FIELDS:
        db_val = db[field] == "t"
        expected_val = bool(cs.get(field))
        if db_val != expected_val:
            diverging_fields.append(f"{field} (db={db_val!r} expected={expected_val!r})")

    expected_retrieved_epoch = None
    if cs.get("retrieved_at"):
        from datetime import datetime

        expected_retrieved_epoch = datetime.fromisoformat(cs["retrieved_at"]).timestamp()
        db_retrieved_epoch_s = lib.psql_scalar(
            db_url, f"SELECT extract(epoch from retrieved_at) FROM public.content_sources WHERE id = '{expected_id}';"
        )
        db_retrieved_epoch = float(db_retrieved_epoch_s) if db_retrieved_epoch_s else None
        if db_retrieved_epoch is None or abs(db_retrieved_epoch - expected_retrieved_epoch) > 0.001:
            diverging_fields.append(f"retrieved_at (db_epoch={db_retrieved_epoch!r} expected_epoch={expected_retrieved_epoch!r})")

    if diverging_fields:
        raise ImportAbort(
            "RECOVERY",
            f"condition 3/7 failed: provenance field(s) diverge from the artifact's declared content_source: {diverging_fields}. "
            f"This does not look like the exact rollback-produced row -- refusing.",
        )

    # Condition 6 (verification_status is exactly 'deprecated', not merely
    # "not candidate" -- any other value could mean something else happened).
    if db["verification_status"] != "deprecated":
        raise ImportAbort(
            "RECOVERY",
            f"condition 6 failed: verification_status is {db['verification_status']!r}, expected exactly 'deprecated' "
            f"(the specific state rollback_kazimirski.py produces). Refusing -- this may indicate something other than "
            f"a rollback occurred and must be investigated manually before recovery.",
        )

    # Condition 4 (zero translation_segments rows reference this source_id).
    n_segs = lib.psql_int(db_url, f"SELECT count(*) FROM {schema}.translation_segments WHERE source_id = '{expected_id}';")
    if n_segs != 0:
        raise ImportAbort(
            "RECOVERY",
            f"condition 4 failed: {n_segs} translation_segments row(s) still reference source_id {expected_id} -- refusing, this is not the clean rollback-produced state.",
        )

    # Condition 5 (zero translation_segment_ayahs rows reference any segment
    # under this source_id -- checked directly, not merely inferred from
    # condition 4's FK-implied guarantee).
    n_joins = lib.psql_int(
        db_url,
        f"SELECT count(*) FROM {schema}.translation_segment_ayahs tsa "
        f"JOIN {schema}.translation_segments ts ON ts.id = tsa.segment_id WHERE ts.source_id = '{expected_id}';",
    )
    if n_joins != 0:
        raise ImportAbort(
            "RECOVERY",
            f"condition 5 failed: {n_joins} translation_segment_ayahs row(s) still reference segments under source_id {expected_id} -- refusing.",
        )

    # Condition 8 (artifact's own declared hashes match the approved, hardcoded
    # values). load_and_validate_artifact() already enforces this
    # unconditionally before recovery is ever considered; re-asserted here
    # defensively so this function is self-contained and fail-closed even if
    # called in isolation.
    if artifact["raw_source_sha256"] != lib.EXPECTED_RAW_SOURCE_SHA256:
        raise ImportAbort("RECOVERY", "condition 8 failed: artifact raw_source_sha256 does not match the approved value.")
    if artifact["aggregate_segment_text_hash"] != lib.EXPECTED_AGGREGATE_SEGMENT_TEXT_HASH:
        raise ImportAbort("RECOVERY", "condition 8 failed: artifact aggregate_segment_text_hash does not match the approved value.")

    # Condition 9 (explicit opt-in) is enforced structurally by the caller:
    # this function is only ever invoked from run_import() after both (a)
    # classify_state() independently determined the DB is in state F, and
    # (b) --recover-after-rollback was passed on the command line. It cannot
    # be reached as a side effect of a normal import invocation.

    return {"source_id": expected_id, "prior_status": db["verification_status"]}


# ---------------------------------------------------------------------------
# SQL script construction for state A (fresh import)
# ---------------------------------------------------------------------------


def build_segment_insert_batches(schema: str, segments: list[dict], src_id) -> list[str]:
    cols = "(id, source_id, surah_number, segment_type, source_ordinal, source_declared_number, text, text_sha256, extraction_source_ref, alignment_type, alignment_status, reviewer_notes, reviewed_by, reviewed_at)"
    batches = []
    for i in range(0, len(segments), BATCH_SIZE):
        chunk = segments[i : i + BATCH_SIZE]
        rows = []
        for s in chunk:
            rows.append(
                "("
                + ",".join(
                    [
                        lib.sql_literal(s["id"]),
                        lib.sql_literal(str(src_id)),
                        lib.sql_literal(s["surah_number"]),
                        lib.sql_literal(s["segment_type"]),
                        lib.sql_literal(s["source_ordinal"]),
                        lib.sql_literal(s["source_declared_number"]),
                        lib.sql_literal(s["text"]),
                        lib.sql_literal(s["text_sha256"]),
                        lib.sql_literal(s["extraction_source_ref"]),
                        lib.sql_literal(s["alignment_type"]),
                        lib.sql_literal(s["alignment_status"]),
                        lib.sql_literal(s["reviewer_notes"]),
                        lib.sql_literal(s["reviewed_by"]),
                        lib.sql_literal(s["reviewed_at"]),
                    ]
                )
                + ")"
            )
        batches.append(f"INSERT INTO {schema}.translation_segments {cols} VALUES\n" + ",\n".join(rows) + ";")
    return batches


def build_join_insert_batches(schema: str, joins: list[dict]) -> list[str]:
    cols = "(id, segment_id, surah_number, ayah_number, mapping_confidence, reviewer_notes, reviewed_by, reviewed_at)"
    batches = []
    for i in range(0, len(joins), BATCH_SIZE):
        chunk = joins[i : i + BATCH_SIZE]
        rows = []
        for j in chunk:
            rows.append(
                "("
                + ",".join(
                    [
                        lib.sql_literal(j["id"]),
                        lib.sql_literal(j["segment_id"]),
                        lib.sql_literal(j["surah_number"]),
                        lib.sql_literal(j["ayah_number"]),
                        lib.sql_literal(j["mapping_confidence"]),
                        lib.sql_literal(j["reviewer_notes"]),
                        lib.sql_literal(j["reviewed_by"]),
                        lib.sql_literal(j["reviewed_at"]),
                    ]
                )
                + ")"
            )
        batches.append(f"INSERT INTO {schema}.translation_segment_ayahs {cols} VALUES\n" + ",\n".join(rows) + ";")
    return batches


def build_import_transaction_sql(
    schema: str,
    artifact: dict,
    pre_ayahs: tuple,
    pre_pickthall: tuple,
    content_source_pre_exists: bool = False,
    reactivate_from_deprecated: bool = False,
) -> str:
    cs = artifact["content_source"]
    src_id = cs["id"]
    ayahs_count, ayahs_hash = pre_ayahs
    pick_count, pick_hash = pre_pickthall

    parts = []
    parts.append("BEGIN;")
    parts.append(
        f"""
DO $$
DECLARE
  v_count integer;
  v_hash text;
BEGIN
  SELECT count(*), encode(digest(coalesce(string_agg(arabic_text, E'\\x1e' ORDER BY surah_number, ayah_number), ''), 'sha256'), 'hex')
    INTO v_count, v_hash FROM public.ayahs;
  IF v_count != {ayahs_count} OR v_hash != '{ayahs_hash}' THEN
    RAISE EXCEPTION 'PRECONDITION FAILED inside transaction: ayahs baseline changed between pre-check and transaction start (count % vs {ayahs_count}, hash % vs {ayahs_hash})', v_count, v_hash;
  END IF;

  SELECT count(*), encode(digest(coalesce(string_agg(t.text, E'\\x1e' ORDER BY t.surah_number, t.ayah_number), ''), 'sha256'), 'hex')
    INTO v_count, v_hash
  FROM public.translations t JOIN public.content_sources cs ON cs.id = t.source_id
  WHERE cs.edition_identifier = 'pickthall-gutenberg-16955' AND cs.verification_status = 'verified';
  IF v_count != {pick_count} OR v_hash != '{pick_hash}' THEN
    RAISE EXCEPTION 'PRECONDITION FAILED inside transaction: Pickthall baseline changed between pre-check and transaction start (count % vs {pick_count}, hash % vs {pick_hash})', v_count, v_hash;
  END IF;
END $$;
"""
    )

    if reactivate_from_deprecated:
        # RECOVERY PATH (state F + --recover-after-rollback only).
        # check_recovery_eligibility() has already independently verified,
        # by direct query, all 9 recovery conditions -- including that
        # verification_status is currently exactly 'deprecated' -- before
        # build_import_transaction_sql() is ever called with this flag. This
        # DO block re-checks that one fact again, INSIDE the transaction,
        # defending against a race between that pre-check and BEGIN (the
        # same defense-in-depth pattern the ayahs/Pickthall baseline
        # re-checks above already use). The UPDATE that follows is the only
        # write this recovery path makes to content_sources -- it happens in
        # the SAME transaction as every segment/join INSERT below, so any
        # failure during those inserts (e.g. a postcondition mismatch) rolls
        # this reactivation back too, leaving the row exactly as rollback
        # left it (deprecated) if anything goes wrong.
        parts.append(
            f"""
DO $$
DECLARE
  v_status text;
BEGIN
  SELECT verification_status INTO v_status FROM public.content_sources WHERE id = {lib.sql_literal(src_id)};
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'RECOVERY PRECONDITION FAILED inside transaction: expected pre-existing deprecated content_sources row % but found none', {lib.sql_literal(src_id)};
  END IF;
  IF v_status != 'deprecated' THEN
    RAISE EXCEPTION 'RECOVERY PRECONDITION FAILED inside transaction: expected verification_status=deprecated immediately before reactivation for row %, found % -- aborting, someone/something changed it between the pre-check and this transaction', {lib.sql_literal(src_id)}, v_status;
  END IF;
END $$;

UPDATE public.content_sources SET verification_status = {lib.sql_literal(cs['verification_status'])} WHERE id = {lib.sql_literal(src_id)};
"""
        )
    elif content_source_pre_exists:
        # The schema migration already registered this content_sources row
        # (deterministic id, so it's guaranteed to be the same logical row --
        # classify_state() already confirmed the id matches before this
        # function is ever called with content_source_pre_exists=True).
        # Re-assert its expected fields rather than re-inserting it.
        parts.append(
            f"""
DO $$
DECLARE
  v_status text;
BEGIN
  SELECT verification_status INTO v_status FROM public.content_sources WHERE id = {lib.sql_literal(src_id)};
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'expected pre-existing content_sources row % (created by the schema migration) but found none', {lib.sql_literal(src_id)};
  END IF;
  IF v_status != {lib.sql_literal(cs['verification_status'])} THEN
    RAISE EXCEPTION 'pre-existing content_sources row % has verification_status=%, expected %', {lib.sql_literal(src_id)}, v_status, {lib.sql_literal(cs['verification_status'])};
  END IF;
END $$;
"""
        )
    else:
        parts.append(
            f"""
INSERT INTO public.content_sources
  (id, content_type, provider_name, dataset_name, edition_identifier, language,
   translator, version, license_name, license_url, attribution_required,
   modification_restricted, source_url, retrieved_at, public_domain,
   legacy_interim, verification_status)
VALUES (
  {lib.sql_literal(src_id)}, {lib.sql_literal(cs['content_type'])}, {lib.sql_literal(cs['provider_name'])},
  {lib.sql_literal(cs['dataset_name'])}, {lib.sql_literal(cs['edition_identifier'])}, {lib.sql_literal(cs['language'])},
  {lib.sql_literal(cs['translator'])}, {lib.sql_literal(cs['version'])}, {lib.sql_literal(cs['license_name'])},
  {lib.sql_literal(cs['license_url'])}, {lib.sql_literal(cs['attribution_required'])}, {lib.sql_literal(cs['modification_restricted'])},
  {lib.sql_literal(cs['source_url'])}, {lib.sql_literal(cs['retrieved_at'])}, {lib.sql_literal(cs['public_domain'])},
  {lib.sql_literal(cs['legacy_interim'])}, {lib.sql_literal(cs['verification_status'])}
);
"""
        )

    for batch_sql in build_segment_insert_batches(schema, artifact["segments"], src_id):
        parts.append(batch_sql)
    for batch_sql in build_join_insert_batches(schema, artifact["joins"]):
        parts.append(batch_sql)

    parts.append(
        f"""
DO $$
DECLARE
  v_segments integer;
  v_joins integer;
  v_coverage integer;
  v_hv_segments integer;
  v_hv_joins integer;
  v_count integer;
  v_hash text;
BEGIN
  SELECT count(*) INTO v_segments FROM {schema}.translation_segments WHERE source_id = {lib.sql_literal(src_id)};
  IF v_segments != {lib.EXPECTED_SEGMENT_COUNT} THEN
    RAISE EXCEPTION 'POSTCONDITION FAILED: expected {lib.EXPECTED_SEGMENT_COUNT} segments, found %', v_segments;
  END IF;

  SELECT count(*) INTO v_joins FROM {schema}.translation_segment_ayahs tsa
    JOIN {schema}.translation_segments ts ON ts.id = tsa.segment_id WHERE ts.source_id = {lib.sql_literal(src_id)};
  IF v_joins != {lib.EXPECTED_JOIN_COUNT} THEN
    RAISE EXCEPTION 'POSTCONDITION FAILED: expected {lib.EXPECTED_JOIN_COUNT} joins, found %', v_joins;
  END IF;

  SELECT count(DISTINCT (tsa.surah_number, tsa.ayah_number)) INTO v_coverage FROM {schema}.translation_segment_ayahs tsa
    JOIN {schema}.translation_segments ts ON ts.id = tsa.segment_id WHERE ts.source_id = {lib.sql_literal(src_id)};
  IF v_coverage != {lib.EXPECTED_CANONICAL_AYAHS} THEN
    RAISE EXCEPTION 'POSTCONDITION FAILED: expected coverage {lib.EXPECTED_CANONICAL_AYAHS}, found %', v_coverage;
  END IF;

  SELECT count(*) INTO v_hv_segments FROM {schema}.translation_segments WHERE source_id = {lib.sql_literal(src_id)} AND alignment_status = 'human_verified';
  IF v_hv_segments != {lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS} THEN
    RAISE EXCEPTION 'POSTCONDITION FAILED: expected {lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS} human_verified segments, found %', v_hv_segments;
  END IF;

  SELECT count(*) INTO v_hv_joins FROM {schema}.translation_segment_ayahs tsa
    JOIN {schema}.translation_segments ts ON ts.id = tsa.segment_id
    WHERE ts.source_id = {lib.sql_literal(src_id)} AND tsa.mapping_confidence = 'human_verified';
  IF v_hv_joins != {lib.EXPECTED_HUMAN_VERIFIED_JOINS} THEN
    RAISE EXCEPTION 'POSTCONDITION FAILED: expected {lib.EXPECTED_HUMAN_VERIFIED_JOINS} human_verified joins, found %', v_hv_joins;
  END IF;

  SELECT count(*), encode(digest(coalesce(string_agg(arabic_text, E'\\x1e' ORDER BY surah_number, ayah_number), ''), 'sha256'), 'hex')
    INTO v_count, v_hash FROM public.ayahs;
  IF v_count != {ayahs_count} OR v_hash != '{ayahs_hash}' THEN
    RAISE EXCEPTION 'POSTCONDITION FAILED: ayahs baseline changed during import (count % vs {ayahs_count}, hash % vs {ayahs_hash}) -- rolling back.', v_count, v_hash;
  END IF;

  SELECT count(*), encode(digest(coalesce(string_agg(t.text, E'\\x1e' ORDER BY t.surah_number, t.ayah_number), ''), 'sha256'), 'hex')
    INTO v_count, v_hash
  FROM public.translations t JOIN public.content_sources cs ON cs.id = t.source_id
  WHERE cs.edition_identifier = 'pickthall-gutenberg-16955' AND cs.verification_status = 'verified';
  IF v_count != {pick_count} OR v_hash != '{pick_hash}' THEN
    RAISE EXCEPTION 'POSTCONDITION FAILED: Pickthall baseline changed during import (count % vs {pick_count}, hash % vs {pick_hash}) -- rolling back.', v_count, v_hash;
  END IF;

  RAISE NOTICE 'Postconditions satisfied: % segments, % joins, coverage %, % human_verified segments, % human_verified joins. ayahs/Pickthall baselines unchanged.', v_segments, v_joins, v_coverage, v_hv_segments, v_hv_joins;
END $$;
"""
    )
    parts.append("COMMIT;")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def run_import(db_url: str, schema: str, artifact_path: Path, dry_run: bool = False, recover_after_rollback: bool = False) -> int:
    lib.assert_local_db(db_url)
    artifact = load_and_validate_artifact(artifact_path)
    print("Artifact validation: PASSED (schema_version, both hashes, self-integrity, all counts, review totals).")

    pre_ayahs = fetch_baseline(db_url, db_ayahs_baseline_sql(schema))
    pre_pickthall = fetch_baseline(db_url, db_pickthall_baseline_sql(schema))
    print(f"Pre-import baseline: ayahs count={pre_ayahs[0]} hash={pre_ayahs[1][:12]}...  pickthall count={pre_pickthall[0]} hash={pre_pickthall[1][:12]}...")
    if pre_ayahs[0] != lib.EXPECTED_CANONICAL_AYAHS:
        raise ImportAbort("BASELINE", f"pre-import ayahs count {pre_ayahs[0]} != expected {lib.EXPECTED_CANONICAL_AYAHS}")
    if pre_pickthall[0] != lib.EXPECTED_CANONICAL_AYAHS:
        raise ImportAbort("BASELINE", f"pre-import Pickthall count {pre_pickthall[0]} != expected {lib.EXPECTED_CANONICAL_AYAHS}")

    state, detail = classify_state(db_url, schema, artifact)
    print(f"Idempotency state: {state} {detail}")

    if state == "B":
        print("Already imported, verified identical. No-op. Zero new rows written.")
        return 0
    if state == "F":
        # Rollback-produced state: content_sources deprecated, zero
        # segments/joins. A normal invocation refuses cleanly here -- never
        # auto-reactivates as a side effect. Only an explicit
        # --recover-after-rollback invocation may proceed past this point,
        # and even then only after check_recovery_eligibility() independently
        # re-verifies every one of the 9 recovery conditions itself.
        if not recover_after_rollback:
            raise ImportAbort(
                "F",
                f"{detail.get('reason')} (content_sources id={detail.get('content_source_id')}). "
                f"Zero writes. If you intend to recover this exact rollback-produced state, re-run with --recover-after-rollback.",
            )
        eligibility = check_recovery_eligibility(db_url, schema, artifact)
        print(
            f"Recovery eligibility: ALL 9 CONDITIONS PASSED. "
            f"source_id={eligibility['source_id']} prior_status={eligibility['prior_status']}."
        )
        sql = build_import_transaction_sql(
            schema, artifact, pre_ayahs, pre_pickthall, content_source_pre_exists=True, reactivate_from_deprecated=True
        )
        if dry_run:
            print(f"[dry-run] recovery eligible; would execute a {len(sql)}-byte reactivation+import transaction script. Not executing.")
            return 0
        lib.psql_text(db_url, sql)
        print(
            f"Recovery import committed: content_sources row {eligibility['source_id']} reactivated from "
            f"'{eligibility['prior_status']}' to '{artifact['content_source']['verification_status']}', "
            f"{lib.EXPECTED_SEGMENT_COUNT} segments, {lib.EXPECTED_JOIN_COUNT} joins imported."
        )
        return 0
    if state in ("C", "D", "E"):
        raise ImportAbort(state, json.dumps(detail, default=str))
    if state != "A":
        raise ImportAbort("UNKNOWN", f"unrecognized state {state!r}")

    if recover_after_rollback:
        print("Note: --recover-after-rollback was passed but the DB is not in the rollback-produced state (state F); proceeding with the normal import path, flag has no effect.")

    sql = build_import_transaction_sql(schema, artifact, pre_ayahs, pre_pickthall, content_source_pre_exists=bool(detail.get("content_source_pre_exists")))
    if dry_run:
        print(f"[dry-run] would execute a {len(sql)}-byte transaction script. Not executing.")
        return 0

    lib.psql_text(db_url, sql)
    print(f"Import committed: {lib.EXPECTED_SEGMENT_COUNT} segments, {lib.EXPECTED_JOIN_COUNT} joins, source_id={artifact['content_source']['id']}.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db-url", default=lib.DEFAULT_DB_URL)
    parser.add_argument("--schema", default="public", help="schema for translation_segments/translation_segment_ayahs (default: public)")
    parser.add_argument("--artifact", default=str(lib.ARTIFACT_PATH))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--recover-after-rollback",
        action="store_true",
        help=(
            "Explicit, narrowly-scoped opt-in to reactivate and re-import the exact known Kazimirski "
            "content_sources row after rollback_kazimirski.py deprecated it (see this module's docstring "
            "for the 9 conditions independently re-verified before anything is written). Has no effect "
            "unless the DB is in state F (deprecated, zero segments/joins)."
        ),
    )
    args = parser.parse_args()

    try:
        sys.exit(run_import(args.db_url, args.schema, Path(args.artifact), args.dry_run, args.recover_after_rollback))
    except ImportAbort:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ImportAbort("UNEXPECTED", f"{type(exc).__name__}: {exc}") from exc


if __name__ == "__main__":
    main()

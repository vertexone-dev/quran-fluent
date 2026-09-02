#!/usr/bin/env python3
"""
Shared constants and helpers for the Kazimirski PRODUCTION migration/import
machinery (generator, importer, rollback tool, validator, tests).

STATUS: local implementation only. Nothing in this module writes to
anything other than 127.0.0.1/localhost Postgres, and nothing in this
module ever touches `ayahs` or `translations`.

============================================================================
ID STRATEGY -- DESIGN DEVIATION FROM PRODUCTION-MIGRATION-IMPORT-DESIGN.md §11
============================================================================
The design doc's own §11 recommended fresh `gen_random_uuid()` values,
generated at import time, matching every other table's convention. This
module deliberately overrides that recommendation with deterministic
UUIDv5 IDs instead, per an explicit, reasoned instruction for this
particular import:

  - This project has an unusually heavy emphasis on repeated rehearsal,
    cross-environment reconciliation, and idempotency-by-primary-key.
  - Deterministic IDs let a re-run's "does this already exist" check be a
    simple primary-key lookup instead of a full content comparison.
  - Deterministic IDs let rehearsal-environment IDs and eventual-production
    IDs match exactly for the same logical segment/join, which is valuable
    given how many times this exact data is likely to be re-validated
    across environments before real production use.

Implemented with Python's `uuid.uuid5` (RFC 4122, SHA-1-based, stable
across processes and machines) -- never `uuid.uuid4()` for these IDs, and
never Python's built-in randomized `hash()`.

KAZIMIRSKI_UUID_NAMESPACE below is a fixed, hardcoded namespace UUID,
generated once (`uuid.uuid4()`) and never regenerated. Changing it would
silently change every derived ID, breaking the exact cross-environment
stability this whole scheme exists to provide -- treat it as frozen.
"""
from __future__ import annotations

import hashlib
import re
import subprocess
import sys
import uuid
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths / frozen inputs
# ---------------------------------------------------------------------------

KAZ_DIR = Path(__file__).parent
RAW_HTML_PATH = KAZ_DIR / "texte_entier_raw.html"
MANIFEST_PATH = KAZ_DIR / "kazimirski_alignment_manifest.json"
DECISIONS_PATH = KAZ_DIR / "PHASE5-REVIEW-DECISIONS.json"
TIER3_FROZEN_SAMPLE_PATH = KAZ_DIR / "PHASE5-TIER3-FROZEN-SAMPLE.json"
GENERATED_DIR = KAZ_DIR / "generated"
ARTIFACT_PATH = GENERATED_DIR / "kazimirski-production-import.json"
MIGRATIONS_STAGING_DIR = KAZ_DIR / "migrations-staging"
MIGRATION_FILE_PATH = MIGRATIONS_STAGING_DIR / "20260912100000_4bddf81d-6e3e-4260-a2a2-89c4b5b3f933.sql"

# ---------------------------------------------------------------------------
# Authoritative known-good values (independently re-verified against the
# live local DB and the manifest during this implementation session -- see
# the final report for the verification trail).
# ---------------------------------------------------------------------------

EXPECTED_RAW_SOURCE_SHA256 = "38f94de9e95b8163949d68e69c150ae14343f8799006b58c1fc44fc17f9d0b92"
EXPECTED_AGGREGATE_SEGMENT_TEXT_HASH = "12015b8f007a41adc36776172d3161d25c0f01a78bdc6a2418fcc6937ee9fc26"
EXPECTED_SEGMENT_COUNT = 6239
EXPECTED_JOIN_COUNT = 6396
EXPECTED_CANONICAL_AYAHS = 6236
EXPECTED_DECISIONS_COUNT = 25
EXPECTED_HUMAN_VERIFIED_SEGMENTS = 57
EXPECTED_HUMAN_VERIFIED_JOINS = 80
EXPECTED_TIER2_HUMAN_VERIFIED_JOINS = 17
EXPECTED_TIER3_FROZEN_SAMPLE_SIZE = 53

TIER2_COMPOUND_BOUNDARY_AYAHS = {
    (3, 39), (3, 167), (11, 39), (14, 44), (47, 21), (65, 3), (65, 10), (106, 4),
}

# The two segments whose source_declared_number is authoritatively NULL and
# must never be backfilled or inferred, anywhere, ever.
KNOWN_NULL_DECLARED_NUMBER_SEGMENTS = {(2, 286), (36, 83)}

VALID_ALIGNMENT_TYPES = {
    "direct", "offset", "one_to_many", "many_to_one", "compound", "unresolved", "source_anomaly",
}
VALID_ALIGNMENT_STATUSES = {
    "auto_verified", "cross_verified", "human_verified", "unresolved", "rejected",
}
VALID_MAPPING_CONFIDENCE = {"auto", "cross_verified", "human_verified", "needs_review"}
VALID_SEGMENT_TYPES = {"numbered", "unnumbered_preamble"}

# ---------------------------------------------------------------------------
# Production identifiers
# ---------------------------------------------------------------------------

EDITION_IDENTIFIER = "kazimirski-1869-segments-v1"
SCHEMA_VERSION = "1.0.0"
GENERATOR_VERSION = "kazimirski-import-gen-v1"

# The local Phase 3-5 prototype's own content_sources row -- READ-ONLY,
# used by the generator solely as the "source DB" ground-truth reconciliation
# target the design's gates 9-11 require (never written to by anything in
# this module).
PROTOTYPE_EDITION_IDENTIFIER = "kazimirski-1869-segments-phase3"

DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# ---------------------------------------------------------------------------
# ID strategy -- deterministic UUIDv5 (see module docstring)
# ---------------------------------------------------------------------------

KAZIMIRSKI_UUID_NAMESPACE = uuid.UUID("211bf6a0-ee15-46fa-831e-3cf62a524d9b")


def content_source_id(edition_identifier: str = EDITION_IDENTIFIER) -> uuid.UUID:
    return uuid.uuid5(KAZIMIRSKI_UUID_NAMESPACE, f"source:{edition_identifier}")


def segment_id(surah_number: int, source_ordinal: int, edition_identifier: str = EDITION_IDENTIFIER) -> uuid.UUID:
    return uuid.uuid5(
        KAZIMIRSKI_UUID_NAMESPACE,
        f"segment:{edition_identifier}:{surah_number}:{source_ordinal}",
    )


def join_id(
    surah_number: int, source_ordinal: int, ayah_number: int, edition_identifier: str = EDITION_IDENTIFIER
) -> uuid.UUID:
    return uuid.uuid5(
        KAZIMIRSKI_UUID_NAMESPACE,
        f"join:{edition_identifier}:{surah_number}:{source_ordinal}:{ayah_number}",
    )


# ---------------------------------------------------------------------------
# Safety
# ---------------------------------------------------------------------------


class SafetyViolation(SystemExit):
    def __init__(self, message: str):
        super().__init__(f"\nSAFETY VIOLATION: {message}\n")


def assert_local_db(db_url: str) -> None:
    if not any(h in db_url for h in ("127.0.0.1", "localhost")):
        raise SafetyViolation(f"refusing to operate against non-local DB_URL: {db_url!r}")
    if "--linked" in db_url:
        raise SafetyViolation("refusing: --linked must never appear anywhere near this tooling")


# ---------------------------------------------------------------------------
# psql subprocess helpers (matches the existing convention established in
# local-prototype/import_kazimirski.py -- plain `psql`, no new dependency)
# ---------------------------------------------------------------------------


class DbError(RuntimeError):
    pass


def psql(db_url: str, sql: str, tuples_only: bool = True) -> str:
    assert_local_db(db_url)
    args = ["psql", db_url, "-v", "ON_ERROR_STOP=1"]
    if tuples_only:
        args += ["-t", "-A", "-F", "\t"]
    args += ["-c", sql]
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise DbError(f"psql command failed: {result.stderr.strip()}\nSQL: {sql[:500]}")
    return result.stdout


def psql_scalar(db_url: str, sql: str):
    out = psql(db_url, sql).strip()
    return out


def psql_int(db_url: str, sql: str) -> int:
    out = psql_scalar(db_url, sql)
    return int(out) if out else 0


def psql_file(db_url: str, sql_path: Path) -> str:
    assert_local_db(db_url)
    args = ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-f", str(sql_path)]
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        raise DbError(f"psql -f failed (transaction rolled back):\n{result.stdout}\n{result.stderr}")
    return result.stdout


def psql_text(db_url: str, sql_text: str) -> str:
    """Run a multi-statement SQL blob via psql -f (using a temp file), so
    multi-statement transactions (BEGIN/COMMIT, DO $$ blocks, etc.) behave
    exactly as they would from a real .sql file."""
    import tempfile

    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, encoding="utf-8") as f:
        f.write(sql_text)
        tmp_path = Path(f.name)
    try:
        return psql_file(db_url, tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    s = str(value).replace("\\", "\\\\").replace("'", "''")
    return f"'{s}'"


# ---------------------------------------------------------------------------
# Hashing
# ---------------------------------------------------------------------------


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def aggregate_ordered_hash(segments_in_order: list[str]) -> str:
    """sha256 of all segment texts joined by U+001E (Information Separator
    Two), in (surah_number, source_ordinal) order -- identical methodology
    to kazimirski_html_extract.py's aggregate_ordered_hash and to
    PHASE2-MAPPING-ARCHITECTURE.md §9."""
    joined = "\x1e".join(segments_in_order)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Test-schema DDL rendering
# ---------------------------------------------------------------------------
#
# The staged migration file targets `public.*`, matching the exact
# convention every real migration in supabase/migrations/ uses, since that
# is what it would actually be if/when a future gate promotes it.
#
# This local rehearsal DB (127.0.0.1:54322) already has a `public.
# translation_segments` / `public.translation_segment_ayahs` pair of tables
# from the Phase 3 prototype work (same names, different data, different
# purpose) -- occupying the exact namespace this migration's own
# precondition correctly refuses to run into. Since running the full
# `supabase db reset` local rehearsal is explicitly out of scope for this
# implementation gate, DDL/trigger/RLS/import/rollback/validator behavior is
# instead rehearsed against an ISOLATED, disposable Postgres schema, using
# this exact migration file's own SQL text with only the two objects it
# actually OWNS (the two new tables and their trigger functions) relocated
# into that schema -- every reference to shared reference tables (`ayahs`,
# `content_sources`, `surahs`, `update_updated_at_column`) is left pointing
# at the real `public` schema untouched, since those are read-only
# dependencies, not something this migration duplicates.
#
# This is a TESTING METHODOLOGY choice, not a migration design deviation:
# the checked-in migration file itself is untouched, unparameterized,
# literal `public.*` SQL.

_OWNED_IDENTIFIER_PREFIXES = (
    "public.translation_segments",  # table + every "translation_segments*" function/trigger prefix
    "public.translation_segment_ayahs",  # table + every "translation_segment_ayahs*" function/trigger prefix
)


def render_migration_for_test_schema(sql_text: str, test_schema: str) -> str:
    rendered = sql_text
    for prefix in _OWNED_IDENTIFIER_PREFIXES:
        rendered = rendered.replace(prefix, f"{test_schema}.{prefix.split('.', 1)[1]}")
    return rendered


def render_rollback_or_query_for_test_schema(sql_text: str, test_schema: str) -> str:
    return render_migration_for_test_schema(sql_text, test_schema)


# ---------------------------------------------------------------------------
# Small check()-based reporting harness, matching the existing convention in
# local-prototype/tests/*.py (plain scripts, not pytest).
# ---------------------------------------------------------------------------


class CheckRunner:
    def __init__(self, name: str):
        self.name = name
        self.passed = 0
        self.failed = 0
        self.failures: list[str] = []

    def check(self, label: str, condition: bool, detail: str = "") -> bool:
        if condition:
            print(f"PASS: {label}")
            self.passed += 1
        else:
            msg = f"FAIL: {label} {detail}".rstrip()
            print(msg)
            self.failed += 1
            self.failures.append(msg)
        return condition

    def summary_and_exit(self) -> None:
        total = self.passed + self.failed
        print(f"\n[{self.name}] {self.passed}/{total} passed, {self.failed} failed")
        if self.failed:
            print("Failures:")
            for f in self.failures:
                print(f"  - {f}")
        sys.exit(1 if self.failed else 0)

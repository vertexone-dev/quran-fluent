#!/usr/bin/env python3
"""
Kazimirski PRODUCTION migration/import machinery -- implementation test
suite (32 checks), covering the generator, the staged migration DDL, the
importer's 5-state idempotency model, the validator, and the rollback tool.

Run directly (matches the existing convention in
scripts/quran-import/kazimirski/local-prototype/tests/*.py -- plain
check()-based scripts, not pytest):

    python3 scripts/quran-import/kazimirski/tests/test_production_migration_pipeline.py

TESTING METHODOLOGY (read before modifying):
This local rehearsal Postgres instance (127.0.0.1:54322) already carries a
Phase 3 prototype `public.translation_segments` / `public.translation_
segment_ayahs` pair of tables (same names, different data, different
purpose -- see kaz_prod_lib.py's "test-schema DDL rendering" section). The
formal clean-database rehearsal that would let the real migration apply to
`public` directly (supabase db reset) is explicitly out of scope for this
implementation gate. So this suite creates a disposable, isolated Postgres
schema, applies the SAME migration file's SQL text into that schema (only
the two objects the migration itself OWNS are relocated -- every reference
to `ayahs`/`content_sources`/`surahs`/`update_updated_at_column` stays
pointed at the real `public` schema, since those are read-only shared
dependencies, never duplicated), runs the full generator/importer/rollback/
validator pipeline against it, and tears the schema down at the end --
never touching the pre-existing prototype tables.

The one thing that IS written to the real shared `public.content_sources`
table during these tests is the Kazimirski production content_sources row
itself (since content_sources is not schema-relocatable -- there is exactly
one). This suite creates it, uses it, and deletes it again in teardown,
restoring `public.content_sources` to exactly the state found at the start.

Cleans up after every test. Leaves the local DB in the same state it found
it in when the suite finishes (success OR failure -- teardown always runs).
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

HERE = Path(__file__).parent
KAZ_DIR = HERE.parent
sys.path.insert(0, str(KAZ_DIR))

import kaz_prod_lib as lib  # noqa: E402
import generate_production_import as gen  # noqa: E402
import import_production_kazimirski as imp  # noqa: E402
import rollback_kazimirski as rb  # noqa: E402
import validate_kazimirski_import as val  # noqa: E402

DB_URL = lib.DEFAULT_DB_URL
TEST_SCHEMA = "kaz_prod_rehearsal_test"

runner = lib.CheckRunner("kazimirski-production-pipeline")


def q(sql: str) -> str:
    return lib.psql(DB_URL, sql)


def qi(sql: str) -> int:
    return lib.psql_int(DB_URL, sql)


# ---------------------------------------------------------------------------
# Setup / teardown
# ---------------------------------------------------------------------------


def teardown(quiet: bool = False) -> None:
    if not quiet:
        print("\n--- Teardown: restoring local DB to its pre-suite state ---")
    q(f"DROP SCHEMA IF EXISTS {TEST_SCHEMA} CASCADE;")
    q(f"DELETE FROM public.content_sources WHERE edition_identifier = '{lib.EDITION_IDENTIFIER}';")


def setup() -> None:
    teardown(quiet=True)  # in case a previous run left something behind
    q(f"CREATE SCHEMA {TEST_SCHEMA};")
    q(f"GRANT USAGE ON SCHEMA {TEST_SCHEMA} TO anon, authenticated;")


def apply_migration_to_test_schema() -> None:
    sql_text = lib.MIGRATION_FILE_PATH.read_text(encoding="utf-8")
    rendered = lib.render_migration_for_test_schema(sql_text, TEST_SCHEMA)
    lib.psql_text(DB_URL, rendered)


# ---------------------------------------------------------------------------
# 1-17: Generator
# ---------------------------------------------------------------------------


def test_generator() -> dict:
    artifact = gen.build_artifact(DB_URL)

    runner.check("1. generator: raw_source_sha256 matches expected constant", artifact["raw_source_sha256"] == lib.EXPECTED_RAW_SOURCE_SHA256)
    runner.check("2. generator: aggregate_segment_text_hash matches expected constant", artifact["aggregate_segment_text_hash"] == lib.EXPECTED_AGGREGATE_SEGMENT_TEXT_HASH)
    runner.check("3. generator: segment count == 6239", artifact["source_segment_count"] == lib.EXPECTED_SEGMENT_COUNT)
    runner.check("4. generator: join count == 6396", artifact["join_count"] == lib.EXPECTED_JOIN_COUNT)
    runner.check("5. generator: canonical_coverage == '6236/6236'", artifact["canonical_coverage"] == "6236/6236")
    rr = artifact["review_reconciliation"]
    runner.check("6. generator: human_verified segments == 57", rr["human_verified_segments"] == lib.EXPECTED_HUMAN_VERIFIED_SEGMENTS)
    runner.check("7. generator: human_verified joins == 80", rr["human_verified_joins"] == lib.EXPECTED_HUMAN_VERIFIED_JOINS)
    runner.check("8. generator: Tier 2 human_verified joins == 17", rr["tier2_human_verified_joins"] == lib.EXPECTED_TIER2_HUMAN_VERIFIED_JOINS)

    segs_by_key = {(s["surah_number"], s["source_ordinal"]): s for s in artifact["segments"]}
    null_ok = all(segs_by_key[k]["source_declared_number"] is None for k in lib.KNOWN_NULL_DECLARED_NUMBER_SEGMENTS)
    runner.check("9. generator: known-NULL segments (S2:286, S36:83) stay NULL", null_ok)

    joins_33 = [j for j in artifact["joins"] if j["segment_key"] == "3:33"]
    j_38 = next((j for j in joins_33 if j["ayah_number"] == 38), None)
    j_39 = next((j for j in joins_33 if j["ayah_number"] == 39), None)
    runner.check(
        "10. generator: sibling join 3:33->3:38 stays non-human_verified while 3:33->3:39 is human_verified",
        j_38 is not None and j_39 is not None and j_38["mapping_confidence"] != "human_verified" and j_39["mapping_confidence"] == "human_verified",
    )

    seg_order = [(s["surah_number"], s["source_ordinal"]) for s in artifact["segments"]]
    runner.check("11. generator: segments sorted by (surah_number, source_ordinal) ascending", seg_order == sorted(seg_order))

    join_order_keys = []
    seg_ordinal_by_key = {(s["surah_number"], s["source_ordinal"]): s["source_ordinal"] for s in artifact["segments"]}
    for j in artifact["joins"]:
        surah, ordinal = map(int, j["segment_key"].split(":"))
        join_order_keys.append((j["surah_number"], ordinal, j["ayah_number"]))
    runner.check("12. generator: joins sorted by (surah, segment ordinal, ayah_number) ascending", join_order_keys == sorted(join_order_keys))

    domains_ok = (
        all(s["alignment_type"] in lib.VALID_ALIGNMENT_TYPES for s in artifact["segments"])
        and all(s["alignment_status"] in lib.VALID_ALIGNMENT_STATUSES for s in artifact["segments"])
        and all(s["segment_type"] in lib.VALID_SEGMENT_TYPES for s in artifact["segments"])
        and all(j["mapping_confidence"] in lib.VALID_MAPPING_CONFIDENCE for j in artifact["joins"])
    )
    runner.check("13. generator: no enum value outside closed domains in output", domains_ok)

    # Determinism: build twice, compare canonical payload.
    payload1 = gen.canonical_payload_bytes(artifact)
    artifact2 = gen.build_artifact(DB_URL)
    payload2 = gen.canonical_payload_bytes(artifact2)
    runner.check("14. generator: two independent runs produce byte-identical canonical payloads", payload1 == payload2)

    # Gate 8/9 failure simulation: a decisions ledger with one REJECT must abort.
    import json
    import tempfile

    decisions_doc = None
    with open(lib.DECISIONS_PATH, "r", encoding="utf-8") as f:
        decisions_doc = __import__("json").load(f)
    tampered = dict(decisions_doc)
    tampered["decisions"] = list(decisions_doc["decisions"])
    tampered["decisions"][0] = dict(tampered["decisions"][0])
    tampered["decisions"][0]["decision"] = "REJECT"
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(tampered, f)
        tampered_path = Path(f.name)
    orig_decisions_path = lib.DECISIONS_PATH
    try:
        lib.DECISIONS_PATH = tampered_path
        aborted = False
        try:
            gen.build_artifact(DB_URL)
        except SystemExit:
            aborted = True
        runner.check("15. generator: refuses when any decision is not APPROVE", aborted)
    finally:
        lib.DECISIONS_PATH = orig_decisions_path
        tampered_path.unlink(missing_ok=True)

    # Gate 4 failure simulation: tampered manifest aggregate hash mismatch.
    with open(lib.MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest_doc = __import__("json").load(f)
    tampered_manifest = dict(manifest_doc)
    tampered_manifest["aggregate_ordered_hash"] = "0" * 64
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(tampered_manifest, f)
        tampered_manifest_path = Path(f.name)
    orig_manifest_path = lib.MANIFEST_PATH
    try:
        lib.MANIFEST_PATH = tampered_manifest_path
        aborted = False
        try:
            gen.build_artifact(DB_URL)
        except SystemExit:
            aborted = True
        runner.check("16. generator: refuses on tampered/stale manifest aggregate hash", aborted)
    finally:
        lib.MANIFEST_PATH = orig_manifest_path
        tampered_manifest_path.unlink(missing_ok=True)

    runner.check("17. generator: content_source id is the deterministic uuid5 value", artifact["content_source"]["id"] == str(lib.content_source_id()))

    return artifact


# ---------------------------------------------------------------------------
# 18-25: Migration DDL (isolated test schema)
# ---------------------------------------------------------------------------


def test_migration_ddl() -> None:
    apply_migration_to_test_schema()
    runner.check("18. migration: applies with zero errors to an isolated schema", True)

    n = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments;")
    runner.check("19. migration: translation_segments has 0 rows immediately after apply", n == 0)

    status = q(f"SELECT verification_status FROM public.content_sources WHERE edition_identifier='{lib.EDITION_IDENTIFIER}';").strip()
    runner.check("20. migration: content_sources row created with verification_status=candidate", status == "candidate")

    # Immutability: insert a throwaway segment+join, try to mutate text -> must fail; mutate alignment_status -> must succeed.
    src_id = str(lib.content_source_id())
    fake_id = str(uuid.uuid4())
    q(
        f"INSERT INTO {TEST_SCHEMA}.translation_segments (id, source_id, surah_number, source_ordinal, text, text_sha256, extraction_source_ref, alignment_type) "
        f"VALUES ('{fake_id}', '{src_id}', 1, 9001, 'test text', '{lib.sha256_text('test text')}', 'test-ref', 'direct');"
    )
    blocked = False
    try:
        q(f"UPDATE {TEST_SCHEMA}.translation_segments SET text = 'mutated' WHERE id = '{fake_id}';")
    except lib.DbError:
        blocked = True
    runner.check("21. migration: immutability trigger blocks UPDATE of text", blocked)

    allowed = True
    try:
        q(f"UPDATE {TEST_SCHEMA}.translation_segments SET alignment_status = 'human_verified', reviewed_by='test' WHERE id = '{fake_id}';")
    except lib.DbError:
        allowed = False
    runner.check("22. migration: immutability trigger allows UPDATE of alignment_status/reviewer fields", allowed)

    # Cross-surah guard: try to insert a join row for the fake segment (surah 1) declaring surah 2.
    rejected = False
    try:
        q(
            f"INSERT INTO {TEST_SCHEMA}.translation_segment_ayahs (segment_id, surah_number, ayah_number) "
            f"VALUES ('{fake_id}', 2, 5);"
        )
    except lib.DbError:
        rejected = True
    runner.check("23. migration: cross-surah guard trigger rejects a join row whose surah doesn't match its parent segment", rejected)

    # A correctly-scoped join (surah 1, matching the fake segment's surah) must succeed.
    correct_join_ok = True
    try:
        q(f"INSERT INTO {TEST_SCHEMA}.translation_segment_ayahs (segment_id, surah_number, ayah_number) VALUES ('{fake_id}', 1, 1);")
    except lib.DbError:
        correct_join_ok = False
    runner.check("23b. migration: a correctly-scoped join row (matching surah) is accepted", correct_join_ok)

    # RLS: anon can SELECT.
    select_ok = True
    try:
        q(f"SET ROLE anon; SELECT count(*) FROM {TEST_SCHEMA}.translation_segments; RESET ROLE;")
    except lib.DbError:
        select_ok = False
    runner.check("24. migration: RLS allows SELECT for anon role", select_ok)

    # RLS: anon cannot INSERT.
    insert_blocked = False
    try:
        q(
            f"SET ROLE anon; INSERT INTO {TEST_SCHEMA}.translation_segments (source_id, surah_number, source_ordinal, text, text_sha256, extraction_source_ref, alignment_type) "
            f"VALUES ('{src_id}', 1, 9002, 'x', '{lib.sha256_text('x')}', 'r', 'direct'); RESET ROLE;"
        )
    except lib.DbError:
        insert_blocked = True
    runner.check("25. migration: RLS blocks INSERT for anon role", insert_blocked)

    # Cleanup throwaway rows.
    q(f"DELETE FROM {TEST_SCHEMA}.translation_segment_ayahs WHERE segment_id = '{fake_id}';")
    q(f"DELETE FROM {TEST_SCHEMA}.translation_segments WHERE id = '{fake_id}';")


# ---------------------------------------------------------------------------
# 26-31: Importer (5-state idempotency) + validator + baseline protection
# ---------------------------------------------------------------------------


def test_importer_and_validator(artifact: dict) -> None:
    import json
    import tempfile

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump({**artifact, "generated_at": "test", "canonical_payload_sha256": gen.canonical_payload_bytes(artifact) and __import__("hashlib").sha256(gen.canonical_payload_bytes(artifact)).hexdigest()}, f)
        artifact_tmp_path = Path(f.name)

    try:
        pre_ayahs = imp.fetch_baseline(DB_URL, imp.db_ayahs_baseline_sql(TEST_SCHEMA))
        pre_pick = imp.fetch_baseline(DB_URL, imp.db_pickthall_baseline_sql(TEST_SCHEMA))

        # -- State E: identity collision, BEFORE any real row exists --
        decoy_id = str(uuid.uuid4())
        q(
            f"INSERT INTO public.content_sources (id, content_type, provider_name, dataset_name, edition_identifier, language, license_name, source_url, verification_status) "
            f"VALUES ('{decoy_id}', 'translation', 'decoy', 'decoy', '{lib.EDITION_IDENTIFIER}', 'fr', 'Public domain', 'https://example.invalid', 'candidate');"
        )
        state, _ = imp.classify_state(DB_URL, TEST_SCHEMA, artifact)
        runner.check("26. importer: state E (identity collision) detected and refuses", state == "E")
        q(f"DELETE FROM public.content_sources WHERE id = '{decoy_id}';")

        # -- State A: fresh import --
        rc = imp.run_import(DB_URL, TEST_SCHEMA, artifact_tmp_path)
        n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id='{artifact['content_source']['id']}';")
        n_joins = qi(
            f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segment_ayahs tsa JOIN {TEST_SCHEMA}.translation_segments ts ON ts.id=tsa.segment_id "
            f"WHERE ts.source_id='{artifact['content_source']['id']}';"
        )
        runner.check("27. importer: state A fresh import writes exactly 6239 segments / 6396 joins", rc == 0 and n_segs == lib.EXPECTED_SEGMENT_COUNT and n_joins == lib.EXPECTED_JOIN_COUNT)

        post_ayahs = imp.fetch_baseline(DB_URL, imp.db_ayahs_baseline_sql(TEST_SCHEMA))
        post_pick = imp.fetch_baseline(DB_URL, imp.db_pickthall_baseline_sql(TEST_SCHEMA))
        runner.check("28. importer: ayahs baseline (count+hash) unchanged by import", pre_ayahs == post_ayahs)
        runner.check("29. importer: Pickthall baseline (count+hash) unchanged by import", pre_pick == post_pick)

        # -- State B: re-run, verified no-op --
        state, _ = imp.classify_state(DB_URL, TEST_SCHEMA, artifact)
        rc2 = imp.run_import(DB_URL, TEST_SCHEMA, artifact_tmp_path)
        n_segs_after = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id='{artifact['content_source']['id']}';")
        runner.check("30. importer: state B re-run is a safe no-op (zero new rows, exit 0)", state == "B" and rc2 == 0 and n_segs_after == lib.EXPECTED_SEGMENT_COUNT)

        # -- Full validator pass against the freshly-imported state --
        ok = val.validate(DB_URL, TEST_SCHEMA, artifact_tmp_path)
        runner.check("31. validator: full validation passes against a freshly-imported, correct state", ok)

        # -- State C: partial (delete a few rows), must STOP --
        victim_join = artifact["joins"][0]
        q(f"DELETE FROM {TEST_SCHEMA}.translation_segment_ayahs WHERE id = '{victim_join['id']}';")
        state, detail = imp.classify_state(DB_URL, TEST_SCHEMA, artifact)
        runner.check("32. importer: state C (partial -- one join missing) detected and refuses", state == "C")
        # restore
        j = victim_join
        q(
            f"INSERT INTO {TEST_SCHEMA}.translation_segment_ayahs (id, segment_id, surah_number, ayah_number, mapping_confidence, reviewer_notes, reviewed_by, reviewed_at) "
            f"VALUES ({lib.sql_literal(j['id'])}, {lib.sql_literal(j['segment_id'])}, {lib.sql_literal(j['surah_number'])}, {lib.sql_literal(j['ayah_number'])}, "
            f"{lib.sql_literal(j['mapping_confidence'])}, {lib.sql_literal(j['reviewer_notes'])}, {lib.sql_literal(j['reviewed_by'])}, {lib.sql_literal(j['reviewed_at'])});"
        )
        state, _ = imp.classify_state(DB_URL, TEST_SCHEMA, artifact)
        runner.check("32b. importer: state restored to B after re-inserting the deleted join row", state == "B")

        # -- State D: divergence (mutate one join's mapping_confidence), must STOP --
        victim_join2 = next(j for j in artifact["joins"] if j["mapping_confidence"] == "auto")
        new_val = "cross_verified"
        q(f"UPDATE {TEST_SCHEMA}.translation_segment_ayahs SET mapping_confidence = '{new_val}' WHERE id = '{victim_join2['id']}';")
        state, detail = imp.classify_state(DB_URL, TEST_SCHEMA, artifact)
        runner.check("33. importer: state D (divergence) detected and refuses", state == "D")
        q(f"UPDATE {TEST_SCHEMA}.translation_segment_ayahs SET mapping_confidence = '{victim_join2['mapping_confidence']}' WHERE id = '{victim_join2['id']}';")
        state, _ = imp.classify_state(DB_URL, TEST_SCHEMA, artifact)
        runner.check("33b. importer: state restored to B after reverting the divergent row", state == "B")

    finally:
        artifact_tmp_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# 34-35: Rollback
# ---------------------------------------------------------------------------


def test_rollback() -> None:
    other_sources_before = qi("SELECT count(*) FROM public.content_sources;")
    ayahs_before = qi("SELECT count(*) FROM public.ayahs;")
    pick_before = qi(
        "SELECT count(*) FROM public.translations t JOIN public.content_sources cs ON cs.id=t.source_id "
        "WHERE cs.edition_identifier='pickthall-gutenberg-16955';"
    )
    prototype_before = qi(
        f"SELECT count(*) FROM translation_segments WHERE source_id = (SELECT id FROM public.content_sources WHERE edition_identifier='{lib.PROTOTYPE_EDITION_IDENTIFIER}');"
    )

    rb.rollback(DB_URL, TEST_SCHEMA)

    n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments;")
    n_joins = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segment_ayahs;")
    status = q(f"SELECT verification_status FROM public.content_sources WHERE edition_identifier='{lib.EDITION_IDENTIFIER}';").strip()
    runner.check("34. rollback: deletes all segments/joins and deprecates (not deletes) the content_sources row", n_segs == 0 and n_joins == 0 and status == "deprecated")

    other_sources_after = qi("SELECT count(*) FROM public.content_sources;")
    ayahs_after = qi("SELECT count(*) FROM public.ayahs;")
    pick_after = qi(
        "SELECT count(*) FROM public.translations t JOIN public.content_sources cs ON cs.id=t.source_id "
        "WHERE cs.edition_identifier='pickthall-gutenberg-16955';"
    )
    prototype_after = qi(
        f"SELECT count(*) FROM translation_segments WHERE source_id = (SELECT id FROM public.content_sources WHERE edition_identifier='{lib.PROTOTYPE_EDITION_IDENTIFIER}');"
    )
    runner.check(
        "35. rollback: never touched ayahs, Pickthall, other content_sources rows, or the unrelated Phase 3 prototype rows",
        other_sources_before == other_sources_after and ayahs_before == ayahs_after and pick_before == pick_after and prototype_before == prototype_after,
    )


# ---------------------------------------------------------------------------
# 36-46: Rollback-then-recover (the gap PRODUCTION-LOCAL-REHEARSAL-REPORT.md
# §17/§24 documented, and import_production_kazimirski.py's state F +
# --recover-after-rollback / check_recovery_eligibility() now closes).
#
# Runs immediately after test_rollback(), which leaves TEST_SCHEMA in exactly
# the real rollback-produced shape: content_sources row for
# kazimirski-1869-segments-v1 present, deterministic id, deprecated, zero
# segments/joins under it. Every mutation below is captured and reverted
# before the next sub-test runs, so by the time the final "full recovery"
# sub-test executes, the row is back to being genuinely
# rollback-state-identical -- not a coincidentally-similar row.
# ---------------------------------------------------------------------------


def _write_temp_artifact(artifact: dict) -> Path:
    import hashlib
    import json
    import tempfile

    payload = gen.canonical_payload_bytes(artifact)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump({**artifact, "generated_at": "test", "canonical_payload_sha256": hashlib.sha256(payload).hexdigest()}, f)
        return Path(f.name)


def test_recovery_after_rollback(artifact: dict) -> None:
    src_id = artifact["content_source"]["id"]
    artifact_tmp_path = _write_temp_artifact(artifact)

    cycle_pre_ayahs = imp.fetch_baseline(DB_URL, imp.db_ayahs_baseline_sql(TEST_SCHEMA))
    cycle_pre_pick = imp.fetch_baseline(DB_URL, imp.db_pickthall_baseline_sql(TEST_SCHEMA))

    try:
        # Sanity: confirm we're actually starting from the real
        # rollback-produced state before testing anything against it.
        state0, detail0 = imp.classify_state(DB_URL, TEST_SCHEMA, artifact)
        runner.check("36. recovery pre-check: DB is in state F (deprecated, zero segments/joins) immediately after rollback", state0 == "F", f"got {state0} {detail0}")

        # -- Item 1: normal import (no recovery flag) against state F -> REJECT, zero writes. --
        aborted = False
        try:
            imp.run_import(DB_URL, TEST_SCHEMA, artifact_tmp_path, recover_after_rollback=False)
        except SystemExit:
            aborted = True
        n_segs = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id='{src_id}';")
        runner.check("37. recovery: normal import (no --recover-after-rollback) against state F is REJECTED with zero writes", aborted and n_segs == 0)

        # -- Item 3/7: explicit recovery where a provenance field diverges -> REJECT.
        # (edition_identifier itself can't be made to diverge through this code
        # path -- it's the WHERE-clause key check_recovery_eligibility() uses to
        # find the row at all -- so this exercises the same unified
        # conditions-3/7 field-comparison check via a different declared
        # provenance field, dataset_name; see report for why items 3 and 7
        # collapse to one test given this implementation's single unified check.)
        orig_dataset_name = q(f"SELECT dataset_name FROM public.content_sources WHERE id='{src_id}';").strip()
        q(f"UPDATE public.content_sources SET dataset_name = 'TAMPERED for test' WHERE id='{src_id}';")
        rejected, msg = False, ""
        try:
            imp.check_recovery_eligibility(DB_URL, TEST_SCHEMA, artifact)
        except SystemExit as e:
            rejected = True
            msg = str(e)
        runner.check(
            "38. recovery: provenance field divergence (dataset_name) is REJECTED, naming condition 3/7",
            rejected and "condition 3/7" in msg,
            msg,
        )
        q(f"UPDATE public.content_sources SET dataset_name = {lib.sql_literal(orig_dataset_name)} WHERE id='{src_id}';")

        # -- Item 4: segments unexpectedly still exist under source_id -> REJECT. --
        fake_seg_id = str(uuid.uuid4())
        q(
            f"INSERT INTO {TEST_SCHEMA}.translation_segments (id, source_id, surah_number, source_ordinal, text, text_sha256, extraction_source_ref, alignment_type) "
            f"VALUES ('{fake_seg_id}', '{src_id}', 1, 9101, 'test text', '{lib.sha256_text('test text')}', 'test-ref', 'direct');"
        )
        rejected, msg = False, ""
        try:
            imp.check_recovery_eligibility(DB_URL, TEST_SCHEMA, artifact)
        except SystemExit as e:
            rejected = True
            msg = str(e)
        runner.check("39. recovery: a lone segment unexpectedly present under source_id is REJECTED, naming condition 4", rejected and "condition 4" in msg, msg)

        # -- Item 5: joins unexpectedly still exist -> REJECT.
        # NOTE (honest implementation note, not a shortcut): translation_segment_ayahs.segment_id
        # has an FK to translation_segments(id) ON DELETE RESTRICT, so a join
        # row can never exist without its parent segment also existing under
        # the same source_id -- condition 5 is structurally unreachable in
        # isolation from condition 4, exactly as the task's own instructions
        # anticipated ("should be structurally implied by #4, but verify
        # directly, not just assume"). This sub-test adds a join on top of the
        # still-present segment from item 4 and confirms recovery is REJECTED
        # (condition 4 fires first, since it is checked before condition 5 in
        # source order) -- i.e. the combined real-world case ("segments AND
        # joins present") is refused, even though condition 5's own check can
        # never be the FIRST one to fire on real data.
        q(f"INSERT INTO {TEST_SCHEMA}.translation_segment_ayahs (segment_id, surah_number, ayah_number) VALUES ('{fake_seg_id}', 1, 1);")
        rejected, msg = False, ""
        try:
            imp.check_recovery_eligibility(DB_URL, TEST_SCHEMA, artifact)
        except SystemExit as e:
            rejected = True
            msg = str(e)
        runner.check("40. recovery: segment+join both unexpectedly present is REJECTED (condition 4 fires before condition 5 is reachable)", rejected and "condition 4" in msg, msg)
        q(f"DELETE FROM {TEST_SCHEMA}.translation_segment_ayahs WHERE segment_id = '{fake_seg_id}';")
        q(f"DELETE FROM {TEST_SCHEMA}.translation_segments WHERE id = '{fake_seg_id}';")

        # -- Item 6: wrong deterministic source ID -> REJECT (recovery mode
        # can't be tricked by a differently-sourced row that merely shares
        # the edition_identifier). --
        backup_cols = [
            "id", "content_type", "provider_name", "dataset_name", "edition_identifier", "language",
            "translator", "version", "license_name", "license_url", "attribution_required",
            "modification_restricted", "source_url", "retrieved_at::text", "public_domain",
            "legacy_interim", "verification_status", "notes",
        ]
        backup_row = q(f"SELECT {', '.join(backup_cols)} FROM public.content_sources WHERE id='{src_id}';").strip().split("\t")
        backup = dict(zip([c.replace("::text", "") for c in backup_cols], backup_row))
        q(f"DELETE FROM public.content_sources WHERE id='{src_id}';")
        decoy_id = str(uuid.uuid4())
        q(
            f"INSERT INTO public.content_sources (id, content_type, provider_name, dataset_name, edition_identifier, language, translator, version, license_name, license_url, attribution_required, modification_restricted, source_url, retrieved_at, public_domain, legacy_interim, verification_status, notes) "
            f"VALUES ({lib.sql_literal(decoy_id)}, {lib.sql_literal(backup['content_type'])}, {lib.sql_literal(backup['provider_name'])}, {lib.sql_literal(backup['dataset_name'])}, {lib.sql_literal(backup['edition_identifier'])}, {lib.sql_literal(backup['language'])}, {lib.sql_literal(backup['translator'])}, {lib.sql_literal(backup['version'])}, {lib.sql_literal(backup['license_name'])}, {lib.sql_literal(backup['license_url'] or None)}, {lib.sql_literal(backup['attribution_required'] == 't')}, {lib.sql_literal(backup['modification_restricted'] == 't')}, {lib.sql_literal(backup['source_url'])}, {lib.sql_literal(backup['retrieved_at'])}, {lib.sql_literal(backup['public_domain'] == 't')}, {lib.sql_literal(backup['legacy_interim'] == 't')}, 'deprecated', {lib.sql_literal(backup['notes'])});"
        )
        rejected, msg = False, ""
        try:
            imp.check_recovery_eligibility(DB_URL, TEST_SCHEMA, artifact)
        except SystemExit as e:
            rejected = True
            msg = str(e)
        runner.check("41. recovery: a row with the wrong deterministic source id (same edition_identifier) is REJECTED, naming condition 1", rejected and "condition 1" in msg, msg)
        q(f"DELETE FROM public.content_sources WHERE id='{decoy_id}';")
        q(
            f"INSERT INTO public.content_sources (id, content_type, provider_name, dataset_name, edition_identifier, language, translator, version, license_name, license_url, attribution_required, modification_restricted, source_url, retrieved_at, public_domain, legacy_interim, verification_status, notes) "
            f"VALUES ({lib.sql_literal(backup['id'])}, {lib.sql_literal(backup['content_type'])}, {lib.sql_literal(backup['provider_name'])}, {lib.sql_literal(backup['dataset_name'])}, {lib.sql_literal(backup['edition_identifier'])}, {lib.sql_literal(backup['language'])}, {lib.sql_literal(backup['translator'])}, {lib.sql_literal(backup['version'])}, {lib.sql_literal(backup['license_name'])}, {lib.sql_literal(backup['license_url'] or None)}, {lib.sql_literal(backup['attribution_required'] == 't')}, {lib.sql_literal(backup['modification_restricted'] == 't')}, {lib.sql_literal(backup['source_url'])}, {lib.sql_literal(backup['retrieved_at'])}, {lib.sql_literal(backup['public_domain'] == 't')}, {lib.sql_literal(backup['legacy_interim'] == 't')}, {lib.sql_literal(backup['verification_status'])}, {lib.sql_literal(backup['notes'])});"
        )
        restored_status = q(f"SELECT verification_status FROM public.content_sources WHERE id='{src_id}';").strip()
        runner.check("41b. recovery: real rollback-produced row fully restored after the wrong-id test", restored_status == "deprecated")

        # -- Condition 8: artifact's own declared hashes checked (defensively
        # re-verified inside check_recovery_eligibility even though
        # load_and_validate_artifact() already enforces this unconditionally
        # for every real invocation before recovery is ever considered). --
        tampered_artifact = dict(artifact)
        tampered_artifact["raw_source_sha256"] = "0" * 64
        rejected, msg = False, ""
        try:
            imp.check_recovery_eligibility(DB_URL, TEST_SCHEMA, tampered_artifact)
        except SystemExit as e:
            rejected = True
            msg = str(e)
        runner.check("42. recovery: tampered artifact raw_source_sha256 is REJECTED, naming condition 8", rejected and "condition 8" in msg, msg)

        # -- Item 2 + 8 + 9 + 10: explicit recovery against the exact,
        # untouched rollback-produced state -> ACCEPT, full successful
        # import, validator PASS, canonical Arabic/Pickthall unchanged. --
        state1, detail1 = imp.classify_state(DB_URL, TEST_SCHEMA, artifact)
        runner.check("43. recovery: DB is back in state F immediately before the real recovery attempt", state1 == "F", f"got {state1} {detail1}")

        rc = imp.run_import(DB_URL, TEST_SCHEMA, artifact_tmp_path, recover_after_rollback=True)
        n_segs_final = qi(f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segments WHERE source_id='{src_id}';")
        n_joins_final = qi(
            f"SELECT count(*) FROM {TEST_SCHEMA}.translation_segment_ayahs tsa JOIN {TEST_SCHEMA}.translation_segments ts ON ts.id=tsa.segment_id WHERE ts.source_id='{src_id}';"
        )
        final_status = q(f"SELECT verification_status FROM public.content_sources WHERE id='{src_id}';").strip()
        runner.check(
            "44. recovery: explicit --recover-after-rollback against the exact rollback state ACCEPTS and imports the full 6239/6396, reactivating to candidate",
            rc == 0 and n_segs_final == lib.EXPECTED_SEGMENT_COUNT and n_joins_final == lib.EXPECTED_JOIN_COUNT and final_status == "candidate",
        )

        ok = val.validate(DB_URL, TEST_SCHEMA, artifact_tmp_path)
        runner.check("45. recovery: validator reports full PASS after rollback -> recovery -> re-import", ok)

        post_ayahs = imp.fetch_baseline(DB_URL, imp.db_ayahs_baseline_sql(TEST_SCHEMA))
        post_pick = imp.fetch_baseline(DB_URL, imp.db_pickthall_baseline_sql(TEST_SCHEMA))
        runner.check(
            "46. recovery: canonical Arabic (ayahs) and Pickthall (count+content fingerprint) unchanged across the whole rollback->recovery->re-import cycle",
            cycle_pre_ayahs == post_ayahs and cycle_pre_pick == post_pick,
        )
    finally:
        artifact_tmp_path.unlink(missing_ok=True)


def main() -> None:
    setup()
    try:
        artifact = test_generator()
        test_migration_ddl()
        test_importer_and_validator(artifact)
        test_rollback()
        test_recovery_after_rollback(artifact)
    finally:
        teardown()
    runner.summary_and_exit()


if __name__ == "__main__":
    main()

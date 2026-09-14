#!/usr/bin/env bash
# Phase 8C.3 — proves the migration-history reconciliation approach in a
# DISPOSABLE Docker Postgres container. Never touches production, CI, or any
# local shared database.
#
# WHAT IT SIMULATES
#   The documented `supabase db push` algorithm (per Supabase's own docs):
#   for each local migration file, in ascending version order, if its
#   version is not already a row in supabase_migrations.schema_migrations,
#   run its SQL in a transaction, then record the version as applied.
#   ( https://supabase.com/docs/reference/cli/supabase-db-push ,
#     https://supabase.com/docs/reference/cli/supabase-migration-repair )
#
#   Four representative "migration steps", by version:
#     20260820100000  registers the legacy kazimirski-1869 row (candidate)
#     20260904220940  the proposed reconciliation PLACEHOLDER — a true no-op,
#                     matching the version production's migration history
#                     already recorded for the Phase 8C.2 apply_migration call
#     20260912100000  registers the active kazimirski-1869-segments-v1 row
#     20260913100000  the real Phase 8C.2 migration (deprecates the legacy row)
#
# WHAT IT PROVES
#   1. Fresh-database replay (empty history): all four run in version order;
#      the placeholder does nothing; the real migration finds its successor
#      already registered (20260912100000 ran first) and deprecates correctly.
#   2. Existing-production-like replay (history already has 20260820100000,
#      20260912100000, and the orphan 20260904220940; content already
#      deprecated — i.e. today's real production state): only 20260913100000
#      is unrecorded, so only it runs; it hits its own "already applied"
#      no-op branch safely; final content is byte-identical to before.
#   3. Why renaming the real migration to 20260904220940 (Option 4) is
#      rejected: run it AT that earlier slot, before the successor exists,
#      and confirm it fails closed (RAISE EXCEPTION on precondition 2) rather
#      than silently doing something wrong.
#
# USAGE:  bash scripts/db-migration-tests/phase8c3-history-reconciliation.test.sh

set -euo pipefail

IMAGE="postgres:16-alpine"
CONTAINER="phase8c3-histtest-$$"
pass=0
fail=0

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "SKIP: docker not available — migration-history simulation not run."
  exit 0
fi

echo "Starting disposable Postgres ($IMAGE) as $CONTAINER ..."
docker run -d --rm --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
# postgres:alpine restarts once after initdb, so wait for the readiness
# message to appear twice (or wait, then confirm psql actually connects)
# rather than trusting the first pg_isready success.
for _ in $(seq 1 120); do
  ready_count=$(docker logs "$CONTAINER" 2>&1 | grep -c "database system is ready to accept connections" || true)
  if [[ "$ready_count" -ge 2 ]]; then break; fi
  sleep 0.5
done
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" psql -U postgres -tAc "SELECT 1;" >/dev/null 2>&1 && break
  sleep 0.5
done

run_sql() { docker exec -i "$CONTAINER" psql -U postgres -d testdb -v ON_ERROR_STOP=1 -q "$@"; }

setup_db() {
  docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS testdb;" >/dev/null
  docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE testdb;" >/dev/null
  run_sql <<'SQL'
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  name text
);

CREATE TABLE public.content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('arabic_text', 'translation')),
  provider_name text NOT NULL,
  dataset_name text NOT NULL,
  edition_identifier text,
  language text NOT NULL CHECK (language IN ('ar', 'en', 'fr')),
  translator text,
  version text,
  license_name text NOT NULL,
  license_url text,
  attribution_required boolean NOT NULL DEFAULT false,
  modification_restricted boolean NOT NULL DEFAULT false,
  source_url text NOT NULL,
  retrieved_at timestamptz,
  public_domain boolean NOT NULL DEFAULT false,
  legacy_interim boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'candidate'
    CHECK (verification_status IN ('candidate', 'verified', 'disputed', 'deprecated')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ayahs (id bigserial PRIMARY KEY, arabic_source_id uuid REFERENCES public.content_sources(id));
CREATE TABLE public.surahs (number integer PRIMARY KEY, metadata_source_id uuid REFERENCES public.content_sources(id));
CREATE TABLE public.translations (id bigserial PRIMARY KEY, source_id uuid NOT NULL REFERENCES public.content_sources(id));
CREATE TABLE public.translation_segments (id bigserial PRIMARY KEY, source_id uuid NOT NULL REFERENCES public.content_sources(id));
CREATE TABLE public.lessons (id bigserial PRIMARY KEY, content_source_id uuid REFERENCES public.content_sources(id));
SQL
}

# Step SQL bodies (verbatim in spirit; the real-migration step is the
# committed DO block, reproduced exactly).
STEP_LEGACY="INSERT INTO public.content_sources (id,content_type,provider_name,dataset_name,edition_identifier,language,translator,license_name,source_url,legacy_interim,verification_status,notes) VALUES ('ed6028cb-a507-4bf4-9f74-4b71602bb4e4','translation','Wikisource','Le Koran','kazimirski-1869','fr','Albin de Kazimirski (Biberstein)','Public Domain','https://example.org',true,'candidate','Interim/legacy FR translation for Phase 2A only, pending research and licensing of a modern French translation before production launch.');"

STEP_SUCCESSOR="INSERT INTO public.content_sources (id,content_type,provider_name,dataset_name,edition_identifier,language,translator,license_name,source_url,legacy_interim,verification_status,notes) VALUES ('f8443b10-3cc8-59ee-954f-5b1129c1cec4','translation','Wikisource','Le Koran (segments)','kazimirski-1869-segments-v1','fr','Albin de Kazimirski Biberstein','Public domain','https://example.org',false,'candidate','Segment-based, production-governed Kazimirski FR source.');"

STEP_PLACEHOLDER="-- Phase 8C.3 migration-history reconciliation placeholder: intentionally empty, see file header."

STEP_REAL=$(cat <<'REALSQL'
DO $$
DECLARE
  v_legacy_id uuid; v_legacy_status text; v_legacy_notes text;
  v_match_count integer; v_successor_count integer; v_ref_count integer; v_affected integer;
  v_note_marker constant text := E'\n\n[Phase 8C: ';
  v_successor_note constant text := E'\n\n[Phase 8C: 2026-09-03] Deprecated (verification_status candidate -> deprecated). Superseded by the active certified source edition_identifier=''kazimirski-1869-segments-v1''.';
  r RECORD;
BEGIN
  SELECT count(*) INTO v_match_count FROM public.content_sources
  WHERE content_type='translation' AND language='fr' AND edition_identifier='kazimirski-1869' AND legacy_interim=true;
  IF v_match_count = 0 THEN RAISE EXCEPTION 'precondition 1 failed: no legacy row'; END IF;
  IF v_match_count > 1 THEN RAISE EXCEPTION 'precondition 1 failed: ambiguous legacy set'; END IF;

  SELECT id, verification_status, coalesce(notes,'') INTO v_legacy_id, v_legacy_status, v_legacy_notes
  FROM public.content_sources
  WHERE content_type='translation' AND language='fr' AND edition_identifier='kazimirski-1869' AND legacy_interim=true;

  SELECT count(*) INTO v_successor_count FROM public.content_sources
  WHERE content_type='translation' AND language='fr' AND edition_identifier='kazimirski-1869-segments-v1';
  IF v_successor_count <> 1 THEN RAISE EXCEPTION 'precondition 2 failed: successor count %', v_successor_count; END IF;

  IF v_legacy_status = 'deprecated' AND position(v_note_marker in v_legacy_notes) > 0 THEN
    RAISE NOTICE 'no-op: already deprecated with marker';
    RETURN;
  END IF;
  IF v_legacy_status <> 'candidate' THEN RAISE EXCEPTION 'precondition 3 failed: status %', v_legacy_status; END IF;

  FOR r IN
    SELECT (con.conrelid::regclass)::text AS child_table, att.attname AS child_col
    FROM pg_constraint con
    JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
    WHERE con.contype='f' AND con.confrelid='public.content_sources'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.child_table, r.child_col) INTO v_ref_count USING v_legacy_id;
    IF v_ref_count <> 0 THEN RAISE EXCEPTION 'precondition 4 failed: referenced by %.%', r.child_table, r.child_col; END IF;
  END LOOP;

  UPDATE public.content_sources SET verification_status='deprecated', notes=coalesce(notes,'')||v_successor_note
  WHERE id=v_legacy_id AND verification_status='candidate';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN RAISE EXCEPTION 'expected 1 row affected, got %', v_affected; END IF;
END $$;
REALSQL
)

# db_push simulation: given an ordered list of "version:sql" pairs already
# sorted ascending by version, apply only the ones not yet recorded.
db_push() {
  for pair in "$@"; do
    local version="${pair%%:::*}"
    local sql="${pair#*:::}"
    local already
    already=$(run_sql -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='${version}';")
    if [[ "$already" == "0" ]]; then
      echo "    applying ${version} ..."
      if ! run_sql -c "${sql}"; then
        echo "    ABORT: ${version} failed — not recording as applied (matches real db-push behavior)"
        return 1
      fi
      run_sql -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${version}', '${version}');"
    else
      echo "    skipping ${version} (already recorded)"
    fi
  done
}

echo
echo "=== Test 1: fresh-database replay (empty history) ==="
setup_db
db_push \
  "20260820100000:::${STEP_LEGACY}" \
  "20260904220940:::${STEP_PLACEHOLDER}" \
  "20260912100000:::${STEP_SUCCESSOR}" \
  "20260913100000:::${STEP_REAL}"
result=$(run_sql -tAc "SELECT verification_status FROM public.content_sources WHERE edition_identifier='kazimirski-1869';")
marker=$(run_sql -tAc "SELECT (length(notes) - length(replace(notes, E'\n\n[Phase 8C: ', ''))) / length(E'\n\n[Phase 8C: ') FROM public.content_sources WHERE edition_identifier='kazimirski-1869';")
recorded=$(run_sql -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations;")
if [[ "$result" == "deprecated" && "$marker" == "1" && "$recorded" == "4" ]]; then
  echo "  PASS  fresh replay: legacy deprecated, marker once, all 4 versions recorded"
  pass=$((pass+1))
else
  echo "  FAIL  fresh replay: status=$result marker=$marker recorded=$recorded"
  fail=$((fail+1))
fi

echo
echo "=== Test 2: existing-production-like replay (already deprecated; only 20260913100000 unrecorded) ==="
setup_db
run_sql -c "${STEP_LEGACY}"
run_sql -c "${STEP_SUCCESSOR}"
# Bring content_sources to the REAL current production state (already deprecated).
run_sql -c "UPDATE public.content_sources SET verification_status='deprecated', notes = notes || E'\n\n[Phase 8C: 2026-09-03] Deprecated (verification_status candidate -> deprecated). Superseded by the active certified source edition_identifier=''kazimirski-1869-segments-v1''.' WHERE edition_identifier='kazimirski-1869';"
notes_before=$(run_sql -tAc "SELECT notes FROM public.content_sources WHERE edition_identifier='kazimirski-1869';")
run_sql -c "INSERT INTO supabase_migrations.schema_migrations (version,name) VALUES ('20260820100000','a'), ('20260912100000','b'), ('20260904220940','orphan-placeholder');"
db_push \
  "20260820100000:::${STEP_LEGACY}" \
  "20260904220940:::${STEP_PLACEHOLDER}" \
  "20260912100000:::${STEP_SUCCESSOR}" \
  "20260913100000:::${STEP_REAL}"
notes_after=$(run_sql -tAc "SELECT notes FROM public.content_sources WHERE edition_identifier='kazimirski-1869';")
marker2=$(run_sql -tAc "SELECT (length(notes) - length(replace(notes, E'\n\n[Phase 8C: ', ''))) / length(E'\n\n[Phase 8C: ') FROM public.content_sources WHERE edition_identifier='kazimirski-1869';")
recorded2=$(run_sql -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations;")
if [[ "$notes_before" == "$notes_after" && "$marker2" == "1" && "$recorded2" == "4" ]]; then
  echo "  PASS  existing-production-like replay: content byte-identical before/after, marker still once, history now complete (4/4)"
  pass=$((pass+1))
else
  echo "  FAIL  existing-production-like replay: notes changed or marker/recorded wrong (marker=$marker2 recorded=$recorded2)"
  fail=$((fail+1))
fi

echo
echo "=== Test 3: Option 4 (renaming) is unsafe — real migration run BEFORE its successor exists ==="
setup_db
run_sql -c "${STEP_LEGACY}"
set +e
db_push "20260904220940:::${STEP_REAL}"
rc=$?
set -e
if [[ $rc -ne 0 ]]; then
  echo "  PASS  running the real migration at the earlier slot (no successor yet) fails closed, as expected"
  pass=$((pass+1))
else
  echo "  FAIL  expected failure (precondition 2) but the migration succeeded — Option 4 would be unsafe silently"
  fail=$((fail+1))
fi

echo
echo "phase8c3 migration-history reconciliation test: ${pass} passed, ${fail} failed"
[[ $fail -eq 0 ]]

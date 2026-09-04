#!/usr/bin/env bash
# Migration-logic test for:
#   supabase/migrations/20260913100000_7872f932-bfd3-42d6-b36c-36e4b8587c81.sql
#   (Phase 8C.2 — deprecate the empty legacy Kazimirski content_sources row)
#
# WHAT THIS DOES NOT DO
#   * It never touches production, CI, or any local shared database.
#   * It spins up a DISPOSABLE Docker PostgreSQL container, builds a minimal
#     faithful fixture schema (the real public.content_sources DDL + stub
#     child tables carrying only the foreign-key columns that reference it),
#     seeds a production-like 5-row content_sources state, then runs each
#     case inside its own BEGIN/.../ROLLBACK transaction so nothing persists.
#   * The container is force-removed on exit (trap), so there is no leftover
#     state anywhere.
#
# REQUIREMENTS: docker (running). If docker is unavailable the script prints
# SKIP and exits 0 — it is a best-effort local check, not a CI gate (per the
# Phase 8C.2 instruction: no production-state validator requirement yet).
#
# USAGE:  bash scripts/db-migration-tests/phase8c-deprecate-legacy-kazimirski.test.sh

set -euo pipefail

MIGRATION_FILE="$(cd "$(dirname "$0")/../.." && pwd)/supabase/migrations/20260913100000_7872f932-bfd3-42d6-b36c-36e4b8587c81.sql"
IMAGE="postgres:16-alpine"
CONTAINER="phase8c-migtest-$$"
PSQL=(docker exec -i "$CONTAINER" psql -U postgres -d testdb -v ON_ERROR_STOP=1 -q)

pass=0
fail=0

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "SKIP: docker not available — migration-logic test not run."
  echo "      (Run it on a machine with docker to exercise all 11 cases.)"
  exit 0
fi

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "FAIL: migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "Starting disposable Postgres ($IMAGE) as $CONTAINER ..."
docker run -d --rm --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.5
done
docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE testdb;" >/dev/null

# ----------------------------------------------------------------------------
# Fixture schema: the REAL content_sources DDL (constraints matter for the
# test), plus stub child tables holding only the FK column that references it.
# An extra synthetic FK table (extra_ref) proves the migration's dynamic
# catalog sweep catches foreign keys it does not name explicitly.
# ----------------------------------------------------------------------------
"${PSQL[@]}" <<'SQL'
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

CREATE TABLE public.surahs (
  number integer PRIMARY KEY,
  metadata_source_id uuid REFERENCES public.content_sources(id)
);
CREATE TABLE public.ayahs (
  id bigserial PRIMARY KEY,
  arabic_source_id uuid REFERENCES public.content_sources(id)
);
CREATE TABLE public.translations (
  id bigserial PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES public.content_sources(id)
);
CREATE TABLE public.translation_segments (
  id bigserial PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES public.content_sources(id)
);
CREATE TABLE public.translation_segment_ayahs (
  id bigserial PRIMARY KEY,
  segment_id bigint NOT NULL REFERENCES public.translation_segments(id)
);
CREATE TABLE public.lessons (
  id bigserial PRIMARY KEY,
  content_source_id uuid REFERENCES public.content_sources(id)
);
-- Synthetic extra FK the migration does NOT mention by name:
CREATE TABLE public.extra_ref (
  id bigserial PRIMARY KEY,
  some_source_id uuid REFERENCES public.content_sources(id)
);
SQL

# ----------------------------------------------------------------------------
# Seed: production-like content_sources state (values as audited in Phase 8C).
# ----------------------------------------------------------------------------
"${PSQL[@]}" <<'SQL'
INSERT INTO public.content_sources
  (id, content_type, provider_name, dataset_name, edition_identifier, language,
   translator, version, license_name, license_url, attribution_required,
   modification_restricted, source_url, retrieved_at, public_domain,
   legacy_interim, verification_status, notes)
VALUES
  ('5fe9ddf8-bc18-4326-899d-a247856c306b','arabic_text','Tanzil Project','Uthmani Script','uthmani','ar',
   NULL,'1.1','Creative Commons Attribution 3.0','https://tanzil.net/docs/Text_License',true,true,
   'https://tanzil.net/download/',NULL,false,false,'candidate','Canonical production Arabic source.'),
  ('f32639a6-8dc1-4be0-b8fc-bc9ac1c0fb76','translation','Project Gutenberg','Three Translations','pickthall-gutenberg-16955','en',
   'Marmaduke Pickthall','Project Gutenberg eBook #16955 digital edition','Public Domain (United States)',NULL,false,false,
   'https://www.gutenberg.org/files/16955/16955.txt',NULL,true,false,'verified','Governed English translation source.'),
  ('f8443b10-3cc8-59ee-954f-5b1129c1cec4','translation','Wikisource (fr.wikisource.org)','Le Koran (traduction de Kazimirski)','kazimirski-1869-segments-v1','fr',
   'Albin de Kazimirski Biberstein','Charpentier, Paris, 1869 printing','Public domain',NULL,true,false,
   'https://fr.wikisource.org/wiki/Le_Koran_(Traduction_de_Kazimirski)/Texte_entier',NULL,true,false,'candidate',
   'Segment-based, production-governed Kazimirski FR source.'),
  ('ed6028cb-a507-4bf4-9f74-4b71602bb4e4','translation','Wikisource (Wikimedia)','Le Koran','kazimirski-1869','fr',
   'Albin de Kazimirski (Biberstein)','Librairie Charpentier, 1869 edition','Public Domain',NULL,false,false,
   'https://fr.wikisource.org/wiki/Le_Koran_(Traduction_de_Kazimirski)/Texte_entier',NULL,true,true,'candidate',
   'Interim/legacy FR translation for Phase 2A only, pending research and licensing of a modern French translation before production launch. Translator died 1887, unambiguously public domain. Deliberately not the disputed King Fahd Complex "fr.hamidullah" edition.'),
  ('72059e3a-3b4c-4060-a221-0f91ca219ed6','translation','api.alquran.cloud','French Quran Translation','fr.hamidullah-crf','fr',
   'Muhammad Hamidullah','King Fahd Complex / Muslim World League revision','Disputed / rights not cleared',NULL,true,true,
   'https://api.alquran.cloud/',NULL,false,true,'disputed','Formally registers the disputed source.');

-- A few child rows that must remain untouched by the migration.
INSERT INTO public.translations (source_id)
  SELECT id FROM public.content_sources WHERE edition_identifier = 'pickthall-gutenberg-16955';
INSERT INTO public.translation_segments (source_id)
  SELECT id FROM public.content_sources WHERE edition_identifier = 'kazimirski-1869-segments-v1';
INSERT INTO public.translation_segment_ayahs (segment_id)
  SELECT id FROM public.translation_segments LIMIT 1;
SQL

LEGACY_NOTES_ORIG="$("${PSQL[@]}" -tAc "SELECT notes FROM public.content_sources WHERE edition_identifier='kazimirski-1869' AND legacy_interim;")"

# ----------------------------------------------------------------------------
# Case runner: each case runs in ONE transaction that always ends in ROLLBACK.
#   run_case <name> <expect: pass|fail> <setup-sql> <assert-sql>
# ----------------------------------------------------------------------------
run_case() {
  local name="$1" expect="$2" setup="$3" assert="$4" rc=0 out
  out="$(docker exec -i "$CONTAINER" psql -U postgres -d testdb -v ON_ERROR_STOP=1 -q <<SQL 2>&1
BEGIN;
${setup}
\\i /migration.sql
${assert}
ROLLBACK;
SQL
)" || rc=$?
  if [[ "$expect" == "pass" && $rc -eq 0 ]] || [[ "$expect" == "fail" && $rc -ne 0 ]]; then
    printf '  PASS  %s\n' "$name"; pass=$((pass + 1))
  else
    printf '  FAIL  %s  (expected %s, rc=%s)\n' "$name" "$expect" "$rc"
    printf '        %s\n' "$out" | sed 's/^/        /'
    fail=$((fail + 1))
  fi
}

docker cp "$MIGRATION_FILE" "$CONTAINER:/migration.sql" >/dev/null

A_LEGACY="DO \$a\$ BEGIN
  IF (SELECT verification_status FROM public.content_sources WHERE edition_identifier='kazimirski-1869' AND legacy_interim) <> 'deprecated'
     THEN RAISE EXCEPTION 'legacy row not deprecated'; END IF;
  IF (SELECT count(*) FROM public.content_sources WHERE verification_status='deprecated') <> 1
     THEN RAISE EXCEPTION 'expected exactly one deprecated row'; END IF;
  IF position('kazimirski-1869-segments-v1' in (SELECT notes FROM public.content_sources WHERE edition_identifier='kazimirski-1869' AND legacy_interim)) = 0
     THEN RAISE EXCEPTION 'successor reference missing from notes'; END IF;
END \$a\$;"

A_MARKER_ONCE="DO \$a\$ DECLARE n int; t text; BEGIN
  SELECT notes INTO t FROM public.content_sources WHERE edition_identifier='kazimirski-1869' AND legacy_interim;
  n := (length(t) - length(replace(t, E'\n\n[Phase 8C: ', ''))) / length(E'\n\n[Phase 8C: ');
  IF n <> 1 THEN RAISE EXCEPTION 'expected successor marker exactly once, found %', n; END IF;
END \$a\$;"

A_NOTES_PRESERVED="DO \$a\$ DECLARE t text; o text := \$o\$${LEGACY_NOTES_ORIG}\$o\$; BEGIN
  SELECT notes INTO t FROM public.content_sources WHERE edition_identifier='kazimirski-1869' AND legacy_interim;
  IF left(t, length(o)) <> o THEN RAISE EXCEPTION 'original notes not preserved verbatim as the prefix'; END IF;
END \$a\$;"

A_ACTIVE_UNCHANGED="DO \$a\$ BEGIN
  IF (SELECT verification_status FROM public.content_sources WHERE edition_identifier='kazimirski-1869-segments-v1') <> 'candidate'
     THEN RAISE EXCEPTION 'active successor status changed'; END IF;
  IF (SELECT notes FROM public.content_sources WHERE edition_identifier='kazimirski-1869-segments-v1')
     <> 'Segment-based, production-governed Kazimirski FR source.'
     THEN RAISE EXCEPTION 'active successor notes changed'; END IF;
END \$a\$;"

A_ARABIC_UNCHANGED="DO \$a\$ BEGIN
  IF (SELECT verification_status FROM public.content_sources WHERE edition_identifier='uthmani') <> 'candidate'
     THEN RAISE EXCEPTION 'uthmani status changed'; END IF;
END \$a\$;"

A_CHILDREN_UNCHANGED="DO \$a\$ BEGIN
  IF (SELECT count(*) FROM public.translations) <> 1 THEN RAISE EXCEPTION 'translations row count changed'; END IF;
  IF (SELECT count(*) FROM public.translation_segments) <> 1 THEN RAISE EXCEPTION 'translation_segments row count changed'; END IF;
  IF (SELECT count(*) FROM public.translation_segment_ayahs) <> 1 THEN RAISE EXCEPTION 'translation_segment_ayahs row count changed'; END IF;
  IF (SELECT count(*) FROM public.ayahs) <> 0 THEN RAISE EXCEPTION 'ayahs row count changed'; END IF;
  IF (SELECT count(*) FROM public.surahs) <> 0 THEN RAISE EXCEPTION 'surahs row count changed'; END IF;
  IF (SELECT count(*) FROM public.lessons) <> 0 THEN RAISE EXCEPTION 'lessons row count changed'; END IF;
END \$a\$;"

echo
echo "Running migration-logic cases (each in its own rolled-back transaction):"

run_case "1  candidate row -> exactly one row deprecated"                 pass ""  "$A_LEGACY $A_MARKER_ONCE"
run_case "2  applied twice -> second application is a no-op"              pass "\\i /migration.sql"  "$A_LEGACY $A_MARKER_ONCE"
run_case "3  missing legacy source -> explicit failure"                  fail "DELETE FROM public.content_sources WHERE edition_identifier='kazimirski-1869' AND legacy_interim;"  ""
run_case "4  duplicate legacy sources -> explicit failure"               fail "INSERT INTO public.content_sources (content_type,provider_name,dataset_name,edition_identifier,language,translator,license_name,source_url,legacy_interim,verification_status) VALUES ('translation','x','x','kazimirski-1869','fr','x','x','x',true,'candidate');"  ""
run_case "5  missing active successor -> explicit failure"               fail "DELETE FROM public.content_sources WHERE edition_identifier='kazimirski-1869-segments-v1';"  ""
run_case "6a child ref in translations -> explicit failure"              fail "INSERT INTO public.translations (source_id) SELECT id FROM public.content_sources WHERE edition_identifier='kazimirski-1869' AND legacy_interim;"  ""
run_case "6b child ref in lessons -> explicit failure"                   fail "INSERT INTO public.lessons (content_source_id) SELECT id FROM public.content_sources WHERE edition_identifier='kazimirski-1869' AND legacy_interim;"  ""
run_case "6c child ref via an FK not named in the migration -> failure"  fail "INSERT INTO public.extra_ref (some_source_id) SELECT id FROM public.content_sources WHERE edition_identifier='kazimirski-1869' AND legacy_interim;"  ""
run_case "7  existing notes preserved verbatim as the prefix"            pass ""  "$A_NOTES_PRESERVED"
run_case "8  successor note not duplicated (single application)"         pass ""  "$A_MARKER_ONCE"
run_case "9  active kazimirski-1869-segments-v1 source unchanged"        pass ""  "$A_ACTIVE_UNCHANGED"
run_case "10 canonical Arabic 'uthmani' source unchanged"               pass ""  "$A_ARABIC_UNCHANGED"
run_case "11 child content (rows/counts) unchanged"                      pass ""  "$A_CHILDREN_UNCHANGED"

echo
echo "phase8c migration-logic test: ${pass} passed, ${fail} failed"
[[ $fail -eq 0 ]]

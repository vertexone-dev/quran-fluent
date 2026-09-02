-- Kazimirski French translation — PRODUCTION SCHEMA migration (schema + source
-- metadata only; the 6,239 segment rows / 6,396 join rows are NOT inserted by
-- this file, per PRODUCTION-MIGRATION-IMPORT-DESIGN.md §10 Option A).
--
-- ============================================================================
-- SAFETY-CRITICAL PLACEMENT NOTICE
-- ============================================================================
-- This file is DELIBERATELY staged at
--   scripts/quran-import/kazimirski/migrations-staging/
-- and NOT under supabase/migrations/. `supabase db push --linked` only picks
-- up files under supabase/migrations/, and other unrelated gates in this
-- long-running engagement invoke that command; leaving this file outside that
-- directory means it cannot be accidentally swept into an unrelated push. It
-- is named exactly as it would be named if/when a future, separately
-- authorized gate promotes it (same `YYYYMMDDHHMMSS_<uuid>.sql` convention as
-- every file already in supabase/migrations/), so promotion is a plain `git
-- mv` plus a fresh precondition re-check against production, not a rewrite.
--
-- THIS FILE HAS NOT BEEN APPLIED ANYWHERE. Not to local Postgres, not to any
-- staging/preview branch, not to production. Building it is the deliverable
-- of this gate; applying it is a separate, future, separately-authorized
-- gate (the mandatory local rehearsal in PRODUCTION-MIGRATION-IMPORT-DESIGN.md
-- §16, which this gate was explicitly told NOT to run).
--
-- ============================================================================
-- What this migration does, in order
-- ============================================================================
--   1. Creates `translation_segments` (per §3 of the design, unchanged from
--      the local prototype's shape).
--   2. Creates `translation_segment_ayahs` (per §3 of the design, WITH the
--      one material delta from the prototype: adds reviewer_notes,
--      reviewed_by, reviewed_at — closing the Phase 5 "schema_gap_noted"
--      finding recorded in decision phase5-003, where join-level review
--      provenance had nowhere to live except an external JSON ledger).
--   3. Adds a cross-surah protection trigger on translation_segment_ayahs
--      (see the design doc §4 table for why this ONE invariant gets a
--      trigger while the cardinality invariants — many_to_one/one_to_many
--      row counts — deliberately do not: this is a single-row check against
--      exactly one other single row [a join's declared surah vs its parent
--      segment's surah], which a `BEFORE INSERT/UPDATE` trigger expresses
--      cleanly and cheaply; cardinality invariants are properties of a SET
--      of rows, which no single-row trigger can check without either firing
--      once per row of an N-row set [wasteful, still incomplete] or an
--      expensive full-table aggregate on every write [wrong tool] — those
--      stay import-time-only, exactly as the design doc's own table
--      classifies them).
--   4. Registers the Kazimirski `content_sources` row (metadata only,
--      `verification_status = 'candidate'` — see notes on that row below for
--      why, matching PRODUCTION-MIGRATION-IMPORT-DESIGN.md §7's settled
--      answer to unresolved question 1 in §21).
--
-- Touches ONLY: translation_segments (created, 0 rows), translation_segment_ayahs
-- (created, 0 rows), content_sources (1 insert). Never touches ayahs,
-- translations, surahs, or any other existing table. Every precondition below
-- must hold or the migration aborts before making any change; every
-- postcondition is re-verified before commit — mirroring exactly the pattern
-- already proven in supabase/migrations/20260911110000_521fb3f2-dbdb-41a6-9985-098065ebd88c.sql
-- (the fr.hamidullah-crf remediation).
--
-- ============================================================================
-- Preconditions
-- ============================================================================

DO $$
DECLARE
  v_total_ayahs integer;
  v_pickthall_count integer;
  v_existing_segments_table regclass;
  v_existing_joins_table regclass;
  v_existing_source_count integer;
BEGIN
  -- Precondition 1: canonical Arabic baseline.
  SELECT count(*) INTO v_total_ayahs FROM public.ayahs;
  IF v_total_ayahs != 6236 THEN
    RAISE EXCEPTION 'Precondition failed: expected exactly 6236 canonical ayahs, found %. Aborting -- this migration must never run against an incomplete or unexpected Arabic dataset.', v_total_ayahs;
  END IF;

  -- Precondition 2: English governed-source baseline (Pickthall), untouched
  -- by this migration and must already be complete before this runs.
  SELECT count(*) INTO v_pickthall_count
  FROM public.translations t
  JOIN public.content_sources cs ON cs.id = t.source_id
  WHERE cs.edition_identifier = 'pickthall-gutenberg-16955' AND cs.verification_status = 'verified';
  IF v_pickthall_count != 6236 THEN
    RAISE EXCEPTION 'Precondition failed: expected exactly 6236 verified Pickthall translation rows, found %. Aborting.', v_pickthall_count;
  END IF;

  -- Precondition 3: neither target table may already exist. A prior partial
  -- run, a naming collision, or (as found during this engagement's own local
  -- rehearsal environment, which reuses this exact table name for an
  -- unrelated Phase 3 prototype) an unrelated object occupying this name is
  -- exactly the state this precondition exists to catch and refuse, never
  -- silently coexist with or overwrite.
  v_existing_segments_table := to_regclass('public.translation_segments');
  v_existing_joins_table := to_regclass('public.translation_segment_ayahs');
  IF v_existing_segments_table IS NOT NULL OR v_existing_joins_table IS NOT NULL THEN
    RAISE EXCEPTION 'Precondition failed: translation_segments (%) and/or translation_segment_ayahs (%) already exist. Aborting -- this migration must only ever run against a database where neither table exists yet.', v_existing_segments_table, v_existing_joins_table;
  END IF;

  -- Precondition 4: no existing content_sources collision on the exact
  -- edition_identifier this migration is about to register. Two other,
  -- unrelated Kazimirski-adjacent rows are known to legitimately coexist
  -- (edition_identifier='kazimirski-1869', a pre-existing empty legacy_interim
  -- row; edition_identifier='kazimirski-1869-segments-phase3', an unrelated
  -- local-only Phase 3 prototype row) -- neither collides with the identifier
  -- this migration inserts, and both are explicitly left untouched.
  SELECT count(*) INTO v_existing_source_count
  FROM public.content_sources
  WHERE edition_identifier = 'kazimirski-1869-segments-v1';
  IF v_existing_source_count != 0 THEN
    RAISE EXCEPTION 'Precondition failed: a content_sources row for kazimirski-1869-segments-v1 already exists (% row(s)). Aborting to avoid a duplicate/conflicting registration.', v_existing_source_count;
  END IF;

  RAISE NOTICE 'All preconditions satisfied: % canonical ayahs, % Pickthall rows, no existing translation_segments/translation_segment_ayahs tables, no existing kazimirski-1869-segments-v1 source row. Proceeding.', v_total_ayahs, v_pickthall_count;
END $$;

-- ============================================================================
-- Step 1: translation_segments
-- ============================================================================

CREATE TABLE public.translation_segments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id                uuid NOT NULL REFERENCES public.content_sources(id),
  surah_number             integer NOT NULL REFERENCES public.surahs(number),

  segment_type             text NOT NULL DEFAULT 'numbered'
                              CHECK (segment_type IN ('numbered', 'unnumbered_preamble')),

  -- Physical extraction position within the surah, 0-based for the one
  -- unnumbered preamble (Al-Fatiha's Bismillah), 1-based and gapless for
  -- every numbered segment. Source of truth for rendering/concatenation
  -- order.
  source_ordinal           integer NOT NULL CHECK (source_ordinal >= 0),

  -- Kazimirski's own printed verse number, where the segment has one and
  -- where that number is directly confirmed (not merely inferred from
  -- physical position during a later re-indexing pass). NULL stays NULL --
  -- never backfilled, never inferred. See Phase 5 decisions phase5-001 /
  -- phase5-002 for the two specific rows (Surah 2 ordinal 286, Surah 36
  -- ordinal 83) this was explicitly litigated for and deliberately left NULL.
  source_declared_number   integer CHECK (source_declared_number IS NULL OR source_declared_number > 0),

  text                     text NOT NULL CHECK (btrim(text) <> ''),
  text_sha256              text NOT NULL CHECK (text_sha256 ~ '^[0-9a-f]{64}$'),
  extraction_source_ref    text NOT NULL,

  alignment_type           text NOT NULL DEFAULT 'unresolved'
                              CHECK (alignment_type IN (
                                'direct', 'offset', 'one_to_many', 'many_to_one',
                                'compound', 'unresolved', 'source_anomaly'
                              )),
  alignment_status         text NOT NULL DEFAULT 'auto_verified'
                              CHECK (alignment_status IN (
                                'auto_verified', 'cross_verified', 'human_verified',
                                'unresolved', 'rejected'
                              )),

  reviewer_notes           text,
  reviewed_by              text,
  reviewed_at              timestamptz,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source_id, surah_number, source_ordinal)
);

CREATE INDEX translation_segments_surah_idx
  ON public.translation_segments (surah_number, source_ordinal);
CREATE INDEX translation_segments_status_idx
  ON public.translation_segments (alignment_status)
  WHERE alignment_status IN ('unresolved', 'human_verified');

-- Immutability: identity/provenance fields (§5 of the design) may never be
-- silently rewritten once inserted. Review-state fields (alignment_status,
-- reviewer_notes, reviewed_by, reviewed_at) remain mutable -- that IS the
-- review workflow. First production use of a column-level `IS DISTINCT FROM
-- OLD` immutability trigger in this codebase (noted as new, not matching a
-- prior convention, per the design doc §2).
CREATE FUNCTION public.translation_segments_immutable_fields() RETURNS trigger AS $$
BEGIN
  IF NEW.source_id IS DISTINCT FROM OLD.source_id
     OR NEW.surah_number IS DISTINCT FROM OLD.surah_number
     OR NEW.segment_type IS DISTINCT FROM OLD.segment_type
     OR NEW.source_ordinal IS DISTINCT FROM OLD.source_ordinal
     OR NEW.source_declared_number IS DISTINCT FROM OLD.source_declared_number
     OR NEW.text IS DISTINCT FROM OLD.text
     OR NEW.text_sha256 IS DISTINCT FROM OLD.text_sha256
     OR NEW.extraction_source_ref IS DISTINCT FROM OLD.extraction_source_ref
     OR NEW.alignment_type IS DISTINCT FROM OLD.alignment_type
  THEN
    RAISE EXCEPTION 'translation_segments identity fields are immutable (segment %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER translation_segments_immutable_fields_trg
  BEFORE UPDATE ON public.translation_segments
  FOR EACH ROW EXECUTE FUNCTION public.translation_segments_immutable_fields();

-- Reuses the existing update_updated_at_column() function (already used by
-- translations, review_items, etc.) -- not redefined here.
CREATE TRIGGER translation_segments_updated_at
  BEFORE UPDATE ON public.translation_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.translation_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_segments_read_all ON public.translation_segments
  FOR SELECT TO anon, authenticated USING (true);
-- No INSERT/UPDATE/DELETE policy for anon/authenticated, matching
-- translations and content_sources exactly: writes only via migration /
-- service role, never the client.

GRANT SELECT ON public.translation_segments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_segments TO service_role;

-- ============================================================================
-- Step 2: translation_segment_ayahs
-- ============================================================================

CREATE TABLE public.translation_segment_ayahs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id         uuid NOT NULL REFERENCES public.translation_segments(id) ON DELETE RESTRICT,
  surah_number       integer NOT NULL,
  ayah_number        integer NOT NULL,

  mapping_confidence text NOT NULL DEFAULT 'auto'
                        CHECK (mapping_confidence IN ('auto', 'cross_verified', 'human_verified', 'needs_review')),

  -- NEW vs. the local prototype (PRODUCTION-MIGRATION-IMPORT-DESIGN.md §3):
  -- closes the exact gap Phase 5 decision phase5-003 recorded as
  -- "schema_gap_noted" -- join-level review provenance previously had
  -- nowhere to live except the external PHASE5-REVIEW-DECISIONS.json ledger.
  reviewer_notes     text,
  reviewed_by        text,
  reviewed_at        timestamptz,

  created_at         timestamptz NOT NULL DEFAULT now(),

  FOREIGN KEY (surah_number, ayah_number)
    REFERENCES public.ayahs (surah_number, ayah_number) ON DELETE RESTRICT,
  UNIQUE (segment_id, surah_number, ayah_number)
);

CREATE INDEX translation_segment_ayahs_ayah_idx
  ON public.translation_segment_ayahs (surah_number, ayah_number);
CREATE INDEX translation_segment_ayahs_segment_idx
  ON public.translation_segment_ayahs (segment_id);

-- Immutability: the mapping identity itself (segment_id, surah_number,
-- ayah_number) may never be silently rewritten -- a rejected mapping gets a
-- NEW corrected row, never a mutated one (PHASE2-MAPPING-ARCHITECTURE.md §2,
-- 'rejected' semantics). mapping_confidence and the three review-metadata
-- columns remain mutable.
CREATE FUNCTION public.translation_segment_ayahs_immutable_fields() RETURNS trigger AS $$
BEGIN
  IF NEW.segment_id IS DISTINCT FROM OLD.segment_id
     OR NEW.surah_number IS DISTINCT FROM OLD.surah_number
     OR NEW.ayah_number IS DISTINCT FROM OLD.ayah_number
  THEN
    RAISE EXCEPTION 'translation_segment_ayahs mapping identity fields are immutable (join %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER translation_segment_ayahs_immutable_fields_trg
  BEFORE UPDATE ON public.translation_segment_ayahs
  FOR EACH ROW EXECUTE FUNCTION public.translation_segment_ayahs_immutable_fields();

-- Cross-surah protection (design doc §4's "database-enforceable vs
-- import-time" table): a plain CHECK cannot compare this row's surah_number
-- against its parent segment's surah_number in a different table, but this
-- IS a clean, single-row-vs-single-row structural invariant (not a
-- set-based/cardinality property like many_to_one/one_to_many row counts,
-- which stay import-time-only, deliberately, per the same table) -- so it
-- gets a small, single-purpose trigger. Fires on INSERT (the case that
-- matters) and defensively on UPDATE too (a no-op in practice once
-- segment_id/surah_number are already protected by the immutability trigger
-- above, but cheap and correct to keep symmetric).
CREATE FUNCTION public.translation_segment_ayahs_cross_surah_guard() RETURNS trigger AS $$
DECLARE
  v_parent_surah integer;
BEGIN
  SELECT surah_number INTO v_parent_surah
  FROM public.translation_segments
  WHERE id = NEW.segment_id;

  IF v_parent_surah IS NULL THEN
    RAISE EXCEPTION 'translation_segment_ayahs: segment_id % does not resolve to an existing translation_segments row', NEW.segment_id;
  END IF;

  IF v_parent_surah IS DISTINCT FROM NEW.surah_number THEN
    RAISE EXCEPTION 'translation_segment_ayahs: cross-surah join rejected -- segment % belongs to surah %, but this join row declares surah %', NEW.segment_id, v_parent_surah, NEW.surah_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER translation_segment_ayahs_cross_surah_guard_trg
  BEFORE INSERT OR UPDATE ON public.translation_segment_ayahs
  FOR EACH ROW EXECUTE FUNCTION public.translation_segment_ayahs_cross_surah_guard();

ALTER TABLE public.translation_segment_ayahs ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_segment_ayahs_read_all ON public.translation_segment_ayahs
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.translation_segment_ayahs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_segment_ayahs TO service_role;

-- ============================================================================
-- Step 3: register the Kazimirski content_sources row (metadata only -- the
-- 6,239 segment / 6,396 join rows are imported separately, by
-- import_production_kazimirski.py, from the frozen, hash-verified artifact).
-- ============================================================================

-- NOTE (ID STRATEGY DEVIATION -- see kaz_prod_lib.py module docstring and
-- the final report §C for the full reasoning): this `id` is NOT
-- gen_random_uuid()'s default. It is the fixed, deterministic UUIDv5 value
-- `uuid5(KAZIMIRSKI_UUID_NAMESPACE, 'source:kazimirski-1869-segments-v1')`,
-- computed once and pinned here as a literal so the migration, the
-- generator, the importer, the rollback tool, and the validator all agree
-- on this row's id byte-for-byte without any of them needing to query for
-- it first. This deliberately overrides PRODUCTION-MIGRATION-IMPORT-DESIGN.md
-- §11's own recommendation of a fresh random id generated at import time.
INSERT INTO public.content_sources (
  id, content_type, provider_name, dataset_name, edition_identifier, language,
  translator, version, license_name, license_url, attribution_required,
  modification_restricted, source_url, retrieved_at, public_domain,
  legacy_interim, verification_status, notes
) VALUES (
  'f8443b10-3cc8-59ee-954f-5b1129c1cec4',
  'translation',
  'Wikisource (fr.wikisource.org)',
  'Le Koran (traduction de Kazimirski)',
  'kazimirski-1869-segments-v1',
  'fr',
  'Albin de Kazimirski Biberstein',
  'Charpentier, Paris, 1869 printing (translation first published 1840)',
  'Public domain',
  NULL,
  true,
  false,
  'https://fr.wikisource.org/wiki/Le_Koran_(Traduction_de_Kazimirski)/Texte_entier',
  '2026-09-01T14:50:33.734994+00'::timestamptz,
  true,
  false,
  'candidate',
  'Segment-based, production-governed Kazimirski FR source (translation_segments + translation_segment_ayahs), the successor of the local-only Phase 3 prototype row (edition_identifier=''kazimirski-1869-segments-phase3'', left untouched) and distinct from the pre-existing empty legacy_interim flat-table row (edition_identifier=''kazimirski-1869'', also left untouched). Translator died 1887 -- public domain. Provenance chain: Charpentier 1869 printing, Wikisource Avancement=V, Google Books scan 3XSe413MJyQC, Harvard Library copy. Raw source artifact texte_entier_raw.html SHA-256: 38f94de9e95b8163949d68e69c150ae14343f8799006b58c1fc44fc17f9d0b92. Aggregate ordered segment-text hash (all 6,239 segments, (surah_number,source_ordinal) order, joined by U+001E): 12015b8f007a41adc36776172d3161d25c0f01a78bdc6a2418fcc6937ee9fc26. Full governance record: scripts/quran-import/kazimirski/PHASE1-ALIGNMENT-AUDIT.md through PHASE5-REVIEW-DECISIONS.json (25/25 decisions, all APPROVE) and PRODUCTION-MIGRATION-IMPORT-DESIGN.md. verification_status=''candidate'' (not ''verified''): Phase 5''s human review validated ALIGNMENT/MAPPING MECHANICS -- that Kazimirski''s French segments are correctly matched to canonical (surah,ayah) pairs -- which is a different claim from independently verifying the TRANSLATION QUALITY of that French text against the Arabic, the bar ''verified'' carries elsewhere in this schema (matching Pickthall''s). A distinct translation-quality review remains open (PRODUCTION-MIGRATION-IMPORT-DESIGN.md §21, question 1) before ''verified'' would be appropriate. No Hamidullah, no other disputed source, is referenced by this row.'
);

-- ============================================================================
-- Postconditions
-- ============================================================================

DO $$
DECLARE
  v_segments_count integer;
  v_joins_count integer;
  v_total_ayahs integer;
  v_pickthall_count integer;
  v_source_status text;
  v_source_id uuid;
BEGIN
  SELECT count(*) INTO v_segments_count FROM public.translation_segments;
  IF v_segments_count != 0 THEN
    RAISE EXCEPTION 'Postcondition failed: expected translation_segments to have 0 rows immediately after this schema-only migration, found %. Aborting.', v_segments_count;
  END IF;

  SELECT count(*) INTO v_joins_count FROM public.translation_segment_ayahs;
  IF v_joins_count != 0 THEN
    RAISE EXCEPTION 'Postcondition failed: expected translation_segment_ayahs to have 0 rows immediately after this schema-only migration, found %. Aborting.', v_joins_count;
  END IF;

  SELECT id, verification_status INTO v_source_id, v_source_status
  FROM public.content_sources WHERE edition_identifier = 'kazimirski-1869-segments-v1';
  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'Postcondition failed: expected exactly one kazimirski-1869-segments-v1 content_sources row, found none. Aborting.';
  END IF;
  IF v_source_status != 'candidate' THEN
    RAISE EXCEPTION 'Postcondition failed: expected the kazimirski-1869-segments-v1 source to be verification_status = candidate, found %. Aborting.', v_source_status;
  END IF;

  SELECT count(*) INTO v_total_ayahs FROM public.ayahs;
  IF v_total_ayahs != 6236 THEN
    RAISE EXCEPTION 'Postcondition failed: canonical ayahs row count changed from 6236 to %. Aborting -- canonical Arabic must never be affected by this migration.', v_total_ayahs;
  END IF;

  SELECT count(*) INTO v_pickthall_count
  FROM public.translations t
  JOIN public.content_sources cs ON cs.id = t.source_id
  WHERE cs.edition_identifier = 'pickthall-gutenberg-16955' AND cs.verification_status = 'verified';
  IF v_pickthall_count != 6236 THEN
    RAISE EXCEPTION 'Postcondition failed: verified Pickthall translation count changed from 6236 to %. Aborting -- the English governed source must never be affected by this migration.', v_pickthall_count;
  END IF;

  RAISE NOTICE 'All postconditions satisfied: translation_segments/translation_segment_ayahs created with 0 rows each, content_sources row % registered as candidate, 6236 canonical ayahs and 6236 Pickthall translations unchanged. Ready for the separate, later import step (import_production_kazimirski.py) once a full local rehearsal (PRODUCTION-MIGRATION-IMPORT-DESIGN.md §16) has actually run and passed.', v_source_id;
END $$;

-- Kazimirski French translation alignment — Phase 3 LOCAL PROTOTYPE schema.
--
-- STATUS: LOCAL PROTOTYPE ONLY. This file lives under
-- scripts/quran-import/kazimirski/local-prototype/, NOT under
-- supabase/migrations/. It must be applied only via direct psql against the
-- local Postgres instance (postgresql://postgres:postgres@127.0.0.1:54322/postgres),
-- never via `supabase db push`, and never against anything --linked / remote.
--
-- This is the exact DDL specified in PHASE2-MAPPING-ARCHITECTURE.md §1 (both
-- tables, all constraints, the immutability trigger, RLS) plus the additive
-- review_items columns from §12. Nothing here has been altered from the
-- approved Phase 2 design except formatting.

BEGIN;

-- ============================================================================
-- translation_segments
-- ============================================================================

CREATE TABLE public.translation_segments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id                uuid NOT NULL REFERENCES public.content_sources(id),
  surah_number             integer NOT NULL REFERENCES public.surahs(number),

  segment_type             text NOT NULL DEFAULT 'numbered'
                              CHECK (segment_type IN ('numbered', 'unnumbered_preamble')),

  -- Physical extraction position within the surah, 1-based, gapless, always present.
  -- This is the SOURCE OF TRUTH for rendering/concatenation order -- it reflects where
  -- the segment actually sits in Kazimirski's book, independent of whether his own
  -- printed verse number (below) is trustworthy for that surah.
  source_ordinal           integer NOT NULL,

  -- Kazimirski's own printed verse number, where the segment has one. Nullable because
  -- an unnumbered preamble has none, and because it can legitimately diverge from
  -- source_ordinal once an unresolved extra segment (Surah 2, Surah 36) exists past it --
  -- that divergence is signal, not something to paper over by forcing them equal.
  source_declared_number   integer,

  text                     text NOT NULL CHECK (btrim(text) <> ''),
  text_sha256              text NOT NULL,

  -- Traceability back to the frozen raw artifact this segment was extracted from
  -- (e.g. a byte range in texte_entier_raw.html, or a Page-namespace URL for the
  -- Surah 91 special case) -- not a rendering concern, purely an audit trail.
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

-- Immutability: once text is written, it may never change silently. Alignment
-- classification, status, and reviewer fields remain mutable (that IS the review
-- workflow); the text itself and its hash do not, mirroring the project's standing
-- "never modify translation wording" rule at the database layer, not just by convention.
CREATE FUNCTION public.translation_segments_text_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.text IS DISTINCT FROM OLD.text OR NEW.text_sha256 IS DISTINCT FROM OLD.text_sha256 THEN
    RAISE EXCEPTION 'translation_segments.text is immutable once written (segment %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER translation_segments_text_immutable_trg
  BEFORE UPDATE ON public.translation_segments
  FOR EACH ROW EXECUTE FUNCTION public.translation_segments_text_immutable();

CREATE TRIGGER translation_segments_updated_at
  BEFORE UPDATE ON public.translation_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.translation_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_segments_read_all ON public.translation_segments
  FOR SELECT TO anon, authenticated USING (true);
-- No INSERT/UPDATE/DELETE policy for anon/authenticated, matching translations and
-- content_sources exactly: writes only via migration / service role, never the client.

-- ============================================================================
-- translation_segment_ayahs
-- ============================================================================

CREATE TABLE public.translation_segment_ayahs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id        uuid NOT NULL REFERENCES public.translation_segments(id) ON DELETE RESTRICT,
  surah_number      integer NOT NULL,
  ayah_number       integer NOT NULL,

  -- Per-mapping confidence, distinct from the segment's own alignment_status: a
  -- compound-boundary segment (§4.6 of the Phase 1 audit) can have one join row that's
  -- solid and another for the same segment that genuinely needs a human decision.
  mapping_confidence text NOT NULL DEFAULT 'auto'
                        CHECK (mapping_confidence IN ('auto', 'cross_verified', 'human_verified', 'needs_review')),

  created_at        timestamptz NOT NULL DEFAULT now(),

  FOREIGN KEY (surah_number, ayah_number)
    REFERENCES public.ayahs (surah_number, ayah_number) ON DELETE RESTRICT,
  UNIQUE (segment_id, surah_number, ayah_number)
);

CREATE INDEX translation_segment_ayahs_ayah_idx
  ON public.translation_segment_ayahs (surah_number, ayah_number);
CREATE INDEX translation_segment_ayahs_segment_idx
  ON public.translation_segment_ayahs (segment_id);

ALTER TABLE public.translation_segment_ayahs ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_segment_ayahs_read_all ON public.translation_segment_ayahs
  FOR SELECT TO anon, authenticated USING (true);

-- ============================================================================
-- Table-level GRANTs, matching the existing convention on ayahs/translations
-- exactly (anon/authenticated: SELECT only; service_role: full CRUD).
-- NOTE (found during this session, not in the original Phase 2 design doc):
-- a plain `CREATE TABLE` via direct psql does NOT automatically pick up the
-- anon/authenticated/service_role grants that Supabase's own migration
-- pipeline applies to every new public-schema table (verified by diffing
-- `information_schema.role_table_grants` for `ayahs` vs. these two new
-- tables immediately after CREATE TABLE -- ayahs had anon/authenticated
-- SELECT, service_role full CRUD; these two had neither). Without this
-- block, PostgREST (and therefore the resolver's supabase-js queries)
-- fails with "permission denied for table ..." even though RLS policies
-- above are satisfied -- RLS only narrows what an already-GRANTed role can
-- see, it does not substitute for the GRANT itself.
-- ============================================================================

GRANT SELECT ON public.translation_segments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_segments TO service_role;

GRANT SELECT ON public.translation_segment_ayahs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_segment_ayahs TO service_role;

-- ============================================================================
-- review_items provenance columns (PHASE2-MAPPING-ARCHITECTURE.md §12)
-- Additive only: both nullable, `back` stays NOT NULL and unchanged in meaning.
-- ============================================================================

ALTER TABLE public.review_items
  ADD COLUMN translation_source_id   uuid REFERENCES public.content_sources(id),
  ADD COLUMN translation_segment_ids uuid[];

COMMIT;

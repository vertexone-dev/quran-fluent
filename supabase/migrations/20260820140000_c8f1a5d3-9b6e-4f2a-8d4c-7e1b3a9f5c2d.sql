-- Phase 2A: Bootstrap provenance backfill
--
-- Backfills provenance for the existing 7-surah / 58-ayah bootstrap set:
--   - surahs.metadata_source_id
--   - ayahs.arabic_source_id
--
-- Both columns are expected to be NULL for the original bootstrap rows.
--
-- These rows are linked to the canonical Tanzil Uthmani source because
-- the bootstrap Arabic text was independently re-validated against a
-- fresh Tanzil fetch with 0 substantive differences.
--
-- IMPORTANT:
-- This migration is intentionally scoped to the 7 original bootstrap
-- Surahs:
--
--   1, 67, 103, 108, 112, 113, 114
--
-- It does NOT globally update every row whose source_id is NULL.
--
-- This migration never modifies:
--   arabic_text
--   translation_en
--   translation_fr
--   name_en
--   name_ar
--   name_fr
--
-- It only updates:
--   surahs.metadata_source_id
--   ayahs.arabic_source_id
--
-- The canonical Tanzil source must resolve to exactly one row.
-- If it does not, the migration aborts rather than performing an
-- ambiguous provenance backfill.
--
-- NOTE:
-- PostgreSQL does not define max(uuid), so source validation and UUID
-- retrieval are deliberately performed as two separate queries.

DO $$
DECLARE
  tanzil_source_id uuid;
  source_count integer;
  surahs_updated integer;
  ayahs_updated integer;

  bootstrap_surahs constant integer[] :=
    ARRAY[1, 67, 103, 108, 112, 113, 114];

BEGIN

  ---------------------------------------------------------------------------
  -- 1. Verify that exactly one canonical Tanzil Arabic source exists.
  ---------------------------------------------------------------------------

  SELECT count(*)
  INTO source_count
  FROM public.content_sources
  WHERE content_type = 'arabic_text'
    AND provider_name = 'Tanzil Project'
    AND dataset_name = 'Uthmani Script'
    AND edition_identifier = 'uthmani'
    AND language = 'ar';

  IF source_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 canonical Tanzil Arabic content_sources row, found %. Aborting provenance backfill.',
      source_count;
  END IF;


  ---------------------------------------------------------------------------
  -- 2. Retrieve the canonical Tanzil source UUID.
  --
  -- Because the count above guarantees exactly one matching row,
  -- SELECT INTO STRICT is safe and intentionally fails loudly if the
  -- database state changes unexpectedly.
  ---------------------------------------------------------------------------

  SELECT id
  INTO STRICT tanzil_source_id
  FROM public.content_sources
  WHERE content_type = 'arabic_text'
    AND provider_name = 'Tanzil Project'
    AND dataset_name = 'Uthmani Script'
    AND edition_identifier = 'uthmani'
    AND language = 'ar';


  ---------------------------------------------------------------------------
  -- 3. Backfill provenance for the 7 original bootstrap Surahs only.
  ---------------------------------------------------------------------------

  UPDATE public.surahs
  SET metadata_source_id = tanzil_source_id
  WHERE number = ANY (bootstrap_surahs)
    AND metadata_source_id IS NULL;

  GET DIAGNOSTICS surahs_updated = ROW_COUNT;


  ---------------------------------------------------------------------------
  -- 4. Backfill provenance for the original bootstrap Ayahs only.
  --
  -- The seven bootstrap Surahs contain exactly 58 Ayahs:
  --
  --   Al-Fatiha   (1)   = 7
  --   Al-Mulk     (67)  = 30
  --   Al-Asr      (103) = 3
  --   Al-Kawthar  (108) = 3
  --   Al-Ikhlas   (112) = 4
  --   Al-Falaq    (113) = 5
  --   An-Nas      (114) = 6
  --
  -- Total = 58
  ---------------------------------------------------------------------------

  UPDATE public.ayahs
  SET arabic_source_id = tanzil_source_id
  WHERE surah_number = ANY (bootstrap_surahs)
    AND arabic_source_id IS NULL;

  GET DIAGNOSTICS ayahs_updated = ROW_COUNT;


  ---------------------------------------------------------------------------
  -- 5. Verify that every bootstrap Surah now has provenance.
  ---------------------------------------------------------------------------

  IF EXISTS (
    SELECT 1
    FROM public.surahs
    WHERE number = ANY (bootstrap_surahs)
      AND metadata_source_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Bootstrap provenance backfill failed: one or more bootstrap Surahs still have NULL metadata_source_id.';
  END IF;


  ---------------------------------------------------------------------------
  -- 6. Verify that every bootstrap Ayah now has provenance.
  ---------------------------------------------------------------------------

  IF EXISTS (
    SELECT 1
    FROM public.ayahs
    WHERE surah_number = ANY (bootstrap_surahs)
      AND arabic_source_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Bootstrap provenance backfill failed: one or more bootstrap Ayahs still have NULL arabic_source_id.';
  END IF;


  ---------------------------------------------------------------------------
  -- 7. Verify the expected bootstrap dataset still contains exactly
  --    7 Surahs and 58 Ayahs.
  ---------------------------------------------------------------------------

  IF (
    SELECT count(*)
    FROM public.surahs
    WHERE number = ANY (bootstrap_surahs)
  ) <> 7 THEN
    RAISE EXCEPTION
      'Expected exactly 7 bootstrap Surahs during provenance backfill.';
  END IF;

  IF (
    SELECT count(*)
    FROM public.ayahs
    WHERE surah_number = ANY (bootstrap_surahs)
  ) <> 58 THEN
    RAISE EXCEPTION
      'Expected exactly 58 bootstrap Ayahs during provenance backfill.';
  END IF;


  ---------------------------------------------------------------------------
  -- 8. Verify that all bootstrap provenance points specifically to the
  --    canonical Tanzil source resolved above.
  ---------------------------------------------------------------------------

  IF EXISTS (
    SELECT 1
    FROM public.surahs
    WHERE number = ANY (bootstrap_surahs)
      AND metadata_source_id IS DISTINCT FROM tanzil_source_id
  ) THEN
    RAISE EXCEPTION
      'Bootstrap Surah provenance does not consistently reference the canonical Tanzil source.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ayahs
    WHERE surah_number = ANY (bootstrap_surahs)
      AND arabic_source_id IS DISTINCT FROM tanzil_source_id
  ) THEN
    RAISE EXCEPTION
      'Bootstrap Ayah provenance does not consistently reference the canonical Tanzil source.';
  END IF;


  ---------------------------------------------------------------------------
  -- Diagnostic notice only.
  --
  -- On the first clean replay this should normally report:
  --   surahs_updated = 7
  --   ayahs_updated  = 58
  --
  -- The correctness checks above do not depend solely on those numbers,
  -- making the migration safer if the provenance was already populated.
  ---------------------------------------------------------------------------

  RAISE NOTICE
    'Bootstrap provenance verified. Surahs updated: %, Ayahs updated: %, Tanzil source: %',
    surahs_updated,
    ayahs_updated,
    tanzil_source_id;

END
$$;
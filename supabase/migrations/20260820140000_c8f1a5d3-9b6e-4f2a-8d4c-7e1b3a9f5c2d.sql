-- Backfills provenance for the existing 7-surah/58-ayah bootstrap set:
-- surahs.metadata_source_id and ayahs.arabic_source_id, both currently NULL
-- for these rows. Links them to the Tanzil Uthmani v1.1 content_sources
-- row, since the bootstrap set's Arabic text was independently re-validated
-- against a fresh Tanzil fetch with 0 substantive differences.
--
-- Scoped explicitly to the 7 known bootstrap surah numbers (not a global
-- "every row with a NULL source" sweep) so this migration can never
-- accidentally reach past the exact rows it's meant for — including rows
-- inserted by a later migration that, for whatever reason, hasn't had its
-- own source_id set yet. The canonical Tanzil arabic_text source is
-- resolved into a local variable first and this migration aborts loudly if
-- it can't find exactly one, rather than silently backfilling NULLs (an
-- unresolved subquery inside the UPDATE would do that instead of erroring).
--
-- Never touches arabic_text, translation_en, translation_fr, name_en,
-- name_ar, name_fr, or any column besides the two source-link columns.

DO $$
DECLARE
  tanzil_source_id uuid;
  source_count integer;
  surahs_updated integer;
  ayahs_updated integer;
  bootstrap_surahs constant integer[] := ARRAY[1, 67, 103, 108, 112, 113, 114];
BEGIN
  SELECT count(*), max(id) INTO source_count, tanzil_source_id
  FROM public.content_sources
  WHERE content_type = 'arabic_text'
    AND provider_name = 'Tanzil Project'
    AND dataset_name = 'Uthmani Script'
    AND edition_identifier = 'uthmani'
    AND language = 'ar';

  IF source_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 canonical Tanzil Arabic content_sources row, found %. Aborting rather than backfilling with an ambiguous or missing source.',
      source_count;
  END IF;

  UPDATE public.surahs
  SET metadata_source_id = tanzil_source_id
  WHERE number = ANY (bootstrap_surahs)
    AND metadata_source_id IS NULL;
  GET DIAGNOSTICS surahs_updated = ROW_COUNT;

  UPDATE public.ayahs
  SET arabic_source_id = tanzil_source_id
  WHERE surah_number = ANY (bootstrap_surahs)
    AND arabic_source_id IS NULL;
  GET DIAGNOSTICS ayahs_updated = ROW_COUNT;

  IF surahs_updated <> 7 THEN
    RAISE EXCEPTION 'Expected to backfill exactly 7 surahs, backfilled %', surahs_updated;
  END IF;
  IF ayahs_updated <> 58 THEN
    RAISE EXCEPTION 'Expected to backfill exactly 58 ayahs, backfilled %', ayahs_updated;
  END IF;
END $$;

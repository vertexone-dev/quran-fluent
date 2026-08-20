-- Phase 2B: promotes the governed Pickthall content_sources row from
-- 'candidate' to 'verified'. Apply ONLY after 20260820170000_8ec39fad-aa9e-4f59-a5fb-4f5da8c6a1ba.sql
-- and 20260820180000_e471a844-ae75-4705-b463-eba0bb8ef944.sql have both been applied to the live
-- database and their results have been manually reviewed. Deliberately kept
-- separate from the import migration rather than bundled, per the
-- requirement that verification_status only flips after post-import
-- integrity checks pass.
--
-- Re-checks the gates itself, inside the migration, before flipping the
-- flag — so this fails loudly rather than promoting an incomplete or
-- corrupted dataset even if run out of order or against unexpected state.

DO $$
DECLARE
  v_source_id uuid;
  v_current_status text;
  v_translation_count integer;
  v_surah_count integer;
  v_blank_count integer;
  v_affected integer;
BEGIN
  SELECT id, verification_status INTO STRICT v_source_id, v_current_status
  FROM public.content_sources
  WHERE content_type = 'translation'
    AND provider_name = 'Project Gutenberg'
    AND edition_identifier = 'pickthall-gutenberg-16955'
    AND language = 'en';

  IF v_current_status <> 'candidate' THEN
    RAISE EXCEPTION 'Expected source % to be in status ''candidate'' before promotion, found ''%''. Not promoting.', v_source_id, v_current_status;
  END IF;

  SELECT count(*) INTO v_translation_count
  FROM public.translations WHERE source_id = v_source_id;
  IF v_translation_count <> 6236 THEN
    RAISE EXCEPTION 'Expected exactly 6236 translations for source %, found %. Not promoting to verified.', v_source_id, v_translation_count;
  END IF;

  SELECT count(DISTINCT surah_number) INTO v_surah_count
  FROM public.translations WHERE source_id = v_source_id;
  IF v_surah_count <> 114 THEN
    RAISE EXCEPTION 'Expected 114 distinct surahs for source %, found %. Not promoting to verified.', v_source_id, v_surah_count;
  END IF;

  SELECT count(*) INTO v_blank_count
  FROM public.translations WHERE source_id = v_source_id AND btrim(text) = '';
  IF v_blank_count <> 0 THEN
    RAISE EXCEPTION 'Found % blank translation rows for source %. Not promoting to verified.', v_blank_count, v_source_id;
  END IF;

  UPDATE public.content_sources
  SET verification_status = 'verified'
  WHERE id = v_source_id;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'Expected to promote exactly 1 content_sources row, affected %.', v_affected;
  END IF;
END $$;

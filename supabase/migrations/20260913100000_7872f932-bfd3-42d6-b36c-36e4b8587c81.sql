-- Phase 8C.2 — deprecate the empty legacy Kazimirski content_sources row.
--
-- APPROVED HUMAN DECISION (Phase 8C.2):
--   * Mark the empty legacy source edition_identifier='kazimirski-1869'
--     (the Phase 2A flat-table provenance stub) as
--     verification_status='deprecated'.
--   * PRESERVE the row permanently — for provenance, reproducibility and
--     audit history. It is NOT deleted.
--   * Append a concise successor reference to 'kazimirski-1869-segments-v1'
--     in its notes, without destroying the existing notes.
--   * Do NOT change the active source 'kazimirski-1869-segments-v1'.
--   * Do NOT promote canonical Arabic — 'uthmani' stays 'candidate'
--     (independent cross-verification is deferred to Phase 8D).
--
-- Full adjudication + read-only evidence: PHASE8C-CONTENT-SOURCE-GOVERNANCE.md
-- (original finding: PHASE8A-CONTENT-INVENTORY.md §8 / §10.4 / §11.5).
--
-- ============================================================================
-- SCOPE
-- ============================================================================
-- Touches exactly ONE row of public.content_sources, and only its
-- verification_status and notes columns. It never touches ayahs, surahs,
-- translations, translation_segments, translation_segment_ayahs, lessons, or
-- any other table. No Qur'an text, translation, segment or mapping is read
-- for modification or written. This is a one-row governance-metadata change.
--
-- ============================================================================
-- TRANSACTIONALITY
-- ============================================================================
-- Runs inside the migration runner's per-file transaction. The single DO
-- block below is itself atomic: any RAISE EXCEPTION aborts the whole
-- migration with no partial effect.
--
-- ============================================================================
-- TARGET IDENTITY  (stable predicates — never a bare copied UUID)
-- ============================================================================
--   content_type       = 'translation'
--   language           = 'fr'
--   edition_identifier = 'kazimirski-1869'
--   legacy_interim     = true
-- For reference only, NOT used as the match key: in the audited production
-- state this row's id is ed6028cb-a507-4bf4-9f74-4b71602bb4e4.
--
-- ============================================================================
-- PRECONDITIONS  (any failure => RAISE EXCEPTION, migration aborts)
-- ============================================================================
--   1. Exactly one row matches the identity predicates above.
--   2. Exactly one active successor row exists
--      (content_type='translation', language='fr',
--       edition_identifier='kazimirski-1869-segments-v1').
--   3. The legacy row's verification_status is 'candidate' — OR the migration
--      is already fully applied (status 'deprecated' AND the successor note
--      marker is already present), in which case this is a safe no-op.
--      Any other status ('verified' / 'disputed', or 'deprecated' WITHOUT the
--      marker) aborts with a clear error rather than guessing.
--   4. The legacy row has ZERO referencing rows from EVERY foreign key that
--      points at public.content_sources. The set of such FKs is discovered
--      from the catalog at run time, so any FK added in a later migration is
--      covered automatically. Known FKs today:
--        ayahs.arabic_source_id, surahs.metadata_source_id,
--        translations.source_id, translation_segments.source_id,
--        lessons.content_source_id.
--
-- ============================================================================
-- EFFECT  (first application only)
-- ============================================================================
--   verification_status : 'candidate' -> 'deprecated'
--   notes               : existing text preserved verbatim; one single-line
--                         successor reference appended after a
--                         "\n\n[Phase 8C: " marker.
--   Exactly 1 row affected.
--   No timestamp column is set: public.content_sources has no updated_at
--   column and no updated_at trigger — that is the established convention for
--   this table (contrast public.translations, which does).
--
-- ============================================================================
-- IDEMPOTENCY
-- ============================================================================
-- Re-running against an already-deprecated row that already carries the
-- successor note makes NO change and raises a NOTICE (safe no-op).
--
-- ============================================================================
-- ROLLBACK  (one statement — restores ONLY governance metadata, no content;
--            do NOT run as part of normal operation)
-- ============================================================================
--   UPDATE public.content_sources
--   SET verification_status = 'candidate',
--       notes = left(notes, position(E'\n\n[Phase 8C: ' in notes) - 1)
--   WHERE content_type = 'translation'
--     AND language = 'fr'
--     AND edition_identifier = 'kazimirski-1869'
--     AND legacy_interim = true
--     AND position(E'\n\n[Phase 8C: ' in coalesce(notes, '')) > 0;
-- ============================================================================

DO $$
DECLARE
  v_legacy_id       uuid;
  v_legacy_status   text;
  v_legacy_notes    text;
  v_match_count     integer;
  v_successor_count integer;
  v_ref_count       integer;
  v_affected        integer;
  v_note_marker     constant text := E'\n\n[Phase 8C: ';
  -- Single-line note (no embedded newlines after the leading marker), so the
  -- documented one-statement rollback can slice it off cleanly.
  v_successor_note  constant text := E'\n\n[Phase 8C: 2026-09-03] Deprecated (verification_status candidate -> deprecated). Superseded by the active certified source edition_identifier=''kazimirski-1869-segments-v1'' (segment-based model: translation_segments / translation_segment_ayahs). This empty Phase 2A flat-table provenance row is retained permanently for provenance, reproducibility and audit history and is NOT deleted. No child content (ayahs / surahs / translations / translation_segments / translation_segment_ayahs / lessons) was modified by this change.';
  r RECORD;
BEGIN
  -- Precondition 1: exactly one legacy row on the stable identity predicates.
  SELECT count(*) INTO v_match_count
  FROM public.content_sources
  WHERE content_type = 'translation'
    AND language = 'fr'
    AND edition_identifier = 'kazimirski-1869'
    AND legacy_interim = true;

  IF v_match_count = 0 THEN
    RAISE EXCEPTION 'Phase 8C.2 precondition 1 failed: no public.content_sources row matches (content_type=translation, language=fr, edition_identifier=kazimirski-1869, legacy_interim=true). Refusing to proceed.';
  ELSIF v_match_count > 1 THEN
    RAISE EXCEPTION 'Phase 8C.2 precondition 1 failed: expected exactly one legacy kazimirski-1869 row, found %. Refusing to deprecate an ambiguous set.', v_match_count;
  END IF;

  SELECT id, verification_status, coalesce(notes, '')
    INTO v_legacy_id, v_legacy_status, v_legacy_notes
  FROM public.content_sources
  WHERE content_type = 'translation'
    AND language = 'fr'
    AND edition_identifier = 'kazimirski-1869'
    AND legacy_interim = true;

  -- Precondition 2: exactly one active successor.
  SELECT count(*) INTO v_successor_count
  FROM public.content_sources
  WHERE content_type = 'translation'
    AND language = 'fr'
    AND edition_identifier = 'kazimirski-1869-segments-v1';

  IF v_successor_count <> 1 THEN
    RAISE EXCEPTION 'Phase 8C.2 precondition 2 failed: expected exactly one active successor row (edition_identifier=kazimirski-1869-segments-v1), found %. Refusing to deprecate the legacy row without a confirmed successor.', v_successor_count;
  END IF;

  -- Precondition 3: status is candidate, OR already fully applied (no-op).
  IF v_legacy_status = 'deprecated' AND position(v_note_marker in v_legacy_notes) > 0 THEN
    RAISE NOTICE 'Phase 8C.2 no-op: legacy source % is already deprecated and already carries the successor note. No change made.', v_legacy_id;
    RETURN;
  END IF;

  IF v_legacy_status <> 'candidate' THEN
    RAISE EXCEPTION 'Phase 8C.2 precondition 3 failed: expected legacy source % to be verification_status=''candidate'' (or already fully deprecated with the successor note), found ''%''. Refusing to proceed against an unexpected state.', v_legacy_id, v_legacy_status;
  END IF;

  -- Precondition 4: zero references from EVERY foreign key that targets
  -- public.content_sources (discovered from the catalog, so a future FK is
  -- covered without editing this migration). All such FKs are single-column
  -- uuid columns today; a composite FK would surface here too and abort.
  FOR r IN
    SELECT (con.conrelid::regclass)::text AS child_table,
           att.attname                    AS child_col
    FROM pg_constraint con
    JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = k.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.content_sources'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.child_table, r.child_col)
      INTO v_ref_count
      USING v_legacy_id;
    IF v_ref_count <> 0 THEN
      RAISE EXCEPTION 'Phase 8C.2 precondition 4 failed: legacy source % is still referenced by %.% (% row(s)). Refusing to deprecate a source that still owns content.', v_legacy_id, r.child_table, r.child_col, v_ref_count;
    END IF;
  END LOOP;

  -- Effect: exactly one row, exactly two columns. The extra
  -- "verification_status = 'candidate'" guard in the WHERE makes a concurrent
  -- or repeat application affect zero rows rather than re-appending the note.
  UPDATE public.content_sources
  SET verification_status = 'deprecated',
      notes = coalesce(notes, '') || v_successor_note
  WHERE id = v_legacy_id
    AND verification_status = 'candidate';

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'Phase 8C.2 failed: expected to update exactly 1 content_sources row, affected %. Aborting — the transaction will roll back.', v_affected;
  END IF;

  RAISE NOTICE 'Phase 8C.2: public.content_sources % (edition_identifier=kazimirski-1869) marked deprecated; successor note appended; existing notes preserved verbatim; no child content touched.', v_legacy_id;
END $$;

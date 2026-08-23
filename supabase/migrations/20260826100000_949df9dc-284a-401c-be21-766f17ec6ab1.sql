-- Phase 2 / Sub-phase 2.6: Placement -> Curriculum integration. Adds a
-- single, additive, nullable lesson_id FK to learning_path_steps -- the
-- previously-deferred linkage between the abstract placement path
-- (step_key: 'alphabet', 'harakat', ...) and real curriculum content
-- (lessons).
--
-- Design decision (Option A from the sub-phase's own evaluation): a single
-- lesson_id per step row, not a new module_id column and not a new table.
-- module_id is already reachable via lessons.module_id for any row that has
-- a lesson_id, so storing it again here would be redundant, unnormalized
-- data with no query this app actually needs. A separate user-curriculum-
-- assignment table was considered and rejected: user_lesson_progress
-- already tracks per-lesson completion (proven, tested, in production
-- since Sub-phase 2.2) -- this column's only job is "which real lesson is
-- the entry point for this abstract step," not a second progress tracker.
--
-- This column is deliberately populated for ONLY the 'alphabet' step
-- today. Every other step (harakat, connected_letters, reading,
-- vocabulary, roots, grammar, ayah_comprehension, surah_mastery) has zero
-- real curriculum behind it (Modules 3-8 are not yet authored) and stays
-- NULL -- an honest "no real lesson to link to yet," not a guessed one.
-- Application code (src/lib/curriculum.ts, src/lib/placement.ts) computes
-- and writes the alphabet step's lesson_id at learning-path save time by
-- reading real user_lesson_progress, never by a blind data backfill here.
--
-- Legacy compatibility: existing learning_path_steps rows (any user who
-- took placement before this sub-phase) get lesson_id = NULL from this
-- ALTER alone -- intentionally not backfilled by this migration, since a
-- blind step_key -> lesson_id guess for historical rows is exactly the
-- kind of silent repurposing this sub-phase's own instructions forbid.
-- Those rows pick up a real lesson_id the next time that user's path is
-- regenerated (a placement retake), through the same application code
-- path new users get today. Until then, the UI (PathTimeline) treats
-- lesson_id IS NULL as "no actionable link," preserving today's read-only
-- display for that row exactly as-is.
--
-- No schema change beyond this one additive column. No RLS change (the
-- existing learning_path_steps_own policy already covers every column on
-- the table). No row deleted, no row's step_key/status/progress touched.

DO $$
DECLARE
  v_column_exists integer;
BEGIN
  SELECT count(*) INTO v_column_exists
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'learning_path_steps' AND column_name = 'lesson_id';
  IF v_column_exists <> 0 THEN
    RAISE EXCEPTION 'Expected learning_path_steps.lesson_id to not already exist. Aborting.';
  END IF;
END $$;

ALTER TABLE public.learning_path_steps
  ADD COLUMN lesson_id uuid NULL REFERENCES public.lessons(id) ON DELETE SET NULL;

CREATE INDEX learning_path_steps_lesson_idx ON public.learning_path_steps (lesson_id);

DO $$
DECLARE
  v_column_nullable text;
  v_fk_exists integer;
  v_row_count_before integer;
  v_row_count_after integer;
BEGIN
  SELECT is_nullable INTO v_column_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'learning_path_steps' AND column_name = 'lesson_id';
  IF v_column_nullable <> 'YES' THEN
    RAISE EXCEPTION 'Expected learning_path_steps.lesson_id to be nullable, found is_nullable=%.', v_column_nullable;
  END IF;

  SELECT count(*) INTO v_fk_exists
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'public' AND tc.table_name = 'learning_path_steps'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'lesson_id';
  IF v_fk_exists = 0 THEN
    RAISE EXCEPTION 'Expected a foreign key constraint on learning_path_steps.lesson_id, found none.';
  END IF;

  -- No existing row was touched: every row's lesson_id is NULL immediately
  -- after this additive ALTER, and no row was deleted or re-inserted.
  SELECT count(*) INTO v_row_count_after FROM public.learning_path_steps;
  SELECT count(*) INTO v_row_count_before FROM public.learning_path_steps WHERE lesson_id IS NULL;
  IF v_row_count_before <> v_row_count_after THEN
    RAISE EXCEPTION 'Expected every existing learning_path_steps row to have lesson_id IS NULL immediately after this migration, found % of % non-null.',
      (v_row_count_after - v_row_count_before), v_row_count_after;
  END IF;

  RAISE NOTICE 'learning_path_steps.lesson_id added: nullable uuid FK to lessons, indexed, % existing rows all NULL.', v_row_count_after;
END $$;

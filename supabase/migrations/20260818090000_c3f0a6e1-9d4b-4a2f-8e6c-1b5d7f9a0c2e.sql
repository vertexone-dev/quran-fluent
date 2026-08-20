-- Migration 3: reconcile the live Lovable Cloud schema for bookmarks, notes,
-- and memorization_progress with the design approved for Migration 2.
--
-- Background: Migration 2 as written in this repository was never actually
-- applied verbatim. Lovable Cloud's own "reconciliation" step created these
-- three tables in a different shape (extra/renamed columns, surah-only FKs,
-- text status, over-broad grants). A read-only investigation confirmed all
-- three tables are currently EMPTY (0 rows), so this migration reshapes them
-- in place with ALTER TABLE rather than dropping and recreating anything.
-- No Qur'an reference data (surahs/ayahs) is touched.
--
-- Every structural change below is guarded (IF EXISTS / conditional DO
-- blocks / dynamic constraint lookup) so this migration is safe to run even
-- if the live shape differs slightly from what the read-only inspection
-- reported, and safe to re-run if it's ever partially applied.

-- ============================================================================
-- BOOKMARKS
-- ============================================================================

-- Drop the existing surah-only FK (name not assumed — found dynamically by
-- what it references, since Lovable's auto-generated name is unknown).
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.bookmarks'::regclass
    AND contype = 'f'
    AND confrelid = 'public.surahs'::regclass;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.bookmarks DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- The Lovable-added bookmarks.updated_at column had its own maintenance
-- trigger, analogous to notes_updated_at / memorization_progress_updated_at.
-- It must be dropped before the column it writes to, otherwise a later
-- UPDATE would fire a trigger that references a column that no longer
-- exists. IF EXISTS makes this safe whether or not it was already dropped
-- manually before the rest of this migration ran.
DROP TRIGGER IF EXISTS bookmarks_updated_at ON public.bookmarks;

-- Drop the Lovable-added extras. Safe: table confirmed empty.
ALTER TABLE public.bookmarks DROP COLUMN IF EXISTS label;
ALTER TABLE public.bookmarks DROP COLUMN IF EXISTS color;
ALTER TABLE public.bookmarks DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.bookmarks ALTER COLUMN ayah_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookmarks'::regclass
      AND conname = 'bookmarks_surah_ayah_fkey'
  ) THEN
    ALTER TABLE public.bookmarks
      ADD CONSTRAINT bookmarks_surah_ayah_fkey
      FOREIGN KEY (surah_number, ayah_number)
      REFERENCES public.ayahs (surah_number, ayah_number)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- user_id -> auth.users(id) ON DELETE CASCADE, the PK, and the
-- UNIQUE(user_id, surah_number, ayah_number) constraint were confirmed
-- already correct — left untouched.

REVOKE ALL ON public.bookmarks FROM anon;
REVOKE ALL ON public.bookmarks FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;


-- ============================================================================
-- NOTES
-- ============================================================================

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.notes'::regclass
    AND contype = 'f'
    AND confrelid = 'public.surahs'::regclass;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notes DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS content text;

-- Table confirmed empty, so no backfill from title/body is needed before
-- dropping them.
ALTER TABLE public.notes DROP COLUMN IF EXISTS title;
ALTER TABLE public.notes DROP COLUMN IF EXISTS body;

ALTER TABLE public.notes ALTER COLUMN content SET NOT NULL;
ALTER TABLE public.notes ALTER COLUMN surah_number SET NOT NULL;
ALTER TABLE public.notes ALTER COLUMN ayah_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notes'::regclass
      AND conname = 'notes_content_length_check'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_content_length_check
      CHECK (char_length(content) BETWEEN 1 AND 2000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notes'::regclass
      AND conname = 'notes_surah_ayah_fkey'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_surah_ayah_fkey
      FOREIGN KEY (surah_number, ayah_number)
      REFERENCES public.ayahs (surah_number, ayah_number)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- notes_updated_at trigger and user_id CASCADE FK were confirmed already
-- present/correct — left untouched.

REVOKE ALL ON public.notes FROM anon;
REVOKE ALL ON public.notes FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;


-- ============================================================================
-- MEMORIZATION_PROGRESS
-- ============================================================================

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.memorization_progress'::regclass
    AND contype = 'f'
    AND confrelid = 'public.surahs'::regclass;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.memorization_progress DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- Create the approved enum type if it doesn't already exist. If a type
-- named public.memorization_status already exists (e.g. from an earlier,
-- never-applied attempt, or something Lovable created independently), do
-- NOT silently reuse it — validate its labels match exactly what's
-- approved, in the same order, and abort loudly otherwise. Reusing a
-- same-named enum with different/extra labels would silently corrupt the
-- status domain instead of reconciling it.
DO $$
DECLARE
  actual_labels text[];
  expected_labels text[] := ARRAY['not_started', 'learning', 'memorized'];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'memorization_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.memorization_status AS ENUM ('not_started', 'learning', 'memorized');
  ELSE
    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
      INTO actual_labels
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'memorization_status' AND n.nspname = 'public';

    IF actual_labels IS DISTINCT FROM expected_labels THEN
      RAISE EXCEPTION
        'public.memorization_status already exists with labels % but % were expected — resolve manually before re-running this migration.',
        actual_labels, expected_labels;
    END IF;
  END IF;
END $$;

-- Table confirmed empty, so converting text -> enum in place is safe
-- regardless of what values a prior CHECK (if any) allowed.
ALTER TABLE public.memorization_progress ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.memorization_progress
  ALTER COLUMN status TYPE public.memorization_status
  USING status::public.memorization_status;
ALTER TABLE public.memorization_progress ALTER COLUMN status SET DEFAULT 'learning';
ALTER TABLE public.memorization_progress ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.memorization_progress ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.memorization_progress ALTER COLUMN started_at SET DEFAULT now();
UPDATE public.memorization_progress SET started_at = now() WHERE started_at IS NULL;
ALTER TABLE public.memorization_progress ALTER COLUMN started_at SET NOT NULL;

ALTER TABLE public.memorization_progress ADD COLUMN IF NOT EXISTS memorized_at timestamptz;

ALTER TABLE public.memorization_progress DROP COLUMN IF EXISTS confidence;
ALTER TABLE public.memorization_progress DROP COLUMN IF EXISTS review_count;
ALTER TABLE public.memorization_progress DROP COLUMN IF EXISTS last_reviewed_at;

ALTER TABLE public.memorization_progress ALTER COLUMN surah_number SET NOT NULL;
ALTER TABLE public.memorization_progress ALTER COLUMN ayah_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.memorization_progress'::regclass
      AND conname = 'memorization_progress_surah_ayah_fkey'
  ) THEN
    ALTER TABLE public.memorization_progress
      ADD CONSTRAINT memorization_progress_surah_ayah_fkey
      FOREIGN KEY (surah_number, ayah_number)
      REFERENCES public.ayahs (surah_number, ayah_number)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- The one-way integrity rule, exactly as approved for Migration 2 and
-- explicitly confirmed unchanged since: status = 'memorized' requires
-- memorized_at to be set; leaving 'memorized' does not force memorized_at
-- back to NULL (that stays an application-level decision).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.memorization_progress'::regclass
      AND conname = 'memorization_progress_memorized_at_check'
  ) THEN
    ALTER TABLE public.memorization_progress
      ADD CONSTRAINT memorization_progress_memorized_at_check
      CHECK (status != 'memorized' OR memorized_at IS NOT NULL);
  END IF;
END $$;

-- memorization_progress_updated_at trigger and user_id CASCADE FK were
-- confirmed already present/correct — left untouched.

REVOKE ALL ON public.memorization_progress FROM anon;
REVOKE ALL ON public.memorization_progress FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memorization_progress TO authenticated;
GRANT ALL ON public.memorization_progress TO service_role;

-- RLS: left untouched throughout this migration. RLS was confirmed already
-- enabled on all three tables with correct auth.uid() = user_id policies
-- for USING and WITH CHECK — no ALTER TABLE ... ROW LEVEL SECURITY, no
-- CREATE/DROP POLICY statements appear anywhere above.

-- V1 core learner features: bookmarks, private notes, and memorization
-- (Hifz) progress, all keyed to (surah_number, ayah_number) against the
-- ayahs reference table added alongside this migration.
--
-- Memorization scheduling intentionally does NOT duplicate the existing
-- spaced-repetition engine: when an ayah is marked memorized, a matching
-- review_items row (item_type = 'ayah') is upserted by the application so
-- due-for-review scheduling stays driven by the one existing SM-2-style
-- engine in src/lib/study.ts (recordPracticeAttempt). memorization_progress
-- here only tracks the Hifz-specific status/timestamps that review_items
-- doesn't capture.
--
-- The (surah_number, ayah_number) foreign keys below use ON DELETE RESTRICT,
-- not CASCADE: this reference data may be replaced or re-curated as the
-- Qur'an dataset grows in a later phase, and that must never be able to
-- silently delete a learner's bookmarks, notes or memorization history as a
-- side effect. A row deletion attempt on public.ayahs that would orphan any
-- of these tables fails loudly instead. user_id's FK to auth.users stays
-- ON DELETE CASCADE — account deletion removing a user's own data is the
-- correct, expected behavior and is unchanged from the original design.
--
-- memorization_progress also enforces status/memorized_at consistency via a
-- CHECK: status = 'memorized' requires memorized_at to be set. This is the
-- one-directional rule only (not also forcing memorized_at back to NULL
-- when status leaves 'memorized') — re-learning a previously memorized ayah
-- shouldn't be forced to destroy the historical "first memorized on" date
-- at the database level; that's an application-level decision, not a data
-- integrity one.

CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surah_number integer NOT NULL,
  ayah_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, surah_number, ayah_number),
  FOREIGN KEY (surah_number, ayah_number) REFERENCES public.ayahs (surah_number, ayah_number) ON DELETE RESTRICT
);
CREATE INDEX bookmarks_user_idx ON public.bookmarks (user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookmarks_own ON public.bookmarks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surah_number integer NOT NULL,
  ayah_number integer NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (surah_number, ayah_number) REFERENCES public.ayahs (surah_number, ayah_number) ON DELETE RESTRICT
);
CREATE INDEX notes_user_updated_idx ON public.notes (user_id, updated_at DESC);
CREATE INDEX notes_user_ayah_idx ON public.notes (user_id, surah_number, ayah_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_own ON public.notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TYPE public.memorization_status AS ENUM ('not_started', 'learning', 'memorized');

CREATE TABLE public.memorization_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surah_number integer NOT NULL,
  ayah_number integer NOT NULL,
  status public.memorization_status NOT NULL DEFAULT 'learning',
  started_at timestamptz NOT NULL DEFAULT now(),
  memorized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, surah_number, ayah_number),
  FOREIGN KEY (surah_number, ayah_number) REFERENCES public.ayahs (surah_number, ayah_number) ON DELETE RESTRICT,
  CONSTRAINT memorization_progress_memorized_at_check
    CHECK (status != 'memorized' OR memorized_at IS NOT NULL)
);
CREATE INDEX memorization_progress_user_status_idx ON public.memorization_progress (user_id, status);
CREATE INDEX memorization_progress_user_surah_idx ON public.memorization_progress (user_id, surah_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memorization_progress TO authenticated;
GRANT ALL ON public.memorization_progress TO service_role;
ALTER TABLE public.memorization_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY memorization_progress_own ON public.memorization_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER memorization_progress_updated_at BEFORE UPDATE ON public.memorization_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

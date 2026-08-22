-- Phase 2 / Sub-phase 2.1: Curriculum content schema.
--
-- Purely additive: creates 9 new tables, touches no existing table, column,
-- row, function, or policy. No lesson content is authored here — schema
-- only. Structural seed data (course/levels/modules + one schema-validation
-- placeholder lesson) is a separate migration (20260822110000_...).
--
-- Hierarchy: courses -> levels -> modules -> lessons -> lesson_sections /
-- lesson_exercises. User progress is tracked separately in
-- user_lesson_progress / user_exercise_attempts, kept distinct from the
-- existing per-user learning_paths / learning_path_steps (which represent a
-- learner's personalized entry point and coarse stage tracking, confirmed
-- by their existing UNIQUE(user_id) / (path_id, step_key) shape — this
-- migration does not touch either table).
--
-- Conventions followed, matched against the existing migration history:
--   - snake_case, plural table names; id uuid PRIMARY KEY DEFAULT gen_random_uuid()
--   - created_at/updated_at timestamptz NOT NULL DEFAULT now() on
--     mutable-state tables; created_at only on append-only log tables
--     (user_exercise_attempts, matching practice_attempts/study_sessions)
--   - reuses the existing public.update_updated_at_column() trigger
--     function rather than redefining it
--   - TEXT + CHECK for row-level type/status enumerations (matching the
--     newer content_sources/translations/review_items convention), not
--     CREATE TYPE ... AS ENUM (the older convention from the first
--     migration) -- avoids the ALTER TYPE ... ADD VALUE friction for a
--     schema still expected to gain content_type/exercise_type values
--   - RLS: explicit GRANTs paired with ENABLE ROW LEVEL SECURITY, matching
--     every existing table; global content tables get GRANT SELECT TO
--     authenticated, anon with a USING (true) read policy and NO
--     write grants to non-service roles at all (matches
--     surahs/ayahs/content_sources/translations exactly); user-owned
--     tables get GRANT ALL TO authenticated with a single FOR ALL policy
--     keyed on auth.uid() = user_id (matches every user-owned table)
--   - IF NOT EXISTS used only on indexes, matching the one prior migration
--     that used it (20260817232356) -- never on CREATE TABLE anywhere in
--     this history, so not used here either
--   - ON DELETE CASCADE for user_id -> auth.users(id) (matches all
--     existing user tables) and within the content hierarchy itself
--     (courses -> levels -> modules -> lessons -> sections/exercises,
--     admin-managed, cascade avoids orphaned content rows)
--   - ON DELETE RESTRICT for lesson_sections' optional Qur'an reference
--     (surah_number, ayah_number) -> ayahs, matching translations'
--     existing choice to protect canonical Qur'an data from cascade deletes
--   - ON DELETE SET NULL for user_exercise_attempts.exercise_id ->
--     lesson_exercises(id), matching practice_attempts.item_id ->
--     review_items(id)'s existing precedent of preserving a user's attempt
--     history even if the referenced content is later removed/edited
--   - ON DELETE CASCADE for user_lesson_progress.lesson_id -> lessons(id):
--     progress against a lesson that no longer exists is not meaningful
--     state to preserve (unlike an attempt log), matching
--     learning_path_steps cascading from learning_paths

-- =========================================================================
-- 1. courses -- global curriculum definition. One row today ("Qur'anic
--    Arabic Foundations"), modeled as a table rather than hard-coded
--    because content_sources/translations were built the same way ahead of
--    French even before French existed -- not over-engineering, matching
--    established practice in this schema.
-- =========================================================================

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_en text NOT NULL,
  title_fr text NOT NULL,
  description_en text,
  description_fr text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO authenticated, anon;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses_read_all" ON public.courses FOR SELECT TO authenticated, anon USING (true);
CREATE TRIGGER courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 2. levels -- ordered levels within a course.
-- =========================================================================

CREATE TABLE public.levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  number integer NOT NULL CHECK (number > 0),
  slug text NOT NULL,
  title_en text NOT NULL,
  title_fr text NOT NULL,
  goal_en text,
  goal_fr text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, number),
  UNIQUE (course_id, slug),
  UNIQUE (course_id, order_index)
);
CREATE INDEX levels_course_order_idx ON public.levels (course_id, order_index);
GRANT SELECT ON public.levels TO authenticated, anon;
GRANT ALL ON public.levels TO service_role;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "levels_read_all" ON public.levels FOR SELECT TO authenticated, anon USING (true);
CREATE TRIGGER levels_updated_at BEFORE UPDATE ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 3. modules -- ordered modules within a level.
-- =========================================================================

CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title_en text NOT NULL,
  title_fr text NOT NULL,
  goal_en text,
  goal_fr text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level_id, slug),
  UNIQUE (level_id, order_index)
);
CREATE INDEX modules_level_order_idx ON public.modules (level_id, order_index);
GRANT SELECT ON public.modules TO authenticated, anon;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_read_all" ON public.modules FOR SELECT TO authenticated, anon USING (true);
CREATE TRIGGER modules_updated_at BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 4. lessons -- ordered lessons within a module.
--
--    content_source_id is nullable and unused by this migration (no lesson
--    cites a source yet); it reuses content_sources' existing provenance
--    pattern for a future grammar-source citation without a schema change.
--    content_sources.content_type's CHECK ('arabic_text','translation') is
--    intentionally left unmodified here -- widening it to accommodate a
--    hypothetical 'curriculum' content_type is deferred to whichever future
--    sub-phase actually cites one, per this phase's own scope (no lesson
--    explanations are authored yet).
-- =========================================================================

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title_en text NOT NULL,
  title_fr text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 5 CHECK (estimated_minutes > 0),
  content_source_id uuid REFERENCES public.content_sources(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, slug),
  UNIQUE (module_id, order_index)
);
CREATE INDEX lessons_module_order_idx ON public.lessons (module_id, order_index);
GRANT SELECT ON public.lessons TO authenticated, anon;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons_read_all" ON public.lessons FOR SELECT TO authenticated, anon USING (true);
CREATE TRIGGER lessons_updated_at BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 5. lesson_sections -- ordered, typed display content blocks within a
--    lesson. Hybrid model deliberately chosen over a bare content_type +
--    unvalidated JSONB dump: typed columns (body_en/body_fr/arabic_text/
--    surah_number/ayah_number) cover every Level 1-required block shape
--    with real, checkable constraints; `metadata` jsonb is kept narrow --
--    small, genuinely variable extras only (never a substitute for a real
--    column). A `quran_example` block's Qur'an reference is a real FK into
--    ayahs, not free text: this is the structural enforcement of "never
--    invent or duplicate canonical Qur'an text" -- a section can point at
--    real verified text, but cannot contain invented Arabic.
--
--    content_type is intentionally scoped to what Level 1 needs plus the
--    near-term Level 3+ types already designed (quran_example, rule,
--    summary) so this table doesn't need a widening migration the moment
--    Level 2 content is authored; no speculative type beyond that set.
-- =========================================================================

CREATE TABLE public.lesson_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  content_type text NOT NULL CHECK (content_type IN
    ('explanation', 'example', 'arabic_text', 'vocabulary', 'rule', 'tip', 'quran_example', 'summary')),
  body_en text,
  body_fr text,
  arabic_text text,
  surah_number integer,
  ayah_number integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, order_index),
  FOREIGN KEY (surah_number, ayah_number)
    REFERENCES public.ayahs (surah_number, ayah_number) ON DELETE RESTRICT,
  -- A Qur'an reference is only meaningful (and only allowed) on a
  -- quran_example block; every other block type must leave it NULL, so a
  -- stray reference can never silently exist on the wrong content_type.
  CHECK (
    (content_type = 'quran_example' AND surah_number IS NOT NULL AND ayah_number IS NOT NULL)
    OR (content_type <> 'quran_example' AND surah_number IS NULL AND ayah_number IS NULL)
  )
);
CREATE INDEX lesson_sections_lesson_order_idx ON public.lesson_sections (lesson_id, order_index);
GRANT SELECT ON public.lesson_sections TO authenticated, anon;
GRANT ALL ON public.lesson_sections TO service_role;
ALTER TABLE public.lesson_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_sections_read_all" ON public.lesson_sections FOR SELECT TO authenticated, anon USING (true);
CREATE TRIGGER lesson_sections_updated_at BEFORE UPDATE ON public.lesson_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 6. lesson_exercises -- graded, interactive blocks within a lesson. Kept
--    as a separate table from lesson_sections (not a content_type value on
--    it) because exercises have a genuinely different lifecycle: they are
--    attempted and graded (user_exercise_attempts references them, and
--    review_item_type controls what they seed into the existing
--    review_items table), where sections are pure display with no
--    attempt-tracking at all -- the same content-vs-interaction split
--    already proven by translations vs. review_items elsewhere in this
--    schema.
--
--    exercise_type is scoped to Level 1-compatible types only, per this
--    phase's explicit instruction not to add speculative advanced types.
--    payload's shape is documented per exercise_type below (not a
--    free-for-all):
--      multiple_choice:      { choices: string[], correctIndex: number }
--      true_false:           { correctAnswer: boolean }
--      letter_recognition:   { choices: string[], correctIndex: number }
--      vowel_recognition:    { choices: string[], correctIndex: number }
--      matching:             { pairs: { left: string, right: string }[] }
--      reading_check:        { choices: string[], correctIndex: number }
--    explanation_en/explanation_fr hold the optional post-answer feedback
--    text; a Qur'an reference (surah_number/ayah_number), when relevant,
--    follows the exact same real-FK-only rule as lesson_sections.
-- =========================================================================

CREATE TABLE public.lesson_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.lesson_sections(id) ON DELETE SET NULL,
  order_index integer NOT NULL DEFAULT 0,
  exercise_type text NOT NULL CHECK (exercise_type IN
    ('multiple_choice', 'true_false', 'letter_recognition', 'vowel_recognition', 'matching', 'reading_check')),
  prompt_en text NOT NULL,
  prompt_fr text NOT NULL,
  payload jsonb NOT NULL,
  explanation_en text,
  explanation_fr text,
  surah_number integer,
  ayah_number integer,
  review_item_type text NOT NULL CHECK (review_item_type IN ('letter', 'word', 'concept', 'ayah', 'root')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, order_index),
  FOREIGN KEY (surah_number, ayah_number)
    REFERENCES public.ayahs (surah_number, ayah_number) ON DELETE RESTRICT,
  CHECK (
    (surah_number IS NULL AND ayah_number IS NULL)
    OR (surah_number IS NOT NULL AND ayah_number IS NOT NULL)
  )
);
CREATE INDEX lesson_exercises_lesson_order_idx ON public.lesson_exercises (lesson_id, order_index);
GRANT SELECT ON public.lesson_exercises TO authenticated, anon;
GRANT ALL ON public.lesson_exercises TO service_role;
ALTER TABLE public.lesson_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_exercises_read_all" ON public.lesson_exercises FOR SELECT TO authenticated, anon USING (true);
CREATE TRIGGER lesson_exercises_updated_at BEFORE UPDATE ON public.lesson_exercises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 7. lesson_vocabulary_words -- thin bridge linking a lesson to existing
--    word_frequency rows, reusing that table directly rather than
--    inventing a parallel vocabulary concept.
-- =========================================================================

CREATE TABLE public.lesson_vocabulary_words (
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  word_id uuid NOT NULL REFERENCES public.word_frequency(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  PRIMARY KEY (lesson_id, word_id)
);
CREATE INDEX lesson_vocabulary_words_lesson_idx ON public.lesson_vocabulary_words (lesson_id, order_index);
GRANT SELECT ON public.lesson_vocabulary_words TO authenticated, anon;
GRANT ALL ON public.lesson_vocabulary_words TO service_role;
ALTER TABLE public.lesson_vocabulary_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_vocabulary_words_read_all" ON public.lesson_vocabulary_words
  FOR SELECT TO authenticated, anon USING (true);

-- =========================================================================
-- 8. user_lesson_progress -- per-user lesson lifecycle state. CHECK
--    constraint prevents contradictory state/timestamp combinations
--    (e.g. "completed" with no started_at). Idempotent via
--    UNIQUE(user_id, lesson_id) for upsert(..., onConflict:
--    "user_id,lesson_id"), matching user_vocabulary's existing
--    UNIQUE(user_id, word_id) upsert pattern.
-- =========================================================================

CREATE TABLE public.user_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_section_index integer NOT NULL DEFAULT 0 CHECK (last_section_index >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id),
  CHECK (
    (status = 'not_started' AND started_at IS NULL AND completed_at IS NULL)
    OR (status = 'in_progress' AND started_at IS NOT NULL AND completed_at IS NULL)
    OR (status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND completed_at >= started_at)
  )
);
CREATE INDEX user_lesson_progress_user_idx ON public.user_lesson_progress (user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lesson_progress TO authenticated;
GRANT ALL ON public.user_lesson_progress TO service_role;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_lesson_progress_own ON public.user_lesson_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_lesson_progress_updated_at BEFORE UPDATE ON public.user_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 9. user_exercise_attempts -- append-only per-attempt log, mirroring
--    practice_attempts' existing shape exactly (same SET NULL precedent
--    for preserving history after the referenced content changes).
-- =========================================================================

CREATE TABLE public.user_exercise_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.lesson_exercises(id) ON DELETE SET NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  correct boolean NOT NULL,
  response_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_exercise_attempts_user_lesson_idx ON public.user_exercise_attempts (user_id, lesson_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_exercise_attempts TO authenticated;
GRANT ALL ON public.user_exercise_attempts TO service_role;
ALTER TABLE public.user_exercise_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_exercise_attempts_own ON public.user_exercise_attempts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Level 3 (Roots & Word Patterns) Batch 2 (Gate A+B): "roots-capstone" --
-- the third and final Level 3 module, per the approved Level 3 design.
-- Continues directly from Batch 1 (arabic-roots-intro, word-patterns),
-- which is Level 3 Batch 1 production-complete and untouched by this
-- migration.
--
-- ARCHITECTURE: zero schema changes, zero RLS changes, zero new
-- exercise types, zero new review-item types, zero application-code
-- changes. findCurriculumEntryPoint and the STEP_LEVEL_SLUGS 'roots'
-- mapping (added in Batch 1) already generalize to any module count
-- under a level_id -- no code change is needed for this third module.
--
-- CONTENT: a single pure-synthesis lesson reusing ayah 1:2 (already
-- shown as a full quran_example section three times before, in
-- reading-al-fatiha-verses-1-3, dagger-alif, and reading-with-
-- harakat -- reused again here deliberately, per the explicit
-- instruction to prefer already-verified examples over new ones).
-- This one ayah contains THREE already-taught roots in a single
-- sentence, confirmed by direct query before authoring:
--   'a-l-h (rank 1, Allah):      embedded in li-llahi
--   r-b-b  (rank 4, Rabb):        the exact word rabbi, no prefix
--   '-l-m  (rank 5, 'Aalameen):   embedded in al-'aalameen
-- (root letters transliterated in this comment only; the migration
-- itself never hand-types Arabic -- every string is either an exact
-- FK reference or copied verbatim from a verified query result).
--
-- The one unavoidable new word is "al-hamdu" ("praise"), which does
-- NOT share a root with any already-taught word. Governed exactly
-- like "a'udhu" in Level 2 Batch 3's capstone: explained inline in
-- the lesson's own prose (not left unglossed), but NOT added to
-- word_frequency, NOT used in any review-item-generating exercise,
-- and NOT present in any exercise's selectable answer choices. It
-- legitimately appears in the reading_check's full-ayah prompt (which
-- tests sentence reading fluency, not word recall) -- the same
-- distinction already established and tested for a'udhu.
--
-- REVIEW ITEMS: deliberately ZERO. No matching exercise anywhere in
-- this module -- ar-Rabb and al-'Aalameen each have only ONE known
-- word built from their root among the 20 taught words (unlike the
-- three true root-*families* taught in Batch 1), so this lesson's
-- honest pedagogical job is applying existing root awareness to a
-- new sentence, not teaching a new reviewable root-family fact --
-- exactly the case the Level 3 design explicitly anticipated:
-- "if the final module is primarily synthesis and does not genuinely
-- introduce new reviewable roots, zero new review items is acceptable
-- and may be preferable."
--
-- QUR'AN INTEGRITY: the quran_example section references
-- (surah_number, ayah_number) = (1, 2) against the existing ayahs
-- table via FK only -- no Qur'anic Arabic duplicated into this
-- migration's own content.
--
-- CONTENT GOVERNANCE: RED ITEMS: 0. YELLOW ITEMS: 0. "al-hamdu" is
-- deliberately excluded from word_frequency and from every exercise
-- payload/choice list containing Arabic answer text, exactly
-- mirroring the a'udhu precedent.

DO $$
DECLARE
  v_level_id uuid;
  v_existing_modules integer;
  v_existing_lessons integer;
  v_ayah_exists integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'roots-and-word-patterns';
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Expected the roots-and-word-patterns level to already exist. Aborting.';
  END IF;

  SELECT count(*) INTO v_existing_modules FROM public.modules
  WHERE level_id = v_level_id AND slug = 'roots-capstone';
  IF v_existing_modules <> 0 THEN
    RAISE EXCEPTION 'Expected zero roots-capstone module to already exist, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_modules FROM public.modules WHERE level_id = v_level_id;
  IF v_existing_modules <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 existing Level 3 modules (Batch 1) before this migration, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_lessons FROM public.lessons WHERE slug = 'reading-with-root-awareness';
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected the reading-with-root-awareness lesson slug not to already exist, found %.', v_existing_lessons;
  END IF;

  SELECT count(*) INTO v_ayah_exists FROM public.ayahs WHERE surah_number = 1 AND ayah_number = 2;
  IF v_ayah_exists <> 1 THEN
    RAISE EXCEPTION 'Expected ayah 1:2 to already exist in ayahs, found %.', v_ayah_exists;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 4 AND root IS NOT NULL) THEN
    RAISE EXCEPTION 'Expected rank 4 (Rabb) to already have root populated.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 5 AND root IS NOT NULL) THEN
    RAISE EXCEPTION 'Expected rank 5 (Aalameen) to already have root populated.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 1 AND root IS NOT NULL) THEN
    RAISE EXCEPTION 'Expected rank 1 (Allah) to already have root populated.';
  END IF;
END $$;

-- =========================================================================
-- 1. Module.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'roots-capstone', 'Roots Capstone', 'Aboutissement des racines', 2
FROM public.levels WHERE slug = 'roots-and-word-patterns';

-- =========================================================================
-- 2. Lesson: reading-with-root-awareness.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-with-root-awareness', 'Reading With Root Awareness', 'Lire avec conscience des racines', 0, 6
FROM public.modules WHERE slug = 'roots-capstone';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You have learned to recognize three root families in words you already know. Now read a brand-new sentence -- actually, the very next ayah after the one you started Level 2 with -- and notice how many roots you can already recognize inside it.',
  'Vous avez appris à reconnaître trois familles de racines parmi des mots que vous connaissez déjà. Lisez maintenant une toute nouvelle phrase — en réalité, le tout premier verset qui suit celui par lequel vous avez commencé le Niveau 2 — et remarquez combien de racines vous pouvez déjà y reconnaître.'
FROM public.lessons WHERE slug = 'reading-with-root-awareness'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 1, 2,
  'Al-hamdu ("praise") is a new word you will meet again later -- for now, just recognize it as part of the sentence. The rest, you can connect to roots you already know: li-llahi shares its root with Allah, rabbi is the exact word Rabb you have known since the very beginning, and al-''aalameen shares its root with ''Aalameen.',
  'Al-hamdu (« louange ») est un nouveau mot que vous rencontrerez de nouveau plus tard — pour l''instant, reconnaissez-le simplement comme faisant partie de la phrase. Le reste, vous pouvez le relier à des racines que vous connaissez déjà : li-llahi partage sa racine avec Allah, rabbi est exactement le mot Rabb que vous connaissez depuis le tout début, et al-''aalameen partage sa racine avec ''Aalameen.'
FROM public.lessons WHERE slug = 'reading-with-root-awareness';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'tip',
  'Three roots, all in one sentence you can now read with real understanding: divinity, lordship, and the worlds. This is what root awareness gives you -- not a translation you memorized, but a sentence you can partly work out yourself.',
  'Trois racines, toutes dans une seule phrase que vous pouvez maintenant lire avec une compréhension réelle : la divinité, la seigneurie et les mondes. C''est ce que la conscience des racines vous apporte — non pas une traduction mémorisée, mais une phrase que vous pouvez en partie comprendre par vous-même.'
FROM public.lessons WHERE slug = 'reading-with-root-awareness';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  'You have completed Level 3! You can recognize root families, notice how patterns shift meaning, and read new sentences by connecting them to roots you already know.',
  'Vous avez terminé le Niveau 3 ! Vous pouvez reconnaître des familles de racines, remarquer comment les schèmes modifient le sens, et lire de nouvelles phrases en les reliant à des racines que vous connaissez déjà.'
FROM public.lessons WHERE slug = 'reading-with-root-awareness';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 0, 'reading_check', a.arabic_text || ' reads:', a.arabic_text || ' se lit :',
  '{"choices": ["alhamdu lillahi rabbi l-aalameen", "alhamdu lillahi maliki l-aalameen", "alhamdu billahi rabbi l-aalameen"], "correctIndex": 0}'::jsonb, 1, 2, 'root'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1,
     public.ayahs a
WHERE l.slug = 'reading-with-root-awareness' AND a.surah_number = 1 AND a.ayah_number = 2;

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'true_false',
  'The word rabbi in this ayah is exactly the same word, Rabb, that you have known since Level 2.',
  'Le mot rabbi dans ce verset est exactement le même mot, Rabb, que vous connaissez depuis le Niveau 2.',
  '{"correctAnswer": true}'::jsonb, 'root'
FROM public.lessons WHERE slug = 'reading-with-root-awareness';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'multiple_choice',
  'Al-''aalameen shares its root with which word you already know?',
  'Al-''aalameen partage sa racine avec quel mot que vous connaissez déjà ?',
  '{"choices": ["''Aalameen (the worlds)", "Ilah (God, deity)", "Malik (Sovereign, King)"], "correctIndex": 0}'::jsonb, 'root'
FROM public.lessons WHERE slug = 'reading-with-root-awareness';

-- =========================================================================
-- 3. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_level_id uuid;
  v_l1_level_id uuid;
  v_l2_level_id uuid;
  v_module_count integer;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_l1_lesson_count integer;
  v_l2_lesson_count integer;
  v_l3_batch1_lesson_count integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'roots-and-word-patterns';

  SELECT count(*) INTO v_module_count FROM public.modules WHERE level_id = v_level_id;
  IF v_module_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 modules under roots-and-word-patterns after this migration, found %.', v_module_count;
  END IF;

  SELECT count(*) INTO v_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug = 'roots-capstone';
  IF v_lesson_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 lesson under roots-capstone, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections s
  JOIN public.lessons l ON l.id = s.lesson_id
  WHERE l.slug = 'reading-with-root-awareness';
  IF v_section_count <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 lesson_sections in reading-with-root-awareness, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  WHERE l.slug = 'reading-with-root-awareness';
  IF v_exercise_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 lesson_exercises in reading-with-root-awareness, found %.', v_exercise_count;
  END IF;

  -- Zero matching exercises -- zero new review items by design.
  IF EXISTS (
    SELECT 1 FROM public.lesson_exercises e
    JOIN public.lessons l ON l.id = e.lesson_id
    WHERE l.slug = 'reading-with-root-awareness' AND e.exercise_type = 'matching'
  ) THEN
    RAISE EXCEPTION 'Expected zero matching exercises in reading-with-root-awareness (this module must create zero new review items).';
  END IF;

  -- word_frequency must remain at exactly 20 rows -- no new vocabulary added.
  IF (SELECT count(*) FROM public.word_frequency) <> 20 THEN
    RAISE EXCEPTION 'Expected word_frequency to remain at exactly 20 rows, found %.', (SELECT count(*) FROM public.word_frequency);
  END IF;

  SELECT id INTO v_l1_level_id FROM public.levels WHERE slug = 'foundations-of-arabic-script';
  SELECT count(*) INTO v_l1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_l1_level_id;
  IF v_l1_lesson_count <> 33 THEN
    RAISE EXCEPTION 'Expected Level 1 to remain untouched at 33 lessons, found %.', v_l1_lesson_count;
  END IF;

  SELECT id INTO v_l2_level_id FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';
  SELECT count(*) INTO v_l2_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_l2_level_id;
  IF v_l2_lesson_count <> 10 THEN
    RAISE EXCEPTION 'Expected Level 2 to remain untouched at 10 lessons, found %.', v_l2_lesson_count;
  END IF;

  SELECT count(*) INTO v_l3_batch1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('arabic-roots-intro', 'word-patterns');
  IF v_l3_batch1_lesson_count <> 3 THEN
    RAISE EXCEPTION 'Expected Level 3 Batch 1 modules to remain untouched at 3 lessons, found %.', v_l3_batch1_lesson_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE level_id = v_level_id AND slug = 'roots-capstone' AND order_index = 2
  ) THEN
    RAISE EXCEPTION 'Expected roots-capstone at order_index 2 under Level 3.';
  END IF;

  RAISE NOTICE 'Level 3 Batch 2 migration post-insert assertions passed: % modules, % lesson, % sections, % exercises.',
    v_module_count, v_lesson_count, v_section_count, v_exercise_count;
END $$;

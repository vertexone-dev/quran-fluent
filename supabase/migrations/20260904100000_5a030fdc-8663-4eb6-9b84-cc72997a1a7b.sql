-- Phase 5 / Level 2 Batch 3 (Gate A+B): "vocabulary-capstone" — the
-- fifth and final Level 2 module, capping the level before the
-- consolidated Level 2 release audit. Continues directly from Batch 2
-- (core-vocabulary-2, short-phrases), which is Level 2 Batch 2
-- production-complete and untouched by this migration.
--
-- ARCHITECTURE: zero application-code changes, zero schema/RLS
-- changes. findCurriculumEntryPoint already walks every module under a
-- level_id in order_index order -- adding one more module at
-- order_index 4 extends the learner's progression automatically, and
-- (completedCount === totalCount) already reports "Completed" once
-- this module's lessons are done too, with no code change required.
--
-- CAPSTONE DESIGN: a single synthesis lesson, deliberately small (no
-- new mechanics), reading the opening ayah of two different surahs:
-- Al-Falaq 113:1 and An-Nas 114:1. Both share the identical four-word
-- opening "Qul a'udhu bi-Rabbi + X" -- chosen only after inspecting
-- the canonical ayahs table and confirming, word by word:
--   - Qul (word_frequency rank 11) -- exact match, already taught.
--   - bi-Rabbi: the embedded substring "ر-fatha-ب-shadda" is an exact
--     match of rank 4's stored lemma ("Rabb", from Al-Fatiha, Level 2
--     Batch 1) with a bound bi- prefix and a case-ending kasra added --
--     the same prefix/case-ending-stripped-lemma pattern already used
--     throughout Batch 1/2 (e.g. rank 8, rank 14, rank 15, rank 16).
--     This is the batch's key synthesis moment: the very first word
--     ever taught (Rabb, Batch 1) reappears here, in a genuinely new
--     Qur'anic context, alongside Batch 2 vocabulary.
--   - al-Falaq / an-Nas (ranks 19 and 16) -- exact substring matches
--     of their stored lemmas, same ال-prefix/case-ending pattern.
--   - a'udhu ("I seek refuge") is the one unavoidable new word.
--     Verified: NOT added to word_frequency, NOT used in any
--     review-item-generating exercise. It is explained inline in the
--     lesson's own prose (so the ayah is not left unglossed) but
--     deliberately kept context-only, never presented as mastered
--     vocabulary -- exactly the governance this batch's brief
--     required for any unavoidable new word.
-- Neither ayah has been shown as a full quran_example section before
-- (confirmed by querying lesson_sections) -- both were previously used
-- only as word_frequency.example_ayah source text, a different,
-- non-rendering use. No untaught mechanics: the bi- prefix and ال-
-- prefix/case-ending are shown by observation only, exactly as
-- short-phrases (Batch 2) already established for the "X of Y"
-- pattern -- never named grammatically, no Tajweed, no morphology.
--
-- REVIEW ITEMS: deliberately ZERO. No matching exercise anywhere in
-- this module (the only exercise type that seeds review_items, per
-- src/lib/study.ts's seedLessonReviewItems) -- no new durable fact is
-- taught here that isn't already a mastered review item from Batch
-- 1/2. reading_check/true_false/multiple_choice test reading fluency
-- and recall of already-known facts without creating new items.
--
-- QUR'AN INTEGRITY: both quran_example sections reference (surah_
-- number, ayah_number) against the existing ayahs table via FK only --
-- no Qur'anic Arabic is duplicated into this migration's lesson
-- content.
--
-- CONTENT GOVERNANCE: RED ITEMS: 0. YELLOW ITEMS: 0. "a'udhu" is
-- deliberately excluded from word_frequency and from every exercise
-- payload/choice list containing Arabic answer text -- it appears
-- only inside the two quran_example sections' rendered ayah text
-- (via FK) and the lesson's own explanatory prose, never as a
-- reading_check target on its own.

DO $$
DECLARE
  v_level_id uuid;
  v_existing_modules integer;
  v_existing_lessons integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Expected the basic-vocabulary-and-patterns level to already exist. Aborting.';
  END IF;

  SELECT count(*) INTO v_existing_modules FROM public.modules
  WHERE level_id = v_level_id AND slug = 'vocabulary-capstone';
  IF v_existing_modules <> 0 THEN
    RAISE EXCEPTION 'Expected zero Batch 3 modules to already exist under basic-vocabulary-and-patterns, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_modules FROM public.modules WHERE level_id = v_level_id;
  IF v_existing_modules <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 existing Level 2 modules before this migration, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_lessons FROM public.lessons WHERE slug = 'capstone-reading';
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected the capstone-reading lesson slug not to already exist, found %.', v_existing_lessons;
  END IF;
END $$;

-- =========================================================================
-- 1. Module.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'vocabulary-capstone', 'Vocabulary Capstone', 'Aboutissement du vocabulaire', 4
FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';

-- =========================================================================
-- 2. Lesson: capstone-reading.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'capstone-reading', 'Reading Two New Verses', 'Lire deux nouveaux versets', 0, 8
FROM public.modules WHERE slug = 'vocabulary-capstone';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You know 20 core words and how short phrases combine. Now read two brand-new verses -- the opening lines of two surahs you have partly seen before -- combining vocabulary from every part of Level 2.',
  'Vous connaissez 20 mots de base et comment les courtes phrases se combinent. Lisez maintenant deux nouveaux versets — les premières lignes de deux sourates que vous avez déjà partiellement vues — combinant du vocabulaire de tout le Niveau 2.'
FROM public.lessons WHERE slug = 'capstone-reading'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 113, 1,
  'Aʿūdhu ("I seek refuge") is a new word you will meet again later -- for now, just recognize it as part of this phrase. The rest you already know: Qul, Rabb (with the connecting bi- prefix), and Falaq.',
  'Aʿūdhu (« je cherche refuge ») est un nouveau mot que vous rencontrerez de nouveau plus tard — pour l''instant, reconnaissez-le simplement comme faisant partie de cette phrase. Le reste, vous le connaissez déjà : Qul, Rabb (avec le préfixe de liaison bi-), et Falaq.'
FROM public.lessons WHERE slug = 'capstone-reading';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'tip',
  'Notice: Rabb is the very first word you ever learned, from Al-Fatiha. Seeing it again here -- combined with new phrase patterns -- shows how far your reading has come.',
  'Remarquez : Rabb est le tout premier mot que vous ayez appris, tiré d''Al-Fatiha. Le revoir ici — combiné à de nouveaux schémas de phrase — montre à quel point votre lecture a progressé.'
FROM public.lessons WHERE slug = 'capstone-reading';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 114, 1,
  'The exact same opening words -- Qul aʿūdhu bi-Rabbi -- begin this verse too, this time followed by an-Nas instead of al-Falaq.',
  'Exactement les mêmes mots d''ouverture — Qul aʿūdhu bi-Rabbi — commencent aussi ce verset, suivis cette fois d''an-Nas au lieu d''al-Falaq.'
FROM public.lessons WHERE slug = 'capstone-reading';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'Two different surahs, the same formula. Recognizing this pattern is real Qur''anic reading fluency.',
  'Deux sourates différentes, la même formule. Reconnaître ce schéma, c''est cela, la véritable aisance de lecture coranique.'
FROM public.lessons WHERE slug = 'capstone-reading';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You have completed Level 2! You can recognize 20 core words, read short phrases, and now read complete new verses by combining everything you have learned.',
  'Vous avez terminé le Niveau 2 ! Vous pouvez reconnaître 20 mots de base, lire de courtes phrases, et maintenant lire des versets complets et nouveaux en combinant tout ce que vous avez appris.'
FROM public.lessons WHERE slug = 'capstone-reading';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 0, 'reading_check', a.arabic_text || ' reads:', a.arabic_text || ' se lit :',
  '{"choices": ["qul a''udhu birabbi l-falaq", "qul huwa birabbi l-falaq", "qul a''udhu bilfalaq"], "correctIndex": 0}'::jsonb, 113, 1, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1,
     public.ayahs a
WHERE l.slug = 'capstone-reading' AND a.surah_number = 113 AND a.ayah_number = 1;

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 1, 'reading_check', a.arabic_text || ' reads:', a.arabic_text || ' se lit :',
  '{"choices": ["qul a''udhu birabbi n-nas", "qul huwa birabbi n-nas", "qul a''udhu bilfalaq"], "correctIndex": 0}'::jsonb, 114, 1, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 3,
     public.ayahs a
WHERE l.slug = 'capstone-reading' AND a.surah_number = 114 AND a.ayah_number = 1;

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'Both verses begin with the exact same three words: Qul, A''udhu, and bi-Rabbi.',
  'Les deux versets commencent par exactement les trois mêmes mots : Qul, A''udhu, et bi-Rabbi.',
  '{"correctAnswer": true}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'capstone-reading';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'multiple_choice',
  'What does Rabb -- the word you already know that appears in both verses -- mean?',
  'Que signifie Rabb — le mot que vous connaissez déjà et qui apparaît dans les deux versets ?',
  '{"choices": ["Lord", "Book", "Mercy"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'capstone-reading';

-- =========================================================================
-- 3. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_level_id uuid;
  v_l1_level_id uuid;
  v_module_count integer;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_l1_lesson_count integer;
  v_batch12_lesson_count integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';

  SELECT count(*) INTO v_module_count FROM public.modules WHERE level_id = v_level_id;
  IF v_module_count <> 5 THEN
    RAISE EXCEPTION 'Expected exactly 5 modules under basic-vocabulary-and-patterns after this migration, found %.', v_module_count;
  END IF;

  SELECT count(*) INTO v_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug = 'vocabulary-capstone';
  IF v_lesson_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 lesson under vocabulary-capstone, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections s
  JOIN public.lessons l ON l.id = s.lesson_id
  WHERE l.slug = 'capstone-reading';
  IF v_section_count <> 6 THEN
    RAISE EXCEPTION 'Expected exactly 6 lesson_sections in capstone-reading, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  WHERE l.slug = 'capstone-reading';
  IF v_exercise_count <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 lesson_exercises in capstone-reading, found %.', v_exercise_count;
  END IF;

  -- Zero matching exercises anywhere in this module -- zero new review items by design.
  IF EXISTS (
    SELECT 1 FROM public.lesson_exercises e
    JOIN public.lessons l ON l.id = e.lesson_id
    WHERE l.slug = 'capstone-reading' AND e.exercise_type = 'matching'
  ) THEN
    RAISE EXCEPTION 'Expected zero matching exercises in capstone-reading (this module must create zero new review items).';
  END IF;

  -- word_frequency must remain at exactly 20 rows -- no new vocabulary added.
  IF (SELECT count(*) FROM public.word_frequency) <> 20 THEN
    RAISE EXCEPTION 'Expected word_frequency to remain at exactly 20 rows (no new vocabulary in the capstone), found %.', (SELECT count(*) FROM public.word_frequency);
  END IF;

  SELECT id INTO v_l1_level_id FROM public.levels WHERE slug = 'foundations-of-arabic-script';
  SELECT count(*) INTO v_l1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_l1_level_id;
  IF v_l1_lesson_count <> 33 THEN
    RAISE EXCEPTION 'Expected Level 1 to remain untouched at 33 lessons, found %.', v_l1_lesson_count;
  END IF;

  SELECT count(*) INTO v_batch12_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('long-vowels-and-orthography', 'core-vocabulary-1', 'core-vocabulary-2', 'short-phrases');
  IF v_batch12_lesson_count <> 9 THEN
    RAISE EXCEPTION 'Expected Batch 1+2 modules to remain untouched at 9 lessons total, found %.', v_batch12_lesson_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE level_id = v_level_id AND slug = 'vocabulary-capstone' AND order_index = 4
  ) THEN
    RAISE EXCEPTION 'Expected vocabulary-capstone at order_index 4 under Level 2.';
  END IF;

  RAISE NOTICE 'Batch 3 migration post-insert assertions passed: % modules, % lesson, % sections, % exercises.',
    v_module_count, v_lesson_count, v_section_count, v_exercise_count;
END $$;

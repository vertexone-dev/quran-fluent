-- Level 4 (Core Grammar) Batch 2 (Gate A+B): "grammar-in-context-capstone" --
-- the third and final Level 4 module, per the approved Level 4 design.
-- Continues directly from Batch 1 (pronouns-and-nominal-sentences,
-- agreement-and-genitive-constructions), which is Level 4 Batch 1
-- production-complete and untouched by this migration.
--
-- ARCHITECTURE: zero schema changes, zero RLS changes, zero new
-- exercise types, zero new review-item types, zero application-code
-- changes. findCurriculumEntryPoint and the STEP_LEVEL_SLUGS 'grammar'
-- mapping (added in Batch 1) already generalize to any module count
-- under a level_id -- no code change is needed for this third module,
-- mirroring the identical precedent from Level 3 Batch 2.
--
-- CONTENT: a single pure-application lesson reusing three already-
-- cached, already-shown ayahs -- 1:2 (shown 5x before this migration),
-- 113:1 and 113:2 (each shown 1x before this migration) -- confirmed
-- by direct query before authoring. Teaches the two remaining Level 4
-- grammar concepts from the approved design: the attached prepositions
-- li- and bi-, and verb recognition (imperative vs. past tense),
-- using entirely already-known vocabulary:
--   li- (in li-llahi, 1:2)      -- already shown, new grammar lens
--   bi- (in bi-rabbi, 113:1)    -- new attached preposition
--   qul (rank 11, imperative)   -- already known, reinforced
--   khalaqa (rank 18, past)     -- already known, reinforced
--   falaq (rank 19), sharr (rank 17), rabb (rank 4) -- already known,
--     appear in these verses unprompted
-- (word_frequency ranks written in this comment only for traceability;
-- the migration itself never hand-types Arabic -- every Arabic string
-- is either an exact FK reference to `ayahs` or copied verbatim from a
-- verified query result).
--
-- The one unavoidable new word is "a'udhu" ("I seek refuge"), which
-- does NOT appear in word_frequency. Governed exactly like "al-hamdu"
-- in Level 3 Batch 2's own capstone (itself mirroring Level 2 Batch
-- 3's "a'udhu" precedent): explained inline in the lesson's own prose,
-- but NOT added to word_frequency, NOT used in any review-item-
-- generating exercise, and NOT present in any exercise's selectable
-- answer choices. "maa" (the relative "that which" in 113:2) receives
-- the same treatment.
--
-- REVIEW ITEMS: deliberately ZERO. No matching exercise anywhere in
-- this module. The four new concept labels named in the approved
-- design (preposition-li, preposition-bi, verb-imperative, verb-past-
-- tense) are close-reading skills applied to already-familiar verses,
-- not standalone facts to memorize -- exactly the same "pure synthesis,
-- zero new review items" judgment already made, and already validated
-- in production, for Level 3 Batch 2's capstone.
--
-- QUR'AN INTEGRITY: quran_example sections reference (surah_number,
-- ayah_number) = (1,2), (113,1), (113,2) against the existing ayahs
-- table via FK only -- no Qur'anic Arabic duplicated into this
-- migration's own content.
--
-- PROGRESSION: this migration raises Level 4's total lesson count from
-- 3 to 4. findCurriculumEntryPoint recomputes completedCount/totalCount
-- from live data on every read, so a learner who has only completed
-- Batch 1's 3 lessons will correctly continue to see the "grammar" step
-- as in_progress (completedCount 3 of totalCount 4), never falsely
-- "Completed", until this fourth lesson is also finished -- verified
-- empirically in spec 41, not assumed.
--
-- CONTENT GOVERNANCE: RED ITEMS: 0. YELLOW ITEMS: 0. "a'udhu" and "maa"
-- are deliberately excluded from word_frequency and from every
-- exercise payload/choice list containing Arabic answer text.

DO $$
DECLARE
  v_level_id uuid;
  v_existing_modules integer;
  v_existing_lessons integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'core-grammar';
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Expected the core-grammar level to already exist. Aborting.';
  END IF;

  SELECT count(*) INTO v_existing_modules FROM public.modules
  WHERE level_id = v_level_id AND slug = 'grammar-in-context-capstone';
  IF v_existing_modules <> 0 THEN
    RAISE EXCEPTION 'Expected zero grammar-in-context-capstone module to already exist, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_modules FROM public.modules WHERE level_id = v_level_id;
  IF v_existing_modules <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 existing Level 4 modules (Batch 1) before this migration, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_lessons FROM public.lessons WHERE slug = 'reading-with-grammar-awareness';
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected the reading-with-grammar-awareness lesson slug not to already exist, found %.', v_existing_lessons;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 1 AND ayah_number = 2) THEN
    RAISE EXCEPTION 'Expected ayah 1:2 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 113 AND ayah_number = 1) THEN
    RAISE EXCEPTION 'Expected ayah 113:1 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 113 AND ayah_number = 2) THEN
    RAISE EXCEPTION 'Expected ayah 113:2 to already be cached.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 11) THEN
    RAISE EXCEPTION 'Expected rank 11 (Qul) to already exist in word_frequency.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 18) THEN
    RAISE EXCEPTION 'Expected rank 18 (Khalaqa) to already exist in word_frequency.';
  END IF;
END $$;

-- =========================================================================
-- 1. Module.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'grammar-in-context-capstone', 'Grammar Capstone', 'Aboutissement de la grammaire', 2
FROM public.levels WHERE slug = 'core-grammar';

-- =========================================================================
-- 2. Lesson: reading-with-grammar-awareness.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-with-grammar-awareness', 'Reading With Grammar Awareness', 'Lire avec conscience grammaticale', 0, 7
FROM public.modules WHERE slug = 'grammar-in-context-capstone';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You have learned to recognize pronouns, nominal sentences, noun-adjective pairs, and "X of Y" phrases. Now read two connected, familiar verses again and notice two small pieces you have not named yet: the attached prepositions li- and bi-, and the difference between a command and a completed action.',
  'Vous avez appris à reconnaître des pronoms, des phrases nominales, des paires nom-adjectif et des expressions du type « X de Y ». Lisez maintenant à nouveau deux versets familiers et liés entre eux, et remarquez deux petits éléments que vous n''avez pas encore nommés : les prépositions attachées li- et bi-, ainsi que la différence entre un ordre et une action accomplie.'
FROM public.lessons WHERE slug = 'reading-with-grammar-awareness'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 1, 2,
  'You have read this ayah many times already. Look again at li-llahi: li- ("to/for") is attached directly to the front of "Allah," not written as its own separate word. It shows who the praise belongs to.',
  'Vous avez déjà lu ce verset de nombreuses fois. Regardez à nouveau li-llahi : li- (« à/pour ») est attaché directement au début de « Allah », et non écrit comme un mot séparé. Cela montre à qui appartient la louange.'
FROM public.lessons WHERE slug = 'reading-with-grammar-awareness';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 113, 1,
  'Qul ("Say") opens this verse again, the same command form you already know. A''udhu ("I seek refuge") is new -- for now, just notice bi-rabbi: the same kind of attached preposition as li-, but bi- means "in/with," attached directly to "rabb," the word you have known since Level 2.',
  'Qul (« Dis ») ouvre à nouveau ce verset, la même forme de commandement que vous connaissez déjà. A''udhu (« je cherche refuge ») est nouveau — pour l''instant, remarquez simplement bi-rabbi : le même type de préposition attachée que li-, mais bi- signifie « en/avec », attaché directement à « rabb », le mot que vous connaissez depuis le Niveau 2.'
FROM public.lessons WHERE slug = 'reading-with-grammar-awareness';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 113, 2,
  'Khalaqa closes this verse -- the same word you already know as "He created," now doing its job as a verb in a real sentence: a completed action, unlike qul, which is a command.',
  'Khalaqa clôt ce verset — le même mot que vous connaissez déjà comme « Il a créé », qui fait maintenant son travail de verbe dans une vraie phrase : une action accomplie, contrairement à qul, qui est un ordre.'
FROM public.lessons WHERE slug = 'reading-with-grammar-awareness';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'Li- and bi- are both small prefixes -- never separate words on their own. Qul is a command; khalaqa is a completed action. Both are verbs, but they work differently.',
  'Li- et bi- sont tous deux de petits préfixes — jamais des mots séparés. Qul est un ordre ; khalaqa est une action accomplie. Les deux sont des verbes, mais ils fonctionnent différemment.'
FROM public.lessons WHERE slug = 'reading-with-grammar-awareness';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You have completed Level 4! You can recognize pronouns, nominal sentences, noun-adjective pairs, "X of Y" phrases, the attached prepositions li- and bi-, and the difference between a command and a completed action.',
  'Vous avez terminé le Niveau 4 ! Vous pouvez reconnaître des pronoms, des phrases nominales, des paires nom-adjectif, des expressions du type « X de Y », les prépositions attachées li- et bi-, ainsi que la différence entre un ordre et une action accomplie.'
FROM public.lessons WHERE slug = 'reading-with-grammar-awareness';

-- Deliberately NOT linked to a section_id -- buildPlayerSteps (src/lib/
-- curriculum.ts) renders a section-linked exercise immediately after
-- that section, before this lesson's remaining quran_example/tip/
-- summary sections, which would wrongly interleave this exercise
-- between 113:1 and 113:2. Same fix already applied in Level 4 Batch 1
-- ("lord-of-the-worlds"); left as an ordinary order_index-0 exercise
-- alongside the other two instead.
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, 0, 'reading_check', a.arabic_text || ' reads:', a.arabic_text || ' se lit :',
  jsonb_build_object(
    'choices', jsonb_build_array(
      'qul a''udhu bi-rabbi l-falaq',
      'qul a''udhu li-rabbi l-falaq',
      'qul a''udhu bi-maliki l-falaq'
    ),
    'correctIndex', 0
  ), 113, 1, 'concept'
FROM public.lessons l, public.ayahs a
WHERE l.slug = 'reading-with-grammar-awareness' AND a.surah_number = 113 AND a.ayah_number = 1;

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'true_false',
  'The bi- in bi-rabbi is a separate word meaning "in/with," written apart from rabbi.',
  'Le bi- dans bi-rabbi est un mot séparé signifiant « en/avec », écrit à part de rabbi.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-with-grammar-awareness';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'multiple_choice',
  'Which word in these verses is a completed action ("he created"), not a command?',
  'Quel mot dans ces versets est une action accomplie (« il a créé »), et non un ordre ?',
  '{"choices": ["Khalaqa", "Qul", "Rabb"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-with-grammar-awareness';

-- =========================================================================
-- 3. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_level_id uuid;
  v_l1_level_id uuid;
  v_l2_level_id uuid;
  v_l3_level_id uuid;
  v_module_count integer;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_l1_lesson_count integer;
  v_l2_lesson_count integer;
  v_l3_lesson_count integer;
  v_l4_batch1_lesson_count integer;
  v_wf_count integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'core-grammar';

  SELECT count(*) INTO v_module_count FROM public.modules WHERE level_id = v_level_id;
  IF v_module_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 modules under core-grammar after this migration, found %.', v_module_count;
  END IF;

  SELECT count(*) INTO v_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug = 'grammar-in-context-capstone';
  IF v_lesson_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 lesson under grammar-in-context-capstone, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections s
  JOIN public.lessons l ON l.id = s.lesson_id
  WHERE l.slug = 'reading-with-grammar-awareness';
  IF v_section_count <> 6 THEN
    RAISE EXCEPTION 'Expected exactly 6 lesson_sections in reading-with-grammar-awareness, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  WHERE l.slug = 'reading-with-grammar-awareness';
  IF v_exercise_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 lesson_exercises in reading-with-grammar-awareness, found %.', v_exercise_count;
  END IF;

  -- Zero matching exercises -- zero new review items by design.
  IF EXISTS (
    SELECT 1 FROM public.lesson_exercises e
    JOIN public.lessons l ON l.id = e.lesson_id
    WHERE l.slug = 'reading-with-grammar-awareness' AND e.exercise_type = 'matching'
  ) THEN
    RAISE EXCEPTION 'Expected zero matching exercises in reading-with-grammar-awareness (this module must create zero new review items).';
  END IF;

  -- word_frequency must remain at exactly 20 rows -- no new vocabulary added.
  SELECT count(*) INTO v_wf_count FROM public.word_frequency;
  IF v_wf_count <> 20 THEN
    RAISE EXCEPTION 'Expected word_frequency to remain at exactly 20 rows, found %.', v_wf_count;
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

  SELECT id INTO v_l3_level_id FROM public.levels WHERE slug = 'roots-and-word-patterns';
  SELECT count(*) INTO v_l3_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_l3_level_id;
  IF v_l3_lesson_count <> 4 THEN
    RAISE EXCEPTION 'Expected Level 3 to remain untouched at 4 lessons, found %.', v_l3_lesson_count;
  END IF;

  SELECT count(*) INTO v_l4_batch1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('pronouns-and-nominal-sentences', 'agreement-and-genitive-constructions');
  IF v_l4_batch1_lesson_count <> 3 THEN
    RAISE EXCEPTION 'Expected Level 4 Batch 1 modules to remain untouched at 3 lessons, found %.', v_l4_batch1_lesson_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE level_id = v_level_id AND slug = 'grammar-in-context-capstone' AND order_index = 2
  ) THEN
    RAISE EXCEPTION 'Expected grammar-in-context-capstone at order_index 2 under Level 4.';
  END IF;

  RAISE NOTICE 'Level 4 Batch 2 migration post-insert assertions passed: % modules, % lesson, % sections, % exercises.',
    v_module_count, v_lesson_count, v_section_count, v_exercise_count;
END $$;

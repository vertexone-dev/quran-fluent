-- Level 5 ("Guided Ayah Comprehension") Batch 2: Module 3
-- (verbal-sentences-imperative) and Module 4 (guided-comprehension-capstone),
-- per the approved Level 5 Batch 2 design. Continues directly from Batch 1
-- (attached-particles, verbal-sentences-past, migration 20260910100000),
-- which is Level 5 Batch 1 production-complete and untouched by this
-- migration.
--
-- LINGUISTIC REVALIDATION (Al-Kawthar 108:1-3): the design note's claim
-- that 108:1 "contains a past-tense verb" was independently re-verified,
-- not trusted -- and confirmed true, but with an important nuance
-- surfaced by that verification rather than assumed away. 108:1's
-- a'ataynaa ("We gave") IS a completed-action (perfect/past) verb, but in
-- the 1st-person-plural form (suffix -naa), not the 3rd-person-singular
-- form (suffix -a, as in khalaqa) that Batch 1 taught. This is not
-- treated as a full conjugation paradigm (explicitly out of scope) --
-- the capstone lesson below explains it with a single sentence
-- (recognize the completed-action MEANING, not one specific ending), the
-- same light-touch precedent Batch 1's own recognizing-past-tense-verbs
-- lesson already set by including "lam yalid" (a negated-jussive
-- construction, not the -a suffix either) alongside khalaqa as "past
-- tense" -- so this capstone is consistent with, not a departure from,
-- how Batch 1 itself already treated past-tense recognition as a
-- semantic category rather than one narrow ending.
--
-- Direct verification of all three verses (confirmed against public.ayahs
-- before authoring, not assumed) also found 108:2 (fa-salli li-rabbika
-- wa-nhar) to be TWO IMPERATIVES -- not past tense at all -- and 108:3
-- (inna shaani'aka huwa l-abtar) to be a NOMINAL sentence built on huwa,
-- exactly the huwa-Allahu-ahad pattern from Level 4 Batch 1, plus a
-- second al- occurrence reinforcing Batch 1 Module 1. So Al-Kawthar's
-- richest, most honest synthesis value is imperative + nominal + particle
-- reinforcement, with past-tense recognition present but explained
-- narrowly and correctly rather than forced -- exactly the "classify only
-- what is actually present" instruction this migration follows. Approved
-- as the capstone reference on this basis.
--
-- MODULE 3 CONCEPTS: qul as the common Qur'anic imperative, contrasted
-- explicitly against the past tense Batch 1 already taught (reusing
-- already-familiar qul-opening verses 113:1/114:1/112:1 -- zero new
-- vocabulary in that lesson), then yaa ("O") + ayyuhaa as a direct-address
-- pattern via 109:1 -- verified live against public.ayahs and against the
-- existing curriculum (confirmed unused by any prior lesson) before
-- authoring. "verb-imperative" was named as a design concept in Level 4
-- Batch 2 but deliberately given zero review items there ("close-reading
-- skill, not a standalone fact" -- that migration's own words); this is
-- its first real review-item concept key, not a duplicate.
--
-- QUR'AN INTEGRITY: every Arabic string is either an exact (surah_number,
-- ayah_number) FK reference (enforced by the existing composite FK to
-- ayahs, not just convention) or a transliteration/gloss in prose -- no
-- canonical Arabic hand-typed. Referenced verses -- 112:1, 113:1, 114:1
-- (all already shown), 109:1, 108:1, 108:2, 108:3 (new to the curriculum,
-- confirmed cached) -- are verified to exist in the preconditions below.
--
-- NEW VOCABULARY DISCIPLINE (mirrors the established "a'udhu"/"maa"/
-- "naffathat" precedent): ayyuhaa, al-kaafiruun (109:1), and shaani'aka,
-- al-abtar (108:3) are unavoidable neighbor words in verses chosen for
-- their yaa/huwa content. Each is explained only inline, in prose, purely
-- for comprehension of the target concept -- none is added to
-- word_frequency (remains at exactly 20 rows, verified below), and none
-- appears in any exercise's selectable answer choices.
--
-- REVIEW ITEMS: Module 3 gets its first two real "concept" review items
-- (verb-imperative, particle-ya) via one matching exercise per lesson,
-- mirroring the Batch 1 pattern. The Module 4 capstone lesson is pure
-- synthesis of already-taught material (like Level 3/4's own capstones
-- and Batch 1's own guided-decomposition-al-falaq-2) and deliberately has
-- ZERO matching exercises / zero new review items.
--
-- I18N: normalized EN/FR translation rows authored directly (per the
-- Level 5+ authoring contract from migration 20260909100000), legacy
-- _en/_fr columns mirrored alongside for the still-NOT-NULL columns
-- (title_en/fr, prompt_en/fr). No ar/ur/id rows. This migration does not
-- touch the levels table at all (Batch 1 already renamed/authored the
-- Level 5 row) -- only new modules/lessons/sections/exercises are added.
--
-- PROGRESSION: zero code changes. STEP_LEVEL_SLUGS.ayah_comprehension
-- (wired in Batch 1) already points at guided-ayah-comprehension and
-- findCurriculumEntryPoint recomputes totalCount/completedCount live from
-- all lessons under the level -- adding two more modules under the same
-- level_id is automatically picked up, exactly the same "no code change
-- needed" precedent as every prior Batch-2-style migration in this
-- project (Level 3, Level 4).
--
-- CONTENT GOVERNANCE: RED ITEMS: 0. YELLOW ITEMS: 0.

DO $$
DECLARE
  v_existing integer;
  v_level_id uuid;
BEGIN
  -- Row-count baseline (confirmed by direct query before authoring).
  SELECT count(*) INTO v_existing FROM public.levels;
  IF v_existing <> 6 THEN
    RAISE EXCEPTION 'Expected exactly 6 levels before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.modules;
  IF v_existing <> 21 THEN
    RAISE EXCEPTION 'Expected exactly 21 modules before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.lessons;
  IF v_existing <> 55 THEN
    RAISE EXCEPTION 'Expected exactly 55 lessons before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.lesson_sections;
  IF v_existing <> 284 THEN
    RAISE EXCEPTION 'Expected exactly 284 lesson_sections before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.lesson_exercises;
  IF v_existing <> 226 THEN
    RAISE EXCEPTION 'Expected exactly 226 lesson_exercises before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.word_frequency;
  IF v_existing <> 20 THEN
    RAISE EXCEPTION 'Expected exactly 20 word_frequency rows before this migration, found %.', v_existing;
  END IF;

  -- Level 5 must already be Batch-1-complete (2 modules, 4 lessons) under
  -- its Batch-1-assigned slug -- confirms this migration runs after
  -- Batch 1, never before, and never touches the levels row itself.
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'guided-ayah-comprehension' AND number = 5;
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Expected the guided-ayah-comprehension level (Batch 1) to already exist. Aborting.';
  END IF;
  SELECT count(*) INTO v_existing FROM public.modules WHERE level_id = v_level_id;
  IF v_existing <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 existing Level 5 modules (Batch 1) before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id WHERE m.level_id = v_level_id;
  IF v_existing <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 existing Level 5 lessons (Batch 1) before this migration, found %.', v_existing;
  END IF;

  -- New module/lesson slugs must not already exist anywhere.
  IF EXISTS (SELECT 1 FROM public.modules WHERE slug IN ('verbal-sentences-imperative', 'guided-comprehension-capstone')) THEN
    RAISE EXCEPTION 'Expected zero verbal-sentences-imperative/guided-comprehension-capstone modules to already exist.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.lessons WHERE slug IN (
      'recognizing-the-imperative-qul', 'direct-address-ya-ayyuha', 'guided-decomposition-al-kawthar'
    )
  ) THEN
    RAISE EXCEPTION 'Expected zero Level 5 Batch 2 lesson slugs to already exist.';
  END IF;

  -- Every referenced ayah must already be cached.
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 112 AND ayah_number = 1) THEN
    RAISE EXCEPTION 'Expected ayah 112:1 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 113 AND ayah_number = 1) THEN
    RAISE EXCEPTION 'Expected ayah 113:1 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 114 AND ayah_number = 1) THEN
    RAISE EXCEPTION 'Expected ayah 114:1 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 109 AND ayah_number = 1) THEN
    RAISE EXCEPTION 'Expected ayah 109:1 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 108 AND ayah_number = 1) THEN
    RAISE EXCEPTION 'Expected ayah 108:1 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 108 AND ayah_number = 2) THEN
    RAISE EXCEPTION 'Expected ayah 108:2 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 108 AND ayah_number = 3) THEN
    RAISE EXCEPTION 'Expected ayah 108:3 to already be cached.';
  END IF;

  -- 108/109 must be genuinely new to the curriculum (no prior lesson
  -- content references them) -- confirmed by direct query before
  -- authoring, not assumed.
  IF EXISTS (SELECT 1 FROM public.lesson_sections WHERE surah_number IN (108, 109)) THEN
    RAISE EXCEPTION 'Expected zero prior lesson_sections referencing surah 108/109.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lesson_exercises WHERE surah_number IN (108, 109)) THEN
    RAISE EXCEPTION 'Expected zero prior lesson_exercises referencing surah 108/109.';
  END IF;

  -- Already-known vocabulary this migration reinforces (rank 4 rabb,
  -- rank 11 qul, rank 12 huwa, rank 18 khalaqa) must already exist.
  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 4) THEN
    RAISE EXCEPTION 'Expected rank 4 (Rabb) to already exist in word_frequency.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 11) THEN
    RAISE EXCEPTION 'Expected rank 11 (Qul) to already exist in word_frequency.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 12) THEN
    RAISE EXCEPTION 'Expected rank 12 (Huwa) to already exist in word_frequency.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 18) THEN
    RAISE EXCEPTION 'Expected rank 18 (Khalaqa) to already exist in word_frequency.';
  END IF;
END $$;

-- =========================================================================
-- 1. Module 3: verbal-sentences-imperative.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'verbal-sentences-imperative', 'Imperative Verbal Sentences', 'Phrases verbales à l''impératif', 2
FROM public.levels WHERE slug = 'guided-ayah-comprehension';

INSERT INTO public.module_translations (module_id, locale, title)
SELECT id, 'en', 'Imperative Verbal Sentences' FROM public.modules WHERE slug = 'verbal-sentences-imperative';
INSERT INTO public.module_translations (module_id, locale, title)
SELECT id, 'fr', 'Phrases verbales à l''impératif' FROM public.modules WHERE slug = 'verbal-sentences-imperative';

-- -------------------------------------------------------------------------
-- 1.1 Lesson: recognizing-the-imperative-qul.
-- -------------------------------------------------------------------------

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'recognizing-the-imperative-qul', 'Recognizing the Imperative: Qul', 'Reconnaître l''impératif : Qul', 0, 7
FROM public.modules WHERE slug = 'verbal-sentences-imperative';

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', 'Recognizing the Imperative: Qul' FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', 'Reconnaître l''impératif : Qul' FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You have learned to recognize past-tense verbs like khalaqa (''He created'') -- a completed action. Now meet a different verb form: the imperative, a command addressed directly to ''you''. Qul (''Say!'') is the most common imperative in the Qur''an, and you have already seen it many times without naming it.',
  'Vous avez appris à reconnaître des verbes au passé comme khalaqa (« Il a créé ») -- une action accomplie. Découvrez maintenant une forme verbale différente : l''impératif, un ordre adressé directement à « toi ». Qul (« Dis ! ») est l''impératif le plus courant du Coran, et vous l''avez déjà rencontré de nombreuses fois sans le nommer.'
FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 113, 1,
  'Qul a''udhu bi-rabbi l-falaq opens with qul: a command, ''Say!'' -- not a description of something already done, but an instruction addressed to you, the reader.',
  'Qul a''udhu bi-rabbi l-falaq s''ouvre par qul : un ordre, « Dis ! » -- non pas la description de quelque chose de déjà accompli, mais une instruction qui s''adresse à vous, le lecteur.'
FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 114, 1,
  'Qul a''udhu bi-rabbi n-nas opens the exact same way: qul, the same imperative command, now in a different verse.',
  'Qul a''udhu bi-rabbi n-nas s''ouvre exactement de la même manière : qul, le même ordre à l''impératif, cette fois dans un autre verset.'
FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 112, 1,
  'Qul huwa llahu ahad: qul commands you to say what follows -- huwa llahu ahad (''He is Allah, One''), the nominal sentence you already know.',
  'Qul huwa llahu ahad : qul vous ordonne de dire ce qui suit -- huwa llahu ahad (« Il est Allah, Unique »), la phrase nominale que vous connaissez déjà.'
FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'An imperative is a command: it tells ''you'' to do something right now. A past-tense verb describes something already completed. Qul (''Say!'') is imperative; khalaqa (''He created'') is past tense -- they answer different questions.',
  'Un impératif est un ordre : il dit à « toi » de faire quelque chose maintenant. Un verbe au passé décrit quelque chose de déjà accompli. Qul (« Dis ! ») est un impératif ; khalaqa (« Il a créé ») est un verbe au passé -- ils répondent à des questions différentes.'
FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You can now recognize qul as a common imperative command, and tell it apart from a past-tense verb like khalaqa.',
  'Vous pouvez maintenant reconnaître qul comme un ordre à l''impératif courant, et le distinguer d''un verbe au passé comme khalaqa.'
FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'en', s.body_en FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'recognizing-the-imperative-qul';
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'fr', s.body_fr FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'Qul describes an action that has already been completed, like khalaqa.',
  'Qul décrit une action déjà accomplie, comme khalaqa.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'What does qul command the reader to do?',
  'Que qul ordonne-t-il au lecteur de faire ?',
  '{"choices": ["Say", "Create", "Believe"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match the grammar concept to its description.',
  'Associez le concept grammatical à sa description.',
  '{"pairs": [
    {"left": "verb-imperative", "right": "a command addressed to \"you\", like qul (\"Say!\") -- different from a past-tense verb describing something already done"}
  ]}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'en', e.prompt_en, e.payload FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'recognizing-the-imperative-qul';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'fr', e.prompt_fr,
  CASE e.order_index
    WHEN 0 THEN '{"correctAnswer": false}'::jsonb
    WHEN 1 THEN '{"choices": ["Dire", "Créer", "Croire"], "correctIndex": 0}'::jsonb
    WHEN 2 THEN '{"pairs": [
      {"left": "verb-imperative", "right": "un ordre adressé à « toi », comme qul (« Dis ! ») -- différent d''un verbe au passé qui décrit quelque chose déjà accompli"}
    ]}'::jsonb
  END
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'recognizing-the-imperative-qul';

-- -------------------------------------------------------------------------
-- 1.2 Lesson: direct-address-ya-ayyuha.
-- -------------------------------------------------------------------------

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'direct-address-ya-ayyuha', 'Direct Address: Yā Ayyuhā', 'Adresse directe : Yā Ayyuhā', 1, 6
FROM public.modules WHERE slug = 'verbal-sentences-imperative';

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', 'Direct Address: Yā Ayyuhā' FROM public.lessons WHERE slug = 'direct-address-ya-ayyuha';
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', 'Adresse directe : Yā Ayyuhā' FROM public.lessons WHERE slug = 'direct-address-ya-ayyuha';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Arabic has a special word for calling out to someone directly: yā (''O''). It often appears with ayyuhā, an intensifier meaning roughly ''you there'' -- together, yā ayyuhā means ''O you''.',
  'L''arabe possède un mot particulier pour interpeller directement quelqu''un : yā (« Ô »). Il apparaît souvent avec ayyuhā, un intensificateur signifiant à peu près « toi, là » -- ensemble, yā ayyuhā signifie « Ô vous ».'
FROM public.lessons WHERE slug = 'direct-address-ya-ayyuha';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 109, 1,
  'Qul yā ayyuhā l-kāfirūn: ''Say, O disbelievers.'' Qul (the imperative you just learned) commands you to address someone directly: yā ayyuhā l-kāfirūn, ''O you disbelievers''. Al-kāfirūn (''the disbelievers'') is a new word here -- notice the familiar al- prefix attached to its front.',
  'Qul yā ayyuhā l-kāfirūn : « Dis : Ô vous les dénégateurs. » Qul (l''impératif que vous venez d''apprendre) vous ordonne de vous adresser directement à quelqu''un : yā ayyuhā l-kāfirūn, « Ô vous les dénégateurs ». Al-kāfirūn (« les dénégateurs ») est un mot nouveau ici -- remarquez le préfixe familier al- attaché à son début.'
FROM public.lessons WHERE slug = 'direct-address-ya-ayyuha';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'tip',
  'Yā always signals that someone is being spoken to directly. Look for it right before the person or group being addressed.',
  'Yā signale toujours que l''on s''adresse directement à quelqu''un. Repérez-le juste avant la personne ou le groupe interpellé.'
FROM public.lessons WHERE slug = 'direct-address-ya-ayyuha';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  'You can now recognize yā ayyuhā as a direct-address pattern, meaning ''O you'', introducing who is being spoken to.',
  'Vous pouvez maintenant reconnaître yā ayyuhā comme une formule d''adresse directe, signifiant « Ô vous », introduisant la personne à qui l''on s''adresse.'
FROM public.lessons WHERE slug = 'direct-address-ya-ayyuha';

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'en', s.body_en FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'direct-address-ya-ayyuha';
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'fr', s.body_fr FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'direct-address-ya-ayyuha';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'Yā ayyuhā means ''O you'', calling out to someone directly.',
  'Yā ayyuhā signifie « Ô vous », interpellant directement quelqu''un.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'direct-address-ya-ayyuha';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'In qul yā ayyuhā l-kāfirūn, which word is the direct-address marker meaning ''O''?',
  'Dans qul yā ayyuhā l-kāfirūn, quel mot est le marqueur d''adresse directe signifiant « Ô » ?',
  '{"choices": ["yā", "qul", "al-kāfirūn"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'direct-address-ya-ayyuha';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match the grammar concept to its description.',
  'Associez le concept grammatical à sa description.',
  '{"pairs": [
    {"left": "particle-ya", "right": "yā (\"O\") -- a vocative particle marking direct address, as in yā ayyuhā l-kāfirūn (\"O you disbelievers\")"}
  ]}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'direct-address-ya-ayyuha';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'en', e.prompt_en, e.payload FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'direct-address-ya-ayyuha';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'fr', e.prompt_fr,
  CASE e.order_index
    WHEN 0 THEN '{"correctAnswer": true}'::jsonb
    WHEN 1 THEN '{"choices": ["yā", "qul", "al-kāfirūn"], "correctIndex": 0}'::jsonb
    WHEN 2 THEN '{"pairs": [
      {"left": "particle-ya", "right": "yā (« Ô ») -- une particule vocative marquant l''adresse directe, comme dans yā ayyuhā l-kāfirūn (« Ô vous les dénégateurs »)"}
    ]}'::jsonb
  END
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'direct-address-ya-ayyuha';

-- =========================================================================
-- 2. Module 4: guided-comprehension-capstone.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'guided-comprehension-capstone', 'Guided Comprehension Capstone', 'Aboutissement de la compréhension guidée', 3
FROM public.levels WHERE slug = 'guided-ayah-comprehension';

INSERT INTO public.module_translations (module_id, locale, title)
SELECT id, 'en', 'Guided Comprehension Capstone' FROM public.modules WHERE slug = 'guided-comprehension-capstone';
INSERT INTO public.module_translations (module_id, locale, title)
SELECT id, 'fr', 'Aboutissement de la compréhension guidée' FROM public.modules WHERE slug = 'guided-comprehension-capstone';

-- -------------------------------------------------------------------------
-- 2.1 Lesson: guided-decomposition-al-kawthar (capstone -- pure synthesis,
--     zero new review items, mirroring Batch 1's own capstone).
-- -------------------------------------------------------------------------

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'guided-decomposition-al-kawthar', 'Guided Decomposition: Sūrah Al-Kawthar', 'Décomposition guidée : sourate Al-Kawthar', 0, 8
FROM public.modules WHERE slug = 'guided-comprehension-capstone';

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', 'Guided Decomposition: Sūrah Al-Kawthar' FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', 'Décomposition guidée : sourate Al-Kawthar' FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You now recognize particles, past-tense verbs, imperatives, and nominal sentences. Let''s put it all together with three short, complete verses: Sūrah Al-Kawthar.',
  'Vous reconnaissez maintenant les particules, les verbes au passé, les impératifs et les phrases nominales. Assemblons le tout avec trois courts versets complets : la sourate Al-Kawthar.'
FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 108, 1,
  'Innā a''ṭaynāka l-kawthar: ''Indeed, We have given you al-Kawthar.'' A''ṭaynā (''We gave'') is a completed action -- past tense, just like khalaqa -- even though the ending looks different here because it is ''We'' who acted, not ''He''. -ka (''you'') is attached to the end.',
  'Innā a''ṭaynāka l-kawthar : « Certes, Nous t''avons donné al-Kawthar. » A''ṭaynā (« Nous avons donné ») est une action accomplie -- un verbe au passé, tout comme khalaqa -- même si la terminaison paraît différente ici, car c''est « Nous » qui avons agi, et non « Il ». -ka (« toi ») est attaché à la fin.'
FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 108, 2,
  'Fa-ṣalli li-rabbika wa-nḥar: ''So pray to your Lord and sacrifice.'' Ṣalli and inḥar are both imperatives -- commands, like qul -- addressed directly to you. Li- (''to/for'') is attached to rabbika (''your Lord''), the same rabb you have known since Level 2.',
  'Fa-ṣalli li-rabbika wa-nḥar : « Prie donc ton Seigneur et sacrifie. » Ṣalli et inḥar sont tous deux des impératifs -- des ordres, comme qul -- adressés directement à vous. Li- (« à/pour ») est attaché à rabbika (« ton Seigneur »), le même rabb que vous connaissez depuis le Niveau 2.'
FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 108, 3,
  'Inna shāni''aka huwa l-abtar: ''Indeed, your enemy is the one cut off.'' Huwa links a subject to its description, just like in huwa llahu ahad -- a nominal sentence, no action verb needed. Al-abtar (''the one cut off'') carries the same al- prefix you met in Module 1.',
  'Inna shāni''aka huwa l-abtar : « Certes, ton ennemi est celui qui est coupé. » Huwa relie un sujet à sa description, tout comme dans huwa llahu ahad -- une phrase nominale, sans besoin de verbe d''action. Al-abtar (« celui qui est coupé ») porte le même préfixe al- que vous avez rencontré au Module 1.'
FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'Three short verses can pack a completed action, two commands, and a nominal sentence -- exactly the four building blocks you have learned across Level 5.',
  'Trois courts versets peuvent réunir une action accomplie, deux ordres et une phrase nominale -- exactement les quatre éléments que vous avez appris tout au long du Niveau 5.'
FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You have completed Level 5! You can recognize attached and independent particles, past-tense verbs, imperatives, direct address, and nominal sentences in short, authentic Qur''anic verses.',
  'Vous avez terminé le Niveau 5 ! Vous pouvez reconnaître les particules attachées et indépendantes, les verbes au passé, les impératifs, l''adresse directe et les phrases nominales dans de courts versets coraniques authentiques.'
FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'en', s.body_en FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'guided-decomposition-al-kawthar';
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'fr', s.body_fr FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, 0, 'reading_check', a.arabic_text || ' reads:', a.arabic_text || ' se lit :',
  '{"choices": ["innā a''ṭaynāka l-kawthar", "innā a''ṭaynāka l-kawthara", "innahu a''ṭaynāka l-kawthar"], "correctIndex": 0}'::jsonb,
  108, 1, 'concept'
FROM public.lessons l, public.ayahs a
WHERE l.slug = 'guided-decomposition-al-kawthar' AND a.surah_number = 108 AND a.ayah_number = 1;

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'Which word in 108:2 is an imperative (a command)?',
  'Quel mot du verset 108:2 est un impératif (un ordre) ?',
  '{"choices": ["ṣalli", "rabbika", "wa"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'Huwa in 108:3 introduces a verbal (action) sentence, not a nominal one.',
  'Huwa dans 108:3 introduit une phrase verbale (d''action), et non une phrase nominale.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'multiple_choice',
  'Which prefix in these verses means ''the''?',
  'Quel préfixe dans ces versets signifie « le/la » ?',
  '{"choices": ["al-", "bi-", "fa-"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'en', e.prompt_en, e.payload FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'guided-decomposition-al-kawthar';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'fr', e.prompt_fr,
  CASE e.order_index
    WHEN 0 THEN '{"choices": ["innā a''ṭaynāka l-kawthar", "innā a''ṭaynāka l-kawthara", "innahu a''ṭaynāka l-kawthar"], "correctIndex": 0}'::jsonb
    WHEN 1 THEN '{"choices": ["ṣalli", "rabbika", "wa"], "correctIndex": 0}'::jsonb
    WHEN 2 THEN '{"correctAnswer": false}'::jsonb
    WHEN 3 THEN '{"choices": ["al-", "bi-", "fa-"], "correctIndex": 0}'::jsonb
  END
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'guided-decomposition-al-kawthar';

-- =========================================================================
-- 3. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_level_id uuid;
  v_module_count integer;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_matching_count integer;
  v_wf_count integer;
  v_l1_lesson_count integer;
  v_l2_lesson_count integer;
  v_l3_lesson_count integer;
  v_l4_lesson_count integer;
  v_l6_id uuid;
  v_l6_slug text;
  v_l6_modules integer;
  v_module_count_total integer;
  v_lesson_count_total integer;
  v_section_count_total integer;
  v_exercise_count_total integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'guided-ayah-comprehension';

  SELECT count(*) INTO v_module_count FROM public.modules WHERE level_id = v_level_id;
  IF v_module_count <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 modules under guided-ayah-comprehension after this migration, found %.', v_module_count;
  END IF;

  SELECT count(*) INTO v_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id WHERE m.level_id = v_level_id;
  IF v_lesson_count <> 7 THEN
    RAISE EXCEPTION 'Expected exactly 7 lessons under guided-ayah-comprehension after this migration, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections s
  JOIN public.lessons l ON l.id = s.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('verbal-sentences-imperative', 'guided-comprehension-capstone');
  IF v_section_count <> 16 THEN
    RAISE EXCEPTION 'Expected exactly 16 new lesson_sections in this migration''s modules, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('verbal-sentences-imperative', 'guided-comprehension-capstone');
  IF v_exercise_count <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 new lesson_exercises in this migration''s modules, found %.', v_exercise_count;
  END IF;

  SELECT count(*) INTO v_matching_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('verbal-sentences-imperative', 'guided-comprehension-capstone') AND e.exercise_type = 'matching';
  IF v_matching_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 matching exercises in this migration''s modules, found %.', v_matching_count;
  END IF;

  -- Zero matching exercises in the pure-synthesis capstone lesson.
  IF EXISTS (
    SELECT 1 FROM public.lesson_exercises e
    JOIN public.lessons l ON l.id = e.lesson_id
    WHERE l.slug = 'guided-decomposition-al-kawthar' AND e.exercise_type = 'matching'
  ) THEN
    RAISE EXCEPTION 'Expected zero matching exercises in guided-decomposition-al-kawthar.';
  END IF;

  -- Every EN/FR normalized translation exists for every new row, and no
  -- unexpected ar/ur/id row was introduced anywhere in these modules.
  IF (SELECT count(DISTINCT mt.locale) FROM public.module_translations mt
      JOIN public.modules m ON m.id = mt.module_id
      WHERE m.slug IN ('verbal-sentences-imperative', 'guided-comprehension-capstone')) <> 2 THEN
    RAISE EXCEPTION 'Expected exactly en+fr module_translations coverage for this migration''s modules.';
  END IF;

  IF (SELECT count(*) FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      WHERE m.slug IN ('verbal-sentences-imperative', 'guided-comprehension-capstone')
      AND (SELECT count(*) FROM public.lesson_translations lt WHERE lt.lesson_id = l.id AND lt.locale IN ('en','fr')) <> 2
     ) <> 0 THEN
    RAISE EXCEPTION 'Expected every Level 5 Batch 2 lesson to have exactly en+fr lesson_translations rows.';
  END IF;

  IF (SELECT count(*) FROM public.lesson_sections s
      JOIN public.lessons l ON l.id = s.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      WHERE m.slug IN ('verbal-sentences-imperative', 'guided-comprehension-capstone')
      AND (SELECT count(*) FROM public.lesson_section_translations st WHERE st.section_id = s.id AND st.locale IN ('en','fr')) <> 2
     ) <> 0 THEN
    RAISE EXCEPTION 'Expected every Level 5 Batch 2 section to have exactly en+fr lesson_section_translations rows.';
  END IF;

  IF (SELECT count(*) FROM public.lesson_exercises e
      JOIN public.lessons l ON l.id = e.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      WHERE m.slug IN ('verbal-sentences-imperative', 'guided-comprehension-capstone')
      AND (SELECT count(*) FROM public.lesson_exercise_translations et WHERE et.exercise_id = e.id AND et.locale IN ('en','fr')) <> 2
     ) <> 0 THEN
    RAISE EXCEPTION 'Expected every Level 5 Batch 2 exercise to have exactly en+fr lesson_exercise_translations rows.';
  END IF;

  -- No unexpected ar/ur/id rows anywhere in the whole schema (broad check,
  -- not just this migration's rows).
  IF (
    (SELECT count(*) FROM public.level_translations WHERE locale NOT IN ('en','fr')) +
    (SELECT count(*) FROM public.module_translations WHERE locale NOT IN ('en','fr')) +
    (SELECT count(*) FROM public.lesson_translations WHERE locale NOT IN ('en','fr')) +
    (SELECT count(*) FROM public.lesson_section_translations WHERE locale NOT IN ('en','fr')) +
    (SELECT count(*) FROM public.lesson_exercise_translations WHERE locale NOT IN ('en','fr'))
  ) <> 0 THEN
    RAISE EXCEPTION 'Expected zero non-en/fr translation rows anywhere in the schema.';
  END IF;

  -- levels.number=6 (quranic-comprehension) must be completely untouched.
  SELECT id, slug INTO v_l6_id, v_l6_slug FROM public.levels WHERE number = 6;
  IF v_l6_slug <> 'quranic-comprehension' THEN
    RAISE EXCEPTION 'Expected levels.number=6 to remain quranic-comprehension, found %.', v_l6_slug;
  END IF;
  SELECT count(*) INTO v_l6_modules FROM public.modules WHERE level_id = v_l6_id;
  IF v_l6_modules <> 0 THEN
    RAISE EXCEPTION 'Expected levels.number=6 to remain at zero modules, found %.', v_l6_modules;
  END IF;

  -- word_frequency must remain at exactly 20 rows -- no new vocabulary added.
  SELECT count(*) INTO v_wf_count FROM public.word_frequency;
  IF v_wf_count <> 20 THEN
    RAISE EXCEPTION 'Expected word_frequency to remain at exactly 20 rows, found %.', v_wf_count;
  END IF;

  -- Levels 1-4 untouched.
  SELECT count(*) INTO v_l1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.levels lv ON lv.id = m.level_id WHERE lv.slug = 'foundations-of-arabic-script';
  IF v_l1_lesson_count <> 33 THEN
    RAISE EXCEPTION 'Expected Level 1 to remain untouched at 33 lessons, found %.', v_l1_lesson_count;
  END IF;

  SELECT count(*) INTO v_l2_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.levels lv ON lv.id = m.level_id WHERE lv.slug = 'basic-vocabulary-and-patterns';
  IF v_l2_lesson_count <> 10 THEN
    RAISE EXCEPTION 'Expected Level 2 to remain untouched at 10 lessons, found %.', v_l2_lesson_count;
  END IF;

  SELECT count(*) INTO v_l3_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.levels lv ON lv.id = m.level_id WHERE lv.slug = 'roots-and-word-patterns';
  IF v_l3_lesson_count <> 4 THEN
    RAISE EXCEPTION 'Expected Level 3 to remain untouched at 4 lessons, found %.', v_l3_lesson_count;
  END IF;

  SELECT count(*) INTO v_l4_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.levels lv ON lv.id = m.level_id WHERE lv.slug = 'core-grammar';
  IF v_l4_lesson_count <> 4 THEN
    RAISE EXCEPTION 'Expected Level 4 to remain untouched at 4 lessons, found %.', v_l4_lesson_count;
  END IF;

  -- Level 5 Batch 1 (attached-particles, verbal-sentences-past) untouched.
  IF (SELECT count(*) FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      WHERE m.slug IN ('attached-particles', 'verbal-sentences-past')) <> 4 THEN
    RAISE EXCEPTION 'Expected Level 5 Batch 1 modules to remain untouched at 4 lessons.';
  END IF;

  -- Global totals: +2 modules, +3 lessons, +16 sections, +10 exercises.
  SELECT count(*) INTO v_module_count_total FROM public.modules;
  IF v_module_count_total <> 23 THEN
    RAISE EXCEPTION 'Expected exactly 23 modules total after this migration, found %.', v_module_count_total;
  END IF;
  SELECT count(*) INTO v_lesson_count_total FROM public.lessons;
  IF v_lesson_count_total <> 58 THEN
    RAISE EXCEPTION 'Expected exactly 58 lessons total after this migration, found %.', v_lesson_count_total;
  END IF;
  SELECT count(*) INTO v_section_count_total FROM public.lesson_sections;
  IF v_section_count_total <> 300 THEN
    RAISE EXCEPTION 'Expected exactly 300 lesson_sections total after this migration, found %.', v_section_count_total;
  END IF;
  SELECT count(*) INTO v_exercise_count_total FROM public.lesson_exercises;
  IF v_exercise_count_total <> 236 THEN
    RAISE EXCEPTION 'Expected exactly 236 lesson_exercises total after this migration, found %.', v_exercise_count_total;
  END IF;

  RAISE NOTICE 'Level 5 Batch 2 migration post-insert assertions passed: % modules, % lessons, % sections (new), % exercises (new, % matching).',
    v_module_count, v_lesson_count, v_section_count, v_exercise_count, v_matching_count;
END $$;

-- Level 4 (Core Grammar) Batch 1 (Gate A+B): "pronouns-and-nominal-sentences"
-- and "agreement-and-genitive-constructions" -- the first two Level 4
-- modules, authored together as one consolidated batch. Level 4's
-- identity (core-grammar) is pre-seeded in the levels table, not
-- invented here.
--
-- ARCHITECTURE: zero schema changes, zero RLS changes, zero new
-- exercise types, zero new review-item types. 'concept' already exists
-- in both CHECK constraints and was already in live use before this
-- batch (e.g. the pre-existing 'letter-positions' and 'grammar:بِسْمِ'
-- items) -- this batch is simply new DATA flowing through the existing
-- generic matching -> review-item mechanism, exactly like every prior
-- level. The one required application-code change (STEP_LEVEL_SLUGS
-- gaining a 'grammar' entry in src/lib/placement.ts) ships alongside
-- this migration, not inside it.
--
-- CONTENT SOURCE: zero new vocabulary, zero new ayahs. Every word
-- reused here (huwa rank 12, sirat rank 9, mustaqim rank 10) was
-- already fully taught. Every ayah reused here (112:1, 1:6, 1:2, 1:4,
-- 114:2) was already cached in `ayahs` and already shown at least once
-- in a prior lesson_section -- confirmed by direct query before
-- authoring, not invented. This batch teaches the GRAMMAR of already-
-- known words and already-read ayahs; it introduces no new Arabic
-- vocabulary or Qur'anic text at all.
--
-- MODULE 1 (pronouns-and-nominal-sentences, order_index 0): 1 lesson.
-- Teaches huwa as an independent pronoun and the resulting nominal-
-- sentence structure (subject + description, no verb "to be") using
-- 112:1 (Qul huwa Allahu ahad), already shown twice before this batch.
--
-- MODULE 2 (agreement-and-genitive-constructions, order_index 1): 2
-- lessons. Lesson 1 teaches definite noun-adjective word order using
-- sirat/mustaqim in 1:6 (already shown twice). Lesson 2 teaches the
-- "X of Y" (idafa) construction using 1:2 and 1:4 (each already shown
-- four times), reinforced with a third already-known example, 114:2
-- (already shown twice) -- deliberately NOT also 114:3, to avoid
-- padding a construction that 1:2/1:4/114:2 already establish clearly.
--
-- EXCLUDED (per the approved design): case endings, full pronoun
-- paradigms, verb conjugation, irregular agreement, gender/case
-- exceptions, exhaustive genitive theory, iʿrāb, and attached (suffix)
-- pronouns -- none of these are taught anywhere in this batch.
--
-- TERMINOLOGY GOVERNANCE (resolves both Level 4 design YELLOW items):
-- neither "naʿt" nor "iḍāfa" (nor "agreement", "genitive case", or
-- iʿrāb) is ever surfaced to the learner. The noun-adjective
-- relationship is taught by plain observation ("a describing word
-- comes right after the noun it describes, and both use 'the'
-- together"); the idafa relationship is taught the same way ("two
-- nouns placed side by side to mean 'X of Y', with no separate word
-- for 'of'"). This mirrors the precedent already set by Level 3 Batch
-- 1's own French root/pattern terminology decision: describe the
-- relationship in a sentence rather than coin a label to memorize.
-- review_item_type/item_key strings below (e.g. 'idafa-construct') are
-- internal identifiers only, never rendered as prose to a learner.
--
-- REVIEW ITEMS: exactly 4 new 'concept' items across the whole batch
-- (pronoun-huwa, nominal-sentence, noun-adjective-agreement,
-- idafa-construct), each seeded by a matching exercise through the
-- existing, unmodified seedLessonReviewItems pipeline -- item_key =
-- 'concept:<slug>', front = <slug>, back = a short EN/FR gloss. No new
-- code path; only new DATA.
--
-- CONTENT GOVERNANCE: RED ITEMS: 0. YELLOW ITEMS: 0 (resolved above).

DO $$
DECLARE
  v_level_id uuid;
  v_existing_modules integer;
  v_existing_lessons integer;
  v_wf_populated integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'core-grammar';
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Expected the core-grammar level to already exist. Aborting.';
  END IF;

  SELECT count(*) INTO v_existing_modules FROM public.modules WHERE level_id = v_level_id;
  IF v_existing_modules <> 0 THEN
    RAISE EXCEPTION 'Expected zero existing modules under core-grammar, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_lessons FROM public.lessons
  WHERE slug IN ('he-is-allah-one', 'the-straight-path', 'lord-of-the-worlds');
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 3 Batch 1 lesson slugs to already exist, found %.', v_existing_lessons;
  END IF;

  SELECT count(*) INTO v_wf_populated FROM public.word_frequency
  WHERE frequency_rank IN (9, 10, 12) AND word IS NOT NULL AND transliteration IS NOT NULL AND meaning IS NOT NULL;
  IF v_wf_populated <> 3 THEN
    RAISE EXCEPTION 'Expected all 3 target word_frequency rows (ranks 9,10,12) to be fully populated, found %.', v_wf_populated;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 112 AND ayah_number = 1) THEN
    RAISE EXCEPTION 'Expected ayah 112:1 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 1 AND ayah_number = 6) THEN
    RAISE EXCEPTION 'Expected ayah 1:6 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 1 AND ayah_number = 2) THEN
    RAISE EXCEPTION 'Expected ayah 1:2 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 1 AND ayah_number = 4) THEN
    RAISE EXCEPTION 'Expected ayah 1:4 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 114 AND ayah_number = 2) THEN
    RAISE EXCEPTION 'Expected ayah 114:2 to already be cached.';
  END IF;
END $$;

-- =========================================================================
-- 1. Modules.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'pronouns-and-nominal-sentences', 'Pronouns and Simple Sentences', 'Pronoms et phrases simples', 0
FROM public.levels WHERE slug = 'core-grammar';

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'agreement-and-genitive-constructions', 'Describing Words and ''Of'' Phrases', 'Mots descriptifs et constructions avec « de »', 1
FROM public.levels WHERE slug = 'core-grammar';

-- =========================================================================
-- 2. Module pronouns-and-nominal-sentences, Lesson 1: he-is-allah-one.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'he-is-allah-one', 'He Is Allah, One', 'Il est Allah, Unique', 0, 7
FROM public.modules WHERE slug = 'pronouns-and-nominal-sentences';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Arabic often builds a full sentence without needing a word for "is." A pronoun like "he" can stand as the subject, and the words that follow describe or name that subject directly. You already know all the words in the example ahead.',
  'L''arabe construit souvent une phrase complète sans avoir besoin d''un mot pour « est ». Un pronom comme « il » peut être le sujet, et les mots qui suivent le décrivent ou le nomment directement. Vous connaissez déjà tous les mots de l''exemple qui suit.'
FROM public.lessons WHERE slug = 'he-is-allah-one'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 1, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '." This is a pronoun -- a word that stands in for a name.',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ». Ceci est un pronom — un mot qui remplace un nom.'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'he-is-allah-one' AND wf.frequency_rank = 12;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 112, 1,
  'You have read this ayah many times already. Huwa opens the sentence as its subject; the words after it, "Allah, [who is] One," describe who "he" is -- with no separate word needed for "is."',
  'Vous avez déjà lu ce verset de nombreuses fois. Huwa ouvre la phrase comme sujet ; les mots qui suivent, « Allah, Unique », décrivent qui est « il » — sans qu''aucun mot séparé ne soit nécessaire pour « est ».'
FROM public.lessons WHERE slug = 'he-is-allah-one';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'A sentence like this -- subject, then description, no verb "to be" -- is called a nominal sentence. It is one of the most common sentence shapes in the Qur''an.',
  'Une phrase de ce type — sujet, puis description, sans verbe « être » — est appelée une phrase nominale. C''est l''une des structures de phrase les plus courantes dans le Coran.'
FROM public.lessons WHERE slug = 'he-is-allah-one';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now recognize huwa as a pronoun, and recognize a nominal sentence when you see one.',
  'Vous pouvez maintenant reconnaître huwa comme un pronom, et reconnaître une phrase nominale lorsque vous en voyez une.'
FROM public.lessons WHERE slug = 'he-is-allah-one';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'Huwa is a pronoun meaning "he."',
  'Huwa est un pronom qui signifie « il ».',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'he-is-allah-one';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'What is missing from the sentence "Huwa Allahu ahad" compared to its English translation, "He is Allah, One"?',
  'Qu''est-ce qui manque dans la phrase « Huwa Allahu ahad » par rapport à sa traduction française, « Il est Allah, Unique » ?',
  '{"choices": ["The word for \"is\"", "The word for \"he\"", "The word for \"Allah\""], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'he-is-allah-one';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each idea to what it means.',
  'Associez chaque idée à sa signification.',
  jsonb_build_object('pairs', jsonb_build_array(
    jsonb_build_object('left', 'pronoun-huwa', 'right', 'huwa ("he") -- a pronoun standing in for a name, as in Qul huwa Allahu ahad'),
    jsonb_build_object('left', 'nominal-sentence', 'right', 'a sentence with no verb "to be" -- subject then description, as in Huwa Allahu ahad')
  )),
  'concept'
FROM public.lessons WHERE slug = 'he-is-allah-one';

-- =========================================================================
-- 3. Module agreement-and-genitive-constructions, Lesson 1: the-straight-path.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'the-straight-path', 'The Straight Path', 'Le droit chemin', 0, 7
FROM public.modules WHERE slug = 'agreement-and-genitive-constructions';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'In Arabic, a describing word (an adjective) comes right after the noun it describes -- the opposite order from English. When the noun has "the" (al-), the describing word takes "the" too.',
  'En arabe, un mot qui décrit (un adjectif) se place juste après le nom qu''il décrit — l''ordre inverse de celui du français. Quand le nom porte « le/la » (al-), le mot qui décrit le porte aussi.'
FROM public.lessons WHERE slug = 'the-straight-path'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 1, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'the-straight-path' AND wf.frequency_rank = 9;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 2, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '." Mustaqim describes sirat -- it comes right after it, and both carry "the."',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ». Mustaqim décrit sirat — il vient juste après lui, et tous deux portent « le/la ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'the-straight-path' AND wf.frequency_rank = 10;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 1, 6,
  'You have read this ayah many times already. Al-sirat al-mustaqim -- "the path, the straight [one]" -- the describing word directly follows the noun.',
  'Vous avez déjà lu ce verset de nombreuses fois. As-sirat al-mustaqim — « le chemin, le droit [chemin] » — le mot qui décrit suit directement le nom.'
FROM public.lessons WHERE slug = 'the-straight-path';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'Noun first, describing word second, both sharing "the." Once you notice this order, you will spot it constantly.',
  'Le nom d''abord, le mot qui décrit ensuite, tous deux partageant « le/la ». Une fois que vous remarquez cet ordre, vous le repérerez constamment.'
FROM public.lessons WHERE slug = 'the-straight-path';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You can now recognize a noun followed by its describing word in a familiar ayah.',
  'Vous pouvez maintenant reconnaître un nom suivi de son mot descriptif dans un verset familier.'
FROM public.lessons WHERE slug = 'the-straight-path';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'In "al-sirat al-mustaqim," the describing word (mustaqim) comes before the noun it describes.',
  'Dans « as-sirat al-mustaqim », le mot qui décrit (mustaqim) vient avant le nom qu''il décrit.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'the-straight-path';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'What does mustaqim do in "al-sirat al-mustaqim"?',
  'Que fait mustaqim dans « as-sirat al-mustaqim » ?',
  '{"choices": ["Describes sirat, the noun before it", "Names a different path", "Means \"the\""], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'the-straight-path';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match the idea to what it means.',
  'Associez l''idée à sa signification.',
  jsonb_build_object('pairs', jsonb_build_array(
    jsonb_build_object('left', 'noun-adjective-agreement', 'right', 'a describing word comes right after its noun and shares "the" with it, as in al-sirat al-mustaqim')
  )),
  'concept'
FROM public.lessons WHERE slug = 'the-straight-path';

-- =========================================================================
-- 4. Module agreement-and-genitive-constructions, Lesson 2: lord-of-the-worlds.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'lord-of-the-worlds', 'Lord of the Worlds', 'Seigneur de l''univers', 1, 7
FROM public.modules WHERE slug = 'agreement-and-genitive-constructions';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Arabic can link two nouns to mean "X of Y" with no separate word for "of" -- just placing them next to each other. You already know several examples of this.',
  'L''arabe peut lier deux noms pour signifier « X de Y » sans mot séparé pour « de » — en les plaçant simplement l''un à côté de l''autre. Vous connaissez déjà plusieurs exemples de cela.'
FROM public.lessons WHERE slug = 'lord-of-the-worlds'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 1, 2,
  'You have read this ayah many times already. Rabbi l-''alameen means "Lord of the worlds" -- rabb and al-''alameen are simply placed side by side, with no word for "of" anywhere.',
  'Vous avez déjà lu ce verset de nombreuses fois. Rabbi l-''alameen signifie « Seigneur de l''univers » — rabb et al-''alameen sont simplement placés l''un à côté de l''autre, sans aucun mot pour « de ».'
FROM public.lessons WHERE slug = 'lord-of-the-worlds';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 1, 4,
  'This ayah, also familiar, chains the same pattern twice: maliki yawmi l-din, "Sovereign of the Day of Recompense" -- three nouns in a row, each one linked to the next the same way.',
  'Ce verset, également familier, enchaîne le même schéma deux fois : maliki yawmi d-din, « Maître du Jour de la rétribution » — trois noms à la suite, chacun lié au suivant de la même façon.'
FROM public.lessons WHERE slug = 'lord-of-the-worlds';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 114, 2,
  'Here is the same pattern again, in a different ayah you already know: maliki n-nas, "the Sovereign of mankind." Once you notice this pattern, you will see it everywhere in the Qur''an.',
  'Voici le même schéma à nouveau, dans un autre verset que vous connaissez déjà : maliki n-nas, « le Souverain des hommes ». Une fois que vous remarquez ce schéma, vous le verrez partout dans le Coran.'
FROM public.lessons WHERE slug = 'lord-of-the-worlds';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'Two nouns side by side, the first one without "the" even when definite in meaning: that is the signal for an "X of Y" relationship.',
  'Deux noms côte à côte, le premier sans « le/la » même lorsqu''il est défini par le sens : c''est le signal d''une relation du type « X de Y ».'
FROM public.lessons WHERE slug = 'lord-of-the-worlds';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You can now recognize an "X of Y" phrase in a familiar ayah, even though Arabic never uses a separate word for "of."',
  'Vous pouvez maintenant reconnaître une expression du type « X de Y » dans un verset familier, même si l''arabe n''utilise jamais de mot séparé pour « de ».'
FROM public.lessons WHERE slug = 'lord-of-the-worlds';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'Rabbi l-''alameen ("Lord of the worlds") includes a separate Arabic word that means "of."',
  'Rabbi l-''alameen (« Seigneur de l''univers ») comprend un mot arabe séparé qui signifie « de ».',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'lord-of-the-worlds';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'How does Arabic show the "of" relationship in maliki yawmi l-din ("Sovereign of the Day of Recompense")?',
  'Comment l''arabe exprime-t-il la relation « de » dans maliki yawmi d-din (« Maître du Jour de la rétribution ») ?',
  '{"choices": ["By placing the nouns directly next to each other", "With a separate word meaning \"of\"", "With a verb"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'lord-of-the-worlds';

-- Deliberately NOT linked to a section_id: buildPlayerSteps (src/lib/
-- curriculum.ts) renders a section-linked exercise immediately after
-- that section, before the lesson's other content sections finish --
-- correct for Level 3 Batch 2's reading_check (its lesson's only
-- exercise), but here it would wrongly interleave this exercise
-- between quran_example sections 1 and 2. Left as an ordinary
-- order_index-3 exercise instead, alongside the other three.
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, 2, 'reading_check', a.arabic_text || ' reads:', a.arabic_text || ' se lit :',
  jsonb_build_object(
    'choices', jsonb_build_array(
      'al-hamdu lillahi rabbi l-''aalameen',
      'al-hamdu lillahi maliki l-''aalameen',
      'al-hamdu billahi rabbi l-''aalameen'
    ),
    'correctIndex', 0
  ), 1, 2, 'concept'
FROM public.lessons l, public.ayahs a
WHERE l.slug = 'lord-of-the-worlds' AND a.surah_number = 1 AND a.ayah_number = 2;

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'matching',
  'Match the idea to what it means.',
  'Associez l''idée à sa signification.',
  jsonb_build_object('pairs', jsonb_build_array(
    jsonb_build_object('left', 'idafa-construct', 'right', 'two nouns placed side by side to mean "X of Y," with no separate word for "of," as in rabbi l-''alameen ("Lord of the worlds")')
  )),
  'concept'
FROM public.lessons WHERE slug = 'lord-of-the-worlds';

-- =========================================================================
-- 5. Post-insert assertions.
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
  v_matching_count integer;
  v_reading_check_count integer;
  v_l1_lesson_count integer;
  v_l2_lesson_count integer;
  v_l3_lesson_count integer;
  v_wf_count integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'core-grammar';

  SELECT count(*) INTO v_module_count FROM public.modules WHERE level_id = v_level_id;
  IF v_module_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 modules under core-grammar, found %.', v_module_count;
  END IF;

  SELECT count(*) INTO v_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_level_id;
  IF v_lesson_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 lessons under core-grammar, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections s
  JOIN public.lessons l ON l.id = s.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_level_id;
  IF v_section_count <> 17 THEN
    RAISE EXCEPTION 'Expected exactly 17 lesson_sections in Batch 1, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_level_id;
  IF v_exercise_count <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 lesson_exercises in Batch 1, found %.', v_exercise_count;
  END IF;

  SELECT count(*) INTO v_matching_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_level_id AND e.exercise_type = 'matching';
  IF v_matching_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 matching exercises in Batch 1, found %.', v_matching_count;
  END IF;

  SELECT count(*) INTO v_reading_check_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_level_id AND e.exercise_type = 'reading_check';
  IF v_reading_check_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 reading_check exercise in Batch 1, found %.', v_reading_check_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lesson_exercises e
    JOIN public.lessons l ON l.id = e.lesson_id
    JOIN public.modules m ON m.id = l.module_id
    WHERE m.level_id = v_level_id AND e.review_item_type <> 'concept'
  ) THEN
    RAISE EXCEPTION 'Expected every Batch 1 exercise to have review_item_type = concept.';
  END IF;

  -- Exactly 4 concept pairs across the 3 matching exercises (2 + 1 + 1).
  IF (
    SELECT sum(jsonb_array_length(e.payload -> 'pairs')) FROM public.lesson_exercises e
    JOIN public.lessons l ON l.id = e.lesson_id
    JOIN public.modules m ON m.id = l.module_id
    WHERE m.level_id = v_level_id AND e.exercise_type = 'matching'
  ) <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 total concept pairs across Batch 1 matching exercises.';
  END IF;

  -- word_frequency untouched: still exactly 20 rows, no new vocabulary.
  SELECT count(*) INTO v_wf_count FROM public.word_frequency;
  IF v_wf_count <> 20 THEN
    RAISE EXCEPTION 'Expected word_frequency to remain at exactly 20 rows (zero new vocabulary in Level 4 Batch 1), found %.', v_wf_count;
  END IF;

  -- Levels 1, 2 and 3 completely untouched.
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

  -- order_index sanity, scoped to Level 4.
  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE level_id = v_level_id AND slug = 'pronouns-and-nominal-sentences' AND order_index = 0
  ) THEN
    RAISE EXCEPTION 'Expected pronouns-and-nominal-sentences at order_index 0 under Level 4.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE level_id = v_level_id AND slug = 'agreement-and-genitive-constructions' AND order_index = 1
  ) THEN
    RAISE EXCEPTION 'Expected agreement-and-genitive-constructions at order_index 1 under Level 4.';
  END IF;

  RAISE NOTICE 'Level 4 Batch 1 migration post-insert assertions passed: % modules, % lessons, % sections, % exercises, % matching exercises, % reading_check exercises.',
    v_module_count, v_lesson_count, v_section_count, v_exercise_count, v_matching_count, v_reading_check_count;
END $$;

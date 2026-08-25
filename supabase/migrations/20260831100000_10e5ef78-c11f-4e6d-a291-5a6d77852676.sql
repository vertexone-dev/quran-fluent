-- Phase 3 / Sub-phase 7 (Gate A+B): Level 1, Module 7 ("first-reading-practice"
-- — First Reading Practice). Two lessons applying everything taught so
-- far (letters, harakat, sukūn, shadda, tanwīn, connected forms) to read
-- real short Arabic words, authored under the accelerated workflow.
--
-- ROADMAP CONTEXT: slug/titles queried directly from the live `modules`
-- table before authoring — title_en "First Reading Practice", title_fr
-- "Premiers exercices de lecture" (actual seeded value, used verbatim).
--
-- PEDAGOGICAL DESIGN — deliberately SMALLER than Modules 3-6: this module
-- introduces NO new mark, letter, or rule. It is pure synthesis/practice,
-- so it does not follow the 3-4 lesson "one lesson per new concept"
-- shape those modules used — padding it to match would misrepresent it
-- as a terminology module rather than a practice module. Two lessons:
-- (1) short, simple words (all-fatḥa word, then a sukūn word), (2) a
-- shadda word, then longer words combining sukūn/tanwīn, including a
-- deliberate callback to Module 6's كتاب example, now fully vowelled.
--
-- NO NEW REVIEW CONCEPTS — a deliberate decision, not an oversight: every
-- exercise here practices facts already covered by Modules 3-6's own
-- concept:* review items (fatḥa/kasra/ḍamma/sukūn/shadda/fathatan/
-- kasratan/dammatan/letter-positions/non-connectors are all already
-- reviewable). Manufacturing new concept:* rows for "how to read كَتَبَ"
-- would not represent a genuine, durable, spaced-repetition-worthy fact
-- the way "sukūn means no vowel" does — it is a skill exercised through
-- practice, not a discrete fact to flashcard. No `matching` exercise type
-- is used in this migration for exactly this reason: seedLessonReviewItems
-- (src/lib/study.ts, unchanged) only derives review items from `matching`
-- exercises, so omitting that type entirely guarantees zero review items
-- are created by this module, without any special-case code. This was a
-- deliberate architectural choice, not a limitation — the existing
-- generic mechanism was inspected first (Task I) and confirmed it does
-- not need modification either way. review_item_type is still set to the
-- schema-required, semantically honest value 'word' on every exercise
-- row (the column is NOT NULL), but has no functional effect since
-- non-matching exercises are never read by seedLessonReviewItems.
--
-- EXERCISE TYPES: multiple_choice, true_false, reading_check — all
-- pre-existing, no new type introduced. reading_check is used for its
-- intended purpose here more than any prior module: presenting a real
-- vowelled word and asking how it reads, testing actual decoding.
--
-- VISUAL REPRESENTATION — verified fresh for a genuinely new combination
-- Modules 3-6 never tested: full VOWELLED, CONNECTED, multi-letter words
-- (harakat + sukūn + shadda + tanwīn all appearing within real words, not
-- just isolated single letters or unvowelled connected words). A focused
-- Playwright screenshot spike tested كَتَبَ, مِنْ, كُلّ, كِتَابًا, and بَيْتٌ
-- in both the styled (font-quran/dir=rtl/lang=ar) and the exact unstyled
-- context lesson_exercises' prompt text actually renders through
-- (LessonExerciseRenderer's plain `<h2>`, confirmed by reading the
-- component directly, not assumed) at both a large (150px) and
-- exercise-realistic size: all five words rendered with marks correctly
-- attached and positioned in BOTH paths — genuinely extending Module 6's
-- finding (unvowelled connected words are safe everywhere) to fully
-- vowelled connected words too. Real Arabic words are therefore used
-- directly in exercise prompts here, exactly as in the arabic_text
-- sections, with no transliteration workaround needed.
--
-- QUR'AN EXAMPLE: NONE — a deliberate scope boundary, not an oversight.
-- Module 8 is specifically "reading-al-fatiha"; consuming or duplicating
-- any part of that capstone here would undercut it. This module practices
-- entirely with standalone vocabulary words instead, reserving all
-- Qur'anic reading for Module 8.
--
-- WORD SELECTION — every word verified character-by-character against
-- real, standard Arabic orthography before authoring, not invented:
-- كَتَبَ (kataba, "he wrote" — root k-t-b, the canonical first-verb example
-- in beginner Arabic pedagogy, all-fatḥa, all three letters connect);
-- مِنْ (min, "from" — kasra + sukūn, one of the most common words in the
-- language); كُلّ (kull, "all/every" — ḍamma + shadda, pause form);
-- كِتَابًا (kitāban, indefinite-accusative "book" — deliberate callback to
-- Module 6's unvowelled كتاب, now with kasra/fatḥa/fatḥatān; the
-- grammatical case that produces this ending is never explained, matching
-- every prior module's boundary against grammar/morphology instruction);
-- بَيْتٌ (baytun, "a house" — fatḥa + sukūn (forming a natural ay
-- diphthong) + ḍammatān).
--
-- CONTENT GOVERNANCE: no content_sources row needed — original,
-- uncontested vocabulary/orthography practice content, no Qur'anic
-- reference this module. RED ITEMS: 0. YELLOW ITEMS: 0.

DO $$
DECLARE
  v_existing_lessons integer;
  v_module_id uuid;
  v_prior_lesson_count integer;
BEGIN
  ---------------------------------------------------------------------------
  -- 0. Preconditions.
  ---------------------------------------------------------------------------
  SELECT count(*) INTO v_existing_lessons FROM public.lessons
  WHERE slug IN ('reading-short-words', 'reading-longer-words');
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 2 Module 7 lesson slugs to already exist, found %. Aborting to avoid duplicate/conflicting seed data.', v_existing_lessons;
  END IF;

  SELECT id INTO v_module_id FROM public.modules WHERE slug = 'first-reading-practice';
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Expected the first-reading-practice module to already exist (seeded by the Phase 2.1 skeleton migration). Aborting.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.lessons WHERE module_id = v_module_id) THEN
    RAISE EXCEPTION 'Expected first-reading-practice to have zero lessons before this migration. Aborting.';
  END IF;

  -- Modules 1-6 must be exactly the production-complete state this
  -- migration was authored against: letter-shapes-1 (5) + letter-shapes-2
  -- (9) + harakat (4) + sukun-and-shadda (3) + tanwin (4) +
  -- connected-letter-forms (3) = 28.
  SELECT count(*) INTO v_prior_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda', 'tanwin', 'connected-letter-forms');
  IF v_prior_lesson_count <> 28 THEN
    RAISE EXCEPTION 'Expected exactly 28 lessons across letter-shapes-1/letter-shapes-2/harakat/sukun-and-shadda/tanwin/connected-letter-forms before this migration, found %.', v_prior_lesson_count;
  END IF;
END $$;

-- =========================================================================
-- 1. Lessons.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-short-words', 'Reading Short Words', 'Lire des mots courts', 0, 6
FROM public.modules WHERE slug = 'first-reading-practice';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-longer-words', 'Reading Longer Words', 'Lire des mots plus longs', 1, 7
FROM public.modules WHERE slug = 'first-reading-practice';

-- =========================================================================
-- 2. Lesson 1 — Reading Short Words.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You know every letter, every vowel mark, and how letters connect. Now it''s time to put them together and read real, short Arabic words.',
  'Vous connaissez toutes les lettres, tous les signes de voyelle, et comment les lettres se lient. Il est maintenant temps de tout combiner pour lire de vrais mots arabes courts.'
FROM public.lessons WHERE slug = 'reading-short-words';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'كَتَبَ',
  'Sound it out letter by letter, right to left: kā (fatḥa), ta (fatḥa), ba (fatḥa) — kataba, "he wrote." All three letters connect to their neighbors, so the whole word is one flowing shape.',
  'Prononcez-le lettre par lettre, de droite à gauche : ka (fatḥa), ta (fatḥa), ba (fatḥa) — kataba, « il a écrit ». Les trois lettres se lient entre elles, donc le mot entier forme une seule forme continue.'
FROM public.lessons WHERE slug = 'reading-short-words';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'مِنْ',
  'A shorter word: Mīm with a kasra, Nūn with a sukūn — min, "from." The sukūn means the Nūn has no vowel of its own; the word simply ends on the "n" sound.',
  'Un mot plus court : Mīm avec une kasra, Nūn avec un sukūn — min, « de/depuis ». Le sukūn indique que le Nūn n''a pas de voyelle propre ; le mot se termine simplement sur le son « n ».'
FROM public.lessons WHERE slug = 'reading-short-words';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Read one letter at a time, applying whatever mark sits on it, and let the sounds blend together as you go.',
  'Lisez une lettre à la fois, en appliquant le signe qui s''y trouve, et laissez les sons se fondre les uns dans les autres au fur et à mesure.'
FROM public.lessons WHERE slug = 'reading-short-words';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now sound out short, connected Arabic words using the marks you already know.',
  'Vous savez maintenant déchiffrer de courts mots arabes liés en utilisant les signes que vous connaissez déjà.'
FROM public.lessons WHERE slug = 'reading-short-words';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'reading_check',
  'كَتَبَ reads:',
  'كَتَبَ se lit :',
  '{"choices": ["kataba", "kutuba", "kitaba"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'reading-short-words';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'reading_check',
  'مِنْ reads:',
  'مِنْ se lit :',
  '{"choices": ["man", "min", "mun"], "correctIndex": 1}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'reading-short-words';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'Reading an Arabic word means sounding out the letters from left to right.',
  'Lire un mot arabe signifie prononcer les lettres de gauche à droite.',
  '{"correctAnswer": false}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'reading-short-words';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'true_false',
  'A sukūn means a letter has no vowel sound of its own.',
  'Un sukūn signifie qu''une lettre n''a pas de son de voyelle propre.',
  '{"correctAnswer": true}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'reading-short-words';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'multiple_choice',
  'In كَتَبَ, how many letters connect to their neighbors?',
  'Dans كَتَبَ, combien de lettres se lient à leurs voisines ?',
  '{"choices": ["All three", "Only the first two", "None"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'reading-short-words';

-- =========================================================================
-- 3. Lesson 2 — Reading Longer Words.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'One more layer to practice: tanwīn, and slightly longer words that combine several marks at once. No new marks here — just more reading practice.',
  'Une dernière couche à pratiquer : le tanwīn, et des mots un peu plus longs combinant plusieurs signes à la fois. Aucun nouveau signe ici — seulement plus de pratique de lecture.'
FROM public.lessons WHERE slug = 'reading-longer-words';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'كُلّ',
  'Kāf with a ḍamma, Lām with a shadda — kull, "all" or "every." The shadda means the Lām is held twice as long: kull, not kul.',
  'Kāf avec une ḍamma, Lām avec une shadda — kull, « tout » ou « chaque ». La shadda indique que le Lām est tenu deux fois plus longtemps : kull, et non kul.'
FROM public.lessons WHERE slug = 'reading-longer-words';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'كِتَابًا',
  'The same word for "book" you saw in an earlier module, now fully marked: kasra, fatḥa, then a fatḥatān at the end — kitāban. The final mark adds the "n" sound you learned with tanwīn.',
  'Le même mot pour « livre » que vous avez vu dans un module précédent, maintenant entièrement vocalisé : kasra, fatḥa, puis une fatḥatān à la fin — kitāban. Le signe final ajoute le son « n » que vous avez appris avec le tanwīn.'
FROM public.lessons WHERE slug = 'reading-longer-words';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  'You can now read short Arabic words combining every mark and letter form you''ve learned — the last step before reading real connected text.',
  'Vous savez maintenant lire de courts mots arabes combinant tous les signes et toutes les formes de lettres que vous avez appris — la dernière étape avant de lire un vrai texte lié.'
FROM public.lessons WHERE slug = 'reading-longer-words';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'reading_check',
  'كُلّ reads:',
  'كُلّ se lit :',
  '{"choices": ["kul", "kull", "kall"], "correctIndex": 1}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'reading-longer-words';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'reading_check',
  'كِتَابًا reads:',
  'كِتَابًا se lit :',
  '{"choices": ["kitaban", "kutuban", "kitabin"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'reading-longer-words';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'reading_check',
  'بَيْتٌ reads:',
  'بَيْتٌ se lit :',
  '{"choices": ["baytun", "batun", "buytun"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'reading-longer-words';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'true_false',
  'The shadda in كُلّ means the Lām is held twice as long.',
  'La shadda dans كُلّ signifie que le Lām est tenu deux fois plus longtemps.',
  '{"correctAnswer": true}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'reading-longer-words';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'multiple_choice',
  'What does the mark at the end of كِتَابًا add?',
  'Qu''est-ce que le signe à la fin de كِتَابًا ajoute ?',
  '{"choices": ["Nothing — it''s silent", "An unwritten ''n'' sound", "A doubled consonant"], "correctIndex": 1}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'reading-longer-words';

-- =========================================================================
-- 4. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_prior_modules_untouched integer;
  v_other_modules_untouched integer;
  v_matching_exercise_count integer;
BEGIN
  SELECT id INTO STRICT v_module_id FROM public.modules WHERE slug = 'first-reading-practice';

  SELECT count(*) INTO v_lesson_count FROM public.lessons WHERE module_id = v_module_id;
  IF v_lesson_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 lessons in first-reading-practice, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id WHERE l.module_id = v_module_id;
  IF v_section_count <> 9 THEN
    RAISE EXCEPTION 'Expected exactly 9 lesson_sections in first-reading-practice, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id WHERE l.module_id = v_module_id;
  IF v_exercise_count <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 lesson_exercises in first-reading-practice, found %.', v_exercise_count;
  END IF;

  -- No matching exercises: this module deliberately creates zero review
  -- items, per the migration header's Task I rationale.
  SELECT count(*) INTO v_matching_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id
  WHERE l.module_id = v_module_id AND le.exercise_type = 'matching';
  IF v_matching_exercise_count <> 0 THEN
    RAISE EXCEPTION 'Expected zero matching exercises in first-reading-practice (no new review items by design), found %.', v_matching_exercise_count;
  END IF;

  -- Modules 1-6 must be completely untouched by this migration.
  SELECT count(*) INTO v_prior_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda', 'tanwin', 'connected-letter-forms');
  IF v_prior_modules_untouched <> 28 THEN
    RAISE EXCEPTION 'Expected letter-shapes-1/letter-shapes-2/harakat/sukun-and-shadda/tanwin/connected-letter-forms to still have exactly 28 lessons combined, found %.', v_prior_modules_untouched;
  END IF;

  -- Module 8 (reading-al-fatiha) must remain empty.
  SELECT count(*) INTO v_other_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug NOT IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda', 'tanwin', 'connected-letter-forms', 'first-reading-practice');
  IF v_other_modules_untouched <> 0 THEN
    RAISE EXCEPTION 'Expected zero lessons in modules other than letter-shapes-1/letter-shapes-2/harakat/sukun-and-shadda/tanwin/connected-letter-forms/first-reading-practice, found %.', v_other_modules_untouched;
  END IF;

  RAISE NOTICE 'Module 7 (first-reading-practice) seeded: module=%, lessons=2, sections=9, exercises=10.',
    v_module_id;
END $$;

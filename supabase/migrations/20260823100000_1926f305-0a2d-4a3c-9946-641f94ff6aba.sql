-- Phase 2 / Sub-phase 2.3: Level 1 pilot content — Module 1 ("Letter Shapes
-- I", slug letter-shapes-1) only. Four real lessons covering the module's
-- full declared scope (ا through ز, 11 letters), grouped by genuine visual
-- shape families rather than one-letter-per-lesson:
--   1. Alif alone (no dots, foundational, introduces RTL orientation)
--   2. Ba/Ta/Tha (shared bowl shape, differ by dot count/position)
--   3. Jim/Ha/Kha (shared hook shape, differ by dot presence/position)
--   4. Dal/Dhal, Ra/Zay (two dot-differentiated pairs) + module recap
--
-- Content governance: every instructional claim here is general Arabic
-- orthography (letter identity/shape/dot pattern/name) -- a closed,
-- deterministic, uncontested fact set, not an authored interpretation. No
-- content_sources row is created for it: that table's content_type CHECK
-- ('arabic_text','translation') is scoped to licensed/attributed external
-- corpora (the Qur'an text/translation problem), and widening it for
-- self-composed pedagogical fact would be exactly the kind of unnecessary
-- new provenance system the project has consistently avoided. No grammar,
-- no Tajweed, no theological content appears anywhere below.
--
-- The one Qur'anic reference (lesson 4's quran_example, Al-Fatiha 1:1) is a
-- real FK into ayahs, not invented text. Which taught letters actually
-- appear in that ayah's stored text was verified programmatically before
-- writing this migration (bā', ḥā', rā' -- confirmed present; alif was
-- NOT claimed, since the stored text uses alif-wasla (ٱ), a different
-- codepoint, not plain alif (ا)).
--
-- Localization: lessons/sections/exercises all use existing *_en/*_fr
-- columns. Exercise `payload` (choices/pairs) is NOT locale-split in the
-- 2.1 schema -- resolved by design here, not ignored: every choice/pair in
-- this pilot is an Arabic glyph or a universal transliteration (e.g.
-- "Bā'"), which needs no translation. A future module with
-- English/French-*word*-based exercise choices will need a real design
-- decision (payload_en/fr split, or i18n-keyed choices) -- flagged, not
-- solved here, since it doesn't block this pilot.
--
-- The Sub-phase 2.1 schema-validation placeholder lesson is NOT deleted:
-- tests/e2e/17-lesson-player.spec.ts (already shipped, CI-gated) looks it
-- up by slug and depends on it existing. It is moved to a high order_index
-- (999) within this same module so it sorts after all real content and
-- never collides with the new lessons' order_index values, while
-- remaining a valid, permanently-available schema-regression fixture.

-- =========================================================================
-- 0. Move the placeholder lesson out of the way (still exists, still
--    findable by slug, just no longer occupies order_index 0).
-- =========================================================================

UPDATE public.lessons
SET order_index = 999
WHERE slug = 'schema-validation-placeholder'
  AND module_id = (SELECT id FROM public.modules WHERE slug = 'letter-shapes-1');

-- =========================================================================
-- 1. Module 1 goals (previously NULL, safe additive UPDATE).
-- =========================================================================

UPDATE public.modules
SET goal_en = 'Recognize the isolated form, name, and dot pattern of the Arabic letters ا through ز, and understand that Arabic is read right to left.',
    goal_fr = 'Reconnaître la forme isolée, le nom et le schéma de points des lettres arabes de ا à ز, et comprendre que l''arabe se lit de droite à gauche.'
WHERE slug = 'letter-shapes-1';

DO $$
DECLARE
  v_existing integer;
BEGIN
  SELECT count(*) INTO v_existing FROM public.lessons
  WHERE slug IN ('alif-the-first-letter', 'the-ba-family', 'the-jim-family', 'dal-dhal-ra-zay');
  IF v_existing <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 4 pilot lesson slugs to already exist, found %. Aborting to avoid duplicate/conflicting seed data.', v_existing;
  END IF;
END $$;

-- =========================================================================
-- 2. Lessons.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'alif-the-first-letter', 'The First Letter: Alif', 'La première lettre : Alif', 0, 6
FROM public.modules WHERE slug = 'letter-shapes-1';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'the-ba-family', 'The Bā'' Family: ب ت ث', 'La famille Bā'' : ب ت ث', 1, 9
FROM public.modules WHERE slug = 'letter-shapes-1';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'the-jim-family', 'The Jīm Family: ج ح خ', 'La famille Jīm : ج ح خ', 2, 9
FROM public.modules WHERE slug = 'letter-shapes-1';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'dal-dhal-ra-zay', 'Dāl, Dhāl, Rā'' and Zāy: د ذ ر ز', 'Dāl, Dhāl, Rā'' et Zāy : د ذ ر ز', 3, 10
FROM public.modules WHERE slug = 'letter-shapes-1';

-- =========================================================================
-- 3. Lesson 1 — Alif. 4 sections, 2 exercises.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Arabic is written and read from right to left — the opposite of English. In this lesson you''ll meet the very first letter of the Arabic alphabet: Alif.',
  'L''arabe s''écrit et se lit de droite à gauche — le contraire du français. Dans cette leçon, vous allez découvrir la toute première lettre de l''alphabet arabe : Alif.'
FROM public.lessons WHERE slug = 'alif-the-first-letter';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ا',
  'This is Alif (ا) — the simplest letter in the Arabic alphabet: a single vertical stroke, with no dots.',
  'Voici Alif (ا) — la lettre la plus simple de l''alphabet arabe : un seul trait vertical, sans aucun point.'
FROM public.lessons WHERE slug = 'alif-the-first-letter';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'tip',
  'Alif has no dots at all, which makes it easy to recognize. Many letters you''ll meet next are told apart only by their dots — so it helps to start with the one letter that has none.',
  'Alif n''a aucun point, ce qui la rend facile à reconnaître. Beaucoup de lettres que vous allez rencontrer ensuite ne se distinguent que par leurs points — il est donc utile de commencer par celle qui n''en a aucun.'
FROM public.lessons WHERE slug = 'alif-the-first-letter';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  'You''ve learned to recognize Alif (ا), the first letter of the Arabic alphabet, and that Arabic reads right to left.',
  'Vous savez maintenant reconnaître Alif (ا), la première lettre de l''alphabet arabe, et vous savez que l''arabe se lit de droite à gauche.'
FROM public.lessons WHERE slug = 'alif-the-first-letter';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which of these is the letter Alif (ا)?', 'Laquelle de ces lettres est Alif (ا) ?',
  '{"choices": ["ا", "ب", "ت"], "correctIndex": 0}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'alif-the-first-letter';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, explanation_en, explanation_fr, review_item_type)
SELECT id, 1, 'true_false',
  'Arabic is read from left to right, like English.', 'L''arabe se lit de gauche à droite, comme le français.',
  '{"correctAnswer": false}'::jsonb,
  'Arabic is read and written from right to left.',
  'L''arabe se lit et s''écrit de droite à gauche.',
  'letter'
FROM public.lessons WHERE slug = 'alif-the-first-letter';

-- =========================================================================
-- 4. Lesson 2 — Bā'/Tā'/Thā' family. 6 sections, 3 exercises.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'These three letters share the same basic shape: a shallow curved bowl. What tells them apart is only the number and position of their dots.',
  'Ces trois lettres partagent la même forme de base : une coupe peu profonde et incurvée. Ce qui les distingue, c''est uniquement le nombre et la position de leurs points.'
FROM public.lessons WHERE slug = 'the-ba-family';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ب', 'Bā'' (ب) has one dot, placed below the curve.', 'Bā'' (ب) a un point, placé sous la courbe.'
FROM public.lessons WHERE slug = 'the-ba-family';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'ت', 'Tā'' (ت) has two dots, placed above the curve.', 'Tā'' (ت) a deux points, placés au-dessus de la courbe.'
FROM public.lessons WHERE slug = 'the-ba-family';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 3, 'arabic_text', 'ث', 'Thā'' (ث) has three dots, placed above the curve.', 'Thā'' (ث) a trois points, placés au-dessus de la courbe.'
FROM public.lessons WHERE slug = 'the-ba-family';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'Cover the dots with your finger — all three letters look identical underneath! The dots are doing all the work of telling them apart.',
  'Cachez les points avec votre doigt — les trois lettres se ressemblent parfaitement en dessous ! Ce sont les points qui permettent, à eux seuls, de les distinguer.'
FROM public.lessons WHERE slug = 'the-ba-family';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You can now tell Bā'', Tā'' and Thā'' apart by counting their dots: one below, two above, three above.',
  'Vous savez maintenant distinguer Bā'', Tā'' et Thā'' en comptant leurs points : un en dessous, deux au-dessus, trois au-dessus.'
FROM public.lessons WHERE slug = 'the-ba-family';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter has ONE dot, placed below the curve?', 'Quelle lettre a UN point, placé sous la courbe ?',
  '{"choices": ["ب", "ت", "ث"], "correctIndex": 0}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'the-ba-family';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter has THREE dots, placed above the curve?', 'Quelle lettre a TROIS points, placés au-dessus de la courbe ?',
  '{"choices": ["ب", "ت", "ث"], "correctIndex": 2}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 3
WHERE l.slug = 'the-ba-family';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "ب", "right": "Bā'"}, {"left": "ت", "right": "Tā'"}, {"left": "ث", "right": "Thā'"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'the-ba-family';

-- =========================================================================
-- 5. Lesson 3 — Jīm/Ḥā'/Khā' family. 6 sections, 3 exercises.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Another family of three look-alike letters — this time sharing a hook-like shape that dips below the line.',
  'Une autre famille de trois lettres qui se ressemblent — cette fois avec une forme en crochet qui descend sous la ligne.'
FROM public.lessons WHERE slug = 'the-jim-family';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ج', 'Jīm (ج) has one dot, placed inside the curve.', 'Jīm (ج) a un point, placé à l''intérieur de la courbe.'
FROM public.lessons WHERE slug = 'the-jim-family';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'ح', 'Ḥā'' (ح) has no dot at all.', 'Ḥā'' (ح) n''a aucun point.'
FROM public.lessons WHERE slug = 'the-jim-family';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 3, 'arabic_text', 'خ', 'Khā'' (خ) has one dot, placed above the curve.', 'Khā'' (خ) a un point, placé au-dessus de la courbe.'
FROM public.lessons WHERE slug = 'the-jim-family';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'Ḥā'' is the "plain" one in this family — no dot at all, just like Alif was the plain letter in Lesson 1.',
  'Ḥā'' est la lettre « simple » de cette famille — aucun point, tout comme Alif était la lettre simple de la leçon 1.'
FROM public.lessons WHERE slug = 'the-jim-family';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You can now tell Jīm, Ḥā'' and Khā'' apart: a dot inside the curve, no dot, or a dot above.',
  'Vous savez maintenant distinguer Jīm, Ḥā'' et Khā'' : un point à l''intérieur de la courbe, aucun point, ou un point au-dessus.'
FROM public.lessons WHERE slug = 'the-jim-family';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter has NO dot at all?', 'Quelle lettre n''a AUCUN point ?',
  '{"choices": ["ج", "ح", "خ"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'the-jim-family';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter''s dot sits ABOVE the curve?', 'Quelle lettre a son point AU-DESSUS de la courbe ?',
  '{"choices": ["ج", "ح", "خ"], "correctIndex": 2}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 3
WHERE l.slug = 'the-jim-family';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "ج", "right": "Jīm"}, {"left": "ح", "right": "Ḥā'"}, {"left": "خ", "right": "Khā'"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'the-jim-family';

-- =========================================================================
-- 6. Lesson 4 — Dāl/Dhāl, Rā'/Zāy + module recap. 6 sections, 4 exercises.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'The last four letters in this module form two look-alike pairs, not one big family.',
  'Les quatre dernières lettres de ce module forment deux paires de lettres qui se ressemblent, et non une seule grande famille.'
FROM public.lessons WHERE slug = 'dal-dhal-ra-zay';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 1, 'arabic_text',
  'Dāl (د) has no dot. Dhāl (ذ) is the exact same shape with one dot added above.',
  'Dāl (د) n''a aucun point. Dhāl (ذ) a exactement la même forme, avec un point ajouté au-dessus.'
FROM public.lessons WHERE slug = 'dal-dhal-ra-zay';

UPDATE public.lesson_sections SET arabic_text = 'د  ذ'
WHERE lesson_id = (SELECT id FROM public.lessons WHERE slug = 'dal-dhal-ra-zay') AND order_index = 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'arabic_text',
  'Rā'' (ر) has no dot. Zāy (ز) is the exact same shape with one dot added above.',
  'Rā'' (ر) n''a aucun point. Zāy (ز) a exactement la même forme, avec un point ajouté au-dessus.'
FROM public.lessons WHERE slug = 'dal-dhal-ra-zay';

UPDATE public.lesson_sections SET arabic_text = 'ر  ز'
WHERE lesson_id = (SELECT id FROM public.lessons WHERE slug = 'dal-dhal-ra-zay') AND order_index = 2;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'In this lesson, each dot added a related sound: Dāl → Dhāl, and Rā'' → Zāy. That won''t always be true for every letter pair you''ll meet — dots mainly tell letters apart visually — but it''s a nice pattern to notice here.',
  'Dans cette leçon, chaque point ajouté a créé un son apparenté : Dāl → Dhāl, et Rā'' → Zāy. Ce ne sera pas toujours le cas pour chaque paire de lettres — les points servent surtout à distinguer les lettres visuellement — mais c''est un joli schéma à repérer ici.'
FROM public.lessons WHERE slug = 'dal-dhal-ra-zay';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 4, 'quran_example', 1, 1,
  'You''ve already learned to recognize several of these letters — look for Bā'' (ب), Ḥā'' (ح) and Rā'' (ر) in this real, familiar verse from the Qur''an: the opening of Al-Fatiha.',
  'Vous savez déjà reconnaître plusieurs de ces lettres — repérez Bā'' (ب), Ḥā'' (ح) et Rā'' (ر) dans ce verset réel et familier du Coran : l''ouverture d''Al-Fatiha.'
FROM public.lessons WHERE slug = 'dal-dhal-ra-zay';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You''ve now learned to recognize all 11 letters in "Letter Shapes I": ا ب ت ث ج ح خ د ذ ر ز.',
  'Vous savez maintenant reconnaître les 11 lettres de « Formes des lettres I » : ا ب ت ث ج ح خ د ذ ر ز.'
FROM public.lessons WHERE slug = 'dal-dhal-ra-zay';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter is Dhāl — Dāl (د) with a dot added?', 'Quelle lettre est Dhāl — Dāl (د) avec un point ajouté ?',
  '{"choices": ["د", "ذ", "ر"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'dal-dhal-ra-zay';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter is Zāy — Rā'' (ر) with a dot added?', 'Quelle lettre est Zāy — Rā'' (ر) avec un point ajouté ?',
  '{"choices": ["ر", "ز", "د"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'dal-dhal-ra-zay';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, explanation_en, explanation_fr, review_item_type)
SELECT id, 2, 'reading_check',
  'Reading right to left, which letter comes SECOND in this sequence: د ذ ر ز؟', 'En lisant de droite à gauche, quelle lettre vient EN DEUXIÈME dans cette séquence : د ذ ر ز ؟',
  '{"choices": ["د", "ذ", "ر", "ز"], "correctIndex": 1}'::jsonb,
  'Reading right to left, the order is د (1st), ذ (2nd), ر (3rd), ز (4th).',
  'En lisant de droite à gauche, l''ordre est د (1er), ذ (2e), ر (3e), ز (4e).',
  'letter'
FROM public.lessons WHERE slug = 'dal-dhal-ra-zay';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "د", "right": "Dāl"}, {"left": "ذ", "right": "Dhāl"}, {"left": "ر", "right": "Rā'"}, {"left": "ز", "right": "Zāy"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'dal-dhal-ra-zay';

-- =========================================================================
-- 7. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_placeholder_order integer;
BEGIN
  SELECT id INTO STRICT v_module_id FROM public.modules WHERE slug = 'letter-shapes-1';

  SELECT count(*) INTO v_lesson_count FROM public.lessons
  WHERE module_id = v_module_id AND slug != 'schema-validation-placeholder';
  IF v_lesson_count <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 real pilot lessons in letter-shapes-1, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id
  WHERE l.module_id = v_module_id AND l.slug != 'schema-validation-placeholder';
  IF v_section_count <> 22 THEN
    RAISE EXCEPTION 'Expected exactly 22 lesson_sections across the 4 pilot lessons, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id
  WHERE l.module_id = v_module_id AND l.slug != 'schema-validation-placeholder';
  IF v_exercise_count <> 12 THEN
    RAISE EXCEPTION 'Expected exactly 12 lesson_exercises across the 4 pilot lessons, found %.', v_exercise_count;
  END IF;

  SELECT order_index INTO v_placeholder_order FROM public.lessons WHERE slug = 'schema-validation-placeholder';
  IF v_placeholder_order <> 999 THEN
    RAISE EXCEPTION 'Expected the schema-validation placeholder lesson to have order_index 999, found %.', v_placeholder_order;
  END IF;

  RAISE NOTICE 'Level 1 pilot module seeded: module=%, lessons=4, sections=22, exercises=12, placeholder moved to order_index 999',
    v_module_id;
END $$;

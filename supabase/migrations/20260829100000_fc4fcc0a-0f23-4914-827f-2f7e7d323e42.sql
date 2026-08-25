-- Phase 3 / Sub-phase 5 (Gate A+B): Level 1, Module 5 ("tanwin" —
-- Nunation). Four lessons teaching fatḥatān, kasratān, and ḍammatān, plus
-- a reading-synthesis lesson, authored under the accelerated three-gate
-- workflow.
--
-- ROADMAP CONTEXT: the module sequence remains exactly as established by
-- the Phase 2.1 skeleton migration — this migration queried the live
-- `modules` table directly before authoring, confirming slug "tanwin",
-- title_en "Nunation (Tanwīn)", and title_fr "Nunation (tanwīn)" (the
-- actual seeded value — not corrected or altered).
--
-- SCOPE (deliberately narrow, matching Modules 3-4's precedent): tanwīn's
-- VISUAL doubling relationship to fatḥa/kasra/ḍamma and the beginner
-- reading effect (an unwritten final "n" sound) only. Explicitly EXCLUDED,
-- per the same governance boundary Modules 1-4 have held: (1) Arabic
-- grammar/case theory — tanwīn's role in marking indefinite nouns is a
-- real, well-established fact of Arabic morphology, but teaching it here
-- would cross this course's orthography/phonetics-only scope into syntax,
-- which no prior module has done; (2) Tajweed assimilation rules for the
-- tanwīn/nūn-sākinah "n" sound (idghām, iqlāb, ikhfā') — advanced
-- recitation rules, explicitly out of scope since Module 1; (3) waqf
-- (stopping) behavior, where fatḥatān's pronunciation changes at a pause —
-- also advanced and out of scope. Lesson 4 makes one honest,
-- single-line forward reference to connected-letter-forms (a real,
-- already-seeded future module), nothing else.
--
-- PRONUNCIATION WORDING: continues Module 4's design choice, not Module
-- 3's. No new cross-language sound anchor is introduced — every
-- description reuses the ALREADY-REVIEWED Module 3 vowel descriptions
-- ("the same short 'a'/'i'/'u' sound you already know from the
-- fatḥa/kasra/ḍamma") plus a plain mechanism statement ("followed by an
-- unwritten 'n'"), avoiding the issue class that produced Module 3's two
-- (now resolved) YELLOW items.
--
-- VISUAL REPRESENTATION — fresh verification, not assumed: unlike
-- sukūn/shadda (Module 4), which could cite Module 3's own already-passed
-- Qur'an-example E2E check as direct evidence, tanwīn uses different
-- Unicode combining marks (U+064B FATHATAN, U+064C DAMMATAN, U+064D
-- KASRATAN) that had never been exercised in this app before. A fresh
-- Playwright screenshot spike (same methodology as Sub-phase 3.2/3.3) was
-- run this cycle against the actual font-quran/dir=rtl/lang=ar styling
-- used by `arabic_text`/`example` sections, at both desktop and 390x844
-- mobile viewports: all three tanwīn marks rendered correctly attached to
-- their base letter, correctly positioned (fatḥatān/ḍammatān above,
-- kasratān below), with no clipping or detachment. The same spike
-- confirmed the already-known gap in the unstyled exercise-choice/
-- matching renderer (ChoiceControl/MatchingControl — no dir/lang/
-- font-quran) still applies to these marks too. Mitigation is therefore
-- identical to Modules 3-4: exercise choices and matching pairs reference
-- the marks by name ("Fatḥatān"/"Kasratān"/"Ḍammatān"), never by raw
-- glyph; raw glyphs (بً/بٍ/بٌ) appear only in arabic_text/example
-- sections and review-item fronts.
--
-- QUR'AN EXAMPLE: NONE this module — verified empirically, not assumed.
-- A direct regex check against the actual stored canonical text of all 7
-- āyāt of Al-Fatiha (surah 1) confirmed NONE contain any tanwīn mark
-- (Al-Fatiha's nouns are mostly definite, and tanwīn marks indefinite
-- nouns — an incidental but real linguistic fact, not a data error).
-- Modules 2-4 built a deliberate narrative arc ("you already know this
-- verse by ear, it's from Al-Fatiha") that a different sūrah would break;
-- rather than force an example from an unfamiliar sūrah or fabricate
-- relevance, this module has no quran_example section. This is a
-- pedagogical design decision per the explicit instruction to use
-- Qur'anic examples "only when pedagogically appropriate," not a gap.
--
-- REVIEW-ITEM KEY CONSTRAINT (same generic mechanism as Modules 3-4):
-- seedLessonReviewItems (src/lib/study.ts, unchanged) builds item_key as
-- `${review_item_type}:${pair.left}` verbatim. To produce concept:
-- fathatan / concept:kasratan / concept:dammatan, every review-seeding
-- matching exercise's pair.left is the literal lowercase, diacritic-free
-- string "fathatan"/"kasratan"/"dammatan" — consistent with the "fatha"/
-- "kasra"/"damma"/"sukun"/"shadda" naming convention already locked in
-- Modules 3-4.
--
-- EXERCISE TYPE CHOICE: recognition questions use 'multiple_choice' (same
-- reasoning as Module 4 — tanwīn marks are not themselves vowels, they
-- are doubled vowel marks, so the more accurate generic label is used
-- rather than 'vowel_recognition'). Reading-application questions in
-- Lesson 4 use 'reading_check', matching Modules 3-4's precedent.
--
-- CONTENT GOVERNANCE: no content_sources row needed — original,
-- uncontested Arabic-orthography teaching prose (same governance basis as
-- Modules 1-4); no Qur'anic reference this module, so no FK-governance
-- note applies. RED ITEMS: 0. YELLOW ITEMS: 0. No genuine linguistic,
-- religious-text, pedagogical, accessibility, or data-integrity
-- uncertainty was identified during authoring.

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
  WHERE slug IN ('fathatan', 'kasratan', 'dammatan', 'reading-tanwin');
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 4 Module 5 lesson slugs to already exist, found %. Aborting to avoid duplicate/conflicting seed data.', v_existing_lessons;
  END IF;

  SELECT id INTO v_module_id FROM public.modules WHERE slug = 'tanwin';
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Expected the tanwin module to already exist (seeded by the Phase 2.1 skeleton migration). Aborting.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.lessons WHERE module_id = v_module_id) THEN
    RAISE EXCEPTION 'Expected tanwin to have zero lessons before this migration. Aborting.';
  END IF;

  -- Modules 1-4 must be exactly the production-complete state this
  -- migration was authored against: letter-shapes-1 (5) + letter-shapes-2
  -- (9) + harakat (4) + sukun-and-shadda (3) = 21.
  SELECT count(*) INTO v_prior_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda');
  IF v_prior_lesson_count <> 21 THEN
    RAISE EXCEPTION 'Expected exactly 21 lessons across letter-shapes-1/letter-shapes-2/harakat/sukun-and-shadda before this migration, found %.', v_prior_lesson_count;
  END IF;
END $$;

-- =========================================================================
-- 1. Lessons.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'fathatan', 'Fatḥatān: Adding a Final ''N'' Sound', 'La fatḥatān : ajouter un son final « n »', 0, 5
FROM public.modules WHERE slug = 'tanwin';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'kasratan', 'Kasratān: Adding a Final ''N'' Sound Below', 'La kasratān : ajouter un son final « n » en dessous', 1, 5
FROM public.modules WHERE slug = 'tanwin';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'dammatan', 'Ḍammatān: Adding a Final ''N'' Sound', 'La ḍammatān : ajouter un son final « n »', 2, 5
FROM public.modules WHERE slug = 'tanwin';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-tanwin', 'Reading With Tanwīn', 'Lire avec le tanwīn', 3, 6
FROM public.modules WHERE slug = 'tanwin';

-- =========================================================================
-- 2. Lesson 1 — Fatḥatān.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You know the fatḥa, kasra, and ḍamma — and the sukūn and shadda too. There''s one more idea before you''re ready for real words: sometimes, at the end of a word, a harakah is doubled. This doubling is called tanwīn, and it adds a sound you won''t see written: an ''n.''',
  'Vous connaissez la fatḥa, la kasra et la ḍamma — ainsi que le sukūn et la shadda. Il reste une dernière idée avant d''être prêt(e) pour de vrais mots : parfois, à la fin d''un mot, un harakah est doublé. Ce doublement s''appelle le tanwīn, et il ajoute un son que vous ne verrez pas écrit : un « n ».'
FROM public.lessons WHERE slug = 'fathatan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بً',
  'The fatḥatān is the fatḥa''s diagonal stroke, written twice. Applied to Bā'' (ب), بً reads "ban" — the same short ''a'' sound you already know from the fatḥa, now followed by an unwritten ''n.''',
  'La fatḥatān est le trait diagonal de la fatḥa, écrit deux fois. Appliquée à Bā'' (ب), بً se lit « ban » — le même son bref « a » que vous connaissez déjà grâce à la fatḥa, suivi maintenant d''un « n » non écrit.'
FROM public.lessons WHERE slug = 'fathatan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'جً',
  'Jīm (ج) with a fatḥatān, جً, reads "jan" — the same doubling, on a different letter.',
  'Jīm (ج) avec une fatḥatān, جً, se lit « jan » — le même doublement, sur une autre lettre.'
FROM public.lessons WHERE slug = 'fathatan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Shape is your fastest clue: the fatḥatān is simply the fatḥa''s stroke, doubled — same shape, same position above the letter, just written twice.',
  'La forme est votre repère le plus rapide : la fatḥatān est simplement le trait de la fatḥa, doublé — même forme, même position au-dessus de la lettre, juste écrit deux fois.'
FROM public.lessons WHERE slug = 'fathatan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now recognize the fatḥatān and read the ''n'' sound it adds at the end of a word.',
  'Vous savez maintenant reconnaître la fatḥatān et lire le son « n » qu''elle ajoute à la fin d''un mot.'
FROM public.lessons WHERE slug = 'fathatan';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'multiple_choice',
  'Which mark is the fatḥa''s diagonal stroke, written twice?',
  'Quel signe est le trait diagonal de la fatḥa, écrit deux fois ?',
  '{"choices": ["Fatḥatān", "Kasratān", "Ḍammatān"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'fathatan';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'multiple_choice',
  'What does the fatḥatān add to the end of a word?',
  'Qu''est-ce que la fatḥatān ajoute à la fin d''un mot ?',
  '{"choices": ["A short ''a'' sound followed by an unwritten ''n''", "No sound at all", "A doubled consonant"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'fathatan';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'The fatḥatān is written exactly like a single fatḥa.',
  'La fatḥatān s''écrit exactement comme une seule fatḥa.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'fathatan';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'true_false',
  'The fatḥatān is the fatḥa''s stroke, written twice.',
  'La fatḥatān est le trait de la fatḥa, écrit deux fois.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'fathatan';

-- Single-pair matching, deliberately: fatḥatān is the only concept
-- introduced so far. pair.left is the literal lowercase "fathatan" so
-- seedLessonReviewItems derives exactly the locked key concept:fathatan.
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match the mark name to what it means.', 'Associez le nom du signe à sa signification.',
  $j${"pairs": [{"left": "fathatan", "right": "a doubled fatḥa mark, adding an unwritten final 'n' sound"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'fathatan';

-- =========================================================================
-- 3. Lesson 2 — Kasratān.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You''ve learned the fatḥatān, doubled above the letter. Now for the second tanwīn mark — the kasratān, doubled below.',
  'Vous avez appris la fatḥatān, doublée au-dessus de la lettre. Voici maintenant le deuxième signe de tanwīn — la kasratān, doublée en dessous.'
FROM public.lessons WHERE slug = 'kasratan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بٍ',
  'The kasratān is the kasra''s diagonal stroke, written twice, below the letter. Applied to Bā'' (ب), بٍ reads "bin" — the same short ''i'' sound you already know from the kasra, now followed by an unwritten ''n.''',
  'La kasratān est le trait diagonal de la kasra, écrit deux fois, en dessous de la lettre. Appliquée à Bā'' (ب), بٍ se lit « bin » — le même son bref « i » que vous connaissez déjà grâce à la kasra, suivi maintenant d''un « n » non écrit.'
FROM public.lessons WHERE slug = 'kasratan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'تٍ',
  'Tā'' (ت) with a kasratān, تٍ, reads "tin," the same way Bā'' did.',
  'Tā'' (ت) avec une kasratān, تٍ, se lit « tin », de la même façon que Bā''.'
FROM public.lessons WHERE slug = 'kasratan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Position is still your fastest clue: the fatḥatān sits above the letter, the kasratān sits below — exactly like the fatḥa and kasra themselves.',
  'La position reste votre repère le plus rapide : la fatḥatān se trouve au-dessus de la lettre, la kasratān en dessous — exactement comme la fatḥa et la kasra elles-mêmes.'
FROM public.lessons WHERE slug = 'kasratan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now tell the fatḥatān and kasratān apart, by position and by sound.',
  'Vous savez maintenant distinguer la fatḥatān et la kasratān, par leur position et par leur son.'
FROM public.lessons WHERE slug = 'kasratan';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'multiple_choice',
  'Which mark is the kasra''s diagonal stroke, written twice below the letter?',
  'Quel signe est le trait diagonal de la kasra, écrit deux fois en dessous de la lettre ?',
  '{"choices": ["Kasratān", "Fatḥatān", "Ḍammatān"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'kasratan';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'multiple_choice',
  'What does the kasratān add to the end of a word?',
  'Qu''est-ce que la kasratān ajoute à la fin d''un mot ?',
  '{"choices": ["A doubled consonant", "A short ''i'' sound followed by an unwritten ''n''", "No sound at all"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'kasratan';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'The kasratān is written above the letter it marks.',
  'La kasratān s''écrit au-dessus de la lettre qu''elle marque.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'kasratan';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'true_false',
  'The fatḥatān and the kasratān are both doubled diagonal strokes — only their position differs.',
  'La fatḥatān et la kasratān sont toutes deux des traits diagonaux doublés — seule leur position diffère.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'kasratan';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match each mark name to what it means.', 'Associez chaque nom de signe à sa signification.',
  $j${"pairs": [{"left": "fathatan", "right": "a doubled fatḥa mark, adding an unwritten final 'n' sound"}, {"left": "kasratan", "right": "a doubled kasra mark, adding an unwritten final 'n' sound"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'kasratan';

-- =========================================================================
-- 4. Lesson 3 — Ḍammatān.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'One tanwīn mark left. The ḍammatān completes the set of three.',
  'Il reste un signe de tanwīn. La ḍammatān complète l''ensemble des trois.'
FROM public.lessons WHERE slug = 'dammatan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بٌ',
  'The ḍammatān is the ḍamma''s curved mark, written doubled, above the letter. Applied to Bā'' (ب), بٌ reads "bun" — the same short ''u'' sound you already know from the ḍamma, now followed by an unwritten ''n.''',
  'La ḍammatān est le signe recourbé de la ḍamma, écrit en double, au-dessus de la lettre. Appliquée à Bā'' (ب), بٌ se lit « bun » — le même son bref « u » que vous connaissez déjà grâce à la ḍamma, suivi maintenant d''un « n » non écrit.'
FROM public.lessons WHERE slug = 'dammatan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'جٌ',
  'Jīm (ج) with a ḍammatān, جٌ, reads "jun."',
  'Jīm (ج) avec une ḍammatān, جٌ, se lit « jun ».'
FROM public.lessons WHERE slug = 'dammatan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Both the fatḥatān and the ḍammatān sit above the letter — tell them apart by shape: the fatḥatān is two diagonal strokes, the ḍammatān is the ḍamma''s curve, doubled.',
  'La fatḥatān et la ḍammatān se trouvent toutes deux au-dessus de la lettre — distinguez-les par leur forme : la fatḥatān est composée de deux traits diagonaux, la ḍammatān est la courbe de la ḍamma, doublée.'
FROM public.lessons WHERE slug = 'dammatan';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You now know all three tanwīn marks: fatḥatān, kasratān, and ḍammatān.',
  'Vous connaissez maintenant les trois signes de tanwīn : fatḥatān, kasratān et ḍammatān.'
FROM public.lessons WHERE slug = 'dammatan';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'multiple_choice',
  'Which mark is the ḍamma''s curved mark, written doubled?',
  'Quel signe est le signe recourbé de la ḍamma, écrit en double ?',
  '{"choices": ["Fatḥatān", "Kasratān", "Ḍammatān"], "correctIndex": 2}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'dammatan';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'multiple_choice',
  'What does the ḍammatān add to the end of a word?',
  'Qu''est-ce que la ḍammatān ajoute à la fin d''un mot ?',
  '{"choices": ["A short ''u'' sound followed by an unwritten ''n''", "A doubled consonant", "No sound at all"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'dammatan';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'The fatḥatān and the ḍammatān are both written above the letter, but they have different shapes.',
  'La fatḥatān et la ḍammatān s''écrivent toutes deux au-dessus de la lettre, mais elles ont des formes différentes.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'dammatan';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'matching',
  'Match each mark name to what it means — all three so far.',
  'Associez chaque nom de signe à sa signification — les trois vus jusqu''ici.',
  $j${"pairs": [{"left": "fathatan", "right": "a doubled fatḥa mark, adding an unwritten final 'n' sound"}, {"left": "kasratan", "right": "a doubled kasra mark, adding an unwritten final 'n' sound"}, {"left": "dammatan", "right": "a doubled ḍamma mark, adding an unwritten final 'n' sound"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'dammatan';

-- =========================================================================
-- 5. Lesson 4 — Reading With Tanwīn (synthesis only, no new marks).
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You now know all three tanwīn marks: fatḥatān, kasratān, and ḍammatān — each one a harakah you already know, doubled, adding an unwritten ''n'' sound at the end of a word. This lesson brings them together — no new marks, just practice recognizing all three and reading the sound they add.',
  'Vous connaissez maintenant les trois signes de tanwīn : fatḥatān, kasratān et ḍammatān — chacun un harakah que vous connaissez déjà, doublé, ajoutant un son « n » non écrit à la fin d''un mot. Cette leçon les réunit — aucun nouveau signe, seulement de la pratique pour bien les reconnaître tous les trois et lire le son qu''ils ajoutent.'
FROM public.lessons WHERE slug = 'reading-tanwin';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بً بٍ بٌ',
  'Bā'' with all three tanwīn marks, side by side: fatḥatān (بً, "ban"), kasratān (بٍ, "bin"), ḍammatān (بٌ, "bun"). Once you''re comfortable reading these on letters you know, you''ll be ready for the next step — connected letter forms — in a later module.',
  'Bā'' avec les trois signes de tanwīn, côte à côte : fatḥatān (بً, « ban »), kasratān (بٍ, « bin »), ḍammatān (بٌ, « bun »). Une fois à l''aise pour les lire sur des lettres que vous connaissez, vous serez prêt(e) pour la prochaine étape — les formes de lettres liées — dans un module ultérieur.'
FROM public.lessons WHERE slug = 'reading-tanwin';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'summary',
  'Module complete: you can recognize and read all three tanwīn marks — fatḥatān, kasratān, and ḍammatān — on any letter you know.',
  'Module terminé : vous savez reconnaître et lire les trois signes de tanwīn — fatḥatān, kasratān et ḍammatān — sur n''importe quelle lettre que vous connaissez.'
FROM public.lessons WHERE slug = 'reading-tanwin';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'multiple_choice',
  'Which tanwīn mark sits above the letter and is two diagonal strokes?',
  'Quel signe de tanwīn se trouve au-dessus de la lettre et correspond à deux traits diagonaux ?',
  '{"choices": ["Ḍammatān", "Fatḥatān", "Kasratān"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-tanwin';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'Which tanwīn mark is the only one written below the letter?',
  'Quel signe de tanwīn est le seul écrit en dessous de la lettre ?',
  '{"choices": ["Fatḥatān", "Ḍammatān", "Kasratān"], "correctIndex": 2}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-tanwin';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'reading_check',
  'Rā'' (ر) with a fatḥatān reads:',
  'Rā'' (ر) avec une fatḥatān se lit :',
  '{"choices": ["rin", "ran", "run"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-tanwin';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'reading_check',
  'Mīm (م) with a ḍammatān reads:',
  'Mīm (م) avec une ḍammatān se lit :',
  '{"choices": ["min", "man", "mun"], "correctIndex": 2}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-tanwin';

-- Comprehensive recap, all three concepts — same pair.left values as
-- Lessons 1-3's matching exercises, so seedLessonReviewItems' item_key +
-- ignoreDuplicates:true resolves this to the SAME three existing rows,
-- never creating duplicates.
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match each mark name to what it means — a full recap.',
  'Associez chaque nom de signe à sa signification — récapitulatif complet.',
  $j${"pairs": [{"left": "fathatan", "right": "a doubled fatḥa mark, adding an unwritten final 'n' sound"}, {"left": "kasratan", "right": "a doubled kasra mark, adding an unwritten final 'n' sound"}, {"left": "dammatan", "right": "a doubled ḍamma mark, adding an unwritten final 'n' sound"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'reading-tanwin';

-- =========================================================================
-- 6. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_prior_modules_untouched integer;
  v_other_modules_untouched integer;
BEGIN
  SELECT id INTO STRICT v_module_id FROM public.modules WHERE slug = 'tanwin';

  SELECT count(*) INTO v_lesson_count FROM public.lessons WHERE module_id = v_module_id;
  IF v_lesson_count <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 lessons in tanwin, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id WHERE l.module_id = v_module_id;
  IF v_section_count <> 18 THEN
    RAISE EXCEPTION 'Expected exactly 18 lesson_sections in tanwin, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id WHERE l.module_id = v_module_id;
  IF v_exercise_count <> 19 THEN
    RAISE EXCEPTION 'Expected exactly 19 lesson_exercises in tanwin, found %.', v_exercise_count;
  END IF;

  -- Modules 1-4 must be completely untouched by this migration.
  SELECT count(*) INTO v_prior_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda');
  IF v_prior_modules_untouched <> 21 THEN
    RAISE EXCEPTION 'Expected letter-shapes-1/letter-shapes-2/harakat/sukun-and-shadda to still have exactly 21 lessons combined, found %.', v_prior_modules_untouched;
  END IF;

  -- Every module besides letter-shapes-1/letter-shapes-2/harakat/
  -- sukun-and-shadda/tanwin must remain empty (Modules 6-8 are not yet
  -- authored).
  SELECT count(*) INTO v_other_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug NOT IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda', 'tanwin');
  IF v_other_modules_untouched <> 0 THEN
    RAISE EXCEPTION 'Expected zero lessons in modules other than letter-shapes-1/letter-shapes-2/harakat/sukun-and-shadda/tanwin, found %.', v_other_modules_untouched;
  END IF;

  RAISE NOTICE 'Module 5 (tanwin) seeded: module=%, lessons=4, sections=18, exercises=19.',
    v_module_id;
END $$;

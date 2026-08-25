-- Phase 3 / Sub-phase 4 (Gate A+B): Level 1, Module 4 ("sukun-and-shadda" —
-- Sukūn & Shadda). Three lessons teaching the sukūn (absence of a vowel)
-- and the shadda (a doubled/geminated consonant), plus a reading-synthesis
-- lesson, authored under the accelerated three-gate workflow.
--
-- ROADMAP CONTEXT: the Level 1 module sequence is already fixed by the
-- Phase 2.1 skeleton migration (order_index 0-7): letter-shapes-1,
-- letter-shapes-2, harakat (all three production-complete), then
-- sukun-and-shadda (this module), tanwin, connected-letter-forms,
-- first-reading-practice, reading-al-fatiha. This migration does not
-- invent that sequence — it was queried directly from the live `modules`
-- table before any content decision was made, confirming Module 4 is
-- "Sukūn & Shadda" together, not sukūn alone.
--
-- SCOPE: sukūn and shadda only. Tanwīn, connected letter forms, and actual
-- multi-word reading fluency are explicitly out of scope (they are later
-- modules) — Lesson 3 makes one honest, single-line forward reference to
-- tanwīn (a real, already-seeded future module), nothing else.
--
-- PRONUNCIATION WORDING — DESIGN CHOICE, not a Module 3 carryover: Module
-- 3's two YELLOW items both stemmed from cross-language vowel-sound
-- comparison anchors ("like the 'a' in cat"). Sukūn and shadda are not
-- vowel qualities — sukūn is the absence of a vowel, shadda is consonant
-- duration — so no such anchor is used or needed here at all. Every
-- description states the mechanism directly ("the consonant alone, no
-- vowel" / "held twice as long"), which is both linguistically accurate
-- and sidesteps the entire class of issue Module 3 needed two follow-up
-- passes to resolve.
--
-- VISUAL REPRESENTATION: reuses the exact mitigation proven in Module 3,
-- not a new spike. Module 3's own Playwright screenshot spike (Sub-phase
-- 3.3 Section F) established that the generic exercise-choice/matching
-- renderer (ChoiceControl/MatchingControl) has no dir/lang/font-quran
-- treatment and is confirmed BROKEN for ANY letter+combining-mark glyph —
-- a renderer-level gap, not one specific to the three harakat. Sukūn
-- (U+0652) and shadda (U+0651) are combining marks of the same kind, so
-- the same gap applies, and the same mitigation is reused: exercise
-- choices and matching pairs reference the marks by name ("Sukūn"/
-- "Shadda"), never by raw glyph. The `arabic_text`/`example`/
-- `quran_example` SECTION path (font-quran, dir=rtl, lang=ar) is already
-- proven safe for these exact marks: Module 3's own Qur'an example (Surah
-- 1:2, ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ) already contains a sukūn (ḥā'
-- in ٱلْحَمْدُ) and two shaddas (لِلَّهِ, رَبِّ) and passed Module 3's own
-- mobile/no-clipping E2E check — direct evidence, not inference, that
-- this path handles both marks correctly.
--
-- REVIEW-ITEM KEY CONSTRAINT (same generic mechanism as Module 3):
-- seedLessonReviewItems (src/lib/study.ts, unchanged) builds item_key as
-- `${review_item_type}:${pair.left}` verbatim. To produce concept:sukun /
-- concept:shadda, every review-seeding matching exercise's pair.left is
-- the literal lowercase, diacritic-free string "sukun"/"shadda".
--
-- EXERCISE TYPE CHOICE: recognition questions here use 'multiple_choice',
-- not 'vowel_recognition' — sukūn and shadda are not vowels, and
-- 'multiple_choice' is an equally generic, already-supported type in the
-- same CHOICE_TYPES render set (identical UI, more accurate label). No
-- new exercise_type value was needed or added.
--
-- QUR'AN EXAMPLE (Lesson 3): Surah 1, Āyah 4 only. Distinct from Module
-- 2's Āyah 1 and Module 3's Āyah 2 — Āyah 3 was skipped as it repeats
-- part of Āyah 1's text. Referenced by (surah_number, ayah_number) FK
-- only; no Qur'anic Arabic is duplicated into this migration's content.
-- Verified against the actual stored canonical text before authoring
-- (queried directly): مَٰلِكِ يَوْمِ ٱلدِّينِ contains a sukūn on the wāw of
-- يَوْمِ and a shadda (+kasra) on the dāl of ٱلدِّينِ — both target marks,
-- clearly present, in a fresh verse.
--
-- CONTENT GOVERNANCE: no content_sources row needed — original,
-- uncontested Arabic-orthography teaching prose (same governance basis as
-- Modules 1-3), and the one Qur'anic reference reuses the already-
-- governed Tanzil source via FK, not new quoted text.
--
-- CONTENT REVIEW: RED ITEMS: 0. YELLOW ITEMS: 0. No genuine linguistic,
-- religious-text, pedagogical, accessibility, or data-integrity
-- uncertainty was identified during authoring — see the Gate B report for
-- the full self-review. As with all AI-authored French prose in this
-- project, a native-speaker pass remains available on request but is not
-- being manufactured as a blocker here: the wording directly reuses
-- phrasing already reviewed and corrected in Module 3 (e.g. "La
-- position/forme est votre repère le plus rapide", "Vous connaissez déjà
-- ce verset à l'oreille", "repérez seulement les signes") rather than
-- introducing new untested constructions, and — unlike Module 3 — no
-- cross-language pronunciation anchor is used at all, removing the
-- specific issue class that produced Module 3's two YELLOW items.

DO $$
DECLARE
  v_existing_lessons integer;
  v_module_id uuid;
  v_level1_lesson_count integer;
BEGIN
  ---------------------------------------------------------------------------
  -- 0. Preconditions.
  ---------------------------------------------------------------------------
  SELECT count(*) INTO v_existing_lessons FROM public.lessons
  WHERE slug IN ('sukun', 'shadda', 'reading-sukun-shadda');
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 3 Module 4 lesson slugs to already exist, found %. Aborting to avoid duplicate/conflicting seed data.', v_existing_lessons;
  END IF;

  SELECT id INTO v_module_id FROM public.modules WHERE slug = 'sukun-and-shadda';
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Expected the sukun-and-shadda module to already exist (seeded by the Phase 2.1 skeleton migration). Aborting.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.lessons WHERE module_id = v_module_id) THEN
    RAISE EXCEPTION 'Expected sukun-and-shadda to have zero lessons before this migration. Aborting.';
  END IF;

  -- Modules 1-3 must be exactly the production-complete state this
  -- migration was authored against: letter-shapes-1 (4 real + 1
  -- placeholder = 5) + letter-shapes-2 (9 real) + harakat (4 real) = 18.
  SELECT count(*) INTO v_level1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2', 'harakat');
  IF v_level1_lesson_count <> 18 THEN
    RAISE EXCEPTION 'Expected exactly 18 lessons across letter-shapes-1/letter-shapes-2/harakat (17 real + 1 placeholder) before this migration, found %.', v_level1_lesson_count;
  END IF;
END $$;

-- =========================================================================
-- 1. Lessons.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'sukun', 'Sukūn: No Vowel Sound', 'Le sukūn : l''absence de voyelle', 0, 5
FROM public.modules WHERE slug = 'sukun-and-shadda';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'shadda', 'Shadda: A Doubled Consonant', 'La shadda : une consonne doublée', 1, 5
FROM public.modules WHERE slug = 'sukun-and-shadda';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-sukun-shadda', 'Reading With Sukūn and Shadda', 'Lire avec le sukūn et la shadda', 2, 6
FROM public.modules WHERE slug = 'sukun-and-shadda';

-- =========================================================================
-- 2. Lesson 1 — Sukūn.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You''ve learned the three short vowels. But not every letter carries one — sometimes a letter is followed by no vowel sound at all. A small mark called the sukūn shows you exactly when that happens.',
  'Vous avez appris les trois voyelles courtes. Mais toutes les lettres n''en portent pas — parfois, une lettre n''est suivie d''aucun son de voyelle. Un petit signe appelé le sukūn vous indique précisément quand c''est le cas.'
FROM public.lessons WHERE slug = 'sukun';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بْ',
  'The sukūn is a small circle written above a letter. Applied to Bā'' (ب), it reads simply "b" — the consonant sound alone, with no vowel attached. Unlike the harakat, the sukūn doesn''t add a sound; it tells you there isn''t one.',
  'Le sukūn est un petit cercle écrit au-dessus d''une lettre. Appliqué à Bā'' (ب), il se lit simplement « b » — le son de la consonne seule, sans aucune voyelle. Contrairement aux harakat, le sukūn n''ajoute pas de son : il indique qu''il n''y en a pas.'
FROM public.lessons WHERE slug = 'sukun';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'جْ',
  'Jīm (ج) with a sukūn reads "j" — again, just the consonant, stopped short.',
  'Jīm (ج) avec un sukūn se lit « j » — là encore, seulement la consonne, arrêtée net.'
FROM public.lessons WHERE slug = 'sukun';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Shape is your fastest clue: the sukūn is a small circle, while the harakat you already know are diagonal strokes or a small curve. If you see a circle above a letter, there''s no vowel to pronounce there.',
  'La forme est votre repère le plus rapide : le sukūn est un petit cercle, tandis que les harakat que vous connaissez déjà sont des traits diagonaux ou une petite courbe. Si vous voyez un cercle au-dessus d''une lettre, il n''y a aucune voyelle à prononcer à cet endroit.'
FROM public.lessons WHERE slug = 'sukun';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now recognize the sukūn and read a letter that carries no vowel sound.',
  'Vous savez maintenant reconnaître le sukūn et lire une lettre qui ne porte aucun son de voyelle.'
FROM public.lessons WHERE slug = 'sukun';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'multiple_choice',
  'Which mark is a small circle showing that a letter has no vowel sound?',
  'Quel signe est un petit cercle indiquant qu''une lettre n''a aucun son de voyelle ?',
  '{"choices": ["Sukūn", "Fatḥa", "Shadda"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'sukun';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'multiple_choice',
  'When you add a sukūn to Bā'' (ب), what do you hear?',
  'Lorsque vous ajoutez un sukūn à Bā'' (ب), qu''entendez-vous ?',
  '{"choices": ["a short ''a'' sound", "the consonant alone, no vowel", "a short ''u'' sound"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'sukun';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'The sukūn adds a short vowel sound to the letter it marks.',
  'Le sukūn ajoute un son de voyelle courte à la lettre qu''il marque.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'sukun';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'true_false',
  'A letter with a sukūn is pronounced as the consonant alone, with no vowel.',
  'Une lettre portant un sukūn se prononce comme la consonne seule, sans voyelle.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'sukun';

-- Single-pair matching, deliberately: sukūn is the only concept introduced
-- so far, so there is nothing yet to contrast it against. pair.left is the
-- literal lowercase "sukun" (not "Sukūn") so seedLessonReviewItems derives
-- exactly the locked key concept:sukun — see this migration's header note.
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match the mark name to what it means.', 'Associez le nom du signe à sa signification.',
  $j${"pairs": [{"left": "sukun", "right": "a small circle above the letter, meaning no vowel sound"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'sukun';

-- =========================================================================
-- 3. Lesson 2 — Shadda.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'There''s one more mark before you''re ready to read real words: the shadda. It doesn''t add a vowel or remove one — it tells you a consonant is pronounced twice as long.',
  'Il reste un dernier signe avant que vous soyez prêt(e) à lire de vrais mots : la shadda. Elle n''ajoute ni ne retire aucune voyelle — elle indique qu''une consonne se prononce deux fois plus longtemps.'
FROM public.lessons WHERE slug = 'shadda';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بَّ',
  'The shadda is a small mark written above a letter, always paired with a harakah (or a sukūn) on the same letter — it can''t stand alone. Applied to Bā'' with a fatḥa, بَّ reads "bba": the b-sound held for twice as long, then the vowel.',
  'La shadda est un petit signe écrit au-dessus d''une lettre, toujours accompagné d''un harakah (ou d''un sukūn) sur la même lettre — elle ne peut pas se trouver seule. Appliquée à Bā'' avec une fatḥa, بَّ se lit « bba » : le son b tenu deux fois plus longtemps, puis la voyelle.'
FROM public.lessons WHERE slug = 'shadda';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'جَّ',
  'Jīm with a shadda and a fatḥa, جَّ, reads "jja" — the same doubling, on a different letter.',
  'Jīm avec une shadda et une fatḥa, جَّ, se lit « jja » — le même doublement, sur une autre lettre.'
FROM public.lessons WHERE slug = 'shadda';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Shape is again your clue: the shadda looks like a small loop, a bit like a tiny "w" shape above the letter — nothing like the sukūn''s plain circle or the harakat''s strokes and curve.',
  'La forme reste votre repère : la shadda ressemble à une petite boucle, un peu comme un « w » miniature au-dessus de la lettre — rien à voir avec le simple cercle du sukūn ou les traits et la courbe des harakat.'
FROM public.lessons WHERE slug = 'shadda';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now recognize the shadda and read a doubled consonant.',
  'Vous savez maintenant reconnaître la shadda et lire une consonne doublée.'
FROM public.lessons WHERE slug = 'shadda';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'multiple_choice',
  'Which mark shows that a consonant is pronounced twice as long?',
  'Quel signe indique qu''une consonne se prononce deux fois plus longtemps ?',
  '{"choices": ["Sukūn", "Shadda", "Fatḥa"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'shadda';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'multiple_choice',
  'Can a shadda appear on a letter with no harakah or sukūn at all?',
  'Une shadda peut-elle apparaître sur une lettre sans aucune voyelle ni sukūn ?',
  '{"choices": ["Yes, it never needs one", "No, it always pairs with a harakah or a sukūn", "Only at the end of a word"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'shadda';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'A shadda can stand alone on a letter, with no harakah or sukūn alongside it.',
  'Une shadda peut se trouver seule sur une lettre, sans harakah ni sukūn à ses côtés.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'shadda';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'true_false',
  'The sukūn and the shadda have different shapes — a plain circle versus a small loop.',
  'Le sukūn et la shadda ont des formes différentes — un simple cercle contre une petite boucle.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'shadda';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match each mark name to what it means.', 'Associez chaque nom de signe à sa signification.',
  $j${"pairs": [{"left": "sukun", "right": "a small circle above the letter, meaning no vowel sound"}, {"left": "shadda", "right": "a doubled consonant, held twice as long"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'shadda';

-- =========================================================================
-- 4. Lesson 3 — Reading With Sukūn and Shadda (synthesis only, no new marks).
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You now know both marks: the sukūn (no vowel) and the shadda (a doubled consonant). This lesson brings them together — no new marks, just practice recognizing both, and a look at where they appear in a real, familiar verse from the Qur''an.',
  'Vous connaissez maintenant les deux signes : le sukūn (absence de voyelle) et la shadda (consonne doublée). Cette leçon les réunit — aucun nouveau signe, seulement de la pratique pour bien les reconnaître tous les deux, et un aperçu de leur présence dans un verset réel et familier du Coran.'
FROM public.lessons WHERE slug = 'reading-sukun-shadda';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بْ بَّ',
  'Bā'' with each mark, side by side: sukūn (بْ, just "b"), shadda with a fatḥa (بَّ, "bba"). Once you''re comfortable telling these apart, you''ll be ready for the next mark — tanwīn — in a later module.',
  'Bā'' avec chaque signe, côte à côte : sukūn (بْ, simplement « b »), shadda avec une fatḥa (بَّ, « bba »). Une fois à l''aise pour les distinguer, vous serez prêt(e) pour le prochain signe — le tanwīn — dans un module ultérieur.'
FROM public.lessons WHERE slug = 'reading-sukun-shadda';

-- Surah 1, Āyah 4 — referenced by FK only, never quoted here. Verified
-- against the actual stored canonical text before authoring: مَٰلِكِ يَوْمِ
-- ٱلدِّينِ contains a sukūn on the wāw of يَوْمِ and a shadda on the dāl of
-- ٱلدِّينِ. Distinct from the 1:1 and 1:2 examples already used in Modules
-- 2 and 3 (1:3 was skipped — it repeats part of 1:1's text).
INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 1, 4,
  'You already know this verse by ear — it''s the fourth āyah of Al-Fatiha. Look for the marks you''ve just learned: a sukūn on the wāw of "yawmi," and a shadda on the dāl of "ad-dīn." You don''t need to read the whole verse yet — just spot the marks.',
  'Vous connaissez déjà ce verset à l''oreille — c''est le quatrième āyah d''Al-Fatiha. Repérez les signes que vous venez d''apprendre : un sukūn sur le wāw de « yawmi », et une shadda sur le dāl de « ad-dīn ». Vous n''avez pas encore besoin de lire tout le verset — repérez seulement les signes.'
FROM public.lessons WHERE slug = 'reading-sukun-shadda';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  'Module complete: you can recognize and read the sukūn and the shadda on any letter you know, and spot them in real Qur''anic text.',
  'Module terminé : vous savez reconnaître et lire le sukūn et la shadda sur n''importe quelle lettre que vous connaissez, et les repérer dans un texte coranique réel.'
FROM public.lessons WHERE slug = 'reading-sukun-shadda';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'multiple_choice',
  'Which mark means there is no vowel sound at all?',
  'Quel signe signifie qu''il n''y a aucun son de voyelle ?',
  '{"choices": ["Shadda", "Sukūn", "Fatḥa"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-sukun-shadda';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'Which mark means a consonant is held twice as long?',
  'Quel signe signifie qu''une consonne est tenue deux fois plus longtemps ?',
  '{"choices": ["Sukūn", "Fatḥa", "Shadda"], "correctIndex": 2}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-sukun-shadda';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'reading_check',
  'Nūn (ن) with a sukūn reads:',
  'Nūn (ن) avec un sukūn se lit :',
  '{"choices": ["na", "n (the consonant alone)", "nu"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-sukun-shadda';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'reading_check',
  'Mīm (م) with a shadda and a kasra reads:',
  'Mīm (م) avec une shadda et une kasra se lit :',
  '{"choices": ["ma", "mmi", "mu"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-sukun-shadda';

-- Comprehensive recap, both concepts — same pair.left values as Lessons
-- 1-2's matching exercises, so seedLessonReviewItems' item_key +
-- ignoreDuplicates:true resolves this to the SAME two existing rows,
-- never creating duplicates.
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match each mark name to what it means — a full recap.',
  'Associez chaque nom de signe à sa signification — récapitulatif complet.',
  $j${"pairs": [{"left": "sukun", "right": "a small circle above the letter, meaning no vowel sound"}, {"left": "shadda", "right": "a doubled consonant, held twice as long"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'reading-sukun-shadda';

-- =========================================================================
-- 5. Post-insert assertions.
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
  SELECT id INTO STRICT v_module_id FROM public.modules WHERE slug = 'sukun-and-shadda';

  SELECT count(*) INTO v_lesson_count FROM public.lessons WHERE module_id = v_module_id;
  IF v_lesson_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 lessons in sukun-and-shadda, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id WHERE l.module_id = v_module_id;
  IF v_section_count <> 14 THEN
    RAISE EXCEPTION 'Expected exactly 14 lesson_sections in sukun-and-shadda, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id WHERE l.module_id = v_module_id;
  IF v_exercise_count <> 15 THEN
    RAISE EXCEPTION 'Expected exactly 15 lesson_exercises in sukun-and-shadda, found %.', v_exercise_count;
  END IF;

  -- Modules 1-3 must be completely untouched by this migration.
  SELECT count(*) INTO v_prior_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2', 'harakat');
  IF v_prior_modules_untouched <> 18 THEN
    RAISE EXCEPTION 'Expected letter-shapes-1/letter-shapes-2/harakat to still have exactly 18 lessons combined, found %.', v_prior_modules_untouched;
  END IF;

  -- Every module besides letter-shapes-1/letter-shapes-2/harakat/
  -- sukun-and-shadda must remain empty (Modules 5-8 are not yet authored).
  SELECT count(*) INTO v_other_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug NOT IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda');
  IF v_other_modules_untouched <> 0 THEN
    RAISE EXCEPTION 'Expected zero lessons in modules other than letter-shapes-1/letter-shapes-2/harakat/sukun-and-shadda, found %.', v_other_modules_untouched;
  END IF;

  RAISE NOTICE 'Module 4 (sukun-and-shadda) seeded: module=%, lessons=3, sections=14, exercises=15.',
    v_module_id;
END $$;

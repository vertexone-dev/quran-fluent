-- Phase 3 / Sub-phase 3.3: Level 1, Module 3 ("harakat" — Short Vowels).
-- Four lessons teaching fatḥa, kasra, ḍamma, and a synthesis/review lesson,
-- authored per the locked Sub-phase 3.1/3.2/3.2A/3.2B design contract.
--
-- SCOPE (Task C, re-verified here): fatḥa/kasra/ḍamma only. sukūn, shadda,
-- tanwīn, madd, connected letter forms, and Tajweed are never taught or
-- tested — Lesson 4 makes one honest, single-line forward reference to
-- connected-letter-forms (a real, already-seeded module), nothing else.
--
-- FRENCH TERMINOLOGY CORRECTION (Sub-phase 3.2B, Task D): the module's
-- title_fr was seeded by the Phase 2.1 skeleton migration as "Voyelles
-- brèves (harakat)". Research into actual French Arabic-pedagogy usage
-- found "voyelle courte" is the dominant, more natural term (Sub-phase
-- 3.2B, Task A) — this migration corrects that one field, guarded by an
-- exact-value precondition so it can never silently overwrite an
-- unexpected value.
--
-- FRENCH ḌAMMA SOUND-ANCHOR CORRECTION (Sub-phase 3.2B, Task B): French
-- orthographic "u" is /y/ (as in "tu"), not /u/ — ḍamma's approximate
-- sound in French prose is anchored to "ou" (as in "vous"), never "u".
--
-- PRONUNCIATION WORDING (Sub-phase 3.2B, Task B; reviewed and RESOLVED in
-- Sub-phase 3.3B — see this migration's own governance note below and the
-- Sub-phase 3.3D gate report): every sound description uses
-- "approximately" plus an explicit variability caveat, directly supported
-- by peer-reviewed acoustic-phonetics evidence (emphatic-consonant
-- pharyngealization measurably shifts adjacent vowel formants) rather than
-- claiming a fixed universal equivalence.
--
-- VISUAL REPRESENTATION (Sub-phase 3.2/3.2B Task F, re-verified with a
-- fresh Playwright screenshot spike against the ACTUAL unstyled exercise-
-- choice renderer during this sub-phase — see this migration's own
-- discovered-gap note below): Bā' (ب) is the single, constant anchor
-- letter for every harakah shown in an `arabic_text`/`example` SECTION
-- (بَ / بِ / بُ) — those render correctly (font-quran, dir=rtl, lang=ar
-- already applied there). Exercise CHOICES and MATCHING pairs, by
-- contrast, render through a generic, unstyled control with no dir/lang/
-- font-quran treatment — confirmed BROKEN for letter+combining-mark
-- glyphs via a real Playwright screenshot (marks render detached/
-- mispositioned), even though bare single letters (no combining mark,
-- e.g. Module 1/2's existing letter_recognition choices) render fine in
-- the same unstyled path. Per Sub-phase 3.3 Section F's explicit
-- instruction ("STOP and report the exact gap rather than embedding
-- inaccessible content"), this migration's exercises therefore reference
-- harakat by TRANSLITERATED NAME ("Fatḥa"/"Kasra"/"Ḍamma") in every
-- choice/matching-pair value, never by a raw letter+mark glyph — an
-- application-code change to ChoiceControl/MatchingControl (adding dir/
-- lang/font-quran to their rendered option text) would be required before
-- glyph-based exercise options could ship safely, and is explicitly out
-- of this content-only migration's scope.
--
-- REVIEW-ITEM KEY CONSTRAINT: seedLessonReviewItems (src/lib/study.ts,
-- unchanged, generic) builds item_key as `${review_item_type}:${pair.left}`
-- verbatim, with no normalization. To produce exactly the locked keys
-- concept:fatha / concept:kasra / concept:damma (Sub-phase 3.2B Task H),
-- every review-seeding matching exercise's pair.left is the literal
-- lowercase, diacritic-free string "fatha"/"kasra"/"damma" — the one
-- deliberate exception to "always show the full transliterated name",
-- documented here rather than hidden, and required by the existing
-- generic mechanism, not a per-module hardcode in application code.
--
-- QUR'AN EXAMPLE (Task I): Surah 1, Āyah 2 only, in Lesson 4. Referenced
-- by (surah_number, ayah_number) FK only — no Qur'anic Arabic is
-- duplicated into this migration's content. Verified against the actual
-- stored canonical text before authoring (queried directly, not inferred):
-- ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ contains fatḥa (multiple: حَ, لَّ, رَ,
-- لَ...), kasra (multiple: لِ, هِ, بِّ, مِ), and ḍamma (once, clearly: دُ in
-- ٱلْحَمْدُ). Distinct from the 1:1 example already used in Module 2.
--
-- CONTENT GOVERNANCE: no content_sources row needed — this is original,
-- uncontested Arabic-orthography teaching prose (Sub-phase 3.2's Task M,
-- governance rule 6), and the one Qur'anic reference reuses the already-
-- governed Tanzil source via FK, not new quoted text.
--
-- CONTENT GOVERNANCE — FINAL (Sub-phase 3.2B Task K opened two review
-- items; both are now RESOLVED): (1) native-speaker naturalness pass on
-- the French sentences below — Sub-phase 3.3B's review found four
-- concrete issues, all four fixed in Sub-phase 3.3C: the "Son son exact"
-- collision (Lessons 1-3), "le son bref" in the Lesson 1-3 titles
-- (corrected to "le son court", consistent with the module-title fix
-- above), an English-calque phrase in Lesson 1, and an "au-dessous"/
-- "en dessous" inconsistency in Lesson 2; (2) pedagogy sign-off on the
-- EN/FR comparison-anchor words ("cat"/"pin"/"put", "chat"/"ville"/
-- "vous") — Sub-phase 3.3B's phonetic audit found all six anchors
-- defensible and already appropriately hedged; no change was needed.
-- RED ITEMS: 0. YELLOW ITEMS: 0. CONTENT GOVERNANCE: PASS. No
-- outstanding human-review blocker remains for this migration.

DO $$
DECLARE
  v_existing_lessons integer;
  v_module_title_fr text;
  v_level1_lesson_count integer;
BEGIN
  ---------------------------------------------------------------------------
  -- 0. Preconditions.
  ---------------------------------------------------------------------------
  SELECT count(*) INTO v_existing_lessons FROM public.lessons
  WHERE slug IN ('fatha', 'kasra', 'damma', 'reading-with-harakat');
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 4 Module 3 lesson slugs to already exist, found %. Aborting to avoid duplicate/conflicting seed data.', v_existing_lessons;
  END IF;

  SELECT title_fr INTO v_module_title_fr FROM public.modules WHERE slug = 'harakat';
  IF v_module_title_fr IS NULL THEN
    RAISE EXCEPTION 'Expected the harakat module to already exist (seeded by the Phase 2.1 skeleton migration). Aborting.';
  END IF;
  IF v_module_title_fr <> 'Voyelles brèves (harakat)' THEN
    RAISE EXCEPTION 'Expected harakat.title_fr to be exactly "Voyelles brèves (harakat)" (the Phase 2.1 skeleton value) before this correction, found "%". Aborting rather than risk overwriting an unexpected value.', v_module_title_fr;
  END IF;

  -- Modules 1-2 must be exactly the production-complete state this
  -- migration was authored against (13 real lessons + 1 placeholder = 14).
  SELECT count(*) INTO v_level1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2');
  IF v_level1_lesson_count <> 14 THEN
    RAISE EXCEPTION 'Expected exactly 14 lessons across letter-shapes-1/letter-shapes-2 (13 real + 1 placeholder) before this migration, found %.', v_level1_lesson_count;
  END IF;
END $$;

-- =========================================================================
-- 1. French title correction (Sub-phase 3.2B, Task D).
-- =========================================================================

UPDATE public.modules
SET title_fr = 'Voyelles courtes (harakat)'
WHERE slug = 'harakat' AND title_fr = 'Voyelles brèves (harakat)';

-- =========================================================================
-- 2. Lessons.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'fatha', 'The Fatḥa: The Short A Sound', 'La fatḥa : le son court A', 0, 5
FROM public.modules WHERE slug = 'harakat';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'kasra', 'The Kasra: The Short I Sound', 'La kasra : le son court I', 1, 5
FROM public.modules WHERE slug = 'harakat';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'damma', 'The Ḍamma: The Short U Sound', 'La ḍamma : le son court U', 2, 5
FROM public.modules WHERE slug = 'harakat';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-with-harakat', 'Reading With Harakat', 'Lire avec les harakat', 3, 7
FROM public.modules WHERE slug = 'harakat';

-- =========================================================================
-- 3. Lesson 1 — Fatḥa.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Arabic letters are usually written without their vowel sounds — a small mark called a harakah tells you how to pronounce them. The fatḥa is the first of the three you''ll learn in this module.',
  'Les lettres arabes s''écrivent généralement sans leurs voyelles — un petit signe appelé harakah indique comment les prononcer. La fatḥa est le premier des trois signes que vous allez apprendre dans ce module.'
FROM public.lessons WHERE slug = 'fatha';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بَ',
  'The fatḥa is a short diagonal stroke written above a letter. Applied to Bā'' (ب), it reads "ba" — a short vowel, approximately like the ''a'' in ''cat.'' Its exact sound can shift slightly depending on the letters around it.',
  'La fatḥa est un petit trait diagonal écrit au-dessus d''une lettre. Appliquée à Bā'' (ب), elle se lit « ba » — une voyelle courte, à peu près comme le « a » de « chat ». La prononciation exacte peut varier légèrement selon les lettres qui l''entourent.'
FROM public.lessons WHERE slug = 'fatha';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'جَ',
  'The same mark works the same way on any letter. Jīm (ج) with a fatḥa reads "ja."',
  'Le même signe fonctionne de la même façon sur n''importe quelle lettre. Jīm (ج) avec une fatḥa se lit « ja ».'
FROM public.lessons WHERE slug = 'fatha';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'The fatḥa always sits directly above the letter it marks — remembering "above" now will help you tell it apart from the kasra, which sits below.',
  'La fatḥa se trouve toujours directement au-dessus de la lettre qu''elle marque — retenir « au-dessus » vous aidera à la distinguer de la kasra, qui se trouve en dessous.'
FROM public.lessons WHERE slug = 'fatha';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now recognize the fatḥa and read it on a letter you already know.',
  'Vous savez maintenant reconnaître la fatḥa et la lire sur une lettre que vous connaissez déjà.'
FROM public.lessons WHERE slug = 'fatha';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'vowel_recognition',
  'Which harakah is a short diagonal stroke written above the letter?',
  'Quel harakah est un petit trait diagonal écrit au-dessus de la lettre ?',
  '{"choices": ["Fatḥa", "Kasra", "Ḍamma"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'fatha';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'vowel_recognition',
  'When you add a fatḥa to Bā'' (ب), which sound does it produce?',
  'Lorsque vous ajoutez une fatḥa à Bā'' (ب), quel son produit-elle ?',
  '{"choices": ["a short ''u'' sound", "a short ''a'' sound", "a short ''i'' sound"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'fatha';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'The fatḥa is written below the letter it marks.',
  'La fatḥa s''écrit en dessous de la lettre qu''elle marque.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'fatha';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'true_false',
  'A letter with no harakah written on it still has a short vowel sound.',
  'Une lettre sans harakah a quand même un son de voyelle courte.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'fatha';

-- Single-pair matching, deliberately: fatḥa is the only concept introduced
-- so far, so there is nothing yet to contrast it against. pair.left is the
-- literal lowercase "fatha" (not "Fatḥa") so seedLessonReviewItems derives
-- exactly the locked key concept:fatha — see this migration's header note.
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match the harakah name to how it''s written.', 'Associez le nom du harakah à la façon dont il s''écrit.',
  $j${"pairs": [{"left": "fatha", "right": "a diagonal stroke above the letter"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'fatha';

-- =========================================================================
-- 4. Lesson 2 — Kasra.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You''ve learned the fatḥa, written above a letter. Now for the second harakah — the kasra, written below.',
  'Vous avez appris la fatḥa, écrite au-dessus d''une lettre. Voici maintenant le deuxième harakah — la kasra, écrite en dessous.'
FROM public.lessons WHERE slug = 'kasra';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بِ',
  'The kasra is a short diagonal stroke written below a letter. Applied to Bā'' (ب), it reads "bi" — a short vowel, approximately like the ''i'' in ''pin.'' Its exact sound can shift slightly depending on the letters around it.',
  'La kasra est un petit trait diagonal écrit en dessous d''une lettre. Appliquée à Bā'' (ب), elle se lit « bi » — une voyelle courte, à peu près comme le « i » de « ville ». La prononciation exacte peut varier légèrement selon les lettres qui l''entourent.'
FROM public.lessons WHERE slug = 'kasra';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'تِ',
  'Tā'' (ت) with a kasra reads "ti," the same way Bā'' did.',
  'Tā'' (ت) avec une kasra se lit « ti », de la même façon que Bā''.'
FROM public.lessons WHERE slug = 'kasra';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Position is your fastest clue: above the letter is the fatḥa, below is the kasra.',
  'La position est votre repère le plus rapide : au-dessus de la lettre, c''est la fatḥa ; en dessous, c''est la kasra.'
FROM public.lessons WHERE slug = 'kasra';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now tell the fatḥa and kasra apart, by position and by sound.',
  'Vous savez maintenant distinguer la fatḥa et la kasra, par leur position et par leur son.'
FROM public.lessons WHERE slug = 'kasra';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'vowel_recognition',
  'Which harakah is a short diagonal stroke written below the letter?',
  'Quel harakah est un petit trait diagonal écrit en dessous de la lettre ?',
  '{"choices": ["Kasra", "Fatḥa", "Ḍamma"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'kasra';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'vowel_recognition',
  'When you add a kasra to Tā'' (ت), which sound does it produce?',
  'Lorsque vous ajoutez une kasra à Tā'' (ت), quel son produit-elle ?',
  '{"choices": ["a short ''a'' sound", "a short ''u'' sound", "a short ''i'' sound"], "correctIndex": 2}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'kasra';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'The kasra is written above the letter it marks.',
  'La kasra s''écrit au-dessus de la lettre qu''elle marque.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'kasra';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'true_false',
  'The fatḥa and the kasra are both short diagonal strokes — only their position differs.',
  'La fatḥa et la kasra sont toutes deux de petits traits diagonaux — seule leur position diffère.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'kasra';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match each harakah name to how it''s written.', 'Associez chaque nom de harakah à la façon dont il s''écrit.',
  $j${"pairs": [{"left": "fatha", "right": "a diagonal stroke above the letter"}, {"left": "kasra", "right": "a diagonal stroke below the letter"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'kasra';

-- =========================================================================
-- 5. Lesson 3 — Ḍamma.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'One harakah left. The ḍamma completes the set of three short vowels.',
  'Il reste un harakah. La ḍamma complète l''ensemble des trois voyelles courtes.'
FROM public.lessons WHERE slug = 'damma';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بُ',
  'The ḍamma is a small curved mark, like a tiny wāw, written above a letter. Applied to Bā'' (ب), it reads "bu" — a short vowel, approximately like the ''u'' in ''put'' (in French: like the "ou" in "vous," never the French letter "u," which is a different sound). Its exact sound can shift slightly depending on the letters around it.',
  'La ḍamma est un petit signe recourbé, comme un tout petit wāw, écrit au-dessus d''une lettre. Appliquée à Bā'' (ب), elle se lit « bu » — une voyelle courte, à peu près comme le « ou » de « vous » (jamais comme la lettre française « u », qui est un son différent). La prononciation exacte peut varier légèrement selon les lettres qui l''entourent.'
FROM public.lessons WHERE slug = 'damma';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'جُ',
  'Jīm (ج) with a ḍamma reads "ju."',
  'Jīm (ج) avec une ḍamma se lit « ju ».'
FROM public.lessons WHERE slug = 'damma';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Both the fatḥa and the ḍamma sit above the letter — tell them apart by shape: the fatḥa is a straight diagonal stroke, the ḍamma is a small curve.',
  'La fatḥa et la ḍamma se trouvent toutes deux au-dessus de la lettre — distinguez-les par leur forme : la fatḥa est un trait diagonal droit, la ḍamma est une petite courbe.'
FROM public.lessons WHERE slug = 'damma';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You now know all three harakat: fatḥa, kasra, and ḍamma.',
  'Vous connaissez maintenant les trois harakat : fatḥa, kasra et ḍamma.'
FROM public.lessons WHERE slug = 'damma';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'vowel_recognition',
  'Which harakah is a small curved mark, like a tiny wāw, above the letter?',
  'Quel harakah est un petit signe recourbé, comme un tout petit wāw, au-dessus de la lettre ?',
  '{"choices": ["Fatḥa", "Kasra", "Ḍamma"], "correctIndex": 2}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'damma';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'vowel_recognition',
  'When you add a ḍamma to Jīm (ج), which sound does it produce?',
  'Lorsque vous ajoutez une ḍamma à Jīm (ج), quel son produit-elle ?',
  '{"choices": ["a short ''i'' sound", "a short ''a'' sound", "a short ''u'' sound"], "correctIndex": 2}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'damma';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'The fatḥa and the ḍamma are both written above the letter, but they have different shapes.',
  'La fatḥa et la ḍamma s''écrivent toutes deux au-dessus de la lettre, mais elles ont des formes différentes.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'damma';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'matching',
  'Match each harakah name to how it''s written — all three so far.',
  'Associez chaque nom de harakah à la façon dont il s''écrit — les trois vus jusqu''ici.',
  $j${"pairs": [{"left": "fatha", "right": "a diagonal stroke above the letter"}, {"left": "kasra", "right": "a diagonal stroke below the letter"}, {"left": "damma", "right": "a small curved mark above the letter"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'damma';

-- =========================================================================
-- 6. Lesson 4 — Reading With Harakat (synthesis only, no new harakat).
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You now know all three harakat: fatḥa (above, a straight stroke), kasra (below, a straight stroke), and ḍamma (above, a small curve). This lesson brings them together — no new marks, just practice recognizing all three, and a look at where they appear in a real, familiar verse from the Qur''an.',
  'Vous connaissez maintenant les trois harakat : la fatḥa (au-dessus, un trait droit), la kasra (en dessous, un trait droit) et la ḍamma (au-dessus, une petite courbe). Cette leçon les réunit — aucun nouveau signe, seulement de la pratique pour bien les reconnaître tous les trois, et un aperçu de leur présence dans un verset réel et familier du Coran.'
FROM public.lessons WHERE slug = 'reading-with-harakat';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'بَ بِ بُ',
  'Bā'' with all three harakat, side by side: fatḥa (بَ, "ba"), kasra (بِ, "bi"), ḍamma (بُ, "bu"). Once you''re comfortable reading these on letters you know, you''ll be ready to start reading letters joined together in words — the subject of a later module.',
  'Bā'' avec les trois harakat, côte à côte : fatḥa (بَ, « ba »), kasra (بِ, « bi »), ḍamma (بُ, « bu »). Une fois à l''aise pour les lire sur des lettres que vous connaissez, vous serez prêt(e) à commencer la lecture de lettres liées entre elles dans des mots — le sujet d''un module ultérieur.'
FROM public.lessons WHERE slug = 'reading-with-harakat';

-- Surah 1, Āyah 2 — referenced by FK only, never quoted here. Verified
-- (Sub-phase 3.2B, Task I) to contain fatḥa and kasra multiple times and
-- ḍamma once, clearly, in the actual stored canonical text.
INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 1, 2,
  'You already know this verse by ear — it''s the second āyah of Al-Fatiha. Look for the harakat you''ve just learned: several fatḥas and kasras, and one clear ḍamma. You don''t need to read the whole verse yet — just spot the marks.',
  'Vous connaissez déjà ce verset à l''oreille — c''est le deuxième āyah d''Al-Fatiha. Repérez les harakat que vous venez d''apprendre : plusieurs fatḥas et kasras, et une ḍamma bien visible. Vous n''avez pas encore besoin de lire tout le verset — repérez seulement les signes.'
FROM public.lessons WHERE slug = 'reading-with-harakat';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  'Module complete: you can recognize and read all three short vowels — fatḥa, kasra, and ḍamma — on any letter you know, and spot them in real Qur''anic text.',
  'Module terminé : vous savez reconnaître et lire les trois voyelles courtes — fatḥa, kasra et ḍamma — sur n''importe quelle lettre que vous connaissez, et les repérer dans un texte coranique réel.'
FROM public.lessons WHERE slug = 'reading-with-harakat';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'vowel_recognition',
  'Which harakah sits above the letter and is a straight diagonal stroke?',
  'Quel harakah se trouve au-dessus de la lettre et est un trait diagonal droit ?',
  '{"choices": ["Ḍamma", "Fatḥa", "Kasra"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-with-harakat';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'vowel_recognition',
  'Which harakah is the only one written below the letter?',
  'Quel harakah est le seul écrit en dessous de la lettre ?',
  '{"choices": ["Fatḥa", "Ḍamma", "Kasra"], "correctIndex": 2}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-with-harakat';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'vowel_recognition',
  'Which harakah is a small curve above the letter, not a straight stroke?',
  'Quel harakah est une petite courbe au-dessus de la lettre, et non un trait droit ?',
  '{"choices": ["Kasra", "Ḍamma", "Fatḥa"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-with-harakat';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'reading_check',
  'Rā'' (ر) with a fatḥa reads:',
  'Rā'' (ر) avec une fatḥa se lit :',
  '{"choices": ["ri", "ra", "ru"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-with-harakat';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'reading_check',
  'Mīm (م) with a ḍamma reads:',
  'Mīm (م) avec une ḍamma se lit :',
  '{"choices": ["mi", "ma", "mu"], "correctIndex": 2}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-with-harakat';

-- Comprehensive recap, all three concepts — same pair.left values as
-- Lessons 1-3's matching exercises, so seedLessonReviewItems' item_key +
-- ignoreDuplicates:true resolves this to the SAME three existing rows,
-- never creating duplicates (Task H).
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 5, 'matching',
  'Match each harakah name to how it''s written — a full recap.',
  'Associez chaque nom de harakah à la façon dont il s''écrit — récapitulatif complet.',
  $j${"pairs": [{"left": "fatha", "right": "a diagonal stroke above the letter"}, {"left": "kasra", "right": "a diagonal stroke below the letter"}, {"left": "damma", "right": "a small curved mark above the letter"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'reading-with-harakat';

-- =========================================================================
-- 7. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_module_title_fr text;
  v_letter_shapes_untouched integer;
  v_other_modules_untouched integer;
BEGIN
  SELECT id INTO STRICT v_module_id FROM public.modules WHERE slug = 'harakat';

  SELECT title_fr INTO v_module_title_fr FROM public.modules WHERE slug = 'harakat';
  IF v_module_title_fr <> 'Voyelles courtes (harakat)' THEN
    RAISE EXCEPTION 'Expected harakat.title_fr to be "Voyelles courtes (harakat)" after this migration, found "%".', v_module_title_fr;
  END IF;

  SELECT count(*) INTO v_lesson_count FROM public.lessons WHERE module_id = v_module_id;
  IF v_lesson_count <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 lessons in harakat, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id WHERE l.module_id = v_module_id;
  IF v_section_count <> 19 THEN
    RAISE EXCEPTION 'Expected exactly 19 lesson_sections in harakat, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id WHERE l.module_id = v_module_id;
  IF v_exercise_count <> 20 THEN
    RAISE EXCEPTION 'Expected exactly 20 lesson_exercises in harakat, found %.', v_exercise_count;
  END IF;

  -- Modules 1-2 must be completely untouched by this migration.
  SELECT count(*) INTO v_letter_shapes_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2');
  IF v_letter_shapes_untouched <> 14 THEN
    RAISE EXCEPTION 'Expected letter-shapes-1/letter-shapes-2 to still have exactly 14 lessons combined, found %.', v_letter_shapes_untouched;
  END IF;

  -- Every module besides letter-shapes-1/letter-shapes-2/harakat must
  -- remain empty (Modules 4-8 are not yet authored).
  SELECT count(*) INTO v_other_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug NOT IN ('letter-shapes-1', 'letter-shapes-2', 'harakat');
  IF v_other_modules_untouched <> 0 THEN
    RAISE EXCEPTION 'Expected zero lessons in modules other than letter-shapes-1/letter-shapes-2/harakat, found %.', v_other_modules_untouched;
  END IF;

  RAISE NOTICE 'Module 3 (harakat) seeded: module=%, lessons=4, sections=19, exercises=20. title_fr corrected to "Voyelles courtes (harakat)".',
    v_module_id;
END $$;

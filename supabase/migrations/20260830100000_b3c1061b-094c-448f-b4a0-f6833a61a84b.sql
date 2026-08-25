-- Phase 3 / Sub-phase 6 (Gate A+B): Level 1, Module 6 ("connected-letter-forms"
-- — Connected Letter Forms). Three lessons teaching how letters change
-- shape by position in a word, the six non-connecting letters, and a
-- reading-synthesis lesson, authored under the accelerated three-gate
-- workflow.
--
-- ROADMAP CONTEXT: slug/titles queried directly from the live `modules`
-- table before authoring — title_en "Connected Letter Forms", title_fr
-- "Formes de lettres liées" (actual seeded value, used verbatim
-- throughout for terminology consistency: "liées", not "connectées").
--
-- PREREQUISITE AUDIT: all 28 isolated Arabic letters are already taught
-- (Modules 1-2, confirmed by direct query — every letter from ا through
-- ي has its own lesson), plus fatḥa/kasra/ḍamma (Module 3), sukūn/shadda
-- (Module 4), and tanwīn (Module 5). This module can therefore freely use
-- any letter/word example without introducing anything new except the
-- shape-changing concept itself.
--
-- SCOPE: how connecting letters take up to four contextual shapes
-- (isolated/initial/medial/final), the six letters that never connect
-- forward (ا د ذ ر ز و — a closed, uncontested set in Arabic orthography),
-- and RTL word-building direction. Deliberately UNVOWELLED example words:
-- the focus here is letter shape/position, not the harakat/sukūn/shadda/
-- tanwīn marks already taught in Modules 3-5 — mixing both concerns in
-- one lesson would raise cognitive load without pedagogical benefit, and
-- full vowelled-word reading is explicitly the next module's job
-- ("first-reading-practice", already seeded, referenced honestly by slug
-- in Lesson 3, not invented). Explicitly EXCLUDED, matching every prior
-- module's boundary: Tajweed, grammar/morphology (e.g. why certain roots
-- take certain forms), and any pronunciation/case theory.
--
-- VISUAL REPRESENTATION — a materially different rendering question from
-- Modules 3-5, verified fresh rather than assumed to behave the same way:
-- connected letter forms are ordinary base-letter Unicode codepoints
-- (U+0621-U+064A) rendered via the browser/font's standard Arabic
-- contextual-shaping (OpenType init/medi/fina/liga), not combining marks
-- requiring explicit mark-positioning support. A fresh Playwright
-- screenshot spike (same methodology as Sub-phase 3.2/3.3 and Modules
-- 4-5) tested real connected words (كتاب, درس) in BOTH the safe
-- (arabic_text section: font-quran/dir=rtl/lang=ar) and the unsafe
-- (unstyled exercise-choice/matching) paths, at desktop and 390x844
-- mobile: unlike harakat/sukūn/shadda/tanwīn, connected words rendered
-- CORRECTLY in both paths, with proper joining and no clipping or
-- breakage. This is a genuine, evidence-based difference from Modules
-- 3-5 — exercise choices and matching pairs in THIS module therefore use
-- real Arabic connected-word glyphs directly (not transliterated names),
-- which is both safe and more pedagogically authentic.
--
-- REVIEW-ITEM KEYS: two durable concepts, using the same generic
-- seedLessonReviewItems mechanism as Modules 3-5 (src/lib/study.ts,
-- unchanged) — item_key = `${review_item_type}:${pair.left}` verbatim.
-- Unlike Modules 3-5's single-mark-name keys, this module's concepts are
-- rules rather than named diacritics, so pair.left uses readable hyphenated
-- keys (no format constraint on item_key beyond being text): "concept:
-- letter-positions" and "concept:non-connectors". No module-specific
-- runtime logic was added — the existing generic mechanism represents
-- these concepts without modification.
--
-- EXERCISE TYPES: multiple_choice, true_false, matching, reading_check —
-- all already supported, no new type introduced. reading_check questions
-- apply the non-connector rule to real words (e.g. "which letter in درس
-- does not connect to the one after it"), matching the spirit Modules 3-5
-- used it for (applying a rule to read/analyze real text).
--
-- QUR'AN EXAMPLE (Lesson 3): Surah 1, Āyah 6 only — fresh (Āyah 1 used in
-- Module 2, Āyah 2 in Module 3, Āyah 4 in Module 4; Āyah 3 was skipped as
-- a near-duplicate of Āyah 1's ending, Āyah 5 was considered but Āyah 6's
-- ٱهْدِنَا cleanly demonstrates a non-connector break — the hā'/dāl connect,
-- then dāl does not connect forward to nūn). Verified against the actual
-- stored canonical text before authoring (queried directly): ٱهْدِنَا
-- ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ. Referenced by (surah_number, ayah_number) FK
-- only; no Qur'anic Arabic is duplicated into this migration's content.
--
-- CONTENT GOVERNANCE: no content_sources row needed — original,
-- uncontested Arabic-orthography teaching prose (same governance basis as
-- Modules 1-5); the one Qur'anic reference reuses the already-governed
-- Tanzil source via FK, not new quoted text. RED ITEMS: 0. YELLOW ITEMS:
-- 0. The six-non-connector-letter set is settled, uncontested Arabic
-- orthography (consistent across every standard pedagogy source), not a
-- linguistic judgment call.

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
  WHERE slug IN ('how-letters-connect', 'non-connecting-letters', 'reading-connected-words');
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 3 Module 6 lesson slugs to already exist, found %. Aborting to avoid duplicate/conflicting seed data.', v_existing_lessons;
  END IF;

  SELECT id INTO v_module_id FROM public.modules WHERE slug = 'connected-letter-forms';
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Expected the connected-letter-forms module to already exist (seeded by the Phase 2.1 skeleton migration). Aborting.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.lessons WHERE module_id = v_module_id) THEN
    RAISE EXCEPTION 'Expected connected-letter-forms to have zero lessons before this migration. Aborting.';
  END IF;

  -- Modules 1-5 must be exactly the production-complete state this
  -- migration was authored against: letter-shapes-1 (5) + letter-shapes-2
  -- (9) + harakat (4) + sukun-and-shadda (3) + tanwin (4) = 25.
  SELECT count(*) INTO v_prior_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda', 'tanwin');
  IF v_prior_lesson_count <> 25 THEN
    RAISE EXCEPTION 'Expected exactly 25 lessons across letter-shapes-1/letter-shapes-2/harakat/sukun-and-shadda/tanwin before this migration, found %.', v_prior_lesson_count;
  END IF;
END $$;

-- =========================================================================
-- 1. Lessons.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'how-letters-connect', 'How Letters Connect', 'Comment les lettres se lient', 0, 6
FROM public.modules WHERE slug = 'connected-letter-forms';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'non-connecting-letters', 'Letters That Don''t Connect Forward', 'Les lettres qui ne se lient pas vers l''avant', 1, 6
FROM public.modules WHERE slug = 'connected-letter-forms';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-connected-words', 'Reading Connected Words', 'Lire des mots aux lettres liées', 2, 7
FROM public.modules WHERE slug = 'connected-letter-forms';

-- =========================================================================
-- 2. Lesson 1 — How Letters Connect.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You know all 28 Arabic letters by their isolated shape — how each one looks alone. But Arabic is a joined, cursive script: most letters change shape slightly depending on where they sit in a word. This lesson shows you how.',
  'Vous connaissez les 28 lettres arabes sous leur forme isolée — leur apparence seules. Mais l''arabe est une écriture liée, cursive : la plupart des lettres changent légèrement de forme selon leur position dans un mot. Cette leçon vous montre comment.'
FROM public.lessons WHERE slug = 'how-letters-connect';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ب بـ ـبـ ـب',
  'The Bā'' (ب) you already know is its isolated form — how it looks alone. Within a word, the same letter can look different: بـ at the start of a word (initial), ـبـ in the middle (medial), and ـب at the end (final). All four are the same letter, just shaped by their position.',
  'Le Bā'' (ب) que vous connaissez déjà est sa forme isolée — son apparence seule. Dans un mot, la même lettre peut avoir un aspect différent : بـ au début d''un mot (initiale), ـبـ au milieu (médiane), et ـب à la fin (finale). Ce sont les quatre mêmes lettres, seulement façonnées par leur position.'
FROM public.lessons WHERE slug = 'how-letters-connect';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'كتاب',
  'Here''s a real word built from connected letters: كتاب — the word for "book," spelled Kāf, Tā'', Alif, Bā''. Notice how each letter reaches toward its neighbor to form one flowing shape.',
  'Voici un vrai mot construit à partir de lettres liées : كتاب — le mot pour « livre », composé de Kāf, Tā'', Alif, Bā''. Remarquez comment chaque lettre s''étend vers sa voisine pour former une forme continue.'
FROM public.lessons WHERE slug = 'how-letters-connect';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Reading direction matters here too: Arabic words are built right to left, so the first letter of a word is the one furthest to the right.',
  'Le sens de lecture compte aussi ici : les mots arabes se construisent de droite à gauche, donc la première lettre d''un mot est celle la plus à droite.'
FROM public.lessons WHERE slug = 'how-letters-connect';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now recognize that a letter''s shape can change with its position in a word — isolated, initial, medial, or final.',
  'Vous savez maintenant reconnaître que la forme d''une lettre peut changer selon sa position dans un mot — isolée, initiale, médiane ou finale.'
FROM public.lessons WHERE slug = 'how-letters-connect';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'multiple_choice',
  'Which shape does a letter take at the very start of a word?',
  'Quelle forme une lettre prend-elle au tout début d''un mot ?',
  '{"choices": ["Isolated", "Initial", "Final"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'how-letters-connect';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'multiple_choice',
  'In the word كتاب (spelled Kāf, Tā'', Alif, Bā''), which letter is written first — furthest to the right?',
  'Dans le mot كتاب (Kāf, Tā'', Alif, Bā''), quelle lettre est écrite en premier — la plus à droite ?',
  '{"choices": ["ك", "ت", "ب"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'how-letters-connect';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'A letter always looks exactly the same no matter where it appears in a word.',
  'Une lettre a toujours exactement la même apparence, peu importe sa position dans un mot.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'how-letters-connect';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'true_false',
  'Arabic words are built by joining letters from right to left.',
  'Les mots arabes se construisent en liant les lettres de droite à gauche.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'how-letters-connect';

-- Single-pair matching, deliberately: the shape-changing concept is the
-- only one introduced so far. pair.left is the literal "letter-positions"
-- so seedLessonReviewItems derives exactly concept:letter-positions.
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match the concept to what it means.', 'Associez le concept à sa signification.',
  $j${"pairs": [{"left": "letter-positions", "right": "a letter's shape can change depending on where it sits in a word: isolated, initial, medial, or final"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'how-letters-connect';

-- =========================================================================
-- 3. Lesson 2 — Letters That Don't Connect Forward.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Most letters connect on both sides. But six letters are different: they connect to the letter before them, but never to the letter after. Recognizing these six will help you read real words correctly.',
  'La plupart des lettres se lient des deux côtés. Mais six lettres sont différentes : elles se lient à la lettre qui les précède, mais jamais à celle qui les suit. Reconnaître ces six lettres vous aidera à bien lire de vrais mots.'
FROM public.lessons WHERE slug = 'non-connecting-letters';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ا د ذ ر ز و',
  'These six letters — Alif (ا), Dāl (د), Dhāl (ذ), Rā'' (ر), Zāy (ز), and Wāw (و) — never connect forward. After one of them, the next letter always starts a fresh, unconnected shape.',
  'Ces six lettres — Alif (ا), Dāl (د), Dhāl (ذ), Rā'' (ر), Zāy (ز) et Wāw (و) — ne se lient jamais vers l''avant. Après l''une d''elles, la lettre suivante commence toujours une forme nouvelle, non liée.'
FROM public.lessons WHERE slug = 'non-connecting-letters';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'example', 'درس',
  'In درس — the word for "lesson," spelled Dāl, Rā'', Sīn — the Dāl (د) doesn''t connect to the Rā'' (ر) after it. You can see a small gap between them, even though they''re part of the same word.',
  'Dans درس — le mot pour « leçon », composé de Dāl, Rā'', Sīn — le Dāl (د) ne se lie pas au Rā'' (ر) qui le suit. On voit un petit espace entre les deux, même s''ils font partie du même mot.'
FROM public.lessons WHERE slug = 'non-connecting-letters';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'These six letters only ever have two shapes — isolated and final, which look the same — never initial or medial, because they never connect forward.',
  'Ces six lettres n''ont jamais que deux formes — isolée et finale, qui se ressemblent — jamais initiale ni médiane, puisqu''elles ne se lient jamais vers l''avant.'
FROM public.lessons WHERE slug = 'non-connecting-letters';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now recognize the six letters that never connect to the letter after them.',
  'Vous savez maintenant reconnaître les six lettres qui ne se lient jamais à la lettre qui les suit.'
FROM public.lessons WHERE slug = 'non-connecting-letters';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'multiple_choice',
  'Which of these is one of the six letters that never connects forward?',
  'Laquelle de ces lettres fait partie des six qui ne se lient jamais vers l''avant ?',
  '{"choices": ["ب", "د", "م"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'non-connecting-letters';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'multiple_choice',
  'How many shapes can a non-connecting letter have?',
  'Combien de formes une lettre non liante peut-elle avoir ?',
  '{"choices": ["Four", "Two", "Three"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'non-connecting-letters';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'The six non-connecting letters can appear in an initial shape, connecting to the letter after them.',
  'Les six lettres non liantes peuvent apparaître sous une forme initiale, liée à la lettre qui les suit.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'non-connecting-letters';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'true_false',
  'After a non-connecting letter, the next letter starts a fresh, unconnected shape.',
  'Après une lettre non liante, la lettre suivante commence une forme nouvelle, non liée.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'non-connecting-letters';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match each concept to what it means.', 'Associez chaque concept à sa signification.',
  $j${"pairs": [{"left": "letter-positions", "right": "a letter's shape can change depending on where it sits in a word: isolated, initial, medial, or final"}, {"left": "non-connectors", "right": "six letters — ا د ذ ر ز و — that never connect to the letter after them"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'non-connecting-letters';

-- =========================================================================
-- 4. Lesson 3 — Reading Connected Words (synthesis only, no new marks).
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You now know both ideas: letters change shape by position (isolated, initial, medial, final), and six letters never connect forward. This lesson brings them together — no new rules, just practice applying both to real words, including a look at where a non-connecting letter appears in a real, familiar verse from the Qur''an.',
  'Vous connaissez maintenant les deux idées : les lettres changent de forme selon leur position (isolée, initiale, médiane, finale), et six lettres ne se lient jamais vers l''avant. Cette leçon les réunit — aucune nouvelle règle, seulement de la pratique pour appliquer les deux à de vrais mots, avec un aperçu de la présence d''une lettre non liante dans un verset réel et familier du Coran.'
FROM public.lessons WHERE slug = 'reading-connected-words';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'كتاب درس',
  'Side by side: كتاب ("book") where every letter connects to its neighbor, and درس ("lesson") where the Dāl breaks the connection partway through. Once you''re comfortable telling these apart, you''ll be ready to start reading full, vowelled words — the subject of a later module.',
  'Côte à côte : كتاب (« livre »), où chaque lettre se lie à sa voisine, et درس (« leçon »), où le Dāl interrompt la liaison au milieu du mot. Une fois à l''aise pour les distinguer, vous serez prêt(e) à commencer la lecture de mots complets et vocalisés — le sujet d''un module ultérieur.'
FROM public.lessons WHERE slug = 'reading-connected-words';

-- Surah 1, Āyah 6 — referenced by FK only, never quoted here. Verified
-- against the actual stored canonical text before authoring: ٱهْدِنَا
-- ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ. ٱهْدِنَا (hā'-dāl-nūn-alif) cleanly demonstrates
-- the dāl/nūn break taught in Lesson 2. Distinct from the 1:1, 1:2, and
-- 1:4 examples already used in Modules 2-4 (1:3 and 1:5 were not used).
INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 1, 6,
  'You already know this verse by ear — it''s the sixth āyah of Al-Fatiha. Look at the first word: the Hā'' connects forward to the Dāl, but the Dāl — one of the six non-connecting letters — does not connect forward to the Nūn after it. You don''t need to read the whole verse yet — just spot the break.',
  'Vous connaissez déjà ce verset à l''oreille — c''est le sixième āyah d''Al-Fatiha. Regardez le premier mot : le Hā'' se lie vers l''avant au Dāl, mais le Dāl — l''une des six lettres non liantes — ne se lie pas vers l''avant au Nūn qui le suit. Vous n''avez pas encore besoin de lire tout le verset — repérez seulement la rupture.'
FROM public.lessons WHERE slug = 'reading-connected-words';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  'Module complete: you can recognize how letters change shape by position, spot the six non-connecting letters, and find a connection break in real Qur''anic text.',
  'Module terminé : vous savez reconnaître comment les lettres changent de forme selon leur position, repérer les six lettres non liantes, et trouver une rupture de liaison dans un texte coranique réel.'
FROM public.lessons WHERE slug = 'reading-connected-words';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'multiple_choice',
  'Which idea explains why the same letter can look different in different words?',
  'Quelle idée explique pourquoi la même lettre peut avoir un aspect différent selon les mots ?',
  '{"choices": ["Non-connecting letters", "Letter position (isolated/initial/medial/final)", "Harakat"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-connected-words';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'How many letters never connect to the one that follows them?',
  'Combien de lettres ne se lient jamais à celle qui les suit ?',
  '{"choices": ["Three", "Six", "Twenty-eight"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-connected-words';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'reading_check',
  'In درس, which letter does not connect to the one after it?',
  'Dans درس, quelle lettre ne se lie pas à celle qui la suit ?',
  '{"choices": ["د", "ر", "س"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-connected-words';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'reading_check',
  'In ٱهْدِنَا (from the Qur''an example), which letter does not connect to the one after it?',
  'Dans ٱهْدِنَا (l''exemple coranique), quelle lettre ne se lie pas à celle qui la suit ?',
  '{"choices": ["ه", "د", "ن"], "correctIndex": 1}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'reading-connected-words';

-- Comprehensive recap, both concepts — same pair.left values as Lessons
-- 1-2's matching exercises, so seedLessonReviewItems' item_key +
-- ignoreDuplicates:true resolves this to the SAME two existing rows,
-- never creating duplicates.
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match each concept to what it means — a full recap.',
  'Associez chaque concept à sa signification — récapitulatif complet.',
  $j${"pairs": [{"left": "letter-positions", "right": "a letter's shape can change depending on where it sits in a word: isolated, initial, medial, or final"}, {"left": "non-connectors", "right": "six letters — ا د ذ ر ز و — that never connect to the letter after them"}]}$j$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'reading-connected-words';

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
  SELECT id INTO STRICT v_module_id FROM public.modules WHERE slug = 'connected-letter-forms';

  SELECT count(*) INTO v_lesson_count FROM public.lessons WHERE module_id = v_module_id;
  IF v_lesson_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 lessons in connected-letter-forms, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id WHERE l.module_id = v_module_id;
  IF v_section_count <> 14 THEN
    RAISE EXCEPTION 'Expected exactly 14 lesson_sections in connected-letter-forms, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id WHERE l.module_id = v_module_id;
  IF v_exercise_count <> 15 THEN
    RAISE EXCEPTION 'Expected exactly 15 lesson_exercises in connected-letter-forms, found %.', v_exercise_count;
  END IF;

  -- Modules 1-5 must be completely untouched by this migration.
  SELECT count(*) INTO v_prior_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda', 'tanwin');
  IF v_prior_modules_untouched <> 25 THEN
    RAISE EXCEPTION 'Expected letter-shapes-1/letter-shapes-2/harakat/sukun-and-shadda/tanwin to still have exactly 25 lessons combined, found %.', v_prior_modules_untouched;
  END IF;

  -- Every module besides letter-shapes-1/letter-shapes-2/harakat/
  -- sukun-and-shadda/tanwin/connected-letter-forms must remain empty
  -- (Modules 7-8 are not yet authored).
  SELECT count(*) INTO v_other_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug NOT IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda', 'tanwin', 'connected-letter-forms');
  IF v_other_modules_untouched <> 0 THEN
    RAISE EXCEPTION 'Expected zero lessons in modules other than letter-shapes-1/letter-shapes-2/harakat/sukun-and-shadda/tanwin/connected-letter-forms, found %.', v_other_modules_untouched;
  END IF;

  RAISE NOTICE 'Module 6 (connected-letter-forms) seeded: module=%, lessons=3, sections=14, exercises=15.',
    v_module_id;
END $$;

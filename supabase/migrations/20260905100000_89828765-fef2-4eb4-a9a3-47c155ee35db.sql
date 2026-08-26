-- Level 3 (Roots & Word Patterns) Batch 1 (Gate A+B): "arabic-roots-intro"
-- and "word-patterns" -- the first two Level 3 modules, authored
-- together as one consolidated batch. Level 3's identity
-- (roots-and-word-patterns) is pre-seeded in the levels table, not
-- invented here.
--
-- ARCHITECTURE: zero schema changes, zero RLS changes, zero new
-- exercise types, zero new review-item types. review_items.item_type
-- and lesson_exercises.review_item_type already permit 'root' (CHECK
-- constraints verified before authoring, 0 existing rows of that type)
-- -- this batch is the first real use. The one required application-
-- code change (STEP_LEVEL_SLUGS gaining a 'roots' entry in
-- src/lib/placement.ts) ships alongside this migration, not inside it.
--
-- CONTENT SOURCE: zero new vocabulary, zero new ayahs. Every word and
-- every quran_example reused here was already fully taught and FK-
-- verified in Level 1 (Al-Fatiha, Module 8) and Level 2 Batches 1-2
-- (An-Nas, phrases-of-sovereignty). Confirmed by direct query before
-- authoring: word_frequency already has 18/20 ranks' root populated;
-- three genuine root-families already exist among fully-mastered
-- words:
--   'a-l-h (Alif-Lam-Ha): rank 1 (Allah) + rank 15 (Ilah)
--   r-h-m  (Ra-Ha-Mim):   rank 2 (Ar-Rahman) + rank 3 (Ar-Raheem)
--   m-l-k  (Mim-Lam-Kaf): rank 6 (Malik, Al-Fatiha) + rank 14 (Malik, An-Nas)
-- (root letters written in transliteration in this comment only; the
-- migration itself uses the real Arabic root strings already stored
-- in word_frequency.root, extracted programmatically, never hand-
-- typed). Ayah 1:1 alone already contains all three
-- 'a-l-h/r-h-m words together; ayahs 1:4, 114:2, 114:3 supply the
-- m-l-k pair. All four ayahs were already shown as full quran_example
-- sections in prior lessons (Level 1 Module 8, Level 2 Batch 2) --
-- reused here, not newly introduced, per the explicit instruction to
-- prefer already-verified examples over new ones.
--
-- MODULE 1 (arabic-roots-intro, order_index 0): 2 lessons. Lesson 1
-- introduces the root concept via the 'a-l-h pair; Lesson 2 introduces
-- the r-h-m pair and closes with a 2-pair recap matching exercise
-- covering BOTH root families taught so far -- a deliberate
-- idempotency check (re-matching the already-seeded 'a-l-h root must
-- not create a duplicate review item), mirroring the precedent already
-- established by Level 1 Module 5's own recap-lesson test.
--
-- MODULE 2 (word-patterns, order_index 1): 1 lesson. Teaches that the
-- SAME root can take a different 'shape' (pattern) with related-but-
-- distinct meaning, using the m-l-k pair (Malik 'Master/Owner' vs
-- Malik 'Sovereign/King') -- the clearest built-in case, since the two
-- words are visibly different patterns of the identical root, not just
-- different case endings. No morphological classification, no wazn/
-- verb-form naming, no iʿrāb, no Tajweed anywhere in this batch --
-- pattern awareness is taught purely by observation, exactly matching
-- the precedent already established by Level 2's short-phrases module
-- for the 'X of Y' construction (never named grammatically either).
--
-- REVIEW ITEMS: exactly 3 new 'root' items across the whole batch
-- ('a-l-h, r-h-m, m-l-k), each seeded by a matching exercise through
-- the existing, unmodified seedLessonReviewItems pipeline -- item_key
-- = 'root:<root-letters>', front = root letters, back = a short EN/FR
-- gloss. No new code path; only new DATA flowing through the existing
-- generic matching -> review-item mechanism.
--
-- FRENCH GOVERNANCE (resolves the one YELLOW item from the Level 3
-- design doc): rather than coin a French term for "root family" with
-- no existing precedent anywhere in the governed strings, this batch
-- simply never names the concept as a noun phrase at all -- every
-- section describes the relationship in a plain sentence ("these
-- words share the same root") instead of introducing a new label to
-- memorize. "root"/"racine" and "pattern"/"schème" (the only two
-- concept-labels actually used) are both already the roadmap's own
-- canonical terms (levels.title_fr / levels.goal_fr for
-- roots-and-word-patterns).
--
-- CONTENT GOVERNANCE: RED ITEMS: 0. YELLOW ITEMS: 0 (resolved above).
-- Root attribution for all 6 words reused here was already governed
-- and vetted during Level 2 Batch 1/2 authoring -- not re-derived, no
-- new root-correctness risk introduced.

DO $$
DECLARE
  v_level_id uuid;
  v_existing_modules integer;
  v_existing_lessons integer;
  v_root_populated integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'roots-and-word-patterns';
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Expected the roots-and-word-patterns level to already exist. Aborting.';
  END IF;

  SELECT count(*) INTO v_existing_modules FROM public.modules WHERE level_id = v_level_id;
  IF v_existing_modules <> 0 THEN
    RAISE EXCEPTION 'Expected zero existing modules under roots-and-word-patterns, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_lessons FROM public.lessons
  WHERE slug IN ('three-letters-one-meaning', 'more-root-families', 'same-root-different-shape');
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 3 Batch 1 lesson slugs to already exist, found %.', v_existing_lessons;
  END IF;

  SELECT count(*) INTO v_root_populated FROM public.word_frequency
  WHERE frequency_rank IN (1, 2, 3, 6, 14, 15) AND root IS NOT NULL;
  IF v_root_populated <> 6 THEN
    RAISE EXCEPTION 'Expected all 6 target word_frequency rows (ranks 1,2,3,6,14,15) to already have root populated, found %.', v_root_populated;
  END IF;

  IF EXISTS (SELECT 1 FROM public.review_items WHERE item_type = 'root') THEN
    RAISE EXCEPTION 'Expected zero existing root review_items before this migration (this batch is the first use of the type).';
  END IF;
END $$;

-- =========================================================================
-- 1. Modules.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'arabic-roots-intro', 'Understanding Roots', 'Comprendre les racines', 0
FROM public.levels WHERE slug = 'roots-and-word-patterns';

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'word-patterns', 'How Patterns Shape Meaning', 'Comment les schèmes façonnent le sens', 1
FROM public.levels WHERE slug = 'roots-and-word-patterns';
-- =========================================================================
-- 2. Module arabic-roots-intro, Lesson 1: three-letters-one-meaning.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'three-letters-one-meaning', 'Three Letters, One Meaning', 'Trois lettres, un seul sens', 0, 7
FROM public.modules WHERE slug = 'arabic-roots-intro';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Most Arabic words are built from a three-letter root that carries the core meaning. Different words built from the same root are usually related in meaning. You already know two words built from the very same root.',
  'La plupart des mots arabes sont construits à partir d''une racine de trois lettres qui porte le sens central. Des mots différents construits sur la même racine sont généralement liés par le sens. Vous connaissez déjà deux mots construits sur cette même racine.'
FROM public.lessons WHERE slug = 'three-letters-one-meaning'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 1, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'three-letters-one-meaning' AND wf.frequency_rank = 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 2, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '." ' || 'Ilah shares its root with Allah -- the root behind both words carries the idea of divinity, of God.',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ». ' || 'Ilah partage sa racine avec Allah — la racine derrière ces deux mots porte l''idée de divinité, de Dieu.'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'three-letters-one-meaning' AND wf.frequency_rank = 15;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 1, 1,
  'You have read this ayah many times already. Allah appears in it, built from the very root you just learned.',
  'Vous avez déjà lu ce verset de nombreuses fois. Allah y apparaît, construit sur la racine que vous venez d''apprendre.'
FROM public.lessons WHERE slug = 'three-letters-one-meaning';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 4, 'quran_example', 114, 3,
  'Ilah appears here, in an ayah you have also already read -- the same root, in a different verse.',
  'Ilah apparaît ici, dans un verset que vous avez également déjà lu — la même racine, dans un verset différent.'
FROM public.lessons WHERE slug = 'three-letters-one-meaning';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'tip',
  'Same root, related meaning. This is the key idea behind a huge number of Arabic words.',
  'Même racine, sens apparenté. C''est l''idée clé derrière un très grand nombre de mots arabes.'
FROM public.lessons WHERE slug = 'three-letters-one-meaning';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 6, 'summary',
  'You can now recognize when two words you know share the same root.',
  'Vous pouvez maintenant reconnaître quand deux mots que vous connaissez partagent la même racine.'
FROM public.lessons WHERE slug = 'three-letters-one-meaning';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'Allah and Ilah are built from the same three-letter root.',
  'Allah et Ilah sont construits sur la même racine de trois lettres.',
  '{"correctAnswer": true}'::jsonb, 'root'
FROM public.lessons WHERE slug = 'three-letters-one-meaning';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'What do Allah and Ilah have in common?',
  'Qu''ont en commun Allah et Ilah ?',
  '{"choices": ["A shared, meaning-related root", "No relation at all", "They are spelled identically"], "correctIndex": 0}'::jsonb, 'root'
FROM public.lessons WHERE slug = 'three-letters-one-meaning';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, 2, 'matching',
  'Match the root to its core meaning.',
  'Associez la racine à son sens central.',
  jsonb_build_object('pairs', jsonb_build_array(
    jsonb_build_object('left', wf.root, 'right', wf.meaning || ' -- seen in ' || wf.word || ' and the related word Ilah')
  )),
  'root'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'three-letters-one-meaning' AND wf.frequency_rank = 15;
-- =========================================================================
-- 3. Module arabic-roots-intro, Lesson 2: more-root-families.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'more-root-families', 'More Root Families', 'D''autres familles de racines', 1, 7
FROM public.modules WHERE slug = 'arabic-roots-intro';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Here is another root you already know from two words. In fact, both words appear together in the very same ayah you have read many times.',
  'Voici une autre racine que vous connaissez déjà grâce à deux mots. En réalité, ces deux mots apparaissent ensemble dans le même verset que vous avez lu de nombreuses fois.'
FROM public.lessons WHERE slug = 'more-root-families'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 1, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'more-root-families' AND wf.frequency_rank = 2;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 2, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '." ' || 'Ar-Raheem shares its root with Ar-Rahman -- both point to the same core idea: mercy.',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ». ' || 'Ar-Raheem partage sa racine avec Ar-Rahman — tous deux renvoient à la même idée centrale : la miséricorde.'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'more-root-families' AND wf.frequency_rank = 3;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 1, 1,
  'This one ayah alone contains three words built from just two roots: Allah, Ar-Rahman, and Ar-Raheem. Read it again, now noticing the roots.',
  'Ce seul verset contient trois mots construits sur seulement deux racines : Allah, Ar-Rahman et Ar-Raheem. Relisez-le, en remarquant maintenant les racines.'
FROM public.lessons WHERE slug = 'more-root-families';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'Root awareness helps you notice patterns across words you already know, instead of treating every word as a completely separate fact to memorize.',
  'La conscience des racines vous aide à repérer des régularités entre les mots que vous connaissez déjà, plutôt que de traiter chaque mot comme un fait totalement isolé à mémoriser.'
FROM public.lessons WHERE slug = 'more-root-families';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You now recognize two different root families among words you already know.',
  'Vous reconnaissez maintenant deux familles de racines différentes parmi les mots que vous connaissez déjà.'
FROM public.lessons WHERE slug = 'more-root-families';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'Ar-Rahman and Ar-Raheem share the same three-letter root as each other.',
  'Ar-Rahman et Ar-Raheem partagent la même racine de trois lettres.',
  '{"correctAnswer": true}'::jsonb, 'root'
FROM public.lessons WHERE slug = 'more-root-families';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'Which meaning is shared by both Ar-Rahman and Ar-Raheem?',
  'Quel sens est partagé par Ar-Rahman et Ar-Raheem ?',
  '{"choices": ["Mercy", "Sovereignty", "Creation"], "correctIndex": 0}'::jsonb, 'root'
FROM public.lessons WHERE slug = 'more-root-families';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, 2, 'matching',
  'Match each root to its core meaning.',
  'Associez chaque racine à son sens central.',
  jsonb_build_object('pairs', jsonb_build_array(
    jsonb_build_object('left', wf15.root, 'right', wf15.meaning || ' -- seen in ' || wf15.word || ' and the related word Allah'),
    jsonb_build_object('left', wf3.root, 'right', wf3.meaning || ' -- seen in ' || wf3.word || ' and the related word Ar-Rahman')
  )),
  'root'
FROM public.lessons l,
     (SELECT root, meaning, word FROM public.word_frequency WHERE frequency_rank = 15) wf15,
     (SELECT root, meaning, word FROM public.word_frequency WHERE frequency_rank = 3) wf3
WHERE l.slug = 'more-root-families';
-- =========================================================================
-- 4. Module word-patterns, Lesson 1: same-root-different-shape.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'same-root-different-shape', 'Same Root, Different Shape', 'Même racine, forme différente', 0, 7
FROM public.modules WHERE slug = 'word-patterns';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'The same three-letter root can appear in different "shapes," called patterns. Each shape shifts the meaning slightly while staying related to the root''s core idea. You already know two different shapes of the very same root.',
  'Une même racine de trois lettres peut apparaître sous différentes « formes », appelées schèmes. Chaque forme modifie légèrement le sens tout en restant liée à l''idée centrale de la racine. Vous connaissez déjà deux formes différentes de cette même racine.'
FROM public.lessons WHERE slug = 'same-root-different-shape'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 1, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'same-root-different-shape' AND wf.frequency_rank = 6;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 2, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '." ' || 'Malik shares its root with Maalik, but takes a different shape -- and shifts from "the one who owns" to "the one who rules." Related ideas, different emphasis.',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ». ' || 'Malik partage sa racine avec Maalik, mais prend une forme différente — passant de « celui qui possède » à « celui qui règne ». Des idées apparentées, avec un accent différent.'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'same-root-different-shape' AND wf.frequency_rank = 14;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 1, 4,
  'Maalik appears here, in the ayah you already know from Al-Fatiha.',
  'Maalik apparaît ici, dans le verset que vous connaissez déjà d''Al-Fatiha.'
FROM public.lessons WHERE slug = 'same-root-different-shape';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 4, 'quran_example', 114, 2,
  'Malik appears here, the shorter shape of the same root, in an ayah you also already know.',
  'Malik apparaît ici, la forme plus courte de la même racine, dans un verset que vous connaissez également déjà.'
FROM public.lessons WHERE slug = 'same-root-different-shape';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'tip',
  'Same root, different shape, related meaning: the idea of possessing or ruling. Recognizing this helps you make sense of unfamiliar words that share a root you know.',
  'Même racine, forme différente, sens apparenté : l''idée de posséder ou de régner. Reconnaître cela vous aide à comprendre des mots inconnus qui partagent une racine que vous connaissez.'
FROM public.lessons WHERE slug = 'same-root-different-shape';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 6, 'summary',
  'You can now recognize when two words share a root even if they look different, and understand why their meanings stay related.',
  'Vous pouvez maintenant reconnaître quand deux mots partagent une racine même s''ils se ressemblent peu, et comprendre pourquoi leurs sens restent apparentés.'
FROM public.lessons WHERE slug = 'same-root-different-shape';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'Maalik and Malik come from the same three-letter root, even though they look slightly different.',
  'Maalik et Malik viennent de la même racine de trois lettres, même s''ils se ressemblent peu.',
  '{"correctAnswer": true}'::jsonb, 'root'
FROM public.lessons WHERE slug = 'same-root-different-shape';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'Maalik and Malik both relate to which idea?',
  'Maalik et Malik se rapportent tous deux à quelle idée ?',
  '{"choices": ["Possessing or ruling", "Creating", "Showing mercy"], "correctIndex": 0}'::jsonb, 'root'
FROM public.lessons WHERE slug = 'same-root-different-shape';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, 2, 'matching',
  'Match the root to its core meaning.',
  'Associez la racine à son sens central.',
  jsonb_build_object('pairs', jsonb_build_array(
    jsonb_build_object('left', wf.root, 'right', wf.meaning || ' -- seen in ' || wf.word || ' and the related word Maalik')
  )),
  'root'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'same-root-different-shape' AND wf.frequency_rank = 14;
-- =========================================================================
-- 5. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_level_id uuid;
  v_l1_level_id uuid;
  v_l2_level_id uuid;
  v_module_count integer;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_matching_count integer;
  v_l1_lesson_count integer;
  v_l2_lesson_count integer;
  v_wf_count integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'roots-and-word-patterns';

  SELECT count(*) INTO v_module_count FROM public.modules WHERE level_id = v_level_id;
  IF v_module_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 modules under roots-and-word-patterns, found %.', v_module_count;
  END IF;

  SELECT count(*) INTO v_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_level_id;
  IF v_lesson_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 lessons under roots-and-word-patterns, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections s
  JOIN public.lessons l ON l.id = s.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_level_id;
  IF v_section_count <> 20 THEN
    RAISE EXCEPTION 'Expected exactly 20 lesson_sections in Batch 1, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_level_id;
  IF v_exercise_count <> 9 THEN
    RAISE EXCEPTION 'Expected exactly 9 lesson_exercises in Batch 1, found %.', v_exercise_count;
  END IF;

  -- Exactly 3 matching exercises, all review_item_type = 'root'.
  SELECT count(*) INTO v_matching_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_level_id AND e.exercise_type = 'matching';
  IF v_matching_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 matching exercises in Batch 1, found %.', v_matching_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lesson_exercises e
    JOIN public.lessons l ON l.id = e.lesson_id
    JOIN public.modules m ON m.id = l.module_id
    WHERE m.level_id = v_level_id AND e.exercise_type = 'matching' AND e.review_item_type <> 'root'
  ) THEN
    RAISE EXCEPTION 'Expected every Batch 1 matching exercise to have review_item_type = root.';
  END IF;

  -- word_frequency untouched: still exactly 20 rows, no new vocabulary.
  SELECT count(*) INTO v_wf_count FROM public.word_frequency;
  IF v_wf_count <> 20 THEN
    RAISE EXCEPTION 'Expected word_frequency to remain at exactly 20 rows (zero new vocabulary in Level 3 Batch 1), found %.', v_wf_count;
  END IF;

  -- Level 1 and Level 2 completely untouched.
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

  -- order_index sanity, scoped to Level 3.
  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE level_id = v_level_id AND slug = 'arabic-roots-intro' AND order_index = 0
  ) THEN
    RAISE EXCEPTION 'Expected arabic-roots-intro at order_index 0 under Level 3.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE level_id = v_level_id AND slug = 'word-patterns' AND order_index = 1
  ) THEN
    RAISE EXCEPTION 'Expected word-patterns at order_index 1 under Level 3.';
  END IF;

  RAISE NOTICE 'Level 3 Batch 1 migration post-insert assertions passed: % modules, % lessons, % sections, % exercises, % matching (root) exercises.',
    v_module_count, v_lesson_count, v_section_count, v_exercise_count, v_matching_count;
END $$;

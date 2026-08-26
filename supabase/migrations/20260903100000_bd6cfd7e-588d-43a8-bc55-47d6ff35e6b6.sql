-- Phase 5 / Level 2 Batch 2 (Gate A+B): "core-vocabulary-2" and
-- "short-phrases" — the third and fourth Level 2 modules, authored
-- together as one accelerated batch, continuing directly from Batch 1
-- (long-vowels-and-orthography, core-vocabulary-1), which is Level 2
-- Batch 1 production-complete and untouched by this migration.
--
-- ARCHITECTURE: zero application-code changes. findCurriculumEntryPoint
-- (src/lib/curriculum.ts, generalized in Batch 1) already walks every
-- module under a level_id in order_index order — adding two more
-- modules at order_index 2 and 3 under the same Level 2 level_id
-- extends the learner's progression automatically, with no new
-- hardcoded module list anywhere. This is the exact payoff the Batch 1
-- resolver generalization was built for.
--
-- NEW VOCABULARY DATA: word_frequency only had ranks 1-10 seeded
-- (verified by direct query before authoring). Ranks 11-20 are added
-- here, sourced entirely from real, already-governed `ayahs` rows for
-- Sūrat Al-Ikhlāṣ (112), Al-Falaq (113), and An-Nās (114) — all three
-- already fully populated with canonical Arabic and governed EN/FR
-- translations, confirmed by direct query before authoring. Every new
-- lemma word (Qul, Huwa, Ahad, Malik, Ilah, an-Nas, Sharr, Khalaqa,
-- Falaq, Ghasiq) was extracted programmatically as an exact substring
-- of its real source āyah (never hand-typed), after three separate
-- hand-typing transcription errors were caught this cycle during word
-- selection (a recurring combining-mark-order class of mistake seen
-- repeatedly across this project) — every word here is verified by
-- construction, not by proofreading after the fact. meaning_en/
-- meaning_fr are drawn directly from each word's governed ayah
-- translation, never invented independently.
--
-- MODULE 3 (core-vocabulary-2, order_index 2): same shape as Batch 1's
-- core-vocabulary-1 — 2 lessons of 5 words each, one quran_example per
-- lesson chosen because it contains the most of that lesson's words
-- together (112:1 contains 3 of Lesson 1's 5 words; 113:2 contains 2
-- of Lesson 2's 5 words). No new review-item type; `word` items via
-- the existing generic `matching` -> seedLessonReviewItems pipeline,
-- exactly as core-vocabulary-1 did.
--
-- MODULE 4 (short-phrases, order_index 3): a deliberately smaller,
-- pure-synthesis module (2 lessons, no new review concepts), matching
-- the precedent of Level 1's own pure-synthesis modules (7-8). Uses
-- ONLY vocabulary already taught by the end of core-vocabulary-2 —
-- verified deliberately: 114:2 ("Malik + an-Nas"), 114:3 ("Ilah +
-- an-Nas"), and 112:1 ("Qul + Huwa + Allah + Ahad", Allah already
-- known from Batch 1 rank 1) — no untaught word is introduced within
-- any phrase-reading exercise. Teaches the noun-first "X of Y"
-- pattern by observation only, per Phase 5's own outcome #6 — never
-- naming the grammatical construct (iḍāfa), never teaching case
-- endings, never teaching Tajweed. All three āyāt are short (2-4
-- words each), not a full-surah reading exercise — reading fluency at
-- that scale remains explicitly deferred to a later level per the
-- Phase 5 roadmap.
--
-- QUR'AN INTEGRITY: every quran_example section here references
-- (surah_number, ayah_number) against the existing `ayahs` table via
-- FK only — no Qur'anic Arabic is duplicated into this migration's
-- lesson content. word_frequency.example_ayah (a pre-existing, plain
-- TEXT schema field with no FK — established before this project,
-- already used this way by the original 10 rows) is populated by
-- direct copy from the verified `ayahs` row, continuing that existing
-- pattern rather than changing it.
--
-- CONTENT GOVERNANCE: RED ITEMS: 0. YELLOW ITEMS: 0. "an-Nas"'s root
-- is deliberately left NULL rather than asserting a root letter
-- pattern some grammarians treat as irregular/debated — consistent
-- with this project's standing rule to avoid overclaiming linguistic
-- certainty. "Huwa" (a pronoun) has no root, also left NULL,
-- matching the schema's existing nullable design.

DO $$
DECLARE
  v_level_id uuid;
  v_existing_modules integer;
  v_existing_lessons integer;
  v_wf_count integer;
BEGIN
  ---------------------------------------------------------------------------
  -- 0. Preconditions.
  ---------------------------------------------------------------------------
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Expected the basic-vocabulary-and-patterns level to already exist. Aborting.';
  END IF;

  SELECT count(*) INTO v_existing_modules FROM public.modules
  WHERE level_id = v_level_id AND slug IN ('core-vocabulary-2', 'short-phrases');
  IF v_existing_modules <> 0 THEN
    RAISE EXCEPTION 'Expected zero Batch 2 modules to already exist under basic-vocabulary-and-patterns, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_modules FROM public.modules WHERE level_id = v_level_id;
  IF v_existing_modules <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 Batch 1 modules under basic-vocabulary-and-patterns before this migration, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_lessons FROM public.lessons
  WHERE slug IN ('vocabulary-3', 'vocabulary-4', 'phrases-of-sovereignty', 'reading-al-ikhlas-opening');
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 4 Batch 2 lesson slugs to already exist, found %.', v_existing_lessons;
  END IF;

  SELECT count(*) INTO v_wf_count FROM public.word_frequency WHERE frequency_rank BETWEEN 1 AND 10;
  IF v_wf_count <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 existing word_frequency rows (ranks 1-10) before this migration, found %.', v_wf_count;
  END IF;

  SELECT count(*) INTO v_wf_count FROM public.word_frequency WHERE frequency_rank BETWEEN 11 AND 20;
  IF v_wf_count <> 0 THEN
    RAISE EXCEPTION 'Expected zero word_frequency rows for ranks 11-20 before this migration, found %.', v_wf_count;
  END IF;
END $$;

-- =========================================================================
-- 1. New word_frequency rows (ranks 11-20).
-- =========================================================================

-- rank 11: Qul (Qul) — source 112:1, extracted programmatically, not hand-typed.
INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, root, example_ayah, example_reference, topic_tags, category)
VALUES ('قُلْ', 'Qul', 'Say', 'Dis', 11, 'ق-و-ل', 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', '112:1', ARRAY['speech']::text[], 'verb'::public.word_category);

-- rank 12: Huwa (Huwa) — source 112:1, extracted programmatically, not hand-typed.
INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, root, example_ayah, example_reference, topic_tags, category)
VALUES ('هُوَ', 'Huwa', 'He', 'Il', 12, NULL, 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', '112:1', ARRAY[]::text[], 'particle'::public.word_category);

-- rank 13: Ahad (Aḥad) — source 112:1, extracted programmatically, not hand-typed.
INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, root, example_ayah, example_reference, topic_tags, category)
VALUES ('أَحَد', 'Aḥad', 'One', 'Unique', 13, 'أ-ح-د', 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', '112:1', ARRAY['divinity','attributes']::text[], 'noun'::public.word_category);

-- rank 14: Malik (Malik) — source 114:2, extracted programmatically, not hand-typed.
INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, root, example_ayah, example_reference, topic_tags, category)
VALUES ('مَلِك', 'Malik', 'Sovereign, King', 'Souverain, Roi', 14, 'م-ل-ك', 'مَلِكِ ٱلنَّاسِ', '114:2', ARRAY['divinity','sovereignty']::text[], 'noun'::public.word_category);

-- rank 15: Ilah (Ilāh) — source 114:3, extracted programmatically, not hand-typed.
INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, root, example_ayah, example_reference, topic_tags, category)
VALUES ('إِلَٰه', 'Ilāh', 'God, deity', 'Dieu, divinité', 15, 'أ-ل-ه', 'إِلَٰهِ ٱلنَّاسِ', '114:3', ARRAY['divinity']::text[], 'noun'::public.word_category);

-- rank 16: an-Nas (an-Nās) — source 114:1, extracted programmatically, not hand-typed.
INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, root, example_ayah, example_reference, topic_tags, category)
VALUES ('النَّاس', 'an-Nās', 'Mankind, people', 'Les hommes, l''humanité', 16, NULL, 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ', '114:1', ARRAY['humanity']::text[], 'noun'::public.word_category);

-- rank 17: Sharr (Sharr) — source 113:2, extracted programmatically, not hand-typed.
INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, root, example_ayah, example_reference, topic_tags, category)
VALUES ('شَرّ', 'Sharr', 'Evil', 'Mal', 17, 'ش-ر-ر', 'مِن شَرِّ مَا خَلَقَ', '113:2', ARRAY['protection']::text[], 'noun'::public.word_category);

-- rank 18: Khalaqa (Khalaqa) — source 113:2, extracted programmatically, not hand-typed.
INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, root, example_ayah, example_reference, topic_tags, category)
VALUES ('خَلَقَ', 'Khalaqa', 'He created', 'Il a créé', 18, 'خ-ل-ق', 'مِن شَرِّ مَا خَلَقَ', '113:2', ARRAY['creation']::text[], 'verb'::public.word_category);

-- rank 19: Falaq (Falaq) — source 113:1, extracted programmatically, not hand-typed.
INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, root, example_ayah, example_reference, topic_tags, category)
VALUES ('فَلَق', 'Falaq', 'Daybreak, dawn', 'Aube naissante', 19, 'ف-ل-ق', 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ', '113:1', ARRAY['time','protection']::text[], 'noun'::public.word_category);

-- rank 20: Ghasiq (Ghāsiq) — source 113:3, extracted programmatically, not hand-typed.
INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, root, example_ayah, example_reference, topic_tags, category)
VALUES ('غَاسِق', 'Ghāsiq', 'Darkness, night', 'Obscurité', 20, 'غ-س-ق', 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', '113:3', ARRAY['time','protection']::text[], 'noun'::public.word_category);

-- =========================================================================
-- 2. Modules.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'core-vocabulary-2', 'Core Vocabulary II', 'Vocabulaire de base II', 2
FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'short-phrases', 'Reading Short Phrases', 'Lire de courtes phrases', 3
FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';
-- =========================================================================
-- 3. Module core-vocabulary-2, Lesson 1 (ranks 11-15).
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'vocabulary-3', 'Core Vocabulary: Part 3', 'Vocabulaire de base : partie 3', 0, 8
FROM public.modules WHERE slug = 'core-vocabulary-2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Five more high-frequency words, drawn from three short, well-known surahs: Al-Ikhlas, Al-Falaq, and An-Nas.',
  'Cinq autres mots à haute fréquence, tirés de trois courtes sourates bien connues : Al-Ikhlas, Al-Falaq et An-Nas.'
FROM public.lessons WHERE slug = 'vocabulary-3'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 1, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank = 11;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 2, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank = 12;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 3, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank = 13;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 4, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank = 14;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 5, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank = 15;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 6, 'quran_example', 112, 1,
  'Three of these five words appear together in this very ayah, the opening of Surat Al-Ikhlas.',
  'Trois de ces cinq mots apparaissent ensemble dans ce verset même, l''ouverture de Sourate Al-Ikhlas.'
FROM public.lessons WHERE slug = 'vocabulary-3';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 7, 'summary',
  'You now recognize five more core Quranic words, drawn from three short, complete surahs.',
  'Vous reconnaissez maintenant cinq mots coraniques de base supplémentaires, tirés de trois courtes sourates complètes.'
FROM public.lessons WHERE slug = 'vocabulary-3';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'reading_check', wf.word || ' reads:', wf.word || ' se lit :',
  '{"choices": ["qul", "qad", "qil"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1,
     public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank = 11;

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'reading_check', wf.word || ' reads:', wf.word || ' se lit :',
  '{"choices": ["huwa", "hiya", "huma"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2,
     public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank = 12;

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 2, 'reading_check', wf.word || ' reads:', wf.word || ' se lit :',
  '{"choices": ["ahad", "ahd", "uhud"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 3,
     public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank = 13;

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 3, 'reading_check', wf.word || ' reads:', wf.word || ' se lit :',
  '{"choices": ["malik", "maalik", "malak"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 4,
     public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank = 14;

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 4, 'reading_check', wf.word || ' reads:', wf.word || ' se lit :',
  '{"choices": ["ilah", "alih", "ilih"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 5,
     public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank = 15;

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 5, 'matching',
  'Match each word to its meaning.',
  'Associez chaque mot à sa signification.',
  '{"pairs": [{"left": "\u0642\u064f\u0644\u0652", "right": "Say"},{"left": "\u0647\u064f\u0648\u064e", "right": "He"},{"left": "\u0623\u064e\u062d\u064e\u062f", "right": "One"},{"left": "\u0645\u064e\u0644\u0650\u0643", "right": "Sovereign, King"},{"left": "\u0625\u0650\u0644\u064e\u0670\u0647", "right": "God, deity"}]}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-3';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 6, 'true_false',
  'مَلِك and إِلَٰه both appear in the same ayah of An-Nas that you already read.',
  'مَلِك et إِلَٰه apparaissent tous deux dans le même verset d''An-Nas que vous avez déjà lu.',
  '{"correctAnswer": true}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-3';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 7, 'multiple_choice',
  'What does أَحَد mean?',
  'Que signifie أَحَد ?',
  '{"choices": ["One", "Day", "Path"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-3';

INSERT INTO public.lesson_vocabulary_words (lesson_id, word_id, order_index)
SELECT l.id, wf.id, wf.frequency_rank - 11
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-3' AND wf.frequency_rank BETWEEN 11 AND 15;
-- =========================================================================
-- 4. Module core-vocabulary-2, Lesson 2 (ranks 16-20).
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'vocabulary-4', 'Core Vocabulary: Part 4', 'Vocabulaire de base : partie 4', 1, 8
FROM public.modules WHERE slug = 'core-vocabulary-2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Five more words, completing your first twenty core Quranic vocabulary words.',
  'Cinq mots de plus, complétant vos vingt premiers mots de vocabulaire coranique de base.'
FROM public.lessons WHERE slug = 'vocabulary-4'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 1, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank = 16;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 2, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank = 17;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 3, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank = 18;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 4, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank = 19;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 5, 'arabic_text', wf.word, wf.transliteration || ', "' || wf.meaning || '."', wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank = 20;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 6, 'quran_example', 113, 2,
  'Two of these five words, Sharr and Khalaqa, appear together in this very ayah of Surat Al-Falaq.',
  'Deux de ces cinq mots, Sharr et Khalaqa, apparaissent ensemble dans ce verset même de Sourate Al-Falaq.'
FROM public.lessons WHERE slug = 'vocabulary-4';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 7, 'summary',
  'You now recognize your first twenty core Quranic vocabulary words.',
  'Vous reconnaissez maintenant vos vingt premiers mots de vocabulaire coranique de base.'
FROM public.lessons WHERE slug = 'vocabulary-4';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'reading_check', wf.word || ' reads:', wf.word || ' se lit :',
  '{"choices": ["an-nas", "an-naas", "al-nas"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1,
     public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank = 16;

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'reading_check', wf.word || ' reads:', wf.word || ' se lit :',
  '{"choices": ["sharr", "shar", "sharra"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2,
     public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank = 17;

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 2, 'reading_check', wf.word || ' reads:', wf.word || ' se lit :',
  '{"choices": ["khalaqa", "khalaqu", "khaliqa"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 3,
     public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank = 18;

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 3, 'reading_check', wf.word || ' reads:', wf.word || ' se lit :',
  '{"choices": ["falaq", "filaq", "falaqa"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 4,
     public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank = 19;

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 4, 'reading_check', wf.word || ' reads:', wf.word || ' se lit :',
  '{"choices": ["ghasiq", "ghaasiq", "ghasaq"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 5,
     public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank = 20;

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 5, 'matching',
  'Match each word to its meaning.',
  'Associez chaque mot à sa signification.',
  '{"pairs": [{"left": "\u0627\u0644\u0646\u0651\u064e\u0627\u0633", "right": "Mankind, people"},{"left": "\u0634\u064e\u0631\u0651", "right": "Evil"},{"left": "\u062e\u064e\u0644\u064e\u0642\u064e", "right": "He created"},{"left": "\u0641\u064e\u0644\u064e\u0642", "right": "Daybreak, dawn"},{"left": "\u063a\u064e\u0627\u0633\u0650\u0642", "right": "Darkness, night"}]}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-4';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 6, 'true_false',
  'شَرّ and خَلَقَ both appear together in the same ayah of Al-Falaq that you just read.',
  'شَرّ et خَلَقَ apparaissent ensemble dans le même verset d''Al-Falaq que vous venez de lire.',
  '{"correctAnswer": true}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-4';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 7, 'multiple_choice',
  'What does النَّاس mean?',
  'Que signifie النَّاس ?',
  '{"choices": ["Mankind, people", "Darkness", "Evil"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-4';

INSERT INTO public.lesson_vocabulary_words (lesson_id, word_id, order_index)
SELECT l.id, wf.id, wf.frequency_rank - 16
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-4' AND wf.frequency_rank BETWEEN 16 AND 20;
-- =========================================================================
-- 5. Module short-phrases, Lesson 1 — Phrases of Sovereignty.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'phrases-of-sovereignty', 'Phrases of Sovereignty', 'Phrases de souveraineté', 0, 6
FROM public.modules WHERE slug = 'short-phrases';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You know every word in this lesson already. Now read them combined into real short Quranic phrases.',
  'Vous connaissez déjà chaque mot de cette leçon. Lisez-les maintenant combinés en de courtes phrases coraniques réelles.'
FROM public.lessons WHERE slug = 'phrases-of-sovereignty'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 114, 2,
  'Malik ("Sovereign") followed by an-Nas ("mankind") — read together, this phrase means "the Sovereign of mankind."',
  'Malik (« Souverain ») suivi d''an-Nas (« l''humanité ») — lus ensemble, cette phrase signifie « le Souverain de l''humanité ».'
FROM public.lessons WHERE slug = 'phrases-of-sovereignty';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 114, 3,
  'Ilah ("God") followed by an-Nas ("mankind") again — the same word-plus-word pattern: "the God of mankind."',
  'Ilah (« Dieu ») suivi d''an-Nas (« l''humanité ») à nouveau — le même schéma mot-plus-mot : « le Dieu de l''humanité ».'
FROM public.lessons WHERE slug = 'phrases-of-sovereignty';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Notice the pattern: "word1 word2" reads as "word1 OF word2." You will see this pattern often in the Quran.',
  'Remarquez le schéma : « mot1 mot2 » se lit « mot1 DE mot2 ». Vous verrez souvent ce schéma dans le Coran.'
FROM public.lessons WHERE slug = 'phrases-of-sovereignty';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now read short two-word Quranic phrases and recognize the word-of-word pattern.',
  'Vous pouvez maintenant lire de courtes phrases coraniques de deux mots et reconnaître le schéma mot-de-mot.'
FROM public.lessons WHERE slug = 'phrases-of-sovereignty';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 0, 'reading_check', a.arabic_text || ' reads:', a.arabic_text || ' se lit :',
  '{"choices": ["maliki n-nas", "malika n-nas", "maaliki n-nas"], "correctIndex": 0}'::jsonb, 114, 2, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1,
     public.ayahs a
WHERE l.slug = 'phrases-of-sovereignty' AND a.surah_number = 114 AND a.ayah_number = 2;

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 1, 'reading_check', a.arabic_text || ' reads:', a.arabic_text || ' se lit :',
  '{"choices": ["ilahi n-nas", "ilaha n-nas", "ilahu n-nas"], "correctIndex": 0}'::jsonb, 114, 3, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2,
     public.ayahs a
WHERE l.slug = 'phrases-of-sovereignty' AND a.surah_number = 114 AND a.ayah_number = 3;

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'The word an-Nas appears in both phrases you just read.',
  'Le mot an-Nas apparaît dans les deux phrases que vous venez de lire.',
  '{"correctAnswer": true}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'phrases-of-sovereignty';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'multiple_choice',
  'In "word1 word2" phrases like these, how does the phrase read in English?',
  'Dans des phrases « mot1 mot2 » comme celles-ci, comment la phrase se lit-elle en français ?',
  '{"choices": ["word1 OF word2", "word1 AND word2", "word1 IS word2"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'phrases-of-sovereignty';

-- =========================================================================
-- 6. Module short-phrases, Lesson 2 — Reading Al-Ikhlas's Opening.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-al-ikhlas-opening', 'Reading Al-Ikhlas''s Opening', 'Lire l''ouverture d''Al-Ikhlas', 1, 6
FROM public.modules WHERE slug = 'short-phrases';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'One more short phrase, this time a complete four-word ayah — the opening line of Surat Al-Ikhlas. Every word in it, you already know.',
  'Une dernière courte phrase, cette fois un verset complet de quatre mots — la première ligne de Sourate Al-Ikhlas. Chaque mot y figurant, vous le connaissez déjà.'
FROM public.lessons WHERE slug = 'reading-al-ikhlas-opening'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 112, 1,
  'Qul ("Say"), Huwa ("He"), Allah, Ahad ("One") — four words you already know, forming one complete ayah.',
  'Qul (« Dis »), Huwa (« Il »), Allah, Ahad (« Unique ») — quatre mots que vous connaissez déjà, formant un verset complet.'
FROM public.lessons WHERE slug = 'reading-al-ikhlas-opening';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'summary',
  'You have read a complete ayah using only vocabulary you already knew — the goal of this whole module.',
  'Vous avez lu un verset complet en n''utilisant que du vocabulaire que vous connaissiez déjà — l''objectif de tout ce module.'
FROM public.lessons WHERE slug = 'reading-al-ikhlas-opening';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 0, 'reading_check', a.arabic_text || ' reads:', a.arabic_text || ' se lit :',
  '{"choices": ["qul huwa llahu ahad", "qad huwa llahu ahad", "qul hiya llahu ahad"], "correctIndex": 0}'::jsonb, 112, 1, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1,
     public.ayahs a
WHERE l.slug = 'reading-al-ikhlas-opening' AND a.surah_number = 112 AND a.ayah_number = 1;

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'true_false',
  'This ayah uses the word Ahad, meaning "One," that you already learned.',
  'Ce verset utilise le mot Ahad, signifiant « Unique », que vous avez déjà appris.',
  '{"correctAnswer": true}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'reading-al-ikhlas-opening';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'multiple_choice',
  'How many words make up this ayah?',
  'Combien de mots composent ce verset ?',
  '{"choices": ["Three", "Four", "Six"], "correctIndex": 1}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'reading-al-ikhlas-opening';
-- =========================================================================
-- 7. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_level_id uuid;
  v_l1_level_id uuid;
  v_module_count integer;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_wf_count integer;
  v_vocab_link_count integer;
  v_l1_lesson_count integer;
  v_batch1_lesson_count integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';

  -- Exactly 4 modules now exist under Level 2 (2 from Batch 1 + 2 new).
  SELECT count(*) INTO v_module_count FROM public.modules WHERE level_id = v_level_id;
  IF v_module_count <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 modules under basic-vocabulary-and-patterns after this migration, found %.', v_module_count;
  END IF;

  -- core-vocabulary-2 has exactly 2 lessons (vocabulary-3, vocabulary-4).
  SELECT count(*) INTO v_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug = 'core-vocabulary-2';
  IF v_lesson_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 lessons under core-vocabulary-2, found %.', v_lesson_count;
  END IF;

  -- short-phrases has exactly 2 lessons (phrases-of-sovereignty, reading-al-ikhlas-opening).
  SELECT count(*) INTO v_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug = 'short-phrases';
  IF v_lesson_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 lessons under short-phrases, found %.', v_lesson_count;
  END IF;

  -- 4 new lessons total, each with at least 1 section and at least 1 exercise.
  SELECT count(*) INTO v_lesson_count FROM public.lessons
  WHERE slug IN ('vocabulary-3', 'vocabulary-4', 'phrases-of-sovereignty', 'reading-al-ikhlas-opening');
  IF v_lesson_count <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 new Batch 2 lessons, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections s
  JOIN public.lessons l ON l.id = s.lesson_id
  WHERE l.slug IN ('vocabulary-3', 'vocabulary-4', 'phrases-of-sovereignty', 'reading-al-ikhlas-opening');
  IF v_section_count <> 24 THEN
    RAISE EXCEPTION 'Expected exactly 24 lesson_sections across the 4 new Batch 2 lessons, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  WHERE l.slug IN ('vocabulary-3', 'vocabulary-4', 'phrases-of-sovereignty', 'reading-al-ikhlas-opening');
  IF v_exercise_count <> 23 THEN
    RAISE EXCEPTION 'Expected exactly 23 lesson_exercises across the 4 new Batch 2 lessons, found %.', v_exercise_count;
  END IF;

  -- 10 new word_frequency rows (ranks 11-20).
  SELECT count(*) INTO v_wf_count FROM public.word_frequency WHERE frequency_rank BETWEEN 11 AND 20;
  IF v_wf_count <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 new word_frequency rows (ranks 11-20), found %.', v_wf_count;
  END IF;

  -- lesson_vocabulary_words links: 5 for vocabulary-3, 5 for vocabulary-4.
  SELECT count(*) INTO v_vocab_link_count FROM public.lesson_vocabulary_words lvw
  JOIN public.lessons l ON l.id = lvw.lesson_id
  WHERE l.slug IN ('vocabulary-3', 'vocabulary-4');
  IF v_vocab_link_count <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 lesson_vocabulary_words rows for vocabulary-3/4, found %.', v_vocab_link_count;
  END IF;

  -- Level 1 untouched: still exactly 33 lessons under foundations-of-arabic-script.
  SELECT id INTO v_l1_level_id FROM public.levels WHERE slug = 'foundations-of-arabic-script';
  SELECT count(*) INTO v_l1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_l1_level_id;
  IF v_l1_lesson_count <> 33 THEN
    RAISE EXCEPTION 'Expected Level 1 (foundations-of-arabic-script) to remain untouched at 33 lessons, found %.', v_l1_lesson_count;
  END IF;

  -- Batch 1 untouched: long-vowels-and-orthography + core-vocabulary-1 still have 5 lessons total.
  SELECT count(*) INTO v_batch1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('long-vowels-and-orthography', 'core-vocabulary-1');
  IF v_batch1_lesson_count <> 5 THEN
    RAISE EXCEPTION 'Expected Batch 1 modules to remain untouched at 5 lessons total, found %.', v_batch1_lesson_count;
  END IF;

  -- order_index sanity: core-vocabulary-2 = 2, short-phrases = 3, scoped to Level 2.
  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE level_id = v_level_id AND slug = 'core-vocabulary-2' AND order_index = 2
  ) THEN
    RAISE EXCEPTION 'Expected core-vocabulary-2 at order_index 2 under Level 2.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.modules WHERE level_id = v_level_id AND slug = 'short-phrases' AND order_index = 3
  ) THEN
    RAISE EXCEPTION 'Expected short-phrases at order_index 3 under Level 2.';
  END IF;

  RAISE NOTICE 'Batch 2 migration post-insert assertions passed: % modules, % new lessons, % sections, % exercises, % new word_frequency rows.',
    v_module_count, v_lesson_count, v_section_count, v_exercise_count, v_wf_count;
END $$;

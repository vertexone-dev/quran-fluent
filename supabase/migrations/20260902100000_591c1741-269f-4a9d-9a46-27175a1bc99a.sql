-- Phase 5 / Level 2 Batch 1 (Gate A+B): "basic-vocabulary-and-patterns" —
-- the first two Level 2 modules, authored together as one accelerated
-- batch per the approved Phase 5 architecture. Level 1 (8/8 modules) is
-- production-complete and untouched by this migration.
--
-- ROADMAP CONTEXT: the `levels` row for Level 2 ("Basic Vocabulary &
-- Sentence Patterns") already existed before this migration — queried
-- directly, not invented. Its goal_en/goal_fr ("Build a core Qur'anic
-- vocabulary and recognize simple sentence patterns") is the authoritative
-- theme; this batch does not invent a different one.
--
-- MODULE 1 — long-vowels-and-orthography (order_index 0 within Level 2):
-- a deliberate BRIDGE module, not vocabulary content itself. Al-Fatiha
-- (Module 8, Level 1) already exposed learners to the dagger alif and
-- hamzat al-waṣl throughout its 7 āyahs without ever naming or explaining
-- them (a documented, deliberate Level 1 boundary). Real vocabulary words
-- in this batch cannot be honestly taught while these marks remain
-- unexplained, so this module teaches exactly three reading/orthographic
-- facts, and nothing more:
--   1. ا/و/ي can function as long-vowel carriers, not just consonants
--   2. the dagger alif (ٰ) is an unwritten long vowel
--   3. the hamzat al-waṣl (ٱ) is a connecting hamza, silent when connected
-- TAJWEED BOUNDARY (explicit, per Phase 5 Task B/C): this module never
-- teaches madd duration/counts, sun-letter assimilation, nasalization, or
-- any recitation rule. Every fact taught here is orthographic/decoding
-- only — the same boundary every Level 1 module already held.
--
-- RENDERING FINDING THIS CYCLE (changed this module's design): a fresh
-- Playwright screenshot spike testing the dagger alif and hamzat al-waṣl
-- in ISOLATION (1-2 characters alone, as a "look at this mark" callout)
-- found BROKEN rendering — the combining mark detaches from its base
-- letter and floats in the wrong position, even in the styled
-- (font-quran/dir=rtl/lang=ar) path, at both desktop and 390x844 mobile
-- sizes. This is a genuinely new finding: Module 8's spike only tested
-- these marks EMBEDDED WITHIN real, complete words, which render
-- correctly (confirmed again this cycle). Consequently, every mark taught
-- in this module is shown only within a real, complete word — never
-- isolated — matching exactly how Level 1 already taught harakat/sukūn/
-- shadda (always within a real word, never a naked floating symbol).
--
-- WORD/AYAH SELECTION — every example verified before authoring:
--   Lesson 1 (long-vowel carriers): الرَّحِيم (word_frequency rank 3 — ي as
--     long "ii" after kasra) and مَالِك (rank 6 — ا as long "aa" after
--     fatha). No quran_example needed: regular long vowels are written
--     identically in vocabulary-lemma form and in the Qur'an, so there is
--     no "written differently" contrast to show yet.
--   Lesson 2 (dagger alif): عَالَمِين (rank 5, written here with a plain
--     alef) contrasted with the SAME word as it actually appears in
--     Sūrat Al-Fātiḥa āyah 2 (ٱلْعَٰلَمِينَ, dagger alif instead) — verified
--     character-by-character against the live `ayahs` row before writing
--     this comment: alef-wasla, lam, ain+fatha, lam+fatha, meem+kasra,
--     dagger-alif, ya... i.e. the dagger alif genuinely replaces the
--     plain alef seen in the lemma form. Referenced by FK only.
--   Lesson 3 (hamzat al-waṣl): الرَّحْمَٰن (rank 2, bare lemma form, plain
--     alef) contrasted with the same word inside āyah 1 (already fully
--     read in Module 8, Lesson 1) — ٱلرَّحْمَٰنِ, hamzat al-waṣl instead of a
--     plain alef. Referenced by FK only.
-- No Qur'anic Arabic is duplicated anywhere in this migration — every
-- quran_example section references (surah_number, ayah_number) against
-- the existing `ayahs` table via FK; every vocabulary word comes from the
-- existing, already-governed `word_frequency` table, never hand-typed
-- Qur'anic text.
--
-- MODULE 2 — core-vocabulary-1 (order_index 1): teaches word_frequency
-- rank 1-10, the only rows currently seeded. Meanings are the existing
-- governed meaning/meaning_fr fields — none invented. Rank 8 (دِّين) is
-- stored in word_frequency WITHOUT its "ال" prefix — a bare word-initial
-- shadda (sun-letter assimilation residue) that cannot be honestly
-- "sounded out from scratch" without invoking assimilation, which is
-- Tajweed-adjacent and out of scope here. Rank 8 is therefore used ONLY
-- in the word-meaning matching exercise (recall, not phonetic
-- reading-from-scratch) and never as a reading_check target — the same
-- kind of content-quality judgment call documented throughout this
-- project's migrations rather than silently using flawed data. Every
-- other rank-1-10 word reads cleanly in isolation and is used for both.
-- Each lesson also includes one quran_example section (āyahs 1:1 and 1:4
-- respectively — chosen because each contains three of that lesson's
-- five words together) fulfilling the FK-based "vocabulary in context"
-- design without duplicating any Qur'anic text.
--
-- REVIEW STRATEGY: Module 1 creates 3 new `concept` review items (one per
-- new orthographic fact — genuinely new, durable, flashcard-worthy facts,
-- unlike Module 7/8's pure-synthesis lessons). Module 2 creates up to 10
-- new `word` review items (one per vocabulary word) via `matching`
-- exercises — no new review_item_type; both 'concept' and 'word' already
-- existed and are used exactly as designed in Phase 5 Task I.
-- `lesson_vocabulary_words` (existing, previously-unused bridge table) is
-- populated for every taught word, per its own migration comment's
-- stated purpose — display continues to use lesson_sections/arabic_text
-- exactly as Level 1 did; this bridge is forward-compatible data, not a
-- new rendering path.
--
-- EXERCISE TYPES: reading_check, true_false, matching, multiple_choice —
-- all pre-existing, no new type.
--
-- CONTENT GOVERNANCE: RED ITEMS: 0. YELLOW ITEMS: 0 (the rank-8 data
-- quirk above was resolved via a documented design choice, not left as
-- an open question). French dagger-alif terminology resolved as "alif
-- suscrit" per Phase 5 approval.

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

  SELECT count(*) INTO v_existing_modules FROM public.modules WHERE level_id = v_level_id;
  IF v_existing_modules <> 0 THEN
    RAISE EXCEPTION 'Expected zero modules under basic-vocabulary-and-patterns before this migration, found %.', v_existing_modules;
  END IF;

  SELECT count(*) INTO v_existing_lessons FROM public.lessons
  WHERE slug IN ('long-vowel-carriers', 'dagger-alif', 'hamzat-al-wasl', 'vocabulary-1', 'vocabulary-2');
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 5 Batch 1 lesson slugs to already exist, found %.', v_existing_lessons;
  END IF;

  SELECT count(*) INTO v_wf_count FROM public.word_frequency WHERE frequency_rank BETWEEN 1 AND 10;
  IF v_wf_count <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 word_frequency rows for ranks 1-10, found %.', v_wf_count;
  END IF;
END $$;

-- =========================================================================
-- 1. Modules.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'long-vowels-and-orthography', 'Long Vowels & Qur''anic Spelling', 'Voyelles longues et orthographe coranique', 0
FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'core-vocabulary-1', 'Core Vocabulary I', 'Vocabulaire de base I', 1
FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';

-- =========================================================================
-- 2. Module 1, Lesson 1 — Long-Vowel Carriers.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'long-vowel-carriers', 'Long-Vowel Carriers', 'Porteurs de voyelle longue', 0, 6
FROM public.modules WHERE slug = 'long-vowels-and-orthography';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You''ve completed Level 1 — every letter, every mark, and a full reading of Al-Fatiha. Before learning new words, one more reading skill: the letters ا, و, and ي don''t always sound like themselves. Sometimes they stretch a vowel into a long sound instead.',
  'Vous avez terminé le Niveau 1 — chaque lettre, chaque signe, et une lecture complète d''Al-Fatiha. Avant d''apprendre de nouveaux mots, une dernière compétence de lecture : les lettres ا, و et ي ne se prononcent pas toujours comme des consonnes. Parfois, elles allongent une voyelle.'
FROM public.lessons WHERE slug = 'long-vowel-carriers'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'الرَّحِيم',
  'Ar-Raḥīm, "The Most Merciful." After the Ḥā'' with a kasra, the Yā'' isn''t a consonant here — it stretches the kasra into a long "ii" sound: ar-ra-ḤEEM, not ar-ra-ḤI-ya-m.',
  'Ar-Raḥīm, « Le Très Miséricordieux ». Après le Ḥā'' avec une kasra, le Yā'' n''est pas une consonne ici — il allonge la kasra en un long son « ii » : ar-ra-ḤIIM, et non ar-ra-ḤI-ya-m.'
FROM public.lessons WHERE slug = 'long-vowel-carriers';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'مَالِك',
  'Mālik, "Master, Owner." After the Mīm with a fatḥa, the Alif isn''t sounded separately — it stretches the fatḥa into a long "aa" sound: MAA-lik, not ma-A-lik.',
  'Mālik, « Maître, Souverain ». Après le Mīm avec une fatḥa, l''Alif ne se prononce pas séparément — il allonge la fatḥa en un long son « aa » : MAA-lik, et non ma-A-lik.'
FROM public.lessons WHERE slug = 'long-vowel-carriers';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'A quick test: if ا, و, or ي has no vowel mark of its own and simply follows the matching short vowel (fatḥa before ا, ḍamma before و, kasra before ي), it''s a long-vowel carrier, not a separate consonant sound.',
  'Un test rapide : si ا, و ou ي n''a pas de signe de voyelle propre et suit simplement la voyelle courte correspondante (fatḥa avant ا, ḍamma avant و, kasra avant ي), c''est un porteur de voyelle longue, pas une consonne séparée.'
FROM public.lessons WHERE slug = 'long-vowel-carriers';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now recognize when ا, و, or ي is stretching a vowel instead of acting as its own consonant.',
  'Vous savez maintenant reconnaître quand ا, و ou ي allonge une voyelle plutôt que d''agir comme sa propre consonne.'
FROM public.lessons WHERE slug = 'long-vowel-carriers';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'reading_check',
  'الرَّحِيم reads:', 'الرَّحِيم se lit :',
  '{"choices": ["ar-raheem", "ar-raham", "ar-rahim"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'long-vowel-carriers';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'reading_check',
  'مَالِك reads:', 'مَالِك se lit :',
  '{"choices": ["maalik", "malik", "muwaalik"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'long-vowel-carriers';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'In الرَّحِيم, the ي makes a long "ee" sound rather than being pronounced as its own consonant.',
  'Dans الرَّحِيم, le ي produit un long son « ii » plutôt que d''être prononcé comme sa propre consonne.',
  '{"correctAnswer": true}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'long-vowel-carriers';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'matching',
  'Match each idea to what it means.',
  'Associez chaque idée à sa signification.',
  '{"pairs": [{"left": "long-vowel-carriers", "right": "ا, و, or ي stretching a matching short vowel into a long sound, instead of being a separate consonant"}]}'::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'long-vowel-carriers';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'multiple_choice',
  'Which letters can act as long-vowel carriers?',
  'Quelles lettres peuvent agir comme porteurs de voyelle longue ?',
  '{"choices": ["ا و ي", "ب ت ث", "ك ل م"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'long-vowel-carriers';

-- =========================================================================
-- 3. Module 1, Lesson 2 — The Dagger Alif.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'dagger-alif', 'The Dagger Alif', 'L''alif suscrit', 1, 6
FROM public.modules WHERE slug = 'long-vowels-and-orthography';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You already read a small diagonal mark throughout Al-Fatiha without it ever being named. It''s called a dagger alif — a real long "aa" vowel that isn''t written with a full alif letter.',
  'Vous avez déjà lu une petite marque diagonale tout au long d''Al-Fatiha sans qu''elle soit jamais nommée. On l''appelle un alif suscrit — une vraie voyelle longue « aa » qui n''est pas écrite avec une lettre alif complète.'
FROM public.lessons WHERE slug = 'dagger-alif'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'عَالَمِين',
  '''Ālamīn, "worlds, all creation." Written here with a full alif for its long "aa" sound.',
  '''Ālamīn, « mondes, toute la création ». Écrit ici avec un alif complet pour son long son « aa ».'
FROM public.lessons WHERE slug = 'dagger-alif';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 1, 2,
  'You already read this exact word in Al-Fatiha, āyah 2. Look closely: the same long "aa" sound is written with a small dagger alif (ٰ) above the letter instead of a full alif. Same word, same sound — a different way of writing that sound in the Qur''anic text.',
  'Vous avez déjà lu ce mot exact dans Al-Fatiha, verset 2. Regardez de près : le même long son « aa » est écrit avec un petit alif suscrit (ٰ) au-dessus de la lettre plutôt qu''avec un alif complet. Même mot, même son — une autre façon d''écrire ce son dans le texte coranique.'
FROM public.lessons WHERE slug = 'dagger-alif';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'A dagger alif looks like a tiny vertical stroke sitting above a letter. Read it exactly like a full alif long vowel — the difference is only in how it''s written, not how it sounds.',
  'Un alif suscrit ressemble à un petit trait vertical au-dessus d''une lettre. Lisez-le exactement comme un alif complet de voyelle longue — la différence est seulement dans la façon dont il est écrit, pas dans sa prononciation.'
FROM public.lessons WHERE slug = 'dagger-alif';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now recognize a dagger alif and read it as the long "aa" vowel it represents.',
  'Vous savez maintenant reconnaître un alif suscrit et le lire comme la voyelle longue « aa » qu''il représente.'
FROM public.lessons WHERE slug = 'dagger-alif';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'reading_check',
  'عَالَمِين reads:', 'عَالَمِين se lit :',
  '{"choices": ["aalamiin", "alamiin", "aalamaan"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'dagger-alif';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'true_false',
  'A dagger alif changes a word''s meaning — it makes it a totally different word.',
  'Un alif suscrit change le sens d''un mot — il en fait un mot totalement différent.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'dagger-alif';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each idea to what it means.',
  'Associez chaque idée à sa signification.',
  '{"pairs": [{"left": "dagger-alif", "right": "a small mark above a letter representing an unwritten long \"aa\" vowel"}]}'::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'dagger-alif';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'multiple_choice',
  'What does a dagger alif represent?',
  'Que représente un alif suscrit ?',
  '{"choices": ["An unwritten long \"aa\" vowel", "A doubled consonant", "No sound at all"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'dagger-alif';

-- =========================================================================
-- 4. Module 1, Lesson 3 — Hamzat al-Waṣl.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'hamzat-al-wasl', 'Hamzat al-Waṣl', 'La hamza de liaison', 2, 6
FROM public.modules WHERE slug = 'long-vowels-and-orthography';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'One more mark you''ve already seen throughout Al-Fatiha without it being named: a small curved hamza sitting on top of some alifs. It''s called hamzat al-waṣl — a "connecting hamza."',
  'Encore un signe que vous avez déjà vu tout au long d''Al-Fatiha sans qu''il soit nommé : une petite hamza courbée au-dessus de certains alifs. On l''appelle hamzat al-waṣl — une « hamza de liaison ».'
FROM public.lessons WHERE slug = 'hamzat-al-wasl'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'الرَّحْمَٰن',
  'Ar-Raḥmān, "The Most Gracious." On its own, written here with a plain alif and fatḥa.',
  'Ar-Raḥmān, « Le Tout Miséricordieux ». Seul, écrit ici avec un alif simple et une fatḥa.'
FROM public.lessons WHERE slug = 'hamzat-al-wasl';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 1, 1,
  'You already read this exact word inside this āyah, in the very first lesson of the Al-Fatiha module. Notice the small curved hamza (ٱ) at the start instead of a plain alif — that''s a hamzat al-waṣl. It only makes its own hamza sound when the word starts a sentence on its own; connected to the word before it, as here, its sound just carries over and the mark stays silent.',
  'Vous avez déjà lu ce mot exact dans ce verset, dès la première leçon du module Al-Fatiha. Remarquez la petite hamza courbée (ٱ) au début plutôt qu''un alif simple — c''est une hamza de liaison. Elle ne produit son propre son de hamza que lorsque le mot commence une phrase seul ; liée au mot précédent, comme ici, son son se poursuit simplement et le signe reste silencieux.'
FROM public.lessons WHERE slug = 'hamzat-al-wasl';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'You''ve already been reading hamzat al-waṣl correctly throughout Al-Fatiha without needing to name it — every ٱ you read there simply carried the previous word''s sound forward.',
  'Vous avez déjà lu correctement la hamza de liaison tout au long d''Al-Fatiha sans avoir besoin de la nommer — chaque ٱ que vous y avez lu a simplement prolongé le son du mot précédent.'
FROM public.lessons WHERE slug = 'hamzat-al-wasl';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now recognize a hamzat al-waṣl and read it correctly, whether a word starts alone or is connected to what comes before it.',
  'Vous savez maintenant reconnaître une hamza de liaison et la lire correctement, que le mot commence seul ou soit lié à ce qui précède.'
FROM public.lessons WHERE slug = 'hamzat-al-wasl';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'reading_check',
  'الرَّحْمَٰن reads:', 'الرَّحْمَٰن se lit :',
  '{"choices": ["ar-rahman", "ar-raheem", "ar-rahim"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'hamzat-al-wasl';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'true_false',
  'A hamzat al-waṣl always makes its own hamza sound, no matter where the word appears.',
  'Une hamza de liaison produit toujours son propre son de hamza, peu importe où le mot apparaît.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'hamzat-al-wasl';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each idea to what it means.',
  'Associez chaque idée à sa signification.',
  '{"pairs": [{"left": "hamzat-al-wasl", "right": "a connecting hamza, silent when the word is connected to what comes before it"}]}'::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'hamzat-al-wasl';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'multiple_choice',
  'When is a hamzat al-waṣl''s own hamza sound actually pronounced?',
  'Quand le propre son de hamza d''une hamza de liaison est-il réellement prononcé ?',
  '{"choices": ["Only when the word starts a sentence on its own", "Every single time", "Never"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'hamzat-al-wasl';

-- =========================================================================
-- 5. Module 2, Lesson 1 — Core Vocabulary (ranks 1-5).
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'vocabulary-1', 'Core Vocabulary: Part 1', 'Vocabulaire de base : partie 1', 0, 8
FROM public.modules WHERE slug = 'core-vocabulary-1';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Now that you can read every mark, it''s time to build real Qur''anic vocabulary. These five words are among the most common in the entire Qur''an — you''ll recognize all of them from Al-Fatiha.',
  'Maintenant que vous pouvez lire tous les signes, il est temps de construire un vrai vocabulaire coranique. Ces cinq mots sont parmi les plus fréquents de tout le Coran — vous les reconnaîtrez tous d''Al-Fatiha.'
FROM public.lessons WHERE slug = 'vocabulary-1'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 1, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '."',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-1' AND wf.frequency_rank = 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 2, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '."',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-1' AND wf.frequency_rank = 2;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 3, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '."',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-1' AND wf.frequency_rank = 3;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 4, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '."',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-1' AND wf.frequency_rank = 4;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 5, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '."',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-1' AND wf.frequency_rank = 5;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 6, 'quran_example', 1, 1,
  'Three of these five words appear together in this very āyah, which you already read in full in the Al-Fatiha module.',
  'Trois de ces cinq mots apparaissent ensemble dans ce verset même, que vous avez déjà lu en entier dans le module Al-Fatiha.'
FROM public.lessons WHERE slug = 'vocabulary-1';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 7, 'summary',
  'You can now recognize and recall five of the most common words in the Qur''an.',
  'Vous savez maintenant reconnaître et rappeler cinq des mots les plus fréquents du Coran.'
FROM public.lessons WHERE slug = 'vocabulary-1';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'reading_check', 'اللَّه reads:', 'اللَّه se lit :',
  '{"choices": ["allah", "allahu", "allahi"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'vocabulary-1';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'reading_check', 'الرَّحْمَٰن reads:', 'الرَّحْمَٰن se lit :',
  '{"choices": ["ar-rahman", "ar-raheem", "ar-rahim"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'vocabulary-1';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 2, 'reading_check', 'الرَّحِيم reads:', 'الرَّحِيم se lit :',
  '{"choices": ["ar-raheem", "ar-rahman", "ar-rahim"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 3
WHERE l.slug = 'vocabulary-1';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 3, 'reading_check', 'رَبّ reads:', 'رَبّ se lit :',
  '{"choices": ["rabb", "rab", "rabbi"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 4
WHERE l.slug = 'vocabulary-1';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 4, 'reading_check', 'عَالَمِين reads:', 'عَالَمِين se lit :',
  '{"choices": ["aalamiin", "alamiin", "aalamaan"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 5
WHERE l.slug = 'vocabulary-1';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 5, 'matching',
  'Match each word to its meaning.',
  'Associez chaque mot à sa signification.',
  '{"pairs": [
    {"left": "اللَّه", "right": "Allah"},
    {"left": "الرَّحْمَٰن", "right": "The Most Gracious"},
    {"left": "الرَّحِيم", "right": "The Most Merciful"},
    {"left": "رَبّ", "right": "Lord and Sustainer"},
    {"left": "عَالَمِين", "right": "Worlds, all creation"}
  ]}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-1';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 6, 'true_false',
  'الرَّحْمَٰن and الرَّحِيم share the same three-letter root.',
  'الرَّحْمَٰن et الرَّحِيم partagent la même racine de trois lettres.',
  '{"correctAnswer": true}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-1';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 7, 'multiple_choice',
  'What does رَبّ mean?',
  'Que signifie رَبّ ?',
  '{"choices": ["Lord and Sustainer", "Day", "Path"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-1';

INSERT INTO public.lesson_vocabulary_words (lesson_id, word_id, order_index)
SELECT l.id, wf.id, wf.frequency_rank - 1
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-1' AND wf.frequency_rank BETWEEN 1 AND 5;

-- =========================================================================
-- 6. Module 2, Lesson 2 — Core Vocabulary (ranks 6-10).
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'vocabulary-2', 'Core Vocabulary: Part 2', 'Vocabulaire de base : partie 2', 1, 8
FROM public.modules WHERE slug = 'core-vocabulary-1';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Five more high-frequency words, continuing straight from Al-Fatiha''s own vocabulary.',
  'Cinq autres mots à haute fréquence, dans la continuité directe du vocabulaire d''Al-Fatiha.'
FROM public.lessons WHERE slug = 'vocabulary-2'
LIMIT 1;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 1, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '."',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-2' AND wf.frequency_rank = 6;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 2, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '."',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-2' AND wf.frequency_rank = 7;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 3, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '." This entry is stored without its leading "al-" article — you already read the full connected form (الدِّينِ, "ad-dīn") in the Al-Fatiha module.',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ». Cette entrée est stockée sans son article initial « al- » — vous avez déjà lu la forme liée complète (الدِّينِ, « ad-dīn ») dans le module Al-Fatiha.'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-2' AND wf.frequency_rank = 8;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 4, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '."',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-2' AND wf.frequency_rank = 9;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT l.id, 5, 'arabic_text', wf.word,
  wf.transliteration || ', "' || wf.meaning || '."',
  wf.transliteration || ', « ' || wf.meaning_fr || ' ».'
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-2' AND wf.frequency_rank = 10;

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 6, 'quran_example', 1, 4,
  'Three of these five words appear together in this very āyah, which you already read in the Al-Fatiha module.',
  'Trois de ces cinq mots apparaissent ensemble dans ce verset même, que vous avez déjà lu dans le module Al-Fatiha.'
FROM public.lessons WHERE slug = 'vocabulary-2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 7, 'summary',
  'You now recognize ten of the Qur''an''s most common words — half of Level 2''s core vocabulary target.',
  'Vous reconnaissez maintenant dix des mots les plus fréquents du Coran — la moitié de l''objectif de vocabulaire de base du Niveau 2.'
FROM public.lessons WHERE slug = 'vocabulary-2';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'reading_check', 'مَالِك reads:', 'مَالِك se lit :',
  '{"choices": ["maalik", "malik", "muwaalik"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'vocabulary-2';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'reading_check', 'يَوْم reads:', 'يَوْم se lit :',
  '{"choices": ["yawm", "yaam", "yuwm"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'vocabulary-2';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 2, 'reading_check', 'صِرَاط reads:', 'صِرَاط se lit :',
  '{"choices": ["siraat", "sarat", "suraat"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 4
WHERE l.slug = 'vocabulary-2';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 3, 'reading_check', 'مُسْتَقِيم reads:', 'مُسْتَقِيم se lit :',
  '{"choices": ["mustaqiim", "mustaqim", "mustaqaam"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 5
WHERE l.slug = 'vocabulary-2';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 4, 'matching',
  'Match each word to its meaning.',
  'Associez chaque mot à sa signification.',
  '{"pairs": [
    {"left": "مَالِك", "right": "Master, Owner"},
    {"left": "يَوْم", "right": "Day"},
    {"left": "دِّين", "right": "Judgment, recompense"},
    {"left": "صِرَاط", "right": "Path, way"},
    {"left": "مُسْتَقِيم", "right": "Straight, upright"}
  ]}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-2';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 5, 'true_false',
  'دِّين and يَوْم both appear together in the same āyah of Al-Fatiha that you already read.',
  'دِّين et يَوْم apparaissent tous deux dans le même verset d''Al-Fatiha que vous avez déjà lu.',
  '{"correctAnswer": true}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-2';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 6, 'multiple_choice',
  'What does صِرَاط mean?',
  'Que signifie صِرَاط ?',
  '{"choices": ["Path, way", "Day", "Master"], "correctIndex": 0}'::jsonb, 'word'
FROM public.lessons WHERE slug = 'vocabulary-2';

INSERT INTO public.lesson_vocabulary_words (lesson_id, word_id, order_index)
SELECT l.id, wf.id, wf.frequency_rank - 6
FROM public.lessons l, public.word_frequency wf
WHERE l.slug = 'vocabulary-2' AND wf.frequency_rank BETWEEN 6 AND 10;

-- =========================================================================
-- 7. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_level_id uuid;
  v_module_count integer;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_vocab_link_count integer;
  v_level1_untouched integer;
BEGIN
  SELECT id INTO STRICT v_level_id FROM public.levels WHERE slug = 'basic-vocabulary-and-patterns';

  SELECT count(*) INTO v_module_count FROM public.modules WHERE level_id = v_level_id;
  IF v_module_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 modules under basic-vocabulary-and-patterns, found %.', v_module_count;
  END IF;

  SELECT count(*) INTO v_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id WHERE m.level_id = v_level_id;
  IF v_lesson_count <> 5 THEN
    RAISE EXCEPTION 'Expected exactly 5 lessons under basic-vocabulary-and-patterns, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id
  JOIN public.modules m ON m.id = l.module_id WHERE m.level_id = v_level_id;
  IF v_section_count <> 31 THEN
    RAISE EXCEPTION 'Expected exactly 31 lesson_sections under basic-vocabulary-and-patterns, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id
  JOIN public.modules m ON m.id = l.module_id WHERE m.level_id = v_level_id;
  IF v_exercise_count <> 28 THEN
    RAISE EXCEPTION 'Expected exactly 28 lesson_exercises under basic-vocabulary-and-patterns, found %.', v_exercise_count;
  END IF;

  SELECT count(*) INTO v_vocab_link_count FROM public.lesson_vocabulary_words lvw
  JOIN public.lessons l ON l.id = lvw.lesson_id
  JOIN public.modules m ON m.id = l.module_id WHERE m.level_id = v_level_id;
  IF v_vocab_link_count <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 lesson_vocabulary_words links, found %.', v_vocab_link_count;
  END IF;

  -- Level 1 (8 modules, 33 lessons) must be completely untouched.
  SELECT count(*) INTO v_level1_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.levels lv ON lv.id = m.level_id
  WHERE lv.slug = 'foundations-of-arabic-script';
  IF v_level1_untouched <> 33 THEN
    RAISE EXCEPTION 'Expected Level 1 to still have exactly 33 lessons, found %.', v_level1_untouched;
  END IF;

  RAISE NOTICE 'Level 2 Batch 1 seeded: level=%, modules=2, lessons=5, sections=31, exercises=28, vocabulary links=10.',
    v_level_id;
END $$;

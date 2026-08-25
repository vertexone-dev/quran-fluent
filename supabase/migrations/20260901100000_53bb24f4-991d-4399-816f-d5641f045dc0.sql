-- Phase 3 / Sub-phase 8 (Gate A+B): Level 1, Module 8 ("reading-al-fatiha" —
-- Reading Al-Fatiha). The final Level 1 module: the capstone synthesis of
-- Modules 1-7, applying letters, connected forms, harakat, sukūn, shadda,
-- and reading skill to the seven āyahs of Sūrat Al-Fātiḥa itself.
--
-- ROADMAP CONTEXT: slug/titles queried directly from the live `modules`
-- table before authoring — title_en "Reading Al-Fatiha", title_fr "Lecture
-- d'Al-Fatiha" (actual seeded values, used verbatim).
--
-- PREREQUISITE / SCOPE AUDIT — queried directly, not assumed: Modules 1-7
-- are complete in production (letter-shapes-1 5 + letter-shapes-2 9 +
-- harakat 4 + sukun-and-shadda 3 + tanwin 4 + connected-letter-forms 3 +
-- first-reading-practice 2 = 30 lessons). reading-al-fatiha exists with 0
-- lessons. All 7 āyahs of Sūrat Al-Fātiḥa (surah_number=1) already exist in
-- `ayahs` with governed EN/FR translations (non-null) — confirmed by direct
-- query, not assumed.
--
-- CRITICAL PRIOR-ART FINDING (changed this module's design): Al-Fatiha is
-- NOT untouched territory. Four earlier modules already used a
-- quran_example section to preview one āyah each, always framed as "you
-- know this by ear — spot the mark": Module 2 used 1:1 (spot letters
-- Bā'/Ḥā'/Rā'), Module 3 used 1:2 (spot fatḥa/kasra/ḍamma), Module 4 used
-- 1:4 (spot sukūn on wāw of "yawmi", shadda on dāl of "ad-dīn"), Module 6
-- used 1:6 (spot the dāl/nūn non-connector break). Āyahs 1:3 and 1:5 were
-- deliberately left unused by those modules (1:3 repeats part of 1:1's
-- text; 1:5 was held in reserve). This module is deliberately the FIRST
-- place a learner actually READS (not just spots a mark within) any āyah
-- of Al-Fatiha — Lessons 1 and 2 explicitly call back to what was spotted
-- in Modules 2-4 and 6 before asking the learner to read the whole āyah.
--
-- Verified this module needs no NEW mark: analyzed every āyah's actual
-- stored diacritics programmatically (not eyeballed). Result: fatḥa,
-- ḍamma, kasra, sukūn, shadda, and alef wasla (ٱ) appear throughout — all
-- already taught. TANWĪN DOES NOT APPEAR ANYWHERE IN AL-FATIHA'S TEXT
-- (verified; zero fatḥatān/ḍammatān/kasratān across all 7 āyahs) — not
-- exercised here, and not claimed to be. The dagger alif (ٰ, superscript
-- alef marking an unwritten long vowel) appears in most āyahs; per the
-- "no Tajweed/grammar instruction" boundary below, it is never named or
-- explained — it is simply present in the authentic rendered text, and
-- reading_check answer choices reflect the vowel length it produces
-- (e.g. "ar-rahmani" read long) without asserting any named rule.
--
-- LESSON ARCHITECTURE — 3 lessons, smallest split that keeps any one
-- lesson's reading load reasonable given 7 āyahs of real, unequal-length
-- Qur'anic text (not padded, not compressed into 1 lesson): Lesson 1
-- (āyahs 1-3), Lesson 2 (āyahs 4-6) — both callback-heavy, each closing
-- one āyah introduced fresh (1:3, 1:5) — and Lesson 3 (āyah 7 alone, the
-- longest and final āyah, entirely fresh, plus the module/Level-1 capstone
-- close). Lesson/section slugs and titles are deliberately neutral and
-- structural (āyah ranges only) rather than thematic, to avoid asserting
-- any interpretation of the surah's structure.
--
-- QUR'ANIC ARABIC: FK-BACKED ONLY. Every quran_example section references
-- (surah_number, ayah_number) against the existing `ayahs` table via the
-- schema's own FK/CHECK constraints — no āyah's full Arabic text is
-- duplicated anywhere in this migration. The only Arabic text embedded
-- directly in migration content is short, single-word excerpts inside
-- exercise prompt_en/prompt_fr strings (e.g. "ٱلرَّحْمَٰنِ reads:"), exactly
-- the precedent already established by Module 6's own quran_example
-- exercises (e.g. "In ٱهْدِنَا (from the Qur'an example), which letter...").
-- No translation is invented anywhere: body_en/body_fr text describes the
-- READING task only; the actual translation shown to learners is always
-- the existing governed translation_en/translation_fr already stored on
-- the ayahs row, rendered by the pre-existing QuranExampleSection
-- component (src/components/learning/LessonSectionRenderer.tsx) — read
-- directly before authoring, confirmed to already fetch via fetchAyah()
-- and render font-quran/dir=rtl/lang=ar correctly; ZERO application code
-- changes needed for this module.
--
-- CONTENT BOUNDARY (explicitly deferred, not invented): no Tajweed rule
-- (elongation/madd, sun-letter assimilation, nasalization, stopping
-- rules), no grammar/morphology explanation (case endings, verb forms,
-- iḍāfa), and no religious interpretation/tafsīr beyond the surah's
-- already-governed translation text. Structural framing used only to
-- justify the 3-lesson split (āyah ranges) is purely descriptive, not
-- doctrinal.
--
-- REVIEW STRATEGY — NO NEW REVIEW CONCEPTS, same architectural decision as
-- Module 7 and for the same reason: seedLessonReviewItems (src/lib/
-- study.ts, unchanged, re-inspected before authoring) only derives review
-- items from `matching`-type exercises. This module reads real Qur'anic
-- text, it does not introduce a new discrete fact worth flashcarding —
-- forcing a matching exercise here (e.g. to recap non-connectors) would
-- duplicate Module 6's own already-existing concept:non-connectors /
-- concept:letter-positions review items for no reason, which the
-- generic ignoreDuplicates:true resolution would just silently absorb
-- anyway. No `matching` exercise is used, guaranteeing zero new review
-- items without any special-case code. review_item_type is set to the
-- schema-required, semantically honest value 'ayah' (not 'word') on every
-- exercise row here, since every exercise concerns real āyah content —
-- still functionally inert for anything but `matching`, exactly as
-- Module 7's 'word' label was.
--
-- EXERCISE TYPES: reading_check, true_false, multiple_choice — all
-- pre-existing, no new type. Several exercises and quran_example sections
-- carry their own (surah_number, ayah_number) FK independent of
-- section_id, honestly reflecting which āyah each one concerns.
--
-- TRANSLITERATION: uses the same widely-standard, commonly-published
-- simplified transliteration for these specific āyahs/words (e.g.
-- "bismillah", "ar-rahmani", "yawmi", "iyyaka") that already appears
-- verbatim in Module 4 and Module 6's own quran_example body text — not
-- an invented phonetic scheme.
--
-- WORD SELECTION — every exercise word verified letter-by-letter against
-- the actual stored `ayahs` text via a Python diacritic breakdown before
-- authoring (not eyeballed): ٱلرَّحْمَٰنِ, ٱلرَّحِيمِ (1:1); ٱلْحَمْدُ (1:2);
-- يَوْمِ, ٱلدِّينِ (1:4); نَعْبُدُ, إِيَّاكَ (1:5); صِرَٰطَ, غَيْرِ, عَلَيْهِمْ,
-- ٱلضَّآلِّينَ (1:7). All true/false structural claims (e.g. "āyah 3 repeats
-- the closing words of āyah 1", "عَلَيْهِمْ appears twice in āyah 7") were
-- verified by direct string/token comparison against the stored text, not
-- assumed.
--
-- CONTENT GOVERNANCE: no content_sources row needed — Qur'anic text and
-- translations already exist as governed, verified rows in `ayahs`
-- (referenced by FK only). RED ITEMS: 0. YELLOW ITEMS: 0.

DO $$
DECLARE
  v_existing_lessons integer;
  v_module_id uuid;
  v_prior_lesson_count integer;
  v_fatiha_ayah_count integer;
  v_fatiha_translated_count integer;
BEGIN
  ---------------------------------------------------------------------------
  -- 0. Preconditions.
  ---------------------------------------------------------------------------
  SELECT count(*) INTO v_existing_lessons FROM public.lessons
  WHERE slug IN ('reading-al-fatiha-verses-1-3', 'reading-al-fatiha-verses-4-6', 'reading-al-fatiha-verse-7');
  IF v_existing_lessons <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 3 Module 8 lesson slugs to already exist, found %. Aborting to avoid duplicate/conflicting seed data.', v_existing_lessons;
  END IF;

  SELECT id INTO v_module_id FROM public.modules WHERE slug = 'reading-al-fatiha';
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Expected the reading-al-fatiha module to already exist (seeded by the Phase 2.1 skeleton migration). Aborting.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.lessons WHERE module_id = v_module_id) THEN
    RAISE EXCEPTION 'Expected reading-al-fatiha to have zero lessons before this migration. Aborting.';
  END IF;

  -- Modules 1-7 must be exactly the production-complete state this
  -- migration was authored against: 5+9+4+3+4+3+2 = 30.
  SELECT count(*) INTO v_prior_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda', 'tanwin', 'connected-letter-forms', 'first-reading-practice');
  IF v_prior_lesson_count <> 30 THEN
    RAISE EXCEPTION 'Expected exactly 30 lessons across Modules 1-7 before this migration, found %.', v_prior_lesson_count;
  END IF;

  -- All 7 āyahs of Al-Fatiha must already exist with governed translations
  -- (this migration references them by FK only and never invents text).
  SELECT count(*) INTO v_fatiha_ayah_count FROM public.ayahs WHERE surah_number = 1;
  IF v_fatiha_ayah_count <> 7 THEN
    RAISE EXCEPTION 'Expected exactly 7 āyahs stored for Surah 1 (Al-Fatiha), found %. Aborting.', v_fatiha_ayah_count;
  END IF;

  SELECT count(*) INTO v_fatiha_translated_count FROM public.ayahs
  WHERE surah_number = 1 AND translation_en IS NOT NULL AND translation_fr IS NOT NULL;
  IF v_fatiha_translated_count <> 7 THEN
    RAISE EXCEPTION 'Expected all 7 Al-Fatiha āyahs to already have governed EN/FR translations, found %. Aborting.', v_fatiha_translated_count;
  END IF;
END $$;

-- =========================================================================
-- 1. Lessons.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-al-fatiha-verses-1-3', 'Al-Fatiha: Ayahs 1-3', 'Al-Fatiha : versets 1 à 3', 0, 8
FROM public.modules WHERE slug = 'reading-al-fatiha';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-al-fatiha-verses-4-6', 'Al-Fatiha: Ayahs 4-6', 'Al-Fatiha : versets 4 à 6', 1, 8
FROM public.modules WHERE slug = 'reading-al-fatiha';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'reading-al-fatiha-verse-7', 'Al-Fatiha: Ayah 7', 'Al-Fatiha : verset 7', 2, 7
FROM public.modules WHERE slug = 'reading-al-fatiha';

-- =========================================================================
-- 2. Lesson 1 — Al-Fatiha: Ayahs 1-3.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'This is it — the final module. You already know every letter, every vowel mark, sukūn, shadda, tanwīn, and how letters connect. Now you apply all of it to read Sūrat Al-Fātiḥa itself, āyah by āyah, starting with its first three.',
  'Voici le dernier module. Vous connaissez déjà toutes les lettres, tous les signes de voyelle, le sukūn, la shadda, le tanwīn, et comment les lettres se lient. Vous allez maintenant appliquer tout cela pour lire Sūrat Al-Fātiḥa elle-même, verset par verset, en commençant par les trois premiers.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-1-3';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 1, 1,
  'You already spotted the letters Bā'', Ḥā'', and Rā'' here back when you were first learning letter shapes. Now read the whole āyah.',
  'Vous avez déjà repéré les lettres Bā'', Ḥā'' et Rā'' ici lorsque vous appreniez les formes des lettres. Lisez maintenant le verset entier.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-1-3';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 1, 2,
  'You already spotted the fatḥas, kasras, and one clear ḍamma here back in the harakat module. Now read the whole āyah.',
  'Vous avez déjà repéré les fatḥas, les kasras et une ḍamma bien visible ici dans le module sur les harakat. Lisez maintenant le verset entier.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-1-3';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 1, 3,
  'A short āyah you have not seen highlighted before — read it on your own using everything you know.',
  'Un court verset que vous n''avez pas encore vu mis en avant — lisez-le seul(e) en utilisant tout ce que vous savez.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-1-3';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You have now read the first three āyahs of Al-Fatiha in full.',
  'Vous avez maintenant lu les trois premiers versets d''Al-Fatiha en entier.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-1-3';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 0, 'reading_check',
  'ٱلرَّحْمَٰنِ (from āyah 1) reads:',
  'ٱلرَّحْمَٰنِ (du verset 1) se lit :',
  '{"choices": ["ar-rahmani", "ar-rahimi", "al-hamdu"], "correctIndex": 0}'::jsonb, 1, 1, 'ayah'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'reading-al-fatiha-verses-1-3';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT id, 1, 'true_false',
  'In āyah 1, ٱلرَّحِيمِ ends with a kasra.',
  'Dans le verset 1, ٱلرَّحِيمِ se termine par une kasra.',
  '{"correctAnswer": true}'::jsonb, 1, 1, 'ayah'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-1-3';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 2, 'reading_check',
  'ٱلْحَمْدُ (from āyah 2) reads:',
  'ٱلْحَمْدُ (du verset 2) se lit :',
  '{"choices": ["alhamdu", "alhamda", "alhamdi"], "correctIndex": 0}'::jsonb, 1, 2, 'ayah'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'reading-al-fatiha-verses-1-3';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT id, 3, 'true_false',
  'Āyah 3 repeats the exact same two words that close āyah 1.',
  'Le verset 3 répète exactement les deux mêmes mots qui terminent le verset 1.',
  '{"correctAnswer": true}'::jsonb, 1, 3, 'ayah'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-1-3';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT id, 4, 'multiple_choice',
  'Back in the harakat module, which marks did you spot in āyah 2?',
  'Dans le module sur les harakat, quels signes aviez-vous repérés dans le verset 2 ?',
  '{"choices": ["Sukūn only", "Fatḥas and kasras, and one ḍamma", "Tanwīn"], "correctIndex": 1}'::jsonb, 1, 2, 'ayah'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-1-3';

-- =========================================================================
-- 3. Lesson 2 — Al-Fatiha: Ayahs 4-6.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Continue reading Al-Fatiha, āyahs 4 through 6 — no new marks, just more of the surah, applying everything you know.',
  'Continuez la lecture d''Al-Fatiha, versets 4 à 6 — aucun nouveau signe, seulement davantage de la sourate, en appliquant tout ce que vous savez.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-4-6';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 1, 4,
  'You already spotted the sukūn on the wāw of "yawmi" and the shadda on the dāl of "ad-dīn" here back in the sukūn and shadda module. Now read the whole āyah.',
  'Vous avez déjà repéré le sukūn sur le wāw de « yawmi » et la shadda sur le dāl de « ad-dīn » ici dans le module sur le sukūn et la shadda. Lisez maintenant le verset entier.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-4-6';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 1, 5,
  'A new āyah you have not seen highlighted before — read it on your own using everything you know.',
  'Un nouveau verset que vous n''avez pas encore vu mis en avant — lisez-le seul(e) en utilisant tout ce que vous savez.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-4-6';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 1, 6,
  'You already spotted the dāl/nūn connection break here back in the connected letter forms module. Now read the whole āyah.',
  'Vous avez déjà repéré la rupture de liaison entre le dāl et le nūn ici dans le module sur les formes de lettres liées. Lisez maintenant le verset entier.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-4-6';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You have now read six of Al-Fatiha''s seven āyahs — one more to go.',
  'Vous avez maintenant lu six des sept versets d''Al-Fatiha — il n''en reste plus qu''un.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-4-6';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 0, 'reading_check',
  'يَوْمِ (from āyah 4) reads:',
  'يَوْمِ (du verset 4) se lit :',
  '{"choices": ["yawmi", "yami", "yumi"], "correctIndex": 0}'::jsonb, 1, 4, 'ayah'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'reading-al-fatiha-verses-4-6';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT id, 1, 'true_false',
  'In āyah 4, the Dāl of ٱلدِّينِ carries a shadda.',
  'Dans le verset 4, le Dāl de ٱلدِّينِ porte une shadda.',
  '{"correctAnswer": true}'::jsonb, 1, 4, 'ayah'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-4-6';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 2, 'reading_check',
  'نَعْبُدُ (from āyah 5) reads:',
  'نَعْبُدُ (du verset 5) se lit :',
  '{"choices": ["na''budu", "na''badu", "nu''budu"], "correctIndex": 0}'::jsonb, 1, 5, 'ayah'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'reading-al-fatiha-verses-4-6';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT id, 3, 'true_false',
  'The word that opens āyah 5 (إِيَّاكَ) is echoed again later in the same āyah.',
  'Le mot qui ouvre le verset 5 (إِيَّاكَ) est répété plus loin dans le même verset.',
  '{"correctAnswer": true}'::jsonb, 1, 5, 'ayah'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-4-6';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT id, 4, 'multiple_choice',
  'Back in the connected letter forms module, what did you spot in āyah 6?',
  'Dans le module sur les formes de lettres liées, qu''aviez-vous repéré dans le verset 6 ?',
  '{"choices": ["A shadda", "A non-connecting letter", "A tanwīn"], "correctIndex": 1}'::jsonb, 1, 6, 'ayah'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verses-4-6';

-- =========================================================================
-- 4. Lesson 3 — Al-Fatiha: Ayah 7 (final āyah + module/Level 1 capstone).
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'The seventh and final āyah of Al-Fatiha — the longest one, and the last new text in Level 1. No earlier module highlighted this one; read it fresh, using everything you have learned.',
  'Le septième et dernier verset d''Al-Fatiha — le plus long, et le dernier nouveau texte du Niveau 1. Aucun module précédent ne l''a mis en avant ; lisez-le pour la première fois, en utilisant tout ce que vous avez appris.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verse-7';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 1, 7,
  'Read the whole āyah, one word at a time, the same way you have read every āyah in this module.',
  'Lisez le verset entier, un mot à la fois, de la même manière que vous avez lu chaque verset de ce module.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verse-7';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'summary',
  'You have now read every āyah of Sūrat Al-Fātiḥa, applying everything from Modules 1 through 7. That completes Level 1''s reading skills.',
  'Vous avez maintenant lu chaque verset de Sūrat Al-Fātiḥa, en appliquant tout ce qui vient des modules 1 à 7. Cela complète les compétences de lecture du Niveau 1.'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verse-7';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 0, 'reading_check',
  'صِرَٰطَ (the first word of āyah 7) reads:',
  'صِرَٰطَ (le premier mot du verset 7) se lit :',
  '{"choices": ["sirata", "sarata", "surata"], "correctIndex": 0}'::jsonb, 1, 7, 'ayah'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'reading-al-fatiha-verse-7';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT id, 1, 'true_false',
  'The word عَلَيْهِمْ appears twice in āyah 7.',
  'Le mot عَلَيْهِمْ apparaît deux fois dans le verset 7.',
  '{"correctAnswer": true}'::jsonb, 1, 7, 'ayah'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verse-7';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, s.id, 2, 'reading_check',
  'ٱلضَّآلِّينَ (the last word of āyah 7) reads:',
  'ٱلضَّآلِّينَ (le dernier mot du verset 7) se lit :',
  '{"choices": ["ad-daaalleen", "al-dalleen", "ad-dalleena"], "correctIndex": 0}'::jsonb, 1, 7, 'ayah'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'reading-al-fatiha-verse-7';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'multiple_choice',
  'How many āyahs make up Sūrat Al-Fatiha?',
  'Combien de versets compte Sūrat Al-Fatiha ?',
  '{"choices": ["Five", "Seven", "Ten"], "correctIndex": 1}'::jsonb, 'ayah'
FROM public.lessons WHERE slug = 'reading-al-fatiha-verse-7';

-- =========================================================================
-- 5. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_quran_example_count integer;
  v_matching_exercise_count integer;
  v_prior_modules_untouched integer;
  v_other_modules_untouched integer;
BEGIN
  SELECT id INTO STRICT v_module_id FROM public.modules WHERE slug = 'reading-al-fatiha';

  SELECT count(*) INTO v_lesson_count FROM public.lessons WHERE module_id = v_module_id;
  IF v_lesson_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 lessons in reading-al-fatiha, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id WHERE l.module_id = v_module_id;
  IF v_section_count <> 13 THEN
    RAISE EXCEPTION 'Expected exactly 13 lesson_sections in reading-al-fatiha, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id WHERE l.module_id = v_module_id;
  IF v_exercise_count <> 14 THEN
    RAISE EXCEPTION 'Expected exactly 14 lesson_exercises in reading-al-fatiha, found %.', v_exercise_count;
  END IF;

  -- All 7 āyahs of Al-Fatiha must be represented exactly once each as a
  -- quran_example section (1,2,3,4,5,6,7 — the full surah, no gaps, no
  -- repeats).
  SELECT count(*) INTO v_quran_example_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id
  WHERE l.module_id = v_module_id AND ls.content_type = 'quran_example';
  IF v_quran_example_count <> 7 THEN
    RAISE EXCEPTION 'Expected exactly 7 quran_example sections (one per āyah) in reading-al-fatiha, found %.', v_quran_example_count;
  END IF;

  IF EXISTS (
    SELECT ayah_number FROM public.lesson_sections ls
    JOIN public.lessons l ON l.id = ls.lesson_id
    WHERE l.module_id = v_module_id AND ls.content_type = 'quran_example'
    GROUP BY ayah_number HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'Expected each of Al-Fatiha''s 7 āyahs to appear exactly once as a quran_example section.';
  END IF;

  -- No matching exercises: this module deliberately creates zero new
  -- review items, per the migration header's rationale.
  SELECT count(*) INTO v_matching_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id
  WHERE l.module_id = v_module_id AND le.exercise_type = 'matching';
  IF v_matching_exercise_count <> 0 THEN
    RAISE EXCEPTION 'Expected zero matching exercises in reading-al-fatiha (no new review items by design), found %.', v_matching_exercise_count;
  END IF;

  -- Modules 1-7 must be completely untouched by this migration.
  SELECT count(*) INTO v_prior_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda', 'tanwin', 'connected-letter-forms', 'first-reading-practice');
  IF v_prior_modules_untouched <> 30 THEN
    RAISE EXCEPTION 'Expected Modules 1-7 to still have exactly 30 lessons combined, found %.', v_prior_modules_untouched;
  END IF;

  -- No modules beyond Level 1's 8 exist to accidentally touch, but assert
  -- the full accounting anyway: every lesson across the whole course must
  -- belong to one of these 8 modules.
  SELECT count(*) INTO v_other_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug NOT IN ('letter-shapes-1', 'letter-shapes-2', 'harakat', 'sukun-and-shadda', 'tanwin', 'connected-letter-forms', 'first-reading-practice', 'reading-al-fatiha');
  IF v_other_modules_untouched <> 0 THEN
    RAISE EXCEPTION 'Expected zero lessons in modules other than the 8 Level 1 modules, found %.', v_other_modules_untouched;
  END IF;

  RAISE NOTICE 'Module 8 (reading-al-fatiha) seeded: module=%, lessons=3, sections=13, exercises=14.',
    v_module_id;
END $$;

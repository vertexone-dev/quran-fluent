-- Level 5 ("Guided Ayah Comprehension") Batch 1: Module 1 (attached-particles)
-- and Module 2 (verbal-sentences-past), per the approved Level 5 Batch 1
-- design.
--
-- LEVEL IDENTITY: the curriculum skeleton (migration 20260822110000) already
-- reserved levels.number = 5 as an EMPTY placeholder -- slug
-- 'reading-comprehension', title "Reading Comprehension" -- with zero
-- modules/lessons ever added to it, and confirmed (by direct grep before
-- authoring this migration) referenced nowhere in src/ or tests/. Two facts
-- confirm this placeholder IS this same level under an earlier working
-- name, not a separate level: (1) PATH_STEPS (src/lib/placement.ts) reserves
-- exactly two step keys beyond 'grammar' -- 'ayah_comprehension' and
-- 'surah_mastery' -- and exactly two empty placeholder levels
-- (number 5, number 6) remain after core-grammar, a 1:1 positional match;
-- (2) STEP_LEVEL_SLUGS has no entry yet for 'ayah_comprehension', matching
-- the reserved-but-unbuilt state. This migration therefore RENAMES the
-- existing number=5 row (slug/title/goal only -- id, number, order_index,
-- course_id all preserved) rather than inserting a competing level, and
-- updates its pre-existing level_translations rows (created by the i18n
-- backfill) to match, rather than violating their (level_id, locale)
-- UNIQUE constraint with a duplicate insert. levels.number = 6
-- ('quranic-comprehension') is untouched by this migration, reserved for a
-- future 'surah_mastery' batch.
--
-- LEVEL 4 li-/bi- OVERLAP: Level 4 Batch 2 (migration 20260908100000)
-- already introduced bi- (113:1, bi-rabbi) and li- (1:2, li-llahi) as a
-- brief, zero-review-item close-reading note. This migration does not
-- repeat those exact examples: bi- is re-shown via a DIFFERENT verse
-- (1:1, bi-smi llahi -- attached to "name" instead of "Lord"), and li- via
-- a DIFFERENT verse (112:4, la-hu -- attached to a pronoun instead of a
-- name), then both get their first real matching-exercise review items,
-- extending recognition rather than re-teaching the same fact.
--
-- QUR'AN INTEGRITY: every Arabic string in this migration is either an
-- exact (surah_number, ayah_number) FK reference enforced by the existing
-- lesson_sections/lesson_exercises -> ayahs composite foreign keys, or a
-- transliteration/gloss in prose -- no canonical Arabic is hand-typed into
-- any body/prompt/payload text. Referenced verses -- 1:1, 1:2, 1:5, 1:7,
-- 112:3, 112:4, 113:1, 113:2, 113:4 -- are confirmed to already exist in
-- public.ayahs by the preconditions below, not assumed.
--
-- NEW VOCABULARY DISCIPLINE (mirrors the "a'udhu"/"maa" precedent from
-- Level 3 Batch 2 and Level 4 Batch 2): naffathat/al-'uqad (113:4) and
-- yakun/kufuwan (112:4) are unavoidable neighbor-words in verses chosen for
-- their fi/li- content. Each is explained only inline, in prose, purely
-- for comprehension of the target particle -- none is added to
-- word_frequency (which remains at exactly 20 rows, verified below), and
-- none appears in any exercise's selectable answer choices.
--
-- I18N: per the Internationalization Foundation Phase 1 authoring
-- contract (migration 20260909100000's own header: "so Level 5+ can author
-- en/fr translation rows directly under the final contract"), every new
-- level/module/lesson/section/exercise row's EN/FR is written BOTH into
-- the legacy _en/_fr columns (still NOT NULL on levels/modules/lessons and
-- on lesson_exercises.prompt_*, per information_schema, so still
-- mandatory) AND into the corresponding normalized *_translations table
-- (locale 'en'/'fr' only -- no ar/ur/id rows). fetchLessonForPlayer (src/
-- lib/curriculum.ts) reads exclusively from the normalized tables at
-- render time, falling back to the legacy _en column only if a
-- translation row is entirely missing -- so the normalized rows are the
-- ones that actually reach a French-interface learner.
--
-- EXERCISES: only pre-existing exercise_type values are used
-- (multiple_choice, true_false, matching, reading_check) -- zero new
-- types. review_item_type 'concept' is used for the 3 matching exercises
-- that introduce genuinely new recognition skills (mirroring
-- 'he-is-allah-one' from Level 4 Batch 1); the Module 2 capstone lesson
-- (guided-decomposition-al-falaq-2) is pure synthesis of already-taught
-- material and deliberately has zero matching exercises / zero new review
-- items, mirroring Level 4 Batch 2's capstone judgment.
--
-- PROGRESSION: STEP_LEVEL_SLUGS (src/lib/placement.ts) gets exactly one
-- new entry, ayah_comprehension -> { levelSlug: 'guided-ayah-comprehension',
-- requiresLevelSlug: 'core-grammar' }, mirroring the existing
-- roots/grammar entries exactly -- gated on Level 4 being fully complete
-- (completedCount === totalCount), per the approved design. No other
-- application code changes; findCurriculumEntryPoint already generalizes
-- to any level with >=1 module and >=1 non-placeholder lesson.
--
-- CONTENT GOVERNANCE: RED ITEMS: 0. YELLOW ITEMS: 0.

DO $$
DECLARE
  v_existing integer;
  v_level_id uuid;
  v_core_grammar_id uuid;
  v_core_grammar_modules integer;
  v_core_grammar_lessons integer;
BEGIN
  -- Row-count baseline (confirmed by direct query before authoring).
  SELECT count(*) INTO v_existing FROM public.levels;
  IF v_existing <> 6 THEN
    RAISE EXCEPTION 'Expected exactly 6 levels before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.modules;
  IF v_existing <> 19 THEN
    RAISE EXCEPTION 'Expected exactly 19 modules before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.lessons;
  IF v_existing <> 51 THEN
    RAISE EXCEPTION 'Expected exactly 51 lessons before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.lesson_sections;
  IF v_existing <> 262 THEN
    RAISE EXCEPTION 'Expected exactly 262 lesson_sections before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.lesson_exercises;
  IF v_existing <> 212 THEN
    RAISE EXCEPTION 'Expected exactly 212 lesson_exercises before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.word_frequency;
  IF v_existing <> 20 THEN
    RAISE EXCEPTION 'Expected exactly 20 word_frequency rows before this migration, found %.', v_existing;
  END IF;

  -- The placeholder level this migration renames: number=5, empty.
  SELECT id INTO v_level_id FROM public.levels WHERE number = 5 AND slug = 'reading-comprehension';
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Expected levels.number=5 with slug reading-comprehension to already exist. Aborting.';
  END IF;
  SELECT count(*) INTO v_existing FROM public.modules WHERE level_id = v_level_id;
  IF v_existing <> 0 THEN
    RAISE EXCEPTION 'Expected the number=5 placeholder level to have zero modules, found %.', v_existing;
  END IF;

  SELECT count(*) INTO v_existing FROM public.levels WHERE slug = 'guided-ayah-comprehension';
  IF v_existing <> 0 THEN
    RAISE EXCEPTION 'Expected zero guided-ayah-comprehension level to already exist, found %.', v_existing;
  END IF;

  -- Level 4 (core-grammar) must already be exactly Batch1+Batch2-complete
  -- (3 modules, 4 lessons) -- confirms this migration runs after both
  -- Level 4 migrations, never before.
  SELECT id INTO v_core_grammar_id FROM public.levels WHERE slug = 'core-grammar';
  SELECT count(*) INTO v_core_grammar_modules FROM public.modules WHERE level_id = v_core_grammar_id;
  IF v_core_grammar_modules <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 core-grammar modules before this migration, found %.', v_core_grammar_modules;
  END IF;
  SELECT count(*) INTO v_core_grammar_lessons FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id WHERE m.level_id = v_core_grammar_id;
  IF v_core_grammar_lessons <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 core-grammar lessons before this migration, found %.', v_core_grammar_lessons;
  END IF;

  -- New module/lesson slugs must not already exist anywhere.
  IF EXISTS (SELECT 1 FROM public.modules WHERE slug IN ('attached-particles', 'verbal-sentences-past')) THEN
    RAISE EXCEPTION 'Expected zero attached-particles/verbal-sentences-past modules to already exist.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.lessons WHERE slug IN (
      'attached-prefixes-wa-al-bi-li', 'independent-prepositions-fi-min-ala',
      'recognizing-past-tense-verbs', 'guided-decomposition-al-falaq-2'
    )
  ) THEN
    RAISE EXCEPTION 'Expected zero Level 5 Batch 1 lesson slugs to already exist.';
  END IF;

  -- Every referenced ayah must already be cached.
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 1 AND ayah_number = 1) THEN
    RAISE EXCEPTION 'Expected ayah 1:1 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 1 AND ayah_number = 2) THEN
    RAISE EXCEPTION 'Expected ayah 1:2 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 1 AND ayah_number = 5) THEN
    RAISE EXCEPTION 'Expected ayah 1:5 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 1 AND ayah_number = 7) THEN
    RAISE EXCEPTION 'Expected ayah 1:7 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 112 AND ayah_number = 3) THEN
    RAISE EXCEPTION 'Expected ayah 112:3 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 112 AND ayah_number = 4) THEN
    RAISE EXCEPTION 'Expected ayah 112:4 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 113 AND ayah_number = 1) THEN
    RAISE EXCEPTION 'Expected ayah 113:1 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 113 AND ayah_number = 2) THEN
    RAISE EXCEPTION 'Expected ayah 113:2 to already be cached.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ayahs WHERE surah_number = 113 AND ayah_number = 4) THEN
    RAISE EXCEPTION 'Expected ayah 113:4 to already be cached.';
  END IF;

  -- Already-known vocabulary this migration reinforces (rank 17 sharr,
  -- rank 18 khalaqa) must already exist.
  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 17) THEN
    RAISE EXCEPTION 'Expected rank 17 (Sharr) to already exist in word_frequency.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.word_frequency WHERE frequency_rank = 18) THEN
    RAISE EXCEPTION 'Expected rank 18 (Khalaqa) to already exist in word_frequency.';
  END IF;
END $$;

-- =========================================================================
-- 1. Rename the reserved number=5 placeholder level.
-- =========================================================================

UPDATE public.levels
SET
  slug = 'guided-ayah-comprehension',
  title_en = 'Guided Āyah Comprehension',
  title_fr = 'Compréhension guidée des versets',
  goal_en = 'Combine your knowledge of attached particles and basic verbs to begin decomposing and understanding short, authentic Qur''anic āyāt.',
  goal_fr = 'Combiner vos connaissances des particules attachées et des verbes de base pour commencer à décomposer et comprendre de courts versets coraniques authentiques.'
WHERE number = 5 AND slug = 'reading-comprehension';

-- The i18n backfill (20260909100000) already created level_translations
-- rows for this level_id at (en, fr) -- update in place rather than
-- inserting, to respect the (level_id, locale) UNIQUE constraint.
UPDATE public.level_translations
SET title = 'Guided Āyah Comprehension',
    goal = 'Combine your knowledge of attached particles and basic verbs to begin decomposing and understanding short, authentic Qur''anic āyāt.',
    updated_at = now()
WHERE level_id = (SELECT id FROM public.levels WHERE slug = 'guided-ayah-comprehension') AND locale = 'en';

UPDATE public.level_translations
SET title = 'Compréhension guidée des versets',
    goal = 'Combiner vos connaissances des particules attachées et des verbes de base pour commencer à décomposer et comprendre de courts versets coraniques authentiques.',
    updated_at = now()
WHERE level_id = (SELECT id FROM public.levels WHERE slug = 'guided-ayah-comprehension') AND locale = 'fr';

-- =========================================================================
-- 2. Module 1: attached-particles.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'attached-particles', 'Attached Particles', 'Particules attachées', 0
FROM public.levels WHERE slug = 'guided-ayah-comprehension';

INSERT INTO public.module_translations (module_id, locale, title)
SELECT id, 'en', 'Attached Particles' FROM public.modules WHERE slug = 'attached-particles';
INSERT INTO public.module_translations (module_id, locale, title)
SELECT id, 'fr', 'Particules attachées' FROM public.modules WHERE slug = 'attached-particles';

-- -------------------------------------------------------------------------
-- 2.1 Lesson: attached-prefixes-wa-al-bi-li.
-- -------------------------------------------------------------------------

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'attached-prefixes-wa-al-bi-li', 'Attached Prefixes: wa-, al-, bi-, li-', 'Préfixes attachés : wa-, al-, bi-, li-', 0, 8
FROM public.modules WHERE slug = 'attached-particles';

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', 'Attached Prefixes: wa-, al-, bi-, li-' FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', 'Préfixes attachés : wa-, al-, bi-, li-' FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You already know some Arabic words. Now look closely at four tiny prefixes that attach directly to the front of a word, never standing alone: wa- (''and''), al- (''the''), bi- (''in/with''), and li- (''to/for''). You met bi- and li- briefly in Level 4 -- here you will see them again in new verses and learn to recognize them confidently on your own.',
  'Vous connaissez déjà quelques mots arabes. Observez maintenant de près quatre minuscules préfixes qui s''attachent directement au début d''un mot, sans jamais être séparés : wa- (« et »), al- (« le/la »), bi- (« en/avec ») et li- (« à/pour »). Vous avez déjà rencontré brièvement bi- et li- au Niveau 4 -- vous les reverrez ici dans de nouveaux versets et apprendrez à les reconnaître avec assurance par vous-même.'
FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 1, 5,
  'In this familiar verse from Al-Fatiha, wa- (''and'') is attached directly to the front of iyyaka (''You alone''), joining two matching phrases: iyyaka na''budu wa-iyyaka nasta''in -- ''You alone we worship, and You alone we ask for help.'' wa- is never written as a separate word.',
  'Dans ce verset familier d''Al-Fatiha, wa- (« et ») est attaché directement au début de iyyaka (« Toi seul »), reliant deux expressions parallèles : iyyaka na''budu wa-iyyaka nasta''in -- « C''est Toi seul que nous adorons, et c''est Toi seul dont nous implorons le secours. » wa- n''est jamais écrit comme un mot séparé.'
FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 1, 2,
  'Look again at al-hamdu (''the praise'') and al-''alameen (''the worlds''). al- (''the'') is attached to the front of a noun to make it definite -- a specific thing, not just any example of it. You already learned that rabbi l-''alameen means ''Lord of the worlds''; now name the al- prefix itself.',
  'Regardez à nouveau al-hamdu (« la louange ») et al-''alameen (« les mondes »). al- (« le/la ») s''attache au début d''un nom pour le rendre défini -- une chose précise, et non un exemple quelconque. Vous avez déjà appris que rabbi l-''alameen signifie « Seigneur des mondes » ; nommez à présent le préfixe al- lui-même.'
FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 1, 1,
  'Bismillah opens nearly every surah: bi-smi llahi (''in the name of Allah''). You saw bi- before in bi-rabbi (''with the Lord'', 113:1) -- here it attaches to ism (''name'') instead, still meaning ''in/with'', still never a separate word.',
  'La Basmala ouvre presque toutes les sourates : bi-smi llahi (« au nom d''Allah »). Vous avez déjà vu bi- dans bi-rabbi (« avec le Seigneur », 113:1) -- ici, il s''attache à ism (« nom ») à la place, en gardant le sens « en/avec », toujours sans être un mot séparé.'
FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 4, 'quran_example', 112, 4,
  'Wa-lam yakun lahu kufuwan ahad closes Surah Al-Ikhlas: ''nor is there to Him any equivalent.'' Lahu means ''to/for Him'' -- the same li- you saw in li-llahi (1:2), now attached to hu (''him'') instead of a name. (Yakun and kufuwan are unusual words here -- you do not need to memorize them; just notice lahu.)',
  'Wa-lam yakun lahu kufuwan ahad clôt la sourate Al-Ikhlas : « et nul n''est égal à Lui. » Lahu signifie « à/pour Lui » -- le même li- que vous avez vu dans li-llahi (1:2), ici attaché à hu (« lui ») plutôt qu''à un nom. (Yakun et kufuwan sont des mots inhabituels ici -- vous n''avez pas besoin de les mémoriser ; remarquez simplement lahu.)'
FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'wa-, al-, bi-, and li- are always attached -- never written or pronounced as separate words; spot them at the very front of a word, not by looking for a gap. You can now recognize all four in real verses from Al-Fatiha and Al-Ikhlas.',
  'wa-, al-, bi- et li- sont toujours attachés -- jamais écrits ni prononcés comme des mots séparés ; repérez-les au tout début d''un mot, et non par un espace. Vous pouvez maintenant reconnaître ces quatre préfixes dans de vrais versets d''Al-Fatiha et d''Al-Ikhlas.'
FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'en', s.body_en FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'attached-prefixes-wa-al-bi-li';
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'fr', s.body_fr FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'wa- is written as its own separate word before iyyaka.',
  'wa- est écrit comme un mot séparé devant iyyaka.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'Which prefix makes a noun definite (''the'')?',
  'Quel préfixe rend un nom défini (« le/la »)?',
  '{"choices": ["al-", "wa-", "bi-"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'multiple_choice',
  'In bismillah, what does bi- attach to?',
  'Dans bismillah, à quoi bi- s''attache-t-il ?',
  '{"choices": ["ism (name)", "rabb (Lord)", "Allah"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'matching',
  'Match each attached prefix to its meaning.',
  'Associez chaque préfixe attaché à sa signification.',
  '{"pairs": [
    {"left": "particle-wa", "right": "wa-- (\"and\") -- always attached to the front of the next word, as in wa-iyyaka nasta''in"},
    {"left": "particle-al", "right": "al-- (\"the\") -- attached to a noun to make it definite, as in al-hamdu"},
    {"left": "particle-bi", "right": "bi-- (\"in/with\") -- attached to the front of a word, as in bi-smi llahi and bi-rabbi"},
    {"left": "particle-li", "right": "li-- (\"to/for\") -- attached to the front of a word or pronoun, as in li-llahi and lahu"}
  ]}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'en', e.prompt_en, e.payload FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'attached-prefixes-wa-al-bi-li';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'fr', e.prompt_fr,
  CASE e.order_index
    WHEN 0 THEN '{"correctAnswer": false}'::jsonb
    WHEN 1 THEN '{"choices": ["al-", "wa-", "bi-"], "correctIndex": 0}'::jsonb
    WHEN 2 THEN '{"choices": ["ism (nom)", "rabb (Seigneur)", "Allah"], "correctIndex": 0}'::jsonb
    WHEN 3 THEN '{"pairs": [
      {"left": "particle-wa", "right": "wa-- (« et ») -- toujours attaché au début du mot suivant, comme dans wa-iyyaka nasta''in"},
      {"left": "particle-al", "right": "al-- (« le/la ») -- attaché à un nom pour le rendre défini, comme dans al-hamdu"},
      {"left": "particle-bi", "right": "bi-- (« en/avec ») -- attaché au début d''un mot, comme dans bi-smi llahi et bi-rabbi"},
      {"left": "particle-li", "right": "li-- (« à/pour ») -- attaché au début d''un mot ou d''un pronom, comme dans li-llahi et lahu"}
    ]}'::jsonb
  END
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'attached-prefixes-wa-al-bi-li';

-- -------------------------------------------------------------------------
-- 2.2 Lesson: independent-prepositions-fi-min-ala.
-- -------------------------------------------------------------------------

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'independent-prepositions-fi-min-ala', 'Independent Prepositions: fī, min, ʿalā', 'Prépositions indépendantes : fī, min, ʿalā', 1, 7
FROM public.modules WHERE slug = 'attached-particles';

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', 'Independent Prepositions: fī, min, ʿalā' FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', 'Prépositions indépendantes : fī, min, ʿalā' FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Unlike wa-, al-, bi-, and li-, three common prepositions are written as their own separate words: fī (''in''), min (''from''), and ʿalā (''on/upon''). You will see each one in a familiar or short verse.',
  'Contrairement à wa-, al-, bi- et li-, trois prépositions courantes s''écrivent comme des mots à part entière : fī (« dans »), min (« de/depuis ») et ʿalā (« sur »). Vous verrez chacune d''elles dans un verset familier ou court.'
FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 113, 2,
  'Min sharri maa khalaqa: ''from the evil of what He created.'' min (''from'') stands as its own word before sharr (''evil'').',
  'Min sharri maa khalaqa : « du mal de ce qu''Il a créé. » min (« de/depuis ») se tient comme un mot à part entière avant sharr (« le mal »).'
FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 113, 4,
  'Wa-min sharri n-naffathati fi l-''uqad: ''and from the evil of the blowers in knots'' -- a verse about ancient charm-tying. Notice fi (''in''), its own separate word before al-''uqad (''the knots''). Naffathat and al-''uqad are unusual words you do not need to memorize; just notice fi standing between them.',
  'Wa-min sharri n-naffathati fi l-''uqad : « et du mal de celles qui soufflent sur les nœuds » -- un verset évoquant l''ancienne pratique des nœuds noués. Remarquez fi (« dans »), un mot séparé avant al-''uqad (« les nœuds »). Naffathat et al-''uqad sont des mots inhabituels que vous n''avez pas besoin de mémoriser ; remarquez simplement fi entre eux.'
FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 1, 7,
  '''Alayhim (''upon them'') appears twice in this verse, ''alā attached to a pronoun (-him, ''them''). ''alā itself is the same preposition you will now recognize as its own word.',
  '''Alayhim (« sur eux ») apparaît deux fois dans ce verset, ''alā étant attaché à un pronom (-him, « eux »). ''alā lui-même reste la même préposition, que vous reconnaîtrez désormais comme un mot à part entière.'
FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'fī, min, and ʿalā are separate words -- you can point to a gap before and after them. This is different from wa-, al-, bi-, and li-, which are never separate.',
  'fī, min et ʿalā sont des mots séparés -- vous pouvez pointer un espace avant et après eux. C''est différent de wa-, al-, bi- et li-, qui ne sont jamais séparés.'
FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You can now recognize three independent prepositions -- fī (''in''), min (''from''), and ʿalā (''on/upon'') -- as their own separate words in real verses.',
  'Vous pouvez maintenant reconnaître trois prépositions indépendantes -- fī (« dans »), min (« de/depuis ») et ʿalā (« sur ») -- comme des mots séparés dans de vrais versets.'
FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'en', s.body_en FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'independent-prepositions-fi-min-ala';
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'fr', s.body_fr FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'fī, min, and ʿalā are attached directly to the following word, with no gap.',
  'fī, min et ʿalā sont attachés directement au mot suivant, sans espace.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'Which word means ''from'' in min sharri maa khalaqa?',
  'Quel mot signifie « de/depuis » dans min sharri maa khalaqa ?',
  '{"choices": ["min", "sharri", "khalaqa"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each independent preposition to its meaning.',
  'Associez chaque préposition indépendante à sa signification.',
  '{"pairs": [
    {"left": "particle-fi", "right": "fi (\"in\") -- a separate word, as in fi l-''uqad"},
    {"left": "particle-min", "right": "min (\"from\") -- a separate word, as in min sharri maa khalaqa"},
    {"left": "particle-ala", "right": "ala (\"on/upon\") -- a separate word, attached to pronouns like -him in ''alayhim"}
  ]}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'en', e.prompt_en, e.payload FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'independent-prepositions-fi-min-ala';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'fr', e.prompt_fr,
  CASE e.order_index
    WHEN 0 THEN '{"correctAnswer": false}'::jsonb
    WHEN 1 THEN '{"choices": ["min", "sharri", "khalaqa"], "correctIndex": 0}'::jsonb
    WHEN 2 THEN '{"pairs": [
      {"left": "particle-fi", "right": "fi (« dans ») -- un mot séparé, comme dans fi l-''uqad"},
      {"left": "particle-min", "right": "min (« de/depuis ») -- un mot séparé, comme dans min sharri maa khalaqa"},
      {"left": "particle-ala", "right": "ala (« sur ») -- un mot séparé, attaché à des pronoms comme -him dans ''alayhim"}
    ]}'::jsonb
  END
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'independent-prepositions-fi-min-ala';

-- =========================================================================
-- 3. Module 2: verbal-sentences-past.
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index)
SELECT id, 'verbal-sentences-past', 'Past-Tense Verbal Sentences', 'Phrases verbales au passé', 1
FROM public.levels WHERE slug = 'guided-ayah-comprehension';

INSERT INTO public.module_translations (module_id, locale, title)
SELECT id, 'en', 'Past-Tense Verbal Sentences' FROM public.modules WHERE slug = 'verbal-sentences-past';
INSERT INTO public.module_translations (module_id, locale, title)
SELECT id, 'fr', 'Phrases verbales au passé' FROM public.modules WHERE slug = 'verbal-sentences-past';

-- -------------------------------------------------------------------------
-- 3.1 Lesson: recognizing-past-tense-verbs.
-- -------------------------------------------------------------------------

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'recognizing-past-tense-verbs', 'Recognizing Past-Tense Verbs', 'Reconnaître les verbes au passé', 0, 8
FROM public.modules WHERE slug = 'verbal-sentences-past';

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', 'Recognizing Past-Tense Verbs' FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', 'Reconnaître les verbes au passé' FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'So far you have mostly read nominal sentences -- sentences without a verb ''to be'', like huwa Allahu ahad (''He is Allah, One''). Now meet verbal sentences: sentences built around an action word, a verb. In Arabic, a verbal sentence usually puts the verb first, before its subject -- the opposite order from English.',
  'Jusqu''à présent, vous avez surtout lu des phrases nominales -- des phrases sans verbe « être », comme huwa Allahu ahad (« Il est Allah, Unique »). Découvrez maintenant les phrases verbales : des phrases construites autour d''un mot d''action, un verbe. En arabe, une phrase verbale place généralement le verbe en premier, avant son sujet -- l''ordre inverse de celui du français.'
FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 113, 2,
  'Khalaqa (''He created'') is a past-tense verb: a completed action, already known to you since Level 4. In min sharri maa khalaqa, khalaqa comes at the end of the verse -- but it is still the verb, and its subject (Allah/''He'') is only implied, not written as a separate word.',
  'Khalaqa (« Il a créé ») est un verbe au passé : une action accomplie, déjà connue depuis le Niveau 4. Dans min sharri maa khalaqa, khalaqa arrive à la fin du verset -- mais il reste le verbe, et son sujet (Allah/« Il ») est seulement sous-entendu, non écrit comme un mot séparé.'
FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 2, 'quran_example', 112, 3,
  'Lam yalid wa-lam yulad (''He neither begets nor is born'') puts each verb (yalid, yulad) right after lam, at the very front of its own phrase -- the common verb-first shape: verb, then its (often implied) subject, unlike English''s subject-first order.',
  'Lam yalid wa-lam yulad (« Il n''a pas engendré et n''a pas été engendré ») place chaque verbe (yalid, yulad) juste après lam, tout au début de sa propre proposition -- la forme verbe-en-premier habituelle : le verbe, puis son sujet (souvent sous-entendu), contrairement à l''ordre sujet-en-premier du français.'
FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 3, 'quran_example', 113, 2,
  'Maa in min sharri maa khalaqa means ''what'' -- maa khalaqa together mean ''what He created''. maa is a small, separate word that turns khalaqa into ''what [He] created'', not just ''He created''.',
  'Maa dans min sharri maa khalaqa signifie « ce que » -- maa khalaqa ensemble signifient « ce qu''Il a créé ». maa est un petit mot séparé qui transforme khalaqa en « ce qu''[Il] a créé », et non simplement « Il a créé ».'
FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'tip',
  'A verbal sentence''s verb usually comes first. A past-tense verb describes a completed action. maa (''what/that which'') often introduces a description of an action''s object.',
  'Dans une phrase verbale, le verbe vient généralement en premier. Un verbe au passé décrit une action accomplie. maa (« ce que ») introduit souvent la description de l''objet d''une action.'
FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 5, 'summary',
  'You can now recognize a past-tense verb, the common verb-first sentence shape, and the word maa (''what/that which'') in real verses.',
  'Vous pouvez maintenant reconnaître un verbe au passé, la forme verbe-en-premier habituelle, et le mot maa (« ce que ») dans de vrais versets.'
FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'en', s.body_en FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'recognizing-past-tense-verbs';
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'fr', s.body_fr FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'true_false',
  'In Arabic, a verbal sentence''s subject is always written before its verb, just like in English.',
  'En arabe, le sujet d''une phrase verbale est toujours écrit avant son verbe, comme en français.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'Which word in min sharri maa khalaqa is the past-tense verb?',
  'Quel mot dans min sharri maa khalaqa est le verbe au passé ?',
  '{"choices": ["khalaqa", "sharri", "maa"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'multiple_choice',
  'What does maa mean in maa khalaqa?',
  'Que signifie maa dans maa khalaqa ?',
  '{"choices": ["what/that which", "and", "from"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 3, 'matching',
  'Match each grammar concept to its description.',
  'Associez chaque concept grammatical à sa description.',
  '{"pairs": [
    {"left": "verb-past-tense", "right": "a completed action, like khalaqa (\"He created\") -- already known since Level 4, now recognized inside a full sentence"},
    {"left": "verb-first-sentence", "right": "the common Arabic sentence shape: the verb comes first, its subject is often only implied, as in lam yalid (\"He did not beget\")"},
    {"left": "particle-maa", "right": "maa (\"what/that which\") -- a separate word that turns a verb into a description of its object, as in maa khalaqa (\"what He created\")"}
  ]}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'en', e.prompt_en, e.payload FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'recognizing-past-tense-verbs';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'fr', e.prompt_fr,
  CASE e.order_index
    WHEN 0 THEN '{"correctAnswer": false}'::jsonb
    WHEN 1 THEN '{"choices": ["khalaqa", "sharri", "maa"], "correctIndex": 0}'::jsonb
    WHEN 2 THEN '{"choices": ["ce que/ce qui", "et", "de/depuis"], "correctIndex": 0}'::jsonb
    WHEN 3 THEN '{"pairs": [
      {"left": "verb-past-tense", "right": "une action accomplie, comme khalaqa (« Il a créé ») -- déjà connu depuis le Niveau 4, désormais reconnu dans une phrase complète"},
      {"left": "verb-first-sentence", "right": "la forme habituelle de la phrase arabe : le verbe vient en premier, son sujet est souvent sous-entendu, comme dans lam yalid (« Il n''a pas engendré »)"},
      {"left": "particle-maa", "right": "maa (« ce que ») -- un mot séparé qui transforme un verbe en description de son objet, comme dans maa khalaqa (« ce qu''Il a créé »)"}
    ]}'::jsonb
  END
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'recognizing-past-tense-verbs';

-- -------------------------------------------------------------------------
-- 3.2 Lesson: guided-decomposition-al-falaq-2 (capstone -- pure synthesis,
--     zero new review items, mirroring Level 4 Batch 2's capstone).
-- -------------------------------------------------------------------------

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'guided-decomposition-al-falaq-2', 'Guided Decomposition: Sūrah Al-Falaq, Āyah 2', 'Décomposition guidée : sourate Al-Falaq, verset 2', 1, 6
FROM public.modules WHERE slug = 'verbal-sentences-past';

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', 'Guided Decomposition: Sūrah Al-Falaq, Āyah 2' FROM public.lessons WHERE slug = 'guided-decomposition-al-falaq-2';
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', 'Décomposition guidée : sourate Al-Falaq, verset 2' FROM public.lessons WHERE slug = 'guided-decomposition-al-falaq-2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'You now know every piece needed to decompose a real, authentic ayah entirely on your own. Let''s put it all together with min sharri maa khalaqa (Al-Falaq, 113:2), word by word.',
  'Vous connaissez maintenant tous les éléments nécessaires pour décomposer entièrement par vous-même un verset authentique. Assemblons le tout avec min sharri maa khalaqa (Al-Falaq, 113:2), mot par mot.'
FROM public.lessons WHERE slug = 'guided-decomposition-al-falaq-2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, surah_number, ayah_number, body_en, body_fr)
SELECT id, 1, 'quran_example', 113, 2,
  'min -- ''from'', an independent preposition. sharri -- ''evil'', a noun, already known. maa -- ''what/that which'', introducing a description. khalaqa -- ''He created'', a past-tense verb, subject implied. Together: ''from the evil of what He created.''',
  'min -- « de/depuis », une préposition indépendante. sharri -- « le mal », un nom déjà connu. maa -- « ce que », introduisant une description. khalaqa -- « Il a créé », un verbe au passé, sujet sous-entendu. Ensemble : « du mal de ce qu''Il a créé ».'
FROM public.lessons WHERE slug = 'guided-decomposition-al-falaq-2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'tip',
  'Decomposition is simply naming each piece you already know -- prepositions, prefixes, nouns, and verbs -- in the order they actually appear, not translating word-for-word into English/French word order.',
  'La décomposition consiste simplement à nommer chaque élément que vous connaissez déjà -- prépositions, préfixes, noms et verbes -- dans l''ordre où ils apparaissent réellement, sans les traduire mot à mot dans l''ordre du français.'
FROM public.lessons WHERE slug = 'guided-decomposition-al-falaq-2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  'You have completed Level 5 Batch 1! You can recognize wa-, al-, bi-, li-, fī, min, and ʿalā, identify a past-tense verb and the verb-first sentence shape, and decompose a short authentic ayah piece by piece.',
  'Vous avez terminé le Lot 1 du Niveau 5 ! Vous pouvez reconnaître wa-, al-, bi-, li-, fī, min et ʿalā, identifier un verbe au passé et la forme verbe-en-premier, et décomposer un court verset authentique pièce par pièce.'
FROM public.lessons WHERE slug = 'guided-decomposition-al-falaq-2';

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'en', s.body_en FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'guided-decomposition-al-falaq-2';
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'fr', s.body_fr FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'guided-decomposition-al-falaq-2';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, surah_number, ayah_number, review_item_type)
SELECT l.id, 0, 'reading_check', a.arabic_text || ' reads:', a.arabic_text || ' se lit :',
  '{"choices": ["min sharri maa khalaqa", "min sharri maa yakhluqu", "''an sharri maa khalaqa"], "correctIndex": 0}'::jsonb,
  113, 2, 'concept'
FROM public.lessons l, public.ayahs a
WHERE l.slug = 'guided-decomposition-al-falaq-2' AND a.surah_number = 113 AND a.ayah_number = 2;

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'multiple_choice',
  'Which word means ''evil'' in this ayah?',
  'Quel mot signifie « le mal » dans ce verset ?',
  '{"choices": ["sharri", "khalaqa", "maa"], "correctIndex": 0}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'guided-decomposition-al-falaq-2';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'true_false',
  'khalaqa in this ayah is a command, not a completed action.',
  'khalaqa dans ce verset est un ordre, et non une action accomplie.',
  '{"correctAnswer": false}'::jsonb, 'concept'
FROM public.lessons WHERE slug = 'guided-decomposition-al-falaq-2';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'en', e.prompt_en, e.payload FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'guided-decomposition-al-falaq-2';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, payload)
SELECT e.id, 'fr', e.prompt_fr,
  CASE e.order_index
    WHEN 0 THEN '{"choices": ["min sharri maa khalaqa", "min sharri maa yakhluqu", "''an sharri maa khalaqa"], "correctIndex": 0}'::jsonb
    WHEN 1 THEN '{"choices": ["sharri", "khalaqa", "maa"], "correctIndex": 0}'::jsonb
    WHEN 2 THEN '{"correctAnswer": false}'::jsonb
  END
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'guided-decomposition-al-falaq-2';

-- =========================================================================
-- 4. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_level_id uuid;
  v_module_count integer;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_matching_count integer;
  v_wf_count integer;
  v_l1_lesson_count integer;
  v_l2_lesson_count integer;
  v_l3_lesson_count integer;
  v_l4_lesson_count integer;
  v_l6_id uuid;
  v_l6_slug text;
  v_l6_modules integer;
  v_module_count_total integer;
  v_lesson_count_total integer;
  v_section_count_total integer;
  v_exercise_count_total integer;
  v_level_tr_en text;
  v_level_tr_fr text;
  v_bad_locale_count integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE slug = 'guided-ayah-comprehension';
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Expected guided-ayah-comprehension level to exist after this migration.';
  END IF;

  SELECT count(*) INTO v_module_count FROM public.modules WHERE level_id = v_level_id;
  IF v_module_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 modules under guided-ayah-comprehension, found %.', v_module_count;
  END IF;

  SELECT count(*) INTO v_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id WHERE m.level_id = v_level_id;
  IF v_lesson_count <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 lessons under guided-ayah-comprehension, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections s
  JOIN public.lessons l ON l.id = s.lesson_id
  JOIN public.modules m ON m.id = l.module_id WHERE m.level_id = v_level_id;
  IF v_section_count <> 22 THEN
    RAISE EXCEPTION 'Expected exactly 22 lesson_sections under guided-ayah-comprehension, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  JOIN public.modules m ON m.id = l.module_id WHERE m.level_id = v_level_id;
  IF v_exercise_count <> 14 THEN
    RAISE EXCEPTION 'Expected exactly 14 lesson_exercises under guided-ayah-comprehension, found %.', v_exercise_count;
  END IF;

  SELECT count(*) INTO v_matching_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.level_id = v_level_id AND e.exercise_type = 'matching';
  IF v_matching_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 matching exercises under guided-ayah-comprehension, found %.', v_matching_count;
  END IF;

  -- Zero matching exercises in the pure-synthesis capstone lesson.
  IF EXISTS (
    SELECT 1 FROM public.lesson_exercises e
    JOIN public.lessons l ON l.id = e.lesson_id
    WHERE l.slug = 'guided-decomposition-al-falaq-2' AND e.exercise_type = 'matching'
  ) THEN
    RAISE EXCEPTION 'Expected zero matching exercises in guided-decomposition-al-falaq-2.';
  END IF;

  -- Every EN/FR normalized translation exists for every new row, and no
  -- unexpected ar/ur/id row was introduced anywhere in this level.
  SELECT count(*) INTO v_bad_locale_count FROM public.module_translations mt
  JOIN public.modules m ON m.id = mt.module_id
  WHERE m.level_id = v_level_id AND mt.locale NOT IN ('en', 'fr');
  IF v_bad_locale_count <> 0 THEN
    RAISE EXCEPTION 'Expected zero non-en/fr module_translations rows, found %.', v_bad_locale_count;
  END IF;

  IF (SELECT count(DISTINCT mt.locale) FROM public.module_translations mt
      JOIN public.modules m ON m.id = mt.module_id WHERE m.level_id = v_level_id) <> 2 THEN
    RAISE EXCEPTION 'Expected exactly en+fr module_translations coverage under guided-ayah-comprehension.';
  END IF;

  IF (SELECT count(*) FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      WHERE m.level_id = v_level_id
      AND (SELECT count(*) FROM public.lesson_translations lt WHERE lt.lesson_id = l.id AND lt.locale IN ('en','fr')) <> 2
     ) <> 0 THEN
    RAISE EXCEPTION 'Expected every Level 5 Batch 1 lesson to have exactly en+fr lesson_translations rows.';
  END IF;

  IF (SELECT count(*) FROM public.lesson_sections s
      JOIN public.lessons l ON l.id = s.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      WHERE m.level_id = v_level_id
      AND (SELECT count(*) FROM public.lesson_section_translations st WHERE st.section_id = s.id AND st.locale IN ('en','fr')) <> 2
     ) <> 0 THEN
    RAISE EXCEPTION 'Expected every Level 5 Batch 1 section to have exactly en+fr lesson_section_translations rows.';
  END IF;

  IF (SELECT count(*) FROM public.lesson_exercises e
      JOIN public.lessons l ON l.id = e.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      WHERE m.level_id = v_level_id
      AND (SELECT count(*) FROM public.lesson_exercise_translations et WHERE et.exercise_id = e.id AND et.locale IN ('en','fr')) <> 2
     ) <> 0 THEN
    RAISE EXCEPTION 'Expected every Level 5 Batch 1 exercise to have exactly en+fr lesson_exercise_translations rows.';
  END IF;

  -- level_translations updated in place, not duplicated.
  SELECT title INTO v_level_tr_en FROM public.level_translations WHERE level_id = v_level_id AND locale = 'en';
  SELECT title INTO v_level_tr_fr FROM public.level_translations WHERE level_id = v_level_id AND locale = 'fr';
  IF v_level_tr_en IS DISTINCT FROM 'Guided Āyah Comprehension' THEN
    RAISE EXCEPTION 'Expected level_translations en title to be updated, found %.', v_level_tr_en;
  END IF;
  IF v_level_tr_fr IS DISTINCT FROM 'Compréhension guidée des versets' THEN
    RAISE EXCEPTION 'Expected level_translations fr title to be updated, found %.', v_level_tr_fr;
  END IF;
  IF (SELECT count(*) FROM public.level_translations WHERE level_id = v_level_id) <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 level_translations rows (en, fr) for guided-ayah-comprehension, found %.',
      (SELECT count(*) FROM public.level_translations WHERE level_id = v_level_id);
  END IF;

  -- levels.number=6 (quranic-comprehension) must be completely untouched.
  SELECT id, slug INTO v_l6_id, v_l6_slug FROM public.levels WHERE number = 6;
  IF v_l6_slug <> 'quranic-comprehension' THEN
    RAISE EXCEPTION 'Expected levels.number=6 to remain quranic-comprehension, found %.', v_l6_slug;
  END IF;
  SELECT count(*) INTO v_l6_modules FROM public.modules WHERE level_id = v_l6_id;
  IF v_l6_modules <> 0 THEN
    RAISE EXCEPTION 'Expected levels.number=6 to remain at zero modules, found %.', v_l6_modules;
  END IF;

  -- word_frequency must remain at exactly 20 rows -- no new vocabulary added.
  SELECT count(*) INTO v_wf_count FROM public.word_frequency;
  IF v_wf_count <> 20 THEN
    RAISE EXCEPTION 'Expected word_frequency to remain at exactly 20 rows, found %.', v_wf_count;
  END IF;

  -- Levels 1-4 untouched.
  SELECT count(*) INTO v_l1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.levels lv ON lv.id = m.level_id WHERE lv.slug = 'foundations-of-arabic-script';
  IF v_l1_lesson_count <> 33 THEN
    RAISE EXCEPTION 'Expected Level 1 to remain untouched at 33 lessons, found %.', v_l1_lesson_count;
  END IF;

  SELECT count(*) INTO v_l2_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.levels lv ON lv.id = m.level_id WHERE lv.slug = 'basic-vocabulary-and-patterns';
  IF v_l2_lesson_count <> 10 THEN
    RAISE EXCEPTION 'Expected Level 2 to remain untouched at 10 lessons, found %.', v_l2_lesson_count;
  END IF;

  SELECT count(*) INTO v_l3_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.levels lv ON lv.id = m.level_id WHERE lv.slug = 'roots-and-word-patterns';
  IF v_l3_lesson_count <> 4 THEN
    RAISE EXCEPTION 'Expected Level 3 to remain untouched at 4 lessons, found %.', v_l3_lesson_count;
  END IF;

  SELECT count(*) INTO v_l4_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.levels lv ON lv.id = m.level_id WHERE lv.slug = 'core-grammar';
  IF v_l4_lesson_count <> 4 THEN
    RAISE EXCEPTION 'Expected Level 4 to remain untouched at 4 lessons, found %.', v_l4_lesson_count;
  END IF;

  -- Global totals: +2 modules, +4 lessons, +22 sections, +14 exercises.
  SELECT count(*) INTO v_module_count_total FROM public.modules;
  IF v_module_count_total <> 21 THEN
    RAISE EXCEPTION 'Expected exactly 21 modules total after this migration, found %.', v_module_count_total;
  END IF;
  SELECT count(*) INTO v_lesson_count_total FROM public.lessons;
  IF v_lesson_count_total <> 55 THEN
    RAISE EXCEPTION 'Expected exactly 55 lessons total after this migration, found %.', v_lesson_count_total;
  END IF;
  SELECT count(*) INTO v_section_count_total FROM public.lesson_sections;
  IF v_section_count_total <> 284 THEN
    RAISE EXCEPTION 'Expected exactly 284 lesson_sections total after this migration, found %.', v_section_count_total;
  END IF;
  SELECT count(*) INTO v_exercise_count_total FROM public.lesson_exercises;
  IF v_exercise_count_total <> 226 THEN
    RAISE EXCEPTION 'Expected exactly 226 lesson_exercises total after this migration, found %.', v_exercise_count_total;
  END IF;

  RAISE NOTICE 'Level 5 Batch 1 migration post-insert assertions passed: % modules, % lessons, % sections, % exercises (% matching).',
    v_module_count, v_lesson_count, v_section_count, v_exercise_count, v_matching_count;
END $$;

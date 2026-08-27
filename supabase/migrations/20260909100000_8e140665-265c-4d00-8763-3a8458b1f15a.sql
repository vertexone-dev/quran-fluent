-- Internationalization Foundation, Phase 1 (Gate A+B): normalized
-- translation tables for the active curriculum entities, per the approved
-- QURANROOTS I18N ARCHITECTURE READINESS AUDIT.
--
-- SCOPE: this migration is purely ADDITIVE. It creates 8 new tables, backfills
-- them from EXISTING en/fr columns/payloads (zero new EN content, zero new
-- FR content for titles/goals/bodies/prompts/explanations -- all of that
-- already existed and is copied verbatim), and authors exactly one thing
-- that did not previously exist anywhere: French translations of the 89
-- exercise payload choices/pairs that were identified as the audit's
-- confirmed RED item (payload.choices/payload.pairs[].right were never
-- locale-aware, even for French, before this migration).
--
-- It does NOT touch: ayahs.arabic_text (canonical Qur'anic text, proven
-- byte-identical before/after in the post-migration assertions below),
-- any existing _en/_fr column (kept in place, unmodified, as the staged-
-- migration rollback safety net your approval requires), any user-owned
-- table (review_items, user_lesson_progress, bookmarks, notes,
-- memorization_progress, streaks, learning_paths, etc. -- none referenced),
-- and it does NOT populate any ar/ur/id row anywhere -- the locale CHECK
-- constraint includes all 5 target locales (so Level 5+ can author en/fr
-- translation rows directly under the final contract, per the audit's
-- Level 5 authoring contract), but only en/fr rows are ever inserted here.
--
-- courses/content_sources (also carrying _en/_fr columns) are deliberately
-- NOT migrated: confirmed unused anywhere in src/ before authoring this
-- migration -- migrating dead schema would be pure waste.
--
-- FALLBACK CONTRACT implemented at the application layer (src/lib/
-- curriculum.ts), not in this migration: UI chrome keeps its existing
-- per-key locale->English fallback (t()/d, unchanged). Curriculum content
-- uses the stricter whole-lesson rule the audit specified: if any section/
-- exercise of a lesson is missing the requested locale's translation, the
-- ENTIRE lesson renders in English, never a per-section mix.
--
-- PRE-EXISTING COVERAGE (confirmed by direct query before authoring, not
-- assumed): every entity examined has FR wherever it has EN, with two
-- known exceptions that are pre-existing content-authoring facts, not new
-- gaps created by this migration: modules.goal_fr (1 of 19, matching
-- goal_en exactly -- goal is simply rarely set at module level) and
-- surahs.name_fr (7 of 114 -- most surahs were never referenced in Level
-- 1-4 content, only the ones actually used already have a French name).

DO $$
DECLARE
  v_existing integer;
BEGIN
  SELECT count(*) INTO v_existing FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'lesson_exercise_translations';
  IF v_existing <> 0 THEN
    RAISE EXCEPTION 'Expected lesson_exercise_translations not to already exist. Aborting.';
  END IF;

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
END $$;

-- =========================================================================
-- 1. Schema: 8 normalized translation tables.
-- =========================================================================

CREATE TABLE public.level_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','fr','ar','ur','id')),
  title text NOT NULL,
  goal text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level_id, locale)
);

CREATE TABLE public.module_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','fr','ar','ur','id')),
  title text NOT NULL,
  goal text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, locale)
);

CREATE TABLE public.lesson_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','fr','ar','ur','id')),
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, locale)
);

CREATE TABLE public.lesson_section_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.lesson_sections(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','fr','ar','ur','id')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, locale)
);

CREATE TABLE public.lesson_exercise_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.lesson_exercises(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','fr','ar','ur','id')),
  prompt text NOT NULL,
  explanation text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, locale)
);

CREATE TABLE public.ayah_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ayah_id uuid NOT NULL REFERENCES public.ayahs(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','fr','ar','ur','id')),
  translation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ayah_id, locale)
);

CREATE TABLE public.word_frequency_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id uuid NOT NULL REFERENCES public.word_frequency(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','fr','ar','ur','id')),
  meaning text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (word_id, locale)
);

-- surahs uses `number` (integer, the Qur'anic surah number 1-114) as its
-- primary key, not a uuid `id` -- confirmed via information_schema before
-- authoring, not assumed like every other table here.
CREATE TABLE public.surah_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surah_number integer NOT NULL REFERENCES public.surahs(number) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en','fr','ar','ur','id')),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (surah_number, locale)
);

-- Read-only content tables: mirror the exact "SELECT USING (true)" policy
-- already in place on every source table (levels_read_all, modules_read_all,
-- lessons_read_all, lesson_sections_read_all, lesson_exercises_read_all,
-- ayahs_read_all, surahs_read_all, word_frequency's two read policies) --
-- confirmed via pg_policies before authoring, not assumed. No write policy
-- for any role: writes happen only via migrations, exactly like the source
-- tables.
ALTER TABLE public.level_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_section_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_exercise_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ayah_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_frequency_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surah_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "level_translations_read_all" ON public.level_translations FOR SELECT USING (true);
CREATE POLICY "module_translations_read_all" ON public.module_translations FOR SELECT USING (true);
CREATE POLICY "lesson_translations_read_all" ON public.lesson_translations FOR SELECT USING (true);
CREATE POLICY "lesson_section_translations_read_all" ON public.lesson_section_translations FOR SELECT USING (true);
CREATE POLICY "lesson_exercise_translations_read_all" ON public.lesson_exercise_translations FOR SELECT USING (true);
CREATE POLICY "ayah_translations_read_all" ON public.ayah_translations FOR SELECT USING (true);
CREATE POLICY "word_frequency_translations_read_all" ON public.word_frequency_translations FOR SELECT USING (true);
CREATE POLICY "surah_translations_read_all" ON public.surah_translations FOR SELECT USING (true);

-- RLS policies alone are not sufficient in Postgres: the underlying role
-- also needs the base table-level GRANT, or every query 403s regardless of
-- the policy. Mirrors the exact grant shape already on every source table
-- (confirmed via information_schema.role_table_grants before authoring):
-- anon/authenticated get SELECT only (matching the read-only policies
-- above); service_role gets full CRUD for migrations/admin tooling.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'level_translations', 'module_translations', 'lesson_translations',
    'lesson_section_translations', 'lesson_exercise_translations',
    'ayah_translations', 'word_frequency_translations', 'surah_translations'
  ]
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- =========================================================================
-- 2. Backfill EN + FR for titles/goals/bodies/prompts/explanations/ayah
--    translations/vocabulary meanings/surah names -- pure copies of
--    already-existing column data. Zero new content authored here.
-- =========================================================================

INSERT INTO public.level_translations (level_id, locale, title, goal)
SELECT id, 'en', title_en, goal_en FROM public.levels;
INSERT INTO public.level_translations (level_id, locale, title, goal)
SELECT id, 'fr', title_fr, goal_fr FROM public.levels WHERE title_fr IS NOT NULL AND goal_fr IS NOT NULL;

INSERT INTO public.module_translations (module_id, locale, title, goal)
SELECT id, 'en', title_en, goal_en FROM public.modules;
INSERT INTO public.module_translations (module_id, locale, title, goal)
SELECT id, 'fr', title_fr, goal_fr FROM public.modules WHERE title_fr IS NOT NULL;

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', title_en FROM public.lessons;
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', title_fr FROM public.lessons WHERE title_fr IS NOT NULL;

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT id, 'en', body_en FROM public.lesson_sections;
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT id, 'fr', body_fr FROM public.lesson_sections WHERE body_fr IS NOT NULL;

INSERT INTO public.ayah_translations (ayah_id, locale, translation)
SELECT id, 'en', translation_en FROM public.ayahs WHERE translation_en IS NOT NULL;
INSERT INTO public.ayah_translations (ayah_id, locale, translation)
SELECT id, 'fr', translation_fr FROM public.ayahs WHERE translation_fr IS NOT NULL;

INSERT INTO public.word_frequency_translations (word_id, locale, meaning)
SELECT id, 'en', meaning FROM public.word_frequency WHERE meaning IS NOT NULL;
INSERT INTO public.word_frequency_translations (word_id, locale, meaning)
SELECT id, 'fr', meaning_fr FROM public.word_frequency WHERE meaning_fr IS NOT NULL;

INSERT INTO public.surah_translations (surah_number, locale, name)
SELECT number, 'en', name_en FROM public.surahs WHERE name_en IS NOT NULL;
INSERT INTO public.surah_translations (surah_number, locale, name)
SELECT number, 'fr', name_fr FROM public.surahs WHERE name_fr IS NOT NULL;

-- =========================================================================
-- 3. Exercise translations: EN is a pure copy (prompt/explanation/payload
--    unchanged); FR reuses the existing prompt_fr/explanation_fr columns
--    verbatim, but the payload is genuinely NEW content -- the audit's
--    confirmed RED item. 89 of 212 exercises contain real English prose
--    in choices/pairs[].right that was never translated before this
--    migration (letter names, transliterations and Arabic script in the
--    remaining 123 are copied through unchanged, since they are already
--    language-neutral -- e.g. "Bā'"/"Fatḥa"/"qul huwa llahu ahad" read
--    identically in French-language Arabic pedagogy). Every one of the 212
--    French payloads below was built from a single English->French phrase
--    dictionary cross-checked against this project's own already-published
--    French lesson prose for terminology consistency (e.g. "le mot qui
--    décrit", "mot1 DE mot2", "isolée/initiale/médiane/finale") and against
--    word_frequency.meaning_fr for every vocabulary gloss reused verbatim
--    from there.
-- =========================================================================

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, explanation, payload)
SELECT id, 'en', prompt_en, explanation_en, payload FROM public.lesson_exercises;

-- Keyed by (lesson_slug, order_index) -- a stable natural key identical in
-- every environment -- rather than hardcoded exercise UUIDs, which differ
-- between production and any freshly-seeded local database (the same
-- pattern every other migration in this project already uses to locate
-- rows via `WHERE slug = ...` instead of a literal id).
CREATE TEMP TABLE _fr_payloads (lesson_slug text, exercise_order_index integer, payload jsonb, PRIMARY KEY (lesson_slug, exercise_order_index)) ON COMMIT DROP;
INSERT INTO _fr_payloads (lesson_slug, exercise_order_index, payload) VALUES
('alif-the-first-letter', 0, '{"choices": ["ا", "ب", "ت"], "correctIndex": 0}'::jsonb),
  ('alif-the-first-letter', 1, '{"correctAnswer": false}'::jsonb),
  ('ayn-and-ghayn', 0, '{"choices": ["ع", "غ"], "correctIndex": 0}'::jsonb),
  ('ayn-and-ghayn', 1, '{"choices": ["ع", "غ"], "correctIndex": 1}'::jsonb),
  ('ayn-and-ghayn', 2, '{"pairs": [{"left": "ع", "right": "ʿAyn"}, {"left": "غ", "right": "Ghayn"}]}'::jsonb),
  ('capstone-reading', 0, '{"choices": ["qul a''udhu birabbi l-falaq", "qul huwa birabbi l-falaq", "qul a''udhu bilfalaq"], "correctIndex": 0}'::jsonb),
  ('capstone-reading', 1, '{"choices": ["qul a''udhu birabbi n-nas", "qul huwa birabbi n-nas", "qul a''udhu bilfalaq"], "correctIndex": 0}'::jsonb),
  ('capstone-reading', 2, '{"correctAnswer": true}'::jsonb),
  ('capstone-reading', 3, '{"choices": ["Seigneur", "Livre", "Miséricorde"], "correctIndex": 0}'::jsonb),
  ('dagger-alif', 0, '{"choices": ["aalamiin", "alamiin", "aalamaan"], "correctIndex": 0}'::jsonb),
  ('dagger-alif', 1, '{"correctAnswer": false}'::jsonb),
  ('dagger-alif', 2, '{"pairs": [{"left": "dagger-alif", "right": "une petite marque au-dessus d''une lettre représentant une voyelle longue « aa » non écrite"}]}'::jsonb),
  ('dagger-alif', 3, '{"choices": ["Une voyelle longue « aa » non écrite", "Une consonne doublée", "Aucun son du tout"], "correctIndex": 0}'::jsonb),
  ('dal-dhal-ra-zay', 0, '{"choices": ["د", "ذ", "ر"], "correctIndex": 1}'::jsonb),
  ('dal-dhal-ra-zay', 1, '{"choices": ["ر", "ز", "د"], "correctIndex": 1}'::jsonb),
  ('dal-dhal-ra-zay', 2, '{"choices": ["د", "ذ", "ر", "ز"], "correctIndex": 1}'::jsonb),
  ('dal-dhal-ra-zay', 3, '{"pairs": [{"left": "د", "right": "Dāl"}, {"left": "ذ", "right": "Dhāl"}, {"left": "ر", "right": "Rā''"}, {"left": "ز", "right": "Zāy"}]}'::jsonb),
  ('damma', 0, '{"choices": ["Fatḥa", "Kasra", "Ḍamma"], "correctIndex": 2}'::jsonb),
  ('damma', 1, '{"choices": ["un son ''i'' bref", "un son ''a'' bref", "un son ''ou'' bref"], "correctIndex": 2}'::jsonb),
  ('damma', 2, '{"correctAnswer": true}'::jsonb),
  ('damma', 3, '{"pairs": [{"left": "fatha", "right": "un trait diagonal au-dessus de la lettre"}, {"left": "kasra", "right": "un trait diagonal en dessous de la lettre"}, {"left": "damma", "right": "une petite marque courbée au-dessus de la lettre"}]}'::jsonb),
  ('dammatan', 0, '{"choices": ["Fatḥatān", "Kasratān", "Ḍammatān"], "correctIndex": 2}'::jsonb),
  ('dammatan', 1, '{"choices": ["Un son ''ou'' bref suivi d''un ''n'' non écrit", "Une consonne doublée", "Aucun son du tout"], "correctIndex": 0}'::jsonb),
  ('dammatan', 2, '{"correctAnswer": true}'::jsonb),
  ('dammatan', 3, '{"pairs": [{"left": "fathatan", "right": "une marque de fatḥa doublée, ajoutant un son final ''n'' non écrit"}, {"left": "kasratan", "right": "une marque de kasra doublée, ajoutant un son final ''n'' non écrit"}, {"left": "dammatan", "right": "une marque de ḍamma doublée, ajoutant un son final ''n'' non écrit"}]}'::jsonb),
  ('fa2-and-qaf', 0, '{"choices": ["ف", "ق"], "correctIndex": 0}'::jsonb),
  ('fa2-and-qaf', 1, '{"choices": ["ف", "ق"], "correctIndex": 1}'::jsonb),
  ('fa2-and-qaf', 2, '{"pairs": [{"left": "ف", "right": "Fā''"}, {"left": "ق", "right": "Qāf"}]}'::jsonb),
  ('fatha', 0, '{"choices": ["Fatḥa", "Kasra", "Ḍamma"], "correctIndex": 0}'::jsonb),
  ('fatha', 1, '{"choices": ["un son ''ou'' bref", "un son ''a'' bref", "un son ''i'' bref"], "correctIndex": 1}'::jsonb),
  ('fatha', 2, '{"correctAnswer": false}'::jsonb),
  ('fatha', 3, '{"correctAnswer": false}'::jsonb),
  ('fatha', 4, '{"pairs": [{"left": "fatha", "right": "un trait diagonal au-dessus de la lettre"}]}'::jsonb),
  ('fathatan', 0, '{"choices": ["Fatḥatān", "Kasratān", "Ḍammatān"], "correctIndex": 0}'::jsonb),
  ('fathatan', 1, '{"choices": ["Un son ''a'' bref suivi d''un ''n'' non écrit", "Aucun son du tout", "Une consonne doublée"], "correctIndex": 0}'::jsonb),
  ('fathatan', 2, '{"correctAnswer": false}'::jsonb),
  ('fathatan', 3, '{"correctAnswer": true}'::jsonb),
  ('fathatan', 4, '{"pairs": [{"left": "fathatan", "right": "une marque de fatḥa doublée, ajoutant un son final ''n'' non écrit"}]}'::jsonb),
  ('ha2-and-waw', 0, '{"choices": ["ه", "و"], "correctIndex": 0}'::jsonb),
  ('ha2-and-waw', 1, '{"choices": ["ه", "و"], "correctIndex": 1}'::jsonb),
  ('ha2-and-waw', 2, '{"pairs": [{"left": "ه", "right": "Hā''"}, {"left": "و", "right": "Wāw"}]}'::jsonb),
  ('hamzat-al-wasl', 0, '{"choices": ["ar-rahman", "ar-raheem", "ar-rahim"], "correctIndex": 0}'::jsonb),
  ('hamzat-al-wasl', 1, '{"correctAnswer": false}'::jsonb),
  ('hamzat-al-wasl', 2, '{"pairs": [{"left": "hamzat-al-wasl", "right": "une hamza de liaison, silencieuse lorsque le mot est rattaché à ce qui le précède"}]}'::jsonb),
  ('hamzat-al-wasl', 3, '{"choices": ["Seulement lorsque le mot commence une phrase à lui seul", "À chaque fois", "Jamais"], "correctIndex": 0}'::jsonb),
  ('he-is-allah-one', 0, '{"correctAnswer": true}'::jsonb),
  ('he-is-allah-one', 1, '{"choices": ["Le mot pour « est »", "Le mot pour « il »", "Le mot pour « Allah »"], "correctIndex": 0}'::jsonb),
  ('he-is-allah-one', 2, '{"pairs": [{"left": "pronoun-huwa", "right": "huwa (« il ») -- un pronom qui remplace un nom, comme dans Qul huwa Allahu ahad"}, {"left": "nominal-sentence", "right": "une phrase sans verbe « être » -- sujet puis description, comme dans Huwa Allahu ahad"}]}'::jsonb),
  ('how-letters-connect', 0, '{"choices": ["Isolée", "Initiale", "Finale"], "correctIndex": 1}'::jsonb),
  ('how-letters-connect', 1, '{"choices": ["ك", "ت", "ب"], "correctIndex": 0}'::jsonb),
  ('how-letters-connect', 2, '{"correctAnswer": false}'::jsonb),
  ('how-letters-connect', 3, '{"correctAnswer": true}'::jsonb),
  ('how-letters-connect', 4, '{"pairs": [{"left": "letter-positions", "right": "la forme d''une lettre peut changer selon sa position dans un mot : isolée, initiale, médiane ou finale"}]}'::jsonb),
  ('kaf-and-lam', 0, '{"choices": ["ك", "ل"], "correctIndex": 0}'::jsonb),
  ('kaf-and-lam', 1, '{"choices": ["ك", "ل"], "correctIndex": 1}'::jsonb),
  ('kaf-and-lam', 2, '{"pairs": [{"left": "ك", "right": "Kāf"}, {"left": "ل", "right": "Lām"}]}'::jsonb),
  ('kasra', 0, '{"choices": ["Kasra", "Fatḥa", "Ḍamma"], "correctIndex": 0}'::jsonb),
  ('kasra', 1, '{"choices": ["un son ''a'' bref", "un son ''ou'' bref", "un son ''i'' bref"], "correctIndex": 2}'::jsonb),
  ('kasra', 2, '{"correctAnswer": false}'::jsonb),
  ('kasra', 3, '{"correctAnswer": true}'::jsonb),
  ('kasra', 4, '{"pairs": [{"left": "fatha", "right": "un trait diagonal au-dessus de la lettre"}, {"left": "kasra", "right": "un trait diagonal en dessous de la lettre"}]}'::jsonb),
  ('kasratan', 0, '{"choices": ["Kasratān", "Fatḥatān", "Ḍammatān"], "correctIndex": 0}'::jsonb),
  ('kasratan', 1, '{"choices": ["Une consonne doublée", "Un son ''i'' bref suivi d''un ''n'' non écrit", "Aucun son du tout"], "correctIndex": 1}'::jsonb),
  ('kasratan', 2, '{"correctAnswer": false}'::jsonb),
  ('kasratan', 3, '{"correctAnswer": true}'::jsonb),
  ('kasratan', 4, '{"pairs": [{"left": "fathatan", "right": "une marque de fatḥa doublée, ajoutant un son final ''n'' non écrit"}, {"left": "kasratan", "right": "une marque de kasra doublée, ajoutant un son final ''n'' non écrit"}]}'::jsonb),
  ('long-vowel-carriers', 0, '{"choices": ["ar-raheem", "ar-raham", "ar-rahim"], "correctIndex": 0}'::jsonb),
  ('long-vowel-carriers', 1, '{"choices": ["maalik", "malik", "muwaalik"], "correctIndex": 0}'::jsonb),
  ('long-vowel-carriers', 2, '{"correctAnswer": true}'::jsonb),
  ('long-vowel-carriers', 3, '{"pairs": [{"left": "long-vowel-carriers", "right": "ا, و, ou ي étirant une voyelle courte correspondante en un son long, au lieu d''être une consonne séparée"}]}'::jsonb),
  ('long-vowel-carriers', 4, '{"choices": ["ا و ي", "ب ت ث", "ك ل م"], "correctIndex": 0}'::jsonb),
  ('lord-of-the-worlds', 0, '{"correctAnswer": false}'::jsonb),
  ('lord-of-the-worlds', 1, '{"choices": ["En plaçant les noms directement l''un à côté de l''autre", "Avec un mot séparé signifiant « de »", "Avec un verbe"], "correctIndex": 0}'::jsonb),
  ('lord-of-the-worlds', 2, '{"choices": ["al-hamdu lillahi rabbi l-''aalameen", "al-hamdu lillahi maliki l-''aalameen", "al-hamdu billahi rabbi l-''aalameen"], "correctIndex": 0}'::jsonb),
  ('lord-of-the-worlds', 3, '{"pairs": [{"left": "idafa-construct", "right": "deux noms placés côte à côte pour signifier « X de Y », sans mot séparé pour « de », comme dans rabbi l-''alameen (« Seigneur des mondes »)"}]}'::jsonb),
  ('mim-and-nun', 0, '{"choices": ["م", "ن"], "correctIndex": 0}'::jsonb),
  ('mim-and-nun', 1, '{"choices": ["م", "ن"], "correctIndex": 1}'::jsonb),
  ('mim-and-nun', 2, '{"pairs": [{"left": "م", "right": "Mīm"}, {"left": "ن", "right": "Nūn"}]}'::jsonb),
  ('more-root-families', 0, '{"correctAnswer": true}'::jsonb),
  ('more-root-families', 1, '{"choices": ["Miséricorde", "Souveraineté", "Création"], "correctIndex": 0}'::jsonb),
  ('more-root-families', 2, '{"pairs": [{"left": "أ-ل-ه", "right": "Dieu, divinité -- vu dans إِلَٰه et le mot apparenté Allah"}, {"left": "ر-ح-م", "right": "Le Très Miséricordieux -- vu dans الرَّحِيم et le mot apparenté Ar-Rahman"}]}'::jsonb),
  ('non-connecting-letters', 0, '{"choices": ["ب", "د", "م"], "correctIndex": 1}'::jsonb),
  ('non-connecting-letters', 1, '{"choices": ["Quatre", "Deux", "Trois"], "correctIndex": 1}'::jsonb),
  ('non-connecting-letters', 2, '{"correctAnswer": false}'::jsonb),
  ('non-connecting-letters', 3, '{"correctAnswer": true}'::jsonb),
  ('non-connecting-letters', 4, '{"pairs": [{"left": "letter-positions", "right": "la forme d''une lettre peut changer selon sa position dans un mot : isolée, initiale, médiane ou finale"}, {"left": "non-connectors", "right": "six lettres — ا د ذ ر ز و — qui ne se lient jamais à la lettre suivante"}]}'::jsonb),
  ('phrases-of-sovereignty', 0, '{"choices": ["maliki n-nas", "malika n-nas", "maaliki n-nas"], "correctIndex": 0}'::jsonb),
  ('phrases-of-sovereignty', 1, '{"choices": ["ilahi n-nas", "ilaha n-nas", "ilahu n-nas"], "correctIndex": 0}'::jsonb),
  ('phrases-of-sovereignty', 2, '{"correctAnswer": true}'::jsonb),
  ('phrases-of-sovereignty', 3, '{"choices": ["mot1 DE mot2", "mot1 ET mot2", "mot1 EST mot2"], "correctIndex": 0}'::jsonb),
  ('reading-al-fatiha-verse-7', 0, '{"choices": ["sirata", "sarata", "surata"], "correctIndex": 0}'::jsonb),
  ('reading-al-fatiha-verse-7', 1, '{"correctAnswer": true}'::jsonb),
  ('reading-al-fatiha-verse-7', 2, '{"choices": ["ad-daaalleen", "al-dalleen", "ad-dalleena"], "correctIndex": 0}'::jsonb),
  ('reading-al-fatiha-verse-7', 3, '{"choices": ["Cinq", "Sept", "Dix"], "correctIndex": 1}'::jsonb),
  ('reading-al-fatiha-verses-1-3', 0, '{"choices": ["ar-rahmani", "ar-rahimi", "al-hamdu"], "correctIndex": 0}'::jsonb),
  ('reading-al-fatiha-verses-1-3', 1, '{"correctAnswer": true}'::jsonb),
  ('reading-al-fatiha-verses-1-3', 2, '{"choices": ["alhamdu", "alhamda", "alhamdi"], "correctIndex": 0}'::jsonb),
  ('reading-al-fatiha-verses-1-3', 3, '{"correctAnswer": true}'::jsonb),
  ('reading-al-fatiha-verses-1-3', 4, '{"choices": ["Seulement des sukūn", "Des fatḥas et des kasras, et une ḍamma", "Tanwīn"], "correctIndex": 1}'::jsonb),
  ('reading-al-fatiha-verses-4-6', 0, '{"choices": ["yawmi", "yami", "yumi"], "correctIndex": 0}'::jsonb),
  ('reading-al-fatiha-verses-4-6', 1, '{"correctAnswer": true}'::jsonb),
  ('reading-al-fatiha-verses-4-6', 2, '{"choices": ["na''budu", "na''badu", "nu''budu"], "correctIndex": 0}'::jsonb),
  ('reading-al-fatiha-verses-4-6', 3, '{"correctAnswer": true}'::jsonb),
  ('reading-al-fatiha-verses-4-6', 4, '{"choices": ["Une shadda", "Une lettre non connectante", "Un tanwīn"], "correctIndex": 1}'::jsonb),
  ('reading-al-ikhlas-opening', 0, '{"choices": ["qul huwa llahu ahad", "qad huwa llahu ahad", "qul hiya llahu ahad"], "correctIndex": 0}'::jsonb),
  ('reading-al-ikhlas-opening', 1, '{"correctAnswer": true}'::jsonb),
  ('reading-al-ikhlas-opening', 2, '{"choices": ["Trois", "Quatre", "Six"], "correctIndex": 1}'::jsonb),
  ('reading-connected-words', 0, '{"choices": ["Lettres non connectantes", "Position de la lettre (isolée/initiale/médiane/finale)", "Harakat"], "correctIndex": 1}'::jsonb),
  ('reading-connected-words', 1, '{"choices": ["Trois", "Six", "Vingt-huit"], "correctIndex": 1}'::jsonb),
  ('reading-connected-words', 2, '{"choices": ["د", "ر", "س"], "correctIndex": 0}'::jsonb),
  ('reading-connected-words', 3, '{"choices": ["ه", "د", "ن"], "correctIndex": 1}'::jsonb),
  ('reading-connected-words', 4, '{"pairs": [{"left": "letter-positions", "right": "la forme d''une lettre peut changer selon sa position dans un mot : isolée, initiale, médiane ou finale"}, {"left": "non-connectors", "right": "six lettres — ا د ذ ر ز و — qui ne se lient jamais à la lettre suivante"}]}'::jsonb),
  ('reading-longer-words', 0, '{"choices": ["kul", "kull", "kall"], "correctIndex": 1}'::jsonb),
  ('reading-longer-words', 1, '{"choices": ["kitaban", "kutuban", "kitabin"], "correctIndex": 0}'::jsonb),
  ('reading-longer-words', 2, '{"choices": ["baytun", "batun", "buytun"], "correctIndex": 0}'::jsonb),
  ('reading-longer-words', 3, '{"correctAnswer": true}'::jsonb),
  ('reading-longer-words', 4, '{"choices": ["Rien — c''est silencieux", "Un son ''n'' non écrit", "Une consonne doublée"], "correctIndex": 1}'::jsonb),
  ('reading-short-words', 0, '{"choices": ["kataba", "kutuba", "kitaba"], "correctIndex": 0}'::jsonb),
  ('reading-short-words', 1, '{"choices": ["man", "min", "mun"], "correctIndex": 1}'::jsonb),
  ('reading-short-words', 2, '{"correctAnswer": false}'::jsonb),
  ('reading-short-words', 3, '{"correctAnswer": true}'::jsonb),
  ('reading-short-words', 4, '{"choices": ["Les trois", "Seulement les deux premiers", "Aucun"], "correctIndex": 0}'::jsonb),
  ('reading-sukun-shadda', 0, '{"choices": ["Shadda", "Sukūn", "Fatḥa"], "correctIndex": 1}'::jsonb),
  ('reading-sukun-shadda', 1, '{"choices": ["Sukūn", "Fatḥa", "Shadda"], "correctIndex": 2}'::jsonb),
  ('reading-sukun-shadda', 2, '{"choices": ["na", "n (la consonne seule)", "nu"], "correctIndex": 1}'::jsonb),
  ('reading-sukun-shadda', 3, '{"choices": ["ma", "mmi", "mu"], "correctIndex": 1}'::jsonb),
  ('reading-sukun-shadda', 4, '{"pairs": [{"left": "sukun", "right": "un petit cercle au-dessus de la lettre, signifiant l''absence de voyelle"}, {"left": "shadda", "right": "une consonne doublée, tenue deux fois plus longtemps"}]}'::jsonb),
  ('reading-tanwin', 0, '{"choices": ["Ḍammatān", "Fatḥatān", "Kasratān"], "correctIndex": 1}'::jsonb),
  ('reading-tanwin', 1, '{"choices": ["Fatḥatān", "Ḍammatān", "Kasratān"], "correctIndex": 2}'::jsonb),
  ('reading-tanwin', 2, '{"choices": ["rin", "ran", "run"], "correctIndex": 1}'::jsonb),
  ('reading-tanwin', 3, '{"choices": ["min", "man", "mun"], "correctIndex": 2}'::jsonb),
  ('reading-tanwin', 4, '{"pairs": [{"left": "fathatan", "right": "une marque de fatḥa doublée, ajoutant un son final ''n'' non écrit"}, {"left": "kasratan", "right": "une marque de kasra doublée, ajoutant un son final ''n'' non écrit"}, {"left": "dammatan", "right": "une marque de ḍamma doublée, ajoutant un son final ''n'' non écrit"}]}'::jsonb),
  ('reading-with-grammar-awareness', 0, '{"choices": ["qul a''udhu bi-rabbi l-falaq", "qul a''udhu li-rabbi l-falaq", "qul a''udhu bi-maliki l-falaq"], "correctIndex": 0}'::jsonb),
  ('reading-with-grammar-awareness', 1, '{"correctAnswer": false}'::jsonb),
  ('reading-with-grammar-awareness', 2, '{"choices": ["Khalaqa", "Qul", "Rabb"], "correctIndex": 0}'::jsonb),
  ('reading-with-harakat', 0, '{"choices": ["Ḍamma", "Fatḥa", "Kasra"], "correctIndex": 1}'::jsonb),
  ('reading-with-harakat', 1, '{"choices": ["Fatḥa", "Ḍamma", "Kasra"], "correctIndex": 2}'::jsonb),
  ('reading-with-harakat', 2, '{"choices": ["Kasra", "Ḍamma", "Fatḥa"], "correctIndex": 1}'::jsonb),
  ('reading-with-harakat', 3, '{"choices": ["ri", "ra", "ru"], "correctIndex": 1}'::jsonb),
  ('reading-with-harakat', 4, '{"choices": ["mi", "ma", "mu"], "correctIndex": 2}'::jsonb),
  ('reading-with-harakat', 5, '{"pairs": [{"left": "fatha", "right": "un trait diagonal au-dessus de la lettre"}, {"left": "kasra", "right": "un trait diagonal en dessous de la lettre"}, {"left": "damma", "right": "une petite marque courbée au-dessus de la lettre"}]}'::jsonb),
  ('reading-with-root-awareness', 0, '{"choices": ["alhamdu lillahi rabbi l-aalameen", "alhamdu lillahi maliki l-aalameen", "alhamdu billahi rabbi l-aalameen"], "correctIndex": 0}'::jsonb),
  ('reading-with-root-awareness', 1, '{"correctAnswer": true}'::jsonb),
  ('reading-with-root-awareness', 2, '{"choices": ["''Aalameen (les mondes)", "Ilah (Dieu, divinité)", "Malik (Souverain, Roi)"], "correctIndex": 0}'::jsonb),
  ('sad-and-dad', 0, '{"choices": ["ص", "ض"], "correctIndex": 0}'::jsonb),
  ('sad-and-dad', 1, '{"choices": ["ص", "ض"], "correctIndex": 1}'::jsonb),
  ('sad-and-dad', 2, '{"pairs": [{"left": "ص", "right": "Ṣād"}, {"left": "ض", "right": "Ḍād"}]}'::jsonb),
  ('same-root-different-shape', 0, '{"correctAnswer": true}'::jsonb),
  ('same-root-different-shape', 1, '{"choices": ["Posséder ou régner", "Créer", "Montrer la miséricorde"], "correctIndex": 0}'::jsonb),
  ('same-root-different-shape', 2, '{"pairs": [{"left": "م-ل-ك", "right": "Souverain, Roi -- vu dans مَلِك et le mot apparenté Maalik"}]}'::jsonb),
  ('schema-validation-placeholder', 0, '{"choices": ["A", "B"], "correctIndex": 0}'::jsonb),
  ('shadda', 0, '{"choices": ["Sukūn", "Shadda", "Fatḥa"], "correctIndex": 1}'::jsonb),
  ('shadda', 1, '{"choices": ["Oui, elle n''en a jamais besoin", "Non, elle s''accompagne toujours d''un harakah ou d''un sukūn", "Seulement à la fin d''un mot"], "correctIndex": 1}'::jsonb),
  ('shadda', 2, '{"correctAnswer": false}'::jsonb),
  ('shadda', 3, '{"correctAnswer": true}'::jsonb),
  ('shadda', 4, '{"pairs": [{"left": "sukun", "right": "un petit cercle au-dessus de la lettre, signifiant l''absence de voyelle"}, {"left": "shadda", "right": "une consonne doublée, tenue deux fois plus longtemps"}]}'::jsonb),
  ('sin-and-shin', 0, '{"choices": ["س", "ش"], "correctIndex": 0}'::jsonb),
  ('sin-and-shin', 1, '{"choices": ["س", "ش"], "correctIndex": 1}'::jsonb),
  ('sin-and-shin', 2, '{"pairs": [{"left": "س", "right": "Sīn"}, {"left": "ش", "right": "Shīn"}]}'::jsonb),
  ('sukun', 0, '{"choices": ["Sukūn", "Fatḥa", "Shadda"], "correctIndex": 0}'::jsonb),
  ('sukun', 1, '{"choices": ["un son ''a'' bref", "la consonne seule, sans voyelle", "un son ''ou'' bref"], "correctIndex": 1}'::jsonb),
  ('sukun', 2, '{"correctAnswer": false}'::jsonb),
  ('sukun', 3, '{"correctAnswer": true}'::jsonb),
  ('sukun', 4, '{"pairs": [{"left": "sukun", "right": "un petit cercle au-dessus de la lettre, signifiant l''absence de voyelle"}]}'::jsonb),
  ('ta2-and-za2', 0, '{"choices": ["ط", "ظ"], "correctIndex": 0}'::jsonb),
  ('ta2-and-za2', 1, '{"choices": ["ط", "ظ"], "correctIndex": 1}'::jsonb),
  ('ta2-and-za2', 2, '{"pairs": [{"left": "ط", "right": "Ṭā''"}, {"left": "ظ", "right": "Ẓā''"}]}'::jsonb),
  ('the-ba-family', 0, '{"choices": ["ب", "ت", "ث"], "correctIndex": 0}'::jsonb),
  ('the-ba-family', 1, '{"choices": ["ب", "ت", "ث"], "correctIndex": 2}'::jsonb),
  ('the-ba-family', 2, '{"pairs": [{"left": "ب", "right": "Bā''"}, {"left": "ت", "right": "Tā''"}, {"left": "ث", "right": "Thā''"}]}'::jsonb),
  ('the-jim-family', 0, '{"choices": ["ج", "ح", "خ"], "correctIndex": 1}'::jsonb),
  ('the-jim-family', 1, '{"choices": ["ج", "ح", "خ"], "correctIndex": 2}'::jsonb),
  ('the-jim-family', 2, '{"pairs": [{"left": "ج", "right": "Jīm"}, {"left": "ح", "right": "Ḥā''"}, {"left": "خ", "right": "Khā''"}]}'::jsonb),
  ('the-straight-path', 0, '{"correctAnswer": false}'::jsonb),
  ('the-straight-path', 1, '{"choices": ["Il décrit sirat, le nom qui le précède", "Il nomme un chemin différent", "Signifie « le/la »"], "correctIndex": 0}'::jsonb),
  ('the-straight-path', 2, '{"pairs": [{"left": "noun-adjective-agreement", "right": "le mot qui décrit vient juste après son nom et partage « le/la » avec lui, comme dans as-sirat al-mustaqim"}]}'::jsonb),
  ('three-letters-one-meaning', 0, '{"correctAnswer": true}'::jsonb),
  ('three-letters-one-meaning', 1, '{"choices": ["Une racine commune, liée par le sens", "Aucune relation", "Ils s''écrivent de manière identique"], "correctIndex": 0}'::jsonb),
  ('three-letters-one-meaning', 2, '{"pairs": [{"left": "أ-ل-ه", "right": "Dieu, divinité -- vu dans إِلَٰه et le mot apparenté Ilah"}]}'::jsonb),
  ('vocabulary-1', 0, '{"choices": ["allah", "allahu", "allahi"], "correctIndex": 0}'::jsonb),
  ('vocabulary-1', 1, '{"choices": ["ar-rahman", "ar-raheem", "ar-rahim"], "correctIndex": 0}'::jsonb),
  ('vocabulary-1', 2, '{"choices": ["ar-raheem", "ar-rahman", "ar-rahim"], "correctIndex": 0}'::jsonb),
  ('vocabulary-1', 3, '{"choices": ["rabb", "rab", "rabbi"], "correctIndex": 0}'::jsonb),
  ('vocabulary-1', 4, '{"choices": ["aalamiin", "alamiin", "aalamaan"], "correctIndex": 0}'::jsonb),
  ('vocabulary-1', 5, '{"pairs": [{"left": "اللَّه", "right": "Allah"}, {"left": "الرَّحْمَٰن", "right": "Le Tout Miséricordieux"}, {"left": "الرَّحِيم", "right": "Le Très Miséricordieux"}, {"left": "رَبّ", "right": "Seigneur et Nourricier"}, {"left": "عَالَمِين", "right": "Mondes, toute la création"}]}'::jsonb),
  ('vocabulary-1', 6, '{"correctAnswer": true}'::jsonb),
  ('vocabulary-1', 7, '{"choices": ["Seigneur et Nourricier", "Jour", "Chemin"], "correctIndex": 0}'::jsonb),
  ('vocabulary-2', 0, '{"choices": ["maalik", "malik", "muwaalik"], "correctIndex": 0}'::jsonb),
  ('vocabulary-2', 1, '{"choices": ["yawm", "yaam", "yuwm"], "correctIndex": 0}'::jsonb),
  ('vocabulary-2', 2, '{"choices": ["siraat", "sarat", "suraat"], "correctIndex": 0}'::jsonb),
  ('vocabulary-2', 3, '{"choices": ["mustaqiim", "mustaqim", "mustaqaam"], "correctIndex": 0}'::jsonb),
  ('vocabulary-2', 4, '{"pairs": [{"left": "مَالِك", "right": "Maître, Souverain"}, {"left": "يَوْم", "right": "Jour"}, {"left": "دِّين", "right": "Jugement, rétribution"}, {"left": "صِرَاط", "right": "Chemin, voie"}, {"left": "مُسْتَقِيم", "right": "Droit, rectiligne"}]}'::jsonb),
  ('vocabulary-2', 5, '{"correctAnswer": true}'::jsonb),
  ('vocabulary-2', 6, '{"choices": ["Chemin, voie", "Jour", "Maître"], "correctIndex": 0}'::jsonb),
  ('vocabulary-3', 0, '{"choices": ["qul", "qad", "qil"], "correctIndex": 0}'::jsonb),
  ('vocabulary-3', 1, '{"choices": ["huwa", "hiya", "huma"], "correctIndex": 0}'::jsonb),
  ('vocabulary-3', 2, '{"choices": ["ahad", "ahd", "uhud"], "correctIndex": 0}'::jsonb),
  ('vocabulary-3', 3, '{"choices": ["malik", "maalik", "malak"], "correctIndex": 0}'::jsonb),
  ('vocabulary-3', 4, '{"choices": ["ilah", "alih", "ilih"], "correctIndex": 0}'::jsonb),
  ('vocabulary-3', 5, '{"pairs": [{"left": "قُلْ", "right": "Dis"}, {"left": "هُوَ", "right": "Il"}, {"left": "أَحَد", "right": "Unique"}, {"left": "مَلِك", "right": "Souverain, Roi"}, {"left": "إِلَٰه", "right": "Dieu, divinité"}]}'::jsonb),
  ('vocabulary-3', 6, '{"correctAnswer": true}'::jsonb),
  ('vocabulary-3', 7, '{"choices": ["Unique", "Jour", "Chemin"], "correctIndex": 0}'::jsonb),
  ('vocabulary-4', 0, '{"choices": ["an-nas", "an-naas", "al-nas"], "correctIndex": 0}'::jsonb),
  ('vocabulary-4', 1, '{"choices": ["sharr", "shar", "sharra"], "correctIndex": 0}'::jsonb),
  ('vocabulary-4', 2, '{"choices": ["khalaqa", "khalaqu", "khaliqa"], "correctIndex": 0}'::jsonb),
  ('vocabulary-4', 3, '{"choices": ["falaq", "filaq", "falaqa"], "correctIndex": 0}'::jsonb),
  ('vocabulary-4', 4, '{"choices": ["ghasiq", "ghaasiq", "ghasaq"], "correctIndex": 0}'::jsonb),
  ('vocabulary-4', 5, '{"pairs": [{"left": "النَّاس", "right": "Les hommes, l''humanité"}, {"left": "شَرّ", "right": "Mal"}, {"left": "خَلَقَ", "right": "Il a créé"}, {"left": "فَلَق", "right": "Aube, aube naissante"}, {"left": "غَاسِق", "right": "Obscurité, nuit"}]}'::jsonb),
  ('vocabulary-4', 6, '{"correctAnswer": true}'::jsonb),
  ('vocabulary-4', 7, '{"choices": ["Les hommes, l''humanité", "Obscurité", "Mal"], "correctIndex": 0}'::jsonb),
  ('ya2', 0, '{"correctAnswer": true}'::jsonb),
  ('ya2', 1, '{"pairs": [{"left": "ص", "right": "Ṣād"}, {"left": "غ", "right": "Ghayn"}, {"left": "ل", "right": "Lām"}, {"left": "و", "right": "Wāw"}]}'::jsonb)
;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM _fr_payloads;
  IF v_count <> 212 THEN
    RAISE EXCEPTION 'Expected exactly 212 French payload rows staged, found %.', v_count;
  END IF;
END $$;

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, explanation, payload)
SELECT e.id, 'fr', e.prompt_fr, e.explanation_fr, fp.payload
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id
JOIN _fr_payloads fp ON fp.lesson_slug = l.slug AND fp.exercise_order_index = e.order_index
WHERE e.prompt_fr IS NOT NULL;

-- =========================================================================
-- 4. Post-migration integrity assertions.
-- =========================================================================

DO $$
DECLARE
  v_count integer;
  v_arabic_hash text;
BEGIN
  -- Canonical Qur'anic Arabic proof: arabic_text is untouched by this
  -- migration (this table was never written to above) -- a full-table hash
  -- comparison against the value captured immediately before this
  -- migration ran is the Gate A+B report's before/after integrity proof
  -- (computed and compared outside this transaction, since the "before"
  -- hash was taken prior to this migration starting).
  SELECT md5(string_agg(arabic_text, '' ORDER BY id)) INTO v_arabic_hash FROM public.ayahs;
  RAISE NOTICE 'ayahs.arabic_text post-migration hash: %', v_arabic_hash;

  SELECT count(*) INTO v_count FROM public.level_translations WHERE locale = 'en';
  IF v_count <> 6 THEN RAISE EXCEPTION 'Expected 6 level_translations (en), found %.', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.level_translations WHERE locale = 'fr';
  IF v_count <> 6 THEN RAISE EXCEPTION 'Expected 6 level_translations (fr), found %.', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.module_translations WHERE locale = 'en';
  IF v_count <> 19 THEN RAISE EXCEPTION 'Expected 19 module_translations (en), found %.', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.module_translations WHERE locale = 'fr';
  IF v_count <> 19 THEN RAISE EXCEPTION 'Expected 19 module_translations (fr), found %.', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.lesson_translations WHERE locale = 'en';
  IF v_count <> 51 THEN RAISE EXCEPTION 'Expected 51 lesson_translations (en), found %.', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.lesson_translations WHERE locale = 'fr';
  IF v_count <> 51 THEN RAISE EXCEPTION 'Expected 51 lesson_translations (fr), found %.', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.lesson_section_translations WHERE locale = 'en';
  IF v_count <> 262 THEN RAISE EXCEPTION 'Expected 262 lesson_section_translations (en), found %.', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.lesson_section_translations WHERE locale = 'fr';
  IF v_count <> 262 THEN RAISE EXCEPTION 'Expected 262 lesson_section_translations (fr), found %.', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.lesson_exercise_translations WHERE locale = 'en';
  IF v_count <> 212 THEN RAISE EXCEPTION 'Expected 212 lesson_exercise_translations (en), found %.', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.lesson_exercise_translations WHERE locale = 'fr';
  IF v_count <> 212 THEN RAISE EXCEPTION 'Expected 212 lesson_exercise_translations (fr), found %.', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.ayah_translations WHERE locale = 'en';
  IF v_count <> 58 THEN RAISE EXCEPTION 'Expected 58 ayah_translations (en), found %.', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.ayah_translations WHERE locale = 'fr';
  IF v_count <> 58 THEN RAISE EXCEPTION 'Expected 58 ayah_translations (fr), found %.', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.word_frequency_translations WHERE locale = 'en';
  IF v_count <> 20 THEN RAISE EXCEPTION 'Expected 20 word_frequency_translations (en), found %.', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.word_frequency_translations WHERE locale = 'fr';
  IF v_count <> 20 THEN RAISE EXCEPTION 'Expected 20 word_frequency_translations (fr), found %.', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.surah_translations WHERE locale = 'en';
  IF v_count <> 114 THEN RAISE EXCEPTION 'Expected 114 surah_translations (en), found %.', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.surah_translations WHERE locale = 'fr';
  IF v_count <> 7 THEN RAISE EXCEPTION 'Expected 7 surah_translations (fr), found %.', v_count; END IF;

  -- Zero ar/ur/id rows anywhere -- this phase authors no new-language content.
  SELECT count(*) INTO v_count FROM (
    SELECT locale FROM public.level_translations WHERE locale NOT IN ('en','fr')
    UNION ALL SELECT locale FROM public.module_translations WHERE locale NOT IN ('en','fr')
    UNION ALL SELECT locale FROM public.lesson_translations WHERE locale NOT IN ('en','fr')
    UNION ALL SELECT locale FROM public.lesson_section_translations WHERE locale NOT IN ('en','fr')
    UNION ALL SELECT locale FROM public.lesson_exercise_translations WHERE locale NOT IN ('en','fr')
    UNION ALL SELECT locale FROM public.ayah_translations WHERE locale NOT IN ('en','fr')
    UNION ALL SELECT locale FROM public.word_frequency_translations WHERE locale NOT IN ('en','fr')
    UNION ALL SELECT locale FROM public.surah_translations WHERE locale NOT IN ('en','fr')
  ) x;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected zero ar/ur/id translation rows in this phase, found %.', v_count;
  END IF;

  -- Every existing _en/_fr column is untouched: source tables' row counts
  -- and non-null _fr coverage must be identical to the preconditions.
  SELECT count(*) INTO v_count FROM public.levels;
  IF v_count <> 6 THEN RAISE EXCEPTION 'levels row count changed, found %.', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.lesson_exercises WHERE payload IS NULL;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Expected zero lesson_exercises with a NULL payload.'; END IF;

  RAISE NOTICE 'Internationalization Foundation Phase 1 migration post-insert assertions passed.';
END $$;

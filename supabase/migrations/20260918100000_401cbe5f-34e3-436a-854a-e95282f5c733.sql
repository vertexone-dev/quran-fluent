-- Level 6 ("quranic-comprehension") Batch 1: Module 1 (al-fatiha-surah-study),
-- three lessons, complete-surah study of Al-Fatiha (1). This is the first
-- Level 6 content ever authored -- levels.number=6 has existed as an empty
-- placeholder (0 modules) since migration 20260822110000.
--
-- *** THIS MIGRATION IS A REVIEW CANDIDATE. IT IS NOT APPROVED CONTENT. ***
-- Full source ledger, human-review requirements, and every open decision
-- this migration depends on are recorded in LEVEL6-CONTENT-LEDGER.md at the
-- repo root. Do not apply this migration to production without that
-- document's §7 items being explicitly signed off by a qualified human
-- reviewer first. Unlike every prior curriculum migration in this project,
-- this one does NOT declare "CONTENT GOVERNANCE: RED ITEMS: 0. YELLOW
-- ITEMS: 0." at the end -- it has open yellow items, listed there, by
-- design.
--
-- SCOPE: does not rename levels.slug (stays 'quranic-comprehension' -- see
-- ledger §5.1), does not touch level_translations, does not touch Levels
-- 1-5, placement/progress/auth/payment tables, or any governed Qur'an text
-- or translation row.
--
-- CONTENT BOUNDARY (mirrors Level 1 Module 8's own explicit boundary):
-- zero reading_check exercises (Level 1 Module 8's exact territory -- all
-- 7 ayat already read aloud there); zero re-explanation of wa-/al-/bi-/
-- 'ala (Level 5's territory -- referenced only as already-known context).
-- This batch's new territory is whole-surah, cross-ayah meaning synthesis,
-- confirmed to have zero precedent anywhere in the existing curriculum
-- (verified by direct inspection before authoring, not assumed).
--
-- CORRECTED, post-authoring (see LEVEL6-RESEARCH-REVIEW.md addendum): an
-- earlier draft of this comment (and of Lesson 2's own learner-facing
-- text) claimed ayat 1:3/1:4/1:6 had "never" had their meaning addressed
-- by any prior lesson. True for 1:3. False for 1:4 and 1:6: Level 4's
-- core-grammar migration (20260907100000, lessons "the-straight-path" and
-- "lord-of-the-worlds") already glossed 1:6 as "the path, the straight
-- [one]" and 1:4 as "Sovereign of the Day of Recompense" while teaching
-- noun-adjective agreement and the idafa construction -- not one-word
-- orthography cameos, real phrase-level meaning glosses. This was missed
-- because the original duplication check only compared against Level 1
-- and Level 5, never Levels 2-4. Re-checked: zero re-explanation of
-- Level 4's actual grammar content (agreement/idafa) either -- what
-- remains genuinely new, and is what Lesson 2 now claims, is not these
-- ayat's phrase meaning but how they fit into Al-Fatiha's own overall
-- arc, which no prior lesson at any level addresses for any ayah.
--
-- CORRECTED, post-authoring, second pass (see LEVEL6-AI-REVIEW-RECONCILIATION.md
-- for the full record): two independent, adversarial AI reviews (Reviewer A,
-- Qur'an content; Reviewer B, French language) each read this migration in
-- full without seeing the other's findings. Their reconciliation applied
-- only the changes both fell within "direct factual repair / unambiguous
-- language correction," never a doctrinal or interpretive one: (1) French
-- prose now says "verset(s)" instead of the untranslated loanword "ayah"/
-- "ayat" everywhere Levels 1/4/5 and the app's own UI strings already do
-- (the matching-exercise review-item collision guard above was updated to
-- match the renamed French pair.left keys); (2) French ayah-1:4 prose now
-- says "Maître du Jour de la rétribution", matching the wording Level 4's
-- own prior lesson and the app's governed seed data already use for this
-- identical Arabic phrase, instead of this migration's own outlier
-- "Souverain"; (3) "la guidance" (a French vocational/counseling term, not
-- the register for divine guidance) replaced with "être guidé", matching
-- how Lesson 2 already phrased the identical idea; (4) a few idiom/
-- capitalization fixes ("Mise ensemble" -> "Pris dans son ensemble",
-- "niveau" -> "Niveau", "passe à Lui parler" -> "passe à s'adresser à
-- Lui"); (5) Lesson 2's English/French multiple-choice prompt about ayah 4
-- no longer presupposes ayah 4 is "praise" ("the surah's praise of Allah"
-- -> "the surah's description of Allah" / "la louange d'Allah" -> "la
-- description d'Allah") -- the tested fact (what ayah 4 adds) is unchanged,
-- only the prompt's own wording no longer imports the disputed praise/
-- petition categorization it doesn't need. What was NOT changed: the
-- praise/petition structural framing itself, the "evoked"/"encouru"
-- translation-edition wording, and Lesson 3's "concrete" exercise-wording
-- tension -- all remain open, HUMAN JUDGMENT REQUIRED items per both
-- reviews and the reconciliation, not resolved here by assumption.
--
-- REDUCED SCOPE, owner-controlled release path (see
-- LEVEL6-OWNER-REVIEW-CHECKLIST.md for the full record; this is NOT
-- qualified human scholarly or professional-language review -- no
-- external Qur'an-content or French-language reviewer was contacted or
-- consulted for this pass; product-owner decision, recorded honestly as
-- such). The disputed "ayah 4 is still praise" claim identified above was
-- not resolved by picking a side of the scholarly disagreement -- every
-- place this migration explicitly extended a "praise" characterization to
-- include ayah 4 (a range labeled "ayat 1 to 4" or "ayat 1-4", or an
-- explicit "it is still praise" statement about ayah 4 itself) has been
-- reworded to the objective, undisputed grammatical fact both named
-- sources agree on: ayat 1 through 4 describe Allah in the third person
-- (grammatically verifiable, zero interpretation required), full stop --
-- no claim is made about whether ayah 4 counts as "praise" or
-- "transitional." Instances that only used "praise"/"louange" as a loose,
-- whole-surah-level gloss for the *general* first phase of the surah (the
-- module goal, Lesson 3's title, and several summary/tip lines) were left
-- unchanged: both named sources (Sahih Muslim 395 and Darul Iftaa
-- Birmingham) independently describe the surah's overall movement this
-- same way ("the first three are in praise... the last three are a
-- request" -- Darul Iftaa's own words), so this framing is not the
-- disputed part; only the specific ayah-4 boundary claim was. Also fixed
-- as a pure exercise-design correction, not an interpretive one: Lesson
-- 3's first exercise no longer uses the word "concrete" for ayah 6 (it
-- now asks which ayah first "names the specific request"), leaving
-- "concrete" used consistently and only for ayah 7 everywhere else in the
-- lesson, removing the two-different-referents ambiguity a learner could
-- otherwise be marked wrong over. The "evoked"/"encouru" wording was
-- deliberately left as-is: it is not an interpretive claim at all, it is
-- the exact word this app's own `ayahs.translation_en` stores and
-- displays to the learner (see the "evoked" vs. "earned" note further
-- below) -- matching displayed text is the more defensible, non-
-- interpretive default, not a doctrinal choice. The `quran_example`
-- attribution gap (no translator/edition shown in the UI) is a systemic,
-- cross-level characteristic, not something this batch introduces or can
-- fix unilaterally -- left open, recorded, not resolved by assumption.
--
-- QUR'AN INTEGRITY: every Arabic string is a (surah_number, ayah_number)
-- FK reference into the existing ayahs table (enforced by the existing
-- composite FK and CHECK constraint on lesson_sections / lesson_exercises),
-- never hand-typed. All 7 references are to Surah 1, already cached
-- (verified in preconditions below). Every English prose claim about an
-- ayah's meaning is grounded directly in ayahs.translation_en for that
-- ayah -- the Sahih International text (edition "en.sahih", per migration
-- 20260818042151's own header) that lesson_sections' quran_example
-- rendering (LessonSectionRenderer -> fetchAyah/ayahTranslation) actually
-- displays to the learner. IMPORTANT CORRECTION made during authoring: an
-- earlier draft of this migration quoted the separate, newer
-- pickthall-gutenberg-16955 row from the normalized public.translations
-- table instead -- that row is real and verified, but it is NOT what
-- quran_example sections render (they read the legacy ayahs.translation_en
-- column, populated by a different, earlier-imported edition). Caught by
-- directly comparing this migration's own E2E test screenshot against the
-- quoted prose before finalizing, not assumed correct from the schema
-- alone; every quote below was re-verified against a live
-- `select ayah_number, translation_en from ayahs where surah_number = 1`
-- query, not the translations table. French prose is an independently-
-- authored literal rendering of that same Sahih-International English
-- wording (not a quotation of any French translation -- Kazimirski has
-- zero data rows in this schema, see ledger §3.1), chosen word-for-word to
-- stay traceable to the one cited source rather than blending in another
-- translation tradition's phrasing.
--
-- NEW VOCABULARY / WORD_FREQUENCY: none. This batch introduces no new
-- vocabulary items; word_frequency stays at exactly 20 rows (verified
-- below), mirroring the Level 5 Batch 2 precedent for incidental words.
--
-- REVIEW ITEMS: Lesson 1 and Lesson 2 each carry one matching exercise
-- (review_item_type 'concept'), 3 pairs each, mirroring the Level 5
-- one-matching-exercise-per-non-capstone-lesson pattern. Lesson 3
-- (capstone) deliberately has zero matching exercises and therefore seeds
-- zero new review items, mirroring the Level 3/4/5 capstone precedent
-- (seedLessonReviewItems only processes exercise_type='matching', src/lib/
-- study.ts). Verified before authoring that no existing matching exercise
-- anywhere in the curriculum references Surah 1, so none of this batch's
-- review-item keys (concept:Ayat 1-4, concept:Ayat 5-7, concept:The
-- turning word, concept:Ayah 3, concept:Ayah 4, concept:Ayah 6) can
-- collide with an existing learner's review queue.
--
-- I18N: normalized EN/FR translation rows authored directly (per the
-- Level 5+ authoring contract from migration 20260909100000), legacy
-- _en/_fr columns mirrored alongside for the still-NOT-NULL columns. No
-- ar/ur/id rows. This migration does not touch the levels table at all.
--
-- PROGRESSION: this migration does not touch src/lib/placement.ts --
-- STEP_LEVEL_SLUGS.surah_mastery is wired in a separate application-code
-- change (not SQL), reviewed independently; see ledger §5.2 and §7 item 4
-- for why connecting it is the actual release gate, not this migration by
-- itself. findCurriculumEntryPoint already generalizes to any level with
-- >=1 module and >=1 non-placeholder lesson -- no other code change is
-- needed once that wiring lands.
--
-- CONTENT GOVERNANCE: this migration is a REVIEW CANDIDATE, not approved
-- content. See LEVEL6-CONTENT-LEDGER.md §7 for the full, named list of
-- open items requiring human sign-off before production application.

DO $$
DECLARE
  v_existing integer;
  v_level_id uuid;
  v_module_exists integer;
BEGIN
  -- Row-count baseline (confirmed by direct query against local Supabase
  -- before authoring, matching the state left by migration 20260911100000
  -- and unchanged by anything after it).
  SELECT count(*) INTO v_existing FROM public.levels;
  IF v_existing <> 6 THEN
    RAISE EXCEPTION 'Expected exactly 6 levels before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.modules;
  IF v_existing <> 23 THEN
    RAISE EXCEPTION 'Expected exactly 23 modules before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.lessons;
  IF v_existing <> 58 THEN
    RAISE EXCEPTION 'Expected exactly 58 lessons before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.lesson_sections;
  IF v_existing <> 300 THEN
    RAISE EXCEPTION 'Expected exactly 300 lesson_sections before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.lesson_exercises;
  IF v_existing <> 236 THEN
    RAISE EXCEPTION 'Expected exactly 236 lesson_exercises before this migration, found %.', v_existing;
  END IF;
  SELECT count(*) INTO v_existing FROM public.word_frequency;
  IF v_existing <> 20 THEN
    RAISE EXCEPTION 'Expected exactly 20 word_frequency rows before this migration, found %.', v_existing;
  END IF;

  -- Level 6 must still be the untouched, empty placeholder.
  SELECT id INTO v_level_id FROM public.levels WHERE number = 6 AND slug = 'quranic-comprehension';
  IF v_level_id IS NULL THEN
    RAISE EXCEPTION 'Expected levels.number=6 to still be slug=quranic-comprehension. Aborting.';
  END IF;
  SELECT count(*) INTO v_existing FROM public.modules WHERE level_id = v_level_id;
  IF v_existing <> 0 THEN
    RAISE EXCEPTION 'Expected levels.number=6 to have zero modules before this migration, found %.', v_existing;
  END IF;

  -- The new module/lesson slugs must not already exist anywhere.
  IF EXISTS (SELECT 1 FROM public.modules WHERE slug = 'al-fatiha-surah-study') THEN
    RAISE EXCEPTION 'Expected al-fatiha-surah-study module to not already exist.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.lessons
    WHERE slug IN (
      'al-fatiha-orientation-and-structure',
      'al-fatiha-tracing-meaning',
      'al-fatiha-synthesis-praise-and-petition'
    )
  ) THEN
    RAISE EXCEPTION 'Expected this batch''s three lesson slugs to not already exist.';
  END IF;

  -- Every referenced ayah must already be cached.
  IF (SELECT count(*) FROM public.ayahs WHERE surah_number = 1 AND ayah_number BETWEEN 1 AND 7) <> 7 THEN
    RAISE EXCEPTION 'Expected all 7 ayat of Surah 1 to already be cached in public.ayahs.';
  END IF;

  -- Review-item key collision guard. CORRECTED per the adversarial
  -- re-check: matching exercises never populate their row-level
  -- surah_number/ayah_number columns (only lesson_sections do), so
  -- checking those columns here would be vacuously true regardless of
  -- the real risk. The actual collision key is
  -- {review_item_type}:{pair.left} (src/lib/study.ts), built from text
  -- INSIDE the payload jsonb -- so this checks that directly, against
  -- every one of this batch's six new keys, across every existing
  -- matching exercise in the whole curriculum, not just ones tied to
  -- Surah 1.
  IF EXISTS (
    SELECT 1 FROM public.lesson_exercises e,
      jsonb_array_elements(e.payload -> 'pairs') AS pair
    WHERE e.exercise_type = 'matching'
      AND e.review_item_type = 'concept'
      AND (pair ->> 'left') IN (
        'Ayat 1-4', 'Ayat 5-7', 'The turning word',
        'Ayah 3', 'Ayah 4', 'Ayah 6',
        'Versets 1 à 4', 'Versets 5 à 7', 'Le mot du tournant',
        'Verset 3', 'Verset 4', 'Verset 6'
      )
  ) THEN
    RAISE EXCEPTION 'Expected zero existing matching-exercise pairs using any of this batch''s new review-item keys.';
  END IF;
END $$;

-- =========================================================================
-- Module: al-fatiha-surah-study
-- =========================================================================

INSERT INTO public.modules (level_id, slug, title_en, title_fr, goal_en, goal_fr, order_index)
SELECT id, 'al-fatiha-surah-study', 'Al-Fatiha: A Complete Surah', $t$Al-Fatiha : une sourate complète$t$,
  'Study Al-Fatiha as one complete surah, tracing how its meaning builds from praise to petition.',
  $t$Étudier Al-Fatiha comme une sourate complète, en suivant comment son sens se construit, de la louange à la demande.$t$,
  0
FROM public.levels WHERE number = 6 AND slug = 'quranic-comprehension';

INSERT INTO public.module_translations (module_id, locale, title, goal)
SELECT id, 'en', title_en, goal_en FROM public.modules WHERE slug = 'al-fatiha-surah-study';
INSERT INTO public.module_translations (module_id, locale, title, goal)
SELECT id, 'fr', title_fr, goal_fr FROM public.modules WHERE slug = 'al-fatiha-surah-study';

-- =========================================================================
-- Lesson 1: al-fatiha-orientation-and-structure
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'al-fatiha-orientation-and-structure', 'Al-Fatiha: The Complete Surah',
  $t$Al-Fatiha : la sourate complète$t$, 0, 8
FROM public.modules WHERE slug = 'al-fatiha-surah-study';

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', title_en FROM public.lessons WHERE slug = 'al-fatiha-orientation-and-structure';
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', title_fr FROM public.lessons WHERE slug = 'al-fatiha-orientation-and-structure';

-- Sections

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  $t$You have already read all seven ayat of Al-Fatiha aloud, and in Level 5 you recognized several of its grammatical particles. Now you study it as what it is: one complete surah, read and understood as a whole rather than as separate practice lines.$t$,
  $t$Vous avez déjà lu à voix haute les sept versets d'Al-Fatiha, et au Niveau 5 vous en avez reconnu plusieurs particules grammaticales. Vous l'étudiez maintenant telle qu'elle est : une sourate complète, lue et comprise dans son ensemble plutôt que comme des lignes d'exercice séparées.$t$
FROM public.lessons WHERE slug = 'al-fatiha-orientation-and-structure';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr, surah_number, ayah_number)
SELECT id, 1, 'quran_example',
  $t$Al-Fatiha -- "The Opening" -- begins here, with the same ayah that opens the Qur'an itself.$t$,
  $t$Al-Fatiha — « l'Ouverture » — commence ici, avec le même verset qui ouvre le Coran lui-même.$t$,
  1, 1
FROM public.lessons WHERE slug = 'al-fatiha-orientation-and-structure';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'explanation',
  $t$Read together, Al-Fatiha's seven ayat fall into two parts. Ayat 1 to 4 describe Allah, naming who He is. Ayat 5 to 7 turn to a direct request. The turn happens at "You" in ayah 5 -- the first time the surah speaks directly to Allah instead of describing Him.$t$,
  $t$Lus ensemble, les sept versets d'Al-Fatiha se divisent en deux parties. Les versets 1 à 4 décrivent Allah, en disant qui Il est. Les versets 5 à 7 se tournent vers une demande directe. Le tournant se produit à « Toi » dans le verset 5 — la première fois que la sourate s'adresse directement à Allah au lieu de Le décrire.$t$
FROM public.lessons WHERE slug = 'al-fatiha-orientation-and-structure';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  $t$Two parts, seven ayat: description (1-4), then request (5-7), turning at ayah 5.$t$,
  $t$Deux parties, sept versets : description (1 à 4), puis demande (5 à 7), le tournant se situant au verset 5.$t$
FROM public.lessons WHERE slug = 'al-fatiha-orientation-and-structure';

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'en', s.body_en FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'al-fatiha-orientation-and-structure';
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'fr', s.body_fr FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'al-fatiha-orientation-and-structure';

-- Exercises

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, explanation_en, explanation_fr, review_item_type)
SELECT id, 0, 'multiple_choice',
  $t$Which ayah is the first to address Allah directly as "You", rather than describing Him in the third person?$t$,
  $t$Quel est le premier verset à s'adresser directement à Allah par « Toi », plutôt que de Le décrire à la troisième personne ?$t$,
  $t${"choices": ["Ayah 2", "Ayah 4", "Ayah 5"], "correctIndex": 2}$t$::jsonb,
  $t$Ayat 1-4 describe Allah in the third person ("Lord of the worlds", "Sovereign of the Day of Recompense"). Ayah 5 shifts to speaking directly to Him.$t$,
  $t$Les versets 1 à 4 décrivent Allah à la troisième personne (« Seigneur des mondes », « Maître du Jour de la rétribution »). Le verset 5 passe à s'adresser à Lui directement.$t$,
  'concept'
FROM public.lessons WHERE slug = 'al-fatiha-orientation-and-structure';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, explanation_en, explanation_fr, review_item_type)
SELECT id, 1, 'true_false',
  $t$Ayat 1 to 4 describe Allah in the third person; ayat 5 to 7 turn to address Him directly with a request.$t$,
  $t$Les versets 1 à 4 décrivent Allah à la troisième personne ; les versets 5 à 7 s'adressent directement à Lui avec une demande.$t$,
  $t${"correctAnswer": true}$t$::jsonb,
  $t$That is Al-Fatiha's shape: first description, then request.$t$,
  $t$C'est la structure d'Al-Fatiha : d'abord la description, puis la demande.$t$,
  'concept'
FROM public.lessons WHERE slug = 'al-fatiha-orientation-and-structure';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  $t$Match each part of Al-Fatiha to what it does.$t$,
  $t$Associez chaque partie d'Al-Fatiha à ce qu'elle fait.$t$,
  $t${"pairs": [{"left": "Ayat 1-4", "right": "Description: naming who Allah is"}, {"left": "Ayat 5-7", "right": "Request: asking Allah directly"}, {"left": "The turning word", "right": "\"You\", in ayah 5"}]}$t$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'al-fatiha-orientation-and-structure';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, explanation, payload)
SELECT e.id, 'en', e.prompt_en, e.explanation_en, e.payload FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'al-fatiha-orientation-and-structure';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, explanation, payload)
SELECT e.id, 'fr', e.prompt_fr, e.explanation_fr,
  CASE e.order_index
    WHEN 0 THEN $t${"choices": ["Verset 2", "Verset 4", "Verset 5"], "correctIndex": 2}$t$::jsonb
    WHEN 1 THEN $t${"correctAnswer": true}$t$::jsonb
    WHEN 2 THEN $t${"pairs": [{"left": "Versets 1 à 4", "right": "Description : dire qui est Allah"}, {"left": "Versets 5 à 7", "right": "Demande : s'adresser directement à Allah"}, {"left": "Le mot du tournant", "right": "« Toi », au verset 5"}]}$t$::jsonb
  END
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'al-fatiha-orientation-and-structure';

-- =========================================================================
-- Lesson 2: al-fatiha-tracing-meaning
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'al-fatiha-tracing-meaning', 'Tracing Meaning, Ayah by Ayah',
  $t$Suivre le sens, verset par verset$t$, 1, 10
FROM public.modules WHERE slug = 'al-fatiha-surah-study';

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', title_en FROM public.lessons WHERE slug = 'al-fatiha-tracing-meaning';
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', title_fr FROM public.lessons WHERE slug = 'al-fatiha-tracing-meaning';

-- Sections

-- CORRECTED (see LEVEL6-RESEARCH-REVIEW.md, adversarial-check addendum):
-- an earlier draft of this section claimed all three of ayah 3/4/6 had
-- "never been studied for their meaning" -- true for 1:3, but false for
-- 1:4 and 1:6, whose phrase meaning ("Sovereign of the Day of
-- Recompense"; "the path, the straight one") was already taught in Level
-- 4's core-grammar lessons (migration 20260907100000, teaching the idafa
-- construction and noun-adjective agreement). What is genuinely new here
-- is not the phrase meaning itself, but how these ayat fit into Al-
-- Fatiha's own arc -- reworded below to claim only that, accurately.
INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  $t$Ayah 3 has never been studied for its meaning before now. Ayah 4 and ayah 6 had their individual phrases explained already, in Level 4's grammar lessons -- but not how they fit into Al-Fatiha's own arc, from praise to request. That is what you trace here.$t$,
  $t$Le verset 3 n'avait encore jamais été étudié pour son sens. Les versets 4 et 6 ont déjà eu leurs expressions expliquées, dans les leçons de grammaire du Niveau 4 — mais pas la façon dont ils s'inscrivent dans la trajectoire propre d'Al-Fatiha, de la louange à la demande. C'est ce que vous allez suivre ici.$t$
FROM public.lessons WHERE slug = 'al-fatiha-tracing-meaning';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr, surah_number, ayah_number)
SELECT id, 1, 'quran_example',
  $t$Ayah 3 repeats the same two names for Allah that closed ayah 1 -- "the Entirely Merciful, the Especially Merciful" -- this time as its own complete ayah.$t$,
  $t$Le verset 3 reprend les deux mêmes noms d'Allah qui clôturaient le verset 1 — « le Tout Miséricordieux, le Très Miséricordieux » — cette fois comme un verset à part entière.$t$,
  1, 3
FROM public.lessons WHERE slug = 'al-fatiha-tracing-meaning';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr, surah_number, ayah_number)
SELECT id, 2, 'quran_example',
  $t$Ayah 4 -- "Sovereign of the Day of Recompense" -- adds a new description: Allah's authority specifically on the Day of Judgment. Like ayat 1 through 3, it describes Allah in the third person.$t$,
  $t$Le verset 4 — « Maître du Jour de la rétribution » — ajoute une nouvelle description : l'autorité d'Allah, en particulier au Jour du Jugement. Comme les versets 1 à 3, il décrit Allah à la troisième personne.$t$,
  1, 4
FROM public.lessons WHERE slug = 'al-fatiha-tracing-meaning';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr, surah_number, ayah_number)
SELECT id, 3, 'quran_example',
  $t$Ayah 6 -- "Guide us to the straight path" -- is the request the surah has been building toward since ayah 5. It is the specific thing being asked for.$t$,
  $t$Le verset 6 — « Guide-nous vers le droit chemin » — est la demande vers laquelle la sourate se dirigeait depuis le verset 5. C'est la chose précise qui est demandée.$t$,
  1, 6
FROM public.lessons WHERE slug = 'al-fatiha-tracing-meaning';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  $t$Ayah 3 repeats Allah's mercy as praise. Ayah 4 adds His authority on the Day of Judgment. Ayah 6 names the request itself: guidance to the straight path.$t$,
  $t$Le verset 3 reprend la miséricorde d'Allah comme louange. Le verset 4 ajoute Son autorité au Jour du Jugement. Le verset 6 nomme la demande elle-même : être guidé sur le droit chemin.$t$
FROM public.lessons WHERE slug = 'al-fatiha-tracing-meaning';

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'en', s.body_en FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'al-fatiha-tracing-meaning';
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'fr', s.body_fr FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'al-fatiha-tracing-meaning';

-- Exercises

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, explanation_en, explanation_fr, review_item_type)
SELECT id, 0, 'multiple_choice',
  $t$What does ayah 4 add to the surah's description of Allah?$t$,
  $t$Qu'ajoute le verset 4 à la description d'Allah dans la sourate ?$t$,
  $t${"choices": ["A new name for Allah", "His authority over the Day of Judgment", "A request for guidance"], "correctIndex": 1}$t$::jsonb,
  $t$Ayah 4 names Allah "Sovereign of the Day of Recompense" -- still describing Him, not yet a request.$t$,
  $t$Le verset 4 nomme Allah « Maître du Jour de la rétribution » — Le décrivant encore, pas encore une demande.$t$,
  'concept'
FROM public.lessons WHERE slug = 'al-fatiha-tracing-meaning';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'true_false',
  $t$Ayah 6, "Guide us to the straight path", is the central request the rest of the surah builds toward.$t$,
  $t$Le verset 6, la demande d'être guidé sur le droit chemin, est la demande centrale vers laquelle le reste de la sourate se dirige.$t$,
  $t${"correctAnswer": true}$t$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'al-fatiha-tracing-meaning';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  $t$Match each ayah to what it does.$t$,
  $t$Associez chaque verset à ce qu'il fait.$t$,
  $t${"pairs": [{"left": "Ayah 3", "right": "Repeats ayah 1's praise as its own ayah"}, {"left": "Ayah 4", "right": "Allah's authority on the Day of Judgment"}, {"left": "Ayah 6", "right": "The request for guidance"}]}$t$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'al-fatiha-tracing-meaning';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, explanation, payload)
SELECT e.id, 'en', e.prompt_en, e.explanation_en, e.payload FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'al-fatiha-tracing-meaning';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, explanation, payload)
SELECT e.id, 'fr', e.prompt_fr, e.explanation_fr,
  CASE e.order_index
    WHEN 0 THEN $t${"choices": ["Un nouveau nom pour Allah", "Son autorité sur le Jour du Jugement", "Une demande d'être guidé"], "correctIndex": 1}$t$::jsonb
    WHEN 1 THEN $t${"correctAnswer": true}$t$::jsonb
    WHEN 2 THEN $t${"pairs": [{"left": "Verset 3", "right": "Reprend la louange du verset 1 comme verset à part entière"}, {"left": "Verset 4", "right": "L'autorité d'Allah au Jour du Jugement"}, {"left": "Verset 6", "right": "La demande d'être guidé"}]}$t$::jsonb
  END
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'al-fatiha-tracing-meaning';

-- =========================================================================
-- Lesson 3: al-fatiha-synthesis-praise-and-petition (capstone)
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'al-fatiha-synthesis-praise-and-petition', 'Synthesis: From Praise to Petition',
  $t$Synthèse : de la louange à la demande$t$, 2, 10
FROM public.modules WHERE slug = 'al-fatiha-surah-study';

INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'en', title_en FROM public.lessons WHERE slug = 'al-fatiha-synthesis-praise-and-petition';
INSERT INTO public.lesson_translations (lesson_id, locale, title)
SELECT id, 'fr', title_fr FROM public.lessons WHERE slug = 'al-fatiha-synthesis-praise-and-petition';

-- Sections

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  $t$Put together, Al-Fatiha moves in one direction: praise, then request, then a request made concrete. Ayat 1 to 4 say who Allah is. Ayah 5 turns to address Him directly and states why: worship and a need for help. Ayah 6 names the request: guidance. Ayah 7 makes that guidance concrete, by contrast.$t$,
  $t$Pris dans son ensemble, Al-Fatiha avance dans une seule direction : la louange, puis la demande, puis une demande rendue concrète. Les versets 1 à 4 disent qui est Allah. Le verset 5 se tourne pour s'adresser à Lui directement et en donne la raison : l'adoration et le besoin d'aide. Le verset 6 nomme la demande : être guidé. Le verset 7 rend cela concret, par contraste.$t$
FROM public.lessons WHERE slug = 'al-fatiha-synthesis-praise-and-petition';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr, surah_number, ayah_number)
SELECT id, 1, 'quran_example',
  $t$The path is described by contrast: the path of those Allah has bestowed favor upon, not the path of those who have evoked anger or gone astray. The request in ayah 6 becomes specific here.$t$,
  $t$Le chemin est décrit par contraste : le chemin de ceux qu'Allah a comblés de Ses faveurs, non celui de ceux qui ont encouru Sa colère ou qui se sont égarés. La demande du verset 6 se précise ici.$t$,
  1, 7
FROM public.lessons WHERE slug = 'al-fatiha-synthesis-praise-and-petition';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'tip',
  $t$Notice the build: praise (who Allah is) leads to worship and a request for help (why we turn to Him), which leads to guidance (what we ask for), made concrete by the path's contrast (ayah 7).$t$,
  $t$Remarquez la construction : la louange (qui est Allah) mène à l'adoration et à une demande d'aide (pourquoi nous nous tournons vers Lui), qui mène à la demande d'être guidé (ce que nous demandons), rendue concrète par le contraste du chemin (verset 7).$t$
FROM public.lessons WHERE slug = 'al-fatiha-synthesis-praise-and-petition';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  $t$Seven ayat, one direction: praise, then worship and help, then guidance, then the path itself.$t$,
  $t$Sept versets, une seule direction : la louange, puis l'adoration et l'aide, puis le fait d'être guidé, puis le chemin lui-même.$t$
FROM public.lessons WHERE slug = 'al-fatiha-synthesis-praise-and-petition';

INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'en', s.body_en FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'al-fatiha-synthesis-praise-and-petition';
INSERT INTO public.lesson_section_translations (section_id, locale, body)
SELECT s.id, 'fr', s.body_fr FROM public.lesson_sections s
JOIN public.lessons l ON l.id = s.lesson_id WHERE l.slug = 'al-fatiha-synthesis-praise-and-petition';

-- Exercises (capstone: no matching exercises, zero new review items)

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 0, 'multiple_choice',
  $t$Which ayah first names the specific request -- what exactly are we asking Allah for?$t$,
  $t$Quel verset nomme en premier la demande précise — que demandons-nous exactement à Allah ?$t$,
  $t${"choices": ["Ayah 5", "Ayah 6", "Ayah 7"], "correctIndex": 1}$t$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'al-fatiha-synthesis-praise-and-petition';

-- Rewritten from an earlier negatively-phrased version ("...only in
-- general terms, without contrasting...", correctAnswer: false) to a
-- positively-phrased equivalent testing the identical knowledge --
-- negatively-phrased true/false items increase misread risk independent
-- of subject knowledge. Content/correctness unchanged; see
-- LEVEL6-RESEARCH-REVIEW.md, row L3-E1.
INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, explanation_en, explanation_fr, review_item_type)
SELECT id, 1, 'true_false',
  $t$Ayah 7 makes the "straight path" of ayah 6 concrete by contrasting it with two other paths.$t$,
  $t$Le verset 7 rend concret le « droit chemin » du verset 6 en le mettant en contraste avec deux autres chemins.$t$,
  $t${"correctAnswer": true}$t$::jsonb,
  $t$Ayah 7 contrasts the favored path with two others: the path of those who have evoked anger, and the path of those who have gone astray.$t$,
  $t$Le verset 7 met en contraste le chemin des favorisés avec deux autres : le chemin de ceux qui ont encouru la colère, et le chemin de ceux qui se sont égarés.$t$,
  'concept'
FROM public.lessons WHERE slug = 'al-fatiha-synthesis-praise-and-petition';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'multiple_choice',
  $t$Put Al-Fatiha's movement in order: (A) the request for guidance, (B) praise of Allah as Lord of the worlds, (C) the path described by contrast.$t$,
  $t$Remettez le mouvement d'Al-Fatiha dans l'ordre : (A) la demande d'être guidé, (B) la louange d'Allah en tant que Seigneur des mondes, (C) le chemin décrit par contraste.$t$,
  $t${"choices": ["B, A, C", "A, B, C", "C, B, A"], "correctIndex": 0}$t$::jsonb,
  'concept'
FROM public.lessons WHERE slug = 'al-fatiha-synthesis-praise-and-petition';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, explanation, payload)
SELECT e.id, 'en', e.prompt_en, e.explanation_en, e.payload FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'al-fatiha-synthesis-praise-and-petition';

INSERT INTO public.lesson_exercise_translations (exercise_id, locale, prompt, explanation, payload)
SELECT e.id, 'fr', e.prompt_fr, e.explanation_fr,
  CASE e.order_index
    WHEN 0 THEN $t${"choices": ["Verset 5", "Verset 6", "Verset 7"], "correctIndex": 1}$t$::jsonb
    WHEN 1 THEN $t${"correctAnswer": true}$t$::jsonb
    WHEN 2 THEN $t${"choices": ["B, A, C", "A, B, C", "C, B, A"], "correctIndex": 0}$t$::jsonb
  END
FROM public.lesson_exercises e
JOIN public.lessons l ON l.id = e.lesson_id WHERE l.slug = 'al-fatiha-synthesis-praise-and-petition';

-- =========================================================================
-- Postcondition assertions
-- =========================================================================

DO $$
DECLARE
  v_level_id uuid;
  v_module_id uuid;
  v_count integer;
  v_total integer;
BEGIN
  SELECT id INTO v_level_id FROM public.levels WHERE number = 6 AND slug = 'quranic-comprehension';

  SELECT id INTO v_module_id FROM public.modules WHERE slug = 'al-fatiha-surah-study' AND level_id = v_level_id;
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Expected al-fatiha-surah-study to exist under levels.number=6.';
  END IF;

  SELECT count(*) INTO v_count FROM public.modules WHERE level_id = v_level_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 module under levels.number=6 after this migration, found %.', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.lessons WHERE module_id = v_module_id;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 lessons under al-fatiha-surah-study, found %.', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.lesson_sections s
  JOIN public.lessons l ON l.id = s.lesson_id WHERE l.module_id = v_module_id;
  IF v_count <> 13 THEN
    RAISE EXCEPTION 'Expected exactly 13 lesson_sections under al-fatiha-surah-study, found %.', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id WHERE l.module_id = v_module_id;
  IF v_count <> 9 THEN
    RAISE EXCEPTION 'Expected exactly 9 lesson_exercises under al-fatiha-surah-study, found %.', v_count;
  END IF;

  -- Exactly 2 matching exercises (Lessons 1 and 2), 0 in the capstone.
  SELECT count(*) INTO v_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  WHERE l.module_id = v_module_id AND e.exercise_type = 'matching';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 matching exercises under al-fatiha-surah-study, found %.', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  WHERE l.slug = 'al-fatiha-synthesis-praise-and-petition' AND e.exercise_type = 'matching';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected zero matching exercises in the capstone lesson, found %.', v_count;
  END IF;

  -- Zero reading_check exercises anywhere in this batch (Level 1 Module 8's territory).
  SELECT count(*) INTO v_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  WHERE l.module_id = v_module_id AND e.exercise_type = 'reading_check';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected zero reading_check exercises in this batch, found %.', v_count;
  END IF;

  -- Every new module/lesson/section/exercise has exactly en+fr translation rows.
  SELECT count(*) INTO v_count FROM public.modules m
  WHERE m.slug = 'al-fatiha-surah-study'
    AND (SELECT count(*) FROM public.module_translations mt WHERE mt.module_id = m.id AND mt.locale IN ('en','fr')) <> 2;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected al-fatiha-surah-study to have exactly en+fr module_translations.';
  END IF;

  SELECT count(*) INTO v_count FROM public.lessons l
  WHERE l.module_id = v_module_id
    AND (SELECT count(*) FROM public.lesson_translations lt WHERE lt.lesson_id = l.id AND lt.locale IN ('en','fr')) <> 2;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected every lesson under al-fatiha-surah-study to have exactly en+fr lesson_translations.';
  END IF;

  SELECT count(*) INTO v_count FROM public.lesson_sections s
  JOIN public.lessons l ON l.id = s.lesson_id
  WHERE l.module_id = v_module_id
    AND (SELECT count(*) FROM public.lesson_section_translations st WHERE st.section_id = s.id AND st.locale IN ('en','fr')) <> 2;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected every section under al-fatiha-surah-study to have exactly en+fr lesson_section_translations.';
  END IF;

  SELECT count(*) INTO v_count FROM public.lesson_exercises e
  JOIN public.lessons l ON l.id = e.lesson_id
  WHERE l.module_id = v_module_id
    AND (SELECT count(*) FROM public.lesson_exercise_translations et WHERE et.exercise_id = e.id AND et.locale IN ('en','fr')) <> 2;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected every exercise under al-fatiha-surah-study to have exactly en+fr lesson_exercise_translations.';
  END IF;

  -- No non-en/fr locale rows anywhere in this batch.
  SELECT count(*) INTO v_count FROM public.module_translations mt
  JOIN public.modules m ON m.id = mt.module_id
  WHERE m.slug = 'al-fatiha-surah-study' AND mt.locale NOT IN ('en','fr');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected zero non-en/fr module_translations rows.';
  END IF;

  -- word_frequency untouched.
  SELECT count(*) INTO v_count FROM public.word_frequency;
  IF v_count <> 20 THEN
    RAISE EXCEPTION 'Expected word_frequency to remain at exactly 20 rows, found %.', v_count;
  END IF;

  -- Levels 1-5 and every pre-existing module/lesson untouched (regression guard):
  -- global totals must have grown by exactly this batch's own rows and nothing else.
  SELECT count(*) INTO v_total FROM public.levels;
  IF v_total <> 6 THEN RAISE EXCEPTION 'Expected levels to remain at 6, found %.', v_total; END IF;
  SELECT count(*) INTO v_total FROM public.modules;
  IF v_total <> 24 THEN RAISE EXCEPTION 'Expected exactly 24 modules after this migration, found %.', v_total; END IF;
  SELECT count(*) INTO v_total FROM public.lessons;
  IF v_total <> 61 THEN RAISE EXCEPTION 'Expected exactly 61 lessons after this migration, found %.', v_total; END IF;
  SELECT count(*) INTO v_total FROM public.lesson_sections;
  IF v_total <> 313 THEN RAISE EXCEPTION 'Expected exactly 313 lesson_sections after this migration, found %.', v_total; END IF;
  SELECT count(*) INTO v_total FROM public.lesson_exercises;
  IF v_total <> 245 THEN RAISE EXCEPTION 'Expected exactly 245 lesson_exercises after this migration, found %.', v_total; END IF;

  -- Al-Fatiha (Surah 1) quran_example / exercise citations grew by exactly
  -- this batch's own references (Quran integrity: no other surah touched,
  -- no existing citation removed).
  SELECT count(*) INTO v_count FROM public.lesson_sections WHERE surah_number = 1;
  IF v_count <> 32 THEN
    RAISE EXCEPTION 'Expected exactly 32 lesson_sections referencing Surah 1 after this migration (27 pre-existing + 5 new: 1:1, 1:3, 1:4, 1:6, 1:7), found %.', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.lesson_exercises WHERE surah_number = 1;
  IF v_count <> 15 THEN
    RAISE EXCEPTION 'Expected lesson_exercises referencing Surah 1 to remain at exactly 15 (this batch adds zero -- no exercise in this batch carries a surah/ayah FK), found %.', v_count;
  END IF;

  RAISE NOTICE 'Level 6 Batch 1 (al-fatiha-surah-study) migration post-insert assertions passed: 1 module, 3 lessons, 13 sections, 9 exercises, 2 matching (Lessons 1-2), 0 matching in capstone, word_frequency unchanged at 20, levels/Levels 1-5 untouched.';
END $$;

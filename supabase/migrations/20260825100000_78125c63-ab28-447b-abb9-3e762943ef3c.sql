-- Phase 2 / Sub-phase 2.4: Level 1 expansion — second and final chunk of
-- Module 2 ("Letter Shapes II", slug letter-shapes-2). 4 lessons covering
-- the remaining 7 of the module's 17 letters: ك ل م ن ه و ي. This chunk
-- COMPLETES letter-shapes-2 (10 from chunk 1 + 7 here = 17, matching the
-- module's own title "(س–ي)").
--
-- Departure from chunk 1's template, deliberately: none of these 7 letters
-- form a natural "same base shape, dot differs" pair the way all 10 of
-- chunk 1's letters did (each has a genuinely distinct isolated silhouette).
-- Forcing an artificial shared-shape claim between e.g. ك and ل would be
-- exactly the kind of overbroad generalization content governance forbids.
-- Instead, letters are grouped in standard alphabetical order and each is
-- taught on its own distinguishing features. Where a real, accurate
-- cross-reference to an already-taught Module 1 letter exists, it is used
-- as a genuine teaching aid, never a false pairing:
--   - Lesson A: Lām (ل) vs. Alif (ا, Module 1) — both tall vertical
--     strokes; Alif stays straight, Lām curves at the base. True in
--     isolated form, stated narrowly as such.
--   - Lesson B: Nūn (ن) vs. Bā' (ب, Module 1) — both bowl/dish shapes;
--     Bā's dot sits below, Nūn's sits above. True in isolated form only.
--   - Lesson C: Hā' (ه) vs. Ḥā' (ح, Module 1) — NOT a shape comparison
--     (deliberately not claimed), but an explicit naming disambiguation:
--     this is the first lesson introducing ه, and the pilot's own header
--     comment already flagged this exact confusion risk. The section body
--     and summary both state, in EN and FR, that Hā' (ه) and Ḥā' (ح) are
--     different letters, using the correct distinct transliteration for
--     each every time.
--
-- Lesson D (Yā') is a solo letter with no natural in-lesson two-choice
-- contrast, so its own exercise uses true_false (already proven by the
-- Module 1 pilot's Lesson 1) rather than a forced letter_recognition
-- against an arbitrary distractor. Lesson D also closes out the module: its
-- summary section honestly states Letter Shapes II is complete (17/17
-- letters) and that Letter Shapes I + II together cover isolated shapes for
-- all 28 Arabic letters — never claiming connected-form mastery,
-- pronunciation, Tajweed, or reading fluency, none of which are taught
-- here. Connected/contextual letter forms are explicitly deferred to the
-- already-seeded, separate 'connected-letter-forms' module. A final,
-- unattached recap matching exercise samples 4 letters spanning BOTH
-- chunks (Ṣād, Ghayn from chunk 1; Lām, Wāw from chunk 2) — kept to 4 pairs
-- so it stays a recap, not a full re-test of all 17 letters.
--
-- Content governance: same discipline as chunk 1 -- zero pronunciation or
-- phonetic claims. The one comparative claim per lesson (Alif/Lām,
-- Bā'/Nūn) is scoped explicitly to "isolated form" territory the module
-- itself covers, not generalized further. No content_sources row (self-
-- composed, uncontested orthography). No quran_example: same reasoning as
-- chunk 1 (pure letter-recognition, no natural "you've learned enough to
-- spot this in a real verse" moment) -- not forced for symmetry.
--
-- Transliteration (re-verified against actual Arabic spelling for whether
-- each name ends in hamza ء, same rule as chunk 1 and the pilot): Hā'
-- (هاء) and Yā' (ياء) end in hamza and take a plain apostrophe (U+0027);
-- Kāf, Lām, Mīm, Nūn, Wāw don't and take none. Hā' (ه) is never confused
-- with, or written as, Ḥā' (ح, U+1E24/U+1E25 with underdot) -- the two
-- names are kept fully distinct everywhere in this migration.

DO $$
DECLARE
  v_existing integer;
  v_chunk1_lesson_count integer;
BEGIN
  SELECT count(*) INTO v_existing FROM public.lessons
  WHERE slug IN ('kaf-and-lam', 'mim-and-nun', 'ha2-and-waw', 'ya2');
  IF v_existing <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 4 module-2-chunk-2 lesson slugs to already exist, found %. Aborting to avoid duplicate/conflicting seed data.', v_existing;
  END IF;

  -- Chunk 1 must already be applied (exactly 5 lessons) before chunk 2 runs.
  SELECT count(*) INTO v_chunk1_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id WHERE m.slug = 'letter-shapes-2';
  IF v_chunk1_lesson_count <> 5 THEN
    RAISE EXCEPTION 'Expected letter-shapes-2 to have exactly 5 lessons (chunk 1) before this migration, found %.', v_chunk1_lesson_count;
  END IF;
END $$;

-- =========================================================================
-- 1. Lessons.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'kaf-and-lam', 'Kāf & Lām: ك ل', 'Kāf et Lām : ك ل', 5, 6
FROM public.modules WHERE slug = 'letter-shapes-2';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'mim-and-nun', 'Mīm & Nūn: م ن', 'Mīm et Nūn : م ن', 6, 6
FROM public.modules WHERE slug = 'letter-shapes-2';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'ha2-and-waw', 'Hā'' & Wāw: ه و', 'Hā'' et Wāw : ه و', 7, 6
FROM public.modules WHERE slug = 'letter-shapes-2';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'ya2', 'Yā'': ي', 'Yā'' : ي', 8, 7
FROM public.modules WHERE slug = 'letter-shapes-2';

-- =========================================================================
-- 2. Lesson A — Kāf & Lām.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'These two letters don''t share a common base shape the way earlier pairs did — each has its own distinctive silhouette worth learning individually.',
  'Ces deux lettres ne partagent pas de forme de base commune comme les paires précédentes — chacune a sa propre silhouette distinctive à apprendre individuellement.'
FROM public.lessons WHERE slug = 'kaf-and-lam';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ك',
  'Kāf (ك) has a tall, slightly curved body with a short diagonal stroke inside it, near the top.',
  'Kāf (ك) a un corps haut et légèrement incurvé, avec un petit trait diagonal à l''intérieur, près du sommet.'
FROM public.lessons WHERE slug = 'kaf-and-lam';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'ل',
  'Lām (ل) is a single tall vertical stroke that curves to the left at the bottom — similar to Alif (ا) at first glance, but Alif stays perfectly straight all the way down.',
  'Lām (ل) est un simple trait vertical qui s''incurve vers la gauche à la base — semblable à Alif (ا) au premier regard, mais Alif reste parfaitement droit jusqu''en bas.'
FROM public.lessons WHERE slug = 'kaf-and-lam';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'If you see a tall vertical stroke, check the bottom: straight all the way down is Alif; a curve at the base is Lām.',
  'Si vous voyez un trait vertical haut, regardez la base : parfaitement droit, c''est Alif ; une courbe à la base, c''est Lām.'
FROM public.lessons WHERE slug = 'kaf-and-lam';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now tell Kāf and Lām apart, and tell Lām apart from Alif.',
  'Vous savez maintenant distinguer Kāf et Lām, et distinguer Lām d''Alif.'
FROM public.lessons WHERE slug = 'kaf-and-lam';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter has a diagonal stroke inside its body?', 'Quelle lettre a un trait diagonal à l''intérieur de son corps ?',
  '{"choices": ["ك", "ل"], "correctIndex": 0}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'kaf-and-lam';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter is a plain curved stroke, with nothing inside it?', 'Quelle lettre est un simple trait incurvé, sans rien à l''intérieur ?',
  '{"choices": ["ك", "ل"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'kaf-and-lam';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "ك", "right": "Kāf"}, {"left": "ل", "right": "Lām"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'kaf-and-lam';

-- =========================================================================
-- 3. Lesson B — Mīm & Nūn.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Two more letters with their own distinctive shapes — no shared base here either.',
  'Deux autres lettres à la forme bien distincte — là encore, pas de base commune.'
FROM public.lessons WHERE slug = 'mim-and-nun';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'م',
  'Mīm (م) is a small closed loop, almost like a tiny circle, with a short tail.',
  'Mīm (م) est une petite boucle fermée, presque comme un petit cercle, prolongée d''une courte queue.'
FROM public.lessons WHERE slug = 'mim-and-nun';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'ن',
  'Nūn (ن) is a curved bowl shape with one dot above it. Its bowl can look similar to Bā'' (ب) from Letter Shapes I at a glance — but Bā''s dot sits below the bowl, while Nūn''s sits above.',
  'Nūn (ن) est une forme de coupe incurvée surmontée d''un point. Sa coupe peut ressembler à celle de Bā'' (ب), vu dans Formes des lettres I — mais le point de Bā'' est sous la coupe, alors que celui de Nūn est au-dessus.'
FROM public.lessons WHERE slug = 'mim-and-nun';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Same trick as before: check where the dot sits. Above the bowl is Nūn; below it is Bā''.',
  'Même astuce qu''avant : regardez où se trouve le point. Au-dessus de la coupe, c''est Nūn ; en dessous, c''est Bā''.'
FROM public.lessons WHERE slug = 'mim-and-nun';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now tell Mīm and Nūn apart, and avoid confusing Nūn with Bā''.',
  'Vous savez maintenant distinguer Mīm et Nūn, et éviter de confondre Nūn avec Bā''.'
FROM public.lessons WHERE slug = 'mim-and-nun';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter is a small closed loop with a short tail?', 'Quelle lettre est une petite boucle fermée avec une courte queue ?',
  '{"choices": ["م", "ن"], "correctIndex": 0}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'mim-and-nun';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter has one dot above a curved bowl shape?', 'Quelle lettre a un point au-dessus d''une forme de coupe incurvée ?',
  '{"choices": ["م", "ن"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'mim-and-nun';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "م", "right": "Mīm"}, {"left": "ن", "right": "Nūn"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'mim-and-nun';

-- =========================================================================
-- 4. Lesson C — Hā' & Wāw. Introduces ه for the first time; explicitly
--    disambiguates it from Ḥā' (ح, Module 1) in both EN and FR, in both
--    the section body and the summary.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Two more distinctive shapes — and one important distinction to keep straight as you learn it.',
  'Deux autres formes bien distinctes — et une distinction importante à bien retenir en les apprenant.'
FROM public.lessons WHERE slug = 'ha2-and-waw';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ه',
  'Hā'' (ه) is drawn as a rounded loop, and has no dots. This Hā'' is a different letter from Ḥā'' (ح), which you learned in Letter Shapes I — they have different shapes and different sounds, even though their English spellings look alike.',
  'Hā'' (ه) se dessine comme une boucle arrondie, sans aucun point. Ce Hā'' est une lettre différente de Ḥā'' (ح), apprise dans Formes des lettres I — elles ont des formes et des sons différents, même si leurs transcriptions se ressemblent.'
FROM public.lessons WHERE slug = 'ha2-and-waw';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'و',
  'Wāw (و) has a small closed circle at the top with a tail dropping below it, and has no dots either.',
  'Wāw (و) a un petit cercle fermé en haut, prolongé d''une queue qui descend en dessous, et n''a pas de point non plus.'
FROM public.lessons WHERE slug = 'ha2-and-waw';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Hā''s loop stays close to the line; Wāw''s tail drops clearly below it.',
  'La boucle de Hā'' reste proche de la ligne ; la queue de Wāw descend nettement en dessous.'
FROM public.lessons WHERE slug = 'ha2-and-waw';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now tell Hā'' and Wāw apart — and remember, this Hā'' (ه) is not the same letter as Ḥā'' (ح).',
  'Vous savez maintenant distinguer Hā'' et Wāw — et souvenez-vous, ce Hā'' (ه) n''est pas la même lettre que Ḥā'' (ح).'
FROM public.lessons WHERE slug = 'ha2-and-waw';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter is drawn as a rounded loop, with no dots?', 'Quelle lettre se dessine comme une boucle arrondie, sans point ?',
  '{"choices": ["ه", "و"], "correctIndex": 0}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'ha2-and-waw';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter has a small circle at the top with a tail below?', 'Quelle lettre a un petit cercle en haut avec une queue en dessous ?',
  '{"choices": ["ه", "و"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'ha2-and-waw';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "ه", "right": "Hā'"}, {"left": "و", "right": "Wāw"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'ha2-and-waw';

-- =========================================================================
-- 5. Lesson D — Yā'. Closes the chunk AND the module: summary honestly
--    states Letter Shapes II is complete (17/17 letters), and that Letter
--    Shapes I + II together cover all 28 Arabic letters in isolated form
--    only -- explicitly deferring connected forms to the separate,
--    already-seeded connected-letter-forms module. No pronunciation,
--    Tajweed, or reading-fluency claim anywhere. Recap matching exercise
--    samples 4 letters spanning both chunks (2 from chunk 1, 2 from
--    chunk 2), kept short by design.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'The last new letter in Letter Shapes II, followed by a recap of everything you''ve learned across this module.',
  'La dernière nouvelle lettre de Formes des lettres II, suivie d''un récapitulatif de tout ce que vous avez appris dans ce module.'
FROM public.lessons WHERE slug = 'ya2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ي',
  'Yā'' (ي) has a curved tail, with two dots below it.',
  'Yā'' (ي) a une queue incurvée, avec deux points en dessous.'
FROM public.lessons WHERE slug = 'ya2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 2, 'tip',
  'Two dots below the curved tail — that''s Yā''s clearest signature feature.',
  'Deux points sous la queue incurvée — c''est le signe le plus net de Yā''.'
FROM public.lessons WHERE slug = 'ya2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'summary',
  'You''ve completed Letter Shapes II — all 17 letters from Sīn to Yā''. Combined with the 11 letters from Letter Shapes I, you can now recognize every isolated Arabic letter shape. Up next: short vowels, and later, how these letters connect together in words.',
  'Vous avez terminé Formes des lettres II — les 17 lettres de Sīn à Yā''. Avec les 11 lettres de Formes des lettres I, vous savez maintenant reconnaître la forme isolée de chaque lettre arabe. À suivre : les voyelles brèves, puis, plus tard, la façon dont ces lettres se relient entre elles dans les mots.'
FROM public.lessons WHERE slug = 'ya2';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'true_false',
  'True or False: Yā'' has two dots below it.', 'Vrai ou Faux : Yā'' a deux points en dessous.',
  '{"correctAnswer": true}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'ya2';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 1, 'matching',
  'Match each letter to its name — a recap from across Letter Shapes II.', 'Associez chaque lettre à son nom — un récapitulatif de tout Formes des lettres II.',
  $j${"pairs": [{"left": "ص", "right": "Ṣād"}, {"left": "غ", "right": "Ghayn"}, {"left": "ل", "right": "Lām"}, {"left": "و", "right": "Wāw"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'ya2';

-- =========================================================================
-- 6. Post-insert assertions.
-- =========================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_lesson_count integer;
  v_section_count integer;
  v_exercise_count integer;
  v_other_modules_untouched integer;
  v_pilot_lesson_count integer;
BEGIN
  SELECT id INTO STRICT v_module_id FROM public.modules WHERE slug = 'letter-shapes-2';

  SELECT count(*) INTO v_lesson_count FROM public.lessons WHERE module_id = v_module_id;
  IF v_lesson_count <> 9 THEN
    RAISE EXCEPTION 'Expected exactly 9 lessons in letter-shapes-2 (5 chunk 1 + 4 chunk 2), found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id WHERE l.module_id = v_module_id;
  IF v_section_count <> 44 THEN
    RAISE EXCEPTION 'Expected exactly 44 lesson_sections in letter-shapes-2 (25 chunk 1 + 19 chunk 2), found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id WHERE l.module_id = v_module_id;
  IF v_exercise_count <> 26 THEN
    RAISE EXCEPTION 'Expected exactly 26 lesson_exercises in letter-shapes-2 (15 chunk 1 + 11 chunk 2), found %.', v_exercise_count;
  END IF;

  -- letter-shapes-1 (the pilot) must be completely untouched by this migration.
  SELECT count(*) INTO v_pilot_lesson_count FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id WHERE m.slug = 'letter-shapes-1';
  IF v_pilot_lesson_count <> 5 THEN
    RAISE EXCEPTION 'Expected letter-shapes-1 to still have exactly 5 lessons (4 real + placeholder), found %.', v_pilot_lesson_count;
  END IF;

  -- Every other Level-1 module besides letter-shapes-1/letter-shapes-2 must remain empty.
  SELECT count(*) INTO v_other_modules_untouched FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE m.slug NOT IN ('letter-shapes-1', 'letter-shapes-2');
  IF v_other_modules_untouched <> 0 THEN
    RAISE EXCEPTION 'Expected zero lessons in modules other than letter-shapes-1/letter-shapes-2, found %.', v_other_modules_untouched;
  END IF;

  RAISE NOTICE 'Letter Shapes II (chunk 2) seeded: module=%, lessons=9 total (17 letters), sections=44, exercises=26. Module COMPLETE.',
    v_module_id;
END $$;

-- Phase 2 / Sub-phase 2.4: Level 1 expansion — first chunk of Module 2
-- ("Letter Shapes II", slug letter-shapes-2). 5 lessons covering 10 of the
-- module's 17 letters: the five clean dot-differentiated pairs
-- س/ش, ص/ض, ط/ظ, ع/غ, ف/ق. The remaining 7 letters (ك ل م ن ه و ي) don't
-- form neat visual pairs and are deliberately left for a future sub-phase
-- rather than forced into this one -- this migration does NOT claim the
-- module is complete anywhere (Lesson 5's summary explicitly says "seven
-- more to go" and names them).
--
-- Pattern reused directly from the Sub-phase 2.3 pilot's Lesson 4
-- (Dāl/Dhāl, Rā'/Zāy): explanation -> 2x arabic_text -> tip -> summary,
-- with 2 letter_recognition exercises (each attached via section_id to its
-- own arabic_text section) plus 1 unattached matching exercise recapping
-- the pair. All 5 lessons here are structurally identical two-letter dot
-- pairs, so the same proven template applies to all of them.
--
-- Content governance: same as the pilot -- every claim is closed,
-- uncontested Arabic orthography (letter identity/shape/dot pattern/name).
-- Learning from the pilot's one review finding (an overbroad phonetic
-- generalization that needed reworking after human review), this chunk
-- deliberately contains ZERO pronunciation/phonetic claims -- every tip
-- stays purely visual/shape-based, even for the four emphatic consonants
-- (ص ض ط ظ) where a phonetic aside would have been easy to add. No
-- content_sources row: same reasoning as the pilot (self-composed,
-- uncontested pedagogical fact, not a licensed external corpus).
--
-- No quran_example in this chunk: omitted deliberately (Task H), not an
-- oversight -- these 5 lessons are pure letter-recognition with no natural
-- "you've learned enough to spot this in a real verse" moment the way the
-- pilot's Lesson 4 had after completing its whole module.
--
-- Transliteration: every name re-verified against its actual Arabic
-- spelling for whether it ends in hamza (ء) -- the same rule already
-- correctly applied in the pilot (Bā'/Tā'/Rā' end in hamza and take an
-- apostrophe; Dāl/Zāy/Jīm don't and take none). Ṭā'/Ẓā'/Fā' end in hamza;
-- Sīn/Shīn/Ṣād/Ḍād/Ghayn/Qāf don't. ʿAyn uses the distinct modifier letter
-- ʿ (U+02BF), never the plain apostrophe used for hamza -- ʿayn and hamza
-- are different Arabic phonemes and conflating their transliteration
-- would be a real error, not a style choice. ه is not introduced in this
-- chunk, so the plain "Hā'" form (freed up by the pilot's Ḥā' fix)
-- remains reserved and unused for now.

DO $$
DECLARE
  v_existing integer;
BEGIN
  SELECT count(*) INTO v_existing FROM public.lessons
  WHERE slug IN ('sin-and-shin', 'sad-and-dad', 'ta2-and-za2', 'ayn-and-ghayn', 'fa2-and-qaf');
  IF v_existing <> 0 THEN
    RAISE EXCEPTION 'Expected none of the 5 module-2-chunk lesson slugs to already exist, found %. Aborting to avoid duplicate/conflicting seed data.', v_existing;
  END IF;

  IF (SELECT count(*) FROM public.lessons l JOIN public.modules m ON m.id = l.module_id WHERE m.slug = 'letter-shapes-2') <> 0 THEN
    RAISE EXCEPTION 'Expected letter-shapes-2 to have zero existing lessons before this migration. Aborting.';
  END IF;
END $$;

-- =========================================================================
-- 1. Lessons.
-- =========================================================================

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'sin-and-shin', 'Sīn & Shīn: س ش', 'Sīn et Shīn : س ش', 0, 6
FROM public.modules WHERE slug = 'letter-shapes-2';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'sad-and-dad', 'Ṣād & Ḍād: ص ض', 'Ṣād et Ḍād : ص ض', 1, 6
FROM public.modules WHERE slug = 'letter-shapes-2';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'ta2-and-za2', 'Ṭā'' & Ẓā'': ط ظ', 'Ṭā'' et Ẓā'' : ط ظ', 2, 6
FROM public.modules WHERE slug = 'letter-shapes-2';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'ayn-and-ghayn', 'ʿAyn & Ghayn: ع غ', 'ʿAyn et Ghayn : ع غ', 3, 6
FROM public.modules WHERE slug = 'letter-shapes-2';

INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
SELECT id, 'fa2-and-qaf', 'Fā'' & Qāf: ف ق', 'Fā'' et Qāf : ف ق', 4, 7
FROM public.modules WHERE slug = 'letter-shapes-2';

-- =========================================================================
-- 2. Lesson 1 — Sīn & Shīn.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'These two letters share the same base shape: three small teeth in a row. Only the dots above tell them apart.',
  'Ces deux lettres partagent la même forme de base : trois petites dents alignées. Seuls les points au-dessus permettent de les distinguer.'
FROM public.lessons WHERE slug = 'sin-and-shin';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'س', 'Sīn (س) has no dots at all — just three small teeth.', 'Sīn (س) n''a aucun point — seulement trois petites dents.'
FROM public.lessons WHERE slug = 'sin-and-shin';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'ش', 'Shīn (ش) is the exact same shape with three dots added above.', 'Shīn (ش) a exactement la même forme, avec trois points ajoutés au-dessus.'
FROM public.lessons WHERE slug = 'sin-and-shin';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Same three-teeth shape both times — just like Dāl→Dhāl and Rā''→Zāy, the dots are doing all the work again.',
  'Toujours la même forme à trois dents — comme pour Dāl→Dhāl et Rā''→Zāy, ce sont les points qui font toute la différence.'
FROM public.lessons WHERE slug = 'sin-and-shin';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now tell Sīn and Shīn apart: no dots, or three dots above.',
  'Vous savez maintenant distinguer Sīn et Shīn : aucun point, ou trois points au-dessus.'
FROM public.lessons WHERE slug = 'sin-and-shin';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter has NO dots at all?', 'Quelle lettre n''a AUCUN point ?',
  '{"choices": ["س", "ش"], "correctIndex": 0}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'sin-and-shin';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter has three dots above?', 'Quelle lettre a trois points au-dessus ?',
  '{"choices": ["س", "ش"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'sin-and-shin';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "س", "right": "Sīn"}, {"left": "ش", "right": "Shīn"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'sin-and-shin';

-- =========================================================================
-- 3. Lesson 2 — Ṣād & Ḍād.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'Another look-alike pair — this time sharing a wide, looped shape with a long tail.',
  'Une autre paire de lettres qui se ressemblent — cette fois avec une forme large et incurvée, prolongée par une longue queue.'
FROM public.lessons WHERE slug = 'sad-and-dad';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ص', 'Ṣād (ص) has no dot.', 'Ṣād (ص) n''a aucun point.'
FROM public.lessons WHERE slug = 'sad-and-dad';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'ض', 'Ḍād (ض) is the exact same shape with one dot added above.', 'Ḍād (ض) a exactement la même forme, avec un point ajouté au-dessus.'
FROM public.lessons WHERE slug = 'sad-and-dad';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Ṣād and Ḍād keep the same wide, looped base with a long tail — look for that shape, then check for the dot.',
  'Ṣād et Ḍād gardent la même base large et incurvée, prolongée par une longue queue — repérez cette forme, puis vérifiez la présence du point.'
FROM public.lessons WHERE slug = 'sad-and-dad';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now tell Ṣād and Ḍād apart: no dot, or one dot above.',
  'Vous savez maintenant distinguer Ṣād et Ḍād : aucun point, ou un point au-dessus.'
FROM public.lessons WHERE slug = 'sad-and-dad';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter has NO dot?', 'Quelle lettre n''a AUCUN point ?',
  '{"choices": ["ص", "ض"], "correctIndex": 0}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'sad-and-dad';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter has one dot above?', 'Quelle lettre a un point au-dessus ?',
  '{"choices": ["ص", "ض"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'sad-and-dad';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "ص", "right": "Ṣād"}, {"left": "ض", "right": "Ḍād"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'sad-and-dad';

-- =========================================================================
-- 4. Lesson 3 — Ṭā' & Ẓā'.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'This pair shares a loop with a tall vertical stroke rising from it.',
  'Cette paire partage une boucle surmontée d''un trait vertical qui s''élève vers le haut.'
FROM public.lessons WHERE slug = 'ta2-and-za2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ط', 'Ṭā'' (ط) has no dot.', 'Ṭā'' (ط) n''a aucun point.'
FROM public.lessons WHERE slug = 'ta2-and-za2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'ظ', 'Ẓā'' (ظ) is the exact same shape with one dot added above.', 'Ẓā'' (ظ) a exactement la même forme, avec un point ajouté au-dessus.'
FROM public.lessons WHERE slug = 'ta2-and-za2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'Same loop-and-stroke shape both times — the dot is still the only thing that changes.',
  'Toujours la même forme de boucle et de trait — le point reste la seule chose qui change.'
FROM public.lessons WHERE slug = 'ta2-and-za2';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now tell Ṭā'' and Ẓā'' apart: no dot, or one dot above.',
  'Vous savez maintenant distinguer Ṭā'' et Ẓā'' : aucun point, ou un point au-dessus.'
FROM public.lessons WHERE slug = 'ta2-and-za2';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter has NO dot?', 'Quelle lettre n''a AUCUN point ?',
  '{"choices": ["ط", "ظ"], "correctIndex": 0}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'ta2-and-za2';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter has one dot above?', 'Quelle lettre a un point au-dessus ?',
  '{"choices": ["ط", "ظ"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'ta2-and-za2';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "ط", "right": "Ṭā'"}, {"left": "ظ", "right": "Ẓā'"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'ta2-and-za2';

-- =========================================================================
-- 5. Lesson 4 — ʿAyn & Ghayn.
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'This pair shares a curved, open shape — picture a small hook.',
  'Cette paire partage une forme courbe et ouverte — imaginez un petit crochet.'
FROM public.lessons WHERE slug = 'ayn-and-ghayn';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ع', 'ʿAyn (ع) has no dot.', 'ʿAyn (ع) n''a aucun point.'
FROM public.lessons WHERE slug = 'ayn-and-ghayn';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'غ', 'Ghayn (غ) is the exact same shape with one dot added above.', 'Ghayn (غ) a exactement la même forme, avec un point ajouté au-dessus.'
FROM public.lessons WHERE slug = 'ayn-and-ghayn';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'You''ve seen this pattern several times now: same base shape, one dot added above changes the letter.',
  'Vous avez déjà vu ce schéma plusieurs fois : même forme de base, un point ajouté au-dessus change la lettre.'
FROM public.lessons WHERE slug = 'ayn-and-ghayn';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now tell ʿAyn and Ghayn apart: no dot, or one dot above.',
  'Vous savez maintenant distinguer ʿAyn et Ghayn : aucun point, ou un point au-dessus.'
FROM public.lessons WHERE slug = 'ayn-and-ghayn';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter has NO dot?', 'Quelle lettre n''a AUCUN point ?',
  '{"choices": ["ع", "غ"], "correctIndex": 0}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'ayn-and-ghayn';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter has one dot above?', 'Quelle lettre a un point au-dessus ?',
  '{"choices": ["ع", "غ"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'ayn-and-ghayn';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "ع", "right": "ʿAyn"}, {"left": "غ", "right": "Ghayn"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'ayn-and-ghayn';

-- =========================================================================
-- 6. Lesson 5 — Fā' & Qāf. Closes this chunk; summary is explicit that the
--    module itself is NOT complete (7 letters remain, named directly).
-- =========================================================================

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 0, 'explanation',
  'This pair shares a small circular head.',
  'Cette paire partage une petite tête circulaire.'
FROM public.lessons WHERE slug = 'fa2-and-qaf';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 1, 'arabic_text', 'ف', 'Fā'' (ف) has one dot above.', 'Fā'' (ف) a un point au-dessus.'
FROM public.lessons WHERE slug = 'fa2-and-qaf';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, arabic_text, body_en, body_fr)
SELECT id, 2, 'arabic_text', 'ق', 'Qāf (ق) has two dots above.', 'Qāf (ق) a deux points au-dessus.'
FROM public.lessons WHERE slug = 'fa2-and-qaf';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 3, 'tip',
  'This time both letters have a dot — count carefully: one dot, or two.',
  'Cette fois, les deux lettres ont un point — comptez attentivement : un point, ou deux.'
FROM public.lessons WHERE slug = 'fa2-and-qaf';

INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
SELECT id, 4, 'summary',
  'You can now tell Fā'' and Qāf apart: one dot above, or two dots above. That''s 10 more letters learned in Letter Shapes II — seven more to go: ك ل م ن ه و ي.',
  'Vous savez maintenant distinguer Fā'' et Qāf : un point au-dessus, ou deux points au-dessus. Cela fait 10 lettres de plus apprises dans Formes des lettres II — il en reste sept : ك ل م ن ه و ي.'
FROM public.lessons WHERE slug = 'fa2-and-qaf';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 0, 'letter_recognition',
  'Which letter has ONE dot above?', 'Quelle lettre a UN point au-dessus ?',
  '{"choices": ["ف", "ق"], "correctIndex": 0}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 1
WHERE l.slug = 'fa2-and-qaf';

INSERT INTO public.lesson_exercises (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT l.id, s.id, 1, 'letter_recognition',
  'Which letter has TWO dots above?', 'Quelle lettre a DEUX points au-dessus ?',
  '{"choices": ["ف", "ق"], "correctIndex": 1}'::jsonb, 'letter'
FROM public.lessons l JOIN public.lesson_sections s ON s.lesson_id = l.id AND s.order_index = 2
WHERE l.slug = 'fa2-and-qaf';

INSERT INTO public.lesson_exercises (lesson_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
SELECT id, 2, 'matching',
  'Match each letter to its name.', 'Associez chaque lettre à son nom.',
  $j${"pairs": [{"left": "ف", "right": "Fā'"}, {"left": "ق", "right": "Qāf"}]}$j$::jsonb,
  'letter'
FROM public.lessons WHERE slug = 'fa2-and-qaf';

-- =========================================================================
-- 7. Post-insert assertions.
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
  IF v_lesson_count <> 5 THEN
    RAISE EXCEPTION 'Expected exactly 5 lessons in letter-shapes-2, found %.', v_lesson_count;
  END IF;

  SELECT count(*) INTO v_section_count FROM public.lesson_sections ls
  JOIN public.lessons l ON l.id = ls.lesson_id WHERE l.module_id = v_module_id;
  IF v_section_count <> 25 THEN
    RAISE EXCEPTION 'Expected exactly 25 lesson_sections in letter-shapes-2, found %.', v_section_count;
  END IF;

  SELECT count(*) INTO v_exercise_count FROM public.lesson_exercises le
  JOIN public.lessons l ON l.id = le.lesson_id WHERE l.module_id = v_module_id;
  IF v_exercise_count <> 15 THEN
    RAISE EXCEPTION 'Expected exactly 15 lesson_exercises in letter-shapes-2, found %.', v_exercise_count;
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

  RAISE NOTICE 'Letter Shapes II (chunk 1) seeded: module=%, lessons=5, sections=25, exercises=15. Module NOT complete: 7 letters remain (ك ل م ن ه و ي).',
    v_module_id;
END $$;

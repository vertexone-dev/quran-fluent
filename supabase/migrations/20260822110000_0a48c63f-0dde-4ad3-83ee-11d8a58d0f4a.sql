-- Phase 2 / Sub-phase 2.1: Curriculum skeleton seed.
--
-- Structure only, per explicit instruction: one course, its 6 levels, and
-- the 8 Level-1 modules. No real lesson content is authored. One minimal
-- lesson/section/exercise row is seeded solely so the schema's FK chain
-- (lessons -> lesson_sections/lesson_exercises -> user_lesson_progress/
-- user_exercise_attempts) can be exercised end-to-end by the E2E schema
-- tests -- it is explicitly labeled as a validation fixture, not curriculum
-- content, and must never be presented to a learner as a real lesson.
--
-- Guarded like the Phase 2B Pickthall import: a zero-preexisting-rows
-- precondition (fails loudly rather than silently double-seeding or
-- silently no-op'ing on replay) and post-insert assertions confirming the
-- exact expected row counts.

DO $$
DECLARE
  v_existing_courses integer;
  v_course_id uuid;
  v_level1_id uuid;
  v_level_count integer;
  v_module_count integer;
  v_lesson_id uuid;
  v_section_id uuid;
BEGIN
  ---------------------------------------------------------------------------
  -- 0. Precondition: this migration must only ever run against an empty
  --    courses table.
  ---------------------------------------------------------------------------
  SELECT count(*) INTO v_existing_courses FROM public.courses;
  IF v_existing_courses <> 0 THEN
    RAISE EXCEPTION
      'Expected public.courses to be empty before the curriculum skeleton seed, found % row(s). Aborting to avoid duplicate/conflicting seed data.',
      v_existing_courses;
  END IF;

  ---------------------------------------------------------------------------
  -- 1. Course.
  ---------------------------------------------------------------------------
  INSERT INTO public.courses (slug, title_en, title_fr, description_en, description_fr, order_index)
  VALUES (
    'quranic-arabic-foundations',
    'Qur''anic Arabic Foundations',
    'Fondations de l''arabe coranique',
    'A structured path from the Arabic alphabet to reading and understanding the Qur''an in its original language.',
    'Un parcours structuré, de l''alphabet arabe jusqu''à la lecture et la compréhension du Coran dans sa langue d''origine.',
    0
  )
  RETURNING id INTO v_course_id;

  ---------------------------------------------------------------------------
  -- 2. Levels (6).
  ---------------------------------------------------------------------------
  INSERT INTO public.levels (course_id, number, slug, title_en, title_fr, goal_en, goal_fr, order_index) VALUES
    (v_course_id, 1, 'foundations-of-arabic-script', 'Foundations of Arabic Script', 'Fondations de l''écriture arabe',
     'Recognize and read the Arabic alphabet, vowel marks, and connected script.',
     'Reconnaître et lire l''alphabet arabe, les signes vocaliques et l''écriture liée.', 0),
    (v_course_id, 2, 'basic-vocabulary-and-patterns', 'Basic Vocabulary & Sentence Patterns', 'Vocabulaire de base et structures de phrases',
     'Build a core Qur''anic vocabulary and recognize simple sentence patterns.',
     'Construire un vocabulaire coranique de base et reconnaître des structures de phrases simples.', 1),
    (v_course_id, 3, 'roots-and-word-patterns', 'Roots & Word Patterns', 'Racines et schèmes',
     'Understand the Arabic root system and how word patterns build meaning.',
     'Comprendre le système des racines arabes et la façon dont les schèmes construisent le sens.', 2),
    (v_course_id, 4, 'core-grammar', 'Core Grammar', 'Grammaire fondamentale',
     'Learn the essential grammar needed to parse Qur''anic sentences.',
     'Apprendre la grammaire essentielle pour analyser les phrases coraniques.', 3),
    (v_course_id, 5, 'reading-comprehension', 'Reading Comprehension', 'Compréhension de lecture',
     'Read and understand short, familiar surahs independently.',
     'Lire et comprendre de manière autonome de courtes sourates familières.', 4),
    (v_course_id, 6, 'quranic-comprehension', 'Qur''anic Comprehension', 'Compréhension coranique',
     'Read and understand longer Qur''anic passages with confidence.',
     'Lire et comprendre avec assurance des passages coraniques plus longs.', 5);

  -- A multi-row INSERT's RETURNING can't be captured into a single scalar
  -- reliably, so Level 1's id is resolved with an explicit, unambiguous
  -- lookup instead.
  SELECT id INTO STRICT v_level1_id FROM public.levels
  WHERE course_id = v_course_id AND number = 1;

  ---------------------------------------------------------------------------
  -- 3. Level 1 modules (8), per the approved architecture report.
  ---------------------------------------------------------------------------
  INSERT INTO public.modules (level_id, slug, title_en, title_fr, order_index) VALUES
    (v_level1_id, 'letter-shapes-1', 'Letter Shapes I (ا–ز)', 'Formes des lettres I (ا–ز)', 0),
    (v_level1_id, 'letter-shapes-2', 'Letter Shapes II (س–ي)', 'Formes des lettres II (س–ي)', 1),
    (v_level1_id, 'harakat', 'Short Vowels (Harakat)', 'Voyelles brèves (harakat)', 2),
    (v_level1_id, 'sukun-and-shadda', 'Sukūn & Shadda', 'Sukūn et shadda', 3),
    (v_level1_id, 'tanwin', 'Nunation (Tanwīn)', 'Nunation (tanwīn)', 4),
    (v_level1_id, 'connected-letter-forms', 'Connected Letter Forms', 'Formes de lettres liées', 5),
    (v_level1_id, 'first-reading-practice', 'First Reading Practice', 'Premiers exercices de lecture', 6),
    (v_level1_id, 'reading-al-fatiha', 'Reading Al-Fatiha', 'Lecture d''Al-Fatiha', 7);

  ---------------------------------------------------------------------------
  -- 4. One schema-validation placeholder lesson (module 1, "Letter Shapes
  --    I"), with one section and one exercise, so the full FK chain is
  --    provably exercisable by the E2E suite. NOT real curriculum content.
  ---------------------------------------------------------------------------
  INSERT INTO public.lessons (module_id, slug, title_en, title_fr, order_index, estimated_minutes)
  SELECT id, 'schema-validation-placeholder',
    '[Schema validation placeholder — not real lesson content]',
    '[Repère de validation du schéma — pas un contenu de leçon réel]',
    0, 5
  FROM public.modules WHERE level_id = v_level1_id AND slug = 'letter-shapes-1'
  RETURNING id INTO v_lesson_id;

  INSERT INTO public.lesson_sections (lesson_id, order_index, content_type, body_en, body_fr)
  VALUES (
    v_lesson_id, 0, 'explanation',
    '[Placeholder content inserted only to validate the lesson_sections schema end-to-end. Real Level 1 lesson content has not been authored yet.]',
    '[Contenu de repère inséré uniquement pour valider le schéma lesson_sections de bout en bout. Le contenu réel du niveau 1 n''a pas encore été rédigé.]'
  )
  RETURNING id INTO v_section_id;

  INSERT INTO public.lesson_exercises
    (lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr, payload, review_item_type)
  VALUES (
    v_lesson_id, v_section_id, 0, 'multiple_choice',
    '[Schema validation placeholder]', '[Repère de validation du schéma]',
    '{"choices": ["A", "B"], "correctIndex": 0}'::jsonb,
    'letter'
  );

  ---------------------------------------------------------------------------
  -- 5. Post-insert assertions.
  ---------------------------------------------------------------------------
  SELECT count(*) INTO v_level_count FROM public.levels WHERE course_id = v_course_id;
  IF v_level_count <> 6 THEN
    RAISE EXCEPTION 'Expected exactly 6 levels for course %, found %.', v_course_id, v_level_count;
  END IF;

  SELECT count(*) INTO v_module_count FROM public.modules WHERE level_id = v_level1_id;
  IF v_module_count <> 8 THEN
    RAISE EXCEPTION 'Expected exactly 8 modules for Level 1 (%), found %.', v_level1_id, v_module_count;
  END IF;

  IF (SELECT count(*) FROM public.lessons WHERE id = v_lesson_id) <> 1 THEN
    RAISE EXCEPTION 'Expected the schema-validation placeholder lesson to exist.';
  END IF;

  IF (SELECT count(*) FROM public.lesson_sections WHERE lesson_id = v_lesson_id) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 lesson_sections row for the placeholder lesson.';
  END IF;

  IF (SELECT count(*) FROM public.lesson_exercises WHERE lesson_id = v_lesson_id) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 lesson_exercises row for the placeholder lesson.';
  END IF;

  RAISE NOTICE 'Curriculum skeleton seeded: course=%, levels=6, level1 modules=8, placeholder lesson=%',
    v_course_id, v_lesson_id;
END $$;

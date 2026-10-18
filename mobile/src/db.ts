/**
 * Loads the bundled, read-only content database entirely from local
 * assets (sql-wasm.wasm, quran-content.sqlite) shipped inside the app --
 * no network request of any kind. sql.js (WASM SQLite running inside the
 * WebView's own JS context) is used here specifically because it needs no
 * native plugin wiring, which keeps this Phase 0 feasibility spike simple
 * to stand up on both platforms from one shared codebase. A real Phase 1+
 * implementation should evaluate @capacitor-community/sqlite instead --
 * real native file-backed SQLite access, rather than loading the whole
 * database into WASM heap memory, matters once this grows past a single
 * read-only content file (see the audit's roadmap, Phase 2 onward).
 */
import initSqlJs, { type Database } from "sql.js";
import {
  resolveTranslation,
  resolveLessonLocale,
  type Locale,
  type LessonSection,
  type LessonExercise,
} from "./curriculum-render";

let dbPromise: Promise<Database> | null = null;

export function loadContentDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // sql.js's own default WASM loader tries WebAssembly.instantiateStreaming
      // against a fetch() of the locateFile()'d URL -- that path reliably fails
      // inside a Capacitor WKWebView (root-caused on a real iOS Simulator run:
      // a plain fetch("/sql-wasm.wasm") succeeds fully, 200/application/wasm,
      // full byte count -- so this is not an asset-serving problem -- but
      // instantiateStreaming's own stricter Response-object requirements
      // aren't satisfied by WKWebView's custom URL scheme handler response,
      // and sql.js's own ArrayBuffer fallback path also goes through the
      // same streaming-first code path and fails the same way). Fetching the
      // bytes ourselves with a plain fetch + arrayBuffer() (proven to work)
      // and handing them to sql.js as `wasmBinary` skips instantiateStreaming
      // entirely.
      const wasmRes = await fetch("/sql-wasm.wasm");
      if (!wasmRes.ok) {
        throw new Error(`Could not load bundled sql.js WASM (status ${wasmRes.status})`);
      }
      const wasmBinary = await wasmRes.arrayBuffer();

      const SQL = await initSqlJs({ wasmBinary });
      const res = await fetch("/quran-content.sqlite");
      if (!res.ok) {
        throw new Error(`Could not load bundled content database (status ${res.status})`);
      }
      const buf = await res.arrayBuffer();
      return new SQL.Database(new Uint8Array(buf));
    })();
  }
  return dbPromise;
}

export type Surah = {
  number: number;
  name_en: string;
  name_ar: string;
  name_fr: string | null;
  ayah_count: number;
  revelation_type: string;
};

export type ContentVersion = {
  version: string;
  generated_at: string;
  source_commit: string;
  overall_sha256: string;
};

function rowsToObjects<T>(columns: string[], values: unknown[][]): T[] {
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => (obj[col] = row[i]));
    return obj as T;
  });
}

/** Parameterized query helper -- used wherever a value isn't a trusted
 * internal integer (e.g. user-typed search text), to avoid the raw string
 * interpolation the surah-number queries above get away with only because
 * surah numbers always come from a <select>, never free text. */
function queryBound<T>(db: Database, sql: string, params: (string | number)[]): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export function getContentVersion(db: Database): ContentVersion {
  const result = db.exec(
    "SELECT version, generated_at, source_commit, overall_sha256 FROM content_version WHERE id = 1",
  );
  const [row] = rowsToObjects<ContentVersion>(result[0].columns, result[0].values);
  return row;
}

export function listSurahs(db: Database): Surah[] {
  const result = db.exec(
    "SELECT number, name_en, name_ar, name_fr, ayah_count, revelation_type FROM surahs ORDER BY number",
  );
  if (result.length === 0) return [];
  return rowsToObjects<Surah>(result[0].columns, result[0].values);
}

export type AyahRow = {
  ayah_number: number;
  arabic_text: string;
  english: string | null;
};

export function getAyahsWithEnglish(db: Database, surahNumber: number): AyahRow[] {
  const result = db.exec(
    `SELECT a.ayah_number, a.arabic_text, t.text as english
     FROM ayahs a
     LEFT JOIN translations t ON t.surah_number = a.surah_number AND t.ayah_number = a.ayah_number
     WHERE a.surah_number = ${surahNumber}
     ORDER BY a.ayah_number`,
  );
  if (result.length === 0) return [];
  return rowsToObjects<AyahRow>(result[0].columns, result[0].values);
}

export type KazimirskiJoinRaw = {
  ayah_number: number;
  seg_id: string;
  source_ordinal: number;
  seg_text: string;
  alignment_type: string;
};

export function getAyah(
  db: Database,
  surahNumber: number,
  ayahNumber: number,
): AyahRow | undefined {
  const rows = queryBound<AyahRow>(
    db,
    `SELECT a.ayah_number, a.arabic_text, t.text as english
     FROM ayahs a
     LEFT JOIN translations t ON t.surah_number = a.surah_number AND t.ayah_number = a.ayah_number
     WHERE a.surah_number = ? AND a.ayah_number = ?`,
    [surahNumber, ayahNumber],
  );
  return rows[0];
}

export function getKazimirskiJoinRows(db: Database, surahNumber: number): KazimirskiJoinRaw[] {
  const result = db.exec(
    `SELECT sa.ayah_number, s.id as seg_id, s.source_ordinal, s.text as seg_text, s.alignment_type
     FROM translation_segment_ayahs sa
     JOIN translation_segments s ON s.id = sa.segment_id
     WHERE sa.surah_number = ${surahNumber}
     ORDER BY sa.ayah_number, s.source_ordinal`,
  );
  if (result.length === 0) return [];
  return rowsToObjects<KazimirskiJoinRaw>(result[0].columns, result[0].values);
}

// --- Curriculum: Lessons / Practice -----------------------------------

function localeTitleRows(db: Database, table: string, idColumn: string, id: string) {
  return queryBound<{ locale: string; title: string }>(
    db,
    `SELECT locale, title FROM ${table} WHERE ${idColumn} = ? AND locale IN ('en','fr')`,
    [id],
  );
}

export type Course = {
  id: string;
  slug: string;
  title_en: string;
  title_fr: string;
  description_en: string | null;
  description_fr: string | null;
  order_index: number;
  title: string;
  description: string | null;
};

export function listCourses(db: Database, locale: Locale): Course[] {
  const result = db.exec(`SELECT * FROM courses ORDER BY order_index`);
  if (result.length === 0) return [];
  const rows = rowsToObjects<Omit<Course, "title" | "description">>(
    result[0].columns,
    result[0].values,
  );
  return rows.map((c) => ({
    ...c,
    title: locale === "fr" ? c.title_fr : c.title_en,
    description: locale === "fr" ? (c.description_fr ?? c.description_en) : c.description_en,
  }));
}

export type Level = {
  id: string;
  course_id: string;
  number: number;
  slug: string;
  title_en: string;
  title_fr: string;
  goal_en: string | null;
  goal_fr: string | null;
  order_index: number;
  title: string;
  goal: string | null;
};

export function listLevels(db: Database, locale: Locale): Level[] {
  const result = db.exec(`SELECT * FROM levels ORDER BY order_index`);
  if (result.length === 0) return [];
  const rows = rowsToObjects<Omit<Level, "title" | "goal">>(result[0].columns, result[0].values);
  return rows.map((l) => ({
    ...l,
    title:
      resolveTranslation(localeTitleRows(db, "level_translations", "level_id", l.id), locale)
        ?.title ?? l.title_en,
    goal: locale === "fr" ? (l.goal_fr ?? l.goal_en) : l.goal_en,
  }));
}

export type ModuleRow = {
  id: string;
  level_id: string;
  slug: string;
  title_en: string;
  title_fr: string;
  goal_en: string | null;
  goal_fr: string | null;
  order_index: number;
  title: string;
  goal: string | null;
};

export function listModules(db: Database, levelId: string, locale: Locale): ModuleRow[] {
  const rows = queryBound<Omit<ModuleRow, "title" | "goal">>(
    db,
    `SELECT * FROM modules WHERE level_id = ? ORDER BY order_index`,
    [levelId],
  );
  return rows.map((m) => ({
    ...m,
    title:
      resolveTranslation(localeTitleRows(db, "module_translations", "module_id", m.id), locale)
        ?.title ?? m.title_en,
    goal: locale === "fr" ? (m.goal_fr ?? m.goal_en) : m.goal_en,
  }));
}

export type LessonSummary = {
  id: string;
  module_id: string;
  slug: string;
  title_en: string;
  title_fr: string;
  order_index: number;
  estimated_minutes: number;
  title: string;
};

export function listLessons(db: Database, moduleId: string, locale: Locale): LessonSummary[] {
  const rows = queryBound<Omit<LessonSummary, "title">>(
    db,
    `SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index`,
    [moduleId],
  );
  return rows.map((l) => ({
    ...l,
    title:
      resolveTranslation(localeTitleRows(db, "lesson_translations", "lesson_id", l.id), locale)
        ?.title ?? l.title_en,
  }));
}

export type LessonForPlayer = {
  id: string;
  module_id: string;
  slug: string;
  title_en: string;
  title_fr: string;
  order_index: number;
  estimated_minutes: number;
  module: ModuleRow;
  level: Level;
  sections: LessonSection[];
  exercises: LessonExercise[];
  vocabulary: { order_index: number; word: WordFrequency }[];
  title: string;
  resolvedLocale: Locale;
};

/** Offline port of src/lib/curriculum.ts's fetchLessonForPlayer, reading
 * from the bundled SQLite instead of Supabase. Mirrors its exact
 * resolution order and the whole-lesson-falls-back-to-English rule
 * (resolveLessonLocale), so a lesson never renders with one section in
 * French and another silently in English. */
export function getLessonForPlayer(
  db: Database,
  lessonId: string,
  locale: Locale,
): LessonForPlayer | null {
  const lessonRows = queryBound<Omit<LessonSummary, "title">>(
    db,
    `SELECT * FROM lessons WHERE id = ?`,
    [lessonId],
  );
  const lesson = lessonRows[0];
  if (!lesson) return null;

  const moduleRows = queryBound<Omit<ModuleRow, "title" | "goal">>(
    db,
    `SELECT * FROM modules WHERE id = ?`,
    [lesson.module_id],
  );
  const moduleRow = moduleRows[0];
  if (!moduleRow) throw new Error(`Lesson ${lessonId} references a missing module.`);

  const levelRows = queryBound<Omit<Level, "title" | "goal">>(
    db,
    `SELECT * FROM levels WHERE id = ?`,
    [moduleRow.level_id],
  );
  const levelRow = levelRows[0];
  if (!levelRow) throw new Error(`Module ${moduleRow.id} references a missing level.`);

  const sectionRows = queryBound<{
    id: string;
    lesson_id: string;
    order_index: number;
    content_type: LessonSection["content_type"];
    body_en: string | null;
    body_fr: string | null;
    arabic_text: string | null;
    surah_number: number | null;
    ayah_number: number | null;
    metadata_json: string;
  }>(db, `SELECT * FROM lesson_sections WHERE lesson_id = ? ORDER BY order_index`, [lessonId]);

  const exerciseRows = queryBound<{
    id: string;
    lesson_id: string;
    section_id: string | null;
    order_index: number;
    exercise_type: LessonExercise["exercise_type"];
    prompt_en: string;
    prompt_fr: string;
    payload_json: string;
    explanation_en: string | null;
    explanation_fr: string | null;
    surah_number: number | null;
    ayah_number: number | null;
    review_item_type: LessonExercise["review_item_type"];
  }>(db, `SELECT * FROM lesson_exercises WHERE lesson_id = ? ORDER BY order_index`, [lessonId]);

  const vocabLinks = queryBound<{ word_id: string; order_index: number }>(
    db,
    `SELECT word_id, order_index FROM lesson_vocabulary_words WHERE lesson_id = ? ORDER BY order_index`,
    [lessonId],
  );

  const lessonTr = queryBound<{ locale: string; title: string }>(
    db,
    `SELECT locale, title FROM lesson_translations WHERE lesson_id = ? AND locale IN ('en','fr')`,
    [lessonId],
  );
  const moduleTr = localeTitleRows(db, "module_translations", "module_id", moduleRow.id);
  const levelTr = localeTitleRows(db, "level_translations", "level_id", levelRow.id);

  const sectionTrBySection = new Map<string, { locale: Locale; body: string }[]>();
  for (const s of sectionRows) {
    const rows = queryBound<{ locale: string; body: string }>(
      db,
      `SELECT locale, body FROM lesson_section_translations WHERE section_id = ? AND locale IN ('en','fr')`,
      [s.id],
    );
    sectionTrBySection.set(s.id, rows);
  }
  const exerciseTrByExercise = new Map<
    string,
    {
      locale: Locale;
      prompt: string;
      explanation: string | null;
      payload: Record<string, unknown>;
    }[]
  >();
  for (const e of exerciseRows) {
    const rows = queryBound<{
      locale: string;
      prompt: string;
      explanation: string | null;
      payload_json: string | null;
    }>(
      db,
      `SELECT locale, prompt, explanation, payload_json FROM lesson_exercise_translations WHERE exercise_id = ? AND locale IN ('en','fr')`,
      [e.id],
    );
    exerciseTrByExercise.set(
      e.id,
      rows.map((r) => ({
        locale: r.locale,
        prompt: r.prompt,
        explanation: r.explanation,
        payload: r.payload_json ? JSON.parse(r.payload_json) : {},
      })),
    );
  }

  const sectionIds = sectionRows.map((s) => s.id);
  const exerciseIds = exerciseRows.map((e) => e.id);
  const sectionLocales = new Map<string, ReadonlySet<Locale>>(
    sectionIds.map((id) => [id, new Set((sectionTrBySection.get(id) ?? []).map((r) => r.locale))]),
  );
  const exerciseLocales = new Map<string, ReadonlySet<Locale>>(
    exerciseIds.map((id) => [
      id,
      new Set((exerciseTrByExercise.get(id) ?? []).map((r) => r.locale)),
    ]),
  );

  const resolvedLocale = resolveLessonLocale(
    locale,
    lessonTr.some((r) => r.locale === locale),
    sectionIds,
    sectionLocales,
    exerciseIds,
    exerciseLocales,
  );

  const title = resolveTranslation(lessonTr, resolvedLocale)?.title ?? lesson.title_en;
  const moduleTitle = resolveTranslation(moduleTr, locale)?.title ?? moduleRow.title_en;
  const levelTitle = resolveTranslation(levelTr, locale)?.title ?? levelRow.title_en;

  const sections: LessonSection[] = sectionRows.map((s) => ({
    id: s.id,
    lesson_id: s.lesson_id,
    order_index: s.order_index,
    content_type: s.content_type,
    body_en: s.body_en,
    body_fr: s.body_fr,
    arabic_text: s.arabic_text,
    surah_number: s.surah_number,
    ayah_number: s.ayah_number,
    metadata: JSON.parse(s.metadata_json || "{}"),
    body: resolveTranslation(sectionTrBySection.get(s.id), resolvedLocale)?.body ?? s.body_en,
  }));

  const exercises: LessonExercise[] = exerciseRows.map((e) => {
    const payload = JSON.parse(e.payload_json || "{}");
    const tr = resolveTranslation(exerciseTrByExercise.get(e.id), resolvedLocale);
    return {
      id: e.id,
      lesson_id: e.lesson_id,
      section_id: e.section_id,
      order_index: e.order_index,
      exercise_type: e.exercise_type,
      prompt_en: e.prompt_en,
      prompt_fr: e.prompt_fr,
      payload,
      explanation_en: e.explanation_en,
      explanation_fr: e.explanation_fr,
      surah_number: e.surah_number,
      ayah_number: e.ayah_number,
      review_item_type: e.review_item_type,
      prompt: tr?.prompt ?? e.prompt_en,
      explanation: tr?.explanation ?? e.explanation_en,
      resolvedPayload: tr?.payload ?? payload,
    };
  });

  const wordIds = vocabLinks.map((v) => v.word_id);
  const wordsById = new Map(wordIds.map((id) => [id, getWordById(db, id, locale)]));
  const vocabulary = vocabLinks
    .map((v) => ({ order_index: v.order_index, word: wordsById.get(v.word_id) }))
    .filter((v): v is { order_index: number; word: WordFrequency } => Boolean(v.word));

  const module: ModuleRow = { ...moduleRow, title: moduleTitle, goal: moduleRow.goal_en };
  const level: Level = { ...levelRow, title: levelTitle, goal: levelRow.goal_en };

  return {
    id: lesson.id,
    module_id: lesson.module_id,
    slug: lesson.slug,
    title_en: lesson.title_en,
    title_fr: lesson.title_fr,
    order_index: lesson.order_index,
    estimated_minutes: lesson.estimated_minutes,
    module,
    level,
    sections,
    exercises,
    vocabulary,
    title,
    resolvedLocale,
  };
}

// --- Vocabulary (Word Details) -----------------------------------------

export type WordFrequency = {
  id: string;
  word: string;
  transliteration: string | null;
  meaning: string;
  meaning_fr: string | null;
  frequency_rank: number | null;
  occurrences: number | null;
  root: string | null;
  example_ayah: string | null;
  example_reference: string | null;
  topic_tags: string[] | null;
  category: "noun" | "verb" | "particle" | "phrase" | null;
  resolvedMeaning: string;
};

function wordRowToWordFrequency(
  row: {
    id: string;
    word: string;
    transliteration: string | null;
    meaning: string;
    meaning_fr: string | null;
    frequency_rank: number | null;
    occurrences: number | null;
    root: string | null;
    example_ayah: string | null;
    example_reference: string | null;
    topic_tags_json: string | null;
    category: WordFrequency["category"];
  },
  db: Database,
  locale: Locale,
): WordFrequency {
  const trs = queryBound<{ locale: string; meaning: string }>(
    db,
    `SELECT locale, meaning FROM word_frequency_translations WHERE word_id = ? AND locale IN ('en','fr')`,
    [row.id],
  );
  return {
    id: row.id,
    word: row.word,
    transliteration: row.transliteration,
    meaning: row.meaning,
    meaning_fr: row.meaning_fr,
    frequency_rank: row.frequency_rank,
    occurrences: row.occurrences,
    root: row.root,
    example_ayah: row.example_ayah,
    example_reference: row.example_reference,
    topic_tags: row.topic_tags_json ? JSON.parse(row.topic_tags_json) : null,
    category: row.category,
    resolvedMeaning: resolveTranslation(trs, locale)?.meaning ?? row.meaning,
  };
}

export function getWordById(db: Database, id: string, locale: Locale): WordFrequency | undefined {
  const rows = queryBound<Parameters<typeof wordRowToWordFrequency>[0]>(
    db,
    `SELECT * FROM word_frequency WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  return row ? wordRowToWordFrequency(row, db, locale) : undefined;
}

export function searchWordFrequency(
  db: Database,
  options: { search?: string; category?: string | null; locale: Locale; limit?: number },
): WordFrequency[] {
  const { search, category, locale, limit = 50 } = options;
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (category) {
    clauses.push("category = ?");
    params.push(category);
  }
  if (search) {
    clauses.push("(word LIKE ? OR transliteration LIKE ? OR meaning LIKE ? OR meaning_fr LIKE ?)");
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern, pattern);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit);
  const rows = queryBound<Parameters<typeof wordRowToWordFrequency>[0]>(
    db,
    `SELECT * FROM word_frequency ${where} ORDER BY frequency_rank LIMIT ?`,
    params,
  );
  return rows.map((r) => wordRowToWordFrequency(r, db, locale));
}

/** Not part of the production web app's query surface (no "related words"
 * endpoint exists there yet) -- a reasonable, locally-computed extension
 * for the mobile Word Details screen: other words sharing the same root,
 * excluding the word itself. Documented as a Phase 1 addition, not a port. */
export function getRelatedWordsByRoot(
  db: Database,
  root: string,
  excludeId: string,
  locale: Locale,
  limit = 6,
): WordFrequency[] {
  const rows = queryBound<Parameters<typeof wordRowToWordFrequency>[0]>(
    db,
    `SELECT * FROM word_frequency WHERE root = ? AND id != ? ORDER BY frequency_rank LIMIT ?`,
    [root, excludeId, limit],
  );
  return rows.map((r) => wordRowToWordFrequency(r, db, locale));
}

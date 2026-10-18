import { describe, test, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateExerciseAnswer,
  hasCompleteResponse,
  buildPlayerSteps,
  computeProgressPercent,
  resolveLessonLocale,
  resolveTranslation,
  type LessonSection,
  type LessonExercise,
  type LessonExerciseType,
} from "../../src/lib/curriculum";

/**
 * Phase 1 fidelity check (mirrors kazimirski-export.test.ts's pattern): does
 * the exported SQLite file preserve enough of the real curriculum schema
 * (courses -> levels -> modules -> lessons -> lesson_sections /
 * lesson_exercises, plus the *_translations override tables) for the real,
 * unmodified production functions -- evaluateExerciseAnswer,
 * hasCompleteResponse, buildPlayerSteps, computeProgressPercent,
 * resolveLessonLocale, resolveTranslation -- to behave identically against
 * the bundled offline copy as they do against a live Supabase query?
 *
 * This does not re-test those functions' own correctness (see
 * src/lib/curriculum.test.ts) -- it tests that the export didn't lose or
 * corrupt the relational structure they depend on.
 */

const dbPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../content-db/quran-content.sqlite",
);

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(dbPath, { readOnly: true });
});

const VALID_CONTENT_TYPES = [
  "explanation",
  "example",
  "arabic_text",
  "vocabulary",
  "rule",
  "tip",
  "quran_example",
  "summary",
];
const VALID_EXERCISE_TYPES: LessonExerciseType[] = [
  "multiple_choice",
  "true_false",
  "letter_recognition",
  "vowel_recognition",
  "matching",
  "reading_check",
];

function loadSections(lessonId: string): LessonSection[] {
  return (
    db
      .prepare(
        `SELECT id, lesson_id, order_index, content_type, body_en, body_fr, arabic_text,
                surah_number, ayah_number, metadata_json
         FROM lesson_sections WHERE lesson_id = ? ORDER BY order_index`,
      )
      .all(lessonId) as Array<Record<string, unknown>>
  ).map((r) => ({
    ...r,
    metadata: JSON.parse(r.metadata_json as string),
    body: (r.body_en as string) ?? null, // English default; locale resolution tested separately below
  })) as unknown as LessonSection[];
}

function loadExercises(lessonId: string): LessonExercise[] {
  return (
    db
      .prepare(
        `SELECT id, lesson_id, section_id, order_index, exercise_type, prompt_en, prompt_fr,
                payload_json, explanation_en, explanation_fr, surah_number, ayah_number, review_item_type
         FROM lesson_exercises WHERE lesson_id = ? ORDER BY order_index`,
      )
      .all(lessonId) as Array<Record<string, unknown>>
  ).map((r) => {
    const payload = JSON.parse(r.payload_json as string);
    return {
      ...r,
      payload,
      resolvedPayload: payload, // no fr override present for this row; same default the app itself falls back to
      prompt: r.prompt_en as string,
      explanation: (r.explanation_en as string) ?? null,
    };
  }) as unknown as LessonExercise[];
}

describe("exported curriculum hierarchy is fully referentially intact", () => {
  test("every level belongs to an exported course", () => {
    const orphans = db
      .prepare(
        `SELECT COUNT(*) as n FROM levels l
         WHERE NOT EXISTS (SELECT 1 FROM courses c WHERE c.id = l.course_id)`,
      )
      .get() as { n: number };
    expect(orphans.n).toBe(0);
  });

  test("every module belongs to an exported level", () => {
    const orphans = db
      .prepare(
        `SELECT COUNT(*) as n FROM modules m
         WHERE NOT EXISTS (SELECT 1 FROM levels l WHERE l.id = m.level_id)`,
      )
      .get() as { n: number };
    expect(orphans.n).toBe(0);
  });

  test("every lesson belongs to an exported module", () => {
    const orphans = db
      .prepare(
        `SELECT COUNT(*) as n FROM lessons le
         WHERE NOT EXISTS (SELECT 1 FROM modules m WHERE m.id = le.module_id)`,
      )
      .get() as { n: number };
    expect(orphans.n).toBe(0);
  });

  test("every lesson_section belongs to an exported lesson, with a valid content_type", () => {
    const orphans = db
      .prepare(
        `SELECT COUNT(*) as n FROM lesson_sections s
         WHERE NOT EXISTS (SELECT 1 FROM lessons le WHERE le.id = s.lesson_id)`,
      )
      .get() as { n: number };
    expect(orphans.n).toBe(0);

    const types = db.prepare(`SELECT DISTINCT content_type FROM lesson_sections`).all() as Array<{
      content_type: string;
    }>;
    for (const t of types) {
      expect(VALID_CONTENT_TYPES, `unexpected content_type: ${t.content_type}`).toContain(
        t.content_type,
      );
    }
  });

  test("every lesson_exercise belongs to an exported lesson, with a valid exercise_type", () => {
    const orphans = db
      .prepare(
        `SELECT COUNT(*) as n FROM lesson_exercises e
         WHERE NOT EXISTS (SELECT 1 FROM lessons le WHERE le.id = e.lesson_id)`,
      )
      .get() as { n: number };
    expect(orphans.n).toBe(0);

    const types = db.prepare(`SELECT DISTINCT exercise_type FROM lesson_exercises`).all() as Array<{
      exercise_type: string;
    }>;
    for (const t of types) {
      expect(VALID_EXERCISE_TYPES, `unexpected exercise_type: ${t.exercise_type}`).toContain(
        t.exercise_type as LessonExerciseType,
      );
    }
  });

  test("every lesson_vocabulary_words link resolves to an exported lesson and word_frequency row", () => {
    const orphanLessons = db
      .prepare(
        `SELECT COUNT(*) as n FROM lesson_vocabulary_words v
         WHERE NOT EXISTS (SELECT 1 FROM lessons le WHERE le.id = v.lesson_id)`,
      )
      .get() as { n: number };
    expect(orphanLessons.n).toBe(0);

    const orphanWords = db
      .prepare(
        `SELECT COUNT(*) as n FROM lesson_vocabulary_words v
         WHERE NOT EXISTS (SELECT 1 FROM word_frequency w WHERE w.id = v.word_id)`,
      )
      .get() as { n: number };
    expect(orphanWords.n).toBe(0);
  });
});

describe("real production grading logic evaluates exported exercises correctly", () => {
  for (const exerciseType of VALID_EXERCISE_TYPES) {
    test(`at least one exported ${exerciseType} exercise grades correctly via evaluateExerciseAnswer`, () => {
      const row = db
        .prepare(`SELECT lesson_id FROM lesson_exercises WHERE exercise_type = ? LIMIT 1`)
        .get(exerciseType) as { lesson_id: string } | undefined;

      if (!row) {
        // Not every exercise_type is guaranteed to exist in production yet;
        // skip rather than fail if production simply hasn't authored one.
        return;
      }

      const exercises = loadExercises(row.lesson_id).filter(
        (e) => e.exercise_type === exerciseType,
      );
      expect(exercises.length).toBeGreaterThan(0);
      const exercise = exercises[0]!;

      if (exerciseType === "matching") {
        const pairs =
          (exercise.resolvedPayload["pairs"] as { left: string; right: string }[] | undefined) ??
          [];
        expect(pairs.length).toBeGreaterThan(0);
        const correctResponse = {
          kind: "matching" as const,
          selections: pairs.map((p) => p.right),
        };
        expect(hasCompleteResponse(exercise, correctResponse)).toBe(true);
        expect(evaluateExerciseAnswer(exercise, correctResponse)).toBe(true);
        const wrongResponse = {
          kind: "matching" as const,
          selections: pairs.map((p) => `not-${p.right}`),
        };
        expect(evaluateExerciseAnswer(exercise, wrongResponse)).toBe(false);
      } else if (exerciseType === "true_false") {
        const correctAnswer = exercise.payload["correctAnswer"] as boolean;
        expect(typeof correctAnswer).toBe("boolean");
        expect(evaluateExerciseAnswer(exercise, { kind: "boolean", value: correctAnswer })).toBe(
          true,
        );
        expect(evaluateExerciseAnswer(exercise, { kind: "boolean", value: !correctAnswer })).toBe(
          false,
        );
      } else {
        const correctIndex = exercise.payload["correctIndex"] as number;
        expect(typeof correctIndex).toBe("number");
        expect(evaluateExerciseAnswer(exercise, { kind: "choice", index: correctIndex })).toBe(
          true,
        );
        expect(evaluateExerciseAnswer(exercise, { kind: "choice", index: correctIndex + 1 })).toBe(
          false,
        );
      }
    });
  }
});

describe("real production lesson-player flattening works against exported sections/exercises", () => {
  test("buildPlayerSteps and computeProgressPercent behave consistently for a real exported lesson", () => {
    const lesson = db
      .prepare(
        `SELECT le.id FROM lessons le
         WHERE EXISTS (SELECT 1 FROM lesson_sections s WHERE s.lesson_id = le.id)
         LIMIT 1`,
      )
      .get() as { id: string } | undefined;
    expect(lesson, "expected at least one lesson with sections in the export").toBeTruthy();

    const sections = loadSections(lesson!.id);
    const exercises = loadExercises(lesson!.id);
    expect(sections.length).toBeGreaterThan(0);

    const steps = buildPlayerSteps(sections, exercises);
    expect(steps.length).toBe(sections.length + exercises.length);

    // Every exercise tied to a section (section_id set) must appear
    // immediately after that section in the flattened sequence.
    for (const exercise of exercises.filter((e) => e.section_id)) {
      const sectionIdx = steps.findIndex(
        (s) => s.type === "section" && s.section.id === exercise.section_id,
      );
      const exerciseIdx = steps.findIndex(
        (s) => s.type === "exercise" && s.exercise.id === exercise.id,
      );
      expect(sectionIdx).toBeGreaterThanOrEqual(0);
      expect(exerciseIdx).toBeGreaterThan(sectionIdx);
    }

    expect(computeProgressPercent(0, steps.length)).toBeGreaterThan(0);
    expect(computeProgressPercent(steps.length - 1, steps.length)).toBe(100);
  });
});

describe("real production locale-resolution logic works against exported *_translations rows", () => {
  test("resolveTranslation picks the matching locale row, falling back to English", () => {
    const rows = [
      { locale: "en", title: "English title" },
      { locale: "fr", title: "Titre français" },
    ];
    expect(resolveTranslation(rows, "fr")?.title).toBe("Titre français");
    expect(resolveTranslation(rows, "en")?.title).toBe("English title");
    expect(resolveTranslation([{ locale: "en", title: "only English" }], "fr")?.title).toBe(
      "only English",
    );
  });

  test("a lesson missing any French section/exercise translation falls back entirely to English (never mixed)", () => {
    const lessonsWithSections = db
      .prepare(
        `SELECT DISTINCT le.id FROM lessons le
         JOIN lesson_sections s ON s.lesson_id = le.id`,
      )
      .all() as Array<{ id: string }>;
    expect(lessonsWithSections.length).toBeGreaterThan(0);

    for (const { id: lessonId } of lessonsWithSections) {
      const sectionIds = (
        db.prepare(`SELECT id FROM lesson_sections WHERE lesson_id = ?`).all(lessonId) as Array<{
          id: string;
        }>
      ).map((r) => r.id);
      const exerciseIds = (
        db.prepare(`SELECT id FROM lesson_exercises WHERE lesson_id = ?`).all(lessonId) as Array<{
          id: string;
        }>
      ).map((r) => r.id);

      const hasLessonFr = Boolean(
        db
          .prepare(`SELECT 1 FROM lesson_translations WHERE lesson_id = ? AND locale = 'fr'`)
          .get(lessonId),
      );
      const sectionLocales = new Map(
        sectionIds.map((sid) => [
          sid,
          new Set(
            (
              db
                .prepare(`SELECT locale FROM lesson_section_translations WHERE section_id = ?`)
                .all(sid) as Array<{ locale: string }>
            ).map((r) => r.locale),
          ),
        ]),
      );
      const exerciseLocales = new Map(
        exerciseIds.map((eid) => [
          eid,
          new Set(
            (
              db
                .prepare(`SELECT locale FROM lesson_exercise_translations WHERE exercise_id = ?`)
                .all(eid) as Array<{ locale: string }>
            ).map((r) => r.locale),
          ),
        ]),
      );

      const resolved = resolveLessonLocale(
        "fr",
        hasLessonFr,
        sectionIds,
        sectionLocales,
        exerciseIds,
        exerciseLocales,
      );

      const fullyTranslated =
        hasLessonFr &&
        sectionIds.every((sid) => sectionLocales.get(sid)?.has("fr")) &&
        exerciseIds.every((eid) => exerciseLocales.get(eid)?.has("fr"));

      expect(resolved).toBe(fullyTranslated ? "fr" : "en");
    }
  });
});

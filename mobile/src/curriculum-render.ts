/**
 * Duplicated (not imported) from src/lib/curriculum.ts and
 * src/lib/locale-resolution.ts for the same genuine build-separation
 * reason as kazimirski-render.ts: this is dependency-free application
 * logic bundled directly into the mobile app, never a live import across
 * the web/mobile boundary. mobile/scripts/curriculum-export.test.ts is the
 * fidelity guard -- it exercises the real, unmodified production functions
 * against the exported SQLite, proving the export's relational structure
 * supports this same logic; keeping this file's behavior identical to the
 * original on any future change to either side is a manual, reviewed
 * responsibility, same as kazimirski-render.ts's.
 */

export type Locale = string;

export type LessonSectionContentType =
  | "explanation"
  | "example"
  | "arabic_text"
  | "vocabulary"
  | "rule"
  | "tip"
  | "quran_example"
  | "summary";

export type LessonExerciseType =
  | "multiple_choice"
  | "true_false"
  | "letter_recognition"
  | "vowel_recognition"
  | "matching"
  | "reading_check";

export type LessonSection = {
  id: string;
  lesson_id: string;
  order_index: number;
  content_type: LessonSectionContentType;
  body_en: string | null;
  body_fr: string | null;
  arabic_text: string | null;
  surah_number: number | null;
  ayah_number: number | null;
  metadata: Record<string, unknown>;
  body: string | null;
};

export type LessonExercise = {
  id: string;
  lesson_id: string;
  section_id: string | null;
  order_index: number;
  exercise_type: LessonExerciseType;
  prompt_en: string;
  prompt_fr: string;
  payload: Record<string, unknown>;
  explanation_en: string | null;
  explanation_fr: string | null;
  surah_number: number | null;
  ayah_number: number | null;
  review_item_type: "letter" | "word" | "concept" | "ayah" | "root";
  prompt: string;
  explanation: string | null;
  resolvedPayload: Record<string, unknown>;
};

export function resolveTranslation<T extends { locale: string }>(
  rows: readonly T[] | null | undefined,
  locale: Locale,
): T | null {
  if (!rows || rows.length === 0) return null;
  return rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === "en") ?? null;
}

export function resolveLessonLocale(
  locale: Locale,
  hasLessonTranslation: boolean,
  sectionIds: readonly string[],
  sectionLocales: ReadonlyMap<string, ReadonlySet<Locale>>,
  exerciseIds: readonly string[],
  exerciseLocales: ReadonlyMap<string, ReadonlySet<Locale>>,
): Locale {
  if (locale === "en") return "en";
  const lessonOk = hasLessonTranslation;
  const sectionsOk = sectionIds.every((id) => sectionLocales.get(id)?.has(locale));
  const exercisesOk = exerciseIds.every((id) => exerciseLocales.get(id)?.has(locale));
  return lessonOk && sectionsOk && exercisesOk ? locale : "en";
}

export type PlayerStep =
  { type: "section"; section: LessonSection } | { type: "exercise"; exercise: LessonExercise };

export function buildPlayerSteps(
  sections: LessonSection[],
  exercises: LessonExercise[],
): PlayerStep[] {
  const steps: PlayerStep[] = [];
  const attached = new Set<string>();
  for (const section of sections) {
    steps.push({ type: "section", section });
    for (const exercise of exercises.filter((e) => e.section_id === section.id)) {
      steps.push({ type: "exercise", exercise });
      attached.add(exercise.id);
    }
  }
  for (const exercise of exercises) {
    if (!attached.has(exercise.id)) steps.push({ type: "exercise", exercise });
  }
  return steps;
}

export function computeProgressPercent(stepIndex: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  return Math.round(((stepIndex + 1) / totalSteps) * 100);
}

export function clampStepIndex(index: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  return Math.min(Math.max(index, 0), totalSteps - 1);
}

export function isLastStep(stepIndex: number, totalSteps: number): boolean {
  return totalSteps > 0 && stepIndex >= totalSteps - 1;
}

export type ExerciseResponse =
  | { kind: "choice"; index: number }
  | { kind: "boolean"; value: boolean }
  | { kind: "matching"; selections: (string | null)[] };

export function hasCompleteResponse(
  exercise: LessonExercise,
  response: ExerciseResponse | null,
): boolean {
  if (!response) return false;
  if (exercise.exercise_type === "matching") {
    return response.kind === "matching" && response.selections.every((s) => s !== null);
  }
  return response.kind === "choice" || response.kind === "boolean";
}

export function evaluateExerciseAnswer(
  exercise: LessonExercise,
  response: ExerciseResponse,
): boolean {
  switch (exercise.exercise_type) {
    case "multiple_choice":
    case "letter_recognition":
    case "vowel_recognition":
    case "reading_check": {
      if (response.kind !== "choice") return false;
      const correctIndex = exercise.payload["correctIndex"];
      return typeof correctIndex === "number" && response.index === correctIndex;
    }
    case "true_false": {
      if (response.kind !== "boolean") return false;
      const correctAnswer = exercise.payload["correctAnswer"];
      return typeof correctAnswer === "boolean" && response.value === correctAnswer;
    }
    case "matching": {
      if (response.kind !== "matching") return false;
      const pairs =
        (exercise.resolvedPayload["pairs"] as { left: string; right: string }[] | undefined) ?? [];
      if (pairs.length === 0 || response.selections.length !== pairs.length) return false;
      return pairs.every((pair, i) => response.selections[i] === pair.right);
    }
    default:
      return false;
  }
}

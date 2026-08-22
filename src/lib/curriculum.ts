import { supabase } from "@/integrations/supabase/client";
import type { Locale } from "@/lib/i18n";
import type { WordFrequency } from "@/lib/vocabulary";

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

export type ReviewItemTypeForExercise = "letter" | "word" | "concept" | "ayah" | "root";

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
};

export type Module = {
  id: string;
  level_id: string;
  slug: string;
  title_en: string;
  title_fr: string;
  goal_en: string | null;
  goal_fr: string | null;
  order_index: number;
};

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
};

/**
 * `payload`'s shape depends on `exercise_type` — documented on the 2.1
 * migration and re-narrowed at the point of use (evaluateExerciseAnswer,
 * the exercise renderer). Never assumed shaped without checking.
 */
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
  review_item_type: ReviewItemTypeForExercise;
};

export type LessonVocabularyWord = { order_index: number; word: WordFrequency };

export type LessonForPlayer = {
  id: string;
  module_id: string;
  slug: string;
  title_en: string;
  title_fr: string;
  order_index: number;
  estimated_minutes: number;
  module: Module;
  level: Level;
  sections: LessonSection[];
  exercises: LessonExercise[];
  vocabulary: LessonVocabularyWord[];
};

export type UserLessonProgress = {
  id: string;
  user_id: string;
  lesson_id: string;
  status: "not_started" | "in_progress" | "completed";
  progress_percent: number;
  last_section_index: number;
  started_at: string | null;
  completed_at: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidLessonId(value: string): boolean {
  return UUID_RE.test(value);
}

export function pickLocale<T extends string | null>(en: T, fr: T, locale: Locale): T {
  return locale === "fr" ? fr : en;
}

/**
 * Fetches everything the lesson player needs in one pass: the lesson, its
 * module and level (for breadcrumb context), ordered sections, ordered
 * exercises, and linked vocabulary words. Runs as a small dependency-staged
 * batch (not one request per row) rather than a single embedded query —
 * matching this codebase's existing Promise.all convention (see
 * src/lib/learner.ts) instead of introducing untested nested-embed syntax.
 * Returns null when the lesson doesn't exist (safe not-found, no throw) or
 * the id isn't even a syntactically valid UUID (skips the round-trip).
 */
export async function fetchLessonForPlayer(
  lessonId: string,
  signal?: AbortSignal,
): Promise<LessonForPlayer | null> {
  if (!isValidLessonId(lessonId)) return null;

  let lessonQuery = supabase.from("lessons").select("*").eq("id", lessonId);
  if (signal) lessonQuery = lessonQuery.abortSignal(signal);
  const { data: lesson, error: lessonError } = await lessonQuery.maybeSingle();
  if (lessonError) throw lessonError;
  if (!lesson) return null;

  const [moduleRes, sectionsRes, exercisesRes, vocabLinksRes] = await Promise.all([
    supabase.from("modules").select("*").eq("id", lesson.module_id).maybeSingle(),
    supabase
      .from("lesson_sections")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("order_index", { ascending: true }),
    supabase
      .from("lesson_exercises")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("order_index", { ascending: true }),
    supabase
      .from("lesson_vocabulary_words")
      .select("order_index, word_id")
      .eq("lesson_id", lessonId)
      .order("order_index", { ascending: true }),
  ]);
  if (moduleRes.error) throw moduleRes.error;
  if (sectionsRes.error) throw sectionsRes.error;
  if (exercisesRes.error) throw exercisesRes.error;
  if (vocabLinksRes.error) throw vocabLinksRes.error;
  if (!moduleRes.data) throw new Error(`Lesson ${lessonId} references a missing module.`);

  const vocabLinks = vocabLinksRes.data ?? [];
  const [levelRes, wordsRes] = await Promise.all([
    supabase.from("levels").select("*").eq("id", moduleRes.data.level_id).maybeSingle(),
    vocabLinks.length > 0
      ? supabase
          .from("word_frequency")
          .select("*")
          .in(
            "id",
            vocabLinks.map((v) => v.word_id),
          )
      : Promise.resolve({ data: [] as WordFrequency[], error: null }),
  ]);
  if (levelRes.error) throw levelRes.error;
  if (wordsRes.error) throw wordsRes.error;
  if (!levelRes.data) throw new Error(`Module ${moduleRes.data.id} references a missing level.`);

  const wordsById = new Map((wordsRes.data ?? []).map((w) => [w.id, w]));
  const vocabulary: LessonVocabularyWord[] = vocabLinks
    .map((v) => ({ order_index: v.order_index, word: wordsById.get(v.word_id) }))
    .filter((v): v is LessonVocabularyWord => Boolean(v.word));

  return {
    ...lesson,
    module: moduleRes.data,
    level: levelRes.data,
    sections: (sectionsRes.data ?? []) as LessonSection[],
    exercises: (exercisesRes.data ?? []) as LessonExercise[],
    vocabulary,
  };
}

export async function fetchLessonProgress(
  userId: string,
  lessonId: string,
): Promise<UserLessonProgress | null> {
  const { data, error } = await supabase
    .from("user_lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw error;
  return data as UserLessonProgress | null;
}

/** Idempotent upsert into `in_progress`. `startedAt` should be the existing
 * row's started_at when resuming, so re-entering a lesson never resets it. */
export async function upsertLessonProgressInProgress(
  userId: string,
  lessonId: string,
  stepIndex: number,
  progressPercent: number,
  startedAt: string,
): Promise<void> {
  const { error } = await supabase.from("user_lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      status: "in_progress",
      started_at: startedAt,
      completed_at: null,
      last_section_index: stepIndex,
      progress_percent: progressPercent,
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) throw error;
}

export async function upsertLessonProgressCompleted(
  userId: string,
  lessonId: string,
  totalSteps: number,
  startedAt: string,
): Promise<void> {
  const { error } = await supabase.from("user_lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      status: "completed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      last_section_index: Math.max(0, totalSteps - 1),
      progress_percent: 100,
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) throw error;
}

export async function recordExerciseAttempt(
  userId: string,
  lessonId: string,
  exerciseId: string,
  correct: boolean,
  responseTimeMs?: number,
): Promise<void> {
  const { error } = await supabase.from("user_exercise_attempts").insert({
    user_id: userId,
    lesson_id: lessonId,
    exercise_id: exerciseId,
    correct,
    response_time_ms: responseTimeMs ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Pure logic (no I/O) — isolated so it's cheap to unit test if/when this
// project adds a runner; covered indirectly today by the E2E lesson-player
// suite (start/resume/complete scenarios).
// ---------------------------------------------------------------------------

export type PlayerStep =
  { type: "section"; section: LessonSection } | { type: "exercise"; exercise: LessonExercise };

/**
 * Flattens sections and exercises into one linear sequence, honoring the
 * schema's own lesson_exercises.section_id relationship: an exercise tied
 * to a section renders immediately after it; exercises with no section
 * (section_id null) render at the end, in their own order_index order.
 */
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

/** True once the learner has picked something for every required control —
 * used to gate the submit button, never to grade. */
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
        (exercise.payload["pairs"] as { left: string; right: string }[] | undefined) ?? [];
      if (pairs.length === 0 || response.selections.length !== pairs.length) return false;
      return pairs.every((pair, i) => response.selections[i] === pair.right);
    }
    default:
      return false;
  }
}

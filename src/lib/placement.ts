import { supabase } from "@/integrations/supabase/client";
import { findLevel1EntryPoint } from "./curriculum";

/**
 * Placement test + personalized learning path.
 * Questions are static, hand-written and verified. Qur'anic Arabic used here is
 * copied from Al-Fatiha / common Qur'anic vocabulary and is never generated.
 */

export type PlacementSection =
  "letters" | "forms" | "harakat" | "reading" | "vocabulary" | "comprehension" | "grammar";

export type PlacementLevel =
  | "complete_beginner"
  | "foundation"
  | "beginner_reader"
  | "developing_reader"
  | "intermediate_quranic";

export type PlacementQuestion = {
  id: string;
  section: PlacementSection;
  /** Arabic prompt shown large and RTL, when the question is about a script item. */
  arabic?: string;
  /** Language-neutral options (Arabic script or transliteration). */
  literalOptions?: string[];
  correct: number;
};

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: "q1",
    section: "letters",
    arabic: "ب",
    literalOptions: ["Bā'", "Tā'", "Thā'", "Nūn"],
    correct: 0,
  },
  { id: "q2", section: "letters", literalOptions: ["م", "ن", "ح", "ع"], correct: 0 },
  { id: "q3", section: "forms", arabic: "ك", literalOptions: ["كـ", "ـك", "ـكـ", "ك"], correct: 0 },
  {
    id: "q4",
    section: "forms",
    literalOptions: ["الْحَمْدُ", "أُمّ", "هُوَ", "دَعَا"],
    correct: 0,
  },
  { id: "q5", section: "harakat", literalOptions: ["فَ", "فِ", "فُ", "فْ"], correct: 2 },
  { id: "q6", section: "harakat", arabic: "رَبِّ", correct: 1 },
  {
    id: "q7",
    section: "reading",
    arabic: "كِتَاب",
    literalOptions: ["kitāb", "katab", "kutub", "kataba"],
    correct: 0,
  },
  { id: "q8", section: "vocabulary", arabic: "رَحْمَة", correct: 0 },
  { id: "q9", section: "vocabulary", arabic: "رَبّ", correct: 0 },
  {
    id: "q10",
    section: "comprehension",
    arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
    correct: 0,
  },
  { id: "q11", section: "grammar", arabic: "بِسْمِ اللَّهِ", correct: 0 },
  { id: "q12", section: "grammar", arabic: "الْمُسْلِمُونَ", correct: 1 },
];

export const PLACEMENT_LEVELS: PlacementLevel[] = [
  "complete_beginner",
  "foundation",
  "beginner_reader",
  "developing_reader",
  "intermediate_quranic",
];

/** Ordered stages of the learning path. */
export const PATH_STEPS = [
  "alphabet",
  "harakat",
  "connected_letters",
  "reading",
  "vocabulary",
  "roots",
  "grammar",
  "ayah_comprehension",
  "surah_mastery",
] as const;

export type PathStepKey = (typeof PATH_STEPS)[number];

/** Where each placement level starts on the path. */
export const LEVEL_START_STEP: Record<PlacementLevel, PathStepKey> = {
  complete_beginner: "alphabet",
  foundation: "harakat",
  beginner_reader: "connected_letters",
  developing_reader: "vocabulary",
  intermediate_quranic: "grammar",
};

export type PlacementResult = {
  score: number;
  total: number;
  sectionScores: Record<string, { correct: number; total: number }>;
  level: PlacementLevel;
  /** Sections the learner missed at least one question in — drives the "reason" text. */
  weakSections: PlacementSection[];
};

export function scorePlacement(answers: Record<string, number | undefined>): PlacementResult {
  const sectionScores: Record<string, { correct: number; total: number }> = {};
  let score = 0;

  for (const question of PLACEMENT_QUESTIONS) {
    const bucket = (sectionScores[question.section] ??= { correct: 0, total: 0 });
    bucket.total += 1;
    if (answers[question.id] === question.correct) {
      bucket.correct += 1;
      score += 1;
    }
  }

  const total = PLACEMENT_QUESTIONS.length;
  const ratio = total === 0 ? 0 : score / total;
  const level: PlacementLevel =
    ratio < 0.25
      ? "complete_beginner"
      : ratio < 0.45
        ? "foundation"
        : ratio < 0.65
          ? "beginner_reader"
          : ratio < 0.85
            ? "developing_reader"
            : "intermediate_quranic";

  const weakSections = (Object.keys(sectionScores) as PlacementSection[]).filter(
    (section) => sectionScores[section]!.correct < sectionScores[section]!.total,
  );

  return { score, total, sectionScores, level, weakSections };
}

/** Steps before the starting step count as already covered. */
export function buildPathSteps(level: PlacementLevel) {
  const startIndex = PATH_STEPS.indexOf(LEVEL_START_STEP[level]);
  return PATH_STEPS.map((step, index) => ({
    step_key: step,
    order_index: index,
    status:
      index < startIndex
        ? ("completed" as const)
        : index === startIndex
          ? ("in_progress" as const)
          : index === startIndex + 1
            ? ("available" as const)
            : ("locked" as const),
    progress: index < startIndex ? 100 : 0,
  }));
}

export type LearningPathStep = {
  id: string;
  step_key: string;
  order_index: number;
  status: "locked" | "available" | "in_progress" | "completed";
  progress: number;
  /** Real curriculum entry point for this step, when one exists. Null for
   * every step whose module has no real content yet (Task H: never a
   * guessed/fake link), and for legacy rows saved before this column
   * existed — those pick one up the next time the path is regenerated. */
  lesson_id: string | null;
};

export type LearningPath = {
  id: string;
  level: PlacementLevel;
  source: string;
  steps: LearningPathStep[];
};

export async function fetchLearningPath(userId: string): Promise<LearningPath | null> {
  const { data: path } = await supabase
    .from("learning_paths")
    .select("id, level, source")
    .eq("user_id", userId)
    .maybeSingle();
  if (!path) return null;

  const { data: steps } = await supabase
    .from("learning_path_steps")
    .select("id, step_key, order_index, status, progress, lesson_id")
    .eq("path_id", path.id)
    .order("order_index", { ascending: true });

  return {
    id: path.id,
    level: path.level as PlacementLevel,
    source: path.source,
    steps: (steps ?? []) as LearningPathStep[],
  };
}

/**
 * Creates or replaces the learner's path for the chosen level.
 *
 * The 'alphabet' step's lesson_id/status/progress are always overridden
 * from real user_lesson_progress via findLevel1EntryPoint, regardless of
 * level — never left at buildPathSteps' synthetic "completed because your
 * placement level implies you're past this" value. The placement test has
 * only 2 raw letter-recognition questions spanning both Level 1 modules
 * (see Sub-phase 2.6's own placement audit), nowhere near enough to prove
 * a learner has mastered all 28 isolated letter shapes — and Level 1 is
 * also the only real curriculum that exists at all right now, so there is
 * nowhere else real to send a higher-scoring learner anyway. Every other
 * step's lesson_id stays null: Modules 3-8 have no real content, so
 * nothing here ever fakes a link into them.
 *
 * This deletes and reinserts all 9 step rows on every call (including a
 * placement retake), same as before this sub-phase — but because status/
 * progress for the one step that matters is now derived from real
 * completion data rather than stored, a retake can never regress a
 * learner's visible progress: the recomputed value is the true value
 * either way.
 */
export async function saveLearningPath(
  userId: string,
  level: PlacementLevel,
  source: "placement" | "manual",
) {
  const { data: path, error } = await supabase
    .from("learning_paths")
    .upsert({ user_id: userId, level, source }, { onConflict: "user_id" })
    .select("id")
    .single();
  if (error || !path) throw error ?? new Error("Could not save learning path");

  const entryPoint = await findLevel1EntryPoint(userId);

  const rows = buildPathSteps(level).map((step) => {
    if (step.step_key !== "alphabet" || !entryPoint) {
      return { ...step, lesson_id: null, path_id: path.id, user_id: userId };
    }
    const status: LearningPathStep["status"] =
      entryPoint.completedCount === entryPoint.totalCount
        ? "completed"
        : entryPoint.completedCount > 0
          ? "in_progress"
          : "available";
    const progress =
      entryPoint.totalCount === 0
        ? 0
        : Math.round((entryPoint.completedCount / entryPoint.totalCount) * 100);
    return {
      ...step,
      status,
      progress,
      lesson_id: entryPoint.lessonId,
      path_id: path.id,
      user_id: userId,
    };
  });

  await supabase.from("learning_path_steps").delete().eq("path_id", path.id);
  const { error: stepsError } = await supabase.from("learning_path_steps").insert(rows);
  if (stepsError) throw stepsError;
  return path.id;
}

export async function savePlacementAttempt(
  userId: string,
  answers: Record<string, number | undefined>,
  result: PlacementResult,
) {
  const { error } = await supabase.from("placement_attempts").insert({
    user_id: userId,
    answers,
    score: result.score,
    total: result.total,
    section_scores: result.sectionScores,
    recommended_level: result.level,
  });
  if (error) throw error;
}

export async function fetchLatestPlacement(userId: string) {
  const { data } = await supabase
    .from("placement_attempts")
    .select("score, total, recommended_level, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** The single "what should I study next" answer for the dashboard. */
export function nextStep(path: LearningPath | null): LearningPathStep | null {
  if (!path) return null;
  return (
    path.steps.find((step) => step.status === "in_progress") ??
    path.steps.find((step) => step.status === "available") ??
    path.steps.find((step) => step.status !== "completed") ??
    null
  );
}

import { supabase } from "@/integrations/supabase/client";
import { findCurriculumEntryPoint, type CurriculumEntryPoint } from "./curriculum";

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

/**
 * Reads the learner's path, then resyncs every step with real curriculum
 * content (see STEP_LEVEL_SLUGS) against live user_lesson_progress before
 * returning it — the same computation saveLearningPath does at write
 * time, applied again at read time so every caller (dashboard, Daily
 * Study, learning plan) agrees with reality even between placement
 * retakes, rather than showing whatever was stored at the last retake.
 * A pure read-time projection, not a write: nothing is persisted here.
 */
export async function fetchLearningPath(userId: string): Promise<LearningPath | null> {
  const { data: path } = await supabase
    .from("learning_paths")
    .select("id, level, source")
    .eq("user_id", userId)
    .maybeSingle();
  if (!path) return null;

  const [{ data: steps }, entryPoints] = await Promise.all([
    supabase
      .from("learning_path_steps")
      .select("id, step_key, order_index, status, progress, lesson_id")
      .eq("path_id", path.id)
      .order("order_index", { ascending: true }),
    fetchStepEntryPoints(userId),
  ]);

  const resyncedSteps = ((steps ?? []) as LearningPathStep[]).map((step) => {
    const entryPoint = entryPoints[step.step_key as PathStepKey];
    return entryPoint ? { ...step, ...resolveStepFields(entryPoint) } : step;
  });

  return {
    id: path.id,
    level: path.level as PlacementLevel,
    source: path.source,
    steps: resyncedSteps,
  };
}

/**
 * Every path step backed by real, live curriculum content, keyed by
 * step_key — currently "alphabet" (Level 1, foundations-of-arabic-script)
 * and "vocabulary" (Level 2, basic-vocabulary-and-patterns, Phase 5/Batch
 * 1). A step_key absent from this map has no real content behind it yet
 * (roots/grammar/ayah_comprehension/surah_mastery) and is deliberately
 * left alone — do not add a step here speculatively before its level
 * actually has modules, the same discipline that keeps this map from
 * ever silently going stale the way the old hardcoded module list did.
 *
 * `requiresLevelSlug`, when set, gates the step on that OTHER level being
 * fully complete first — per Phase 5's placement-strategy review, Level 2
 * unlocks on Level 1 completion, never on placement score (the placement
 * test has nowhere near enough questions to certify that). Without this
 * gate, a learner still on "alphabet" would see "vocabulary" resolve to a
 * real, immediately-clickable lesson the moment Level 2 content existed
 * at all — found via the Phase 5 Batch 1 E2E boundary run, the same class
 * of check that caught the Phase 4 hardcoded-module defect.
 */
const STEP_LEVEL_SLUGS: Partial<
  Record<PathStepKey, { levelSlug: string; requiresLevelSlug?: string }>
> = {
  alphabet: { levelSlug: "foundations-of-arabic-script" },
  vocabulary: {
    levelSlug: "basic-vocabulary-and-patterns",
    requiresLevelSlug: "foundations-of-arabic-script",
  },
  roots: {
    levelSlug: "roots-and-word-patterns",
    requiresLevelSlug: "basic-vocabulary-and-patterns",
  },
};

async function fetchStepEntryPoints(
  userId: string,
): Promise<Partial<Record<PathStepKey, CurriculumEntryPoint>>> {
  const configs = Object.entries(STEP_LEVEL_SLUGS) as [
    PathStepKey,
    { levelSlug: string; requiresLevelSlug?: string },
  ][];

  const distinctLevelSlugs = [
    ...new Set(
      configs.flatMap(([, c]) => [c.levelSlug, c.requiresLevelSlug].filter(Boolean) as string[]),
    ),
  ];
  const entryPointByLevelSlug = new Map(
    await Promise.all(
      distinctLevelSlugs.map(
        async (levelSlug) =>
          [levelSlug, await findCurriculumEntryPoint(userId, levelSlug)] as const,
      ),
    ),
  );

  const result: Partial<Record<PathStepKey, CurriculumEntryPoint>> = {};
  for (const [stepKey, { levelSlug, requiresLevelSlug }] of configs) {
    if (requiresLevelSlug) {
      const prerequisite = entryPointByLevelSlug.get(requiresLevelSlug);
      const prerequisiteComplete =
        prerequisite != null && prerequisite.completedCount === prerequisite.totalCount;
      if (!prerequisiteComplete) continue;
    }
    const entryPoint = entryPointByLevelSlug.get(levelSlug);
    if (entryPoint) result[stepKey] = entryPoint;
  }
  return result;
}

/**
 * Creates or replaces the learner's path for the chosen level.
 *
 * Every step in STEP_LEVEL_SLUGS has its lesson_id/status/progress always
 * overridden from real user_lesson_progress, regardless of the learner's
 * placement level — never left at buildPathSteps' synthetic "completed
 * because your placement level implies you're past this" value. The
 * placement test has only 2 raw letter-recognition questions and 2
 * vocabulary questions (see Sub-phase 2.6's own placement audit and the
 * Phase 5 placement-strategy review), nowhere near enough to prove
 * mastery of either level's full content — so a higher placement score
 * never fakes completion of real content the learner hasn't actually
 * done. Every other step's lesson_id stays null: those levels have no
 * real content yet, so nothing here ever fakes a link into them.
 *
 * This deletes and reinserts all 9 step rows on every call (including a
 * placement retake), same as before this sub-phase — but because status/
 * progress for every step that matters is now derived from real
 * completion data rather than stored, a retake can never regress a
 * learner's visible progress: the recomputed value is the true value
 * either way.
 */
/** Shared by saveLearningPath (write) and fetchLearningPath (read-time
 * resync) — the one place that turns a live findCurriculumEntryPoint
 * result into a step's displayed status/progress/lesson_id. */
function resolveStepFields(entryPoint: CurriculumEntryPoint): {
  status: LearningPathStep["status"];
  progress: number;
  lesson_id: string;
} {
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
  return { status, progress, lesson_id: entryPoint.lessonId };
}

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

  const entryPoints = await fetchStepEntryPoints(userId);

  const rows = buildPathSteps(level).map((step) => {
    const entryPoint = entryPoints[step.step_key];
    if (!entryPoint) {
      return { ...step, lesson_id: null, path_id: path.id, user_id: userId };
    }
    return {
      ...step,
      ...resolveStepFields(entryPoint),
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

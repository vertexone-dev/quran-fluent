import { supabase } from "@/integrations/supabase/client";
import type { CurriculumEntryPoint, LessonExercise } from "./curriculum";
import type { PlacementResult, PlacementSection } from "./placement";
import type { WordFrequency } from "./vocabulary";

export type ReviewItemType = "letter" | "word" | "concept" | "ayah" | "root";

export type ReviewItemStatus = "new" | "learning" | "review" | "relearning" | "suspended";

export type ReviewItem = {
  id: string;
  user_id: string;
  item_type: ReviewItemType;
  item_key: string;
  front: string;
  back: string;
  context: string | null;
  step_key: string | null;
  status: ReviewItemStatus;
  due_date: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  lapses: number;
  last_reviewed_at: string | null;
};

export type WeakArea = {
  id: string;
  area: string;
  source: "placement" | "practice" | "self_assessed";
  strength: number;
  last_practiced_at: string | null;
};

export type DailyStudyItem =
  | { kind: "review"; item: ReviewItem }
  | { kind: "weak_area"; area: WeakArea }
  | { kind: "path_preview"; step_key: string; label: string; blurb: string };

export type StudySession = {
  id: string;
  activity_type: string;
  minutes: number;
  occurred_at: string;
};

export type DailyStats = {
  items_studied: number;
  items_correct: number;
  minutes: number;
  completed: boolean;
};

/** Section names from placement map to review item types and weak-area labels. */
const SECTION_WEAK_AREAS: Record<PlacementSection, { area: string; itemType: ReviewItemType }> = {
  letters: { area: "Letter recognition", itemType: "letter" },
  forms: { area: "Letter forms", itemType: "letter" },
  harakat: { area: "Harakat", itemType: "concept" },
  reading: { area: "Reading words", itemType: "word" },
  vocabulary: { area: "Qur'anic vocabulary", itemType: "word" },
  comprehension: { area: "Ayah comprehension", itemType: "ayah" },
  grammar: { area: "Grammar foundations", itemType: "concept" },
};

/** A tiny verified starter set used until full lesson content is available. */
const STARTER_CONTENT: Record<string, { front: string; back: string; context?: string }[]> = {
  alphabet: [
    { front: "ب", back: "Bā'", context: "Second letter of the Arabic alphabet" },
    { front: "م", back: "Mīm", context: "Mim letter, like the sound in 'moon'" },
    { front: "ن", back: "Nūn", context: "Nun letter, like the sound in 'nun'" },
  ],
  harakat: [
    { front: "فَ", back: "fa — Fatha (a)", context: "Short vowel 'a'" },
    { front: "فِ", back: "fi — Kasra (i)", context: "Short vowel 'i'" },
    { front: "فُ", back: "fu — Damma (u)", context: "Short vowel 'u'" },
  ],
  connected_letters: [
    {
      front: "كـ / ـك / ـكـ / ك",
      back: "All forms of Kāf",
      context: "Initial, medial, final and isolated",
    },
  ],
  reading: [{ front: "كِتَاب", back: "kitāb — book", context: "A common Qur'anic word" }],
  vocabulary: [
    { front: "رَحْمَة", back: "mercy", context: "One of the most frequent words in the Qur'an" },
    { front: "رَبّ", back: "Lord and Sustainer", context: "Often paired with 'al-'ālamīn'" },
  ],
  roots: [
    { front: "ك-ت-ب", back: "Root K-T-B: writing", context: "Yields kitāb, kātib, maktaba…" },
  ],
  grammar: [
    { front: "بِسْمِ", back: "bi-smi — 'in the name of'", context: "Preposition bi- + noun" },
  ],
  ayah_comprehension: [
    {
      front: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
      back: "All praise is due to Allah, Lord of the worlds",
      context: "Al-Fatiha 1:2",
    },
  ],
  surah_mastery: [
    {
      front: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      back: "In the name of Allah, the Most Gracious, the Most Merciful",
      context: "Every Surah but one begins with this",
    },
  ],
};

/**
 * Spaced repetition works on the learner's *local* calendar day. Using the UTC
 * date made cards appear due (or not due) up to a day early/late depending on
 * the timezone, so every date here goes through these helpers.
 */
export function localDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfLocalDay(date: Date = new Date()): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** SM-2 bounds: ease never runs away, never collapses below 1.3. */
const MIN_EASE = 1.3;
const MAX_EASE = 2.5;
const MAX_INTERVAL_DAYS = 365;

/** Convert a placement result into weak-area rows and review items for missed questions. */
export async function seedFromPlacement(userId: string, result: PlacementResult) {
  const weakAreas = result.weakSections.map((section) => {
    const mapping = SECTION_WEAK_AREAS[section];
    return {
      user_id: userId,
      area: mapping.area,
      source: "placement" as const,
      strength: 25,
    };
  });

  if (weakAreas.length > 0) {
    await supabase.from("weak_areas").upsert(weakAreas, {
      onConflict: "user_id, area, source",
      ignoreDuplicates: false,
    });
  }

  // Seed from the section-level mapping rather than per-question
  // to keep the first review set manageable and tied to weak areas.
  const reviewRows: {
    user_id: string;
    item_type: ReviewItemType;
    item_key: string;
    front: string;
    back: string;
    context: string;
    step_key: string;
  }[] = [];

  // to keep the first review set manageable and tied to weak areas.
  for (const section of result.weakSections) {
    const mapping = SECTION_WEAK_AREAS[section];
    const starter = STARTER_CONTENT[section === "forms" ? "alphabet" : section] ?? [];
    for (const item of starter.slice(0, 2)) {
      reviewRows.push({
        user_id: userId,
        item_type: mapping.itemType,
        item_key: `${section}:${item.front}`,
        front: item.front,
        back: item.back,
        context: item.context ?? "",
        step_key: section,
      });
    }
  }

  if (reviewRows.length > 0) {
    await supabase.from("review_items").upsert(reviewRows, {
      onConflict: "user_id, item_key",
      ignoreDuplicates: true,
    });
  }
}

/** Seed a few starter items for the current learning-path step. */
export async function seedStarterItemsForStep(userId: string, stepKey: string) {
  const content = STARTER_CONTENT[stepKey] ?? [];
  const rows = content.map((item) => ({
    user_id: userId,
    item_type: (stepKey === "roots"
      ? "root"
      : stepKey === "ayah_comprehension" || stepKey === "surah_mastery"
        ? "ayah"
        : stepKey === "vocabulary" || stepKey === "reading"
          ? "word"
          : "letter") as ReviewItemType,
    item_key: `${stepKey}:${item.front}`,
    front: item.front,
    back: item.back,
    context: item.context ?? "",
    step_key: stepKey,
  }));

  if (rows.length > 0) {
    await supabase.from("review_items").upsert(rows, {
      onConflict: "user_id, item_key",
      ignoreDuplicates: true,
    });
  }
}

/**
 * Build today's queue: due review items, then a weak-area focus. The
 * abstract path-preview fallback is appended only when there's no real
 * lesson to recommend at all (a future, not-yet-built module).
 *
 * The recommended lesson itself is deliberately NOT a queue item here — an
 * earlier version pushed one as a swipeable `{kind: "lesson"}` card, but
 * unlike every other card in this queue it's a one-way exit link (opening
 * the real Lesson Player), never something `advance()` can mark answered.
 * A learner who reached it without clicking through would sit on an
 * un-completable queue forever, and the finished/session-summary screen —
 * along with the study-time logging tied to it — would never fire even
 * though they'd genuinely finished every review. The caller instead shows
 * the recommended lesson alongside the empty/finished states directly,
 * using the live `findLevel1EntryPoint` result it already holds.
 *
 * `lessonEntryPoint` (Sub-phase 2.7) is that live result, not the stored
 * learning_path_steps.lesson_id snapshot — a learner who finishes lessons
 * without retaking placement still sees the correct next lesson. When
 * Level 1 is fully complete (completedCount === totalCount), or a real
 * lesson exists at all, the path_preview fallback never fires: the caller
 * renders an honest "all done" state instead of a fake preview implying
 * content that doesn't exist (Modules 3-8 have none).
 */
export async function getTodaysStudy(
  userId: string,
  pathStep: string | null,
  limit = 12,
  lessonEntryPoint: CurriculumEntryPoint | null = null,
): Promise<DailyStudyItem[]> {
  const today = localDate();

  const [{ data: due }, { data: weak }] = await Promise.all([
    supabase
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .lte("due_date", today)
      .neq("status", "suspended")
      .order("due_date", { ascending: true })
      .limit(limit),
    supabase
      .from("weak_areas")
      .select("*")
      .eq("user_id", userId)
      .order("strength", { ascending: true })
      .limit(1),
  ]);

  const items: DailyStudyItem[] = (due ?? []).map((item) => ({
    kind: "review",
    item: item as ReviewItem,
  }));

  const weakArea = (weak ?? [])[0] as WeakArea | undefined;
  if (weakArea && items.length < limit) {
    items.push({ kind: "weak_area", area: weakArea });
  }

  if (!lessonEntryPoint && pathStep && items.length < limit) {
    items.push({ kind: "path_preview", step_key: pathStep, label: "", blurb: "" });
  }

  return items;
}

/** Count due review items for the badge. */
export async function countDueReviews(userId: string): Promise<number> {
  const today = localDate();
  const { count } = await supabase
    .from("review_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("due_date", today)
    .neq("status", "suspended");
  return count ?? 0;
}

/** Record a practice answer and update the review item using a simplified SM-2 algorithm. */
export async function recordPracticeAttempt(
  userId: string,
  item: ReviewItem,
  correct: boolean,
  responseTimeMs?: number,
) {
  const { interval_days, repetitions, ease_factor, lapses } = item;

  let nextInterval: number;
  let nextReps: number;
  let nextEase: number;
  let nextLapses: number;
  let nextStatus: ReviewItemStatus;

  if (correct) {
    nextLapses = lapses;
    nextStatus = repetitions === 0 ? "learning" : "review";
    if (repetitions === 0) {
      nextInterval = 1;
    } else if (repetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.min(
        MAX_INTERVAL_DAYS,
        Math.max(1, Math.round(interval_days * ease_factor)),
      );
    }
    nextReps = repetitions + 1;
    nextEase = Math.min(MAX_EASE, ease_factor + 0.1);
  } else {
    nextLapses = lapses + 1;
    nextReps = 0;
    nextInterval = 1;
    nextStatus = "relearning";
    nextEase = Math.max(MIN_EASE, ease_factor - 0.2);
  }

  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + nextInterval);

  await supabase
    .from("review_items")
    .update({
      status: nextStatus,
      due_date: localDate(nextDue),
      interval_days: nextInterval,
      ease_factor: nextEase,
      repetitions: nextReps,
      lapses: nextLapses,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq("user_id", userId);

  await supabase.from("practice_attempts").insert({
    user_id: userId,
    item_id: item.id,
    item_type: item.item_type,
    item_key: item.item_key,
    correct,
    response_time_ms: responseTimeMs ?? null,
  });

  // Update weak-area strength if this item is tied to a step/section.
  if (item.step_key) {
    await adjustWeakAreaStrength(userId, item.step_key, correct);
  }
}

async function adjustWeakAreaStrength(userId: string, areaKey: string, correct: boolean) {
  const label = SECTION_WEAK_AREAS[areaKey as PlacementSection]?.area ?? areaKey;
  const { data: existing } = await supabase
    .from("weak_areas")
    .select("id, strength")
    .eq("user_id", userId)
    .eq("area", label)
    .eq("source", "practice")
    .maybeSingle();

  const nextStrength = Math.max(0, Math.min(100, (existing?.strength ?? 0) + (correct ? 8 : -12)));
  await supabase.from("weak_areas").upsert(
    {
      user_id: userId,
      area: label,
      source: "practice",
      strength: nextStrength,
      last_practiced_at: new Date().toISOString(),
    },
    { onConflict: "user_id, area, source", ignoreDuplicates: false },
  );
}

/** Log a study activity minute entry. The existing study_sessions table uses activity_type/minutes/occurred_at. */
export async function logStudySession(userId: string, activityType: string, minutes: number) {
  await supabase.from("study_sessions").insert({
    user_id: userId,
    activity_type: activityType,
    minutes,
    occurred_at: new Date().toISOString(),
  });
  await touchStreak(userId);
}

/**
 * Streaks were previously only ever read, so every learner saw 0. Any logged
 * study activity now advances the streak on the learner's local calendar day:
 * same day = no change, yesterday = +1, older/never = restart at 1.
 */
export async function touchStreak(userId: string) {
  const today = localDate();
  const { data: existing } = await supabase
    .from("streaks")
    .select("current_streak, longest_streak, last_active_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.last_active_date === today) return;

  const yesterday = localDate(new Date(startOfLocalDay().getTime() - 24 * 60 * 60 * 1000));
  const current = existing?.last_active_date === yesterday ? (existing.current_streak ?? 0) + 1 : 1;
  const longest = Math.max(current, existing?.longest_streak ?? 0);

  await supabase.from("streaks").upsert(
    {
      user_id: userId,
      current_streak: current,
      longest_streak: longest,
      last_active_date: today,
    },
    { onConflict: "user_id" },
  );
}

/** Aggregate today's minutes and attempts from the activity log and practice attempts. */
export async function getDailyStats(userId: string): Promise<DailyStats> {
  const dayStart = startOfLocalDay().toISOString();
  const dayEnd = new Date(startOfLocalDay().getTime() + 24 * 60 * 60 * 1000).toISOString();
  const [{ data: attempts }, { data: sessions }] = await Promise.all([
    supabase
      .from("practice_attempts")
      .select("correct")
      .eq("user_id", userId)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),
    supabase
      .from("study_sessions")
      .select("minutes")
      .eq("user_id", userId)
      .gte("occurred_at", dayStart)
      .lt("occurred_at", dayEnd),
  ]);

  const items_studied = attempts?.length ?? 0;
  const items_correct = attempts?.filter((a) => a.correct).length ?? 0;
  const minutes = (sessions ?? []).reduce((sum, s) => sum + s.minutes, 0);

  return {
    items_studied,
    items_correct,
    minutes,
    completed: items_studied >= 5,
  };
}

export async function getWeakAreas(userId: string): Promise<WeakArea[]> {
  const { data } = await supabase
    .from("weak_areas")
    .select("id, area, source, strength, last_practiced_at")
    .eq("user_id", userId)
    .order("strength", { ascending: true });
  return (data ?? []) as WeakArea[];
}

/**
 * Turn a saved word from the vocabulary browser into a review item in the
 * spaced-repetition queue. The back of the card is in the user's interface
 * language; the front is always the Arabic word.
 */
export async function seedVocabularyToReviews(
  userId: string,
  word: WordFrequency,
  locale: "en" | "fr",
) {
  const back = locale === "fr" && word.meaning_fr ? word.meaning_fr : word.meaning;
  const contextParts = [word.transliteration ?? "", word.example_reference ?? ""].filter(Boolean);
  if (word.example_ayah) {
    contextParts.push(`“${word.example_ayah}”`);
  }

  await supabase.from("review_items").upsert(
    {
      user_id: userId,
      item_type: "word",
      item_key: `word:${word.id}`,
      front: word.word,
      back: word.transliteration ? `${back} (${word.transliteration})` : back,
      context: contextParts.join(" • "),
      step_key: "vocabulary",
    },
    { onConflict: "user_id, item_key", ignoreDuplicates: false },
  );
}

/**
 * Seeds one review_items row per {left, right} pair in a completed lesson's
 * `matching` exercises — the only exercise type whose payload structurally
 * carries both a glyph and its name together. `letter_recognition` tests
 * the same glyphs but its payload has no name field (only a choices array),
 * so a lesson with no matching exercise (e.g. the Alif lesson, Module 1's
 * first) has no reliable, non-guessed source for the name and is left
 * unseeded rather than parsed out of prose section text. `true_false` and
 * `reading_check` exercises test a whole-script or multi-letter fact, not
 * one durable glyph, so they're excluded the same way.
 *
 * item_key is scoped to the glyph alone (`${item_type}:${left}`), not the
 * lesson or exercise, so a letter re-tested by a later recap exercise
 * (chunk 2's closing lesson re-tests two chunk-1 letters) resolves to the
 * SAME review item instead of a duplicate — the durable concept is
 * "know this letter," not "encountered it in this specific exercise." That
 * scoping, combined with `ignoreDuplicates: true`, is also what makes this
 * idempotent: replaying a lesson (or a completion retry) never creates a
 * second row or resets a learner's accumulated SM-2 progress on an
 * already-seeded item.
 *
 * `back` is the transliterated name as authored (e.g. "Bā'", "Kāf") — the
 * same string regardless of interface language, since transliterations
 * aren't translated per locale anywhere else in this schema either. `back`
 * is not locale-baked because there is nothing to bake: the only
 * locale-dependent piece is `context`, so that alone takes the caller's
 * locale, following the same pattern already used by
 * seedVocabularyToReviews.
 *
 * step_key is left null: no learning_path_steps <-> curriculum module
 * mapping has been established (documented as unresolved since
 * Sub-phase 2.4), and guessing one here would silently create the exact
 * hardcoded linkage that phase explicitly avoided.
 */
export async function seedLessonReviewItems(
  userId: string,
  lesson: { title_en: string; title_fr: string; exercises: LessonExercise[] },
  locale: "en" | "fr",
): Promise<void> {
  const rows: {
    user_id: string;
    item_type: ReviewItemType;
    item_key: string;
    front: string;
    back: string;
    context: string;
    due_date: string;
  }[] = [];

  const seenKeys = new Set<string>();
  for (const exercise of lesson.exercises) {
    if (exercise.exercise_type !== "matching") continue;
    const pairs = exercise.payload["pairs"] as { left: string; right: string }[] | undefined;
    if (!pairs) continue;

    for (const pair of pairs) {
      const itemKey = `${exercise.review_item_type}:${pair.left}`;
      if (seenKeys.has(itemKey)) continue;
      seenKeys.add(itemKey);
      rows.push({
        user_id: userId,
        item_type: exercise.review_item_type,
        item_key: itemKey,
        front: pair.left,
        back: pair.right,
        context: locale === "fr" ? lesson.title_fr : lesson.title_en,
        // Explicit, not the column's CURRENT_DATE default: that default is
        // evaluated by the DB server in UTC, while every "due today" read
        // in this file (getTodaysStudy, fetchPracticeSummary's due-count,
        // countDueReviews) compares against localDate() — the learner's
        // device-local calendar day. Left implicit, a lesson completed
        // after UTC midnight but before local midnight (true every evening
        // for any timezone behind UTC) got a due_date one day in the
        // future, making a review item invisible in Practice/Daily Study
        // until the next local day even though it was seeded moments ago.
        due_date: localDate(),
      });
    }
  }

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("review_items")
    .upsert(rows, { onConflict: "user_id, item_key", ignoreDuplicates: true });
  if (error) throw error;
}

/** Remove the review item tied to a saved word when the user unsaves it. */
export async function removeVocabularyReviewItem(userId: string, wordId: string) {
  await supabase
    .from("review_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_key", `word:${wordId}`);
}

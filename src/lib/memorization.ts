import { supabase } from "@/integrations/supabase/client";
import type { Locale } from "@/lib/i18n";
import { localDate, type ReviewItem } from "@/lib/study";
import { ayahTranslation, type Ayah, type Surah } from "@/lib/quran";

export type MemorizationStatus = "not_started" | "learning" | "memorized";

export type MemorizationProgress = {
  id: string;
  user_id: string;
  surah_number: number;
  ayah_number: number;
  status: MemorizationStatus;
  started_at: string;
  memorized_at: string | null;
};

export type SurahProgress = {
  surah: Surah;
  memorizedCount: number;
  learningCount: number;
};

function ayahItemKey(surahNumber: number, ayahNumber: number): string {
  return `ayah:${surahNumber}:${ayahNumber}`;
}

export async function fetchMemorizationProgress(userId: string): Promise<MemorizationProgress[]> {
  const { data, error } = await supabase
    .from("memorization_progress")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchAyahProgress(
  userId: string,
  surahNumber: number,
  ayahNumber: number,
): Promise<MemorizationProgress | null> {
  const { data, error } = await supabase
    .from("memorization_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("surah_number", surahNumber)
    .eq("ayah_number", ayahNumber)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Schedules (or re-schedules) spaced-repetition review for an ayah through
 * the existing review engine (src/lib/study.ts / review_items) rather than
 * a separate scheduling system. ignoreDuplicates so a re-add doesn't reset
 * an item that's already partway through its review interval.
 *
 * review_items.back is NOT NULL — a flashcard needs a "back" to quiz
 * against, and this app never invents a translation to fill that gap. If
 * this Ayah has no translation yet in the active locale (true for every
 * newly-imported, not-yet-translated Ayah until Phase 2B), review
 * scheduling is skipped rather than attempted with bad data; callers use
 * the returned boolean to tell the learner why. Memorization *status*
 * tracking (startLearning / markMemorized below) never depends on this —
 * only the spaced-repetition flashcard queue does.
 */
async function scheduleReview(userId: string, ayah: Ayah, locale: Locale): Promise<boolean> {
  const back = ayahTranslation(ayah, locale);
  if (!back) return false;

  const { error } = await supabase.from("review_items").upsert(
    {
      user_id: userId,
      item_type: "ayah",
      item_key: ayahItemKey(ayah.surah_number, ayah.ayah_number),
      front: ayah.arabic_text,
      back,
      context: `${ayah.surah_number}:${ayah.ayah_number}`,
    },
    { onConflict: "user_id, item_key", ignoreDuplicates: true },
  );
  if (error) throw error;
  return true;
}

export async function startLearning(
  userId: string,
  surahNumber: number,
  ayahNumber: number,
): Promise<void> {
  const { error } = await supabase
    .from("memorization_progress")
    .upsert(
      { user_id: userId, surah_number: surahNumber, ayah_number: ayahNumber, status: "learning" },
      { onConflict: "user_id, surah_number, ayah_number", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/**
 * `reviewScheduled` tells the caller whether the spaced-repetition
 * flashcard was actually queued — false only means this Ayah has no
 * translation yet in the active locale, not that anything failed. The
 * status/progress change itself always happens regardless: memorization
 * tracking is usable before translations exist, review scheduling isn't.
 *
 * scheduleReview runs before the status upsert (not after): callers observe
 * "learning"/"memorized" by polling memorization_progress directly, and
 * that must remain a reliable signal that review scheduling has already
 * settled — reversing the order would let a status poll resolve while the
 * review_items write is still in flight.
 */
export async function addToReview(
  userId: string,
  ayah: Ayah,
  locale: Locale,
): Promise<{ reviewScheduled: boolean }> {
  const reviewScheduled = await scheduleReview(userId, ayah, locale);
  await startLearning(userId, ayah.surah_number, ayah.ayah_number);
  return { reviewScheduled };
}

/** Same ordering rationale as addToReview above: schedule the review first,
 * so a poll observing status = "memorized" is a reliable signal that
 * review_items has already settled, not a race against it. */
export async function markMemorized(
  userId: string,
  ayah: Ayah,
  locale: Locale,
): Promise<{ reviewScheduled: boolean }> {
  const reviewScheduled = await scheduleReview(userId, ayah, locale);
  const { error } = await supabase.from("memorization_progress").upsert(
    {
      user_id: userId,
      surah_number: ayah.surah_number,
      ayah_number: ayah.ayah_number,
      status: "memorized",
      memorized_at: new Date().toISOString(),
    },
    { onConflict: "user_id, surah_number, ayah_number" },
  );
  if (error) throw error;
  return { reviewScheduled };
}

/** Aggregate per-surah memorization counts against each surah's real ayah_count. */
export async function fetchSurahProgress(
  userId: string,
  surahs: Surah[],
): Promise<SurahProgress[]> {
  const progress = await fetchMemorizationProgress(userId);
  const bySurah = new Map<number, MemorizationProgress[]>();
  for (const row of progress) {
    const list = bySurah.get(row.surah_number) ?? [];
    list.push(row);
    bySurah.set(row.surah_number, list);
  }
  return surahs.map((surah) => {
    const rows = bySurah.get(surah.number) ?? [];
    return {
      surah,
      memorizedCount: rows.filter((r) => r.status === "memorized").length,
      learningCount: rows.filter((r) => r.status === "learning").length,
    };
  });
}

/** The surah most recently touched by any memorization activity, for "Continue Memorizing". */
export function mostRecentSurah(progress: MemorizationProgress[]): number | null {
  if (progress.length === 0) return null;
  const sorted = [...progress].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
  return sorted[0]!.surah_number;
}

export type DueMemorizationReview = ReviewItem & { surahNumber: number; ayahNumber: number };

/**
 * Ayat marked memorized whose spaced-repetition review is due today or
 * earlier. Returns full ReviewItem rows (plus the parsed surah/ayah) so
 * callers can hand them straight to study.ts's recordPracticeAttempt — the
 * one existing SM-2 engine — instead of a second, incompatible review shape.
 */
export async function fetchDueMemorizationReviews(
  userId: string,
  limit = 20,
): Promise<DueMemorizationReview[]> {
  const today = localDate();
  const { data, error } = await supabase
    .from("review_items")
    .select("*")
    .eq("user_id", userId)
    .eq("item_type", "ayah")
    .lte("due_date", today)
    .neq("status", "suspended")
    .order("due_date", { ascending: true })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).flatMap((item) => {
    const match = /^ayah:(\d+):(\d+)$/.exec(item.item_key);
    if (!match) return [];
    return [
      { ...(item as ReviewItem), surahNumber: Number(match[1]), ayahNumber: Number(match[2]) },
    ];
  });
}

export async function countDueMemorizationReviews(userId: string): Promise<number> {
  const today = localDate();
  const { count, error } = await supabase
    .from("review_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("item_type", "ayah")
    .lte("due_date", today)
    .neq("status", "suspended");
  if (error) throw error;
  return count ?? 0;
}

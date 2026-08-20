import { supabase } from "@/integrations/supabase/client";
import { localDate, type ReviewItem, type WeakArea, type DailyStudyItem } from "@/lib/study";
import { countDueMemorizationReviews } from "@/lib/memorization";

export type PracticeSummary = {
  vocabularyDue: number;
  weakAreaCount: number;
  memorizationDue: number;
};

/**
 * Only the modules backed by a real data model: vocabulary and memorization
 * review_items, and weak_areas. Reading/grammar practice aren't implemented
 * (no distinct content model exists for them), so they're intentionally
 * absent rather than shown with fake data.
 */
export async function fetchPracticeSummary(userId: string): Promise<PracticeSummary> {
  const today = localDate();
  const [{ count: vocabularyDue }, { count: weakAreaCount }, memorizationDue] = await Promise.all([
    supabase
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("item_type", "word")
      .lte("due_date", today)
      .neq("status", "suspended"),
    supabase.from("weak_areas").select("*", { count: "exact", head: true }).eq("user_id", userId),
    countDueMemorizationReviews(userId),
  ]);
  return {
    vocabularyDue: vocabularyDue ?? 0,
    weakAreaCount: weakAreaCount ?? 0,
    memorizationDue,
  };
}

/**
 * Combines due vocabulary + memorization review_items and weak areas into
 * one session queue, reusing the same DailyStudyItem shape src/lib/study.ts
 * and the daily-study UI already know how to render and record attempts
 * for — not a second, parallel review model.
 */
export async function fetchPracticeQueue(userId: string, limit = 20): Promise<DailyStudyItem[]> {
  const today = localDate();
  const [{ data: due }, { data: weak }] = await Promise.all([
    supabase
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .in("item_type", ["word", "ayah"])
      .lte("due_date", today)
      .neq("status", "suspended")
      .order("due_date", { ascending: true })
      .limit(limit),
    supabase
      .from("weak_areas")
      .select("*")
      .eq("user_id", userId)
      .order("strength", { ascending: true })
      .limit(3),
  ]);

  const items: DailyStudyItem[] = ((due ?? []) as ReviewItem[]).map((item) => ({
    kind: "review",
    item,
  }));
  for (const area of (weak ?? []) as WeakArea[]) {
    if (items.length >= limit) break;
    items.push({ kind: "weak_area", area });
  }
  return items;
}

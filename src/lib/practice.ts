import { supabase } from "@/integrations/supabase/client";
import { localDate, type ReviewItem, type WeakArea, type DailyStudyItem } from "@/lib/study";
import { countDueMemorizationReviews } from "@/lib/memorization";

export type PracticeSummary = {
  vocabularyDue: number;
  weakAreaCount: number;
  memorizationDue: number;
  lettersDue: number;
  conceptsDue: number;
};

/**
 * The modules backed by a real data model: vocabulary/letter/concept/ayah
 * review_items, memorization, and weak_areas. Reading/grammar practice
 * aren't implemented (no distinct content model exists for them), so
 * they're intentionally absent rather than shown with fake data.
 *
 * lettersDue and conceptsDue fold into the total the caller uses to decide
 * whether to show the "start" button, but aren't broken out as their own
 * visible row — same pattern Sub-phase 2.5 established for lettersDue:
 * these item types just need to be practiceable, not a new summary
 * line/i18n string apiece.
 */
export async function fetchPracticeSummary(userId: string): Promise<PracticeSummary> {
  const today = localDate();
  const [
    { count: vocabularyDue },
    { count: weakAreaCount },
    memorizationDue,
    { count: lettersDue },
    { count: conceptsDue },
  ] = await Promise.all([
    supabase
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("item_type", "word")
      .lte("due_date", today)
      .neq("status", "suspended"),
    supabase.from("weak_areas").select("*", { count: "exact", head: true }).eq("user_id", userId),
    countDueMemorizationReviews(userId),
    supabase
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("item_type", "letter")
      .lte("due_date", today)
      .neq("status", "suspended"),
    supabase
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("item_type", "concept")
      .lte("due_date", today)
      .neq("status", "suspended"),
  ]);
  return {
    vocabularyDue: vocabularyDue ?? 0,
    weakAreaCount: weakAreaCount ?? 0,
    memorizationDue,
    lettersDue: lettersDue ?? 0,
    conceptsDue: conceptsDue ?? 0,
  };
}

/**
 * Combines due vocabulary + letter + concept + ayah + memorization
 * review_items and weak areas into one session queue, reusing the same
 * DailyStudyItem shape src/lib/study.ts and the daily-study UI already
 * know how to render and record attempts for — not a second, parallel
 * review model. "letter" was added in Sub-phase 2.5 once lesson completion
 * started seeding items of that type; "concept" was added in Sub-phase
 * 3.2A for the same reason — without it, due concept-type review items
 * (e.g. a future harakat module's) would be due but never actually
 * reachable from this page, exactly like letters before the 2.5 fix.
 */
export async function fetchPracticeQueue(userId: string, limit = 20): Promise<DailyStudyItem[]> {
  const today = localDate();
  const [{ data: due }, { data: weak }] = await Promise.all([
    supabase
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .in("item_type", ["word", "ayah", "letter", "concept"])
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

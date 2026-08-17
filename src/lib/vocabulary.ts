import { supabase } from "@/integrations/supabase/client";

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
};

export type UserVocabulary = {
  id: string;
  user_id: string;
  word_id: string;
  status: "new" | "learning" | "known" | "mastered";
  notes: string | null;
  word: WordFrequency;
};

export async function fetchWordFrequency(
  options: { limit?: number; category?: string | null; search?: string } = {},
): Promise<WordFrequency[]> {
  const { limit = 50, category, search } = options;
  let query = supabase
    .from("word_frequency")
    .select("*")
    .order("frequency_rank", { ascending: true })
    .limit(limit);

  if (category) {
    query = query.eq("category", category as NonNullable<WordFrequency["category"]>);
  }

  if (search) {
    query = query.or(
      `word.ilike.%${search}%,transliteration.ilike.%${search}%,meaning.ilike.%${search}%,meaning_fr.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WordFrequency[];
}

export async function fetchUserVocabulary(userId: string): Promise<UserVocabulary[]> {
  const { data, error } = await supabase
    .from("user_vocabulary")
    .select("*, word:word_id(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserVocabulary[];
}

export async function saveWordToVocabulary(
  userId: string,
  wordId: string,
  status: UserVocabulary["status"] = "learning",
  notes?: string,
) {
  const { error } = await supabase.from("user_vocabulary").upsert(
    {
      user_id: userId,
      word_id: wordId,
      status,
      notes: notes ?? null,
    },
    { onConflict: "user_id, word_id", ignoreDuplicates: false },
  );
  if (error) throw error;
}

export async function removeWordFromVocabulary(userId: string, wordId: string) {
  const { error } = await supabase
    .from("user_vocabulary")
    .delete()
    .eq("user_id", userId)
    .eq("word_id", wordId);
  if (error) throw error;
}

export async function updateVocabularyStatus(
  userId: string,
  wordId: string,
  status: UserVocabulary["status"],
) {
  const { error } = await supabase
    .from("user_vocabulary")
    .update({ status })
    .eq("user_id", userId)
    .eq("word_id", wordId);
  if (error) throw error;
}

export type VocabularyStats = {
  total: number;
  byStatus: Record<UserVocabulary["status"], number>;
};

export async function getVocabularyStats(userId: string): Promise<VocabularyStats> {
  const { data, error } = await supabase
    .from("user_vocabulary")
    .select("status")
    .eq("user_id", userId);
  if (error) throw error;

  const byStatus = { new: 0, learning: 0, known: 0, mastered: 0 } as VocabularyStats["byStatus"];
  (data ?? []).forEach((row) => {
    const key = row.status as UserVocabulary["status"];
    byStatus[key] = (byStatus[key] ?? 0) + 1;
  });
  return { total: (data ?? []).length, byStatus };
}

export async function getWeeklyStudyMinutes(userId: string): Promise<number> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { data, error } = await supabase
    .from("study_sessions")
    .select("minutes")
    .eq("user_id", userId)
    .gte("occurred_at", weekAgo.toISOString());
  if (error) throw error;
  return (data ?? []).reduce((sum, s) => sum + s.minutes, 0);
}

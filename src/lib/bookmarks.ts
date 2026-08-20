import { supabase } from "@/integrations/supabase/client";

export type Bookmark = {
  id: string;
  user_id: string;
  surah_number: number;
  ayah_number: number;
  created_at: string;
};

const UNIQUE_VIOLATION = "23505";

export async function fetchBookmarks(userId: string): Promise<Bookmark[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchBookmarkedAyahKeys(userId: string): Promise<Set<string>> {
  const bookmarks = await fetchBookmarks(userId);
  return new Set(bookmarks.map((b) => `${b.surah_number}:${b.ayah_number}`));
}

/** Insert is idempotent: a duplicate click racing an in-flight request is a no-op, not an error. */
export async function addBookmark(
  userId: string,
  surahNumber: number,
  ayahNumber: number,
): Promise<void> {
  const { error } = await supabase
    .from("bookmarks")
    .insert({ user_id: userId, surah_number: surahNumber, ayah_number: ayahNumber });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}

export async function removeBookmark(
  userId: string,
  surahNumber: number,
  ayahNumber: number,
): Promise<void> {
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("surah_number", surahNumber)
    .eq("ayah_number", ayahNumber);
  if (error) throw error;
}

import { supabase } from "@/integrations/supabase/client";

export type Note = {
  id: string;
  user_id: string;
  surah_number: number;
  ayah_number: number;
  content: string;
  created_at: string;
  updated_at: string;
};

/** Matches the notes.content CHECK constraint in the migration. */
export const NOTE_MAX_LENGTH = 2000;

export async function fetchNotes(userId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchNotesForAyah(
  userId: string,
  surahNumber: number,
  ayahNumber: number,
): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("surah_number", surahNumber)
    .eq("ayah_number", ayahNumber)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createNote(
  userId: string,
  surahNumber: number,
  ayahNumber: number,
  content: string,
): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      surah_number: surahNumber,
      ayah_number: ayahNumber,
      content: content.trim().slice(0, NOTE_MAX_LENGTH),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(userId: string, noteId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from("notes")
    .update({ content: content.trim().slice(0, NOTE_MAX_LENGTH) })
    .eq("id", noteId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", noteId).eq("user_id", userId);
  if (error) throw error;
}

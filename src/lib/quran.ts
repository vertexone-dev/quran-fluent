import { supabase } from "@/integrations/supabase/client";
import type { Locale } from "@/lib/i18n";

/**
 * A curated V1 bootstrap set (Al-Fatiha plus a handful of short, commonly
 * memorized surahs) — not the full 114-surah Mushaf. See the migration that
 * creates these tables for sourcing/attribution.
 */
export type Surah = {
  number: number;
  name_en: string;
  name_ar: string;
  name_fr: string;
  ayah_count: number;
  revelation_type: string;
  /** True when recitation opens with a Bismillah that is NOT itself a
   * numbered ayah (render it once, above ayah 1). False for Al-Fatiha,
   * whose Bismillah IS its stored ayah 1 — see the migration comment. */
  bismillah_pre: boolean;
};

export type Ayah = {
  id: string;
  surah_number: number;
  ayah_number: number;
  arabic_text: string;
  translation_en: string;
  translation_fr: string;
};

export async function fetchSurahs(signal?: AbortSignal): Promise<Surah[]> {
  let query = supabase.from("surahs").select("*").order("number", { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchSurah(surahNumber: number): Promise<Surah | null> {
  const { data, error } = await supabase
    .from("surahs")
    .select("*")
    .eq("number", surahNumber)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAyahs(surahNumber: number, signal?: AbortSignal): Promise<Ayah[]> {
  let query = supabase
    .from("ayahs")
    .select("*")
    .eq("surah_number", surahNumber)
    .order("ayah_number", { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * The Bismillah text, for surahs whose ayah 1 doesn't already include it
 * (bismillah_pre = true — see the surahs table). Derived from Al-Fatiha's
 * own stored ayah 1 (which IS the Bismillah) rather than a hand-typed
 * literal, the same policy the seed migration followed.
 */
export async function fetchBismillahText(signal?: AbortSignal): Promise<string> {
  let query = supabase
    .from("ayahs")
    .select("arabic_text")
    .eq("surah_number", 1)
    .eq("ayah_number", 1);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.single();
  if (error) throw error;
  return data.arabic_text;
}

export async function fetchAyah(surahNumber: number, ayahNumber: number): Promise<Ayah | null> {
  const { data, error } = await supabase
    .from("ayahs")
    .select("*")
    .eq("surah_number", surahNumber)
    .eq("ayah_number", ayahNumber)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function surahName(surah: Pick<Surah, "name_en" | "name_fr">, locale: Locale): string {
  return locale === "fr" ? surah.name_fr : surah.name_en;
}

export function ayahTranslation(
  ayah: Pick<Ayah, "translation_en" | "translation_fr">,
  locale: Locale,
): string {
  return locale === "fr" ? ayah.translation_fr : ayah.translation_en;
}

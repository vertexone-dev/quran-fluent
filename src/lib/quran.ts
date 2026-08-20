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
  /** Null until a governed French source exists for this Surah's display
   * name (see the Phase 2A transliteration migration) — never populate
   * this with transliteration and call it French. Fall back to
   * `transliteration`, not an invented translation. */
  name_fr: string | null;
  /** Language-neutral romanized name (e.g. "Al-Faatiha"), sourced from
   * Tanzil's own metadata — not translated content in any language. Safe
   * as a display fallback when name_fr is null. */
  transliteration: string | null;
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
  /** Null until EN/FR translations are imported (Phase 2B) for this Ayah.
   * Never invent a translation — render an explicit "not available yet"
   * state instead. See ayahTranslation(). */
  translation_en: string | null;
  translation_fr: string | null;
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

/**
 * Always returns a real, displayable string — never null, never the
 * literal text "null". French falls back to the language-neutral
 * transliteration (not an invented translation) when no governed French
 * name exists yet for this Surah, then to the English name as a last
 * resort. name_en itself is never null.
 */
export function surahName(
  surah: Pick<Surah, "name_en" | "name_fr" | "transliteration">,
  locale: Locale,
): string {
  if (locale === "fr") return surah.name_fr ?? surah.transliteration ?? surah.name_en;
  return surah.name_en;
}

/**
 * Returns the Ayah's translation in the requested locale, or null if it
 * hasn't been imported yet (Phase 2B) — deliberately does NOT fall back to
 * the other language's text, since silently showing English under a French
 * UI (or vice versa) without saying so would misattribute it. Callers must
 * render an explicit localized "translation not available" state for null
 * rather than leaving a blank or showing the literal word "null".
 */
export function ayahTranslation(
  ayah: Pick<Ayah, "translation_en" | "translation_fr">,
  locale: Locale,
): string | null {
  return locale === "fr" ? ayah.translation_fr : ayah.translation_en;
}

import { supabase } from "@/integrations/supabase/client";

/**
 * The single governed, verified translation source for a language.
 * Resolution is centralized here — behind one query with an explicit
 * verification_status = 'verified' gate — so that adding a future edition
 * (a new translator, a replacement source) never requires touching reader,
 * memorization, or any other consuming component. Only this query changes.
 */
export type TranslationSource = {
  id: string;
  translator: string;
};

let cachedEnglishSource: Promise<TranslationSource | null> | null = null;

/**
 * Resolves the governed English source — Marmaduke Pickthall, Project
 * Gutenberg eBook #16955 digital edition — by its full identifying fields,
 * not just language, so a future additional English candidate row (e.g. a
 * still-unverified new edition) is never picked up by accident. Returns
 * null (never throws for "not found") so callers fall back to the legacy
 * translation_en column, exactly as if no governed source existed yet.
 *
 * Memoized for the life of the page: content_sources rows don't change
 * during a session, and this avoids re-querying it once per Surah.
 */
export function resolveVerifiedEnglishSource(): Promise<TranslationSource | null> {
  if (!cachedEnglishSource) {
    cachedEnglishSource = (async () => {
      const { data, error } = await supabase
        .from("content_sources")
        .select("id, translator")
        .eq("content_type", "translation")
        .eq("language", "en")
        .eq("translator", "Marmaduke Pickthall")
        .eq("edition_identifier", "pickthall-gutenberg-16955")
        .eq("verification_status", "verified")
        .maybeSingle();
      if (error) throw error;
      if (!data?.translator) return null;
      return { id: data.id, translator: data.translator };
    })();
  }
  return cachedEnglishSource;
}

/** ayah_number -> translation text, for a single Surah and source. */
export type TranslationsBySurah = Map<number, string>;

/**
 * One batched query for every Ayah in a Surah, keyed by ayah_number — never
 * one request per Ayah. Callers combine this with canonical Ayah rows
 * client-side.
 */
export async function fetchTranslationsForSurah(
  surahNumber: number,
  sourceId: string,
  signal?: AbortSignal,
): Promise<TranslationsBySurah> {
  let query = supabase
    .from("translations")
    .select("ayah_number, text")
    .eq("surah_number", surahNumber)
    .eq("source_id", sourceId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  const map: TranslationsBySurah = new Map();
  for (const row of data ?? []) map.set(row.ayah_number, row.text);
  return map;
}

-- Surah transliteration architecture.
--
-- Adds a language-neutral `transliteration` column (romanized surah name —
-- not translated content in any language) and makes `name_fr` nullable.
--
-- Rationale: the 7 existing bootstrap rows' name_fr currently holds their
-- transliteration (e.g. 'Al-Mulk'), accepted for that small curated set,
-- but transliteration is not verified French content and must not keep
-- being treated as if it were sourced French for the full 114-surah
-- dataset. Making name_fr nullable lets future rows explicitly represent
-- "no verified French display name yet" (NULL) instead of silently reusing
-- transliteration as if it were sourced French. The application is
-- expected to fall back to `transliteration` for display only when
-- name_fr is NULL — that is a UI fallback, not canonical French data, and
-- is proposed as a separate, not-yet-applied code change alongside this
-- migration.
--
-- The existing 7 bootstrap rows' name_en and name_fr are NOT touched by
-- this migration — only backfilled with transliteration (additive,
-- harmless: transliteration duplicating name_en/name_fr's existing value
-- for those 7 rows is expected and fine, since that's exactly what
-- name_en/name_fr already held for them).
--
-- Transliteration values below are Tanzil's own `tname` metadata field
-- (scripts/quran-import/artifacts/quran-data.xml, already fetched and
-- checksummed for the canonical Arabic import), not hand-typed —
-- confirmed to differ subtly from casual spelling (e.g. "Al-Faatiha", not
-- "Al-Fatiha"; "Al-Ikhlaas", not "Al-Ikhlas"; "An-Naas", not "An-Nas").

ALTER TABLE public.surahs ADD COLUMN transliteration text;
ALTER TABLE public.surahs ALTER COLUMN name_fr DROP NOT NULL;

UPDATE public.surahs SET transliteration = 'Al-Faatiha' WHERE number = 1;
UPDATE public.surahs SET transliteration = 'Al-Mulk' WHERE number = 67;
UPDATE public.surahs SET transliteration = 'Al-Asr' WHERE number = 103;
UPDATE public.surahs SET transliteration = 'Al-Kawthar' WHERE number = 108;
UPDATE public.surahs SET transliteration = 'Al-Ikhlaas' WHERE number = 112;
UPDATE public.surahs SET transliteration = 'Al-Falaq' WHERE number = 113;
UPDATE public.surahs SET transliteration = 'An-Naas' WHERE number = 114;

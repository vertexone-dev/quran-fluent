-- Phase 2A: source governance schema for the Verified Qur'an Knowledge Layer.
-- Purely additive: no existing column, table, or row is modified or dropped.
-- translation_en / translation_fr on public.ayahs are untouched and not
-- backfilled — the new translations table is a separate, parallel structure
-- until the migration/mapping is validated in a later, explicitly approved
-- step. No Qur'an text or translation rows are imported by this migration —
-- only the 3 source-provenance records themselves.

CREATE TABLE public.content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('arabic_text', 'translation')),
  provider_name text NOT NULL,
  dataset_name text NOT NULL,
  edition_identifier text,
  language text NOT NULL CHECK (language IN ('ar', 'en', 'fr')),
  translator text,
  version text,

  -- License fields are structured, not a single interpretive free-text
  -- summary: license_name/license_url record what the source actually
  -- states; attribution_required/modification_restricted record concrete,
  -- checkable terms. Anything interpretive (e.g. "commercial use isn't
  -- addressed either way") belongs in `notes`, which is explicitly NOT
  -- authoritative license metadata.
  license_name text NOT NULL,
  license_url text,
  attribution_required boolean NOT NULL DEFAULT false,
  modification_restricted boolean NOT NULL DEFAULT false,

  source_url text NOT NULL,
  retrieved_at timestamptz,
  public_domain boolean NOT NULL DEFAULT false,
  legacy_interim boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'candidate'
    CHECK (verification_status IN ('candidate', 'verified', 'disputed', 'deprecated')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_sources TO authenticated, anon;
GRANT ALL ON public.content_sources TO service_role;
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_sources_read_all" ON public.content_sources
  FOR SELECT TO authenticated, anon USING (true);

-- Renamed per instruction: surahs.source_id -> metadata_source_id (the
-- surah-level reference metadata's provenance), ayahs.source_id ->
-- arabic_source_id (specifically the canonical Arabic text's provenance,
-- distinct from any translation's provenance).
ALTER TABLE public.surahs ADD COLUMN metadata_source_id uuid REFERENCES public.content_sources(id);
ALTER TABLE public.ayahs  ADD COLUMN arabic_source_id uuid REFERENCES public.content_sources(id);

-- translations: language/translator/edition/provider/license all live on
-- content_sources now, referenced via source_id — this table stays a thin
-- (surah, ayah, source) -> text mapping, so adding a new translation
-- edition later is just a new content_sources row plus new translations
-- rows, no schema change.
CREATE TABLE public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surah_number integer NOT NULL,
  ayah_number integer NOT NULL,
  text text NOT NULL CHECK (btrim(text) <> ''),
  source_id uuid NOT NULL REFERENCES public.content_sources(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (surah_number, ayah_number, source_id),
  FOREIGN KEY (surah_number, ayah_number)
    REFERENCES public.ayahs (surah_number, ayah_number) ON DELETE RESTRICT
);
CREATE INDEX translations_surah_ayah_idx ON public.translations (surah_number, ayah_number);
CREATE INDEX translations_source_idx ON public.translations (source_id);

GRANT SELECT ON public.translations TO authenticated, anon;
GRANT ALL ON public.translations TO service_role;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translations_read_all" ON public.translations
  FOR SELECT TO authenticated, anon USING (true);

CREATE TRIGGER translations_updated_at
  BEFORE UPDATE ON public.translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source provenance records only (no Qur'an text/translation rows).
INSERT INTO public.content_sources
  (content_type, provider_name, dataset_name, edition_identifier, language,
   translator, version, license_name, license_url, attribution_required,
   modification_restricted, source_url, public_domain, legacy_interim,
   verification_status, notes)
VALUES
  ('arabic_text', 'Tanzil Project', 'Uthmani Script', 'uthmani', 'ar',
   NULL, '1.1',
   'Tanzil Quran Text License', 'https://tanzil.net/docs/Text_License',
   true, true,
   'https://tanzil.net/download/', false, false, 'candidate',
   'Canonical production Arabic source, version dated February 2021. Terms permit verbatim copy/distribution with attribution and a link back to tanzil.net; text alteration is not allowed. The published terms do not explicitly address commercial use either way — noted here for context, not as a license grant.'),

  ('translation', 'Wikisource (Wikimedia)', 'The Meaning of the Glorious Koran', 'pickthall-1930', 'en',
   'Marmaduke Pickthall', '1930 first edition',
   'Public Domain (United States)', NULL,
   false, false,
   'https://en.wikisource.org/wiki/The_Meaning_of_the_Glorious_Koran_(1930)',
   true, true, 'candidate',
   'Interim EN translation for Phase 2A only. Public domain in the US: published before 1964, copyright not renewed. Translator died 1936, so status in life+70 jurisdictions rests on the pre-1964/not-renewed US basis rather than translator death date. A modern licensed EN translation is expected to replace this as the default edition before production launch; the schema supports adding it as a new content_sources row plus new translations rows with no migration required.'),

  ('translation', 'Wikisource (Wikimedia)', 'Le Koran', 'kazimirski-1869', 'fr',
   'Albin de Kazimirski (Biberstein)', 'Librairie Charpentier, 1869 edition',
   'Public Domain', NULL,
   false, false,
   'https://fr.wikisource.org/wiki/Le_Koran_(Traduction_de_Kazimirski)/Texte_entier',
   true, true, 'candidate',
   'Interim/legacy FR translation for Phase 2A only, pending research and licensing of a modern French translation before production launch. Translator died 1887, unambiguously public domain. Deliberately not the disputed King Fahd Complex "fr.hamidullah" edition — see prior discussion of the documented consent dispute over that edition''s alterations to Hamidullah''s original text.');

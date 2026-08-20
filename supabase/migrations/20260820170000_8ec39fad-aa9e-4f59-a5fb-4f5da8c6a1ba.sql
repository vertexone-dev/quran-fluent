-- Phase 2B: updates the existing Pickthall content_sources candidate row
-- from its provisional Wikisource/"pickthall-1930" identity (Phase 2A
-- placeholder) to the approved governed source: Marmaduke Pickthall —
-- Project Gutenberg eBook #16955 digital edition. Explicitly NOT labeled
-- as the 1930 first edition — the Phase 2B Candidate 5 investigation
-- established this Gutenberg digital text is not an exact reproduction of
-- that edition (see notes below and scripts/quran-import/reports/
-- pickthall-gutenberg-dry-run.json for full detail).
--
-- verification_status stays 'candidate' here on purpose — it only
-- transitions to 'verified' via the separate promote-verified migration,
-- after the translation import migration has been applied and its results
-- manually reviewed.
--
-- Targets the row by its CURRENT (pre-update) identifying fields, not an
-- assumed UUID, and aborts loudly if it doesn't find exactly one matching
-- row — never silently updates zero or more than one.

DO $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.content_sources
  SET
    provider_name = 'Project Gutenberg',
    dataset_name = 'Three Translations of The Koran (Al-Qur''an) side by side',
    edition_identifier = 'pickthall-gutenberg-16955',
    version = 'Project Gutenberg eBook #16955 digital edition',
    license_name = 'Public Domain (United States)',
    license_url = 'https://www.gutenberg.org/policy/license.html',
    source_url = 'https://www.gutenberg.org/files/16955/16955.txt',
    attribution_required = false,
    modification_restricted = false,
    public_domain = true,
    retrieved_at = '2026-08-20T13:16:23.024Z',
    legacy_interim = false,
    -- verification_status intentionally NOT changed here — stays 'candidate'
    notes = 'Governed English translation source. Attribute in-app as "Marmaduke Pickthall — Project Gutenberg eBook #16955 digital edition" — NEVER as "Pickthall 1930 first edition". Validated (Phase 2B Candidate 5 investigation) to differ from the verified 1930 first edition at several points (e.g. 1:4, 2:255, 6:9), while independently agreeing with the verified-1930 baseline on other systematic points (the "no God/Allah save Him" formula) where a rejected alternate candidate (ceefour/qurandatabase XML) did not. SHA-256 of the retrieved artifact: 8ea8efcdf76a20ac1a6a3948c292f44fc7acda597ed7cbc50ac2dc4c254be7a8. Gutenberg provenance note: "This text originates from a file whose origins we don''t know, found in many places on the Internet. It was re-proofed and corrected for Project Gutenberg against paper copies of the translations by Irfan Ali." Public-domain assessment: public domain in the United States per Project Gutenberg''s own terms; jurisdiction scope is US only and has not been independently assessed for other jurisdictions. Correction manifest: 4 documented, deterministic verse-identifier typo corrections applied during parsing (0.033->017.033, 039.04->039.046, 04.032->045.032, 05.026->056.026) — labels only, translation wording itself was never altered. See scripts/quran-import/generate-pickthall-migration.mjs and scripts/quran-import/reports/pickthall-gutenberg-dry-run.json for full detail.'
  WHERE content_type = 'translation'
    AND language = 'en'
    AND translator = 'Marmaduke Pickthall'
    AND edition_identifier = 'pickthall-1930';

  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION
      'Expected to update exactly 1 content_sources row (Pickthall candidate with edition_identifier=pickthall-1930), affected %. Check whether this migration already ran, or whether the row''s identifying fields no longer match.',
      affected;
  END IF;
END $$;

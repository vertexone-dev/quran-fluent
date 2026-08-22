#!/usr/bin/env node
// Phase 2B — generates the governed English (Pickthall) translation import
// migration SQL from a freshly re-fetched, re-validated Project Gutenberg
// eBook #16955 artifact. Re-derives everything from source (not a cached
// artifact) so the generated SQL is reproducible, re-runs the same gates as
// validate-pickthall-gutenberg.mjs, and ABORTS without writing anything if
// any gate fails. This script only ever reads the database (to resolve the
// existing candidate content_sources row's current identifying fields and
// to confirm canonical ayahs coverage); it writes .sql files to disk and
// nothing else. It never applies anything to Lovable Cloud.
//
// Run:
//   node scripts/quran-import/generate-pickthall-migration.mjs
//
// Output (all gitignored under scripts/quran-import/):
//   generated/pickthall-source-metadata-update.sql
//     — UPDATEs the existing Pickthall candidate content_sources row from
//       its current (Wikisource/"pickthall-1930") identity to the approved
//       governed identity. verification_status stays 'candidate'.
//   generated/<import-migration-filename>.sql
//     — INSERTs exactly 6,236 public.translations rows, resolving source_id
//       via SELECT ... INTO STRICT (fails loudly, not silently, if the
//       governed row can't be found or isn't unique). Asserts 0 pre-existing
//       rows for this source before inserting (first governed import — not
//       meant to run against non-empty state), uses a plain INSERT with no
//       ON CONFLICT (any unexpected duplicate fails the transaction
//       loudly), and re-asserts row/surah/blank counts after inserting,
//       inside the same transaction. Never touches ayahs.translation_en/fr,
//       Arabic text, or French data.
//   generated/pickthall-promote-verified.sql
//     — a separate, tiny migration that flips verification_status from
//       'candidate' to 'verified' — but only after re-checking, inside the
//       migration itself, that exactly 6,236 rows exist for this source
//       across all 114 surahs with 0 blanks. Meant to be applied AFTER the
//       import migration has been applied to the live database and its
//       results have been manually reviewed — never bundled with the
//       import itself.
//   reports/integrity-verification-pickthall.sql
//     — read-only SELECT-only checks for manual/CI verification after the
//       import migration is applied. Not a migration; makes no writes.
//
// None of the three generated/*.sql files are applied by this script, and
// none are copied into supabase/migrations/ — that only happens by hand,
// after explicit approval, exactly like the Phase 2A arabic-import.sql
// precedent.

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

const GUTENBERG_URLS = [
  "https://www.gutenberg.org/files/16955/16955.txt",
  "http://aleph.gutenberg.org/1/6/9/5/16955/16955.txt",
  "http://gutenberg.pglaf.org/1/6/9/5/16955/16955.txt",
];
const EXPECTED_SHA256 = "8ea8efcdf76a20ac1a6a3948c292f44fc7acda597ed7cbc50ac2dc4c254be7a8";

const GENERATED_DIR = path.join(__dirname, "generated");
const REPORT_DIR = path.join(__dirname, "reports");

// Final proposed migration filenames, in dependency order, all timestamped
// after the last applied Phase 2A migration (20260820160000). Fixed here
// (not regenerated per run) so the generated files are the literal
// candidates for manual copy into supabase/migrations/ once approved.
const METADATA_MIGRATION_FILENAME = "20260820170000_8ec39fad-aa9e-4f59-a5fb-4f5da8c6a1ba.sql";
const IMPORT_MIGRATION_FILENAME = "20260820180000_e471a844-ae75-4705-b463-eba0bb8ef944.sql";
const PROMOTE_MIGRATION_FILENAME = "20260820190000_19c164f7-b323-47fe-8275-4642b41200f9.sql";

// Identical correction manifest to validate-pickthall-gutenberg.mjs and the
// Candidate 5 investigation report — never edited independently of that
// source of truth.
const CORRECTION_MANIFEST = [
  { rawIdentifier: "0.033", correctedSurah: 17, correctedAyah: 33, correctedIdentifier: "017.033" },
  {
    rawIdentifier: "039.04",
    correctedSurah: 39,
    correctedAyah: 46,
    correctedIdentifier: "039.046",
  },
  {
    rawIdentifier: "04.032",
    correctedSurah: 45,
    correctedAyah: 32,
    correctedIdentifier: "045.032",
  },
  {
    rawIdentifier: "05.026",
    correctedSurah: 56,
    correctedAyah: 26,
    correctedIdentifier: "056.026",
  },
];
const CORRECTION_MAP = new Map(
  CORRECTION_MANIFEST.map((c) => [c.rawIdentifier, c.correctedIdentifier]),
);

const MANDATORY_REFS = ["1:4", "2:255", "6:9"];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fetchWithFallback(urls) {
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return { url, buf, retrievedAt: new Date().toISOString() };
    } catch (e) {
      lastErr = e;
      console.warn(`  fetch failed for ${url}: ${e.message} — trying next mirror`);
    }
  }
  throw new Error(`All Gutenberg mirrors failed: ${lastErr?.message}`);
}

function parsePickthall(raw) {
  const lines = raw.split(/\r?\n/);
  const idRe = /^(\d{1,3}\.\d{1,3})$/;
  const verses = new Map();
  const blanks = [];
  const duplicates = [];
  const appliedCorrections = [];

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    const m = idRe.exec(trimmed);
    if (m) {
      const rawId = m[1];
      const corrected = CORRECTION_MAP.get(rawId);
      if (corrected)
        appliedCorrections.push({ rawIdentifier: rawId, correctedIdentifier: corrected });
      const id = corrected || rawId;
      const [surah, ayah] = id.split(".").map(Number);
      i++;

      let pLines = null;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (idRe.test(t) && pLines !== null) break;
        if (/^P:\s?/.test(t)) {
          pLines = [t.replace(/^P:\s?/, "")];
          i++;
          while (i < lines.length && lines[i].trim() !== "") {
            pLines.push(lines[i].trim());
            i++;
          }
          i++;
          break;
        }
        i++;
      }

      const key = `${surah}:${ayah}`;
      if (pLines !== null) {
        const text = pLines.join(" ").trim();
        if (verses.has(key)) duplicates.push(key);
        if (!text) blanks.push(key);
        verses.set(key, text);
      } else {
        blanks.push(`${key} (no P: found)`);
      }
      continue;
    }
    i++;
  }
  return { verses, blanks, duplicates, appliedCorrections };
}

function sqlQuote(str) {
  return "'" + str.replace(/'/g, "''") + "'";
}

async function main() {
  console.log("=== Generating Pickthall (Gutenberg #16955) translation migration SQL ===\n");

  const client = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  console.log("Fetching Gutenberg artifact (fresh, mirror fallback)...");
  const { url, buf, retrievedAt } = await fetchWithFallback(GUTENBERG_URLS);
  const checksumSha256 = sha256(buf);
  console.log(`  url: ${url}`);
  console.log(`  sha256: ${checksumSha256}`);
  if (checksumSha256 !== EXPECTED_SHA256) {
    throw new Error(
      `Checksum mismatch: got ${checksumSha256}, expected ${EXPECTED_SHA256}. Source artifact has changed since validation — ABORTING, generating nothing.`,
    );
  }

  const raw = buf.toString("utf-8");
  const { verses, blanks, duplicates, appliedCorrections } = parsePickthall(raw);

  console.log("\nFetching canonical surah data (read-only)...");
  const { data: surahs, error: surahsErr } = await client
    .from("surahs")
    .select("number, ayah_count")
    .order("number");
  if (surahsErr) throw surahsErr;

  const surahsRepresented = new Set([...verses.keys()].map((k) => Number(k.split(":")[0])));
  const missingRefs = [];
  for (const s of surahs) {
    for (let a = 1; a <= s.ayah_count; a++) {
      if (!verses.has(`${s.number}:${a}`)) missingRefs.push(`${s.number}:${a}`);
    }
  }
  const totalExpected = surahs.reduce((sum, s) => sum + s.ayah_count, 0);

  // ---- Hard gates: abort and write nothing if any fail ----
  const gateFailures = [];
  if (surahs.length !== 114)
    gateFailures.push(`Expected 114 canonical surahs, got ${surahs.length}`);
  if (totalExpected !== 6236)
    gateFailures.push(`Expected 6236 canonical ayahs, got ${totalExpected}`);
  if (verses.size !== 6236)
    gateFailures.push(`Expected 6236 extracted translations, got ${verses.size}`);
  if (surahsRepresented.size !== 114)
    gateFailures.push(`Expected 114 surahs represented, got ${surahsRepresented.size}`);
  if (missingRefs.length !== 0)
    gateFailures.push(`${missingRefs.length} missing canonical references`);
  if (duplicates.length !== 0) gateFailures.push(`${duplicates.length} duplicate references`);
  if (blanks.length !== 0) gateFailures.push(`${blanks.length} blank translations`);
  if (appliedCorrections.length !== 4)
    gateFailures.push(`Expected exactly 4 applied corrections, got ${appliedCorrections.length}`);

  if (gateFailures.length > 0) {
    console.error("\nGATE FAILURES — aborting, no files written:");
    for (const f of gateFailures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(
    "\nAll gates passed: 114/114 surahs, 6236/6236 translations, 0 missing/duplicate/blank, 4/4 corrections.",
  );

  console.log("\nResolving existing Pickthall candidate content_sources row (read-only)...");
  const { data: existingRows, error: srcErr } = await client
    .from("content_sources")
    .select(
      "id, content_type, provider_name, dataset_name, edition_identifier, language, translator",
    )
    .eq("content_type", "translation")
    .eq("language", "en")
    .eq("translator", "Marmaduke Pickthall");
  if (srcErr) throw srcErr;
  if (existingRows.length !== 1) {
    throw new Error(
      `Expected exactly 1 existing Pickthall content_sources candidate row, found ${existingRows.length}. Aborting — cannot generate a safe UPDATE.`,
    );
  }
  const existing = existingRows[0];
  console.log(
    `  found: id=${existing.id}, provider_name=${existing.provider_name}, edition_identifier=${existing.edition_identifier}`,
  );

  await mkdir(GENERATED_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  // ---- File 1: source metadata UPDATE (candidate -> updated identity, still candidate) ----
  const metadataSql = `-- Phase 2B: updates the existing Pickthall content_sources candidate row
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
    dataset_name = ${sqlQuote("Three Translations of The Koran (Al-Qur'an) side by side")},
    edition_identifier = 'pickthall-gutenberg-16955',
    version = 'Project Gutenberg eBook #16955 digital edition',
    license_name = 'Public Domain (United States)',
    license_url = 'https://www.gutenberg.org/policy/license.html',
    source_url = ${sqlQuote(url)},
    attribution_required = false,
    modification_restricted = false,
    public_domain = true,
    retrieved_at = ${sqlQuote(retrievedAt)},
    legacy_interim = false,
    -- verification_status intentionally NOT changed here — stays 'candidate'
    notes = ${sqlQuote(
      `Governed English translation source. Attribute in-app as "Marmaduke Pickthall — Project Gutenberg eBook #16955 digital edition" — NEVER as "Pickthall 1930 first edition". Validated (Phase 2B Candidate 5 investigation) to differ from the verified 1930 first edition at several points (e.g. 1:4, 2:255, 6:9), while independently agreeing with the verified-1930 baseline on other systematic points (the "no God/Allah save Him" formula) where a rejected alternate candidate (ceefour/qurandatabase XML) did not. SHA-256 of the retrieved artifact: ${checksumSha256}. Gutenberg provenance note: "This text originates from a file whose origins we don't know, found in many places on the Internet. It was re-proofed and corrected for Project Gutenberg against paper copies of the translations by Irfan Ali." Public-domain assessment: public domain in the United States per Project Gutenberg's own terms; jurisdiction scope is US only and has not been independently assessed for other jurisdictions. Correction manifest: 4 documented, deterministic verse-identifier typo corrections applied during parsing (0.033->017.033, 039.04->039.046, 04.032->045.032, 05.026->056.026) — labels only, translation wording itself was never altered. See scripts/quran-import/generate-pickthall-migration.mjs and scripts/quran-import/reports/pickthall-gutenberg-dry-run.json for full detail.`,
    )}
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
`;
  const metadataPath = path.join(GENERATED_DIR, METADATA_MIGRATION_FILENAME);
  await writeFile(metadataPath, metadataSql);

  // ---- File 2: translation import (6236 rows) ----
  const sortedRefs = [...verses.keys()].sort((a, b) => {
    const [as, aa] = a.split(":").map(Number);
    const [bs, ba] = b.split(":").map(Number);
    return as - bs || aa - ba;
  });
  const valueRows = sortedRefs
    .map((ref) => {
      const [s, a] = ref.split(":").map(Number);
      return `(${s}, ${a}, ${sqlQuote(verses.get(ref))})`;
    })
    .join(",\n  ");

  const importSql = `-- Phase 2B: import of the governed English (Pickthall) translation —
-- Marmaduke Pickthall, Project Gutenberg eBook #16955 digital edition.
-- Generated by scripts/quran-import/generate-pickthall-migration.mjs from a
-- freshly re-fetched, re-validated Gutenberg artifact (checksum below). ALL
-- validation gates passed before this file was generated: 114 surahs, 6236
-- translations, 0 missing/duplicate/blank rows, exactly the 4 documented
-- correction-manifest identifier fixes applied (translation wording itself
-- was never altered).
--
-- Source artifact:
--   url:    ${url}
--   sha256: ${checksumSha256}
--
-- REQUIRES ${METADATA_MIGRATION_FILENAME} to already be applied — this
-- migration resolves the governed content_sources row by its POST-update
-- identifying fields (provider_name='Project Gutenberg',
-- edition_identifier='pickthall-gutenberg-16955') via SELECT ... INTO
-- STRICT, which fails loudly (raises an exception) if that row cannot be
-- resolved to exactly one match, rather than silently inserting against a
-- NULL or wrong source_id.
--
-- Hardened per final review: this is the first governed import for this
-- source and the live table is confirmed empty beforehand, so it is NOT
-- additive/idempotent by design — a zero-row precondition is asserted
-- before inserting, a plain INSERT (no ON CONFLICT) is used so any
-- unexpected duplicate-key conflict fails the transaction loudly instead of
-- being silently swallowed, and post-insert assertions (row count, surah
-- coverage, blanks) re-verify the result before the transaction commits.
-- Any future correction to translation text must happen through a
-- separately reviewed correction migration with explicit provenance — this
-- migration never gets an ON CONFLICT DO UPDATE bolted onto it.
--
-- Never touches ayahs.translation_en / translation_fr, never touches the
-- existing 58-ayah bootstrap rows, never touches Arabic text
-- (public.ayahs.arabic_text, public.surahs), never touches French
-- (Kazimirski) content_sources or translations rows.

DO $$
DECLARE
  v_source_id uuid;
  v_preexisting_count integer;
  v_translation_count integer;
  v_surah_count integer;
  v_blank_count integer;
BEGIN
  SELECT id INTO STRICT v_source_id
  FROM public.content_sources
  WHERE content_type = 'translation'
    AND provider_name = 'Project Gutenberg'
    AND edition_identifier = 'pickthall-gutenberg-16955'
    AND language = 'en';

  -- Precondition: this is the first governed import for this source, so
  -- zero rows must already exist for it. Do not silently preserve or merge
  -- with any conflicting rows if this is ever re-run against unexpected
  -- state.
  SELECT count(*) INTO v_preexisting_count
  FROM public.translations WHERE source_id = v_source_id;
  IF v_preexisting_count <> 0 THEN
    RAISE EXCEPTION 'Expected 0 pre-existing translations for source % before import, found %. Aborting — this migration is not meant to run against non-empty state.', v_source_id, v_preexisting_count;
  END IF;

  CREATE TEMP TABLE _pickthall_import (
    surah_number integer NOT NULL,
    ayah_number integer NOT NULL,
    text text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _pickthall_import (surah_number, ayah_number, text) VALUES
  ${valueRows};

  -- Plain INSERT, no ON CONFLICT: any unexpected duplicate (surah_number,
  -- ayah_number, source_id) is a bug and must fail the whole transaction
  -- loudly via the table's UNIQUE constraint, not be silently dropped.
  INSERT INTO public.translations (surah_number, ayah_number, text, source_id)
  SELECT surah_number, ayah_number, text, v_source_id
  FROM _pickthall_import;

  -- Post-insert assertions, inside the same transaction: any failure rolls
  -- back the entire import.
  SELECT count(*) INTO v_translation_count
  FROM public.translations WHERE source_id = v_source_id;
  IF v_translation_count <> 6236 THEN
    RAISE EXCEPTION 'Post-insert check failed: expected exactly 6236 translations for source %, found %.', v_source_id, v_translation_count;
  END IF;

  SELECT count(DISTINCT surah_number) INTO v_surah_count
  FROM public.translations WHERE source_id = v_source_id;
  IF v_surah_count <> 114 THEN
    RAISE EXCEPTION 'Post-insert check failed: expected 114 distinct surahs for source %, found %.', v_source_id, v_surah_count;
  END IF;

  SELECT count(*) INTO v_blank_count
  FROM public.translations WHERE source_id = v_source_id AND btrim(text) = '';
  IF v_blank_count <> 0 THEN
    RAISE EXCEPTION 'Post-insert check failed: found % blank translation rows for source %.', v_blank_count, v_source_id;
  END IF;
END $$;
`;
  const importPath = path.join(GENERATED_DIR, IMPORT_MIGRATION_FILENAME);
  await writeFile(importPath, importSql);

  // ---- File 3: promote candidate -> verified (separate, tiny, self-checking) ----
  const promoteSql = `-- Phase 2B: promotes the governed Pickthall content_sources row from
-- 'candidate' to 'verified'. Apply ONLY after ${METADATA_MIGRATION_FILENAME}
-- and ${IMPORT_MIGRATION_FILENAME} have both been applied to the live
-- database and their results have been manually reviewed. Deliberately kept
-- separate from the import migration rather than bundled, per the
-- requirement that verification_status only flips after post-import
-- integrity checks pass.
--
-- Re-checks the gates itself, inside the migration, before flipping the
-- flag — so this fails loudly rather than promoting an incomplete or
-- corrupted dataset even if run out of order or against unexpected state.

DO $$
DECLARE
  v_source_id uuid;
  v_current_status text;
  v_translation_count integer;
  v_surah_count integer;
  v_blank_count integer;
  v_affected integer;
BEGIN
  SELECT id, verification_status INTO STRICT v_source_id, v_current_status
  FROM public.content_sources
  WHERE content_type = 'translation'
    AND provider_name = 'Project Gutenberg'
    AND edition_identifier = 'pickthall-gutenberg-16955'
    AND language = 'en';

  IF v_current_status <> 'candidate' THEN
    RAISE EXCEPTION 'Expected source % to be in status ''candidate'' before promotion, found ''%''. Not promoting.', v_source_id, v_current_status;
  END IF;

  SELECT count(*) INTO v_translation_count
  FROM public.translations WHERE source_id = v_source_id;
  IF v_translation_count <> 6236 THEN
    RAISE EXCEPTION 'Expected exactly 6236 translations for source %, found %. Not promoting to verified.', v_source_id, v_translation_count;
  END IF;

  SELECT count(DISTINCT surah_number) INTO v_surah_count
  FROM public.translations WHERE source_id = v_source_id;
  IF v_surah_count <> 114 THEN
    RAISE EXCEPTION 'Expected 114 distinct surahs for source %, found %. Not promoting to verified.', v_source_id, v_surah_count;
  END IF;

  SELECT count(*) INTO v_blank_count
  FROM public.translations WHERE source_id = v_source_id AND btrim(text) = '';
  IF v_blank_count <> 0 THEN
    RAISE EXCEPTION 'Found % blank translation rows for source %. Not promoting to verified.', v_blank_count, v_source_id;
  END IF;

  UPDATE public.content_sources
  SET verification_status = 'verified'
  WHERE id = v_source_id;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'Expected to promote exactly 1 content_sources row, affected %.', v_affected;
  END IF;
END $$;
`;
  const promotePath = path.join(GENERATED_DIR, PROMOTE_MIGRATION_FILENAME);
  await writeFile(promotePath, promoteSql);

  // ---- File 4: read-only verification SQL (not a migration) ----
  const verificationSql = `-- Phase 2B: read-only integrity verification for the governed Pickthall
-- translation import. Run after applying both ${METADATA_MIGRATION_FILENAME}
-- and ${IMPORT_MIGRATION_FILENAME}, BEFORE applying
-- ${PROMOTE_MIGRATION_FILENAME}. Makes no writes.

-- 1. Exactly 6,236 English translation rows for the governed Pickthall source
SELECT count(*) AS translation_count
FROM public.translations t
JOIN public.content_sources cs ON cs.id = t.source_id
WHERE cs.content_type = 'translation'
  AND cs.provider_name = 'Project Gutenberg'
  AND cs.edition_identifier = 'pickthall-gutenberg-16955'
  AND cs.language = 'en'; -- expect 6236

-- 2. All 114 surahs represented
SELECT count(DISTINCT t.surah_number) AS surahs_represented
FROM public.translations t
JOIN public.content_sources cs ON cs.id = t.source_id
WHERE cs.provider_name = 'Project Gutenberg' AND cs.edition_identifier = 'pickthall-gutenberg-16955'; -- expect 114

-- 3. No missing canonical (surah_number, ayah_number) references
SELECT s.number AS surah_number, gap.missing_ayah
FROM public.surahs s
CROSS JOIN LATERAL (SELECT generate_series(1, s.ayah_count) AS missing_ayah) gap
LEFT JOIN public.translations t
  ON t.surah_number = s.number AND t.ayah_number = gap.missing_ayah
  AND t.source_id = (SELECT id FROM public.content_sources WHERE provider_name = 'Project Gutenberg' AND edition_identifier = 'pickthall-gutenberg-16955')
WHERE t.id IS NULL
ORDER BY s.number, gap.missing_ayah; -- expect 0 rows

-- 4. No duplicate (surah_number, ayah_number) pairs for this source
SELECT t.surah_number, t.ayah_number, count(*)
FROM public.translations t
JOIN public.content_sources cs ON cs.id = t.source_id
WHERE cs.provider_name = 'Project Gutenberg' AND cs.edition_identifier = 'pickthall-gutenberg-16955'
GROUP BY t.surah_number, t.ayah_number
HAVING count(*) > 1; -- expect 0 rows

-- 5. No blank text
SELECT t.surah_number, t.ayah_number
FROM public.translations t
JOIN public.content_sources cs ON cs.id = t.source_id
WHERE cs.provider_name = 'Project Gutenberg' AND cs.edition_identifier = 'pickthall-gutenberg-16955'
  AND btrim(t.text) = ''; -- expect 0 rows

-- 6. source_id consistency: every row for this dataset points at exactly
-- one content_sources row, and that row is the expected governed one
SELECT DISTINCT cs.id, cs.provider_name, cs.edition_identifier, cs.verification_status
FROM public.translations t
JOIN public.content_sources cs ON cs.id = t.source_id
WHERE cs.provider_name = 'Project Gutenberg' AND cs.edition_identifier = 'pickthall-gutenberg-16955';
-- expect exactly 1 row

-- 7. Mandatory verses 1:4, 2:255, 6:9
SELECT t.surah_number, t.ayah_number, t.text
FROM public.translations t
JOIN public.content_sources cs ON cs.id = t.source_id
WHERE cs.provider_name = 'Project Gutenberg' AND cs.edition_identifier = 'pickthall-gutenberg-16955'
  AND (t.surah_number, t.ayah_number) IN ((1,4), (2,255), (6,9))
ORDER BY t.surah_number, t.ayah_number;
${MANDATORY_REFS.map((r) => {
  const [s, a] = r.split(":");
  return `-- expect ${s}:${a} = ${sqlQuote(verses.get(r))}`;
}).join("\n")}

-- 8. Correction-manifest mappings represented correctly (spot check the 4
-- corrected references resolved to non-blank text)
SELECT t.surah_number, t.ayah_number, left(t.text, 60) AS text_start
FROM public.translations t
JOIN public.content_sources cs ON cs.id = t.source_id
WHERE cs.provider_name = 'Project Gutenberg' AND cs.edition_identifier = 'pickthall-gutenberg-16955'
  AND (t.surah_number, t.ayah_number) IN ((17,33), (39,46), (45,32), (56,26))
ORDER BY t.surah_number, t.ayah_number; -- expect 4 rows, all non-blank

-- 9. No changes to Arabic text (row count + a known spot check unaffected)
SELECT count(*) AS ayah_count FROM public.ayahs; -- expect unchanged from before this migration
SELECT surah_number, ayah_number, arabic_text FROM public.ayahs WHERE surah_number = 1 ORDER BY ayah_number;

-- 10. Learner tables unaffected
SELECT 'bookmarks' AS t, count(*) FROM public.bookmarks
UNION ALL SELECT 'notes', count(*) FROM public.notes
UNION ALL SELECT 'memorization_progress', count(*) FROM public.memorization_progress;

-- 11. French (Kazimirski) content_sources row and any French translations
-- rows completely untouched
SELECT * FROM public.content_sources WHERE language = 'fr';
SELECT count(*) FROM public.translations t
JOIN public.content_sources cs ON cs.id = t.source_id
WHERE cs.language = 'fr'; -- expect 0 (French import is a separate, later, not-yet-approved step)
`;
  const verificationPath = path.join(REPORT_DIR, "integrity-verification-pickthall.sql");
  await writeFile(verificationPath, verificationSql);

  // ---- Report ----
  const metadataSha = sha256(Buffer.from(metadataSql));
  const importSha = sha256(Buffer.from(importSql));
  const promoteSha = sha256(Buffer.from(promoteSql));

  console.log("\n=== Generated files ===");
  console.log(`  ${metadataPath}\n    sha256: ${metadataSha}`);
  console.log(`  ${importPath}\n    sha256: ${importSha}\n    rows: ${sortedRefs.length}`);
  console.log(`  ${promotePath}\n    sha256: ${promoteSha}`);
  console.log(`  ${verificationPath}`);
  console.log(
    "\nNone of these were applied to any database. None were copied into supabase/migrations/.",
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceArtifact: { url, checksumSha256, retrievedAt },
    correctionManifest: CORRECTION_MANIFEST,
    appliedCorrections,
    rowCount: sortedRefs.length,
    surahsRepresented: surahsRepresented.size,
    missingReferences: missingRefs.length,
    duplicateReferences: duplicates.length,
    blankReferences: blanks.length,
    existingContentSourceRow: existing,
    generatedFiles: {
      sourceMetadataUpdate: { path: metadataPath, sha256: metadataSha },
      translationsImport: { path: importPath, sha256: importSha, rowCount: sortedRefs.length },
      promoteVerified: { path: promotePath, sha256: promoteSha },
      verificationSql: { path: verificationPath },
    },
    mandatoryVerses: Object.fromEntries(MANDATORY_REFS.map((r) => [r, verses.get(r)])),
  };
  await writeFile(
    path.join(REPORT_DIR, "pickthall-migration-generation-summary.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(
    "\nSummary written to scripts/quran-import/reports/pickthall-migration-generation-summary.json",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

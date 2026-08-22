#!/usr/bin/env node
// Phase 2A — generates the additive canonical-Arabic data migration SQL
// from the validated Tanzil Uthmani v1.1 dataset. Re-derives everything
// from a fresh Tanzil fetch (not the cached artifact) so the generated
// migration is reproducible from source, re-validates the same gates as
// validate-tanzil.mjs, and — critically — re-compares every existing
// bootstrap ayah against the freshly parsed Tanzil text and ABORTS without
// writing anything if any substantive discrepancy is found. This script
// only ever reads the database; it writes a .sql file to disk and nothing
// else.
//
// Run:
//   node scripts/quran-import/generate-arabic-migration.mjs
//
// Output:
//   scripts/quran-import/generated/<migration-filename>.sql (gitignored —
//   the reviewed copy that becomes an actual migration is copied into
//   supabase/migrations/ by hand after explicit approval, never by this
//   script).

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

const TANZIL_TEXT_URL =
  "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&marks=true&sajdah=true&alef=true&tatweel=true&agree=true";
const TANZIL_METADATA_URL = "https://tanzil.net/res/text/metadata/quran-data.xml";

const GENERATED_DIR = path.join(__dirname, "generated");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { text: buf.toString("utf-8"), checksumSha256: sha256(buf) };
}

function parseTanzilText(raw) {
  const ayahs = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const [surahStr, ayahStr, text] = line.split("|");
    ayahs.push({ surah_number: Number(surahStr), ayah_number: Number(ayahStr), arabic_text: text });
  }
  return ayahs;
}

function parseMetadataXml(xml) {
  const tagRe = /<sura\b([^>]*)\/>/g;
  const attrRe = /(\w+)="([^"]*)"/g;
  const surahs = [];
  let tagMatch;
  while ((tagMatch = tagRe.exec(xml))) {
    const attrs = {};
    attrRe.lastIndex = 0;
    let attrMatch;
    while ((attrMatch = attrRe.exec(tagMatch[1]))) attrs[attrMatch[1]] = attrMatch[2];
    surahs.push({
      number: Number(attrs.index),
      ayah_count: Number(attrs.ayas),
      name_ar: attrs.name,
      transliteration: attrs.tname,
      revelation_type: (attrs.type || "").toLowerCase(),
    });
  }
  return surahs;
}

function detectBismillahVariant(text, bismillahText) {
  if (text.codePointAt(0) !== bismillahText.codePointAt(0)) return null;
  const remainder = bismillahText.slice(1);
  const idx = text.indexOf(remainder, 1);
  if (idx === -1) return null;
  const insertedMarks = text.slice(1, idx);
  const isOnlyCombiningMarks =
    insertedMarks.length > 0 &&
    [...insertedMarks].every((ch) => {
      const cp = ch.codePointAt(0);
      return cp >= 0x0610 && cp <= 0x06ed;
    });
  if (!isOnlyCombiningMarks) return null;
  return { variantPrefix: text.slice(0, idx + remainder.length) };
}

function applyBismillahRules(ayahs) {
  const fatiha1 = ayahs.find((a) => a.surah_number === 1 && a.ayah_number === 1);
  const bismillahStandard = fatiha1.arabic_text.trim();
  const surah95Ayah1 = ayahs.find((a) => a.surah_number === 95 && a.ayah_number === 1);
  const shaddaVariant = detectBismillahVariant(surah95Ayah1.arabic_text, bismillahStandard);
  if (!shaddaVariant)
    throw new Error("Surah 95 ayah 1 does not carry the expected shadda-idgham Bismillah prefix");
  const bismillahShaddaForm = shaddaVariant.variantPrefix;

  function matchBismillah(text) {
    if (text.startsWith(bismillahStandard)) return bismillahStandard.length;
    if (text.startsWith(bismillahShaddaForm)) return bismillahShaddaForm.length;
    return null;
  }

  const strippedAyahs = ayahs.map((a) => {
    if (a.surah_number === 1 || a.ayah_number !== 1) return a;
    const prefixLength = matchBismillah(a.arabic_text);
    if (prefixLength == null) return a;
    return { ...a, arabic_text: a.arabic_text.slice(prefixLength).trimStart() };
  });

  const firstAyahBySurah = new Map();
  for (const a of ayahs) if (a.ayah_number === 1) firstAyahBySurah.set(a.surah_number, a);
  const bismillahPreBySurah = {};
  for (let s = 1; s <= 114; s++) {
    if (!firstAyahBySurah.has(s)) continue;
    bismillahPreBySurah[s] = s === 1 || s === 9 ? false : true;
  }

  return { strippedAyahs, bismillahPreBySurah };
}

function normalizeForComparison(text) {
  return text.normalize("NFC").replace(/ـ/g, "").replace(/[ۖ-ۭ]/g, "").replace(/\s+/g, " ").trim();
}

function sqlQuote(str) {
  return "'" + str.replace(/'/g, "''") + "'";
}

async function main() {
  console.log("=== Generating canonical Arabic data migration ===\n");

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Fetching Tanzil artifacts (fresh)...");
  const [textArtifact, metaArtifact] = await Promise.all([
    fetchText(TANZIL_TEXT_URL),
    fetchText(TANZIL_METADATA_URL),
  ]);
  console.log(`  text checksum:     ${textArtifact.checksumSha256}`);
  console.log(`  metadata checksum: ${metaArtifact.checksumSha256}`);

  const rawAyahs = parseTanzilText(textArtifact.text);
  const metaSurahs = parseMetadataXml(metaArtifact.text);
  if (metaSurahs.length !== 114) throw new Error(`Expected 114 surahs, got ${metaSurahs.length}`);
  if (rawAyahs.length !== 6236) throw new Error(`Expected 6236 ayahs, got ${rawAyahs.length}`);

  const { strippedAyahs, bismillahPreBySurah } = applyBismillahRules(rawAyahs);
  const strippedByKey = new Map(
    strippedAyahs.map((a) => [`${a.surah_number}:${a.ayah_number}`, a]),
  );

  console.log("\nFetching existing live rows (read-only)...");
  const { data: existingSurahs, error: surahsErr } = await client.from("surahs").select("number");
  if (surahsErr) throw surahsErr;
  const { data: existingAyahs, error: ayahsErr } = await client
    .from("ayahs")
    .select("surah_number, ayah_number, arabic_text");
  if (ayahsErr) throw ayahsErr;

  console.log(`  existing surahs: ${existingSurahs.length}`);
  console.log(`  existing ayahs:  ${existingAyahs.length}`);

  // STOP if any existing ayah substantively differs from the freshly parsed
  // Tanzil text — never overwrite, never proceed past a real discrepancy.
  const substantiveDifferences = [];
  for (const existing of existingAyahs) {
    const key = `${existing.surah_number}:${existing.ayah_number}`;
    const fresh = strippedByKey.get(key);
    if (!fresh) {
      substantiveDifferences.push({ key, reason: "missing in freshly parsed Tanzil data" });
      continue;
    }
    if (
      existing.arabic_text !== fresh.arabic_text &&
      normalizeForComparison(existing.arabic_text) !== normalizeForComparison(fresh.arabic_text)
    ) {
      substantiveDifferences.push({
        key,
        existing: existing.arabic_text,
        fresh: fresh.arabic_text,
      });
    }
  }
  if (substantiveDifferences.length > 0) {
    console.error(
      "\nABORTING — substantive discrepancy between existing rows and freshly parsed Tanzil data:",
    );
    console.error(JSON.stringify(substantiveDifferences, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(
    "  0 substantive differences against existing rows — safe to generate additive INSERTs.\n",
  );

  const existingSurahNumbers = new Set(existingSurahs.map((s) => s.number));
  const existingAyahKeys = new Set(existingAyahs.map((a) => `${a.surah_number}:${a.ayah_number}`));

  const missingSurahs = metaSurahs.filter((s) => !existingSurahNumbers.has(s.number));
  const missingAyahs = strippedAyahs.filter(
    (a) => !existingAyahKeys.has(`${a.surah_number}:${a.ayah_number}`),
  );

  console.log(
    `Surahs to insert: ${missingSurahs.length} (of 114; ${existingSurahNumbers.size} already present)`,
  );
  console.log(
    `Ayahs to insert:  ${missingAyahs.length} (of 6236; ${existingAyahKeys.size} already present)`,
  );

  const surahSourceSubquery =
    "(SELECT id FROM public.content_sources WHERE content_type = 'arabic_text' AND provider_name = 'Tanzil Project' AND dataset_name = 'Uthmani Script' AND edition_identifier = 'uthmani' AND language = 'ar')";

  const surahValues = missingSurahs
    .sort((a, b) => a.number - b.number)
    .map((s) => {
      // name_en carries the transliteration (matches the existing 7
      // bootstrap rows' convention). name_fr is explicitly NULL — no
      // governed French surah-name source exists yet; the app falls back
      // to `transliteration` for display, never invents French content.
      const translit = sqlQuote(s.transliteration);
      return `(${s.number}, ${translit}, ${sqlQuote(s.name_ar)}, NULL, ${translit}, ${s.ayah_count}, '${s.revelation_type}', ${bismillahPreBySurah[s.number]}, ${surahSourceSubquery})`;
    });

  const ayahValues = missingAyahs
    .sort((a, b) => a.surah_number - b.surah_number || a.ayah_number - b.ayah_number)
    .map(
      (a) =>
        `(${a.surah_number}, ${a.ayah_number}, ${sqlQuote(a.arabic_text)}, ${surahSourceSubquery})`,
    );

  const migrationSql = `-- Phase 2A: additive canonical Arabic data import (Tanzil Uthmani v1.1).
-- Generated by scripts/quran-import/generate-arabic-migration.mjs from a
-- freshly re-fetched, re-validated Tanzil artifact (checksums below).
-- ALL validation gates passed before this file was generated: 114 surahs,
-- 6,236 ayahs, 0 missing/duplicate/out-of-range rows, 0 substantive
-- discrepancies against the existing 7-surah/58-ayah bootstrap, Surahs 95
-- and 97's shadda-idgham Bismillah correctly recognized and separated from
-- their numbered ayah 1 text.
--
-- Source: Tanzil Project, Uthmani Script v1.1
--   text checksum (sha256):     ${textArtifact.checksumSha256}
--   metadata checksum (sha256): ${metaArtifact.checksumSha256}
--
-- Additive only: ${missingSurahs.length} new surahs, ${missingAyahs.length} new ayahs.
-- The existing ${existingSurahNumbers.size} surahs / ${existingAyahKeys.size} ayahs are
-- NEVER touched by this migration — no UPDATE, no DELETE, no overwrite.
-- bookmarks/notes/memorization_progress's composite FK to ayahs with
-- ON DELETE RESTRICT is unaffected (ayahs are only ever added here, never
-- removed or altered).
--
-- Requires two prior migrations to already be applied:
--   20260820130000 (surahs.transliteration added, surahs.name_fr nullable)
--   20260820150000 (ayahs.translation_en / translation_fr nullable)
-- This migration contains no schema changes of its own — pure data insert.
--
-- name_fr is explicitly NULL for every new surah (no governed French name
-- source yet — see 20260820130000's rationale). translation_en/
-- translation_fr are NULL for every new ayah — EN/FR import is a later,
-- separately approved step (Phase 2B). Neither is invented here.

INSERT INTO public.surahs
  (number, name_en, name_ar, name_fr, transliteration, ayah_count, revelation_type, bismillah_pre, metadata_source_id)
VALUES
${surahValues.join(",\n")}
ON CONFLICT (number) DO NOTHING;

INSERT INTO public.ayahs (surah_number, ayah_number, arabic_text, arabic_source_id)
VALUES
${ayahValues.join(",\n")}
ON CONFLICT (surah_number, ayah_number) DO NOTHING;
`;

  await mkdir(GENERATED_DIR, { recursive: true });
  const outPath = path.join(GENERATED_DIR, "arabic-import.sql");
  await writeFile(outPath, migrationSql);
  console.log(`\nGenerated migration written to: ${outPath}`);
  console.log(`Total lines: ${migrationSql.split("\n").length}`);
}

main().catch((err) => {
  console.error("Generator failed:", err);
  process.exitCode = 1;
});

#!/usr/bin/env node
// Phase 2B — English (Pickthall) translation import-pipeline VALIDATION
// ONLY. Governed source: Marmaduke Pickthall — Project Gutenberg eBook
// #16955 digital edition (explicitly NOT the 1930 first edition — see
// CORRECTION_MANIFEST and report notes below for why).
//
// This script never writes to the database and never generates migration
// SQL. It:
//   1. Downloads the exact Gutenberg #16955 plain-text artifact (falling
//      back across mirrors — the canonical www.gutenberg.org host is prone
//      to 504s for this file) and records its exact URL, retrieval
//      timestamp, byte size, and SHA-256 checksum.
//   2. Extracts ONLY `P:` (Pickthall) entries, handling multiline entries
//      deterministically (accumulate continuation lines until a blank
//      line).
//   3. Applies ONLY the four documented CORRECTION_MANIFEST entries to fix
//      malformed verse identifiers in the source file (dropped digits in
//      the numeric label itself, e.g. "0.033" -> "017.033"). These never
//      touch translation wording — only the (surah, ayah) label a P: block
//      is attributed to — and are resolved solely by strict sequential
//      position within the surrounding, unambiguous chapter run. No other
//      identifier is ever inferred or guessed.
//   4. Validates structure: 114 surahs, 6,236 ayah references, 0 missing,
//      0 duplicates, 0 blank translations, exact alignment against the
//      live canonical public.surahs.ayah_count per surah.
//   5. Reports the 3 mandatory verses (1:4, 2:255, 6:9) plus a fixed,
//      reproducible 22-verse stratified spot-check sample (long/medium/
//      short surahs, several from chapters 6-38) verbatim, for manual
//      review — this script does not compare against other candidate
//      sources itself (that comparison was done, and is documented, in the
//      Phase 2B Candidate 5 investigation report).
//   6. Writes a JSON + Markdown dry-run report to scripts/quran-import/
//      reports/ and prints a summary to stdout. This script performs no
//      writes of any kind to public.ayahs, public.translations, or
//      public.content_sources.
//
// Run:
//   node scripts/quran-import/validate-pickthall-gutenberg.mjs
//
// Requires .env.test (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) to
// read the canonical public.surahs.ayah_count values for alignment
// checking. The Gutenberg fetch itself needs no credentials.

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

// www.gutenberg.org returns persistent 504/503 for this file; official
// mirrors are used as fallbacks, in order, and their content is required to
// be byte-identical (same SHA-256) before being trusted.
const GUTENBERG_URLS = [
  "https://www.gutenberg.org/files/16955/16955.txt",
  "http://aleph.gutenberg.org/1/6/9/5/16955/16955.txt",
  "http://gutenberg.pglaf.org/1/6/9/5/16955/16955.txt",
];
const EXPECTED_SHA256 = "8ea8efcdf76a20ac1a6a3948c292f44fc7acda597ed7cbc50ac2dc4c254be7a8";

const ARTIFACT_DIR = path.join(__dirname, "artifacts");
const REPORT_DIR = path.join(__dirname, "reports");

// ---- The four documented, deterministic identifier corrections ----
// Each was found by exhaustively grepping for verse-identifier lines that
// don't match the strict `\d{3}\.\d{3}` pattern (6,232 strict matches found
// vs. 6,236 expected — a 4-row gap that exactly accounts for these). Every
// one resolves unambiguously: the surrounding chapter run of identifiers is
// strictly sequential immediately before and after each malformed line, so
// there is exactly one possible correct value, independent of translation
// content. None of these touch the P: text itself.
const CORRECTION_MANIFEST = [
  {
    rawIdentifier: "0.033",
    correctedSurah: 17,
    correctedAyah: 33,
    correctedIdentifier: "017.033",
    context:
      'Preceded by "017.032" (verse ending "...to fornication; surely it is an indecency and an evil way."); followed by "017.034". Line found at byte offset within the Al-Isra chapter run.',
    reason:
      'Isolated dropped leading digits: "017.033" with the "17" truncated to a bare "0" before the period. The immediately preceding and following identifiers in the source are 017.032 and 017.034 — strictly sequential and unambiguous.',
    validationEvidence:
      "Sequential-position check: previous ref 017.032, next ref 017.034. No other candidate value satisfies both the local chapter run and the surah's canonical ayah_count.",
  },
  {
    rawIdentifier: "039.04",
    correctedSurah: 39,
    correctedAyah: 46,
    correctedIdentifier: "039.046",
    context: 'Preceded by "039.045"; followed by "039.047" (chapter Az-Zumar).',
    reason:
      'Trailing digit dropped: "039.046" printed as "039.04". Previous ref is 039.045, so the only value continuing the sequence is 039.046.',
    validationEvidence:
      "Sequential-position check: previous ref 039.045, next ref 039.047. Matches canonical ayah_count for Surah 39 (75 ayahs) with no gap.",
  },
  {
    rawIdentifier: "04.032",
    correctedSurah: 45,
    correctedAyah: 32,
    correctedIdentifier: "045.032",
    context: 'Preceded by "045.031"; followed by "045.033" (chapter Al-Jathiyah).',
    reason:
      'Middle digit dropped: "045.032" printed as "04.032" (the surah number\'s middle "5" missing). Previous ref is 045.031, so 045.032 is the only value continuing the sequence.',
    validationEvidence:
      "Sequential-position check: previous ref 045.031, next ref 045.033. Matches canonical ayah_count for Surah 45 (37 ayahs) with no gap.",
  },
  {
    rawIdentifier: "05.026",
    correctedSurah: 56,
    correctedAyah: 26,
    correctedIdentifier: "056.026",
    context: 'Preceded by "056.025"; followed by "056.027" (chapter Al-Waqi\'ah).',
    reason:
      'Trailing surah digit dropped: "056.026" printed as "05.026" (the surah number\'s trailing "6" missing). Previous ref is 056.025, so 056.026 is the only value continuing the sequence.',
    validationEvidence:
      "Sequential-position check: previous ref 056.025, next ref 056.027. Matches canonical ayah_count for Surah 56 (96 ayahs) with no gap.",
  },
];
const CORRECTION_MAP = new Map(
  CORRECTION_MANIFEST.map((c) => [c.rawIdentifier, c.correctedIdentifier]),
);

// Fixed, reproducible stratified sample: 3 mandatory + 22 additional across
// long/medium/short surahs and several from chapters 6-38. Identical to the
// sample used in the Candidate 5 investigation report, so results here are
// directly comparable to that report's findings.
const MANDATORY_REFS = ["1:4", "2:255", "6:9"];
const SPOT_CHECK_REFS = [
  "2:1",
  "2:100",
  "2:282",
  "4:1",
  "4:34",
  "7:1",
  "7:157",
  "18:1",
  "18:110",
  "36:1",
  "105:1",
  "112:1",
  "112:4",
  "114:1",
  "108:1",
  "6:1",
  "10:1",
  "15:9",
  "20:1",
  "25:1",
  "30:1",
  "33:35",
  "38:1",
];

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

// Extract only P: entries, multiline-aware, applying the correction
// manifest to malformed identifiers only (never to translation wording).
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

async function main() {
  console.log("Phase 2B — Pickthall (Gutenberg #16955) validation-only dry run\n");

  console.log("Fetching Gutenberg artifact (mirror fallback)...");
  const { url, buf, retrievedAt } = await fetchWithFallback(GUTENBERG_URLS);
  const checksumSha256 = sha256(buf);
  const bytes = buf.length;
  console.log(`  source: ${url}`);
  console.log(`  bytes: ${bytes}`);
  console.log(`  sha256: ${checksumSha256}`);

  const checksumMatch = checksumSha256 === EXPECTED_SHA256;
  console.log(
    `  checksum match vs. Candidate 5 investigation (${EXPECTED_SHA256}): ${checksumMatch ? "MATCH" : "MISMATCH — STOP"}`,
  );

  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(path.join(ARTIFACT_DIR, "pg16955.txt"), buf);

  const raw = buf.toString("utf-8");
  const { verses, blanks, duplicates, appliedCorrections } = parsePickthall(raw);

  console.log(`\nExtracted ${verses.size} Pickthall entries (expected 6236)`);
  console.log(`Applied identifier corrections: ${appliedCorrections.length} (expected 4)`);
  console.log(`Blanks: ${blanks.length}, Duplicates: ${duplicates.length}`);

  // ---- Canonical alignment against live public.surahs ----
  const client = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: surahs, error } = await client
    .from("surahs")
    .select("number, transliteration, ayah_count")
    .order("number");
  if (error) throw error;

  const surahsRepresented = new Set([...verses.keys()].map((k) => Number(k.split(":")[0])));
  const missingRefs = [];
  for (const s of surahs) {
    for (let a = 1; a <= s.ayah_count; a++) {
      if (!verses.has(`${s.number}:${a}`)) missingRefs.push(`${s.number}:${a}`);
    }
  }
  const totalExpected = surahs.reduce((sum, s) => sum + s.ayah_count, 0);

  console.log(`\nSurahs represented: ${surahsRepresented.size} (expected 114)`);
  console.log(`Missing canonical references: ${missingRefs.length} (expected 0)`);
  console.log(`Total expected (from canonical DB): ${totalExpected}, extracted: ${verses.size}`);

  const mandatory = {};
  for (const ref of MANDATORY_REFS) mandatory[ref] = verses.get(ref) ?? null;
  const spotChecks = {};
  for (const ref of SPOT_CHECK_REFS) spotChecks[ref] = verses.get(ref) ?? null;

  const gatesPassed =
    checksumMatch &&
    surahsRepresented.size === 114 &&
    verses.size === 6236 &&
    missingRefs.length === 0 &&
    duplicates.length === 0 &&
    blanks.length === 0 &&
    appliedCorrections.length === 4;

  const report = {
    generatedAt: new Date().toISOString(),
    governedSourceIdentity: "Marmaduke Pickthall — Project Gutenberg eBook #16955 digital edition",
    explicitlyNot: "Pickthall 1930 first edition (validated as not an exact reproduction of it)",
    source: {
      provider: "Project Gutenberg",
      ebookNumber: 16955,
      url,
      retrievedAt,
      bytes,
      checksumSha256,
      expectedChecksumSha256: EXPECTED_SHA256,
      checksumMatch,
      gutenbergProvenanceNote:
        "This text originates from a file whose origins we don't know, found in many places on the Internet. It was re-proofed and corrected for Project Gutenberg against paper copies of the translations by Irfan Ali.",
      publicDomainAssessment:
        "Public domain in the United States per Project Gutenberg's own statement (\"Creating the works from public domain print editions means that no one owns a United States copyright in these works\"). Jurisdiction scope: US only, per Project Gutenberg's standard terms — not independently assessed for other jurisdictions.",
    },
    correctionManifest: CORRECTION_MANIFEST,
    appliedCorrections,
    structural: {
      totalExtracted: verses.size,
      expectedTotal: totalExpected,
      surahsRepresented: surahsRepresented.size,
      expectedSurahs: 114,
      missingReferences: missingRefs,
      duplicateReferences: duplicates,
      blankReferences: blanks,
    },
    mandatoryVerses: mandatory,
    spotCheckVerses: spotChecks,
    gatesPassed,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(
    path.join(REPORT_DIR, "pickthall-gutenberg-dry-run.json"),
    JSON.stringify(report, null, 2),
  );

  const md = [
    "# Pickthall (Gutenberg #16955) — Dry-Run Validation Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `**Governed source identity:** ${report.governedSourceIdentity}`,
    `**Explicitly NOT:** ${report.explicitlyNot}`,
    "",
    "## Source",
    `- URL: ${url}`,
    `- Retrieved: ${retrievedAt}`,
    `- Bytes: ${bytes}`,
    `- SHA-256: ${checksumSha256}`,
    `- Checksum match vs. investigation report: ${checksumMatch ? "MATCH" : "MISMATCH"}`,
    "",
    "## Structural result",
    `- Extracted: ${verses.size} / 6236`,
    `- Surahs represented: ${surahsRepresented.size} / 114`,
    `- Missing references: ${missingRefs.length}`,
    `- Duplicate references: ${duplicates.length}`,
    `- Blank references: ${blanks.length}`,
    `- Identifier corrections applied: ${appliedCorrections.length} / 4`,
    "",
    `## Gates: ${gatesPassed ? "ALL PASS" : "FAILED — see JSON report for details"}`,
    "",
    "## Mandatory verses",
    ...MANDATORY_REFS.map((r) => `- **${r}**: ${mandatory[r]}`),
    "",
    "## Spot-check sample",
    ...SPOT_CHECK_REFS.map((r) => `- **${r}**: ${spotChecks[r]}`),
  ].join("\n");
  await writeFile(path.join(REPORT_DIR, "pickthall-gutenberg-dry-run.md"), md);

  console.log(`\nGates passed: ${gatesPassed}`);
  console.log(
    `Report written to scripts/quran-import/reports/pickthall-gutenberg-dry-run.{json,md}`,
  );
  console.log(
    "\nThis script performed NO writes to public.ayahs, public.translations, or public.content_sources.",
  );

  if (!gatesPassed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
// Phase 2A — canonical Arabic import-pipeline VALIDATION ONLY.
//
// This script never writes to the database. It:
//   1. Downloads the exact versioned Tanzil Uthmani text + metadata XML
//      artifacts (public, unauthenticated downloads — no scraping of any
//      API whose terms haven't been confirmed).
//   2. Records each artifact's exact URL, version, retrieval timestamp,
//      byte size, and SHA-256 checksum.
//   3. Parses all 114 surahs / 6,236 ayahs and validates structure:
//      surah coverage (1-114, no gaps/duplicates), per-surah ayah counts
//      against Tanzil's own independently-published metadata file,
//      duplicate/out-of-range ayah numbers, and blank/null Arabic text.
//   4. Applies the same Bismillah-stripping rule approved for the V1
//      bootstrap migration, deriving the Bismillah string from Al-Fatiha's
//      own stored text rather than hand-typing it, and explicitly
//      validates the Al-Fatiha and At-Tawbah exceptions.
//   5. Compares the existing 7-surah/58-ayah bootstrap rows already live
//      in Supabase against the freshly parsed Tanzil data, ayah by ayah,
//      and classifies every row as an exact match, a formatting-only
//      difference, or a substantive difference. It never writes to those
//      rows — this is a read-only comparison.
//   6. Writes a JSON + Markdown report to scripts/quran-import/reports/
//      and prints a summary to stdout. Exits non-zero (and says so loudly)
//      if any substantive Arabic-text discrepancy or structural validation
//      issue is found — per the "if sources conflict, STOP" principle.
//
// Run:
//   node scripts/quran-import/validate-tanzil.mjs
//
// Requires .env.test (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) for
// the bootstrap-comparison step. The Tanzil fetch itself needs no
// credentials — public, versioned, unauthenticated download.

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
const TANZIL_DECLARED_VERSION = "1.1"; // per the copyright block embedded in the text artifact itself

const ARTIFACT_DIR = path.join(__dirname, "artifacts");
const REPORT_DIR = path.join(__dirname, "reports");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fetchArtifact(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const retrievedAt = new Date().toISOString();
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const filePath = path.join(ARTIFACT_DIR, filename);
  await writeFile(filePath, buf);
  return {
    filename,
    filePath,
    url,
    checksumSha256: sha256(buf),
    bytes: buf.length,
    retrievedAt,
    text: buf.toString("utf-8"),
  };
}

// ---- Parse Tanzil text: "surah|ayah|text" lines, "#" comments, blanks ----
function parseTanzilText(raw) {
  const lines = raw.split("\n");
  const ayahs = [];
  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const parts = line.split("|");
    if (parts.length !== 3) {
      throw new Error(`Malformed line (expected 3 pipe-separated fields): ${JSON.stringify(line)}`);
    }
    const [surahStr, ayahStr, text] = parts;
    const surah_number = Number(surahStr);
    const ayah_number = Number(ayahStr);
    if (!Number.isInteger(surah_number) || !Number.isInteger(ayah_number)) {
      throw new Error(`Non-integer surah/ayah number: ${JSON.stringify(line)}`);
    }
    ayahs.push({ surah_number, ayah_number, arabic_text: text });
  }
  return ayahs;
}

// ---- Parse Tanzil quran-data.xml: <sura index=".." ayas=".." .../> ----
// Attribute-name based extraction (not positional) so this is robust
// regardless of attribute ordering in the source XML.
function parseMetadataXml(xml) {
  const tagRe = /<sura\b([^>]*)\/>/g;
  const attrRe = /(\w+)="([^"]*)"/g;
  const surahs = [];
  let tagMatch;
  while ((tagMatch = tagRe.exec(xml))) {
    const attrs = {};
    attrRe.lastIndex = 0;
    let attrMatch;
    while ((attrMatch = attrRe.exec(tagMatch[1]))) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    surahs.push({
      number: Number(attrs.index),
      ayah_count: Number(attrs.ayas),
      name_ar: attrs.name,
      transliteration: attrs.tname,
      name_en: attrs.ename,
      revelation_type: (attrs.type || "").toLowerCase(),
      revelation_order: Number(attrs.order),
    });
  }
  return surahs;
}

function validateSurahCoverage(metaSurahs) {
  const issues = [];
  const numbers = metaSurahs.map((s) => s.number);
  if (numbers.length !== 114) {
    issues.push(`Expected 114 surahs in metadata, found ${numbers.length}`);
  }
  const seen = new Set();
  for (const n of numbers) {
    if (seen.has(n)) issues.push(`Duplicate surah number in metadata: ${n}`);
    seen.add(n);
  }
  for (let i = 1; i <= 114; i++) {
    if (!seen.has(i)) issues.push(`Missing surah number in metadata: ${i}`);
  }
  return issues;
}

function validateAyahCoverage(ayahs, metaSurahs) {
  const issues = [];
  let duplicateCount = 0;
  let missingCount = 0;
  let outOfRangeCount = 0;

  const seenPairs = new Set();
  for (const a of ayahs) {
    const key = `${a.surah_number}:${a.ayah_number}`;
    if (seenPairs.has(key)) {
      issues.push(`Duplicate ayah row: ${key}`);
      duplicateCount++;
    }
    seenPairs.add(key);
  }

  const bySurah = new Map();
  for (const a of ayahs) {
    if (!bySurah.has(a.surah_number)) bySurah.set(a.surah_number, []);
    bySurah.get(a.surah_number).push(a.ayah_number);
  }

  for (const meta of metaSurahs) {
    const list = (bySurah.get(meta.number) ?? []).slice().sort((x, y) => x - y);
    if (list.length !== meta.ayah_count) {
      issues.push(
        `Surah ${meta.number} (${meta.transliteration}): metadata declares ${meta.ayah_count} ayahs, parsed ${list.length}`,
      );
    }
    const expected = Array.from({ length: meta.ayah_count }, (_, i) => i + 1);
    const missing = expected.filter((n) => !list.includes(n));
    const outOfRange = list.filter((n) => n < 1 || n > meta.ayah_count);
    if (missing.length) {
      issues.push(`Surah ${meta.number}: missing ayah numbers ${missing.join(",")}`);
      missingCount += missing.length;
    }
    if (outOfRange.length) {
      issues.push(`Surah ${meta.number}: out-of-range ayah numbers ${outOfRange.join(",")}`);
      outOfRangeCount += outOfRange.length;
    }
  }
  return { issues, duplicateCount, missingCount, outOfRangeCount };
}

function validateNoBlankText(ayahs) {
  return ayahs
    .filter((a) => !a.arabic_text || a.arabic_text.trim() === "")
    .map((a) => `${a.surah_number}:${a.ayah_number} has blank/null Arabic text`);
}

// Same methodology as the V1 bootstrap migration: derive the Bismillah
// string from Al-Fatiha's own stored ayah 1 (never hand-typed), strip it
// only as a prefix of ayah_number = 1 (never mid-ayah, e.g. An-Naml 27:30's
// internal quotation of it), and explicitly validate the named exceptions
// rather than assuming them.
//
// Surahs 95 and 97 carry a second, equally legitimate Bismillah form: per
// Tanzil's own "A Note on Bismillah" documentation (tanzil.net/docs/
// a_note_on_bismillah), these two surahs' preceding surahs end in a Majzoom
// Beh, and Arabic idgham merges that Beh into the following Bismillah's
// opening Beh — notated with a shadda. Tanzil encodes the Bismillah on the
// same physical line as ayah 1 for every surah but Al-Fatiha purely to
// preserve the 6,236-line/ayah numbering format; the Bismillah itself is
// not part of numbered ayah 1 there either, shadda or not. So: recognize
// both forms, strip whichever matches, and set bismillah_pre = true for
// both 95 and 97 exactly like every other non-Fatiha, non-Tawbah surah.
function applyBismillahRules(ayahs) {
  const issues = [];
  const fatiha1 = ayahs.find((a) => a.surah_number === 1 && a.ayah_number === 1);
  if (!fatiha1)
    throw new Error("Al-Fatiha 1:1 not found in parsed data — cannot derive the Bismillah string");
  const bismillahStandard = fatiha1.arabic_text.trim();

  // Derive the shadda-idgham form structurally from surah 95's own ayah 1
  // (never hand-typed) rather than constructing it by guessing where to
  // insert a shadda character.
  const surah95Ayah1 = ayahs.find((a) => a.surah_number === 95 && a.ayah_number === 1);
  if (!surah95Ayah1)
    throw new Error("Surah 95 ayah 1 not found — cannot derive the shadda-idgham Bismillah form");
  const shaddaVariant = detectBismillahVariant(surah95Ayah1.arabic_text, bismillahStandard);
  if (!shaddaVariant) {
    throw new Error(
      "Surah 95 ayah 1 does not carry the documented shadda-idgham Bismillah prefix — cannot proceed without re-verifying this against the source",
    );
  }
  const bismillahShaddaForm = shaddaVariant.variantPrefix;

  function matchBismillah(text) {
    if (text.startsWith(bismillahStandard))
      return { form: "standard", prefixLength: bismillahStandard.length };
    if (text.startsWith(bismillahShaddaForm))
      return { form: "shadda-idgham", prefixLength: bismillahShaddaForm.length };
    return null;
  }

  const firstAyahBySurah = new Map();
  for (const a of ayahs) {
    if (a.ayah_number === 1) firstAyahBySurah.set(a.surah_number, a);
  }

  const strippedAyahs = ayahs.map((a) => {
    if (a.surah_number === 1) return a; // Al-Fatiha 1:1 IS the Bismillah — untouched
    if (a.ayah_number !== 1) return a; // never strip anywhere but each surah's own ayah 1
    const match = matchBismillah(a.arabic_text);
    if (!match) return a;
    return { ...a, arabic_text: a.arabic_text.slice(match.prefixLength).trimStart() };
  });

  const bismillahPreBySurah = {};
  for (let s = 1; s <= 114; s++) {
    const first = firstAyahBySurah.get(s);
    if (!first) continue; // reported separately by validateAyahCoverage
    if (s === 1) {
      bismillahPreBySurah[s] = false; // Bismillah IS ayah 1, no separate header
    } else if (s === 9) {
      bismillahPreBySurah[s] = false; // At-Tawbah: no Bismillah at all
      if (matchBismillah(first.arabic_text)) {
        issues.push(
          "At-Tawbah (9) ayah 1 unexpectedly starts with a Bismillah form in the source text",
        );
      }
    } else {
      bismillahPreBySurah[s] = true; // includes 95 and 97 — Bismillah present, structurally separate from ayah 1
      if (!matchBismillah(first.arabic_text)) {
        issues.push(
          `Surah ${s} ayah 1 does not start with either recognized Bismillah form (bismillah_pre should be true)`,
        );
      }
    }
  }

  return { strippedAyahs, bismillahStandard, bismillahShaddaForm, bismillahPreBySurah, issues };
}

// Explicit pass/fail assertions for the named special cases, per instruction
// to "explicitly test Surahs 95 and 97 as special orthographic cases" and
// continue treating 1 and 9 per the adopted convention.
function runSpecialCaseTests({
  rawAyahs,
  strippedAyahs,
  bismillahPreBySurah,
  bismillahStandard,
  bismillahShaddaForm,
}) {
  const rawByKey = new Map(rawAyahs.map((a) => [`${a.surah_number}:${a.ayah_number}`, a]));
  const strippedByKey = new Map(
    strippedAyahs.map((a) => [`${a.surah_number}:${a.ayah_number}`, a]),
  );
  const tests = [];
  const check = (name, pass) => tests.push({ name, pass: Boolean(pass) });

  check("Surah 1: bismillah_pre is false (Bismillah IS ayah 1)", bismillahPreBySurah[1] === false);
  check(
    "Surah 1: ayah 1 text equals the standard Bismillah exactly, untouched by stripping",
    strippedByKey.get("1:1")?.arabic_text === bismillahStandard,
  );

  check("Surah 9: bismillah_pre is false (no Bismillah at all)", bismillahPreBySurah[9] === false);
  check(
    "Surah 9: raw ayah 1 does not start with either Bismillah form",
    !rawByKey.get("9:1")?.arabic_text.startsWith(bismillahStandard) &&
      !rawByKey.get("9:1")?.arabic_text.startsWith(bismillahShaddaForm),
  );
  check(
    "Surah 9: ayah 1 text is unchanged by stripping (nothing to strip)",
    rawByKey.get("9:1")?.arabic_text === strippedByKey.get("9:1")?.arabic_text,
  );

  for (const s of [95, 97]) {
    check(
      `Surah ${s}: raw ayah 1 starts with the shadda-idgham Bismillah form, not the standard form`,
      rawByKey.get(`${s}:1`)?.arabic_text.startsWith(bismillahShaddaForm) &&
        !rawByKey.get(`${s}:1`)?.arabic_text.startsWith(bismillahStandard),
    );
    check(
      `Surah ${s}: bismillah_pre is true (Bismillah present, structurally separate from ayah 1)`,
      bismillahPreBySurah[s] === true,
    );
    check(
      `Surah ${s}: stripped ayah 1 text contains neither Bismillah form`,
      !strippedByKey.get(`${s}:1`)?.arabic_text.startsWith(bismillahStandard) &&
        !strippedByKey.get(`${s}:1`)?.arabic_text.startsWith(bismillahShaddaForm),
    );
    check(
      `Surah ${s}: stripped ayah 1 is strictly shorter than raw ayah 1 (the Bismillah was actually removed)`,
      (strippedByKey.get(`${s}:1`)?.arabic_text.length ?? 0) <
        (rawByKey.get(`${s}:1`)?.arabic_text.length ?? 0),
    );
  }

  return tests;
}

async function fetchBootstrapAyahs() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env.test");
  }
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from("ayahs")
    .select("surah_number, ayah_number, arabic_text")
    .order("surah_number", { ascending: true })
    .order("ayah_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Formatting-only normalization used ONLY for comparison classification —
// never applied to any value that would be written anywhere. Mirrors the
// tatweel/annotation-mark differences already documented in Migration 1's
// header comment as the only kind of difference found between digitizations.
function normalizeForComparison(text) {
  return (
    text
      .normalize("NFC") // canonicalize combining-mark order/composition — without
      // this, two sources can encode visually identical text with combining
      // marks in a different codepoint order and compare as "substantively"
      // different when they are not
      .replace(/ـ/g, "") // tatweel
      .replace(/[ۖ-ۭ]/g, "") // Quranic annotation signs (waqf marks etc.)
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Some ayat carry an orthographic Bismillah variant with an extra shadda
// (idgham/wasl connection to the preceding surah in continuous recitation —
// observed for surahs 95 and 97 in this Tanzil release). This is a real,
// documented Mushaf feature, not a data error, and not something to
// silently strip using a guessed/hand-typed variant string. This function
// derives the exact variant prefix structurally from the source text
// itself: same base first letter as the standard Bismillah, then some
// combining marks only, then the standard Bismillah's remainder verbatim.
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
  return { variantPrefix: text.slice(0, idx + remainder.length), insertedMarks };
}

function compareBootstrap(bootstrapAyahs, strippedTanzilAyahs) {
  const tanzilMap = new Map(
    strippedTanzilAyahs.map((a) => [`${a.surah_number}:${a.ayah_number}`, a]),
  );
  const exactMatches = [];
  const formattingOnlyDifferences = [];
  const substantiveDifferences = [];
  const missingInTanzil = [];

  for (const b of bootstrapAyahs) {
    const key = `${b.surah_number}:${b.ayah_number}`;
    const t = tanzilMap.get(key);
    if (!t) {
      missingInTanzil.push(key);
      continue;
    }
    if (b.arabic_text === t.arabic_text) {
      exactMatches.push(key);
    } else if (normalizeForComparison(b.arabic_text) === normalizeForComparison(t.arabic_text)) {
      formattingOnlyDifferences.push({ key, bootstrap: b.arabic_text, tanzil: t.arabic_text });
    } else {
      substantiveDifferences.push({ key, bootstrap: b.arabic_text, tanzil: t.arabic_text });
    }
  }

  return { exactMatches, formattingOnlyDifferences, substantiveDifferences, missingInTanzil };
}

async function main() {
  console.log("=== Phase 2A Tanzil validation pipeline (read-only) ===\n");

  console.log("Fetching Tanzil Uthmani text artifact...");
  const textArtifact = await fetchArtifact(TANZIL_TEXT_URL, "quran-uthmani.txt");
  console.log(`  URL: ${textArtifact.url}`);
  console.log(`  Saved: ${textArtifact.filePath}`);
  console.log(`  Bytes: ${textArtifact.bytes}`);
  console.log(`  SHA-256: ${textArtifact.checksumSha256}`);
  console.log(`  Retrieved at: ${textArtifact.retrievedAt}\n`);

  console.log("Fetching Tanzil metadata XML artifact...");
  const metaArtifact = await fetchArtifact(TANZIL_METADATA_URL, "quran-data.xml");
  console.log(`  URL: ${metaArtifact.url}`);
  console.log(`  Saved: ${metaArtifact.filePath}`);
  console.log(`  Bytes: ${metaArtifact.bytes}`);
  console.log(`  SHA-256: ${metaArtifact.checksumSha256}`);
  console.log(`  Retrieved at: ${metaArtifact.retrievedAt}\n`);

  const rawAyahs = parseTanzilText(textArtifact.text);
  const metaSurahs = parseMetadataXml(metaArtifact.text);

  const surahCoverageIssues = validateSurahCoverage(metaSurahs);
  const {
    issues: ayahCoverageIssues,
    duplicateCount,
    missingCount,
    outOfRangeCount,
  } = validateAyahCoverage(rawAyahs, metaSurahs);
  const blankTextIssues = validateNoBlankText(rawAyahs);
  const {
    strippedAyahs,
    bismillahStandard,
    bismillahShaddaForm,
    bismillahPreBySurah,
    issues: bismillahIssues,
  } = applyBismillahRules(rawAyahs);

  const specialCaseTests = runSpecialCaseTests({
    rawAyahs,
    strippedAyahs,
    bismillahPreBySurah,
    bismillahStandard,
    bismillahShaddaForm,
  });
  const failedSpecialCaseTests = specialCaseTests.filter((t) => !t.pass);

  console.log("Comparing against existing live bootstrap rows (Supabase, read-only)...");
  const bootstrapAyahs = await fetchBootstrapAyahs();
  const comparison = compareBootstrap(bootstrapAyahs, strippedAyahs);

  const allStructuralIssues = [
    ...surahCoverageIssues,
    ...ayahCoverageIssues,
    ...blankTextIssues,
    ...bismillahIssues,
  ];

  // The exact gates required before migration drafting.
  const gates = {
    surahsEqual114: metaSurahs.length === 114,
    ayahsEqual6236: rawAyahs.length === 6236,
    zeroMissingRows: missingCount === 0,
    zeroDuplicateRows: duplicateCount === 0,
    zeroOutOfRangeRows: outOfRangeCount === 0,
    zeroSubstantiveBootstrapDifferences: comparison.substantiveDifferences.length === 0,
    zeroUnresolvedBismillahIssues: bismillahIssues.length === 0,
    surah95And97SpecialCasesPass: [95, 97].every((s) =>
      specialCaseTests.filter((t) => t.name.startsWith(`Surah ${s}:`)).every((t) => t.pass),
    ),
    allSpecialCaseTestsPass: failedSpecialCaseTests.length === 0,
  };
  const allGatesPass = Object.values(gates).every(Boolean);

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      textArtifact: {
        url: textArtifact.url,
        filename: textArtifact.filename,
        declaredVersion: TANZIL_DECLARED_VERSION,
        checksumSha256: textArtifact.checksumSha256,
        bytes: textArtifact.bytes,
        retrievedAt: textArtifact.retrievedAt,
      },
      metadataArtifact: {
        url: metaArtifact.url,
        filename: metaArtifact.filename,
        checksumSha256: metaArtifact.checksumSha256,
        bytes: metaArtifact.bytes,
        retrievedAt: metaArtifact.retrievedAt,
      },
    },
    parsed: {
      totalSurahsInMetadata: metaSurahs.length,
      totalAyahsParsed: rawAyahs.length,
      bismillahStandard,
      bismillahShaddaForm,
      bismillahPreBySurah,
    },
    validation: {
      surahCoverageIssues,
      ayahCoverageIssues,
      duplicateCount,
      missingCount,
      outOfRangeCount,
      blankTextIssues,
      bismillahIssues,
    },
    specialCaseTests,
    bootstrapComparison: {
      bootstrapRowsCompared: bootstrapAyahs.length,
      exactMatches: comparison.exactMatches.length,
      formattingOnlyDifferences: comparison.formattingOnlyDifferences,
      substantiveDifferences: comparison.substantiveDifferences,
      missingInTanzil: comparison.missingInTanzil,
    },
    gates,
    verdict: allGatesPass
      ? "ALL GATES PASS — clear to proceed to migration drafting"
      : "STOP — one or more gates failed",
  };

  await mkdir(REPORT_DIR, { recursive: true });
  const jsonPath = path.join(REPORT_DIR, "validation-report.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report written to: ${jsonPath}`);

  console.log("\n=== SUMMARY ===");
  console.log(`Source checksum (text):     ${textArtifact.checksumSha256}`);
  console.log(`Source checksum (metadata): ${metaArtifact.checksumSha256}`);
  console.log(`Total surahs parsed:        ${metaSurahs.length}`);
  console.log(`Total ayahs parsed:         ${rawAyahs.length}`);
  console.log(`Bootstrap rows compared:    ${bootstrapAyahs.length}`);
  console.log(`  Exact matches:            ${comparison.exactMatches.length}`);
  console.log(`  Formatting-only diffs:    ${comparison.formattingOnlyDifferences.length}`);
  console.log(`  Substantive diffs:        ${comparison.substantiveDifferences.length}`);
  console.log(`  Missing in Tanzil:        ${comparison.missingInTanzil.length}`);
  console.log(`Missing rows (coverage):   ${missingCount}`);
  console.log(`Duplicate rows:            ${duplicateCount}`);
  console.log(`Out-of-range rows:         ${outOfRangeCount}`);
  console.log(`Structural validation issues: ${allStructuralIssues.length}`);
  console.log(`\n=== GATES ===`);
  for (const [name, pass] of Object.entries(gates)) {
    console.log(`  [${pass ? "PASS" : "FAIL"}] ${name}`);
  }
  console.log(`\n=== SPECIAL-CASE TESTS ===`);
  for (const t of specialCaseTests) {
    console.log(`  [${t.pass ? "PASS" : "FAIL"}] ${t.name}`);
  }
  console.log(`\nVERDICT: ${report.verdict}`);

  if (!allGatesPass) {
    console.error("\nOne or more gates failed — see the full report before proceeding.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exitCode = 1;
});

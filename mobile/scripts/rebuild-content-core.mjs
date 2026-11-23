#!/usr/bin/env node
/**
 * Reproducible rebuild of the Quran content core (QR-DESIGN-007D).
 *
 * Rebuilds, from files already committed to this repository and nothing else, the
 * rows the content fingerprint covers: every Arabic ayah, every Pickthall English
 * row, every Kazimirski French segment (id and text hash) and every
 * segment-to-ayah mapping. It then recomputes the content fingerprint with the same
 * function the verifier uses and compares it with `content-db.expected.json`.
 *
 *   node mobile/scripts/rebuild-content-core.mjs --out <dir outside the repo>
 *
 * Inputs (all pinned by SHA-256 in `content-sources.lock.json`; any change fails):
 *   - supabase/migrations/20260818042151_*.sql   Arabic text of the 58-ayah bootstrap
 *   - supabase/migrations/20260820160000_*.sql   Tanzil Uthmani 1.1 import (6,178 ayahs)
 *   - supabase/migrations/20260820180000_*.sql   Pickthall (Project Gutenberg #16955)
 *   - scripts/quran-import/kazimirski/kazimirski_alignment_manifest.json
 *   - scripts/quran-import/kazimirski/texte_entier_raw.html   (Wikisource, frozen)
 *
 * It needs NO database, NO network and NO secrets, never reads production, never
 * touches the approved database, and writes only inside --out. It refuses an --out
 * inside the repository or at the approved database's location. Any mismatch (a
 * pinned input hash, a count, a text hash, the fingerprint) exits non-zero.
 *
 * Scope: this rebuilds the Quran content the fingerprint protects. It does not
 * rebuild the curriculum tables or `content_sources`, whose ids come from the
 * production database and are outside the fingerprint (see CI-DATABASE-STRATEGY.md).
 */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
  statSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeFingerprint, countRows } from "./verify-content-db.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/* ------------------------------------------------------------------ SQL literals */

/**
 * Parses the tuples of one `... VALUES (..),(..)...` list that starts at `from`.
 * Handles SQL strings with '' escapes, numbers, NULL, booleans and parenthesised
 * sub-selects (returned as the marker `{ sub: true }`). Standard-conforming strings
 * only: an `E'..'` escape string is rejected rather than guessed at.
 */
export function parseValues(sql, from) {
  let i = from;
  const ws = () => {
    while (i < sql.length && /\s/.test(sql[i])) i++;
  };
  const readString = () => {
    let out = "";
    i++; // opening quote
    for (;;) {
      if (i >= sql.length) throw new Error("unterminated SQL string");
      const c = sql[i];
      if (c === "'") {
        if (sql[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        i++;
        return out;
      }
      out += c;
      i++;
    }
  };
  const skipBalanced = () => {
    let depth = 0;
    do {
      const c = sql[i];
      if (c === "'") readString();
      else {
        if (c === "(") depth++;
        else if (c === ")") depth--;
        i++;
      }
    } while (depth > 0);
  };
  const rows = [];
  ws();
  while (sql[i] === "(") {
    i++;
    const row = [];
    for (;;) {
      ws();
      const c = sql[i];
      if (c === "'") row.push(readString());
      else if (c === "(") {
        skipBalanced();
        row.push({ sub: true });
      } else if ((c === "E" || c === "e") && sql[i + 1] === "'") {
        throw new Error("E'' escape strings are not supported by this parser");
      } else {
        let j = i;
        while (j < sql.length && sql[j] !== "," && sql[j] !== ")") j++;
        const tok = sql.slice(i, j).trim();
        i = j;
        if (/^-?\d+$/.test(tok)) row.push(Number(tok));
        else if (/^null$/i.test(tok)) row.push(null);
        else if (/^true$/i.test(tok)) row.push(true);
        else if (/^false$/i.test(tok)) row.push(false);
        else throw new Error(`unrecognised SQL token "${tok.slice(0, 40)}"`);
      }
      ws();
      if (sql[i] === ",") {
        i++;
        continue;
      }
      if (sql[i] === ")") {
        i++;
        break;
      }
      throw new Error(`unexpected character "${sql[i]}" in a VALUES tuple`);
    }
    rows.push(row);
    ws();
    if (sql[i] === ",") {
      i++;
      ws();
      continue;
    }
    break;
  }
  return rows;
}

/** Finds `header` (a literal statement prefix) exactly once and parses its VALUES list. */
export function valuesAfter(sql, header) {
  const first = sql.indexOf(header);
  if (first < 0) throw new Error(`statement not found: ${header.slice(0, 60)}`);
  if (sql.indexOf(header, first + 1) >= 0)
    throw new Error(`statement not unique: ${header.slice(0, 60)}`);
  return parseValues(sql, first + header.length);
}

/* ----------------------------------------------------------------------- UUID v5 */

/** RFC 4122 UUIDv5, byte-identical to Python's uuid.uuid5 used by the Kazimirski import. */
export function uuid5(namespace, name) {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const h = createHash("sha1")
    .update(ns)
    .update(Buffer.from(name, "utf8"))
    .digest()
    .subarray(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export const KAZIMIRSKI_NAMESPACE = "211bf6a0-ee15-46fa-831e-3cf62a524d9b";
export const KAZIMIRSKI_EDITION = "kazimirski-1869-segments-v1";

/* ------------------------------------------------------------------------ build */

function pinnedFile(lock, relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  const pin = lock.inputs[relPath];
  if (!pin) throw new Error(`input not pinned in content-sources.lock.json: ${relPath}`);
  const bytes = readFileSync(abs);
  const actual = sha256(bytes);
  if (actual !== pin.sha256) {
    throw new Error(
      `pinned input changed: ${relPath}\n  expected ${pin.sha256}\n  actual   ${actual}`,
    );
  }
  return bytes;
}

export function migrationPath(prefix) {
  const dir = path.join(REPO_ROOT, "supabase/migrations");
  const hits = readdirSync(dir).filter((f) => f.startsWith(prefix));
  if (hits.length !== 1)
    throw new Error(`expected exactly one migration for ${prefix}, found ${hits.length}`);
  return `supabase/migrations/${hits[0]}`;
}

/** Pure: assemble the content core from the already-verified input texts. */
export function buildCore({ bootstrapSql, tanzilSql, pickthallSql, manifest }) {
  const problems = [];

  // surahs (not fingerprinted, but needed for structure checks)
  const surahs = new Map();
  for (const r of valuesAfter(
    bootstrapSql,
    "INSERT INTO public.surahs (number, name_en, name_ar, name_fr, ayah_count, revelation_type, bismillah_pre) VALUES",
  )) {
    surahs.set(r[0], {
      number: r[0],
      name_en: r[1],
      name_ar: r[2],
      ayah_count: r[4],
      revelation_type: r[5],
    });
  }
  for (const r of valuesAfter(
    tanzilSql,
    "INSERT INTO public.surahs\n  (number, name_en, name_ar, name_fr, transliteration, ayah_count, revelation_type, bismillah_pre, metadata_source_id)\nVALUES",
  )) {
    if (surahs.has(r[0])) problems.push(`surah ${r[0]} defined twice`);
    surahs.set(r[0], {
      number: r[0],
      name_en: r[1],
      name_ar: r[2],
      ayah_count: r[5],
      revelation_type: r[6],
    });
  }

  // Arabic ayahs: 58 bootstrap rows + 6,178 Tanzil rows. The Tanzil migration uses
  // ON CONFLICT DO NOTHING, so a key present in the bootstrap wins.
  const ayahs = new Map();
  for (const r of valuesAfter(
    bootstrapSql,
    "INSERT INTO public.ayahs (surah_number, ayah_number, arabic_text, translation_en, translation_fr) VALUES",
  )) {
    ayahs.set(`${r[0]}:${r[1]}`, { surah_number: r[0], ayah_number: r[1], arabic_text: r[2] });
  }
  for (const r of valuesAfter(
    tanzilSql,
    "INSERT INTO public.ayahs (surah_number, ayah_number, arabic_text, arabic_source_id)\nVALUES",
  )) {
    const key = `${r[0]}:${r[1]}`;
    if (!ayahs.has(key))
      ayahs.set(key, { surah_number: r[0], ayah_number: r[1], arabic_text: r[2] });
  }

  // Pickthall
  const translations = new Map();
  for (const r of valuesAfter(
    pickthallSql,
    "INSERT INTO _pickthall_import (surah_number, ayah_number, text) VALUES",
  )) {
    const key = `${r[0]}:${r[1]}`;
    if (translations.has(key)) problems.push(`Pickthall ${key} defined twice`);
    translations.set(key, { surah_number: r[0], ayah_number: r[1], text: r[2] });
  }

  // Kazimirski: segments and joins from the reviewed manifest, ids by the import's formula.
  const segments = [];
  const mappings = [];
  const ordered = [...manifest.segments].sort(
    (a, b) => a.surah_number - b.surah_number || a.source_ordinal - b.source_ordinal,
  );
  for (const s of ordered) {
    const id = uuid5(
      KAZIMIRSKI_NAMESPACE,
      `segment:${KAZIMIRSKI_EDITION}:${s.surah_number}:${s.source_ordinal}`,
    );
    const hash = sha256(s.text);
    if (hash !== s.text_sha256)
      problems.push(
        `segment ${s.surah_number}:${s.source_ordinal} text hash differs from manifest`,
      );
    segments.push({
      id,
      surah_number: s.surah_number,
      source_ordinal: s.source_ordinal,
      text: s.text,
      text_sha256: s.text_sha256,
    });
    for (const t of s.canonical_targets)
      mappings.push({ segment_id: id, surah_number: t.surah_number, ayah_number: t.ayah_number });
  }
  const aggregate = sha256(ordered.map((s) => s.text).join("\x1e"));
  if (aggregate !== manifest.aggregate_ordered_hash)
    problems.push("manifest aggregate_ordered_hash does not match its own segment texts");

  // structure checks
  for (const s of surahs.values()) {
    for (let n = 1; n <= s.ayah_count; n++) {
      if (!ayahs.has(`${s.number}:${n}`)) problems.push(`missing Arabic ayah ${s.number}:${n}`);
      if (!translations.has(`${s.number}:${n}`))
        problems.push(`missing Pickthall ayah ${s.number}:${n}`);
    }
  }
  for (const a of ayahs.values())
    if (!surahs.has(a.surah_number))
      problems.push(`ayah ${a.surah_number}:${a.ayah_number} has no surah`);
  for (const a of ayahs.values())
    if (!String(a.arabic_text).trim())
      problems.push(`empty Arabic text ${a.surah_number}:${a.ayah_number}`);

  return {
    surahs: [...surahs.values()],
    ayahs: [...ayahs.values()],
    translations: [...translations.values()],
    segments,
    mappings,
    problems,
  };
}

export function writeCore(core, dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = DELETE;
    CREATE TABLE surahs (number INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, ayah_count INTEGER, revelation_type TEXT);
    CREATE TABLE ayahs (surah_number INTEGER, ayah_number INTEGER, arabic_text TEXT NOT NULL, PRIMARY KEY (surah_number, ayah_number));
    CREATE TABLE translations (surah_number INTEGER, ayah_number INTEGER, text TEXT NOT NULL, PRIMARY KEY (surah_number, ayah_number));
    CREATE TABLE translation_segments (id TEXT PRIMARY KEY, surah_number INTEGER, source_ordinal INTEGER, text TEXT NOT NULL, text_sha256 TEXT NOT NULL);
    CREATE TABLE translation_segment_ayahs (segment_id TEXT, surah_number INTEGER, ayah_number INTEGER);
  `);
  const ins = (sql, rows, map) => {
    const st = db.prepare(sql);
    db.exec("BEGIN");
    for (const r of rows) st.run(...map(r));
    db.exec("COMMIT");
  };
  ins("INSERT INTO surahs VALUES (?,?,?,?,?)", core.surahs, (s) => [
    s.number,
    s.name_en,
    s.name_ar,
    s.ayah_count,
    s.revelation_type,
  ]);
  ins("INSERT INTO ayahs VALUES (?,?,?)", core.ayahs, (a) => [
    a.surah_number,
    a.ayah_number,
    a.arabic_text,
  ]);
  ins("INSERT INTO translations VALUES (?,?,?)", core.translations, (t) => [
    t.surah_number,
    t.ayah_number,
    t.text,
  ]);
  ins("INSERT INTO translation_segments VALUES (?,?,?,?,?)", core.segments, (s) => [
    s.id,
    s.surah_number,
    s.source_ordinal,
    s.text,
    s.text_sha256,
  ]);
  ins("INSERT INTO translation_segment_ayahs VALUES (?,?,?)", core.mappings, (m) => [
    m.segment_id,
    m.surah_number,
    m.ayah_number,
  ]);
  const fingerprint = computeFingerprint(db);
  const counts = countRows(db);
  db.close();
  return { fingerprint, counts };
}

/**
 * Pure: compares a rebuilt core's recomputed fingerprint and counts with the pinned
 * expectation. Returns every problem (empty = pass). A structural problem found while
 * building (missing ayah, bad text hash, duplicate) also fails.
 */
export function evaluate({ fingerprint, counts, problems = [] }, expected) {
  const failures = [...problems];
  for (const [k, v] of Object.entries(expected.counts)) {
    if (counts[k] !== v) failures.push(`count ${k}: rebuilt ${counts[k]}, expected ${v}`);
  }
  if (fingerprint !== expected.overall_sha256) {
    failures.push(`content fingerprint ${fingerprint} != pinned ${expected.overall_sha256}`);
  }
  return failures;
}

/** Refuses any --out that could overwrite approved content or pollute the repository. */
export function assertSafeOut(outDir) {
  const abs = path.resolve(outDir);
  const rel = path.relative(REPO_ROOT, abs);
  const insideRepo = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  if (insideRepo) throw new Error(`--out must be outside the repository (got ${abs})`);
  const forbidden = ["quran-content.sqlite", "content-db"];
  if (forbidden.some((f) => abs.includes(f)))
    throw new Error(`--out must not point at approved content (${abs})`);
  return abs;
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  if (outIdx < 0 || !args[outIdx + 1]) {
    console.error("usage: rebuild-content-core.mjs --out <directory outside the repository>");
    process.exit(2);
  }
  const out = assertSafeOut(args[outIdx + 1]);
  const lock = JSON.parse(readFileSync(path.join(HERE, "..", "content-sources.lock.json"), "utf8"));
  const expected = JSON.parse(
    readFileSync(path.join(HERE, "..", "content-db.expected.json"), "utf8"),
  );

  const bootstrapSql = pinnedFile(lock, migrationPath("20260818042151")).toString("utf8");
  const tanzilSql = pinnedFile(lock, migrationPath("20260820160000")).toString("utf8");
  const pickthallSql = pinnedFile(lock, migrationPath("20260820180000")).toString("utf8");
  const manifestBytes = pinnedFile(
    lock,
    "scripts/quran-import/kazimirski/kazimirski_alignment_manifest.json",
  );
  const rawHtml = pinnedFile(lock, "scripts/quran-import/kazimirski/texte_entier_raw.html");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (sha256(rawHtml) !== manifest.source_artifact_sha256)
    throw new Error("raw Wikisource HTML does not match the manifest's source_artifact_sha256");

  const core = buildCore({ bootstrapSql, tanzilSql, pickthallSql, manifest });
  mkdirSync(out, { recursive: true });
  const dbPath = path.join(out, "content-core.sqlite");
  if (existsSync(dbPath)) rmSync(dbPath);
  const { fingerprint, counts } = writeCore(core, dbPath);
  const fileSha = sha256(readFileSync(dbPath));
  const failures = evaluate({ fingerprint, counts, problems: core.problems }, expected);

  const result = {
    ok: failures.length === 0,
    fingerprint,
    expectedFingerprint: expected.overall_sha256,
    counts,
    rebuiltFileSha256: fileSha,
    bytes: statSync(dbPath).size,
    failures: failures.slice(0, 30),
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

/**
 * True when this module is the script Node was started with. Both sides are resolved
 * through symlinks: on macOS /var is a symlink to /private/var, so comparing a logical
 * path with the resolved module path made `main()` silently NOT run, and a verification
 * script exited 0 having verified nothing (found by QR-DESIGN-007E).
 */
function isEntrypoint(moduleUrl) {
  try {
    return (
      Boolean(process.argv[1]) &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl))
    );
  } catch {
    return false;
  }
}

if (isEntrypoint(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`rebuild-content-core: FAILED: ${e.message}`);
    process.exit(1);
  }
}

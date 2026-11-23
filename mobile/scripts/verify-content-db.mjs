#!/usr/bin/env node
/**
 * Quran content-database integrity check (QR-DESIGN-005).
 *
 * Usage: node scripts/verify-content-db.mjs [path] [--file-hash]
 *
 * Checks a bundled quran-content.sqlite against mobile/content-db.expected.json:
 *   1. row counts (114 surahs, 6,236 ayahs, ...),
 *   2. a content fingerprint recomputed from the rows themselves, using the
 *      same canonical formula as scripts/export-content-db.mjs. It covers every
 *      Arabic ayah, every English (Pickthall) translation row, and the Kazimirski
 *      segment hashes and ayah mappings. It ignores generated_at, so a re-export
 *      of identical content still passes. It must equal BOTH the value stored in
 *      the DB and the pinned value in content-db.expected.json,
 *   3. with --file-hash, the SHA-256 of the whole file (the approved artifact).
 *
 * Read-only: opens the file read-only and never writes or touches the network.
 * It does not decide whether a database is *approved*: that is the pinned
 * expected file's job, and changing it is an owner-approved change.
 */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** Same canonical formula as export-content-db.mjs (kept in sync by test). */
export function computeFingerprint(db) {
  const rows = (sql) => db.prepare(sql).all();
  const canonical = [
    ...rows("SELECT surah_number, ayah_number, arabic_text FROM ayahs").map(
      (a) => `ayah:${a.surah_number}:${a.ayah_number}:${a.arabic_text}`,
    ),
    ...rows("SELECT surah_number, ayah_number, text FROM translations").map(
      (t) => `en:${t.surah_number}:${t.ayah_number}:${t.text}`,
    ),
    ...rows("SELECT id, text_sha256 FROM translation_segments").map(
      (s) => `seg:${s.id}:${s.text_sha256}`,
    ),
    ...rows("SELECT segment_id, surah_number, ayah_number FROM translation_segment_ayahs").map(
      (m) => `map:${m.segment_id}:${m.surah_number}:${m.ayah_number}`,
    ),
  ].sort();
  return sha256(canonical.join("\n"));
}

export function countRows(db) {
  const n = (t) => db.prepare(`SELECT count(*) AS c FROM ${t}`).get().c;
  return {
    surahs: n("surahs"),
    ayahs: n("ayahs"),
    pickthall_translations: n("translations"),
    kazimirski_segments: n("translation_segments"),
    kazimirski_mappings: n("translation_segment_ayahs"),
  };
}

/** Pure comparison, unit-tested. Returns a list of human-readable problems. */
export function compare(
  { counts, fingerprint, storedFingerprint, fileSha256 },
  expected,
  checkFile,
) {
  const problems = [];
  for (const [k, v] of Object.entries(expected.counts)) {
    if (counts[k] !== v) problems.push(`count ${k}: found ${counts[k]}, expected ${v}`);
  }
  if (fingerprint !== storedFingerprint)
    problems.push("recomputed content fingerprint differs from the one stored in the database");
  if (fingerprint !== expected.overall_sha256)
    problems.push(`content fingerprint ${fingerprint} != pinned ${expected.overall_sha256}`);
  if (checkFile && fileSha256 !== expected.file_sha256)
    problems.push(`file sha256 ${fileSha256} != pinned ${expected.file_sha256}`);
  return problems;
}

function main() {
  const args = process.argv.slice(2);
  const checkFile = args.includes("--file-hash");
  const file = path.resolve(
    args.find((a) => !a.startsWith("--")) ?? path.join(HERE, "../public/quran-content.sqlite"),
  );
  const expected = JSON.parse(readFileSync(path.join(HERE, "../content-db.expected.json"), "utf8"));
  // The bundled file may be in WAL mode, and even a read-only open then creates
  // -shm/-wal files next to it. Verify a temporary copy so the source file and
  // its directory are never touched.
  const tmp = mkdtempSync(path.join(tmpdir(), "qr-verify-"));
  const copy = path.join(tmp, "content.sqlite");
  copyFileSync(file, copy);
  const db = new DatabaseSync(copy, { readOnly: true });
  const stored = db.prepare("SELECT overall_sha256 FROM content_version").get().overall_sha256;
  const problems = compare(
    {
      counts: countRows(db),
      fingerprint: computeFingerprint(db),
      storedFingerprint: stored,
      fileSha256: sha256(readFileSync(file)),
    },
    expected,
    checkFile,
  );
  db.close();
  rmSync(tmp, { recursive: true, force: true });
  if (problems.length) {
    console.error(`verify-content-db: FAILED for ${file}`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `verify-content-db: OK (${expected.counts.surahs} surahs, ${expected.counts.ayahs} ayahs, fingerprint ${expected.overall_sha256.slice(0, 16)}…${checkFile ? ", file hash matches" : ""})`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

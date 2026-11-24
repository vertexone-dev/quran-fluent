#!/usr/bin/env node
/**
 * Full-content fingerprint of a Quran content database (QR-DESIGN-007E).
 *
 * The existing content fingerprint (verify-content-db.mjs) covers the Arabic text, the
 * Pickthall rows and the Kazimirski segments and mappings. This one covers EVERY content
 * table the app reads (curriculum, translations, vocabulary, sources), so a rebuilt database
 * can be proven equivalent to the approved one without the approved file.
 *
 * Database-generated random ids differ between builds, so they are not hashed. Every
 * `*_id` column is replaced by the parent row's natural key (slug, order, rank, edition or
 * surah:ordinal), which still checks that every child is attached to the right parent. The
 * `content_version` table (timestamps and commit) is excluded by design.
 *
 *   node mobile/scripts/full-rebuild/full-content-fingerprint.mjs <db.sqlite> [--expect <json>]
 *
 * Reads the file read-only, so pass a COPY of the approved database, never the original.
 */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const EXCLUDED_TABLES = new Set(["content_version"]);
const REF = {
  source_id: "sources",
  course_id: "courses",
  level_id: "levels",
  module_id: "modules",
  lesson_id: "lessons",
  section_id: "sections",
  exercise_id: "exercises",
  word_id: "words",
  segment_id: "segments",
};

function resolvers(db) {
  const all = (t) => db.prepare(`SELECT * FROM ${t}`).all();
  const idx = (t, key) => new Map(all(t).map((r) => [r.id, key(r)]));
  const lessons = idx("lessons", (r) => r.slug);
  return {
    sources: idx("content_sources", (r) => r.edition_identifier),
    courses: idx("courses", (r) => r.slug),
    levels: idx("levels", (r) => r.slug),
    modules: idx("modules", (r) => r.slug),
    lessons,
    sections: idx("lesson_sections", (r) => `${lessons.get(r.lesson_id)}#${r.order_index}`),
    exercises: idx("lesson_exercises", (r) => `${lessons.get(r.lesson_id)}#${r.order_index}`),
    words: idx("word_frequency", (r) => `${r.frequency_rank}`),
    segments: idx("translation_segments", (r) => `${r.surah_number}:${r.source_ordinal}`),
  };
}

export function fullContentFingerprint(db) {
  const res = resolvers(db);
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((r) => r.name)
    .filter((t) => !EXCLUDED_TABLES.has(t));
  const perTable = {};
  let rows = 0;
  for (const t of tables) {
    const lines = db
      .prepare(`SELECT * FROM ${t}`)
      .all()
      .map((r) => {
        const o = {};
        for (const [k, v] of Object.entries(r)) {
          if (k === "id") continue;
          if (REF[k]) o[k] = v === null ? null : (res[REF[k]].get(v) ?? "(unresolved)");
          else o[k] = v;
        }
        // Keys sorted so column order never matters.
        return JSON.stringify(
          Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1))),
        );
      })
      .sort();
    rows += lines.length;
    perTable[t] = { rows: lines.length, sha256: sha256(lines.join("\n")) };
  }
  const overall = sha256(
    Object.entries(perTable)
      .map(([t, v]) => `${t}:${v.rows}:${v.sha256}`)
      .join("\n"),
  );
  return { overall, perTable, tables: tables.length, rows };
}

function main() {
  const args = process.argv.slice(2);
  const expectIdx = args.indexOf("--expect");
  const expectFile = expectIdx >= 0 ? args[expectIdx + 1] : undefined;
  const file = args.find((a, i) => !a.startsWith("--") && (expectIdx < 0 || i !== expectIdx + 1));
  if (!file || (expectIdx >= 0 && !expectFile)) {
    console.error("usage: full-content-fingerprint.mjs <db.sqlite> [--expect <expected.json>]");
    process.exit(2);
  }
  const dir = mkdtempSync(path.join(os.tmpdir(), "qr-full-fp-"));
  try {
    const copy = path.join(dir, "db.sqlite");
    copyFileSync(file, copy); // never open the original: WAL files could appear beside it
    const db = new DatabaseSync(copy, { readOnly: true });
    const fp = fullContentFingerprint(db);
    db.close();
    console.log(
      JSON.stringify(
        {
          full_content_sha256: fp.overall,
          tables: fp.tables,
          rows: fp.rows,
          per_table: fp.perTable,
        },
        null,
        2,
      ),
    );
    if (expectFile) {
      const expected = JSON.parse(readFileSync(expectFile, "utf8"));
      const problems = [];
      if (fp.overall !== expected.full_content_sha256)
        problems.push(
          `full content fingerprint ${fp.overall} != pinned ${expected.full_content_sha256}`,
        );
      for (const [t, v] of Object.entries(expected.per_table ?? {})) {
        if (fp.perTable[t]?.sha256 !== v.sha256)
          problems.push(
            `table ${t} differs (rows ${fp.perTable[t]?.rows ?? "missing"} vs ${v.rows})`,
          );
      }
      for (const t of Object.keys(fp.perTable))
        if (!(expected.per_table ?? {})[t]) problems.push(`unexpected table ${t}`);
      if (problems.length) {
        console.error(`full-content-fingerprint: FAILED\n  - ${problems.join("\n  - ")}`);
        process.exit(1);
      }
      console.error(
        `full-content-fingerprint: OK (${fp.tables} tables, ${fp.rows} rows match the pinned values)`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

if (isEntrypoint(import.meta.url)) main();

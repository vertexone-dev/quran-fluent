#!/usr/bin/env node
/**
 * Phase 0 feasibility export: builds a single, versioned, read-only SQLite
 * file containing the certified Qur'an content (canonical Arabic, the
 * verified Pickthall English translation, the approved Kazimirski French
 * segment model) plus the content_sources rows each depends on for
 * attribution, and the lessons/lesson_exercises reference content.
 *
 * READ-ONLY against production: every request uses the publishable
 * (anon) key only -- the same key this app already ships in its own
 * client bundle, never the service-role key. No row is written, updated,
 * or deleted anywhere. User tables (progress, bookmarks, notes, accounts,
 * etc.) are never queried.
 *
 * Source selection mirrors this app's own production resolvers exactly
 * (src/lib/translations.ts resolveVerifiedEnglishSource, src/lib/
 * kazimirski.ts resolveApprovedFrenchSource) rather than re-deriving new
 * filter criteria -- the goal is to export exactly what the live app
 * already serves, not a new interpretation of the data.
 *
 * Usage: node mobile/scripts/export-content-db.mjs
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the
 * repository's .env (production values) -- loaded explicitly from .env
 * only, never .env.local, so this always targets production on purpose,
 * never by accident of whatever the web dev server happens to be pointed
 * at. Refuses to run if the resolved URL looks like a local Supabase
 * stack (the opposite safety direction of every other local-only guard
 * elsewhere in this repo's CI).
 */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(__dirname, "../content-db");

function loadDotEnvProduction() {
  const envPath = path.join(REPO_ROOT, ".env");
  const text = readFileSync(envPath, "utf8");
  const vars = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[m[1]] = value;
  }
  return vars;
}

const env = loadDotEnvProduction();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env -- refusing to run.",
  );
  process.exit(1);
}
if (SUPABASE_URL.includes("127.0.0.1") || SUPABASE_URL.includes("localhost")) {
  console.error(
    "VITE_SUPABASE_URL resolves to a local stack -- this export is meant to run " +
      "against production's real, certified content. Point .env's VITE_SUPABASE_URL " +
      "at the production project before running this script.",
  );
  process.exit(1);
}
// Never log the key itself, only that it is present and its public-safe
// prefix shape (sb_publishable_... keys are explicitly designed to be
// exposed -- this app already ships this exact value in its client
// bundle -- but the value is still never echoed here, as a matter of
// discipline, not necessity).
console.log(`Exporting from ${SUPABASE_URL} (publishable key present: ${Boolean(SUPABASE_KEY)})`);

async function fetchAll(table, { select = "*", filter = "", orderBy = "" } = {}) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams();
    params.set("select", select);
    if (orderBy) params.set("order", orderBy);
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}${filter ? `&${filter}` : ""}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${offset}-${offset + pageSize - 1}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok) {
      throw new Error(`${table} fetch failed: ${res.status} ${res.statusText}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function main() {
  console.log("Fetching surahs...");
  const surahs = await fetchAll("surahs", { orderBy: "number" });

  console.log("Fetching ayahs (canonical Arabic)...");
  const ayahs = await fetchAll("ayahs", { orderBy: "surah_number,ayah_number" });

  console.log("Fetching content_sources...");
  const contentSources = await fetchAll("content_sources");

  const englishSource = contentSources.find(
    (s) =>
      s.content_type === "translation" &&
      s.language === "en" &&
      s.translator === "Marmaduke Pickthall" &&
      s.edition_identifier === "pickthall-gutenberg-16955" &&
      s.verification_status === "verified",
  );
  const frenchSource = contentSources.find(
    (s) =>
      s.content_type === "translation" &&
      s.language === "fr" &&
      s.translator === "Albin de Kazimirski Biberstein" &&
      s.edition_identifier === "kazimirski-1869-segments-v1" &&
      s.verification_status !== "disputed",
  );

  if (!englishSource) {
    throw new Error(
      "Could not resolve the verified Pickthall English source via the exact criteria " +
        "src/lib/translations.ts's resolveVerifiedEnglishSource uses -- refusing to export " +
        "unverified/guessed English content.",
    );
  }
  if (!frenchSource) {
    throw new Error(
      "Could not resolve the approved Kazimirski French source via the exact criteria " +
        "src/lib/kazimirski.ts's resolveApprovedFrenchSource uses -- refusing to export.",
    );
  }
  console.log(`Resolved English source: ${englishSource.id} (${englishSource.edition_identifier})`);
  console.log(`Resolved French source:  ${frenchSource.id} (${frenchSource.edition_identifier})`);

  console.log("Fetching Pickthall translations...");
  const translations = await fetchAll("translations", {
    filter: `source_id=eq.${englishSource.id}`,
    orderBy: "surah_number,ayah_number",
  });

  console.log("Fetching Kazimirski segments...");
  const segments = await fetchAll("translation_segments", {
    filter: `source_id=eq.${frenchSource.id}`,
    orderBy: "surah_number,source_ordinal",
  });

  console.log("Fetching Kazimirski segment-to-ayah mappings...");
  const segmentIds = new Set(segments.map((s) => s.id));
  const allMappings = await fetchAll("translation_segment_ayahs", {
    orderBy: "surah_number,ayah_number",
  });
  const mappings = allMappings.filter((m) => segmentIds.has(m.segment_id));

  console.log("Fetching lessons and lesson_exercises (curriculum reference content)...");
  const lessons = await fetchAll("lessons");
  const lessonExercises = await fetchAll("lesson_exercises");

  // --- Integrity checks -----------------------------------------------
  console.log("Verifying per-segment text_sha256 (stored vs. recomputed)...");
  let shaMismatches = 0;
  for (const seg of segments) {
    if (sha256(seg.text) !== seg.text_sha256) {
      shaMismatches += 1;
      console.error(`  MISMATCH: segment ${seg.id} (surah ${seg.surah_number})`);
    }
  }
  if (shaMismatches > 0) {
    throw new Error(
      `${shaMismatches} segment(s) failed their own stored text_sha256 check -- aborting export.`,
    );
  }
  console.log(`  OK: all ${segments.length} segments match their stored text_sha256.`);

  const ayahCount = ayahs.length;
  const surahCount = surahs.length;
  const translationCount = translations.length;
  const segmentCount = segments.length;
  const mappingCount = mappings.length;

  console.log(
    `Counts: ${surahCount} surahs, ${ayahCount} ayahs, ${translationCount} Pickthall rows, ` +
      `${segmentCount} Kazimirski segments, ${mappingCount} segment-ayah mappings, ` +
      `${lessons.length} lessons, ${lessonExercises.length} lesson_exercises.`,
  );

  // --- Build SQLite file ------------------------------------------------
  mkdirSync(OUT_DIR, { recursive: true });
  const dbPath = path.join(OUT_DIR, "quran-content.sqlite");
  if (existsSync(dbPath)) writeFileSync(dbPath, Buffer.alloc(0)); // truncate; DatabaseSync below recreates schema fresh
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE content_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      source_commit TEXT NOT NULL,
      overall_sha256 TEXT NOT NULL
    );

    CREATE TABLE content_sources (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      dataset_name TEXT NOT NULL,
      edition_identifier TEXT,
      language TEXT NOT NULL,
      translator TEXT,
      version TEXT,
      license_name TEXT NOT NULL,
      license_url TEXT,
      attribution_required INTEGER NOT NULL,
      modification_restricted INTEGER NOT NULL,
      source_url TEXT NOT NULL,
      verification_status TEXT NOT NULL
    );

    CREATE TABLE surahs (
      number INTEGER PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      name_fr TEXT,
      ayah_count INTEGER NOT NULL,
      revelation_type TEXT NOT NULL,
      bismillah_pre INTEGER NOT NULL
    );

    CREATE TABLE ayahs (
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      arabic_text TEXT NOT NULL,
      PRIMARY KEY (surah_number, ayah_number)
    );

    CREATE TABLE translations (
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      text TEXT NOT NULL,
      source_id TEXT NOT NULL,
      PRIMARY KEY (surah_number, ayah_number, source_id)
    );

    CREATE TABLE translation_segments (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      surah_number INTEGER NOT NULL,
      source_ordinal INTEGER NOT NULL,
      text TEXT NOT NULL,
      text_sha256 TEXT NOT NULL,
      alignment_type TEXT NOT NULL
    );

    CREATE TABLE translation_segment_ayahs (
      id TEXT PRIMARY KEY,
      segment_id TEXT NOT NULL,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      mapping_confidence TEXT NOT NULL
    );

    CREATE TABLE lessons (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE lesson_exercises (
      id TEXT PRIMARY KEY,
      lesson_id TEXT,
      data_json TEXT NOT NULL
    );

    CREATE INDEX idx_translations_surah ON translations(surah_number);
    CREATE INDEX idx_segments_surah ON translation_segments(surah_number);
    CREATE INDEX idx_mappings_ayah ON translation_segment_ayahs(surah_number, ayah_number);
  `);

  const insertSource = db.prepare(
    `INSERT INTO content_sources VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const s of contentSources) {
    insertSource.run(
      s.id,
      s.content_type,
      s.provider_name,
      s.dataset_name,
      s.edition_identifier,
      s.language,
      s.translator,
      s.version,
      s.license_name,
      s.license_url,
      s.attribution_required ? 1 : 0,
      s.modification_restricted ? 1 : 0,
      s.source_url,
      s.verification_status,
    );
  }

  const insertSurah = db.prepare(`INSERT INTO surahs VALUES (?,?,?,?,?,?,?)`);
  for (const s of surahs) {
    insertSurah.run(
      s.number,
      s.name_en,
      s.name_ar,
      s.name_fr,
      s.ayah_count,
      s.revelation_type,
      s.bismillah_pre ? 1 : 0,
    );
  }

  const insertAyah = db.prepare(`INSERT INTO ayahs VALUES (?,?,?)`);
  for (const a of ayahs) {
    insertAyah.run(a.surah_number, a.ayah_number, a.arabic_text);
  }

  const insertTranslation = db.prepare(`INSERT INTO translations VALUES (?,?,?,?)`);
  for (const t of translations) {
    insertTranslation.run(t.surah_number, t.ayah_number, t.text, t.source_id);
  }

  const insertSegment = db.prepare(`INSERT INTO translation_segments VALUES (?,?,?,?,?,?,?)`);
  for (const seg of segments) {
    insertSegment.run(
      seg.id,
      seg.source_id,
      seg.surah_number,
      seg.source_ordinal,
      seg.text,
      seg.text_sha256,
      seg.alignment_type,
    );
  }

  const insertMapping = db.prepare(`INSERT INTO translation_segment_ayahs VALUES (?,?,?,?,?)`);
  for (const m of mappings) {
    insertMapping.run(m.id, m.segment_id, m.surah_number, m.ayah_number, m.mapping_confidence);
  }

  const insertLesson = db.prepare(`INSERT INTO lessons VALUES (?,?)`);
  for (const l of lessons) {
    insertLesson.run(l.id, JSON.stringify(l));
  }
  const insertExercise = db.prepare(`INSERT INTO lesson_exercises VALUES (?,?,?)`);
  for (const e of lessonExercises) {
    insertExercise.run(e.id, e.lesson_id ?? null, JSON.stringify(e));
  }

  // Deterministic overall hash: sha256 over a sorted, canonical
  // concatenation of every exported row's own stable identity, so the
  // same production state always produces the same hash regardless of
  // fetch order.
  const canonical = [
    ...ayahs.map((a) => `ayah:${a.surah_number}:${a.ayah_number}:${a.arabic_text}`),
    ...translations.map((t) => `en:${t.surah_number}:${t.ayah_number}:${t.text}`),
    ...segments.map((s) => `seg:${s.id}:${s.text_sha256}`),
    ...mappings.map((m) => `map:${m.segment_id}:${m.surah_number}:${m.ayah_number}`),
  ].sort();
  const overallHash = sha256(canonical.join("\n"));

  let sourceCommit = "unknown";
  try {
    sourceCommit = execSync("git rev-parse HEAD", { cwd: REPO_ROOT }).toString().trim();
  } catch {
    // Not fatal -- the hash and row counts are the real integrity signal.
  }

  const generatedAt = new Date().toISOString();
  db.prepare(`INSERT INTO content_version VALUES (1,?,?,?,?)`).run(
    "0.1.0-feasibility",
    generatedAt,
    sourceCommit,
    overallHash,
  );

  db.close();

  const manifest = {
    version: "0.1.0-feasibility",
    generated_at: generatedAt,
    source_commit: sourceCommit,
    overall_sha256: overallHash,
    counts: {
      surahs: surahCount,
      ayahs: ayahCount,
      pickthall_translations: translationCount,
      kazimirski_segments: segmentCount,
      kazimirski_mappings: mappingCount,
      lessons: lessons.length,
      lesson_exercises: lessonExercises.length,
    },
    expected_counts_from_prior_audit: {
      ayahs: 6236,
      kazimirski_segments: 6239,
      kazimirski_mappings: 6396,
    },
    sources: {
      english: {
        id: englishSource.id,
        translator: englishSource.translator,
        edition_identifier: englishSource.edition_identifier,
        license_name: englishSource.license_name,
        license_url: englishSource.license_url,
        attribution_required: englishSource.attribution_required,
        verification_status: englishSource.verification_status,
      },
      french: {
        id: frenchSource.id,
        translator: frenchSource.translator,
        edition_identifier: frenchSource.edition_identifier,
        license_name: frenchSource.license_name,
        license_url: frenchSource.license_url,
        attribution_required: frenchSource.attribution_required,
        verification_status: frenchSource.verification_status,
      },
    },
    integrity: {
      segment_text_sha256_mismatches: shaMismatches,
    },
  };
  writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("\nDone.");
  console.log(`SQLite file: ${dbPath}`);
  console.log(`Manifest:    ${path.join(OUT_DIR, "manifest.json")}`);
  console.log(`Overall content hash: ${overallHash}`);

  const countsMatch = ayahCount === 6236 && segmentCount === 6239 && mappingCount === 6396;
  if (!countsMatch) {
    console.warn(
      "\nWARNING: exported counts do not match the prior audit's known-good production " +
        "counts (6236 ayahs / 6239 segments / 6396 mappings). This does not necessarily mean " +
        "something is wrong -- production content can legitimately change -- but it must be " +
        "explained before this export is trusted for anything beyond this feasibility spike.",
    );
  } else {
    console.log("Counts match the prior audit's known-good production counts exactly.");
  }
}

main().catch((err) => {
  console.error("Export failed:", err.message);
  process.exit(1);
});

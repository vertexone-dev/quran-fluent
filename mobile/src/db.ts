/**
 * Loads the bundled, read-only content database entirely from local
 * assets (sql-wasm.wasm, quran-content.sqlite) shipped inside the app --
 * no network request of any kind. sql.js (WASM SQLite running inside the
 * WebView's own JS context) is used here specifically because it needs no
 * native plugin wiring, which keeps this Phase 0 feasibility spike simple
 * to stand up on both platforms from one shared codebase. A real Phase 1+
 * implementation should evaluate @capacitor-community/sqlite instead --
 * real native file-backed SQLite access, rather than loading the whole
 * database into WASM heap memory, matters once this grows past a single
 * read-only content file (see the audit's roadmap, Phase 2 onward).
 */
import initSqlJs, { type Database } from "sql.js";

let dbPromise: Promise<Database> | null = null;

export function loadContentDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // sql.js's own default WASM loader tries WebAssembly.instantiateStreaming
      // against a fetch() of the locateFile()'d URL -- that path reliably fails
      // inside a Capacitor WKWebView (root-caused on a real iOS Simulator run:
      // a plain fetch("/sql-wasm.wasm") succeeds fully, 200/application/wasm,
      // full byte count -- so this is not an asset-serving problem -- but
      // instantiateStreaming's own stricter Response-object requirements
      // aren't satisfied by WKWebView's custom URL scheme handler response,
      // and sql.js's own ArrayBuffer fallback path also goes through the
      // same streaming-first code path and fails the same way). Fetching the
      // bytes ourselves with a plain fetch + arrayBuffer() (proven to work)
      // and handing them to sql.js as `wasmBinary` skips instantiateStreaming
      // entirely.
      const wasmRes = await fetch("/sql-wasm.wasm");
      if (!wasmRes.ok) {
        throw new Error(`Could not load bundled sql.js WASM (status ${wasmRes.status})`);
      }
      const wasmBinary = await wasmRes.arrayBuffer();

      const SQL = await initSqlJs({ wasmBinary });
      const res = await fetch("/quran-content.sqlite");
      if (!res.ok) {
        throw new Error(`Could not load bundled content database (status ${res.status})`);
      }
      const buf = await res.arrayBuffer();
      return new SQL.Database(new Uint8Array(buf));
    })();
  }
  return dbPromise;
}

export type Surah = {
  number: number;
  name_en: string;
  name_ar: string;
  name_fr: string | null;
  ayah_count: number;
};

export type ContentVersion = {
  version: string;
  generated_at: string;
  source_commit: string;
  overall_sha256: string;
};

function rowsToObjects<T>(columns: string[], values: unknown[][]): T[] {
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => (obj[col] = row[i]));
    return obj as T;
  });
}

export function getContentVersion(db: Database): ContentVersion {
  const result = db.exec(
    "SELECT version, generated_at, source_commit, overall_sha256 FROM content_version WHERE id = 1",
  );
  const [row] = rowsToObjects<ContentVersion>(result[0].columns, result[0].values);
  return row;
}

export function listSurahs(db: Database): Surah[] {
  const result = db.exec(
    "SELECT number, name_en, name_ar, name_fr, ayah_count FROM surahs ORDER BY number",
  );
  if (result.length === 0) return [];
  return rowsToObjects<Surah>(result[0].columns, result[0].values);
}

export type AyahRow = {
  ayah_number: number;
  arabic_text: string;
  english: string | null;
};

export function getAyahsWithEnglish(db: Database, surahNumber: number): AyahRow[] {
  const result = db.exec(
    `SELECT a.ayah_number, a.arabic_text, t.text as english
     FROM ayahs a
     LEFT JOIN translations t ON t.surah_number = a.surah_number AND t.ayah_number = a.ayah_number
     WHERE a.surah_number = ${surahNumber}
     ORDER BY a.ayah_number`,
  );
  if (result.length === 0) return [];
  return rowsToObjects<AyahRow>(result[0].columns, result[0].values);
}

export type KazimirskiJoinRaw = {
  ayah_number: number;
  seg_id: string;
  source_ordinal: number;
  seg_text: string;
  alignment_type: string;
};

export function getKazimirskiJoinRows(db: Database, surahNumber: number): KazimirskiJoinRaw[] {
  const result = db.exec(
    `SELECT sa.ayah_number, s.id as seg_id, s.source_ordinal, s.text as seg_text, s.alignment_type
     FROM translation_segment_ayahs sa
     JOIN translation_segments s ON s.id = sa.segment_id
     WHERE sa.surah_number = ${surahNumber}
     ORDER BY sa.ayah_number, s.source_ordinal`,
  );
  if (result.length === 0) return [];
  return rowsToObjects<KazimirskiJoinRaw>(result[0].columns, result[0].values);
}

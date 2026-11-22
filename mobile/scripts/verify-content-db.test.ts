import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { compare, computeFingerprint, countRows } from "./verify-content-db.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "verify-content-db.mjs");
const REAL_DB = path.join(HERE, "../public/quran-content.sqlite");

function tinyDb(arabic = "بِسْمِ") {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE surahs (number INTEGER);
    CREATE TABLE ayahs (surah_number INTEGER, ayah_number INTEGER, arabic_text TEXT);
    CREATE TABLE translations (surah_number INTEGER, ayah_number INTEGER, text TEXT);
    CREATE TABLE translation_segments (id TEXT, text_sha256 TEXT);
    CREATE TABLE translation_segment_ayahs (segment_id TEXT, surah_number INTEGER, ayah_number INTEGER);
    INSERT INTO surahs VALUES (1);
    INSERT INTO ayahs VALUES (1,1,'${arabic}'), (1,2,'ٱلْحَمْدُ');
    INSERT INTO translations VALUES (1,1,'In the name of Allah'), (1,2,'Praise be to Allah');
    INSERT INTO translation_segments VALUES ('s1','abc');
    INSERT INTO translation_segment_ayahs VALUES ('s1',1,1);
  `);
  return db;
}

const expectedFor = (db: DatabaseSync) => ({
  file_sha256: "f",
  overall_sha256: computeFingerprint(db),
  counts: countRows(db),
});
const state = (db: DatabaseSync, over: Record<string, unknown> = {}) => ({
  counts: countRows(db),
  fingerprint: computeFingerprint(db),
  storedFingerprint: computeFingerprint(db),
  fileSha256: "f",
  ...over,
});

describe("verify-content-db", () => {
  it("fingerprint is stable and changes when any Quran/translation text changes", () => {
    const a = computeFingerprint(tinyDb());
    expect(computeFingerprint(tinyDb())).toBe(a);
    expect(computeFingerprint(tinyDb("بِسْمِ."))).not.toBe(a);
    const b = tinyDb();
    b.exec("UPDATE translations SET text = 'In the name of Alla' WHERE ayah_number = 1");
    expect(computeFingerprint(b)).not.toBe(a);
  });

  it("fingerprint does not depend on row insertion order", () => {
    const a = tinyDb();
    const b = new DatabaseSync(":memory:");
    b.exec(`
      CREATE TABLE ayahs (surah_number INTEGER, ayah_number INTEGER, arabic_text TEXT);
      CREATE TABLE translations (surah_number INTEGER, ayah_number INTEGER, text TEXT);
      CREATE TABLE translation_segments (id TEXT, text_sha256 TEXT);
      CREATE TABLE translation_segment_ayahs (segment_id TEXT, surah_number INTEGER, ayah_number INTEGER);
      INSERT INTO ayahs VALUES (1,2,'ٱلْحَمْدُ'), (1,1,'بِسْمِ');
      INSERT INTO translations VALUES (1,2,'Praise be to Allah'), (1,1,'In the name of Allah');
      INSERT INTO translation_segments VALUES ('s1','abc');
      INSERT INTO translation_segment_ayahs VALUES ('s1',1,1);
    `);
    expect(computeFingerprint(b)).toBe(computeFingerprint(a));
  });

  it("compare() accepts a matching database and reports every kind of mismatch", () => {
    const db = tinyDb();
    const exp = expectedFor(db);
    expect(compare(state(db), exp, true)).toEqual([]);
    expect(compare(state(db, { counts: { ...countRows(db), ayahs: 6235 } }), exp, false)).toEqual([
      expect.stringContaining("count ayahs"),
    ]);
    expect(compare(state(db, { storedFingerprint: "x" }), exp, false)).toEqual([
      expect.stringContaining("stored in the database"),
    ]);
    expect(compare(state(db, { fingerprint: "y", storedFingerprint: "y" }), exp, false)).toEqual([
      expect.stringContaining("pinned"),
    ]);
    expect(compare(state(db, { fileSha256: "z" }), exp, true)).toEqual([
      expect.stringContaining("file sha256"),
    ]);
    expect(compare(state(db, { fileSha256: "z" }), exp, false)).toEqual([]);
  });

  describe.skipIf(!existsSync(REAL_DB))("against the real bundled database", () => {
    const tmp: string[] = [];
    afterEach(() => tmp.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

    it("passes for the approved artifact, including its file hash", () => {
      const r = spawnSync(process.execPath, [SCRIPT, REAL_DB, "--file-hash"], { encoding: "utf8" });
      expect(r.status, r.stderr).toBe(0);
    });

    it("fails when one Arabic character is altered", () => {
      const dir = mkdtempSync(path.join(tmpdir(), "qr-db-"));
      tmp.push(dir);
      const copy = path.join(dir, "q.sqlite");
      copyFileSync(REAL_DB, copy);
      const db = new DatabaseSync(copy);
      db.exec(
        "UPDATE ayahs SET arabic_text = arabic_text || 'ا' WHERE surah_number = 1 AND ayah_number = 1",
      );
      db.close();
      const r = spawnSync(process.execPath, [SCRIPT, copy], { encoding: "utf8" });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("fingerprint");
    });
  });
});

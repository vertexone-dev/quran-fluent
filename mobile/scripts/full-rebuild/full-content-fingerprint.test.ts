import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { fullContentFingerprint } from "./full-content-fingerprint.mjs";

/**
 * QR-DESIGN-007E. Small in-memory fixtures: the fingerprint must ignore database-generated
 * ids but notice any change to content or to which parent a child belongs to.
 */
function fixture(
  ids: { course: string; lesson1: string; lesson2: string; section: string },
  over: { title?: string; section_lesson?: "l1" | "l2"; extra?: boolean } = {},
) {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE content_sources (id TEXT PRIMARY KEY, edition_identifier TEXT, status TEXT);
    CREATE TABLE courses (id TEXT PRIMARY KEY, slug TEXT, title TEXT);
    CREATE TABLE levels (id TEXT PRIMARY KEY, course_id TEXT, slug TEXT);
    CREATE TABLE modules (id TEXT PRIMARY KEY, level_id TEXT, slug TEXT);
    CREATE TABLE lessons (id TEXT PRIMARY KEY, module_id TEXT, slug TEXT, title TEXT);
    CREATE TABLE lesson_sections (id TEXT PRIMARY KEY, lesson_id TEXT, order_index INTEGER, body TEXT);
    CREATE TABLE lesson_exercises (id TEXT PRIMARY KEY, lesson_id TEXT, section_id TEXT, order_index INTEGER);
    CREATE TABLE word_frequency (id TEXT PRIMARY KEY, frequency_rank INTEGER, word TEXT);
    CREATE TABLE translation_segments (id TEXT PRIMARY KEY, source_id TEXT, surah_number INTEGER, source_ordinal INTEGER, text TEXT);
    CREATE TABLE content_version (id INTEGER PRIMARY KEY, generated_at TEXT);
  `);
  db.prepare("INSERT INTO content_sources VALUES (?,?,?)").run(
    "src-" + ids.course,
    "uthmani",
    "candidate",
  );
  db.prepare("INSERT INTO courses VALUES (?,?,?)").run(ids.course, "arabic", "Arabic");
  db.prepare("INSERT INTO levels VALUES (?,?,?)").run("lv-" + ids.course, ids.course, "l1");
  db.prepare("INSERT INTO modules VALUES (?,?,?)").run("m-" + ids.course, "lv-" + ids.course, "m1");
  db.prepare("INSERT INTO lessons VALUES (?,?,?,?)").run(
    ids.lesson1,
    "m-" + ids.course,
    "alif",
    over.title ?? "Alif",
  );
  db.prepare("INSERT INTO lessons VALUES (?,?,?,?)").run(
    ids.lesson2,
    "m-" + ids.course,
    "ba",
    "Ba",
  );
  const parent = over.section_lesson === "l2" ? ids.lesson2 : ids.lesson1;
  db.prepare("INSERT INTO lesson_sections VALUES (?,?,?,?)").run(ids.section, parent, 1, "body");
  db.prepare("INSERT INTO content_version VALUES (1, ?)").run(Math.random().toString());
  if (over.extra) db.prepare("INSERT INTO word_frequency VALUES ('w',1,'x')").run();
  return db;
}

const A = { course: "a1", lesson1: "a2", lesson2: "a3", section: "a4" };
const B = { course: "zz-9", lesson1: "yy-8", lesson2: "xx-7", section: "ww-6" };

describe("fullContentFingerprint", () => {
  it("ignores database-generated ids and the content_version table", () => {
    expect(fullContentFingerprint(fixture(A)).overall).toBe(
      fullContentFingerprint(fixture(B)).overall,
    );
  });
  it("is stable across calls", () => {
    const db = fixture(A);
    expect(fullContentFingerprint(db).overall).toBe(fullContentFingerprint(db).overall);
  });
  it("notices a changed title", () => {
    expect(fullContentFingerprint(fixture(A, { title: "Alif!" })).overall).not.toBe(
      fullContentFingerprint(fixture(A)).overall,
    );
  });
  it("notices a child attached to a different parent", () => {
    expect(fullContentFingerprint(fixture(A, { section_lesson: "l2" })).overall).not.toBe(
      fullContentFingerprint(fixture(A)).overall,
    );
  });
  it("notices an extra row", () => {
    expect(fullContentFingerprint(fixture(A, { extra: true })).overall).not.toBe(
      fullContentFingerprint(fixture(A)).overall,
    );
  });
  it("reports every table except content_version", () => {
    const fp = fullContentFingerprint(fixture(A));
    expect(Object.keys(fp.perTable)).not.toContain("content_version");
    expect(Object.keys(fp.perTable)).toContain("lesson_sections");
  });
});

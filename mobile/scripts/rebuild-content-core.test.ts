import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  KAZIMIRSKI_EDITION,
  KAZIMIRSKI_NAMESPACE,
  assertSafeOut,
  buildCore,
  evaluate,
  migrationPath,
  parseValues,
  uuid5,
  valuesAfter,
  writeCore,
} from "./rebuild-content-core.mjs";

/**
 * QR-DESIGN-007D. These tests need NO database, NO secrets and NO network: they rebuild
 * the Quran content core from files committed to the repository. They are not
 * database-gated, so (unlike the bundled-database tests) they cannot be skipped for want
 * of a file: a missing or altered input is a failure.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const expected = JSON.parse(
  readFileSync(path.join(__dirname, "../content-db.expected.json"), "utf8"),
);
const lock = JSON.parse(readFileSync(path.join(__dirname, "../content-sources.lock.json"), "utf8"));
const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

function inputs() {
  return {
    bootstrapSql: read(migrationPath("20260818042151")),
    tanzilSql: read(migrationPath("20260820160000")),
    pickthallSql: read(migrationPath("20260820180000")),
    manifest: JSON.parse(
      read("scripts/quran-import/kazimirski/kazimirski_alignment_manifest.json"),
    ),
  };
}

function fingerprintOf(core: ReturnType<typeof buildCore>) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "qr-core-"));
  try {
    const out = writeCore(core, path.join(dir, "core.sqlite"));
    return out;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("rebuild from repository-committed inputs", () => {
  it("every pinned input still has its pinned SHA-256", () => {
    for (const [rel, pin] of Object.entries(lock.inputs as Record<string, { sha256: string }>)) {
      expect(sha256(readFileSync(path.join(ROOT, rel)))).toBe(pin.sha256);
    }
  });

  it("the raw Wikisource page matches the manifest's source hash", () => {
    const manifest = inputs().manifest;
    const html = readFileSync(
      path.join(ROOT, "scripts/quran-import/kazimirski/texte_entier_raw.html"),
    );
    expect(sha256(html)).toBe(manifest.source_artifact_sha256);
  });

  it("rebuilds exactly the approved content: counts and fingerprint", () => {
    const core = buildCore(inputs());
    expect(core.problems).toEqual([]);
    const { fingerprint, counts } = fingerprintOf(core);
    expect(counts).toEqual(expected.counts);
    expect(fingerprint).toBe(expected.overall_sha256);
    expect(evaluate({ fingerprint, counts, problems: core.problems }, expected)).toEqual([]);
  });

  it("uuid5 matches Python's uuid.uuid5 used by the original import", () => {
    // Value computed with Python 3: uuid.uuid5(NAMESPACE, "segment:kazimirski-1869-segments-v1:1:0")
    expect(uuid5(KAZIMIRSKI_NAMESPACE, `segment:${KAZIMIRSKI_EDITION}:1:0`)).toBe(
      "67cd6bcf-a1a8-525c-b5e9-213122e09b14",
    );
  });
});

describe("fails closed on missing or altered data", () => {
  it("one changed Arabic letter changes the fingerprint and fails", () => {
    const i = inputs();
    // Locate Al-Ikhlas 112:1 by key (never by typed Arabic) and append one tatweel to it.
    const row = /\(112, 1, '([^']*)'/.exec(i.bootstrapSql);
    expect(row, "112:1 not found in the bootstrap migration").not.toBeNull();
    const tampered = i.bootstrapSql.replace(row![0], `${row![0].slice(0, -1)}\u0640'`);
    expect(tampered).not.toBe(i.bootstrapSql);
    const core = buildCore({ ...i, bootstrapSql: tampered as string });
    const { fingerprint, counts } = fingerprintOf(core);
    const failures = evaluate({ fingerprint, counts, problems: core.problems }, expected);
    expect(failures.some((f) => f.includes("content fingerprint"))).toBe(true);
  });

  it("one changed Pickthall word fails", () => {
    const i = inputs();
    const tampered = i.pickthallSql.replace(
      "In the name of Allah, the Beneficent, the Merciful.",
      "In the name of Allah, the Merciful.",
    );
    const core = buildCore({ ...i, pickthallSql: tampered });
    const { fingerprint, counts } = fingerprintOf(core);
    expect(
      evaluate({ fingerprint, counts, problems: core.problems }, expected).length,
    ).toBeGreaterThan(0);
  });

  it("a changed Kazimirski segment text fails (its hash no longer matches the manifest)", () => {
    const i = inputs();
    const manifest = structuredClone(i.manifest);
    manifest.segments[10].text += " .";
    const core = buildCore({ ...i, manifest });
    expect(core.problems.some((p: string) => p.includes("text hash differs"))).toBe(true);
    expect(core.problems.some((p: string) => p.includes("aggregate_ordered_hash"))).toBe(true);
  });

  it("a dropped mapping fails the count and the fingerprint", () => {
    const i = inputs();
    const manifest = structuredClone(i.manifest);
    manifest.segments[100].canonical_targets = [];
    const core = buildCore({ ...i, manifest });
    const { fingerprint, counts } = fingerprintOf(core);
    const failures = evaluate({ fingerprint, counts, problems: core.problems }, expected);
    expect(failures.some((f) => f.includes("kazimirski_mappings"))).toBe(true);
    expect(failures.some((f) => f.includes("fingerprint"))).toBe(true);
  });

  it("a missing ayah is reported", () => {
    const i = inputs();
    const tampered = i.tanzilSql.replace(/\n\(2, 255, '[^\n]*\),?\n/, "\n");
    expect(tampered).not.toBe(i.tanzilSql);
    const core = buildCore({ ...i, tanzilSql: tampered });
    expect(core.problems.some((p: string) => p.includes("missing Arabic ayah 2:255"))).toBe(true);
  });

  it("a wrong pinned fingerprint fails", () => {
    const core = buildCore(inputs());
    const { fingerprint, counts } = fingerprintOf(core);
    const failures = evaluate(
      { fingerprint, counts },
      { ...expected, overall_sha256: "0".repeat(64) },
    );
    expect(failures).toEqual([expect.stringContaining("content fingerprint")]);
  });
});

describe("safety", () => {
  it("refuses an output directory inside the repository or at approved content", () => {
    expect(() => assertSafeOut(path.join(ROOT, "mobile"))).toThrow(/outside the repository/);
    expect(() => assertSafeOut(path.join(os.tmpdir(), "content-db", "x"))).toThrow(
      /approved content/,
    );
    expect(() => assertSafeOut(path.join(os.tmpdir(), "quran-content.sqlite"))).toThrow(
      /approved content/,
    );
    expect(assertSafeOut(path.join(os.tmpdir(), "qr-ok"))).toBe(path.join(os.tmpdir(), "qr-ok"));
  });

  it("reads no database and no network: the script names neither", () => {
    const src = readFileSync(path.join(__dirname, "rebuild-content-core.mjs"), "utf8");
    expect(src).not.toMatch(/\bfetch\(|https?:\/\/[a-z]|process\.env|SUPABASE|createClient/);
    expect(src).not.toMatch(/mobile\/public|content-db\/quran/);
  });

  it("the committed lock file lists exactly the inputs the script reads", () => {
    expect(Object.keys(lock.inputs).sort()).toEqual(
      [
        migrationPath("20260818042151"),
        migrationPath("20260820160000"),
        migrationPath("20260820180000"),
        "scripts/quran-import/kazimirski/kazimirski_alignment_manifest.json",
        "scripts/quran-import/kazimirski/texte_entier_raw.html",
      ].sort(),
    );
    expect(readdirSync(path.join(ROOT, "supabase/migrations")).length).toBeGreaterThan(0);
  });
});

describe("SQL VALUES parser", () => {
  it("handles escaped quotes, commas and parentheses inside strings, NULL, booleans and sub-selects", () => {
    const sql =
      "INSERT INTO t (a,b,c,d) VALUES (1, 'it''s (fine), ok', NULL, true), (2, 'x', (SELECT id FROM s WHERE a = ')'), false);";
    expect(valuesAfter(sql, "INSERT INTO t (a,b,c,d) VALUES")).toEqual([
      [1, "it's (fine), ok", null, true],
      [2, "x", { sub: true }, false],
    ]);
  });

  it("rejects E'' escape strings and unknown tokens instead of guessing", () => {
    expect(() => parseValues("(E'a\\n')", 0)).toThrow(/E''/);
    expect(() => parseValues("(foo)", 0)).toThrow(/unrecognised/);
  });

  it("insists a statement exists exactly once", () => {
    expect(() => valuesAfter("select 1;", "INSERT INTO t VALUES")).toThrow(/not found/);
    expect(() =>
      valuesAfter("INSERT INTO t VALUES (1); INSERT INTO t VALUES (2);", "INSERT INTO t VALUES"),
    ).toThrow(/not unique/);
  });

  it("round-trips through SQLite without altering Arabic text", () => {
    const text = "ذَٰلِكَ ٱلْكِتَـٰبُ لَا رَيْبَ ۛ فِيهِ";
    const [row] = parseValues(`(2, 2, '${text}')`, 0);
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE a (t TEXT)");
    db.prepare("INSERT INTO a VALUES (?)").run(row[2] as string);
    expect((db.prepare("SELECT t FROM a").get() as { t: string }).t).toBe(text);
  });
});

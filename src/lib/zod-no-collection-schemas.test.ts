import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// zod 3.25.76 is retained temporarily although GHSA-mrhx-c7xc-m3w5 (a large
// untrusted collection makes a collection schema build one issue per element)
// is only fixed in zod 4. The app is not exposed because it has no collection
// schema: its only zod use is URL search-param objects of enums and numbers.
// This test keeps that true. See docs/ZOD-ADVISORY-AND-MIGRATION.md.

const SRC = path.resolve(__dirname, "..");
const COLLECTION = /\bz\s*\.\s*(array|set|map|record|tuple)\s*\(|\.\s*array\s*\(\s*\)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("zod collection schemas (advisory guard)", () => {
  test("the pattern detects what it is meant to detect", () => {
    for (const bad of [
      "z.array(z.string())",
      "z.set(z.number())",
      "z.map(a, b)",
      "z.record(z.string())",
      "z.tuple([a])",
      "z.string().array()",
      "z . array (x)",
    ]) {
      expect(COLLECTION.test(bad), bad).toBe(true);
    }
    for (const ok of ["z.enum(['a'])", "z.number().int()", "Array.isArray(x)", "const arr = []"]) {
      expect(COLLECTION.test(ok), ok).toBe(false);
    }
  });

  test("no application source defines a zod collection schema", () => {
    const offenders = sourceFiles(SRC).filter((f) => COLLECTION.test(readFileSync(f, "utf8")));
    expect(
      offenders.map((f) => path.relative(SRC, f)),
      "A zod collection schema needs zod 4 or a length check before parsing; see docs/ZOD-ADVISORY-AND-MIGRATION.md",
    ).toEqual([]);
  });
});

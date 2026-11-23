import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { check } from "./assert-no-skips.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "assert-no-skips.mjs");
const vitestOk = {
  numTotalTests: 86,
  numPassedTests: 86,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  numFailedTestSuites: 0,
};
const pwOk = { stats: { expected: 104, unexpected: 0, flaky: 0, skipped: 0 } };

describe("assert-no-skips", () => {
  it("accepts a clean vitest and Playwright report", () => {
    expect(check("vitest", vitestOk)).toEqual([]);
    expect(check("playwright", pwOk)).toEqual([]);
  });

  it("rejects skipped, pending, todo, failed and empty runs", () => {
    expect(check("vitest", { ...vitestOk, numPendingTests: 2 })).toEqual([
      expect.stringContaining("skipped"),
    ]);
    expect(check("vitest", { ...vitestOk, numTodoTests: 1 })).toEqual([
      expect.stringContaining("skipped"),
    ]);
    expect(check("vitest", { ...vitestOk, numFailedTests: 1 })).toEqual([
      expect.stringContaining("failed"),
    ]);
    expect(check("vitest", { ...vitestOk, numFailedTestSuites: 1 })).toEqual([
      expect.stringContaining("failed"),
    ]);
    expect(
      check("vitest", {
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 0,
      }),
    ).toEqual([expect.stringContaining("no test ran")]);
    expect(
      check("playwright", { stats: { expected: 100, unexpected: 0, flaky: 0, skipped: 4 } }),
    ).toEqual([expect.stringContaining("skipped")]);
    expect(
      check("playwright", { stats: { expected: 100, unexpected: 1, flaky: 0, skipped: 0 } }),
    ).toEqual([expect.stringContaining("failed")]);
  });

  it("rejects malformed input and unknown kinds", () => {
    expect(check("vitest", {})).toEqual([expect.stringContaining("missing counts")]);
    expect(check("jest", {})).toEqual([expect.stringContaining("unknown")]);
  });

  it("the CLI exits 1 on a skip, 0 on clean, 1 on an unreadable file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "qr-skips-"));
    try {
      const ok = path.join(dir, "ok.json"),
        skipped = path.join(dir, "skip.json");
      writeFileSync(ok, JSON.stringify(vitestOk));
      writeFileSync(skipped, JSON.stringify({ ...vitestOk, numPendingTests: 1 }));
      const run = (f: string) =>
        spawnSync(process.execPath, [SCRIPT, "vitest", f], { encoding: "utf8" }).status;
      expect(run(ok)).toBe(0);
      expect(run(skipped)).toBe(1);
      expect(run(path.join(dir, "missing.json"))).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

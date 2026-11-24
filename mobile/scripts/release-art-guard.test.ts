import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ACTIVE_ART, art } from "../src/artwork";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GUARD = path.join(HERE, "release-art-guard.mjs");
const SOURCE_ART = path.join(HERE, "..", "public", "art");
const tmp: string[] = [];

function makeOut(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "art-guard-"));
  tmp.push(dir);
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>QuranRoots</title>");
  writeFileSync(path.join(dir, "assets", "index.js"), 'console.log("clean bundle");');
  return dir;
}
const run = (...args: string[]) =>
  spawnSync(process.execPath, [GUARD, ...args], { encoding: "utf8" });
const firstArt = () => readdirSync(SOURCE_ART).filter((f) => f.endsWith(".jpg"))[0];

afterEach(() => {
  for (const d of tmp.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("artwork defaults (fail closed)", () => {
  it("shows no unapproved artwork outside the dev server / review mode", () => {
    expect(ACTIVE_ART).toBe("none");
    for (const key of ["hero", "journeys", "night", "mosque"] as const) expect(art(key)).toBeNull();
  });
});

describe("release-art-guard", () => {
  it("passes a clean build output", () => {
    expect(run(makeOut()).status).toBe(0);
  });

  it("fails when the art/ directory is bundled", () => {
    const out = makeOut();
    mkdirSync(path.join(out, "art"));
    copyFileSync(path.join(SOURCE_ART, firstArt()), path.join(out, "art", firstArt()));
    const r = run(out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("FAILED");
  });

  it("fails on a renamed copy of a blocked image (content hash)", () => {
    const out = makeOut();
    copyFileSync(
      path.join(SOURCE_ART, firstArt()),
      path.join(out, "assets", "totally-innocent.jpg"),
    );
    const r = run(out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("identical to a blocked artwork file");
  });

  it("fails when a bundle references the artwork path", () => {
    const out = makeOut();
    writeFileSync(path.join(out, "assets", "index.js"), 'const hero="/art/hero-mobile.jpg";');
    const r = run(out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("references");
  });

  it("--prune removes the copied art/ directory and then passes", () => {
    const out = makeOut();
    mkdirSync(path.join(out, "art"));
    copyFileSync(path.join(SOURCE_ART, firstArt()), path.join(out, "art", firstArt()));
    expect(run(out).status).toBe(1);
    expect(run("--prune", out).status).toBe(0);
    expect(existsSync(path.join(out, "art"))).toBe(false);
  });

  it("--prune still fails if a bundle references the artwork", () => {
    const out = makeOut();
    writeFileSync(path.join(out, "assets", "index.js"), 'x("/art/journeys.jpg")');
    expect(run("--prune", out).status).toBe(1);
  });

  it("a --review stamp passes review but is rejected by every release check", () => {
    const out = makeOut();
    expect(run("--review", out).status).toBe(0);
    const r = run(out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("review build stamp");
  });

  it("checks native asset copies when present and skips them when absent", () => {
    const out = makeOut();
    const native = path.join(makeOut(), "public");
    expect(run(out, path.join(tmpdir(), "no-such-native-dir")).status).toBe(0);
    mkdirSync(path.join(native, "art"), { recursive: true });
    copyFileSync(path.join(SOURCE_ART, firstArt()), path.join(native, "art", firstArt()));
    expect(run(out, native).status).toBe(1);
  });

  it("fails when the build output does not exist", () => {
    expect(run(path.join(tmpdir(), "missing-art-guard-dir")).status).toBe(1);
  });
});

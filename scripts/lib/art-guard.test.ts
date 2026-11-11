import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { loadManifest, REVIEW_MARKER, scanDir, sha256, stripAssetManifest } from "./art-guard.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const GUARD = path.join(ROOT, "scripts", "release-art-guard.mjs");
const PUBLIC = path.join(ROOT, "public");
const manifest = loadManifest();
const tmp: string[] = [];

/** A fake `.output` with a clean client bundle and server bundle. */
function makeOut(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "web-art-guard-"));
  tmp.push(dir);
  mkdirSync(path.join(dir, "public", "assets"), { recursive: true });
  mkdirSync(path.join(dir, "server"), { recursive: true });
  writeFileSync(path.join(dir, "public", "assets", "index.js"), 'console.log("clean");');
  writeFileSync(path.join(dir, "server", "index.mjs"), 'export default "ssr";');
  return dir;
}
const run = (...args: string[]) =>
  spawnSync(process.execPath, [GUARD, ...args], { encoding: "utf8" });
const blockedSrc = () => path.join(ROOT, manifest.blocked[0].file);

afterEach(() => {
  for (const d of tmp.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("art manifest", () => {
  it("pins every blocked file by its real SHA-256", () => {
    for (const b of manifest.blocked) {
      expect(sha256(readFileSync(path.join(ROOT, b.file)))).toBe(b.sha256);
    }
  });

  it("classifies every raster image in public/ (new images fail until reviewed)", () => {
    const listed = new Set(
      [...manifest.blocked, ...manifest.unverified, ...manifest.approved].map((e) =>
        path.basename(e.file),
      ),
    );
    const images = readdirSync(PUBLIC).filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f));
    expect(images.filter((f) => !listed.has(f))).toEqual([]);
  });

  it("lists no file as both blocked and approved", () => {
    const approved = new Set(manifest.approved.map((a: { file: string }) => a.file));
    expect(manifest.blocked.filter((b: { file: string }) => approved.has(b.file))).toEqual([]);
  });
});

describe("release-art-guard", () => {
  it("passes a clean build output", () => {
    expect(run(makeOut()).status).toBe(0);
  });

  it("fails on a blocked file by name", () => {
    const out = makeOut();
    copyFileSync(blockedSrc(), path.join(out, "public", path.basename(blockedSrc())));
    const r = run(out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("matches blocked artwork");
  });

  it("fails on a renamed copy (content hash)", () => {
    const out = makeOut();
    copyFileSync(blockedSrc(), path.join(out, "public", "assets", "sunset.jpg"));
    const r = run(out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("renamed or copied");
  });

  it("fails on a blocked image copied under a hashed asset name", () => {
    const out = makeOut();
    copyFileSync(blockedSrc(), path.join(out, "public", "assets", "hero-Bx81kq2.webp"));
    expect(run(out).status).toBe(1);
  });

  it("fails when client JS references a blocked image", () => {
    const out = makeOut();
    writeFileSync(
      path.join(out, "public", "assets", "index.js"),
      'const a="/quranroots-hero-cinematic-desktop.jpg";',
    );
    const r = run(out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("references blocked artwork");
  });

  it("fails when the SSR server bundle or server-rendered HTML references blocked art", () => {
    const out = makeOut();
    writeFileSync(
      path.join(out, "server", "index.mjs"),
      '`<img src="/quranroots-journeys-cinematic.jpg">`',
    );
    expect(run(out).status).toBe(1);
  });

  it("fails when a source map references blocked art", () => {
    const out = makeOut();
    writeFileSync(
      path.join(out, "public", "assets", "index.js.map"),
      '{"sources":["quranroots-hero-cinematic-mobile.jpg"]}',
    );
    expect(run(out).status).toBe(1);
  });

  it("fails on a large inlined raster (data URI) image", () => {
    const out = makeOut();
    writeFileSync(
      path.join(out, "public", "assets", "index.js"),
      `const x="data:image/jpeg;base64,${"A".repeat(30000)}";`,
    );
    const r = run(out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("embedded raster");
  });

  it("does not trip on a small inlined SVG data URI", () => {
    const out = makeOut();
    writeFileSync(
      path.join(out, "public", "assets", "index.css"),
      'a{background:url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")}',
    );
    expect(run(out).status).toBe(0);
  });

  it("treats the archway photos as blocked: by name, by renamed copy, and by reference", () => {
    const premium = manifest.blocked.filter((b: { file: string }) =>
      b.file.includes("hero-premium"),
    );
    expect(premium.length).toBe(4);
    for (const b of premium) {
      const src = path.join(ROOT, b.file);
      expect(existsSync(src)).toBe(true); // source files stay in the repository
      const named = makeOut();
      copyFileSync(src, path.join(named, "public", path.basename(src)));
      expect(run(named).status).toBe(1);
      const renamed = makeOut();
      copyFileSync(src, path.join(renamed, "public", "assets", "photo-x1y2z3.webp"));
      const r = run(renamed);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("renamed or copied");
    }
    const ref = makeOut();
    writeFileSync(
      path.join(ref, "public", "assets", "index.js"),
      'const a="/quranroots-hero-premium-1122w.webp";',
    );
    expect(run(ref).status).toBe(1);
  });

  it("the 'unverified' holding category still warns when present and fails when referenced", () => {
    const m = loadManifest();
    const unverified = {
      ...m,
      unverifiedNames: new Set(["holding-photo.webp"]),
      unverifiedHashes: new Set<string>(),
    };
    const present = makeOut();
    writeFileSync(path.join(present, "public", "holding-photo.webp"), "x");
    expect(scanDir(present, unverified)).toEqual({
      violations: [],
      warnings: [expect.stringContaining("unverified artwork is present")],
    });
    const ref = makeOut();
    writeFileSync(path.join(ref, "public", "assets", "index.js"), 'a("/holding-photo.webp")');
    expect(scanDir(ref, unverified).violations[0]).toContain("references unverified artwork");
  });

  it("--prune removes blocked files (including renamed copies) and then passes", () => {
    const out = makeOut();
    copyFileSync(blockedSrc(), path.join(out, "public", path.basename(blockedSrc())));
    copyFileSync(blockedSrc(), path.join(out, "public", "assets", "renamed.jpg"));
    expect(run(out).status).toBe(1);
    expect(run("--prune", out).status).toBe(0);
    expect(existsSync(path.join(out, "public", path.basename(blockedSrc())))).toBe(false);
    expect(existsSync(path.join(out, "public", "assets", "renamed.jpg"))).toBe(false);
  });

  it("--prune does not hide a bundle that still references the art", () => {
    const out = makeOut();
    writeFileSync(
      path.join(out, "public", "assets", "index.js"),
      'x("quranroots-hero-cinematic-desktop.jpg")',
    );
    expect(run("--prune", out).status).toBe(1);
  });

  it("a --review stamp is accepted by review but rejected by every release check", () => {
    const out = makeOut();
    expect(run("--review", out).status).toBe(0);
    expect(existsSync(path.join(out, "public", REVIEW_MARKER))).toBe(true);
    const r = run(out);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("review build stamp");
    expect(run("--prune", out).status).toBe(1);
  });

  it("scanDir reports violations and warnings separately", () => {
    const out = makeOut();
    const r = scanDir(out, manifest);
    expect(r).toEqual({ violations: [], warnings: [] });
  });

  it("fails when the build output does not exist", () => {
    expect(run(path.join(tmpdir(), "missing-web-art-guard-dir")).status).toBe(1);
  });

  it("rejects conflicting flags", () => {
    expect(run("--prune", "--review", makeOut()).status).toBe(2);
  });

  describe("Nitro asset manifest in the server entry", () => {
    const entry = (name: string) =>
      `\t"/${name}": {\n\t\t"type": "image/jpeg",\n\t\t"size": 1,\n\t\t"path": "../public/${name}"\n\t},\n`;
    const withManifest = (...names: string[]) =>
      `const assets = {\n${names.map(entry).join("")}};\nexport default assets;\n`;

    it("stripAssetManifest removes only the entries asked for and keeps valid JS", () => {
      const src = withManifest("quranroots-logo.png", "quranroots-hero-cinematic-desktop.jpg");
      const out = stripAssetManifest(src, (k: string) => k.includes("cinematic"));
      expect(out).toContain("quranroots-logo.png");
      expect(out).not.toContain("cinematic");
      expect(() => new Function(out.replace("export default assets;", ""))).not.toThrow();
    });

    it("a blocked file left in the manifest fails the build; --prune scrubs it", () => {
      const out = makeOut();
      writeFileSync(
        path.join(out, "server", "index.mjs"),
        withManifest("quranroots-logo.png", "quranroots-hero-cinematic-desktop.jpg"),
      );
      const failed = run(out);
      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain("references blocked artwork");

      const pruned = run("--prune", out);
      expect(pruned.status).toBe(0);
      const after = readFileSync(path.join(out, "server", "index.mjs"), "utf8");
      expect(after).not.toContain("cinematic");
      expect(after).toContain("quranroots-logo.png");
    });

    it("archway-photo entries in the manifest fail the build; --prune scrubs them and the files", () => {
      const out = makeOut();
      writeFileSync(
        path.join(out, "server", "index.mjs"),
        withManifest(
          "quranroots-logo.png",
          "quranroots-hero-premium-768w.webp",
          "quranroots-hero-premium.png",
        ),
      );
      copyFileSync(
        path.join(ROOT, "public", "quranroots-hero-premium-768w.webp"),
        path.join(out, "public", "quranroots-hero-premium-768w.webp"),
      );
      expect(run(out).status).toBe(1);
      expect(run("--prune", out).status).toBe(0);
      const after = readFileSync(path.join(out, "server", "index.mjs"), "utf8");
      expect(after).not.toContain("hero-premium");
      expect(after).toContain("quranroots-logo.png");
      expect(existsSync(path.join(out, "public", "quranroots-hero-premium-768w.webp"))).toBe(false);
    });
  });
});

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { MANIFEST_SHA256, drawSample } from "./draw-review-sample.mjs";

const file = path.resolve(
  __dirname,
  "../../scripts/quran-import/kazimirski/kazimirski_alignment_manifest.json",
);
const bytes = readFileSync(file);
const segments = JSON.parse(bytes.toString("utf8")).segments as {
  surah_number: number;
  source_ordinal: number;
}[];

describe("draw-review-sample", () => {
  it("the manifest it reads is the pinned one", () => {
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(MANIFEST_SHA256);
  });
  it("is reproducible from the seed alone and differs for another seed", () => {
    const a = drawSample(segments, "seed-one", 200);
    expect(drawSample(segments, "seed-one", 200)).toEqual(a);
    expect(drawSample(segments, "seed-two", 200)).not.toEqual(a);
  });
  it("covers all 114 surahs and has exactly the requested size, without duplicates", () => {
    const s = drawSample(segments, "seed-one", 200);
    expect(s).toHaveLength(200);
    expect(new Set(s.map(([x]) => x)).size).toBe(114);
    expect(new Set(s.map((p) => p.join(":"))).size).toBe(200);
  });
  it("every drawn key exists in the manifest", () => {
    const keys = new Set(segments.map((x) => `${x.surah_number}:${x.source_ordinal}`));
    for (const [a, b] of drawSample(segments, "x", 150)) expect(keys.has(`${a}:${b}`)).toBe(true);
  });
  it("a growing size only adds segments (the smaller sample is a subset)", () => {
    const small = new Set(drawSample(segments, "grow", 150).map((p) => p.join(":")));
    const big = new Set(drawSample(segments, "grow", 300).map((p) => p.join(":")));
    for (const k of small) expect(big.has(k)).toBe(true);
  });
  it("rejects a missing seed and a size below the surah count", () => {
    expect(() => drawSample(segments, "", 200)).toThrow(/seed/);
    expect(() => drawSample(segments, "s", 50)).toThrow(/size/);
  });

  it("still runs when started through a symlink (a silent no-op there passed as success)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "drs-"));
    const link = path.join(dir, "draw.mjs");
    symlinkSync(path.resolve(__dirname, "draw-review-sample.mjs"), link);
    const out = execFileSync("node", [link, "--seed", "x", "--size", "120"], {
      encoding: "utf8",
    });
    expect(out.trim().length).toBeGreaterThan(0);
  });
});

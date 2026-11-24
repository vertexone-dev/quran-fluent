#!/usr/bin/env node
/**
 * Reproducible, pre-registerable review sample of Kazimirski segments (QR-DESIGN-007D).
 *
 *   node mobile/scripts/draw-review-sample.mjs --seed <text> --size <N>
 *
 * Draws N segments from the committed alignment manifest so that two reviewers (or an
 * auditor) can reproduce the exact same list from the seed alone. Rule:
 *   1. every surah contributes its lowest-ranked segment (so all 114 surahs are covered);
 *   2. the remaining slots go to the globally lowest-ranked segments;
 *   rank = SHA-256(seed + ":" + surah + ":" + source_ordinal), compared as hex.
 * The seed must be fixed and recorded BEFORE the reviewers see any segment text, so
 * nobody can choose the sample. It reads only the manifest (pinned below) and prints
 * keys, never text, so the list can be shared without the Quran-adjacent source text.
 * N must be at least 114.
 */
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MANIFEST_SHA256 = "04c6d562a440f661bf4b80d690c877b8691eed567ec55cb1062937e05a2f8a1e";

export function drawSample(segments, seed, size) {
  if (!seed) throw new Error("a seed is required");
  const surahs = [...new Set(segments.map((s) => s.surah_number))];
  if (!Number.isInteger(size) || size < surahs.length)
    throw new Error(`size must be an integer >= ${surahs.length}`);
  const ranked = segments
    .map((s) => ({
      surah: s.surah_number,
      ordinal: s.source_ordinal,
      rank: createHash("sha256")
        .update(`${seed}:${s.surah_number}:${s.source_ordinal}`)
        .digest("hex"),
    }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
  const chosen = new Map();
  for (const r of ranked) if (!chosen.has(r.surah)) chosen.set(r.surah, r); // rule 1
  const keys = new Set([...chosen.values()].map((r) => `${r.surah}:${r.ordinal}`));
  for (const r of ranked) {
    if (keys.size >= size) break;
    keys.add(`${r.surah}:${r.ordinal}`); // rule 2
  }
  return [...keys].map((k) => k.split(":").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function main() {
  const args = process.argv.slice(2);
  const get = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  const seed = get("--seed");
  const size = Number(get("--size"));
  const file = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../scripts/quran-import/kazimirski/kazimirski_alignment_manifest.json",
  );
  const bytes = readFileSync(file);
  if (createHash("sha256").update(bytes).digest("hex") !== MANIFEST_SHA256)
    throw new Error("manifest does not match the pinned SHA-256");
  const sample = drawSample(JSON.parse(bytes.toString("utf8")).segments, seed, size);
  console.log(
    JSON.stringify(
      {
        manifest_sha256: MANIFEST_SHA256,
        seed,
        size: sample.length,
        segments: sample.map(([s, o]) => ({ surah: s, ordinal: o })),
      },
      null,
      2,
    ),
  );
}

// Compare real paths: through a symlink (macOS /var -> /private/var) a plain
// path compare is false and the script would silently do nothing (007E).
function isEntrypoint(moduleUrl) {
  try {
    return (
      Boolean(process.argv[1]) &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl))
    );
  } catch {
    return false;
  }
}

if (isEntrypoint(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`draw-review-sample: FAILED: ${e.message}`);
    process.exit(1);
  }
}

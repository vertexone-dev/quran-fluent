#!/usr/bin/env node
// Release artwork guard (QR-WEB-006). Fails CLOSED.
//
// The cinematic artwork (public/quranroots-*-cinematic*.jpg) is AI-generated
// and not cleared for commercial use. This guard stops it reaching a release:
//
//   node scripts/release-art-guard.mjs --prune [dir ...]   npm run build
//   node scripts/release-art-guard.mjs [dir ...]           npm run release:check
//   node scripts/release-art-guard.mjs --review [dir ...]  npm run build:review
//
// Default directory: .output (the Nitro build that CI and the production
// deploy use), plus dist/ if it exists.
//  - --prune deletes blocked files from <dir>/public first. Vite copies
//    public/ wholesale into the output even when nothing references a file.
//  - It then fails if anything blocked remains: files by name or by SHA-256
//    (catches renamed copies), text references in any generated asset
//    (client JS/CSS/HTML, SSR server bundle, source maps), large embedded
//    raster images, or the review-build stamp.
//  - Nitro also embeds an asset manifest of everything in public/ into
//    server/index.mjs at build time, so --prune scrubs the pruned files'
//    entries from it as well; any blocked entry left behind fails the build.
//  - --review stamps the build NOT FOR RELEASE (exit 0); every other run
//    rejects that stamp. Review builds can never pass release:check.
// "unverified" manifest entries (a holding category) are reported, never silently ignored.

import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  REVIEW_MARKER,
  loadManifest,
  pruneBlocked,
  scanDir,
  scrubAssetManifest,
} from "./lib/art-guard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function main(argv) {
  const flags = argv.filter((a) => a.startsWith("--"));
  const unknown = flags.filter((f) => f !== "--prune" && f !== "--review");
  const prune = flags.includes("--prune");
  const review = flags.includes("--review");
  if (unknown.length || (prune && review)) {
    console.error("usage: release-art-guard.mjs [--prune | --review] [dir ...]");
    return 2;
  }
  const given = argv.filter((a) => !a.startsWith("--")).map((d) => path.resolve(ROOT, d));
  const dirs = given.length
    ? given
    : [".output", "dist"].map((d) => path.join(ROOT, d)).filter((d, i) => i === 0 || existsSync(d));
  for (const d of dirs) {
    if (!existsSync(d)) {
      console.error(
        `release-art-guard: ${path.relative(ROOT, d)} does not exist -- run the build first.`,
      );
      return 1;
    }
  }
  const manifest = loadManifest();

  if (review) {
    for (const d of dirs) {
      const pub = existsSync(path.join(d, "public")) ? path.join(d, "public") : d;
      writeFileSync(
        path.join(pub, REVIEW_MARKER),
        "INTERNAL ART-REVIEW BUILD. Contains AI-generated artwork that is NOT cleared for\n" +
          "commercial use. Do not deploy, do not publish. See docs/ARTWORK-RELEASE.md.\n",
      );
    }
    console.warn("release-art-guard: REVIEW BUILD stamped -- NOT FOR RELEASE.");
    return 0;
  }

  if (prune) {
    for (const d of dirs) {
      const removed = pruneBlocked(path.join(d, "public"), manifest);
      if (removed.length) {
        console.log(
          `release-art-guard: pruned ${removed.join(", ")} from ${path.relative(ROOT, d)}/public`,
        );
      }
      const scrubbed = scrubAssetManifest(d, removed, manifest);
      if (scrubbed.length) {
        console.log(
          `release-art-guard: removed their entries from the asset manifest in ${scrubbed.join(", ")}`,
        );
      }
    }
  }

  const failures = [];
  const warnings = [];
  for (const d of dirs) {
    const r = scanDir(d, manifest);
    failures.push(...r.violations.map((v) => `${path.relative(ROOT, d)}/${v}`));
    warnings.push(...r.warnings.map((v) => `${path.relative(ROOT, d)}/${v}`));
  }
  for (const w of warnings) console.warn(`release-art-guard: warning: ${w}`);
  if (failures.length) {
    console.error("release-art-guard: FAILED -- unapproved artwork is present in a release build:");
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      "Cinematic artwork stays blocked until written commercial rights are on file (docs/ARTWORK-RELEASE.md).",
    );
    return 1;
  }
  console.log(
    `release-art-guard: OK -- no blocked artwork in ${dirs.map((d) => path.relative(ROOT, d)).join(", ")}`,
  );
  return 0;
}

process.exitCode = main(process.argv.slice(2));

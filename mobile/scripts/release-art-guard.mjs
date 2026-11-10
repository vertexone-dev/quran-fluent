#!/usr/bin/env node
// Release artwork guard (QR-MOBILE-004).
//
// The Design Lock v1.0 cinematic artwork in public/art/ is AI-generated and is
// NOT cleared for commercial use. It must never ship in a production or store
// build until written rights are on file (see mobile/ARTWORK-RELEASE.md).
// This guard fails CLOSED: it treats the whole public/art set as blocked and
// fails if any of it is present or referenced in the directories it checks.
//
// Usage (run from mobile/):
//   node scripts/release-art-guard.mjs --prune dist     # `npm run build`
//   node scripts/release-art-guard.mjs dist [native...] # `npm run release:check`
//   node scripts/release-art-guard.mjs --review dist    # `npm run build:review`
//
//  - The first directory is required. Any further directories (the Capacitor
//    asset copies after `cap sync`) are checked only if they exist.
//  - --prune deletes <dir>/art from the FIRST directory before checking. Vite
//    copies public/ wholesale into the output, so the files exist there even
//    when no screen references them. Native directories are never modified.
//  - --review stamps the first directory as an internal review build and exits
//    0. A stamped directory is rejected by every non-review run.
//
// No dependencies; Node >= 18.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ART_DIR = path.join(MOBILE_ROOT, "public", "art");
export const REVIEW_MARKER = "REVIEW-BUILD-NOT-FOR-RELEASE.txt";
const TEXT_EXT = new Set([
  ".js",
  ".mjs",
  ".css",
  ".html",
  ".json",
  ".map",
  ".svg",
  ".webmanifest",
  ".txt",
]);
const IMAGE_REF = /\/art\/[\w.-]+\.(?:jpe?g|png|webp|avif|gif)/i;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Hashes and names of every source artwork file: the blocked set. */
function blockedSet() {
  const names = new Set();
  const hashes = new Set();
  if (existsSync(SOURCE_ART_DIR)) {
    for (const file of walk(SOURCE_ART_DIR)) {
      names.add(path.basename(file));
      hashes.add(sha256(readFileSync(file)));
    }
  }
  return { names, hashes };
}

export function checkDir(dir, blocked = blockedSet()) {
  const violations = [];
  for (const file of walk(dir)) {
    const rel = path.relative(dir, file).split(path.sep).join("/");
    if (rel === REVIEW_MARKER) {
      violations.push(`${rel}: internal review build stamp (not for release)`);
      continue;
    }
    if (rel.startsWith("art/") || rel.includes("/art/")) {
      violations.push(`${rel}: inside an art/ directory`);
      continue;
    }
    if (blocked.names.has(path.basename(file))) {
      violations.push(`${rel}: file name matches blocked artwork`);
      continue;
    }
    const bytes = readFileSync(file);
    if (blocked.hashes.has(sha256(bytes))) {
      violations.push(`${rel}: content is identical to a blocked artwork file`);
      continue;
    }
    if (TEXT_EXT.has(path.extname(file).toLowerCase())) {
      const text = bytes.toString("utf8");
      const ref = text.match(IMAGE_REF);
      const named = [...blocked.names].find((n) => text.includes(n));
      if (ref) violations.push(`${rel}: references artwork path "${ref[0]}"`);
      else if (named) violations.push(`${rel}: references blocked artwork "${named}"`);
    }
  }
  return violations;
}

function main(argv) {
  const flags = argv.filter((a) => a.startsWith("--"));
  const dirs = argv.filter((a) => !a.startsWith("--")).map((d) => path.resolve(MOBILE_ROOT, d));
  const prune = flags.includes("--prune");
  const review = flags.includes("--review");
  const unknown = flags.filter((f) => f !== "--prune" && f !== "--review");
  if (unknown.length || dirs.length === 0 || (prune && review)) {
    console.error("usage: release-art-guard.mjs [--prune | --review] <dir> [<native-dir> ...]");
    return 2;
  }
  const [primary, ...optional] = dirs;
  if (!existsSync(primary)) {
    console.error(`release-art-guard: ${primary} does not exist -- run the build first.`);
    return 1;
  }

  if (review) {
    writeFileSync(
      path.join(primary, REVIEW_MARKER),
      "INTERNAL ART-REVIEW BUILD. Contains AI-generated artwork that is NOT cleared for\n" +
        "commercial use. Do not distribute, do not submit to any store.\n" +
        "See mobile/ARTWORK-RELEASE.md.\n",
    );
    console.warn("release-art-guard: REVIEW BUILD stamped -- NOT FOR RELEASE.");
    return 0;
  }

  if (prune) rmSync(path.join(primary, "art"), { recursive: true, force: true });

  const blocked = blockedSet();
  const failures = [];
  for (const dir of [primary, ...optional.filter((d) => existsSync(d))]) {
    for (const v of checkDir(dir, blocked))
      failures.push(`${path.relative(MOBILE_ROOT, dir)}/${v}`);
  }
  if (failures.length) {
    console.error("release-art-guard: FAILED -- unapproved artwork is present in a release build:");
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      "Artwork stays blocked until written commercial rights are on file (mobile/ARTWORK-RELEASE.md).",
    );
    return 1;
  }
  console.log(
    `release-art-guard: OK -- no unapproved artwork in ${[primary, ...optional.filter((d) => existsSync(d))].map((d) => path.relative(MOBILE_ROOT, d)).join(", ")}`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

// Pure helpers for the release artwork guard (QR-WEB-006). No dependencies.
// See scripts/release-art-guard.mjs (CLI) and docs/ARTWORK-RELEASE.md.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REVIEW_MARKER = "REVIEW-BUILD-NOT-FOR-RELEASE.txt";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEXT_EXT = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
  ".json",
  ".map",
  ".svg",
  ".txt",
  ".webmanifest",
  ".jsonc",
]);
// An inlined raster image this large is artwork, not an icon.
const EMBEDDED_RASTER = /data:image\/(?:jpe?g|webp|png|avif|gif);base64,[A-Za-z0-9+/=]{20000,}/;

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function loadManifest(file = path.join(HERE, "art-manifest.json")) {
  const m = JSON.parse(readFileSync(file, "utf8"));
  return {
    ...m,
    blockedHashes: new Set(m.blocked.map((b) => b.sha256)),
    unverifiedHashes: new Set(m.unverified.map((u) => u.sha256)),
    blockedNames: new Set(m.blocked.map((b) => path.basename(b.file))),
    unverifiedNames: new Set(m.unverified.map((u) => path.basename(u.file))),
  };
}

export function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// Nitro embeds a static-asset manifest in the server entry: one object literal
// entry per file in public/, each ending in `"path": "../public/<file>"`. It is
// generated from public/ before pruning, so it must be scrubbed too.
const ASSET_MANIFEST_ENTRY =
  /[ \t]*"\/([^"\n]+)":\s*\{[^{}]*?"path":\s*"\.\.\/public\/[^"\n]+"[^{}]*\},?[ \t]*\n?/g;

/** Remove Nitro asset-manifest entries for which `drop(key)` is true (all if omitted). */
export function stripAssetManifest(text, drop = () => true) {
  return text.replace(ASSET_MANIFEST_ENTRY, (entry, key) => (drop(key) ? "" : entry));
}

/**
 * After pruning blocked files from <dir>/public, drop their entries from the
 * Nitro asset manifest in <dir>/server. Returns the server files rewritten.
 */
export function scrubAssetManifest(dir, removedRelPaths, m) {
  const serverDir = path.join(dir, "server");
  const rewritten = [];
  if (!existsSync(serverDir)) return rewritten;
  const removed = new Set(removedRelPaths.map((r) => r.split(path.sep).join("/")));
  const drop = (key) => removed.has(key) || isBlockedName(path.basename(key), m);
  for (const file of walk(serverDir)) {
    if (!/\.(?:mjs|js)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    if (!text.includes('"path": "../public/')) continue;
    const next = stripAssetManifest(text, drop);
    if (next !== text) {
      writeFileSync(file, next);
      rewritten.push(path.relative(dir, file));
    }
  }
  return rewritten;
}

const isBlockedName = (base, m) =>
  m.blockedNames.has(base) || m.namePatterns.some((p) => base.includes(p));

/** True if this file is blocked by name or content (so a renamed copy is caught). */
export function isBlockedFile(file, m, bytes = readFileSync(file)) {
  return isBlockedName(path.basename(file), m) || m.blockedHashes.has(sha256(bytes));
}

/** Delete blocked files from a build's public directory. Returns what was removed. */
export function pruneBlocked(publicDir, m) {
  const removed = [];
  if (!existsSync(publicDir)) return removed;
  for (const file of walk(publicDir)) {
    if (isBlockedFile(file, m)) {
      rmSync(file, { force: true });
      removed.push(path.relative(publicDir, file));
    }
  }
  return removed;
}

/** Scan one build directory. `violations` fail a release; `warnings` are reported. */
export function scanDir(dir, m) {
  const violations = [];
  const warnings = [];
  for (const file of walk(dir)) {
    const rel = path.relative(dir, file).split(path.sep).join("/");
    const base = path.basename(file);
    if (base === REVIEW_MARKER) {
      violations.push(`${rel}: internal review build stamp (not for release)`);
      continue;
    }
    const bytes = readFileSync(file);
    const hash = sha256(bytes);
    if (isBlockedName(base, m)) {
      violations.push(`${rel}: file name matches blocked artwork`);
      continue;
    }
    if (m.blockedHashes.has(hash)) {
      violations.push(`${rel}: content is identical to blocked artwork (renamed or copied)`);
      continue;
    }
    if (m.unverifiedHashes.has(hash) || m.unverifiedNames.has(base)) {
      warnings.push(
        `${rel}: unverified artwork is present (not referenced by pages; owner decision pending)`,
      );
    }
    if (TEXT_EXT.has(path.extname(file).toLowerCase())) {
      const text = bytes.toString("utf8");
      const blockedRef =
        [...m.blockedNames].find((n) => text.includes(n)) ??
        m.namePatterns.find((p) => text.includes(p));
      if (blockedRef) {
        violations.push(`${rel}: references blocked artwork "${blockedRef}"`);
        continue;
      }
      // Listings in the Nitro asset manifest are "present", already warned about
      // above, not page references.
      const pageText = stripAssetManifest(text);
      const unverifiedRef = [...m.unverifiedNames].find((n) => pageText.includes(n));
      if (unverifiedRef) {
        violations.push(`${rel}: references unverified artwork "${unverifiedRef}"`);
        continue;
      }
      if (EMBEDDED_RASTER.test(text)) {
        violations.push(`${rel}: contains a large embedded raster image (data URI)`);
      }
    }
  }
  return { violations, warnings };
}

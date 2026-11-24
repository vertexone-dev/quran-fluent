#!/usr/bin/env node
/**
 * Decides whether a change set needs the mobile release checks (QR-RELEASE-002A).
 *
 *   git diff --name-only <base> <head> | node classify-changes.mjs
 *
 * Prints `mobile=true` or `mobile=false` (and a reason on stderr). Rules, fail closed:
 *  - An empty list means the diff could not be read: mobile=true (never "nothing changed").
 *  - A path counts as mobile-relevant if it is under mobile/, supabase/migrations/,
 *    scripts/quran-import/kazimirski/, is the mobile workflow, package.json or
 *    package-lock.json.
 *  - A relevant path that is only documentation (a Markdown file) does not count.
 *  - Anything else (the website, other workflows) does not need the mobile checks.
 * The decision only skips the heavy jobs; the gate job always runs and still fails if a
 * required job was skipped when `mobile=true`.
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RELEVANT = [
  /^mobile\//,
  /^supabase\/migrations\//,
  /^scripts\/quran-import\/kazimirski\//,
  /^\.github\/workflows\/mobile-ci\.yml$/,
  /^package(-lock)?\.json$/,
];
const DOC_ONLY = /\.md$/i;

export function classify(files) {
  const list = files.map((f) => f.trim()).filter(Boolean);
  if (list.length === 0)
    return { mobile: true, reason: "empty file list: cannot rule out mobile changes" };
  for (const f of list) {
    if (RELEVANT.some((r) => r.test(f)) && !DOC_ONLY.test(f)) {
      return { mobile: true, reason: `mobile-relevant change: ${f}` };
    }
  }
  return {
    mobile: false,
    reason: `${list.length} file(s), none affect the mobile app (docs or website only)`,
  };
}

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
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    const r = classify(input.split("\n"));
    console.error(`classify-changes: ${r.reason}`);
    console.log(`mobile=${r.mobile}`);
  });
}

#!/usr/bin/env node
/**
 * The mobile release gate decision (QR-RELEASE-002A). Pure function plus a CLI that reads
 * its inputs from the environment and exits non-zero unless the gate passes.
 *
 * Fail closed:
 *  - release events (push, workflow_dispatch): static, content-integrity and content-full
 *    must ALL be "success". "skipped", "cancelled", "failure" or anything unknown fails.
 *  - pull requests: the change classification job must have succeeded and said "true" or
 *    "false". "false" passes (nothing mobile changed). "true" needs all three jobs to be
 *    "success"; a skipped job fails. Any missing or odd value fails.
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OK = "success";

export function decide({ event, changes, mobile, results }) {
  const names = ["static", "content-integrity", "content-full"];
  const need = () => {
    for (const n of names) {
      if (results?.[n] !== OK)
        return { pass: false, reason: `${n} did not succeed (${results?.[n] ?? "missing"})` };
    }
    return { pass: true, reason: "static, content-integrity and content-full all succeeded" };
  };
  if (event === "push" || event === "workflow_dispatch") return need();
  if (event === "pull_request") {
    if (changes !== OK)
      return {
        pass: false,
        reason: `change classification did not succeed (${changes ?? "missing"})`,
      };
    if (mobile === "false") return { pass: true, reason: "no mobile-affecting files changed" };
    if (mobile === "true") return need();
    return { pass: false, reason: `unrecognised classification "${mobile ?? "missing"}"` };
  }
  return { pass: false, reason: `unsupported event "${event ?? "missing"}"` };
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
  const e = process.env;
  const r = decide({
    event: e.EVENT_NAME,
    changes: e.CHANGES_RESULT,
    mobile: e.MOBILE_CHANGED,
    results: {
      static: e.STATIC_RESULT,
      "content-integrity": e.INTEGRITY_RESULT,
      "content-full": e.FULL_RESULT,
    },
  });
  console.log(`mobile-gate: ${r.pass ? "PASS" : "FAIL"}: ${r.reason}`);
  if (!r.pass) {
    console.error(`::error title=Mobile release gate::${r.reason}`);
    process.exit(1);
  }
}

import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { classify } from "./classify-changes.mjs";
import { decide } from "./mobile-gate.mjs";

const ok = { static: "success", "content-integrity": "success", "content-full": "success" };

describe("classify-changes", () => {
  it("an empty list fails closed (mobile = true)", () => expect(classify([]).mobile).toBe(true));
  it("mobile code, migrations, kazimirski sources, lockfiles and the workflow need the checks", () => {
    for (const f of [
      "mobile/src/App.tsx",
      "supabase/migrations/20260101000000_x.sql",
      "scripts/quran-import/kazimirski/kazimirski_alignment_manifest.json",
      "package-lock.json",
      ".github/workflows/mobile-ci.yml",
      "mobile/docs/something.json",
    ])
      expect(classify([f]).mobile, f).toBe(true);
  });
  it("documentation-only and website-only changes do not", () => {
    expect(classify(["mobile/docs/README.md", "QR-X-REPORT.md"]).mobile).toBe(false);
    expect(classify(["src/routes/index.tsx", "tests/e2e/1.spec.ts"]).mobile).toBe(false);
  });
  it("one code file among docs flips it to true", () => {
    expect(classify(["README.md", "mobile/src/x.ts"]).mobile).toBe(true);
  });
  it("a markdown-looking name that is not markdown still counts", () => {
    expect(classify(["mobile/scripts/readme.md.js"]).mobile).toBe(true);
  });
});

describe("mobile-gate", () => {
  it("release events need all three jobs to succeed", () => {
    expect(decide({ event: "push", results: ok }).pass).toBe(true);
    expect(decide({ event: "workflow_dispatch", results: ok }).pass).toBe(true);
    for (const bad of ["skipped", "failure", "cancelled", undefined, ""]) {
      expect(
        decide({ event: "push", results: { ...ok, "content-full": bad } }).pass,
        String(bad),
      ).toBe(false);
    }
  });
  it("pull request with mobile changes: skipped heavy job fails", () => {
    expect(
      decide({ event: "pull_request", changes: "success", mobile: "true", results: ok }).pass,
    ).toBe(true);
    expect(
      decide({
        event: "pull_request",
        changes: "success",
        mobile: "true",
        results: { ...ok, static: "skipped" },
      }).pass,
    ).toBe(false);
  });
  it("pull request without mobile changes passes even though the heavy jobs were skipped", () => {
    const skipped = {
      static: "skipped",
      "content-integrity": "skipped",
      "content-full": "skipped",
    };
    expect(
      decide({ event: "pull_request", changes: "success", mobile: "false", results: skipped }).pass,
    ).toBe(true);
  });
  it("cannot be bypassed by a broken classification", () => {
    const skipped = {
      static: "skipped",
      "content-integrity": "skipped",
      "content-full": "skipped",
    };
    for (const [changes, mobile] of [
      ["failure", "false"],
      ["skipped", "false"],
      [undefined, "false"],
      ["success", undefined],
      ["success", "maybe"],
    ]) {
      expect(
        decide({ event: "pull_request", changes, mobile, results: skipped }).pass,
        `${changes}/${mobile}`,
      ).toBe(false);
    }
  });
  it("unknown events fail", () => {
    expect(decide({ event: "schedule", results: ok }).pass).toBe(false);
    expect(decide({ results: ok }).pass).toBe(false);
  });
});

describe("CLIs, started through a symlink", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gate-"));
  const link = (name: string) => {
    const l = path.join(dir, name);
    symlinkSync(path.resolve(__dirname, name), l);
    return l;
  };
  it("mobile-gate exits non-zero on a skipped job and zero when all pass", () => {
    const l = link("mobile-gate.mjs");
    const env = {
      PATH: process.env.PATH ?? "",
      EVENT_NAME: "push",
      STATIC_RESULT: "success",
      INTEGRITY_RESULT: "success",
      FULL_RESULT: "skipped",
    };
    expect(spawnSync("node", [l], { env, encoding: "utf8" }).status).toBe(1);
    expect(
      spawnSync("node", [l], { env: { ...env, FULL_RESULT: "success" }, encoding: "utf8" }).status,
    ).toBe(0);
  });
  it("classify-changes prints its decision through a symlink", () => {
    const l = link("classify-changes.mjs");
    const out = execFileSync("node", [l], { input: "mobile/src/a.ts\n", encoding: "utf8" });
    expect(out.trim()).toBe("mobile=true");
  });
});

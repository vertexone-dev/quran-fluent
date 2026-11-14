// QR-SEC-003B tests. Offline: injected fakes only for T01-T30; the "real git" suites
// at the bottom use throwaway repositories under the OS temp dir (no network, no remote).
// Run: node --test scripts/release/
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MANDATORY_CHECKS,
  REQUIRED_CI,
  assessRelease,
  createGitAdapter,
  createGitHubClient,
  formatReport,
  loadTrustPolicy,
  parseArgs,
  redact,
} from "./verify-release.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHA = "a1".repeat(20);
const PREV = "b2".repeat(20);
const OTHER = "c3".repeat(20);
const REPO = "vertexone-dev/quran-fluent";
const FP = "SHA256:Vo1JBPXHx1Z8U2C4DSVBcmHMuKboLkj+Pde5EKB50RA";
const CI_BLOB = "d4".repeat(20);
const NOW = Date.parse("2026-11-14T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();

const goodTag = (target) => ({
  exists: true,
  objectType: "tag",
  targetSha: target,
  targetType: "commit",
  signature: { status: "good", principal: "owner@example.invalid", fingerprint: FP },
});

function fixture() {
  return {
    input: {
      sha: SHA,
      tag: "release-2026-11-14",
      previousTag: "release-2026-11-01",
      contentEvidence: {
        schema: 1,
        tool: "validate-quran-content",
        commit: SHA,
        generatedAt: hoursAgo(2),
        quran: {
          surahs: 114,
          ayahs: 6236,
          arabicCoverage: 6236,
          englishCoverage: 6236,
          failures: 0,
          skipped: 0,
        },
        kazimirski: { strict: true, failures: 0, skipped: 0 },
      },
    },
    policy: {
      schema: 1,
      repository: REPO,
      allowedSigners: [{ principal: "owner@example.invalid", fingerprint: FP }],
      trustedWorkflowBlobs: { [REQUIRED_CI.workflowPath]: [CI_BLOB] },
    },
    env: {},
    now: NOW,
    git: {
      commits: new Set([SHA, PREV]),
      main: SHA,
      head: SHA,
      status: [],
      tags: { "release-2026-11-14": goodTag(SHA), "release-2026-11-01": goodTag(PREV) },
      blobs: { [REQUIRED_CI.workflowPath]: CI_BLOB },
      files: {
        "src/lib/billing/entitlement.ts": "export const PREMIUM_ENFORCEMENT_ENABLED = false;\n",
        "src/lib/billing/checkoutFlag.ts":
          'return import.meta.env["VITE_BILLING_CHECKOUT_ENABLED"] === "true";\n',
      },
      isAncestor: (a, b) => a === b || (a === PREV && b === SHA),
      throwOn: null,
    },
    gh: {
      unavailable: false,
      routes: {
        main: { sha: SHA },
        checkRuns: {
          total_count: 1,
          check_runs: [
            {
              id: 555,
              name: "test",
              app: { id: 15368 },
              head_sha: SHA,
              status: "completed",
              conclusion: "success",
              completed_at: hoursAgo(1),
            },
          ],
        },
        status: { statuses: [] },
        job: {
          id: 555,
          head_sha: SHA,
          name: "test",
          status: "completed",
          conclusion: "success",
          run_id: 777,
          steps: REQUIRED_CI.steps.map((name) => ({ name, conclusion: "success" })),
        },
        run: {
          id: 777,
          head_sha: SHA,
          name: "QuranRoots CI",
          path: ".github/workflows/ci.yml",
          event: "push",
          head_branch: "main",
          status: "completed",
          conclusion: "success",
          repository: { full_name: REPO },
          head_repository: { full_name: REPO },
        },
      },
      after: {},
    },
  };
}

function buildGit(f) {
  const s = f.git;
  const calls = [];
  const rec = (n, v) => {
    calls.push(n);
    if (s.throwOn === n) throw new Error(`simulated git failure in ${n}`);
    return v;
  };
  return {
    calls,
    resolveCommit: (x) => rec("resolveCommit", s.commits.has(x) ? x : null),
    resolveRef: () => rec("resolveRef", s.main),
    headSha: () => rec("headSha", s.head),
    isAncestor: (a, b) => rec("isAncestor", s.isAncestor(a, b)),
    tagObjectId: (n) => rec("tagObjectId", s.tags[n] ? `obj-${n}-${s.tags[n].targetSha}` : null),
    inspectTag: (n) => rec("inspectTag", s.tags[n] ?? { exists: false }),
    statusEntries: () => rec("statusEntries", s.status),
    blobId: (_s, p) => rec("blobId", s.blobs[p] ?? null),
    showFile: (_s, p) => rec("showFile", s.files[p] ?? null),
    countCommits: () => rec("countCommits", 3),
    changedPaths: () =>
      rec("changedPaths", [
        "package-lock.json",
        ".github/workflows/ci.yml",
        "src/lib/billing/entitlement.ts",
        "scripts/quran-import/x.mjs",
        "src/routes/a.tsx",
      ]),
  };
}

function buildGh(f) {
  const calls = [];
  return {
    calls,
    async getJson(path) {
      calls.push(path);
      if (f.gh.unavailable)
        throw new Error(f.gh.unavailable === true ? "network down" : f.gh.unavailable);
      const r = f.gh.routes;
      let key;
      if (/\/commits\/main$/.test(path)) key = "main";
      else if (/\/check-runs\?/.test(path)) key = "checkRuns";
      else if (/\/status$/.test(path)) key = "status";
      else if (/\/actions\/jobs\//.test(path)) key = "job";
      else if (/\/actions\/runs\//.test(path)) key = "run";
      else throw new Error(`unexpected path ${path}`);
      f.gh.after[key]?.();
      return r[key];
    },
  };
}

async function assess(f) {
  const git = buildGit(f);
  const github = buildGh(f);
  const report = await assessRelease(f.input, {
    git,
    github,
    policy: f.policy,
    env: f.env,
    now: f.now,
  });
  return { report, git, github };
}
const status = (report, id) => report.results.find((r) => r.id === id)?.status;
function rejected(report, id) {
  assert.equal(report.assessment, "NOT ELIGIBLE", "must not be eligible");
  if (id)
    assert.notEqual(status(report, id), "pass", `${id} must not pass (was ${status(report, id)})`);
}

// ------------------------------------------------------------- T01..T06 commit

test("T01 missing commit SHA is rejected", async () => {
  const f = fixture();
  delete f.input.sha;
  const { report, git, github } = await assess(f);
  rejected(report, "input.valid");
  assert.equal(git.calls.length + github.calls.length, 0);
});
test("T02 malformed commit SHA is rejected", async () => {
  for (const bad of [
    "Z".repeat(40),
    "A1".repeat(20),
    "g1".repeat(20),
    `${"a".repeat(39)}-`,
    12345,
  ]) {
    const f = fixture();
    f.input.sha = bad;
    rejected((await assess(f)).report, "input.valid");
  }
});
test("T03 short SHA is rejected", async () => {
  const f = fixture();
  f.input.sha = SHA.slice(0, 12);
  const { report } = await assess(f);
  rejected(report, "input.valid");
  assert.match(report.results.find((r) => r.id === "input.valid").detail, /short SHA/);
});
test("T04 unknown commit is rejected", async () => {
  const f = fixture();
  f.git.commits = new Set([PREV]);
  rejected((await assess(f)).report, "commit.exists");
});
test("T05 commit not on trusted main is rejected", async () => {
  const f = fixture();
  f.git.isAncestor = (a, b) => (a === PREV && b === SHA ? true : a === b);
  f.git.main = OTHER;
  f.gh.routes.main.sha = OTHER;
  const { report } = await assess(f);
  rejected(report, "commit.on_trusted_main");
});
test("T06 candidate differing from required main HEAD is rejected", async () => {
  const f = fixture();
  f.git.main = OTHER;
  f.gh.routes.main.sha = OTHER;
  f.git.isAncestor = () => true;
  const { report } = await assess(f);
  rejected(report, "commit.is_main_tip");
  assert.equal(status(report, "commit.on_trusted_main"), "pass");
});

// ------------------------------------------------------------ T07..T10 tags

test("T07 unsigned tag is rejected", async () => {
  const f = fixture();
  f.git.tags["release-2026-11-14"] = { ...goodTag(SHA), signature: { status: "none" } };
  rejected((await assess(f)).report, "tag.signed_annotated");
});
test("T07b lightweight tag is rejected", async () => {
  const f = fixture();
  f.git.tags["release-2026-11-14"] = {
    exists: true,
    objectType: "commit",
    signature: { status: "none" },
  };
  rejected((await assess(f)).report, "tag.signed_annotated");
});
test("T08 invalid tag signature is rejected", async () => {
  const f = fixture();
  f.git.tags["release-2026-11-14"] = { ...goodTag(SHA), signature: { status: "bad" } };
  rejected((await assess(f)).report, "tag.signed_annotated");
});
test("T09 valid signature from an untrusted signer is rejected", async () => {
  const f = fixture();
  f.git.tags["release-2026-11-14"] = { ...goodTag(SHA), signature: { status: "untrusted" } };
  rejected((await assess(f)).report, "tag.trusted_signer");
  // Git-accepted key that the owner's explicit policy does not authorize:
  const g = fixture();
  g.git.tags["release-2026-11-14"] = {
    ...goodTag(SHA),
    signature: {
      status: "good",
      principal: "owner@example.invalid",
      fingerprint: `SHA256:${"x".repeat(43)}`,
    },
  };
  rejected((await assess(g)).report, "tag.trusted_signer");
  // Right key, wrong principal:
  const h = fixture();
  h.git.tags["release-2026-11-14"] = {
    ...goodTag(SHA),
    signature: { status: "good", principal: "mallory@example.invalid", fingerprint: FP },
  };
  rejected((await assess(h)).report, "tag.trusted_signer");
});
test("T10 signed tag targeting another commit is rejected", async () => {
  const f = fixture();
  f.git.tags["release-2026-11-14"] = goodTag(OTHER);
  rejected((await assess(f)).report, "tag.targets_candidate");
  const g = fixture();
  g.git.tags["release-2026-11-14"] = { ...goodTag(SHA), targetType: "tag" };
  rejected((await assess(g)).report, "tag.targets_candidate");
});

// ----------------------------------------------------------- T11..T16, T23, T29 CI

test("T11 missing CI evidence is rejected", async () => {
  const f = fixture();
  f.gh.routes.checkRuns = { total_count: 0, check_runs: [] };
  rejected((await assess(f)).report, "ci.check_run");
});
test("T12 failed required check is rejected", async () => {
  const f = fixture();
  f.gh.routes.checkRuns.check_runs[0].conclusion = "failure";
  rejected((await assess(f)).report, "ci.check_run");
});
test("T13 cancelled, timed-out and pending checks are rejected", async () => {
  for (const patch of [
    { conclusion: "cancelled" },
    { conclusion: "timed_out" },
    { status: "in_progress", conclusion: null },
    { status: "queued", conclusion: null },
  ]) {
    const f = fixture();
    Object.assign(f.gh.routes.checkRuns.check_runs[0], patch);
    rejected((await assess(f)).report, "ci.check_run");
  }
});
test("T14 skipped mandatory check or step is rejected", async () => {
  const f = fixture();
  f.gh.routes.checkRuns.check_runs[0].conclusion = "skipped";
  rejected((await assess(f)).report, "ci.check_run");
  for (const step of REQUIRED_CI.steps) {
    const g = fixture();
    g.gh.routes.job.steps.find((s) => s.name === step).conclusion = "skipped";
    rejected((await assess(g)).report, "ci.job_and_steps");
  }
  const h = fixture();
  h.gh.routes.job.steps = h.gh.routes.job.steps.filter(
    (s) => s.name !== "Quran content integrity validation",
  );
  rejected((await assess(h)).report, "ci.job_and_steps");
});
test("T15 successful check belonging to another SHA is rejected", async () => {
  const f = fixture();
  f.gh.routes.checkRuns.check_runs[0].head_sha = OTHER;
  rejected((await assess(f)).report, "ci.check_run");
  const g = fixture();
  g.gh.routes.run.head_sha = OTHER;
  rejected((await assess(g)).report, "ci.workflow_run");
  const h = fixture();
  h.gh.routes.job.head_sha = OTHER;
  rejected((await assess(h)).report, "ci.job_and_steps");
});
test("T16 ambiguous or spoofed check source is rejected", async () => {
  const spoofApp = fixture();
  spoofApp.gh.routes.checkRuns.check_runs[0].app = { id: 999 };
  rejected((await assess(spoofApp)).report, "ci.check_run");
  const dup = fixture();
  dup.gh.routes.checkRuns.check_runs.push({
    ...dup.gh.routes.checkRuns.check_runs[0],
    app: { id: 999 },
  });
  rejected((await assess(dup)).report, "ci.check_run");
  const two = fixture();
  two.gh.routes.checkRuns.check_runs.push({ ...two.gh.routes.checkRuns.check_runs[0], id: 556 });
  rejected((await assess(two)).report, "ci.check_run");
  const ctxSpoof = fixture();
  ctxSpoof.gh.routes.status = { statuses: [{ context: "test", state: "success" }] };
  rejected((await assess(ctxSpoof)).report, "ci.no_spoofed_status");
  const fork = fixture();
  fork.gh.routes.run.head_repository = { full_name: "attacker/quran-fluent" };
  rejected((await assess(fork)).report, "ci.workflow_run");
  const pr = fixture();
  pr.gh.routes.run.event = "pull_request";
  pr.gh.routes.run.head_branch = "feature";
  rejected((await assess(pr)).report, "ci.workflow_run");
  const otherWf = fixture();
  otherWf.gh.routes.run.path = ".github/workflows/evil.yml";
  rejected((await assess(otherWf)).report, "ci.workflow_run");
  const incomplete = fixture();
  incomplete.gh.routes.checkRuns.total_count = 250;
  rejected((await assess(incomplete)).report);
});
test("T23 GitHub API unavailable is rejected and reported as CI NOT VERIFIED", async () => {
  const f = fixture();
  f.gh.unavailable = true;
  const { report } = await assess(f);
  rejected(report, "ci.check_run");
  assert.equal(report.ciVerified, false);
  assert.match(formatReport(report), /CI NOT VERIFIED/);
  const g = fixture();
  const git = buildGit(g);
  const noClient = await assessRelease(g.input, {
    git,
    github: null,
    policy: g.policy,
    env: {},
    now: NOW,
  });
  rejected(noClient, "ci.check_run");
});
test("T29 stale or untrusted CI evidence is rejected", async () => {
  const stale = fixture();
  stale.gh.routes.checkRuns.check_runs[0].completed_at = hoursAgo(24 * 30);
  rejected((await assess(stale)).report, "ci.check_run");
  const future = fixture();
  future.gh.routes.checkRuns.check_runs[0].completed_at = hoursAgo(-48);
  rejected((await assess(future)).report, "ci.check_run");
  const edited = fixture();
  edited.git.blobs[REQUIRED_CI.workflowPath] = "e5".repeat(20);
  rejected((await assess(edited)).report, "ci.workflow_pinned");
  const noPin = fixture();
  noPin.policy.trustedWorkflowBlobs = {};
  rejected((await assess(noPin)).report, "ci.workflow_pinned");
  const moved = fixture();
  moved.gh.routes.main.sha = OTHER;
  rejected((await assess(moved)).report, "ci.main_ref_agrees");
});

// ------------------------------------------------------------ T17..T19, T24 repo

test("T17 dirty tracked working tree is rejected", async () => {
  const f = fixture();
  f.git.status = [" M src/lib/billing/entitlement.ts"];
  rejected((await assess(f)).report, "checkout.clean");
});
test("T18 untracked files in the release checkout are rejected", async () => {
  const f = fixture();
  f.git.status = ["?? .scratch-levelaudit.mjs"];
  rejected((await assess(f)).report, "checkout.clean");
});
test("T18b checkout HEAD different from the candidate is rejected", async () => {
  const f = fixture();
  f.git.head = OTHER;
  rejected((await assess(f)).report, "checkout.head_matches");
});
test("T19 missing previous-release baseline is rejected", async () => {
  const f = fixture();
  delete f.input.previousTag;
  rejected((await assess(f)).report, "input.valid");
  const g = fixture();
  delete g.git.tags["release-2026-11-01"];
  const r = (await assess(g)).report;
  rejected(r, "baseline.previous_release");
  assert.equal(r.summary, null);
  const h = fixture();
  h.git.tags["release-2026-11-01"] = { ...goodTag(PREV), signature: { status: "none" } };
  rejected((await assess(h)).report, "baseline.previous_release");
  const i = fixture();
  i.git.isAncestor = (a, b) => a === b;
  rejected((await assess(i)).report, "baseline.previous_release");
});
test("T24 a git verification error is rejected", async () => {
  for (const op of [
    "resolveCommit",
    "headSha",
    "isAncestor",
    "inspectTag",
    "statusEntries",
    "blobId",
    "showFile",
    "countCommits",
    "changedPaths",
  ]) {
    const f = fixture();
    f.git.throwOn = op;
    const { report } = await assess(f);
    rejected(report);
    assert.ok(
      report.results.some((r) => r.status === "fail" && /internal error/.test(r.detail)),
      `${op} failure must surface`,
    );
  }
});

// ------------------------------------------------------ T20..T22 policy evidence

test("T20 missing Quran content-integrity evidence is rejected", async () => {
  const f = fixture();
  f.input.contentEvidence = null;
  rejected((await assess(f)).report, "content.evidence");
  const edits = [
    (e) => {
      e.quran.surahs = 113;
    },
    (e) => {
      e.quran.ayahs = 6235;
    },
    (e) => {
      e.quran.arabicCoverage = 6000;
    },
    (e) => {
      e.quran.englishCoverage = 0;
    },
    (e) => {
      e.quran.failures = 1;
    },
    (e) => {
      e.quran.skipped = 2;
    },
    (e) => {
      e.commit = OTHER;
    },
    (e) => {
      e.generatedAt = hoursAgo(200);
    },
    (e) => {
      e.tool = "something-else";
    },
    (e) => {
      e.schema = 2;
    },
  ];
  for (const edit of edits) {
    const g = fixture();
    edit(g.input.contentEvidence);
    rejected((await assess(g)).report, "content.evidence");
  }
});
test("T21 missing or non-strict Kazimirski evidence is rejected when applicable", async () => {
  const f = fixture();
  delete f.input.contentEvidence.kazimirski;
  rejected((await assess(f)).report, "content.kazimirski");
  const g = fixture();
  g.input.contentEvidence.kazimirski.strict = false;
  rejected((await assess(g)).report, "content.kazimirski");
  const h = fixture();
  h.input.contentEvidence.kazimirski.skipped = 3;
  rejected((await assess(h)).report, "content.kazimirski");
  const na = fixture();
  delete na.input.contentEvidence.kazimirski;
  na.policy.kazimirskiIncluded = false;
  const r = (await assess(na)).report;
  assert.equal(status(r, "content.kazimirski"), "pass");
  assert.equal(r.assessment, "PASSED");
});
test("T22 missing billing safety evidence is rejected", async () => {
  const f = fixture();
  delete f.git.files["src/lib/billing/entitlement.ts"];
  rejected((await assess(f)).report, "billing.static");
  const g = fixture();
  g.git.files["src/lib/billing/entitlement.ts"] =
    "export const PREMIUM_ENFORCEMENT_ENABLED = true;\n";
  rejected((await assess(g)).report, "billing.static");
  const h = fixture();
  h.git.files["src/lib/billing/checkoutFlag.ts"] =
    'return import.meta.env["VITE_BILLING_CHECKOUT_ENABLED"] !== "false";\n';
  rejected((await assess(h)).report, "billing.static");
  const i = fixture();
  i.env = { VITE_BILLING_CHECKOUT_ENABLED: "true" };
  rejected((await assess(i)).report, "billing.environment");
  const j = fixture();
  j.env = { VITE_BILLING_CHECKOUT_ENABLED: "false" };
  assert.equal((await assess(j)).report.assessment, "PASSED");
});
test("T22b missing trust policy blocks everything", async () => {
  const f = fixture();
  f.policy = null;
  const { report } = await assess(f);
  rejected(report, "trust.policy");
  for (const id of MANDATORY_CHECKS.filter((x) => x !== "input.valid"))
    assert.notEqual(status(report, id), "pass", id);
});

// -------------------------------------------------------------- T25 happy path

test("T25 all required evidence valid and trusted: eligibility assessment passes (no deployment)", async () => {
  const f = fixture();
  const { report, git, github } = await assess(f);
  assert.equal(report.assessment, "PASSED");
  assert.equal(report.ciVerified, true);
  for (const id of MANDATORY_CHECKS) assert.equal(status(report, id), "pass", id);
  assert.match(report.notice, /does not approve, authorize or perform any deployment/);
  assert.match(formatReport(report), /does not approve, authorize or perform any deployment/);
  assert.equal(report.summary.commitCount, 3);
  assert.equal(report.summary.candidateSha, SHA);
  assert.ok(
    report.summary.sensitive.lockfiles.count >= 1 &&
      report.summary.sensitive.deployment_and_workflows.count >= 1,
  );
  assert.ok(
    report.summary.sensitive.billing_and_security.count >= 1 &&
      report.summary.sensitive.quran_content_and_translations.count >= 1,
  );
  assert.ok(
    github.calls.every((p) => p.startsWith(`/repos/${REPO}/`)),
    "only repo-scoped GETs",
  );
  assert.ok(git.calls.every((c) => !/push|fetch|checkout|deploy|createTag|signTag/i.test(c)));
});

// ------------------------------------------------------- T26 injection, T27 redaction

test("T26 shell-injection attempts in SHA or tag input are rejected without reaching git", async () => {
  const sentinel = join(tmpdir(), `qr003b-injection-${process.pid}`);
  const payloads = [
    `$(touch ${sentinel})`,
    `a1;touch ${sentinel}`,
    `a1\`touch ${sentinel}\``,
    `--upload-pack=touch ${sentinel}`,
    "../../etc/passwd",
    "v1\nv2",
    "-x",
    "v1 v2",
  ];
  for (const p of payloads) {
    const f = fixture();
    f.input.sha = p;
    let r = await assess(f);
    rejected(r.report, "input.valid");
    assert.equal(r.git.calls.length, 0);
    const g = fixture();
    g.input.tag = p;
    r = await assess(g);
    rejected(r.report, "input.valid");
    assert.equal(r.git.calls.length, 0);
    const h = fixture();
    h.input.previousTag = p;
    r = await assess(h);
    rejected(r.report, "input.valid");
    assert.equal(r.git.calls.length, 0);
  }
  assert.throws(() => parseArgs(["--sha", SHA, "--force"]), /unknown option/);
  assert.throws(() => parseArgs(["--skip-signature"]), /unknown option/);
  assert.throws(() => parseArgs(["--ignore-ci"]), /unknown option/);
  // Real adapter: hostile names are refused before any process is started.
  const spawned = [];
  const adapter = createGitAdapter({
    cwd: HERE,
    run: (args) => {
      spawned.push(args);
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  for (const bad of ["v1;touch x", "$(id)", "--x", "a b", "../x", ""])
    assert.throws(() => adapter.inspectTag(bad), /invalid tag name/);
  assert.equal(spawned.length, 0);
  // Only read-only subcommands are permitted at all.
  const sneaky = createGitAdapter({ cwd: HERE, run: () => ({ code: 0, stdout: "", stderr: "" }) });
  assert.equal(typeof sneaky.resolveCommit, "function");
  assert.equal(
    Object.keys(sneaky).some((k) =>
      /push|fetch|checkout|deploy|createTag|signTag|writeRef/i.test(k),
    ),
    false,
  );
});
test("T27 secret-like data in diagnostics is redacted", async () => {
  const ghp = "ghp_" + "A1b2C3d4E5".repeat(4);
  const secrets = [
    ghp,
    ["sk_live_", "abcdefghijklmnop1234"].join(""),
    ["whsec_", "abcdefghijklmnopqr"].join(""),
    ["cfut_", "abcdefghijklmnop1234"].join(""),
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop",
    "hunter2hunter2",
  ];
  const f = fixture();
  f.gh.unavailable = `request failed: Authorization: Bearer ${ghp} CLOUDFLARE_API_TOKEN=${secrets[3]} PASSWORD=hunter2hunter2 ${secrets[1]} ${secrets[2]} ${secrets[4]}`;
  const { report } = await assess(f);
  const text = JSON.stringify(report) + formatReport(report);
  for (const s of secrets) assert.equal(text.includes(s), false, `leaked ${s.slice(0, 8)}...`);
  assert.match(text, /REDACTED/);
  const k = fixture();
  k.git.status = [`?? ${"x".repeat(5)}\u001b[31mevil\u0007`];
  assert.equal(JSON.stringify((await assess(k)).report).includes("\u001b"), false);
  assert.equal(redact("x".repeat(5000)).length < 500, true);
  assert.equal(
    redact("-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----"),
    "[REDACTED]",
  );
});

// -------------------------------------------------------------- T28 TOCTOU

test("T28 trusted reference or candidate state changing during verification is rejected", async () => {
  const f = fixture();
  f.gh.after.main = () => {
    f.git.main = OTHER;
  };
  rejected((await assess(f)).report, "state.stable");
  const g = fixture();
  g.gh.after.checkRuns = () => {
    g.git.head = OTHER;
  };
  rejected((await assess(g)).report, "state.stable");
  const h = fixture();
  h.gh.after.job = () => {
    h.git.tags["release-2026-11-14"] = goodTag(OTHER);
  };
  rejected((await assess(h)).report, "state.stable");
});

// ------------------------------------------------------------ T30 offline guarantees

test("T30 offline mode performs no network, process or deployment operation", async () => {
  const realFetch = globalThis.fetch;
  let touched = 0;
  globalThis.fetch = () => {
    touched++;
    throw new Error("network attempted");
  };
  try {
    const { report } = await assess(fixture());
    assert.equal(report.assessment, "PASSED");
    assert.equal(touched, 0, "offline assessment must not call fetch");
  } finally {
    globalThis.fetch = realFetch;
  }
  const src = readFileSync(join(HERE, "verify-release.mjs"), "utf8");
  assert.doesNotMatch(src, /shell:\s*true/);
  assert.doesNotMatch(src, /(?<![.\w])(exec|execSync|execFile|execFileSync|fork)\s*\(/);
  assert.doesNotMatch(src, /node:(net|http|https|dgram|tls)/);
  // Path *classification* may mention deployment config file names; execution may not.
  assert.doesNotMatch(
    src,
    /\bnpx\b|nitro deploy|wrangler (deploy|secret|publish|rollback)|api\.cloudflare|CLOUDFLARE_|stripe|\beval\s*\(|new Function/i,
  );
  assert.doesNotMatch(src, /method:\s*["'](POST|PUT|PATCH|DELETE)/i);
  assert.match(src, /method:\s*"GET"/);
  // The client refuses non-GET targets and unexpected paths even if asked.
  const calls = [];
  const client = createGitHubClient({
    fetchImpl: async (url, init) => {
      calls.push([url, init.method, init.redirect]);
      return { ok: true, text: async () => "{}" };
    },
  });
  await client.getJson(`/repos/${REPO}/commits/main`);
  assert.deepEqual(calls[0], [`https://api.github.com/repos/${REPO}/commits/main`, "GET", "error"]);
  await assert.rejects(() => client.getJson("/user/repos"), /unexpected API path/);
  await assert.rejects(
    () => client.getJson("https://evil.example/repos/a/b/c"),
    /unexpected API path/,
  );
});

test("fail-closed completeness: a result set missing a mandatory check cannot pass", async () => {
  const f = fixture();
  f.git.throwOn = "headSha";
  const { report } = await assess(f);
  assert.equal(report.assessment, "NOT ELIGIBLE");
  assert.ok(MANDATORY_CHECKS.length >= 23);
});

// =========================================================== real git suites

function sh(cmd, args, cwd, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.invalid",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.invalid",
      ...env,
    },
  });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}
const haveTools =
  spawnSync("ssh-keygen", ["-?"], { encoding: "utf8" }).error === undefined &&
  spawnSync("git", ["--version"]).status === 0;

function realRepo() {
  const root = mkdtempSync(join(tmpdir(), "qr003b-real-"));
  const repo = join(root, "repo");
  const keys = join(root, "keys");
  mkdirSync(repo);
  mkdirSync(keys, { mode: 0o700 });
  sh("git", ["init", "-q", "-b", "main", repo], root);
  sh(
    "ssh-keygen",
    ["-q", "-t", "ed25519", "-N", "", "-C", "owner@example.invalid", "-f", join(keys, "owner")],
    root,
  );
  sh(
    "ssh-keygen",
    ["-q", "-t", "ed25519", "-N", "", "-C", "mallory@example.invalid", "-f", join(keys, "mallory")],
    root,
  );
  const pub = readFileSync(join(keys, "owner.pub"), "utf8").trim().split(" ");
  const allowed = join(keys, "allowed_signers");
  writeFileSync(allowed, `owner@example.invalid ${pub[0]} ${pub[1]}\n`);
  chmodSync(allowed, 0o600);
  const fingerprint = sh("ssh-keygen", ["-lf", join(keys, "owner.pub")], root).split(" ")[1];
  const g = (...a) => sh("git", a, repo);
  const sign = (name, key, msg = "release") =>
    g(
      "-c",
      "gpg.format=ssh",
      "-c",
      `user.signingkey=${join(keys, key + ".pub")}`,
      "tag",
      "-s",
      "-m",
      msg,
      name,
    );
  return {
    root,
    repo,
    keys,
    allowed,
    fingerprint,
    g,
    sign,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test(
  "REAL-1 real SSH-signed tags: good, untrusted key, unsigned, lightweight, tampered",
  { skip: !haveTools && "git/ssh-keygen unavailable" },
  () => {
    const R = realRepo();
    try {
      writeFileSync(join(R.repo, "f"), "x");
      R.g("add", "f");
      R.g("commit", "-qm", "c1");
      const c1 = R.g("rev-parse", "HEAD");
      R.sign("v-good", "owner");
      R.sign("v-mallory", "mallory");
      R.g("tag", "-a", "-m", "plain", "v-unsigned");
      R.g("tag", "v-light");
      const a = createGitAdapter({ cwd: R.repo, allowedSignersFile: R.allowed });
      const good = a.inspectTag("v-good");
      assert.equal(good.signature.status, "good");
      assert.equal(good.signature.fingerprint, R.fingerprint);
      assert.equal(good.signature.principal, "owner@example.invalid");
      assert.equal(good.targetSha, c1);
      assert.equal(good.targetType, "commit");
      assert.equal(a.inspectTag("v-mallory").signature.status, "untrusted");
      assert.equal(a.inspectTag("v-unsigned").signature.status, "none");
      assert.equal(a.inspectTag("v-light").objectType, "commit");
      assert.equal(a.inspectTag("v-missing").exists, false);
      assert.equal(
        createGitAdapter({ cwd: R.repo }).inspectTag("v-good").signature.status,
        "unconfigured",
      );
      // Tamper with the signed message but keep the signature: must no longer verify.
      const id = R.g("rev-parse", "refs/tags/v-good");
      const body = R.g("cat-file", "tag", id).replace("\nrelease\n", "\ntampered\n");
      const forged = spawnSync("git", ["hash-object", "-t", "tag", "-w", "--stdin"], {
        cwd: R.repo,
        input: body + "\n",
        encoding: "utf8",
        env: { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: "/dev/null" },
      }).stdout.trim();
      R.g("update-ref", "refs/tags/v-forged", forged);
      assert.equal(a.inspectTag("v-forged").signature.status, "bad");
    } finally {
      R.cleanup();
    }
  },
);

test(
  "REAL-2 end to end with real git and real signatures (GitHub still faked): PASSED, then rejected on a dirty tree",
  { skip: !haveTools && "git/ssh-keygen unavailable" },
  async () => {
    const R = realRepo();
    try {
      const put = (p, c) => {
        mkdirSync(dirname(join(R.repo, p)), { recursive: true });
        writeFileSync(join(R.repo, p), c);
      };
      put("src/lib/billing/entitlement.ts", "export const PREMIUM_ENFORCEMENT_ENABLED = false;\n");
      put(
        "src/lib/billing/checkoutFlag.ts",
        'return import.meta.env["VITE_BILLING_CHECKOUT_ENABLED"] === "true";\n',
      );
      put(".github/workflows/ci.yml", "name: QuranRoots CI\n");
      R.g("add", "-A");
      R.g("commit", "-qm", "base");
      const prev = R.g("rev-parse", "HEAD");
      R.sign("release-prev", "owner");
      put("package-lock.json", "{}\n");
      R.g("add", "-A");
      R.g("commit", "-qm", "next");
      const sha = R.g("rev-parse", "HEAD");
      R.sign("release-next", "owner");
      R.g("update-ref", "refs/remotes/origin/main", sha);
      const blob = R.g("rev-parse", `${sha}:.github/workflows/ci.yml`);
      const f = fixture();
      f.input.sha = sha;
      f.input.tag = "release-next";
      f.input.previousTag = "release-prev";
      f.input.contentEvidence.commit = sha;
      f.policy.allowedSigners = [
        { principal: "owner@example.invalid", fingerprint: R.fingerprint },
      ];
      f.policy.trustedWorkflowBlobs = { [REQUIRED_CI.workflowPath]: [blob] };
      // Retarget the faked GitHub evidence to this throwaway repo's real SHA.
      f.gh.routes.main.sha = sha;
      f.gh.routes.checkRuns.check_runs[0].head_sha = sha;
      f.gh.routes.job.head_sha = sha;
      f.gh.routes.run.head_sha = sha;
      const git = createGitAdapter({ cwd: R.repo, allowedSignersFile: R.allowed });
      const github = buildGh(f);
      const run = () =>
        assessRelease(f.input, { git, github, policy: f.policy, env: {}, now: NOW });
      const ok = await run();
      assert.equal(ok.assessment, "PASSED", formatReport(ok));
      assert.equal(ok.summary.previousSha, prev);
      assert.equal(ok.summary.commitCount, 1);
      assert.deepEqual(ok.summary.sensitive.lockfiles.files, ["package-lock.json"]);
      writeFileSync(join(R.repo, "stray.txt"), "x");
      const dirty = await run();
      rejected(dirty, "checkout.clean");
      rmSync(join(R.repo, "stray.txt"));
      writeFileSync(join(R.repo, "f2"), "x");
      R.g("add", "f2");
      R.g("commit", "-qm", "moves HEAD");
      rejected(await run(), "checkout.head_matches");
    } finally {
      R.cleanup();
    }
  },
);

test("REAL-3 trust policy must live outside the repository, be private, and pin the CI workflow", () => {
  const root = mkdtempSync(join(tmpdir(), "qr003b-pol-"));
  try {
    const repo = join(root, "repo");
    mkdirSync(repo);
    const out = join(root, "owner");
    mkdirSync(out);
    const signers = join(out, "allowed");
    writeFileSync(signers, "x\n");
    chmodSync(signers, 0o600);
    const body = (over = {}) =>
      JSON.stringify({
        schema: 1,
        repository: REPO,
        allowedSigners: [{ principal: "o@example.invalid", fingerprint: FP }],
        allowedSignersFile: signers,
        trustedWorkflowBlobs: { [REQUIRED_CI.workflowPath]: [CI_BLOB] },
        ...over,
      });
    const write = (dir, text, mode = 0o600) => {
      const p = join(dir, "policy.json");
      writeFileSync(p, text);
      chmodSync(p, mode);
      return p;
    };
    assert.equal(loadTrustPolicy(write(out, body()), repo).repository, REPO);
    assert.throws(() => loadTrustPolicy(write(repo, body()), repo), /outside the repository/);
    assert.throws(() => loadTrustPolicy(write(out, body(), 0o666), repo), /writable/);
    assert.throws(
      () => loadTrustPolicy(write(out, body({ trustedWorkflowBlobs: {} })), repo),
      /pin the CI workflow/,
    );
    assert.throws(
      () => loadTrustPolicy(write(out, body({ allowedSigners: [] })), repo),
      /no allowed signers/,
    );
    assert.throws(
      () =>
        loadTrustPolicy(
          write(out, body({ allowedSigners: [{ principal: "x", fingerprint: "SHA1:abc" }] })),
          repo,
        ),
      /invalid signer/,
    );
    assert.throws(() => loadTrustPolicy("relative/policy.json", repo), /absolute/);
    assert.throws(() => loadTrustPolicy(join(out, "missing.json"), repo));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

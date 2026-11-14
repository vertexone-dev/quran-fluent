#!/usr/bin/env node
/**
 * QR-SEC-003B -- release ELIGIBILITY verifier (prototype, dry-run only).
 *
 * This tool answers one question: "does this exact commit satisfy every
 * release precondition we can check?". It NEVER deploys, tags, pushes,
 * fetches, dispatches workflows, or touches any credential or hosting
 * account. A PASSED result is not a deployment approval; the owner's
 * separate, explicit decision is still required (docs/RELEASE-PROCESS.md).
 *
 * Fail-closed contract: the only way to PASSED is for every mandatory check
 * to report "pass". Errors, unavailable dependencies, unverifiable evidence,
 * missing trust configuration and checks that did not run all produce
 * NOT ELIGIBLE. There is deliberately no skip / ignore / force option.
 *
 * Read-only effects only: allow-listed local `git` queries (argument arrays,
 * no shell) and GET requests to api.github.com.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------- constants

export const SHA_RE = /^[0-9a-f]{40}$/;
const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const FINGERPRINT_RE = /^SHA256:[A-Za-z0-9+/]{43}$/;

export const TRUSTED_MAIN_REF = "refs/remotes/origin/main";

/** CI contract, taken from .github/workflows/ci.yml (workflow "QuranRoots CI", job `test`). */
export const REQUIRED_CI = Object.freeze({
  workflowName: "QuranRoots CI",
  workflowPath: ".github/workflows/ci.yml",
  checkName: "test",
  githubActionsAppId: 15368,
  event: "push",
  branch: "main",
  steps: Object.freeze([
    "Lint",
    "Unit tests",
    "Quran content integrity validation",
    "Build",
    "Verify E2E target is localhost (fail-fast)",
    "Run E2E tests",
  ]),
});

const EXPECTED = Object.freeze({ surahs: 114, ayahs: 6236 });
const BILLING_FILES = Object.freeze({
  entitlement: "src/lib/billing/entitlement.ts",
  checkoutFlag: "src/lib/billing/checkoutFlag.ts",
});

/** Every one of these must be present AND "pass" for the assessment to pass. */
export const MANDATORY_CHECKS = Object.freeze([
  "input.valid",
  "trust.policy",
  "commit.exists",
  "commit.on_trusted_main",
  "commit.is_main_tip",
  "checkout.head_matches",
  "checkout.clean",
  "tag.signed_annotated",
  "tag.trusted_signer",
  "tag.targets_candidate",
  "baseline.previous_release",
  "ci.main_ref_agrees",
  "ci.check_run",
  "ci.no_spoofed_status",
  "ci.job_and_steps",
  "ci.workflow_run",
  "ci.workflow_pinned",
  "content.evidence",
  "content.kazimirski",
  "billing.static",
  "billing.environment",
  "summary.generated",
  "state.stable",
]);

const DIAGNOSTIC_LIMIT = 400;
const LIST_LIMIT = 100;

// ------------------------------------------------------------------ helpers

export function redact(value) {
  let s = typeof value === "string" ? value : String(value);
  s = s.replace(
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
    "[REDACTED]",
  );
  s = s.replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[REDACTED]");
  s = s.replace(
    /\b(?:sk_(?:live|test)_|rk_(?:live|test)_|whsec_|cfut_)[A-Za-z0-9_]{6,}/g,
    "[REDACTED]",
  );
  s = s.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, "[REDACTED]");
  s = s.replace(/\b(Bearer|Basic|token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [REDACTED]");
  s = s.replace(
    /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*[=:]\s*\S+/gi,
    "$1=[REDACTED]",
  );
  s = s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "?");
  return s.length > DIAGNOSTIC_LIMIT ? `${s.slice(0, DIAGNOSTIC_LIMIT)}...[truncated]` : s;
}

const pass = (id, detail = "ok") => ({ id, status: "pass", detail });
const fail = (id, detail) => ({ id, status: "fail", detail });
const notVerified = (id, detail) => ({ id, status: "not_verified", detail });

function ageHours(iso, now) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (now - t) / 3_600_000;
}

/** Runs a check; any thrown error becomes a failure (never a pass). */
async function guard(ids, fn) {
  try {
    const out = await fn();
    return Array.isArray(out) ? out : [out];
  } catch (err) {
    const msg = redact(err && err.message ? err.message : String(err));
    return ids.map((id) => fail(id, `internal error: ${msg}`));
  }
}

// ---------------------------------------------------------- input validation

export function validateInput(input) {
  const problems = [];
  const sha = input?.sha;
  if (sha === undefined || sha === null || sha === "")
    problems.push("candidate commit SHA is missing");
  else if (typeof sha !== "string") problems.push("candidate commit SHA must be a string");
  else if (sha.length < 40 && /^[0-9a-f]+$/.test(sha))
    problems.push("short SHA rejected: a full 40-character SHA is required");
  else if (!SHA_RE.test(sha))
    problems.push("malformed SHA: must be exactly 40 lowercase hexadecimal characters");
  for (const [key, label] of [
    ["tag", "release tag"],
    ["previousTag", "previous release tag"],
  ]) {
    const v = input?.[key];
    if (v === undefined || v === null || v === "") problems.push(`${label} is missing`);
    else if (
      typeof v !== "string" ||
      !TAG_RE.test(v) ||
      v.includes("..") ||
      v.endsWith(".") ||
      v.endsWith(".lock")
    )
      problems.push(`${label} has an invalid name`);
  }
  if (input?.tag && input?.previousTag && input.tag === input.previousTag)
    problems.push("release tag and previous release tag must differ");
  return problems;
}

// ------------------------------------------------------------- change summary

const CATEGORIES = [
  [
    "lockfiles",
    /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/,
  ],
  [
    "deployment_and_workflows",
    /^(\.github\/|wrangler\.jsonc?$|DEPLOYMENT\.md$|scripts\/release\/|docs\/RELEASE-PROCESS\.md$)/,
  ],
  [
    "quran_content_and_translations",
    /^(scripts\/quran-import\/|scripts\/validate-quran-content\.mjs$|supabase\/migrations\/|src\/lib\/quran|src\/lib\/content)/,
  ],
  [
    "billing_and_security",
    /^(src\/lib\/billing\/|src\/server|src\/integrations\/supabase\/|src\/lib\/auth|supabase\/functions\/)/,
  ],
];

export function summarizeChanges({
  previousTag,
  previousSha,
  candidateTag,
  candidateSha,
  commitCount,
  paths,
}) {
  const buckets = Object.fromEntries(CATEGORIES.map(([name]) => [name, []]));
  for (const p of paths) for (const [name, re] of CATEGORIES) if (re.test(p)) buckets[name].push(p);
  return {
    previousRelease: previousTag,
    previousSha,
    candidateRelease: candidateTag,
    candidateSha,
    commitCount,
    changedFileCount: paths.length,
    changedFiles: paths.slice(0, LIST_LIMIT).map(redact),
    changedFilesTruncated: paths.length > LIST_LIMIT,
    sensitive: Object.fromEntries(
      Object.entries(buckets).map(([k, v]) => [
        k,
        { count: v.length, files: v.slice(0, LIST_LIMIT).map(redact) },
      ]),
    ),
    note: "Informational only. This summary is not evidence that a human reviewed or approved these changes.",
  };
}

// ----------------------------------------------------------------- the checks

function checkCommit(ctx) {
  const { git, input } = ctx;
  const out = [];
  const found = git.resolveCommit(input.sha);
  if (found !== input.sha) {
    out.push(fail("commit.exists", "commit does not exist in this repository"));
    return {
      out: [
        ...out,
        fail("commit.on_trusted_main", "cannot be evaluated: commit missing"),
        fail("commit.is_main_tip", "cannot be evaluated: commit missing"),
      ],
    };
  }
  out.push(pass("commit.exists"));
  const main = git.resolveRef(TRUSTED_MAIN_REF);
  if (!main) {
    return {
      out: [
        ...out,
        fail("commit.on_trusted_main", `trusted reference ${TRUSTED_MAIN_REF} cannot be resolved`),
        fail("commit.is_main_tip", `trusted reference ${TRUSTED_MAIN_REF} cannot be resolved`),
      ],
      main: null,
    };
  }
  out.push(
    git.isAncestor(input.sha, main)
      ? pass("commit.on_trusted_main", `reachable from ${TRUSTED_MAIN_REF}`)
      : fail("commit.on_trusted_main", `commit is not reachable from ${TRUSTED_MAIN_REF}`),
  );
  out.push(
    input.sha === main
      ? pass("commit.is_main_tip", "candidate equals the current trusted main tip")
      : fail(
          "commit.is_main_tip",
          `release policy requires the candidate to equal ${TRUSTED_MAIN_REF} (${main.slice(0, 12)})`,
        ),
  );
  return { out, main };
}

function checkCheckout(ctx) {
  const { git, input } = ctx;
  const out = [];
  const head = git.headSha();
  out.push(
    head === input.sha
      ? pass("checkout.head_matches")
      : fail("checkout.head_matches", "release checkout HEAD is not the candidate commit"),
  );
  const entries = git.statusEntries();
  if (entries.length === 0) out.push(pass("checkout.clean"));
  else {
    const untracked = entries.filter((e) => e.startsWith("?? ")).length;
    out.push(
      fail(
        "checkout.clean",
        `${entries.length} unclean entr${entries.length === 1 ? "y" : "ies"} (${untracked} untracked, ${entries.length - untracked} tracked changes): ${entries
          .slice(0, 5)
          .map(redact)
          .join("; ")}`,
      ),
    );
  }
  return out;
}

/** Evaluates one tag; reused for the candidate tag and the previous-release baseline. */
function evaluateTag(ctx, name, { label }) {
  const { git, policy } = ctx;
  const info = git.inspectTag(name);
  const res = { signed: null, signer: null, target: null, info };
  if (!info.exists) {
    res.signed = fail(`${label}.signed`, `tag ${name} does not exist`);
    res.signer = fail(`${label}.signer`, "cannot be evaluated: tag missing");
    return res;
  }
  if (info.objectType !== "tag") {
    res.signed = fail(`${label}.signed`, `tag ${name} is lightweight, not an annotated signed tag`);
  } else if (info.signature.status === "none") {
    res.signed = fail(`${label}.signed`, `tag ${name} is unsigned`);
  } else if (info.signature.status === "bad") {
    res.signed = fail(`${label}.signed`, `tag ${name} has an invalid signature`);
  } else if (info.signature.status === "unconfigured") {
    res.signed = notVerified(
      `${label}.signed`,
      "no allowed-signers file configured, signature cannot be verified",
    );
  } else if (info.signature.status === "untrusted") {
    res.signed = pass(
      `${label}.signed`,
      "cryptographically well-formed, but signer is not in the allowed-signers file",
    );
  } else {
    res.signed = pass(`${label}.signed`, "annotated tag with a good signature");
  }

  const sig = info.signature;
  if (sig.status !== "good") {
    res.signer = fail(`${label}.signer`, `signer not trusted (signature status: ${sig.status})`);
  } else {
    const match = (policy?.allowedSigners ?? []).some(
      (s) => s.fingerprint === sig.fingerprint && (!sig.principal || s.principal === sig.principal),
    );
    res.signer = match
      ? pass(`${label}.signer`, `signed by trusted key ${sig.fingerprint}`)
      : fail(
          `${label}.signer`,
          "valid signature, but the signer is not authorized by the trust policy",
        );
  }
  res.target = info.targetType === "commit" ? info.targetSha : null;
  return res;
}

function checkTags(ctx) {
  const { input } = ctx;
  const cand = evaluateTag(ctx, input.tag, { label: "tag" });
  const out = [];
  out.push(
    cand.signed.id === "tag.signed" ? { ...cand.signed, id: "tag.signed_annotated" } : cand.signed,
    { ...cand.signer, id: "tag.trusted_signer" },
  );
  if (!cand.info.exists)
    out.push(fail("tag.targets_candidate", "cannot be evaluated: tag missing"));
  else if (cand.target === null)
    out.push(fail("tag.targets_candidate", "tag does not directly point to a commit"));
  else
    out.push(
      cand.target === input.sha
        ? pass("tag.targets_candidate")
        : fail(
            "tag.targets_candidate",
            `tag points at ${cand.target.slice(0, 12)}, not the candidate`,
          ),
    );
  return { out, cand };
}

function checkBaseline(ctx) {
  const { git, input } = ctx;
  const prev = evaluateTag(ctx, input.previousTag, { label: "previous" });
  const problems = [];
  if (!prev.info.exists) problems.push(`previous release tag ${input.previousTag} does not exist`);
  else {
    if (prev.signed.status !== "pass") problems.push(`previous release tag: ${prev.signed.detail}`);
    if (prev.signer.status !== "pass") problems.push(`previous release tag: ${prev.signer.detail}`);
    if (prev.target === null)
      problems.push("previous release tag does not directly point to a commit");
    else if (prev.target === input.sha)
      problems.push("previous release equals the candidate; there is nothing to release");
    else if (!git.isAncestor(prev.target, input.sha))
      problems.push("previous release is not an ancestor of the candidate");
  }
  if (problems.length)
    return {
      out: [fail("baseline.previous_release", problems.join("; "))],
      prev: null,
      summary: [fail("summary.generated", "no trusted baseline to summarize against")],
    };

  const count = git.countCommits(prev.target, input.sha);
  const paths = git.changedPaths(prev.target, input.sha);
  const summary = summarizeChanges({
    previousTag: input.previousTag,
    previousSha: prev.target,
    candidateTag: input.tag,
    candidateSha: input.sha,
    commitCount: count,
    paths,
  });
  return {
    out: [
      pass(
        "baseline.previous_release",
        `trusted baseline ${input.previousTag} -> ${prev.target.slice(0, 12)}`,
      ),
    ],
    prev,
    summary: [pass("summary.generated", `${count} commit(s), ${paths.length} changed file(s)`)],
    report: summary,
  };
}

async function checkCi(ctx, mainSha) {
  const { github, git, input, policy, now } = ctx;
  const repo = policy.repository;
  const ids = [
    "ci.main_ref_agrees",
    "ci.check_run",
    "ci.no_spoofed_status",
    "ci.job_and_steps",
    "ci.workflow_run",
    "ci.workflow_pinned",
  ];
  const nv = (why) => ids.map((id) => notVerified(id, `CI NOT VERIFIED: ${why}`));
  if (!github) return { out: nv("no GitHub client available") };

  let api;
  try {
    api = await github.getJson(`/repos/${repo}/commits/main`);
  } catch (err) {
    return { out: nv(`GitHub API unavailable (${redact(err?.message ?? err)})`) };
  }
  const out = [];
  if (!SHA_RE.test(api?.sha ?? "")) return { out: nv("GitHub API returned no usable main SHA") };
  out.push(
    mainSha && api.sha === mainSha
      ? pass("ci.main_ref_agrees", "GitHub main tip equals the local trusted main reference")
      : fail(
          "ci.main_ref_agrees",
          "GitHub main tip differs from the local trusted reference (stale or moved)",
        ),
  );

  const maxAge = Math.min(policy.ci?.maxAgeHours ?? 168, 720);
  const get = async (path) => {
    try {
      return await github.getJson(path);
    } catch (err) {
      throw new Error(`CI NOT VERIFIED: GitHub API unavailable (${redact(err?.message ?? err)})`);
    }
  };

  // 1. the required check run
  const runs = await get(`/repos/${repo}/commits/${input.sha}/check-runs?per_page=100`);
  const all = Array.isArray(runs?.check_runs) ? runs.check_runs : null;
  if (!all) throw new Error("unexpected check-runs response shape");
  if (typeof runs.total_count === "number" && runs.total_count > all.length)
    return { out: [...out, ...nv("check-run listing is incomplete (ambiguous)").slice(1)] };
  const named = all.filter((c) => c?.name === REQUIRED_CI.checkName);
  let checkRun = null;
  if (named.length === 0)
    out.push(
      fail("ci.check_run", `no check named "${REQUIRED_CI.checkName}" found for this exact commit`),
    );
  else if (named.some((c) => c?.app?.id !== REQUIRED_CI.githubActionsAppId))
    out.push(
      fail(
        "ci.check_run",
        `a check named "${REQUIRED_CI.checkName}" was reported by an app other than GitHub Actions (possible spoof)`,
      ),
    );
  else if (named.length > 1)
    out.push(fail("ci.check_run", "ambiguous: more than one required check run for this commit"));
  else {
    const c = named[0];
    const age = ageHours(c.completed_at, now);
    if (c.head_sha !== input.sha)
      out.push(fail("ci.check_run", "check run belongs to a different commit"));
    else if (c.status !== "completed")
      out.push(fail("ci.check_run", `check run not finished (status: ${redact(c.status)})`));
    else if (c.conclusion !== "success")
      out.push(
        fail("ci.check_run", `check run conclusion is "${redact(c.conclusion)}", not success`),
      );
    else if (age === null || age > maxAge || age < -0.1)
      out.push(fail("ci.check_run", "check run evidence is stale or has an invalid timestamp"));
    else {
      checkRun = c;
      out.push(pass("ci.check_run", "required check completed successfully for the exact commit"));
    }
  }

  // 2. no status context impersonating the check
  const status = await get(`/repos/${repo}/commits/${input.sha}/status`);
  const spoof = (Array.isArray(status?.statuses) ? status.statuses : []).filter(
    (s) => s?.context === REQUIRED_CI.checkName,
  );
  out.push(
    spoof.length
      ? fail(
          "ci.no_spoofed_status",
          `a commit status named "${REQUIRED_CI.checkName}" exists; impersonation cannot be ruled out`,
        )
      : pass("ci.no_spoofed_status"),
  );

  // 3. job + 4. run + steps
  if (!checkRun) {
    out.push(
      fail("ci.job_and_steps", "no valid check run to trace to a job"),
      fail("ci.workflow_run", "no valid check run to trace to a workflow run"),
    );
  } else {
    const job = await get(`/repos/${repo}/actions/jobs/${checkRun.id}`);
    const jobProblems = [];
    if (job?.id !== checkRun.id) jobProblems.push("job id differs from check run id");
    if (job?.head_sha !== input.sha) jobProblems.push("job belongs to a different commit");
    if (job?.name !== REQUIRED_CI.checkName) jobProblems.push("job name mismatch");
    if (job?.status !== "completed" || job?.conclusion !== "success")
      jobProblems.push("job did not conclude with success");
    const steps = Array.isArray(job?.steps) ? job.steps : [];
    for (const name of REQUIRED_CI.steps) {
      const matches = steps.filter((s) => s?.name === name);
      if (matches.length !== 1) jobProblems.push(`required step "${name}" missing or ambiguous`);
      else if (matches[0].conclusion !== "success")
        jobProblems.push(
          `required step "${name}" ${redact(matches[0].conclusion ?? "did not run")}`,
        );
    }
    out.push(
      jobProblems.length
        ? fail("ci.job_and_steps", jobProblems.join("; "))
        : pass("ci.job_and_steps", `${REQUIRED_CI.steps.length} mandatory steps succeeded`),
    );

    const wf = await get(`/repos/${repo}/actions/runs/${job?.run_id}`);
    const wfProblems = [];
    if (wf?.id !== job?.run_id) wfProblems.push("run id mismatch");
    if (wf?.head_sha !== input.sha) wfProblems.push("run belongs to a different commit");
    if (wf?.name !== REQUIRED_CI.workflowName) wfProblems.push("unexpected workflow name");
    const p = String(wf?.path ?? "");
    if (
      p !== REQUIRED_CI.workflowPath &&
      p !== `${REQUIRED_CI.workflowPath}@refs/heads/${REQUIRED_CI.branch}`
    )
      wfProblems.push("unexpected workflow file");
    if (wf?.event !== REQUIRED_CI.event || wf?.head_branch !== REQUIRED_CI.branch)
      wfProblems.push(`run was not a ${REQUIRED_CI.event} to ${REQUIRED_CI.branch}`);
    if (wf?.repository?.full_name !== repo || wf?.head_repository?.full_name !== repo)
      wfProblems.push("run does not originate from the trusted repository");
    if (wf?.status !== "completed" || wf?.conclusion !== "success")
      wfProblems.push("workflow run did not conclude with success");
    out.push(
      wfProblems.length
        ? fail("ci.workflow_run", wfProblems.join("; "))
        : pass("ci.workflow_run", "push-to-main run of the expected workflow"),
    );
  }

  // 5. the workflow that produced the evidence must be the owner-pinned version
  const pins = policy.trustedWorkflowBlobs?.[REQUIRED_CI.workflowPath];
  if (!Array.isArray(pins) || pins.length === 0)
    out.push(
      fail(
        "ci.workflow_pinned",
        "trust policy pins no blob for the CI workflow; CI evidence cannot be trusted",
      ),
    );
  else {
    const blob = git.blobId(input.sha, REQUIRED_CI.workflowPath);
    out.push(
      blob && pins.includes(blob)
        ? pass("ci.workflow_pinned", "CI workflow file matches the owner-pinned version")
        : fail(
            "ci.workflow_pinned",
            "CI workflow file at the candidate differs from the owner-pinned version; review it and update the policy",
          ),
    );
  }
  return { out };
}

function checkContent(ctx) {
  const { input, policy, now } = ctx;
  const ev = input.contentEvidence;
  const maxAge = Math.min(policy.evidence?.maxAgeHours ?? 24, 72);
  const out = [];
  const problems = [];
  if (!ev || typeof ev !== "object") {
    out.push(
      fail("content.evidence", "no Quran content-integrity evidence supplied for this commit"),
    );
  } else {
    if (ev.schema !== 1) problems.push("unsupported evidence schema");
    if (ev.tool !== "validate-quran-content")
      problems.push("evidence was not produced by validate-quran-content");
    if (ev.commit !== input.sha) problems.push("evidence belongs to a different commit");
    const age = ageHours(ev.generatedAt, now);
    if (age === null || age > maxAge || age < -0.1)
      problems.push("evidence is stale or has an invalid timestamp");
    const q = ev.quran ?? {};
    if (q.surahs !== EXPECTED.surahs) problems.push(`surah count is not ${EXPECTED.surahs}`);
    if (q.ayahs !== EXPECTED.ayahs) problems.push(`ayah count is not ${EXPECTED.ayahs}`);
    if (q.arabicCoverage !== EXPECTED.ayahs) problems.push("Arabic text coverage is incomplete");
    if (q.englishCoverage !== EXPECTED.ayahs)
      problems.push("English translation coverage is incomplete");
    if (q.failures !== 0) problems.push("validator reported failures");
    if (q.skipped !== 0) problems.push("validator skipped checks");
    out.push(
      problems.length
        ? fail("content.evidence", problems.join("; "))
        : pass("content.evidence", "114 surahs, 6236 ayahs, full Arabic and English coverage"),
    );
  }

  const kazRequired = policy.kazimirskiIncluded !== false;
  if (!kazRequired) {
    out.push(
      pass(
        "content.kazimirski",
        "not applicable: trust policy states the Kazimirski dataset is not part of this release",
      ),
    );
  } else {
    const k = ev?.kazimirski;
    if (!k)
      out.push(
        fail(
          "content.kazimirski",
          "strict Kazimirski validation evidence is missing (required unless the policy states the dataset is excluded)",
        ),
      );
    else if (k.strict !== true || k.failures !== 0 || k.skipped !== 0)
      out.push(
        fail(
          "content.kazimirski",
          "Kazimirski evidence is not a strict, failure-free, skip-free run",
        ),
      );
    else if (ev.commit !== input.sha)
      out.push(fail("content.kazimirski", "evidence belongs to a different commit"));
    else out.push(pass("content.kazimirski", "strict Kazimirski validation evidence present"));
  }
  return out;
}

function checkBilling(ctx) {
  const { git, input, env } = ctx;
  const out = [];
  const problems = [];
  const ent = git.showFile(input.sha, BILLING_FILES.entitlement);
  const flag = git.showFile(input.sha, BILLING_FILES.checkoutFlag);
  if (ent === null) problems.push(`${BILLING_FILES.entitlement} is unreadable at the candidate`);
  else if (!/^export const PREMIUM_ENFORCEMENT_ENABLED\s*=\s*false\s*;/m.test(ent))
    problems.push("premium enforcement is not hard-coded to false");
  if (flag === null) problems.push(`${BILLING_FILES.checkoutFlag} is unreadable at the candidate`);
  else if (!/VITE_BILLING_CHECKOUT_ENABLED"\]\s*===\s*"true"/.test(flag))
    problems.push('checkout flag is no longer an exact-string "true" check');
  out.push(
    problems.length
      ? fail("billing.static", problems.join("; "))
      : pass("billing.static", "premium enforcement false; checkout flag fails closed"),
  );

  const v = env?.VITE_BILLING_CHECKOUT_ENABLED;
  out.push(
    v === undefined || v === "" || v === "false"
      ? pass("billing.environment", "release environment leaves checkout disabled")
      : fail(
          "billing.environment",
          "VITE_BILLING_CHECKOUT_ENABLED is set in the release environment; enabling checkout needs separate owner approval",
        ),
  );
  return out;
}

// ------------------------------------------------------------- orchestration

/**
 * @param input  { sha, tag, previousTag, contentEvidence }
 * @param deps   { git, github, policy, env, now }  (all injectable; no ambient access)
 */
export async function assessRelease(input, deps) {
  const now = deps.now ?? Date.now();
  const results = [];
  const report = { assessment: "NOT ELIGIBLE", ciVerified: false, results, summary: null };

  const problems = validateInput(input);
  results.push(problems.length ? fail("input.valid", problems.join("; ")) : pass("input.valid"));
  if (problems.length) return finish(report);

  const policy = deps.policy;
  if (!policy)
    results.push(
      fail(
        "trust.policy",
        "no trust policy loaded; signer, workflow and repository trust cannot be established",
      ),
    );
  else results.push(pass("trust.policy", "trust policy loaded from outside the repository"));
  if (!policy) {
    for (const id of MANDATORY_CHECKS)
      if (!results.some((r) => r.id === id))
        results.push(notVerified(id, "blocked: trust policy missing"));
    return finish(report);
  }

  const ctx = { input, git: deps.git, github: deps.github, policy, env: deps.env ?? {}, now };
  let main = null;
  let candTag = null;

  const snap = () => ({
    head: ctx.git.headSha(),
    main: ctx.git.resolveRef(TRUSTED_MAIN_REF),
    tag: ctx.git.tagObjectId(input.tag),
    previousTag: ctx.git.tagObjectId(input.previousTag),
  });
  let before = null;
  results.push(
    ...(await guard(["state.stable"], () => {
      before = snap();
      return [];
    })),
  );

  results.push(
    ...(await guard(["commit.exists", "commit.on_trusted_main", "commit.is_main_tip"], () => {
      const r = checkCommit(ctx);
      main = r.main ?? ctx.git.resolveRef(TRUSTED_MAIN_REF);
      return r.out;
    })),
  );
  results.push(
    ...(await guard(["checkout.head_matches", "checkout.clean"], () => checkCheckout(ctx))),
  );
  results.push(
    ...(await guard(["tag.signed_annotated", "tag.trusted_signer", "tag.targets_candidate"], () => {
      const r = checkTags(ctx);
      candTag = r.cand;
      return r.out;
    })),
  );
  results.push(
    ...(await guard(["baseline.previous_release", "summary.generated"], () => {
      const r = checkBaseline(ctx);
      if (r.report) report.summary = r.report;
      return [...r.out, ...r.summary];
    })),
  );
  results.push(
    ...(await guard(
      [
        "ci.main_ref_agrees",
        "ci.check_run",
        "ci.no_spoofed_status",
        "ci.job_and_steps",
        "ci.workflow_run",
        "ci.workflow_pinned",
      ],
      async () => (await checkCi(ctx, main)).out,
    )),
  );
  results.push(
    ...(await guard(["content.evidence", "content.kazimirski"], () => checkContent(ctx))),
  );
  results.push(
    ...(await guard(["billing.static", "billing.environment"], () => checkBilling(ctx))),
  );

  // TOCTOU: nothing we depend on may have moved while we were verifying.
  results.push(
    ...(await guard(["state.stable"], () => {
      if (!before) return fail("state.stable", "initial state snapshot could not be taken");
      const after = snap();
      const moved = Object.keys(after).filter((k) => after[k] !== before[k]);
      return moved.length
        ? fail("state.stable", `repository state changed during verification: ${moved.join(", ")}`)
        : pass("state.stable", "head, trusted main and both tags unchanged during verification");
    })),
  );
  void candTag;
  return finish(report);
}

function finish(report) {
  const { results } = report;
  // A pending "state.stable" placeholder never exists as a pass: collapse to the final verdict per id.
  const byId = new Map();
  for (const r of results) {
    const prev = byId.get(r.id);
    if (!prev || r.status !== "pass" || prev.status === "pass") byId.set(r.id, r);
  }
  report.results = [...byId.values()];
  const missing = MANDATORY_CHECKS.filter((id) => !byId.has(id));
  for (const id of missing) report.results.push(fail(id, "check did not run"));
  for (const r of report.results) r.detail = redact(r.detail ?? "");
  const ciIds = report.results.filter((r) => r.id.startsWith("ci."));
  report.ciVerified = ciIds.length > 0 && ciIds.every((r) => r.status === "pass");
  const allPass =
    MANDATORY_CHECKS.every((id) => byId.get(id)?.status === "pass") && missing.length === 0;
  report.assessment = allPass ? "PASSED" : "NOT ELIGIBLE";
  report.notice =
    "Eligibility assessment only. It does not approve, authorize or perform any deployment.";
  return report;
}

export function formatReport(report) {
  const lines = [`QuranRoots release eligibility: ${report.assessment}`];
  if (!report.ciVerified) lines.push("CI NOT VERIFIED");
  for (const r of report.results)
    lines.push(`  [${r.status.toUpperCase().padEnd(12)}] ${r.id} - ${r.detail}`);
  if (report.summary) {
    const s = report.summary;
    lines.push(
      "",
      `Change summary: ${s.previousRelease} (${s.previousSha.slice(0, 12)}) -> ${s.candidateRelease} (${s.candidateSha})`,
    );
    lines.push(`  ${s.commitCount} commit(s), ${s.changedFileCount} changed file(s)`);
    for (const [k, v] of Object.entries(s.sensitive))
      if (v.count)
        lines.push(
          `  ${k}: ${v.count}${v.files.length ? ` e.g. ${v.files.slice(0, 5).join(", ")}` : ""}`,
        );
    lines.push(`  ${s.note}`);
  }
  lines.push("", report.notice);
  return lines.join("\n");
}

// ------------------------------------------------------------------ adapters

const ALLOWED_GIT = new Set([
  "rev-parse",
  "cat-file",
  "merge-base",
  "status",
  "verify-tag",
  "rev-list",
  "diff",
]);

function defaultRun(args, opts) {
  const r = spawnSync("git", args, {
    cwd: opts.cwd,
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 1_048_576,
    shell: false,
    env: {
      PATH: process.env.PATH ?? "",
      LC_ALL: "C",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_OPTIONAL_LOCKS: "0",
    },
  });
  if (r.error) throw new Error(`git failed to run: ${r.error.code ?? "error"}`);
  return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Read-only git adapter. Only allow-listed subcommands; arguments are never shell-interpolated. */
export function createGitAdapter({ cwd, allowedSignersFile = null, run = defaultRun }) {
  const git = (args, { ok = [0] } = {}) => {
    const sub =
      args[0] === "-c" ? args[args.findIndex((a, i) => i % 2 === 0 && a !== "-c")] : args[0];
    if (!ALLOWED_GIT.has(sub)) throw new Error(`git subcommand not permitted: ${redact(sub)}`);
    const r = run(args, { cwd });
    if (!ok.includes(r.code))
      throw new Error(`git ${sub} failed (exit ${r.code}): ${redact(r.stderr.trim())}`);
    return r;
  };
  const optional = (args) => {
    const r = git(args, { ok: [0, 1, 128] });
    return r.code === 0 ? r.stdout.trim() : null;
  };
  const sha = (v) => (v && SHA_RE.test(v) ? v : null);
  const tagRef = (name) => {
    if (!TAG_RE.test(name)) throw new Error("invalid tag name");
    return `refs/tags/${name}`;
  };

  return {
    resolveCommit: (s) => sha(optional(["rev-parse", "--verify", "--quiet", `${s}^{commit}`])),
    resolveRef: (ref) => sha(optional(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])),
    headSha: () => sha(optional(["rev-parse", "--verify", "--quiet", "HEAD^{commit}"])),
    isAncestor: (a, b) => {
      const r = git(["merge-base", "--is-ancestor", a, b], { ok: [0, 1] });
      return r.code === 0;
    },
    tagObjectId: (name) => sha(optional(["rev-parse", "--verify", "--quiet", tagRef(name)])),
    inspectTag(name) {
      const id = sha(optional(["rev-parse", "--verify", "--quiet", tagRef(name)]));
      if (!id) return { exists: false };
      const objectType = git(["cat-file", "-t", id]).stdout.trim();
      if (objectType !== "tag") return { exists: true, objectType, signature: { status: "none" } };
      const body = git(["cat-file", "tag", id]).stdout;
      const targetSha = /^object ([0-9a-f]{40})$/m.exec(body)?.[1] ?? null;
      const targetType = /^type (\S+)$/m.exec(body)?.[1] ?? null;
      let signature;
      if (!allowedSignersFile) signature = { status: "unconfigured" };
      else {
        const r = git(
          [
            "-c",
            "gpg.format=ssh",
            "-c",
            `gpg.ssh.allowedSignersFile=${allowedSignersFile}`,
            "verify-tag",
            id,
          ],
          { ok: [0, 1, 128] },
        );
        const text = `${r.stdout}\n${r.stderr}`;
        const good = /Good "git" signature for (\S+) with (\S+) key (SHA256:\S+)/.exec(text);
        if (r.code === 0 && good)
          signature = {
            status: "good",
            principal: good[1],
            algorithm: good[2],
            fingerprint: good[3],
          };
        else if (/No principal matched/.test(text)) signature = { status: "untrusted" };
        else if (/no signature found/i.test(text)) signature = { status: "none" };
        else signature = { status: "bad" };
      }
      return { exists: true, objectType, targetSha, targetType, signature };
    },
    statusEntries: () =>
      git(["status", "--porcelain=v1", "-z", "--untracked-files=all"])
        .stdout.split("\0")
        .filter(Boolean),
    blobId: (s, path) => sha(optional(["rev-parse", "--verify", "--quiet", `${s}:${path}`])),
    showFile: (s, path) => {
      const r = git(["cat-file", "blob", `${s}:${path}`], { ok: [0, 128] });
      return r.code === 0 ? r.stdout : null;
    },
    countCommits: (a, b) =>
      Number.parseInt(git(["rev-list", "--count", `${a}..${b}`]).stdout.trim(), 10),
    changedPaths: (a, b) =>
      git(["diff", "--name-only", "-z", "--no-renames", a, b]).stdout.split("\0").filter(Boolean),
  };
}

/** Read-only GitHub client: GET only, api.github.com only, bounded, no redirects. Token (if any) is never logged. */
export function createGitHubClient({
  token = null,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000,
} = {}) {
  return {
    async getJson(path) {
      if (!/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./?=&%-]*$/.test(path))
        throw new Error("refusing unexpected API path");
      const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "quranroots-release-verifier",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetchImpl(`https://api.github.com${path}`, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
      const text = await res.text();
      if (text.length > 2_000_000) throw new Error("GitHub API response too large");
      return JSON.parse(text);
    },
  };
}

// ------------------------------------------------------------- trust policy

function assertOutsideAndPrivate(path, repoRoot, label) {
  if (typeof path !== "string" || !path.startsWith("/"))
    throw new Error(`${label} must be an absolute path`);
  const real = realpathSync(path);
  const root = realpathSync(repoRoot);
  if (real === root || real.startsWith(root + sep))
    throw new Error(`${label} must live outside the repository being verified`);
  const st = statSync(real);
  if (!st.isFile()) throw new Error(`${label} must be a regular file`);
  if (typeof process.getuid === "function" && st.uid !== process.getuid())
    throw new Error(`${label} must be owned by the current user`);
  if ((st.mode & 0o022) !== 0) throw new Error(`${label} must not be group- or world-writable`);
  if (st.size > 65_536) throw new Error(`${label} is unexpectedly large`);
  return real;
}

/** Loads and validates the owner-held trust policy. Never read from the commit under verification. */
export function loadTrustPolicy(path, repoRoot) {
  const real = assertOutsideAndPrivate(path, repoRoot, "trust policy");
  const p = JSON.parse(readFileSync(real, "utf8"));
  if (p?.schema !== 1) throw new Error("unsupported trust policy schema");
  if (!REPO_RE.test(p.repository ?? "")) throw new Error("trust policy repository is invalid");
  if (!Array.isArray(p.allowedSigners) || p.allowedSigners.length === 0)
    throw new Error("trust policy lists no allowed signers");
  for (const s of p.allowedSigners)
    if (
      typeof s?.principal !== "string" ||
      !s.principal ||
      !FINGERPRINT_RE.test(s.fingerprint ?? "")
    )
      throw new Error("trust policy has an invalid signer entry");
  const signers = assertOutsideAndPrivate(p.allowedSignersFile, repoRoot, "allowed-signers file");
  const pins = p.trustedWorkflowBlobs?.[REQUIRED_CI.workflowPath];
  if (!Array.isArray(pins) || pins.length === 0 || !pins.every((b) => SHA_RE.test(b)))
    throw new Error("trust policy must pin the CI workflow blob(s)");
  return { ...p, allowedSignersFile: signers };
}

export function loadEvidence(path) {
  const st = statSync(path);
  if (!st.isFile() || st.size > 65_536)
    throw new Error("evidence file must be a small regular file");
  return JSON.parse(readFileSync(path, "utf8"));
}

// ----------------------------------------------------------------------- CLI

const USAGE = `Usage: node scripts/release/verify-release.mjs --sha <40-hex> --tag <name> --previous-tag <name>
         --trust-policy <abs path outside repo> [--content-evidence <file>] [--json]

Dry-run eligibility assessment. Never deploys, tags, pushes or changes anything.
Optional: GITHUB_TOKEN / GH_TOKEN (read-only) raises GitHub API rate limits.`;

export function parseArgs(argv) {
  const known = new Map([
    ["--sha", "sha"],
    ["--tag", "tag"],
    ["--previous-tag", "previousTag"],
    ["--trust-policy", "trustPolicy"],
    ["--content-evidence", "contentEvidence"],
  ]);
  const out = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (known.has(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} requires a value`);
      out[known.get(a)] = v;
    } else throw new Error(`unknown option: ${redact(a)}`);
  }
  return out;
}

export async function main(argv, env = process.env) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(`${redact(err.message)}\n\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  const repoRoot = resolve(process.cwd());
  let policy = null;
  let policyError = null;
  try {
    if (!args.trustPolicy) throw new Error("--trust-policy is required");
    policy = loadTrustPolicy(args.trustPolicy, repoRoot);
  } catch (err) {
    policyError = redact(err.message);
  }
  let contentEvidence = null;
  if (args.contentEvidence) {
    try {
      contentEvidence = loadEvidence(args.contentEvidence);
    } catch {
      contentEvidence = null;
    }
  }
  const token = env.GITHUB_TOKEN || env.GH_TOKEN || null;
  const report = await assessRelease(
    { sha: args.sha, tag: args.tag, previousTag: args.previousTag, contentEvidence },
    {
      git: createGitAdapter({
        cwd: repoRoot,
        allowedSignersFile: policy?.allowedSignersFile ?? null,
      }),
      github: createGitHubClient({ token }),
      policy,
      env,
      now: Date.now(),
    },
  );
  if (policyError)
    report.results.find((r) => r.id === "trust.policy").detail =
      `trust policy rejected: ${policyError}`;
  console.log(args.json ? JSON.stringify(report, null, 2) : formatReport(report));
  return report.assessment === "PASSED" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`unexpected error: ${redact(err?.message ?? err)}`);
      process.exit(1);
    },
  );
}

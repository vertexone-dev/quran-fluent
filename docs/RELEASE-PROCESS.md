# QuranRoots release process: eligibility verifier (QR-SEC-003B prototype)

> **QR-SEC-003B does not implement or authorize deployment.**
> It adds a dry-run verifier that reports whether a commit is _eligible_ for a
> release decision. It is a prototype, not production-ready, and nothing in the
> existing production pipeline changes.

## 1. Purpose

`scripts/release/verify-release.mjs` checks, fail-closed, that one exact commit
satisfies the preconditions an owner-operated release would require: exact
commit identity, owner-signed release tag, trustworthy CI evidence, Quran
content-integrity evidence, billing-disabled evidence, a clean checkout and a
change summary. It prints `PASSED` or `NOT ELIGIBLE`. It never deploys, tags,
pushes, fetches, dispatches workflows or reads any production credential.

## 2. Why GitHub Free private protections are insufficient

Owner testing (QR-SEC-002D) and GitHub's documentation (corroborated in
QR-SEC-003A) show that on a private repository under GitHub Free:

- rulesets and classic branch protection are not enforced (PR review, required
  `test` check, force-push and deletion blocks are lost);
- the `production` environment's required-reviewer gate is not available, and a
  dummy environment secret was readable by a workflow without any approval;
- when a public repository becomes private, GitHub states that protection rules
  and environment secrets "will be ignored".

So the approval barrier that exists today cannot be relied on after a private
migration. This verifier is one building block of a replacement that does not
depend on those features.

## 3. Current production deployment architecture (unchanged)

`production-deploy.yml` runs after "QuranRoots CI" succeeds on `main`
(`workflow_run`) or by manual dispatch, pauses at the `production` environment
(reviewer `Makamou`), then runs `npm ci`, `npm run build` and
`npx nitro deploy --prebuilt` with the Cloudflare token. **This phase touches
none of it.**

## 4. Proposed owner-operated architecture (design only)

```
private repo --PR--> main --CI (no deploy secret)--> check-runs for the SHA
owner workstation: review diff -> sign release tag -> verify-release (dry run)
   -> [future] isolated build without token -> pinned deploy with token from keychain
```

The Cloudflare credential would exist only on the owner machine. The deploy
step itself is **out of scope** and does not exist in this repository.

## 5. Inputs and trust assumptions

| Input                     | Source                          | Trusted because                                                              |
| ------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| `--sha`                   | Owner                           | Must be a full 40-hex SHA, equal to the `origin/main` tip                    |
| `--tag`, `--previous-tag` | Owner                           | Annotated, SSH-signed, signer authorized by policy                           |
| `--trust-policy`          | **File outside the repo**       | Owner-owned, not group/world-writable, never read from the commit under test |
| `--content-evidence`      | Owner-produced JSON (section 8) | Bound to the SHA, schema-checked, fresh                                      |
| GitHub API                | `api.github.com`, GET only      | Read-only; optional `GITHUB_TOKEN`/`GH_TOKEN` only raises rate limits        |

Trust policy (`schema: 1`), kept outside the repository, e.g. `~/.config/quranroots/release-trust.json` with mode 600:

```json
{
  "schema": 1,
  "repository": "vertexone-dev/quran-fluent",
  "allowedSigners": [{ "principal": "owner@example.com", "fingerprint": "SHA256:..." }],
  "allowedSignersFile": "/Users/<you>/.config/quranroots/allowed_signers",
  "trustedWorkflowBlobs": { ".github/workflows/ci.yml": ["<git blob sha>"] },
  "kazimirskiIncluded": true,
  "ci": { "maxAgeHours": 168 },
  "evidence": { "maxAgeHours": 24 }
}
```

If the policy is missing or invalid, the result is `NOT ELIGIBLE` (no default
trust exists). Creating this file and the signing key is an owner action that
this phase does **not** perform.

## 6. Signed-tag authorization model

- The tag must be **annotated** and **SSH-signed** (`gpg.format=ssh`). Lightweight
  and unsigned tags are rejected.
- `git verify-tag` runs with the owner's allowed-signers file. The reported key
  fingerprint **and** principal must also appear in the policy's `allowedSigners`;
  a signature that Git accepts but the policy does not list is rejected.
- The tag object must point **directly** at the candidate commit (nested tags are
  rejected). A moved tag is detected by re-reading it at the end of verification.
- The previous release tag is verified the same way and must be a proper ancestor
  of the candidate; a missing baseline is a blocker (no baseline is invented).
- A valid signature proves who signed, not that the changes were reviewed. The
  signing ceremony is the owner's review commitment; the verifier cannot check it.

## 7. Required CI evidence

Taken from `.github/workflows/ci.yml` (workflow **QuranRoots CI**, job `test`).
For the exact SHA the verifier requires, via the GitHub API:

- exactly one check run named `test`, from the GitHub Actions app (id 15368), for
  that SHA, `completed` + `success`, within the age limit; any same-named check
  from another app or a commit status named `test` is treated as impersonation;
- the job traces to a run of workflow file `.github/workflows/ci.yml`, event `push`
  on `main`, from this repository (not a fork, not a pull-request run);
- these steps each exist once and concluded `success` (never `skipped`):
  Lint, Unit tests, Quran content integrity validation, Build, Verify E2E target
  is localhost (fail-fast), Run E2E tests;
- the CI workflow file at the candidate has a git blob id **pinned in the trust
  policy**. Without this, whoever can push to `main` could rewrite `ci.yml` to
  report success trivially. Pin by reviewing the file and running
  `git rev-parse <sha>:.github/workflows/ci.yml`; update the pin after each reviewed change;
- GitHub's `main` tip equals the local `origin/main` reference.

If the API is unreachable the report says **CI NOT VERIFIED** and the release is not eligible.

## 8. Quran content-integrity evidence

CI's validator step runs `scripts/validate-quran-content.mjs`, but that script skips
Kazimirski checks unless `REQUIRE_KAZIMIRSKI_SOURCE=true`, which CI does not set.
CI success is therefore **not** accepted as proof of Kazimirski integrity. The
verifier instead requires an evidence file for the exact SHA:

```json
{
  "schema": 1,
  "tool": "validate-quran-content",
  "commit": "<sha>",
  "generatedAt": "<ISO time>",
  "quran": {
    "surahs": 114,
    "ayahs": 6236,
    "arabicCoverage": 6236,
    "englishCoverage": 6236,
    "failures": 0,
    "skipped": 0
  },
  "kazimirski": { "strict": true, "failures": 0, "skipped": 0 }
}
```

Counts must match exactly, nothing may be skipped, and the file must be fresh and
bound to the SHA. Kazimirski evidence is required unless the owner's policy states
`kazimirskiIncluded: false`. **Limitation:** the file is unsigned and this phase
adds no producer for it (producing it means running the validator against a
database). A future phase must define a trustworthy producer.

## 9. Billing safety evidence

Read from git objects **at the candidate SHA** (not the working tree):
`PREMIUM_ENFORCEMENT_ENABLED` is exactly `false` in `src/lib/billing/entitlement.ts`,
and `src/lib/billing/checkoutFlag.ts` still enables checkout only on the exact string
`"true"`. The release environment must not set `VITE_BILLING_CHECKOUT_ENABLED` (or
must set `false`). Billing unit and E2E suites are covered through the mandatory CI steps.

## 10. Exact commit verification

The candidate must be a full lowercase SHA that exists, is reachable from, and
**equals the tip of**, `refs/remotes/origin/main`; the checkout HEAD must equal it;
and `HEAD`, the main reference and both tags are snapshotted before and after the
checks so any movement during verification is rejected. The verifier does not run
`git fetch`; refresh `origin/main` yourself first. A stale reference is caught by
comparing it with GitHub's `main`.

## 11. Local dry-run usage

```sh
node scripts/release/verify-release.mjs \
  --sha <40-hex> --tag <signed-release-tag> --previous-tag <signed-previous-tag> \
  --trust-policy /abs/path/outside/repo/release-trust.json \
  --content-evidence /abs/path/evidence.json [--json]
```

Exit codes: `0` PASSED, `1` NOT ELIGIBLE, `2` usage error. There are deliberately no
`--force`, `--skip-*`, `--ignore-*` or `--allow-*` options. Use a clean, dedicated
checkout or worktree at the candidate commit. Tests: `node --test scripts/release/verify-release.test.mjs`.

## 12. Failure behavior

Every mandatory check (23, listed in `MANDATORY_CHECKS`) must report `pass`. A thrown
error, unavailable dependency, missing policy, missing evidence, unverifiable control
or a check that did not run yields `NOT ELIGIBLE`. Output is bounded, control
characters are stripped and secret-like strings are redacted.

## 13. Security limitations

- **Eligibility is not authorization.** `PASSED` never approves a deployment.
- Required review and CI cannot be enforced on GitHub Free private. A bad commit can
  reach `main`; the signed tag plus the owner's diff review is the only barrier, and it is procedural.
- A compromised owner workstation or signing key defeats the model.
- The content-evidence file is unsigned and has no producer yet; the change summary
  is informational and not proof of review.
- Tests here use faked Git/GitHub data plus throwaway local git repositories; they
  do not exercise the live GitHub API, and `scripts/release/` is not wired into CI.
- Cloudflare-side deployment routes (dashboard, Git integration, other tokens) are unverified.
- The verifier executes no repository code, but dependency and build-script risk
  belongs to the future build step, which is out of scope.
- Ignored files (e.g. `node_modules`, `dist`) are not treated as dirty.

## 14. Future Cloudflare credential isolation (design only, not implemented)

Create a new narrowly scoped token, hold it only in the owner's keychain, build
without the token and with install scripts disabled, deploy with a separately
installed pinned tool, prove it against a non-production target first, then
retire the automatic workflow, delete the GitHub-held token and revoke it in the
Cloudflare dashboard, verifying revocation before any visibility change.

## 15. Future rollback requirements

A rollback must redeploy only a previously released, signed and logged SHA through
the same verification, keep a release log (SHA, time, previous SHA), and document
Cloudflare version rollback as the fast path. Reverting repository visibility is
**not** a clean rollback (history and anything added while private becomes public).

## 16. Explicitly prohibited in this phase

Deploying or running Cloudflare or Wrangler commands; creating tags or releases;
touching `.github/workflows/`, environments, rulesets, branch protection, secrets
or repository visibility; Stripe or billing changes; Quran content or translation
changes; mobile code changes; merging.

## 17. Prerequisites for any production implementation (QR-SEC-003C and later)

1. Owner-held signing key, `allowed_signers` file and trust policy created and backed up.
2. Decision on CI cost model (E2E cadence) and confirmation of plan, budget and payment method.
3. A trustworthy producer for the content-integrity evidence, including strict Kazimirski mode.
4. Wiring `scripts/release/` tests into CI (needs a separately approved workflow/`package.json` change).
5. A non-production deployment test with dummy credentials, then the credential-migration order from the QR-SEC-003A audit report.
6. Owner review of Cloudflare dashboard settings for any other deployment path.
7. Explicit written approval for each step above.

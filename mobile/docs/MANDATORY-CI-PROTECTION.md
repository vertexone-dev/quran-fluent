# Proposed mandatory CI protection (QR-RELEASE-002A)

Written for the project owner. **Nothing was applied.** The live ruleset "Protect main" is unchanged, and the workflow change exists only on a local branch. `proposed-ruleset-protect-main.json` is the exact current ruleset plus one required check; applying it is an owner action.

## Today

- Ruleset "Protect main": one approving review from a non-author, up-to-date branch, required check `test` (the website CI), no force push, no deletion; Admin role may bypass.
- Mobile checks (`QuranRoots Mobile CI`) are **not required**, run only for pull requests whose base is `main` and whose files match a path filter, and so never run on stacked pull requests.

## Proposed change

1. **The workflow** (`.github/workflows/mobile-ci.yml`, in the local security branch):
   - `pull_request` now runs for **every** base branch and every path, so stacked PRs and consolidated PRs are covered and the gate always reports.
   - A `changes` job classifies the changed files with `mobile/scripts/ci/classify-changes.mjs`: mobile code, migrations, Kazimirski sources, lockfiles and the workflow need the checks; Markdown-only and website-only changes do not. An empty or unreadable file list counts as "mobile changed".
   - `static`, `content-integrity` and `content-full` run only when `mobile=true` (push, tag and manual runs always run them).
   - The job named **`mobile release gate`** always runs (`if: always()`), decided by `mobile/scripts/ci/mobile-gate.mjs`: on a pull request it passes at once if nothing mobile changed; otherwise it needs all three jobs to have **succeeded**, and a skipped job fails. If the classification job itself failed or printed an unknown value, the gate fails.
2. **The ruleset:** add the required status check `mobile release gate` (Actions app, id 15368), keeping `test`. Because the gate always reports, a documentation-only PR is not blocked, and a mobile PR cannot merge with a skipped, failed or cancelled check.
3. **No production trigger:** the workflow keeps its name, `QuranRoots Mobile CI`. Production Deployment starts only from the completion of a workflow named exactly `QuranRoots CI` on `main`, so nothing here can start one. No secret, variable, database or deployment permission is used (`permissions: contents: read`).

## Tests (local)

- `mobile/scripts/ci/ci-gate.test.ts` (12 tests): classification cases (empty list, mobile code, migrations, lockfiles, docs-only, website-only, mixed, a `.md.js` name), every gate outcome (success, skipped, failure, cancelled, missing, unknown event, broken classification), and both scripts started through a symlink (the 007E fail-open bug).
- The classifier was run on the real diffs of the open PRs: the docs-only PR #94 and the website PR #77 give `mobile=false`; #92 and #91 give `mobile=true`.
- `actionlint`: clean. Not run: the new workflow on GitHub (it needs a push, which is not authorised), so the job wiring (`needs`, `if`, outputs) has been checked by actionlint only.

## Limits to know

- A pull request can edit the workflow or the gate scripts it runs under. Mitigations the ruleset can add: required review from a code owner for `.github/workflows/**` and `mobile/scripts/ci/**` (needs a CODEOWNERS file and `require_code_owner_review`, not present today) and a second approver. The Admin bypass remains.
- Required workflows from outside the repository are an organisation-level feature and are not assumed here.
- With "up-to-date branch" required, every merge in a stack re-runs `test` (about 50 minutes). Consolidated integration branches reduce this.
- `content-full` pulls public container images on each run; a registry outage would block merges (the gate fails closed on purpose).

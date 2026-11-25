# How to make `mobile release gate` a required check (QR-SECURITY-003)

Written for the project owner. **Nothing here has been applied.** The live ruleset "Protect main" (id 23719357) is unchanged.

## What was verified on GitHub (isolated draft PRs, no secrets, no deployment)

All probes were draft PRs from disposable branches into `security/qr-release-002a-mobile-hardening`; they were closed and their branches deleted afterwards.

| PR (closed) | Change                                                 | `mobile release gate`                         | Mobile jobs          |
| ----------- | ------------------------------------------------------ | --------------------------------------------- | -------------------- |
| #98         | documentation only (`docs/*.md`)                       | **pass**: "no mobile-affecting files changed" | skipped              |
| #99         | website only (`src/lib/utils.ts`)                      | **pass**: same message                        | skipped              |
| #100        | deliberate TypeScript error in `mobile/src/artwork.ts` | **fail**: "static did not succeed (failure)"  | ran, `static` failed |
| #97 (open)  | the real mobile change set                             | **pass**                                      | all ran              |

On the unmodified mobile chain (#95, workflow from the existing branch) the old `mobile release gate` job reported **skipped** on a pull request. A skipped required check is accepted as passing, which is the hole the new gate closes.

## Order matters

A required check that a pull request never reports stays "Expected — Waiting for status to be reported" and blocks the merge forever. The new gate exists only in `.github/workflows/mobile-ci.yml` on the security branch. So:

1. Merge the security branch (with the workflow) into `main` through the normal reviewed route. At that point the gate reports on every later pull request.
2. Open any small pull request and confirm `mobile release gate` appears and passes.
3. Only then add the check to the ruleset. Do not add it first.

Open pull requests created before step 1 (for example the website consolidation #96) do not have the gate in their workflow; update their branch from `main` so the workflow is picked up, or they will wait for a check that never comes.

## Apply (owner, after step 2)

GitHub UI: Settings → Rules → Rulesets → "Protect main" → Require status checks to pass → Add checks → choose `mobile release gate` (source: GitHub Actions) → keep `test` → Save. Leave "Require branches to be up to date" on.

Or with the CLI, from a repository checkout (this edits the live ruleset; do it deliberately):

```bash
gh api -X PUT repos/vertexone-dev/quran-fluent/rulesets/23719357 \
  --input mobile/docs/proposed-ruleset-protect-main.json
gh api repos/vertexone-dev/quran-fluent/rules/branches/main   # read back the effective rules
```

`proposed-ruleset-protect-main.json` is the live ruleset plus the one extra required check (integration id 15368, GitHub Actions). Both checks keep that id.

## Roll back

Re-PUT the previous ruleset (it has only `test`), or remove the check in the UI. Nothing else depends on it.

## Known limits (unchanged)

- A pull request can edit the workflow or `mobile/scripts/ci/**` it runs under. Add a CODEOWNERS entry for `.github/workflows/**` and `mobile/scripts/ci/**` and turn on "Require review from Code Owners", and consider a second approver. Today there is no CODEOWNERS file.
- The Admin role can bypass the ruleset. Nothing here changes that.
- With "up to date" required, each merge into `main` re-runs `test` (about 50 minutes).

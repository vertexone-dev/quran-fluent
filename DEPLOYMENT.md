# Production Deployment

QuranRoots deploys to a single Cloudflare Worker, `quranroots`, served at
**https://quranroots.vertexone.workers.dev**. This document explains the
automated deployment pipeline (`.github/workflows/production-deploy.yml`)
and the one-time, manual GitHub/Cloudflare setup it requires.

> **Never commit `.env` files or paste secret values into code, commit
> messages, PR descriptions, issues, or workflow files.** Every credential
> below belongs only in GitHub's own encrypted secret storage.

## 1. One-time setup: the `production` GitHub Environment

The deploy workflow references a GitHub Environment named exactly
**`production`**. Until it exists, every run of the workflow will fail at
the `deploy` job with an environment-not-found error — this is expected and
safe; it is the mechanism that prevents accidental deploys until you've
explicitly set it up.

**Create it:**

1. Repository → **Settings** → **Environments** → **New environment**.
2. Name it exactly `production` (must match the workflow file).

**Add required reviewers (recommended — this is what makes every deployment
require a human click, even the automatic post-merge trigger):**

3. On the `production` environment page, under **Deployment protection
   rules**, enable **Required reviewers** and add yourself and/or
   whoever else should be able to approve a production release.
4. Optionally set a **wait timer** for an additional cooling-off period.

**Restrict which branch/ref can deploy:**

5. Under **Deployment branches and tags**, choose **Selected branches and
   tags** and add a rule for `main` only. This is a second, independent
   backstop beyond the workflow's own `main`-only checks.

## 2. Required GitHub Environment secrets (`production` environment)

Add these under the `production` environment's **Environment secrets**
(not repository-level secrets) — scoping them to the environment means they
are only ever readable by a workflow run that has referenced
`environment: production` _and_ cleared its approval gate.

| Secret                 | Purpose                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | Authenticates `wrangler deploy` non-interactively. See §4 for how to create a least-privilege token. |

## 3. Required GitHub Variables

| Variable                | Scope                                                | Purpose                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | `production` environment (recommended) or repository | Selects the Cloudflare account to deploy to. Not sensitive on its own (it's visible in the Cloudflare dashboard URL and in `wrangler whoami` output) — a GitHub _Variable_, not a secret. |

Add it under the `production` environment's **Environment variables**
(same page as the secret above) so it travels with the same scope, or as a
repository-level variable if you prefer — either works with the workflow as
written (`${{ vars.CLOUDFLARE_ACCOUNT_ID }}`).

## 4. Creating a least-privilege Cloudflare API token

Do **not** reuse a personal/developer token. Create one scoped narrowly to
what this deploy actually needs:

1. Cloudflare dashboard → profile icon → **My Profile** → **API Tokens** →
   **Create Token**.
2. Choose **Create Custom Token** (not a template — the templates grant
   broader access than this project needs).
3. **Permissions**:
   - `Account` → `Workers Scripts` → `Edit`
   - `Account` → `Account Settings` → `Read` (Wrangler needs this to
     resolve the account when deploying)
4. **Account Resources**: scope to the specific account shown by
   `wrangler whoami` (the account that already owns the `quranroots`
   Worker) — not "All accounts".
5. **Zone Resources**: none needed — this project has no custom zone/route
   configured in `wrangler.jsonc`. If a custom domain/route is added to
   this Worker in the future, the token will additionally need `Zone` →
   `Workers Routes` → `Edit` for that zone.
6. Create the token, copy it once, and paste it directly into the
   `CLOUDFLARE_API_TOKEN` environment secret (§2) — never into a file, a
   chat message, or a commit.

## 5. Already-existing secrets this workflow reuses (no action needed)

The build step reuses two secrets that already exist at the repository
level (used today by `ci.yml` and `production-validation.yml`) — this
workflow does not create or duplicate them:

| Secret                          | Notes                                                                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Baked into the client bundle at build time. Not sensitive (it's the public Supabase project URL).                                                                                                                                                                       |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Baked into the client bundle at build time. Supabase's publishable/anon key is designed to be public (protected by Row Level Security, not by secrecy) — kept as a secret only to match this repo's existing convention, not because exposure would itself be a breach. |

The post-deployment validation job (`production-validation.yml`, invoked
with `secrets: inherit`) also reuses the existing repository secrets
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `E2E_TEST_EMAIL`, and
`E2E_TEST_PASSWORD` exactly as it already does today for manual dispatch —
nothing about them changes.

**Important:** `process.env.SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (no
`VITE_` prefix) are read by the app's _server-side_ code at runtime inside
the deployed Worker (`src/integrations/supabase/client.ts`). Those must
already be configured as Cloudflare Worker environment variables/secrets on
the `quranroots` Worker itself (Cloudflare dashboard → Workers & Pages →
quranroots → Settings → Variables, or `wrangler secret put`) — they are
**not** set by this GitHub Actions workflow, which only ever supplies
`VITE_`-prefixed values at build time. If the Worker is already serving
traffic correctly today, this is already configured; the deploy workflow
does not need to touch it.

## 6. How deployment is triggered

**Automatically:** every time `.github/workflows/ci.yml` ("QuranRoots CI")
completes on `main` — i.e. after a PR is merged and CI runs against the
merge commit. The deploy workflow verifies that specific CI run's
conclusion was `success` before proceeding; a failed or cancelled CI run
never reaches the deploy job. A CI run triggered by a pull request (which
runs on the PR's own branch, not `main`) cannot trigger this workflow at
all — GitHub's `workflow_run.branches` filter matches the branch the
_triggering_ workflow ran on.

**Manually:** Actions tab → **Production Deployment** → **Run workflow**.
Leave `commit_sha` blank to deploy the current tip of `main`, or supply an
exact SHA to (re-)deploy a specific, already-validated commit. The workflow
independently re-verifies that the SHA is reachable from `main` and that
QuranRoots CI succeeded for that exact commit before doing anything else —
manual dispatch cannot bypass the "CI passed" requirement.

**Either path** then pauses at the `production` environment for required-
reviewer approval (once configured per §1) before the build/deploy steps
run.

## 7. Locating deployment evidence

- **GitHub Actions run**: Actions tab → **Production Deployment** → the
  run in question. The job summary (top of the run page) shows the
  deployed commit SHA, trigger type, production URL, Cloudflare Version
  ID, and UTC timestamp.
- **Deploy log artifact**: `production-deploy-log`, attached to every run
  (success or failure), 30-day retention.
- **Cloudflare deployment history**: `npx wrangler deployments list --name
quranroots` (from a machine with `wrangler` access), or the Cloudflare
  dashboard → Workers & Pages → quranroots → Deployments.
- **Post-deployment validation report**: `production-validation-
playwright-report` artifact (always uploaded) and `production-
validation-test-results` (only on failure), 7-day retention.

## 8. How post-deployment validation runs

After a successful deploy, the workflow calls the existing
`.github/workflows/production-validation.yml` as a reusable workflow
(`uses:` + `secrets: inherit`) — the exact same E2E specs it already runs
today against `https://quranroots.vertexone.workers.dev` on manual
dispatch, unchanged. If validation fails, the overall pipeline run is
marked failed even though the deploy itself succeeded — check the job
summary and artifacts to distinguish "deploy failed" from "deploy
succeeded but validation caught a regression."

## 9. Rollback

Cloudflare Workers keeps a version history independent of this pipeline.
To roll back:

1. `npx wrangler deployments list --name quranroots` to find the prior
   good Version ID (or use the Cloudflare dashboard → quranroots →
   Deployments).
2. `npx wrangler rollback --name quranroots [VERSION_ID]` (omit the
   version ID to roll back to the immediately-prior deployment), or
   promote a specific prior version to 100% traffic from the dashboard.
3. Confirm `https://quranroots.vertexone.workers.dev` reflects the rolled-
   back version before considering the rollback complete.

This workflow does not automate rollback — it is a deliberately separate,
manual action, matching the same "never deploy without a human decision at
the consequential step" principle as the forward-deploy approval gate.

## 10. Disabling the workflow safely

To pause automated deployments without deleting anything:

- Actions tab → **Production Deployment** → **⋯** → **Disable workflow**.
  This stops both the automatic (`workflow_run`) and manual
  (`workflow_dispatch`) triggers; re-enable the same way.
- Alternatively, remove `CLOUDFLARE_API_TOKEN` from the `production`
  environment — the deploy step then fails closed (loudly, in the job log)
  rather than silently deploying.
- **Do not** pause deployment by removing required reviewers from the
  `production` environment — that _removes_ a safeguard rather than
  pausing the pipeline, and would leave the workflow able to deploy
  without approval.

## 11. Summary of files

| File                                          | Purpose                                                                                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/production-deploy.yml`     | The pipeline described in this document                                                                                                                                                        |
| `.github/workflows/production-validation.yml` | Existing E2E validation against production; now also invokable as a reusable workflow (`workflow_call` added) from the deploy pipeline, in addition to its existing manual `workflow_dispatch` |
| `.github/workflows/ci.yml`                    | Unchanged — this is the workflow the deploy pipeline waits on                                                                                                                                  |

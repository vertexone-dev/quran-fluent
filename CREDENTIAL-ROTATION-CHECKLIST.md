# E2E Test Account — Credential Rotation Checklist

**Not performed by this task.** No credential value was read, revealed,
generated, printed, or modified while producing this checklist. No browser
storage, shell history, keychain, or credential store was inspected.

## 1. Exact account requiring rotation

The shared E2E test account identified by the email in `E2E_TEST_EMAIL`
(local: `.env.test`; CI: the `E2E_TEST_EMAIL` GitHub Actions secret) and the
password in `E2E_TEST_PASSWORD` (same two locations). This is a dedicated
test account, not a real learner's account — used exclusively by
`tests/e2e/setup/auth.setup.ts` and every authenticated Playwright spec.
Identified here by *variable name* only; its value is not reproduced.

## 2. Supabase Auth location to update

Production Supabase project's **Authentication → Users** — locate the user
by the email in `E2E_TEST_EMAIL` and use **"Reset password"** (or delete +
recreate via the Auth admin API, matching the same idempotent create-if-
missing pattern `scripts/e2e/ensure-local-test-user.mjs` already uses for
the local stack) to set the new password.

## 3. GitHub secret to update

Repository (or `production`/CI environment, whichever currently scopes it)
secret named **`E2E_TEST_PASSWORD`** — update its value to the new password.
`E2E_TEST_EMAIL` does not need to change.

## 4. Local `.env.test` variable to update

`E2E_TEST_PASSWORD` in `.env.test` (gitignored — never committed).
`.env.test.example` documents the variable name only, no value.

## 5. Correct update order

1. Generate the new password out-of-band (a password manager or `openssl
   rand -base64 24`-style generator — never typed into chat, an issue, a
   commit, or any shared/logged channel).
2. Update it in Supabase Auth first (§2) — the account is briefly
   inaccessible with the *old* password from this point.
3. Update the GitHub Actions secret (§3) immediately after, so the next CI
   run doesn't fail on stale credentials.
4. Update every contributor's local `.env.test` (§4) — each developer does
   this individually; the value itself should be shared only through the
   same secure out-of-band channel used in step 1, never through git.
5. Only after all three locations agree, proceed to verification (§6–9).

## 6. Verify the old password stops working

Attempt a sign-in with the *old* password (e.g. via `curl` against
Supabase's `POST /auth/v1/token?grant_type=password` with the anon key, or
simply via the app's own `/auth?mode=login` form) and confirm it now fails
with an authentication error. Do this without printing either password —
only the pass/fail HTTP status needs to be observed.

## 7. Authentication setup validation

Run `tests/e2e/setup/auth.setup.ts` in isolation (`npx playwright test
--project=setup`, or simply let the next full run exercise it — it always
runs first) and confirm it signs in successfully and writes
`playwright/.auth/user.json`.

## 8. Targeted E2E validation

Run the core authenticated-journey specs against the new credential before
trusting it broadly: `npx playwright test tests/e2e/auth.spec.ts
tests/e2e/01-onboarding.spec.ts tests/e2e/09-localization.spec.ts` (login,
onboarding, and a full authenticated + public round-trip).

## 9. Full CI validation

Push a no-op/trivial commit (or re-run the existing CI workflow) and confirm
`QuranRoots CI` passes end-to-end with the rotated secret — this is the
authoritative confirmation that the GitHub secret (§3) was updated correctly
and CI's own execution environment picks it up.

## 10. Rollback procedure (without exposing either password)

If rotation causes unexpected failures:
1. Revert Supabase Auth's password for this account back to a freshly
   generated value known only via the same secure channel as step 1 above
   — **never** by reusing or re-deriving the old password (assume it may
   already be compromised if rotation was prompted by a leak; if rotation
   was routine/preventive, generate a new value rather than reverting to the
   old one regardless).
2. Update the GitHub secret and every local `.env.test` to match, following
   the same order as §5.
3. Re-run §7–9 to confirm the rolled-back state is fully consistent across
   Supabase, GitHub, and local environments before considering the incident
   closed.

At no point in this procedure does any step require printing, logging, or
committing a password value.

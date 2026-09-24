# Payment & Premium Entitlement Architecture

**Status: deployed, checkout code-complete, checkout and enforcement both
still off.** The pricing, trial, refund, grace-period, existing-user-
transition, Stripe Tax, Adaptive Pricing, and promotion-code decisions in
§23 are approved and reflected throughout this document. The schema,
server endpoints, entitlement policy, and UI described here are deployed
to production (§19 steps 1-4, 6) — but:

- This document never states, and this codebase never checks, which Stripe
  mode (test or live) the deployed `STRIPE_SECRET_KEY`/price ids/webhook
  secret belong to — confirming that is a private, human, dashboard-only
  check (§19.1 step 4), never something CI, this document, or an agent can
  verify or guess without reading a secret value.
- **Premium enforcement is hard-coded disabled**
  (`PREMIUM_ENFORCEMENT_ENABLED = false` in `src/lib/billing/entitlement.ts`)
  — every existing learner keeps exactly the access they have today,
  regardless of this schema's existence or any subscription row's content.
  Not part of this rollout (§19.1) or any near-term one.
- Checkout is code-complete (the "Choose Monthly"/"Choose Annual" buttons
  on `/premium` create a real Checkout Session when clicked) but still
  disabled by the client-safe, build-time
  `VITE_BILLING_CHECKOUT_ENABLED` flag (§17, §19.1) — every checkout
  button stays inert while this flag is unset or `"false"`, its current
  production value.
- No payment has been accepted through this rollout.

See the "Security note" under §9/§10 below before enabling enforcement —
this foundation alone does **not** make Levels 3-6 content secure.

**Reconciliation check performed before writing this:** grepped the full
repository for `stripe|billing|subscription|premium|payment` — no existing
payment/billing code, table, or document exists (the only hits were Supabase
Auth's unrelated `subscription` object, a marketing-copy "premium academy"
phrase, and the word "payment" inside several Pickthall Qur'an verses). This
is a net-new design, not a competing one.

**Stack this design targets** (confirmed from the repo, not assumed): TanStack
Start on Cloudflare Workers (Nitro build, `npx nitro deploy`), Supabase
(Postgres + Auth + RLS, `@supabase/supabase-js` client), Vitest for unit
tests, Playwright for E2E, i18n via `src/locales/{en,fr}`.

---

## 1–3. Plans

| Plan | Price (approved, §23) | Billing period | Target learner |
|---|---|---|---|
| **Free** | $0 | — | Everyone; the Qur'an Reader, Levels 1-2, bookmarks/notes, basic progress |
| **Premium Monthly** | **$3.99 USD** | Monthly, recurring | Learners who want month-to-month flexibility |
| **Premium Annual** | **$29.99 USD** | Annual, recurring | Committed learners; ~37% cheaper than 12× monthly |

Both Premium tiers grant identical entitlements; they differ only in billing
cadence and price. A single Stripe Product (`quranroots_premium`) with two
Prices (`monthly`, `annual`) is sufficient — no separate product per cadence.
Prices above are USD list prices; **Stripe Adaptive Pricing** is enabled on
Checkout (§5), so an eligible customer sees and pays in their own local
currency automatically, with USD as the fallback whenever localized
presentment isn't available for them — this app never computes or stores a
second, non-USD price itself.

**Trial:** every new Premium subscription includes a **7-day free trial**
(`subscription_data.trial_period_days: 7` on the Checkout Session).

**First-payment refund window:** **7 days**, handled via the Stripe
Dashboard/support (§15) — this codebase does not implement self-service
refunds.

**Failed-payment grace period:** **7 days**. A `past_due` subscription keeps
Premium access for 7 days from when that status began, then loses it if the
payment still hasn't recovered (§11, `src/lib/billing/entitlement.ts`'s
`PAST_DUE_GRACE_PERIOD_DAYS`).

**Existing-user transition:** once enforcement is eventually activated,
every learner who already had an account receives a **30-day complimentary
Premium period** — a one-time grace window so no current learner loses
access the moment enforcement turns on. Not implemented by this PR
(enforcement itself stays off); the constant
(`EXISTING_USER_COMPLIMENTARY_PREMIUM_DAYS`, `src/lib/billing/policy.ts`) is
fixed now so the later enforcement-activation phase applies it consistently.

**Stripe Tax** is enabled on Checkout (`automatic_tax: { enabled: true }`) —
Stripe calculates and collects applicable VAT/sales tax per customer
jurisdiction; this app does not compute tax itself.

**Promotion codes** are enabled on Checkout (`allow_promotion_codes: true`)
now, ahead of a later Founding Learners Challenge that will use them — no
codes exist yet; enabling the capability is separate from creating any.

## 4. Feature-entitlement matrix

Approved product boundary — **Levels 1-2 are Free, Levels 3-6 are Premium**,
a simple, level-based split rather than per-feature caps.

| Feature | Free | Premium |
|---|---|---|
| Qur'an reader (full 114-surah Mushaf, Arabic/Pickthall/Kazimirski) | ✅ Full — Qur'an text is never paywalled | ✅ Full |
| Level 1 (Foundations of Arabic Script) | ✅ Full | ✅ Full |
| Level 2 (Basic Vocabulary and Patterns) | ✅ Full | ✅ Full |
| Level 3 (Roots and Word Patterns) | 🔒 Premium | ✅ Full |
| Level 4 (Core Grammar) | 🔒 Premium | ✅ Full |
| Level 5 (Guided Ayah Comprehension) | 🔒 Premium | ✅ Full |
| Level 6 (Surah Mastery) | 🔒 Premium | ✅ Full |
| Advanced practice and review | 🔒 Premium | ✅ Full |
| Future AI Tutor | 🔒 Premium (once shipped) | ✅ Full (once shipped) |
| Bookmarks / Notes | ✅ Full | ✅ Full |
| Basic progress tracking | ✅ Full | ✅ Full |

**Deliberate principle, unchanged: the Qur'an itself, its translations, and
canonical content are never gated.** Only the *learning product* (Levels
3-6, advanced practice/review) is — see the security note under §9/§10 for
what "gated" does and does not mean while enforcement is disabled.

## 5. Stripe Checkout flow

**Implemented** (`src/lib/billing/handlers/checkout.ts`), gated behind
`VITE_BILLING_CHECKOUT_ENABLED=false` client-side (§17) — every button that
would call this endpoint stays disabled while that flag is off, matching
this PR's "no live payment can happen" requirement.

1. Authenticated user clicks "Upgrade" (`/premium` or `/settings/billing`)
   and picks Monthly or Annual.
2. Client calls `POST /api/billing/checkout` with `{ plan: "monthly" |
   "annual" }` — **never** a raw Stripe Price id. The server route runs with
   `STRIPE_SECRET_KEY` (server-only, never shipped to the client — see
   `.env.example`) and resolves `plan` to a Price id itself, from
   `STRIPE_PRICE_ID_MONTHLY`/`STRIPE_PRICE_ID_ANNUAL` (`src/lib/billing/
   prices.ts`) — an unrecognized `plan` value is rejected with 400, never
   forwarded to Stripe.
3. Server authenticates the caller from their Supabase access token
   (`src/lib/billing/requestAuth.ts`, `Authorization: Bearer` header — this
   app's session lives in localStorage, not a cookie, so the client attaches
   it explicitly via `src/lib/billing/fetchClient.ts`), then creates a
   Stripe Checkout Session (`stripe.checkout.sessions.create`) with:
   - `mode: "subscription"`
   - `customer` — the user's existing `stripe_customer_id` if one exists in
     `billing_customers` (§8), else omitted (Stripe creates one, captured on
     the first webhook).
   - `client_reference_id` **and** `metadata.supabase_user_id` — the
     Supabase `auth.users.id`, set from the already-verified session, never
     from client input, so the webhook can always resolve the Stripe
     customer back to our user even if the customer-creation race (§13)
     hasn't written `billing_customers` yet.
   - `subscription_data: { trial_period_days: 7, metadata: {
     supabase_user_id } }` — the approved 7-day trial, and the same user-id
     metadata copied onto the Subscription object itself (not just the
     Session), so subscription-lifecycle webhooks can resolve the user
     without a customer-table lookup.
   - `adaptive_pricing: { enabled: true }` — Stripe Adaptive Pricing;
     eligible customers see and pay in their own local currency, USD
     fallback otherwise (§1-3).
   - `automatic_tax: { enabled: true }` — Stripe Tax.
   - `allow_promotion_codes: true` — ahead of the later Founding Learners
     Challenge.
   - `success_url` / `cancel_url` pointing back to `/settings/billing`, built
     from server-controlled `APP_BASE_URL` (`src/lib/billing/env.ts`) —
     **never** a request's own `Host` header, which a forged request could
     otherwise use to redirect a paying customer to an attacker-controlled
     origin after checkout.
4. Server returns the Checkout Session URL; client redirects
   (`window.location.href = url`) — no Stripe.js/Elements needed for a
   redirect-based Checkout flow, keeping the client bundle unchanged (and
   keeping Stripe's server SDK entirely out of it — verified, §21).
5. User completes payment on Stripe's hosted page. Stripe redirects back;
   the actual entitlement grant happens asynchronously via webhook (§7), not
   on this redirect — the redirect is UX only, never a trust boundary.

**Not yet verified against a live Stripe account**: no test-mode Stripe
credentials exist in this repository or its CI, so the exact request shape
above (particularly `adaptive_pricing` and the newer per-item
`current_period_end` location the webhook handler already defends against,
§13) has not been exercised against Stripe's real API. Verifying this is
one of the remaining setup steps before checkout can ever be turned on.

## 6. Stripe Customer Portal flow

1. `/settings/billing` (authenticated route) shows current plan/status read
   from `billing_subscriptions` (§8) — never a live Stripe API call on page
   load, for latency and to avoid a Stripe outage taking down the settings
   page.
2. "Manage billing" button calls `POST /api/billing/portal`, which creates a
   Stripe Billing Portal session (`stripe.billingPortal.sessions.create`) for
   the user's `stripe_customer_id`, and redirects.
3. In the Portal, the user can update payment method, view invoices, cancel,
   or switch Monthly↔Annual — all Stripe-hosted, no custom UI needed for any
   of it.
4. Every state change made in the Portal arrives back to us exclusively via
   webhook (§7) — the Portal itself never writes to Supabase directly.

## 7. Verified webhook lifecycle

Single endpoint, `POST /api/billing/webhook`, a Nitro server route with
`export const config = { bodyParser: false }` equivalent (raw body required
for signature verification).

1. Read the raw request body + `Stripe-Signature` header.
2. `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`
   — rejects (400) anything not signed by Stripe with our specific webhook
   secret. This is the entire trust boundary; nothing downstream trusts
   unauthenticated input.
3. Events handled (minimum set):
   - `checkout.session.completed` — link `client_reference_id` (our user id)
     to the Stripe `customer` id; upsert `billing_customers`.
   - `customer.subscription.created` / `.updated` — upsert
     `billing_subscriptions` (status, price id, current period end, cancel-
     at-period-end flag).
   - `customer.subscription.deleted` — mark `canceled`, entitlement revoked.
   - `invoice.payment_failed` — surface `past_due` (Stripe already retries
     per its own configured schedule; we mirror status, we don't reimplement
     dunning).
   - `invoice.paid` — confirms `active` (belt-and-suspenders alongside
     `customer.subscription.updated`).
4. Every handler is **idempotent** (§12) and **authorizes nothing by itself**
   — it only ever writes rows in `billing_*` tables (§8); the actual
   Premium-gate check (§10) reads those tables fresh on every request, so a
   webhook is never the last line of defense, only the source of truth it
   reads from.
5. Always return `200` once the event is durably recorded (even if our own
   downstream processing needs a retry) — return `4xx`/`5xx` only for
   signature failure or a genuine, retryable write failure, so Stripe's own
   webhook retry policy (exponential backoff, several days) does the right
   thing.

## 8. Supabase billing schema

**Implemented as a migration** —
`supabase/migrations/20260922100000_361f2ef3-3dc0-4a2a-be2d-2ae0575175a8.sql`
— rehearsed against a fresh local database (§19/§21), **not applied to
production** by this PR.

```sql
-- All monetary/identifier values from Stripe; never re-derive money math
-- ourselves. RLS: owning user can SELECT their own rows; no client INSERT/
-- UPDATE/DELETE anywhere — every write comes from the webhook handler using
-- the service-role key (server-only), matching this repo's existing
-- convention (content_sources, translation_segments, etc. are all
-- service-role-write / anon-read; see PHASE8C-CONTENT-SOURCE-GOVERNANCE.md).

CREATE TABLE public.billing_customers (
  user_id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id  text NOT NULL UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.billing_subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id       text NOT NULL,
  stripe_subscription_id   text NOT NULL UNIQUE,
  stripe_price_id          text NOT NULL,
  status                   text NOT NULL CHECK (status IN (
                             'trialing', 'active', 'past_due', 'canceled',
                             'unpaid', 'incomplete', 'incomplete_expired', 'paused'
                           )),
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  current_period_end       timestamptz,
  trial_end                timestamptz,
  -- When `status` most recently changed value -- entitlement.ts's past_due
  -- grace window is measured from this, not updated_at, so an unrelated
  -- field update never resets the grace clock.
  status_changed_at        timestamptz NOT NULL DEFAULT now(),
  -- The producing Stripe event's own `created` timestamp -- out-of-order
  -- protection (§13) compares against this, never arrival order.
  stripe_event_created_at  timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  processed_at             timestamptz
);
CREATE INDEX billing_subscriptions_user_idx ON public.billing_subscriptions (user_id);

-- Idempotency ledger (§12): one row per processed Stripe event id.
CREATE TABLE public.billing_webhook_events (
  stripe_event_id   text PRIMARY KEY,
  event_type        text NOT NULL,
  event_created_at  timestamptz,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz
);
```

`status` mirrors Stripe's own vocabulary verbatim, including `paused`
(Stripe's pause-collection state) alongside the original seven — no local
status is ever invented. `user_id` is always derived server-side from
`client_reference_id` / subscription `metadata`, or from an existing
`billing_customers` row keyed by Stripe customer id — never trusted from
client input (`src/lib/billing/webhookProcessing.ts`'s
`resolveUserIdForSubscription`). Entitlement itself is computed by the pure
`src/lib/billing/entitlement.ts` module (§10), not a SQL view — kept
in-process and unit-tested rather than pushed into the database layer.

## 9. Row-Level Security considerations

- `billing_customers`, `billing_subscriptions`: RLS enabled; `SELECT` policy
  `USING (user_id = auth.uid())`; **no** `INSERT`/`UPDATE`/`DELETE` policy for
  `anon`/`authenticated` at all — only the webhook handler (service-role key,
  bypasses RLS by design, exactly like every existing write-path in this
  schema) ever writes these tables. This makes "a client forges their own
  Premium status" structurally impossible, not just discouraged. Verified by
  rehearsal against a fresh local database (§19/§21) and by
  `entitlement.test.ts`/`webhookProcessing.test.ts`.
- `billing_webhook_events`: RLS enabled with **zero** policies for
  `anon`/`authenticated` at all — it's an internal idempotency ledger, never
  read by the client.
- **No new RLS policy is added to any existing table** (curriculum,
  progress, etc.) by this PR. See the security note immediately below for
  why that is a real, currently-open gap, not a settled design choice.

## 10. Server-enforced Premium authorization

**Never trust the client for entitlement.** Concretely, once enforcement is
enabled (it is not, in this PR — §10.1):

- `hasLevelAccess(levelNumber, subscription, now)`
  (`src/lib/billing/entitlement.ts`) is the single, pure, unit-tested
  function every gated surface must call — never a locally re-derived
  check. It reads `PREMIUM_ENFORCEMENT_ENABLED` itself, so a surface that
  calls it correctly can never accidentally gate while enforcement is off.
- A subscription snapshot for that check comes from `billing_subscriptions`,
  read fresh via the **service-role key**, on the server, on every gated
  action — not cached client-side beyond a short UI hint.
- Gated surfaces (Level 3-6 full lesson content, advanced practice/review)
  must check entitlement in the same server-side data-fetching functions
  that already exist (`findCurriculumEntryPoint`, `fetchLessonForPlayer`,
  etc.) — this PR does not yet add that call (§10.1's security note is
  exactly why: the call alone would not be sufficient today).
- The client-side UI (upgrade banners, locked-lesson badges) is a courtesy
  layer only — read from `GET /api/billing/status` for instant UI feedback,
  but **every** gated read/write must be re-checked server-side regardless
  of what the client believes.

### 10.1. Security note: this foundation does not yet secure Levels 3-6 content

**This is the single most important caveat in this document, and it applies
right now, not as a future hypothetical.**

Confirmed directly against this schema (`tests/e2e/16-curriculum-schema.spec.ts`,
"curriculum hierarchy can be read publicly"): `lesson_sections`,
`lesson_exercises`, and every other curriculum table grant **open `SELECT`**
to any caller holding the app's own publishable/anon key — which is, by
design, shipped in every browser bundle and printed in this repository's own
`.env.example`. This is intentional and correct for today's all-free
product (anonymous visitors and Free learners alike need to browse the
curriculum), but it means:

- **A TanStack Start server loader that adds an entitlement check is not a
  security boundary by itself.** The loader and the browser both ultimately
  read the same anon-key-governed PostgREST endpoint. Adding a check inside
  application code changes what the *loader* returns; it does not change
  what `GET /rest/v1/lesson_sections?...` returns to a direct caller. A
  browser's own DevTools, or a two-line script, can already read a Level 6
  lesson's full body and exercises today, entitlement check or not — the
  same way this project's own "KNOWN GAP" test
  (`tests/e2e/58-level6-batch1-al-fatiha-surah-study.spec.ts`) already
  documents for route-level gating.
- **A visual lock (a "Locked"/"Premium" badge, a disabled button, a redirect
  in a page component) is UX, not enforcement.** It stops a learner from
  casually clicking into content the UI doesn't want to show them yet; it
  does not stop a request that skips the UI entirely.
- Therefore: **`PREMIUM_ENFORCEMENT_ENABLED` must stay `false`** — and no
  future PR should flip it to `true` — **until** Levels 3-6 lesson content
  is delivered through one of:
  1. A genuinely server-authorized content path (e.g., a server-only
     handler using the service-role key that checks entitlement *before*
     returning section/exercise bodies, with the public anon-key path
     returning only enough metadata to render a locked-preview state — never
     the real body/exercise content); **or**
  2. A redesigned RLS model on the curriculum tables themselves that ties
     row visibility (or at minimum, sensitive columns) to a verified
     entitlement, not just table membership.
  Either is a real, separately-scoped, separately-reviewed engineering
  phase — not a follow-up config flag flip.
- **This foundation leaves current access completely unchanged.** No RLS
  policy on any curriculum table is added, removed, or modified by this PR;
  no lesson content, migration, or activation wiring for any level is
  touched; `PREMIUM_ENFORCEMENT_ENABLED=false` and
  `VITE_BILLING_CHECKOUT_ENABLED=false` together mean nothing about who can
  read what changes as a result of merging this work.

## 11. Subscription states

`trialing`, `active`, `past_due`, `canceled`, `unpaid`, `incomplete`,
`incomplete_expired` (Stripe's own terminal state for an abandoned first
payment), and `paused` (Stripe's pause-collection state) — all eight stored
verbatim in `billing_subscriptions.status` (never remapped/renamed), so the
CHECK constraint and every webhook handler stay a 1:1 mirror of Stripe's own
model — no local reinterpretation to drift out of sync.

| Status | Entitlement |
|---|---|
| `trialing`, `active` | Premium granted |
| `past_due` | Premium **still granted** for **7 days** from when the status began (Stripe is retrying payment; don't punish a learner mid-lesson for a card decline — §1-3, §23), then revoked |
| `canceled` | Premium granted only through `current_period_end` if `cancel_at_period_end` was true at cancellation (already-paid period honored); revoked immediately if canceled outside that (e.g. an immediate admin/refund cancellation) |
| `unpaid`, `incomplete`, `incomplete_expired`, `paused` | No entitlement — checkout/payment never completed, subscription suspended, or collection paused |

Implemented, pure and unit-tested: `src/lib/billing/entitlement.ts`
(`isPremiumEntitled`, `entitlement.test.ts`).

## 12. Idempotent webhook processing

Every webhook request: `INSERT INTO billing_webhook_events (stripe_event_id,
event_type) VALUES (...) ON CONFLICT (stripe_event_id) DO NOTHING RETURNING
*`. If no row is returned (conflict — already processed), return `200`
immediately without re-running the handler. This makes Stripe's own retry
behavior (it retries on anything but a clean `2xx`, and can also occasionally
redeliver a successfully-received event) safe by construction — a handler
never runs twice for the same event id. Handler bodies themselves also use
`upsert` (`onConflict: stripe_subscription_id`) rather than blind insert, as
defense in depth against the same event being processed through two
different code paths.

## 13. Webhook replay and out-of-order delivery handling

- **Out-of-order delivery** (Stripe does not guarantee event order): every
  `billing_subscriptions` upsert includes the event's own
  `data.object.created`/Stripe `event.created` timestamp compared against
  the stored row's `updated_at` — **only apply the write if the incoming
  event is newer**, so a delayed `customer.subscription.updated` from before
  a more recent one can never regress the stored state. This is the same
  "last-writer-wins by timestamp, not by arrival order" principle already
  used in this codebase for lesson-position persistence
  (`createSerialLatestQueue` in `src/lib/curriculum.ts`) — same class of
  problem, same resolution strategy.
- **Manual replay** (Stripe Dashboard → Events → Resend, or the CLI's
  `stripe events resend`): safe by construction via §12's idempotency ledger
  — a resend of an already-processed event is a guaranteed no-op.
- **Customer-creation race**: if `checkout.session.completed` and
  `customer.subscription.created` arrive in the "wrong" order (subscription
  event before we've linked the Stripe customer to our user), the
  subscription handler upserts `billing_customers` itself from
  `event.data.object.customer` + the Checkout Session's
  `client_reference_id` (re-fetched via the Stripe API if not present on the
  event payload) rather than assuming `billing_customers` already exists.

## 14. Cancellation and reactivation

- **Cancel** (via Portal): Stripe defaults to "cancel at period end" —
  `cancel_at_period_end=true` fires a `customer.subscription.updated`; we
  store it and keep entitlement through `current_period_end` (§11). An
  **immediate** cancel fires `customer.subscription.deleted` directly;
  entitlement revoked on receipt.
- **Reactivate before period end** (user changes their mind while
  `cancel_at_period_end=true`): handled entirely in the Portal (Stripe lets
  a customer undo a scheduled cancellation there); arrives to us as another
  `customer.subscription.updated` with `cancel_at_period_end=false`.
- **Resubscribe after full cancellation**: a fresh Checkout session (§5);
  Stripe attaches the new subscription to the *same* `stripe_customer_id`
  when we pass the existing customer, so billing history stays unified.

## 15. Refund behavior

- Refunds are issued in the Stripe Dashboard (owner/support action, not a
  feature this app's UI exposes at launch — see §23 "Refund policy").
- A refund does **not** by itself change subscription status in Stripe's
  model — it's a separate `charge.refunded` event. Minimum handling: log it
  (extend `billing_webhook_events`' `event_type` handling to record
  `charge.refunded` for support visibility) without automatically revoking
  entitlement — a full-period refund policy is an owner decision (§23); if
  approved, the same handler can then also cancel the subscription
  (`stripe.subscriptions.cancel`) server-side to keep both systems
  consistent.

## 16. Local and Stripe test-mode strategy

- **Stripe test mode** (`sk_test_...`/`pk_test_...` keys, a completely
  separate object graph from live mode) for all local development and CI —
  never live keys anywhere but the production environment's secret store.
- **Local webhook delivery**: `stripe listen --forward-to
  localhost:4300/api/billing/webhook` (Stripe CLI) during local dev — mirrors
  this repo's existing "local Supabase stack, real but disposable" philosophy
  (`ensure-local-test-user.mjs`) rather than mocking Stripe's event shape by
  hand.
- **Automated tests never call real Stripe.** Unit tests
  (`src/lib/billing.test.ts`) mock the Stripe SDK exactly like
  `kazimirski.test.ts` mocks the Supabase client (`vi.doMock`) — testing our
  own webhook-handling and entitlement logic against hand-constructed event
  payloads, not live API calls. E2E tests exercise the Checkout/Portal
  *redirect* (that we generate the right URL and land back correctly) without
  completing a real card payment — Stripe test mode also provides fixed test
  card numbers for a true end-to-end manual QA pass outside CI.
- **CI** never holds live or even test Stripe secrets unless a maintainer
  deliberately adds them as GitHub secrets for this feature — none are
  required for the currently-existing `ci.yml`/`production-validation.yml`
  gates, and none should be added until implementation begins.

## 17. Required secret and environment-variable names (names only, no values)

| Name | Scope | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Server-only (Cloudflare Worker secret / GitHub Actions secret for the `production` environment) | Never `VITE_`-prefixed — must never reach the client bundle. `src/lib/billing/stripe.ts`. |
| `STRIPE_WEBHOOK_SECRET` | Server-only | Per-endpoint signing secret from the Stripe Dashboard/CLI. `src/lib/billing/handlers/webhook.ts`. |
| `STRIPE_PRICE_ID_MONTHLY` | Server-only | Stripe Price id for the Monthly plan. `src/lib/billing/prices.ts`. |
| `STRIPE_PRICE_ID_ANNUAL` | Server-only | Stripe Price id for the Annual plan. `src/lib/billing/prices.ts`. |
| `APP_BASE_URL` | Server-only | Checkout/Portal return-URL origin — never derived from a request's own `Host` header. `src/lib/billing/env.ts`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, already documented in `.env.example` as platform-managed | First actually *used* by application code in this PR — `src/lib/billing/supabaseAdmin.ts`, the only path with write access to the three billing tables. |
| `VITE_BILLING_CHECKOUT_ENABLED` | Client-safe, build-time only | `"true"` / `"false"` (or unset, which defaults to disabled — only the exact string `"true"` enables). Gates every checkout-initiating button. `src/lib/billing/checkoutFlag.ts`. Sourced in production from the `production` GitHub Actions **environment variable** of the same name (never a secret), read by `.github/workflows/production-deploy.yml`'s build step with a `|| 'false'` fallback. Currently unset/`false` in production — see §19.1 for the controlled rollout that changes it. |

Every value above is a test-mode placeholder in `.env.example` only. No real
(live or test) value for any of these was entered, requested, printed,
committed, or pushed while producing this PR.

## 18. Threat model

| Threat | Mitigation |
|---|---|
| Client forges "I'm Premium" | Entitlement is never client-asserted; §10's server-side check reads `billing_subscriptions` via the service-role key on every gated request; RLS (§9) blocks any client write to billing tables entirely |
| Forged/replayed webhook request | Stripe signature verification (§7.2) on every request; no handler trusts an unsigned payload |
| Webhook replay used to re-grant a canceled subscription | Idempotency ledger (§12) + newer-event-wins ordering (§13) — a replayed old "active" event can't override a newer "canceled" one |
| Stolen/leaked `STRIPE_SECRET_KEY` | Server-only secret, never bundled (same class of protection already relied on for `SUPABASE_SERVICE_ROLE_KEY`, per `security.spec.ts`'s existing "no service-role key in the shipped client bundle" test — the same test pattern extends to this key) |
| User enumeration via Checkout/Portal errors | Both server routes return generic errors to the client; detailed Stripe error text logged server-side only |
| Double-charging via a duplicate Checkout session | Stripe Checkout Sessions are single-use by design; no server-side retry logic re-creates a session for an already-completed one |
| Price tampering (client sends an arbitrary `priceId`) | Client only ever sends `plan: "monthly" \| "annual"` (§5); server rejects any other value with 400 and resolves the real Price id itself from `STRIPE_PRICE_ID_MONTHLY`/`STRIPE_PRICE_ID_ANNUAL` (§17) — a raw client-supplied Price id is never accepted or forwarded to Stripe. Regression-tested, `checkout.test.ts`. |
| A canceled-but-still-in-period user is denied access early, or a truly expired one keeps access | Covered by §11/§14's explicit state table; regression-tested, `entitlement.test.ts` (§21) |
| Enforcement accidentally turned on before curriculum content is actually secured | `PREMIUM_ENFORCEMENT_ENABLED` is a single, named, unit-tested constant (§10.1); flipping it is a deliberate, separately-reviewed code change, not a config toggle a deploy could flip silently |

## 19. Migration plan

Steps 1-4 and 6 below are complete as of the `feat/controlled-checkout-
enablement` PR. **Step 5 (enforcement gating) is still explicitly NOT
performed** — no lesson/review/practice surface reads `hasLevelAccess`,
and `PREMIUM_ENFORCEMENT_ENABLED` stays hard-coded `false` regardless of
everything else below.

1. ✅ `supabase/migrations/20260922100000_361f2ef3-3dc0-4a2a-be2d-2ae0575175a8.sql`
   — creates the three tables in §8, RLS policies in §9, indexes, and
   nothing else. Purely additive; touches no existing table. Applied to
   production; migration history is synchronized.
2. ✅ The four server routes (`/api/billing/checkout`, `/api/billing/
   portal`, `/api/billing/webhook`, `/api/billing/status`) are deployed
   and live in production (`src/lib/billing/`, wired into `src/server.ts`,
   §5-§7).
3. ✅ The production Stripe webhook destination exists and points at the
   deployed URL.
4. ✅ The secrets in §17 are configured as Cloudflare Worker bindings
   (confirmed present by name via `wrangler secret list` — never by
   value).
5. ⬜ Add `hasLevelAccess` gating to the specific lesson/review/practice
   surfaces the entitlement matrix (§4) names — **blocked on §10.1's
   server-authorized-content-delivery phase**, not merely on this step
   being scheduled. Not part of this PR or the rollout in §19.1 below.
6. ✅ `/premium` and `/settings/billing` UI routes — implemented, both
   locales, verified rendering correctly in production. Checkout buttons
   are wired to `POST /api/billing/checkout` (this PR) but stay disabled
   while `VITE_BILLING_CHECKOUT_ENABLED` is unset or `"false"` — its
   current, safe production value.

Each step is independently revertable; step 1 (the migration) is the only
one that touches the database, and it's purely additive (new tables only).

### 19.1. Controlled checkout enablement (this PR)

`feat/controlled-checkout-enablement` makes checkout enablement itself a
reviewable, single-variable production change, distinct from deploying the
checkout-capable code and distinct from enabling premium-content
enforcement — **these are three separate actions**, never bundled:

1. Deploy this PR's code with the production `VITE_BILLING_CHECKOUT_
   ENABLED` GitHub Actions **environment variable** (`production`
   environment, Settings → Environments → production → Variables — never
   Secrets, this value isn't a credential) absent or set to `"false"`.
   `.github/workflows/production-deploy.yml`'s build step already
   defaults to `"false"` when the variable is unset
   (`${{ vars.VITE_BILLING_CHECKOUT_ENABLED || 'false' }}`) — deploying
   with no action at all keeps checkout exactly as disabled as it is
   today.
2. Merge and deploy through the normal pipeline. Checkout stays disabled;
   `/premium` and `/settings/billing` render identically to today.
3. Verify production remains healthy (`/api/billing/status` still 200s,
   both locales still render, `PREMIUM_ENFORCEMENT_ENABLED` still `false`).
4. **Privately** (never in this repository, a commit, a PR, or a workflow
   log) confirm:
   - `STRIPE_SECRET_KEY` belongs to the intended Stripe mode/account (test
     vs. live) for this launch;
   - `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_ANNUAL` belong to that
     same mode/account — a live price id paired with a test secret key (or
     vice versa) fails every Checkout Session creation;
   - `STRIPE_WEBHOOK_SECRET` belongs to the webhook destination actually
     receiving events for this deployment;
   - `APP_BASE_URL` equals the real production origin (Checkout/Portal
     success and cancel redirects use it directly, §5/§6).
   This mode-consistency check requires reading secret values Cloudflare
   never exposes to `wrangler secret list` — it can only be done by
   whoever has dashboard access to Stripe and Cloudflare, not by CI or by
   this document.
5. Set the `production` environment's `VITE_BILLING_CHECKOUT_ENABLED`
   GitHub Actions variable to `"true"` (exact string — see
   `checkoutFlag.ts`/§17).
6. Run a new, approved production deployment (rebuilds the client bundle
   with the flag compiled in — this is a build-time flag, not a runtime
   toggle; an already-deployed bundle never picks up a variable change
   without a fresh build).
7. Perform one controlled checkout end-to-end (a real or Stripe
   test-mode purchase, per whichever mode step 4 confirmed).
8. Verify the Stripe webhook delivered successfully and the corresponding
   `billing_customers`/`billing_subscriptions` rows landed in Supabase.
9. Verify the Customer Portal (`/api/billing/portal`, §6) and a
   cancellation flow both work end-to-end.
10. Keep `PREMIUM_ENFORCEMENT_ENABLED=false` until a separate, later,
    separately-reviewed phase (§10.1, §19 step 5) enables entitlement
    enforcement — accepting payments and gating content are independent
    decisions, and this rollout only ever does the former.

## 20. Rollback plan

- **Before launch**: delete the unreleased routes/UI; drop the three new
  tables (`DROP TABLE` migration) — nothing else references them, so this is
  a clean, total rollback with zero blast radius on existing functionality.
- **After launch, needing to disable billing**: turn off Stripe webhook
  delivery (Dashboard) and hide the `/premium` upgrade entry points; leave
  the tables and existing subscriptions alone (safer than deleting paying
  customers' records) — `requirePremium` gates simply stop being reachable
  from new signups but honor existing entitlements until their period ends.
- **Data integrity rollback**: because every billing table is populated
  exclusively from Stripe's own webhook events (never hand-edited), the
  tables can always be fully rebuilt by replaying Stripe's event history
  (`stripe events list` + resend, or a one-off backfill script reading the
  Stripe API directly) if local state is ever suspected to have drifted —
  Stripe itself remains the single source of truth throughout.

## 21. Unit, integration and E2E acceptance criteria

**Unit** (`src/lib/billing.test.ts`, Vitest, mocked Stripe/Supabase clients
— same pattern as `kazimirski.test.ts`):
- `requirePremium` returns true for `active`/`trialing`, false for
  `unpaid`/`incomplete`/`incomplete_expired`.
- `canceled` returns true iff `now() < current_period_end`, false after.
- `past_due` returns true within the grace window (§23), false after.
- Webhook event ordering: a stale event (older `event.created`) never
  overwrites a newer stored row.
- Idempotency: processing the same `stripe_event_id` twice results in
  exactly one applied state change.
- Price-id validation rejects any `priceId` not in the known set.

**Integration** (webhook handler against a disposable/local Postgres or the
local Supabase stack, hand-constructed Stripe event fixtures — no real
Stripe network calls, matching this repo's existing disposable-database test
convention, e.g. `scripts/db-migration-tests/*.test.sh`):
- Full `checkout.session.completed` → `billing_customers` row created.
- Full subscription lifecycle (`created` → `updated` [`past_due`] →
  `updated` [`active`] → `deleted`) leaves the correct final `status`.
- Out-of-order delivery of two `updated` events leaves the newer one's state
  standing regardless of arrival order.
- Replaying an already-processed event id changes nothing.

**E2E** (Playwright, Stripe test mode, real test-mode Checkout redirect):
- A Free user sees the correct locked/preview state on a gated surface and
  a working "Upgrade" CTA.
- Completing test-mode Checkout (using Stripe's published test card) results
  in `/settings/billing` reflecting `active` and the gated surface unlocking,
  once the local `stripe listen` forwarder has delivered the webhook.
- Canceling in the Portal (simulated via the Stripe test-mode API rather
  than driving Stripe's own hosted Portal UI with Playwright) is reflected
  correctly and entitlement persists through the paid period, per §11.
- EN and FR locales both render every new billing string correctly (same
  `dictionaries.fr: typeof en` structural guarantee already in place for
  every other string in this app — extend `src/locales/{en,fr}` with a new
  `billing` namespace the same way every other feature namespace was added).

## 22. Monitoring and customer-support requirements

- **Webhook health**: alert if the webhook endpoint's error rate rises (mirrors
  the existing GitHub Actions `production-deploy.yml` job-summary pattern —
  a lightweight step/log line is enough at this scale, not a new monitoring
  platform) or if `billing_webhook_events` stops receiving rows for an
  extended period (silent delivery failure).
- **Reconciliation job** (periodic, e.g. a scheduled Cloudflare Cron Trigger
  or GitHub Actions scheduled workflow — this repo already uses scheduled/
  triggered Actions workflows for `production-deploy.yml`'s `workflow_run`
  pattern): compares Stripe's live subscription list for each known customer
  against `billing_subscriptions`, flags drift, never auto-corrects without
  a human review.
- **Support tooling**: a minimal internal view (SQL, or a small admin page
  later) joining `billing_customers`/`billing_subscriptions` to
  `auth.users`/`profiles` so support can answer "what plan is this user on"
  without touching the Stripe Dashboard directly for routine questions.
- **Audit trail**: `billing_webhook_events` itself is the audit log (every
  event, when received, when processed) — no separate logging table needed
  at this scale.

## 23. Owner decisions — resolved

All of the following are now approved and reflected throughout this
document and the `feat/payment-foundation` implementation:

1. **Monthly price**: **$3.99 USD** (§1-3).
2. **Annual price**: **$29.99 USD** (§1-3) — ~37% cheaper than 12× monthly.
3. **Trial policy**: **7 days** (§1-3, §5).
4. **Free/Premium feature division**: **Levels 1-2 Free, Levels 3-6
   Premium** (§4) — a level-based split, not per-feature caps.
5. **Refund policy**: **7-day first-payment refund window**, support-issued
   via the Stripe Dashboard, not self-service (§1-3, §15).
6. **Tax handling**: **Stripe Tax enabled** (§1-3, §5) — Stripe determines
   jurisdiction and collects accordingly; not manually configured per
   country by this app.
7. **Supported countries**: not separately restricted by this
   implementation — left at Stripe Checkout's own defaults; a future,
   separately-authorized change if a specific restriction is ever needed.
8. **Supported currencies**: **Stripe Adaptive Pricing enabled**, USD
   fallback (§1-3, §5) — not a single fixed currency.

Two decisions beyond the original eight, made alongside these:

9. **Failed-payment grace period**: **7 days** (§1-3, §11) — how long a
   `past_due` subscription keeps Premium before losing it.
10. **Existing-user transition**: **30-day complimentary Premium** once
    enforcement activates (§1-3) — not implemented by this PR; the constant
    is fixed for the later activation phase.

Promotion-code support (`allow_promotion_codes: true`) is enabled ahead of
a later Founding Learners Challenge (§1-3, §5) — no codes exist yet.

---

*No live Stripe connection, product, price, or webhook was created while
producing this document or the `feat/payment-foundation` implementation. No
payment, live or test, was accepted. The billing migration (§8, §19) exists
in the repository but was not applied to production. Premium enforcement
(`PREMIUM_ENFORCEMENT_ENABLED`) and client-side checkout
(`VITE_BILLING_CHECKOUT_ENABLED`) are both disabled.*

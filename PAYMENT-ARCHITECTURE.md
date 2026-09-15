# Payment & Premium Entitlement Architecture

**Status:** Design only. Not implemented. No Stripe account, product, price, or
webhook endpoint has been created. No billing table has been migrated. No
payment has been accepted. This document is implementation-ready but requires
the owner decisions in §23 before any code lands.

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

| Plan | Price (owner-approved, see §23) | Billing period | Target learner |
|---|---|---|---|
| **Free** | $0 | — | Everyone; full Level 1 access, limited beyond |
| **Premium Monthly** | *TBD* | Monthly, recurring | Learners who want month-to-month flexibility |
| **Premium Annual** | *TBD* | Annual, recurring | Committed learners; priced at a discount vs. 12× monthly |

No price is proposed here — see §23. Both Premium tiers grant identical
entitlements; they differ only in billing cadence and price. A single Stripe
Product (`quranroots_premium`) with two Prices (`monthly`, `annual`) is
sufficient — no separate product per cadence.

## 4. Feature-entitlement matrix

Derived from what's actually implemented today (curriculum, Qur'an reader,
memorization, review, progress) — not invented features.

| Feature | Free | Premium |
|---|---|---|
| Level 1 (Foundations of Arabic Script) — all 8 modules, 33 lessons | ✅ Full | ✅ Full |
| Levels 2–5 (Vocabulary, Roots, Grammar, Guided Comprehension) | 🔒 Preview only (first lesson of each level) | ✅ Full |
| Qur'an reader (full 114-surah Mushaf, Arabic/Pickthall/Kazimirski) | ✅ Full — Qur'an text is never paywalled | ✅ Full |
| Bookmarks / Notes | ✅ Full | ✅ Full |
| Memorization tracker + spaced-repetition review | 🔒 Capped (e.g. 5 active Ayahs) | ✅ Unlimited |
| Daily Study plan | ✅ Full | ✅ Full |
| Practice / concept review | 🔒 Capped daily sessions | ✅ Unlimited |
| Progress dashboard | ✅ Full | ✅ Full |
| Audio (recitation, memorization playback) | ✅ Full | ✅ Full |
| Word-frequency / roots explorer | ✅ Full | ✅ Full |

**Deliberate principle: the Qur'an itself, its translations, and canonical
content are never gated.** Only the *learning product* (curriculum depth,
review capacity) is. Exact caps are a product decision — see §23 ("Free/
Premium feature division"); the table above is a starting proposal, not
final.

## 5. Stripe Checkout flow

1. Authenticated user clicks "Upgrade" (new `/premium` or `/settings/billing`
   route) and picks Monthly or Annual.
2. Client calls a new server route/function — `POST /api/billing/checkout`
   (a Nitro/TanStack Start server route, colocated with the existing
   `src/routes/` tree) — with `{ priceId }`. The server route runs with the
   `STRIPE_SECRET_KEY` (server-only secret, never shipped to the client,
   matching the existing convention that only `VITE_`-prefixed values reach
   the browser — see `.env.example`).
3. Server creates a Stripe Checkout Session
   (`stripe.checkout.sessions.create`) with:
   - `mode: "subscription"`
   - `customer` — the user's existing `stripe_customer_id` if one exists in
     `billing_customers` (§8), else omitted (Stripe creates one, captured on
     the first webhook).
   - `client_reference_id` — the Supabase `auth.users.id`, so the webhook can
     always resolve the Stripe customer back to our user even if the
     customer-creation race (§13) hasn't written `billing_customers` yet.
   - `success_url` / `cancel_url` pointing back to `/settings/billing`.
4. Server returns the Checkout Session URL; client redirects
   (`window.location.href = url`) — no Stripe.js/Elements needed for a
   redirect-based Checkout flow, keeping the client bundle unchanged.
5. User completes payment on Stripe's hosted page. Stripe redirects back;
   the actual entitlement grant happens asynchronously via webhook (§7), not
   on this redirect — the redirect is UX only, never a trust boundary.

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

## 8. Supabase billing schema proposal (design only — not migrated)

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
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id      text NOT NULL,
  stripe_subscription_id  text NOT NULL UNIQUE,
  stripe_price_id         text NOT NULL,
  status                  text NOT NULL CHECK (status IN (
                            'trialing','active','past_due','canceled','unpaid','incomplete',
                            'incomplete_expired'
                          )),
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  current_period_end      timestamptz,
  trial_end               timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_subscriptions_user_idx ON public.billing_subscriptions (user_id);

-- Idempotency ledger (§12): one row per processed Stripe event id.
CREATE TABLE public.billing_webhook_events (
  stripe_event_id  text PRIMARY KEY,
  event_type       text NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now(),
  processed_at     timestamptz
);
```

`user_id` derived server-side from `client_reference_id` /
`customer.metadata`, never trusted from client input. A future
`entitlements` view (`is_premium = status IN ('trialing','active') OR
(status='canceled' AND current_period_end > now())` — see §14) can be added
as a plain SQL view, not a new table, once the exact grace-period policy is
approved (§23).

## 9. Row-Level Security considerations

- `billing_customers`, `billing_subscriptions`: RLS enabled; `SELECT` policy
  `USING (user_id = auth.uid())`; **no** `INSERT`/`UPDATE`/`DELETE` policy for
  `anon`/`authenticated` at all — only the webhook handler (service-role key,
  bypasses RLS by design, exactly like every existing write-path in this
  schema) ever writes these tables. This makes "a client forges their own
  Premium status" structurally impossible, not just discouraged.
- `billing_webhook_events`: no RLS policy needed for `anon`/`authenticated`
  at all (no grant) — it's an internal idempotency ledger, never read by the
  client.
- No new RLS policy is needed on any *existing* table (curriculum, progress,
  etc.) for this design — entitlement gating happens at the application/
  server layer (§10), not by restricting row visibility, because Free users
  still need to *see* Level 2+ exists (as a locked preview), just not consume
  its full content.

## 10. Server-enforced Premium authorization

**Never trust the client for entitlement.** Concretely:

- A `requirePremium(userId)` server-side helper (new `src/lib/billing.ts`,
  mirroring this repo's existing `src/lib/*.ts` server-logic modules) reads
  `billing_subscriptions` fresh (`status IN ('trialing','active')`, or
  `'canceled'` still within `current_period_end` — see §14) via the
  **service-role key**, on the server, on every gated action — not cached
  client-side beyond a short UI hint.
- Gated surfaces (Level 2+ full lesson content, unlimited memorization/
  review) check entitlement in the same server-side data-fetching functions
  that already exist (`findCurriculumEntryPoint`, `fetchLessonForPlayer`,
  etc.) — add an entitlement check alongside the existing lesson-existence
  check, returning a distinct "requires Premium" result the UI renders as an
  upgrade prompt, not a 404 or a silent redirect.
- The client-side UI (upgrade banners, locked-lesson badges) is a courtesy
  layer only — read from the same `billing_subscriptions` row via a
  `useQuery` for instant UI feedback, but **every** gated read/write is
  re-checked server-side regardless of what the client believes.

## 11. Subscription states

`trialing`, `active`, `past_due`, `canceled`, `unpaid`, `incomplete` (plus
`incomplete_expired`, Stripe's own terminal state for an abandoned first
payment) — all six required states plus one Stripe also emits, all stored
verbatim in `billing_subscriptions.status` (never remapped/renamed), so the
CHECK constraint and every webhook handler stay a 1:1 mirror of Stripe's own
model — no local reinterpretation to drift out of sync.

| Status | Entitlement |
|---|---|
| `trialing`, `active` | Premium granted |
| `past_due` | Premium **still granted** (Stripe is retrying payment; don't punish a learner mid-lesson for a card decline) for a bounded grace window (owner decision, §23), then treated as `canceled` |
| `canceled` | Premium granted only through `current_period_end` if `cancel_at_period_end` was true at cancellation (already-paid period honored); revoked immediately if canceled outside that (e.g. an immediate admin/refund cancellation) |
| `unpaid`, `incomplete`, `incomplete_expired` | No entitlement — checkout/payment never completed or subscription suspended |

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
| `STRIPE_SECRET_KEY` | Server-only (Cloudflare Worker secret / GitHub Actions secret for the `production` environment) | Never `VITE_`-prefixed — must never reach the client bundle |
| `STRIPE_WEBHOOK_SECRET` | Server-only | Per-endpoint signing secret from the Stripe Dashboard/CLI |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client-safe | Only needed if a future iteration uses Stripe.js/Elements directly instead of a pure Checkout redirect; not required by the redirect-only flow in §5 |
| `STRIPE_PRICE_ID_MONTHLY` | Server-only (or a repo constant, not secret) | Stripe Price id for the Monthly plan |
| `STRIPE_PRICE_ID_ANNUAL` | Server-only (or a repo constant, not secret) | Stripe Price id for the Annual plan |

No value for any of these is proposed, read, or required by this document.

## 18. Threat model

| Threat | Mitigation |
|---|---|
| Client forges "I'm Premium" | Entitlement is never client-asserted; §10's server-side check reads `billing_subscriptions` via the service-role key on every gated request; RLS (§9) blocks any client write to billing tables entirely |
| Forged/replayed webhook request | Stripe signature verification (§7.2) on every request; no handler trusts an unsigned payload |
| Webhook replay used to re-grant a canceled subscription | Idempotency ledger (§12) + newer-event-wins ordering (§13) — a replayed old "active" event can't override a newer "canceled" one |
| Stolen/leaked `STRIPE_SECRET_KEY` | Server-only secret, never bundled (same class of protection already relied on for `SUPABASE_SERVICE_ROLE_KEY`, per `security.spec.ts`'s existing "no service-role key in the shipped client bundle" test — the same test pattern extends to this key) |
| User enumeration via Checkout/Portal errors | Both server routes return generic errors to the client; detailed Stripe error text logged server-side only |
| Double-charging via a duplicate Checkout session | Stripe Checkout Sessions are single-use by design; no server-side retry logic re-creates a session for an already-completed one |
| Price tampering (client sends an arbitrary `priceId`) | Server validates `priceId` against the two known constants (§17) before creating a Checkout Session — never passes client input straight to Stripe |
| A canceled-but-still-in-period user is denied access early, or a truly expired one keeps access | Covered by §11/§14's explicit state table; regression-tested (§21) |

## 19. Migration plan

**Not executed. Design only, for a future, separately-authorized phase.**

1. `supabase/migrations/<ts>_<uuid>.sql` — creates the three tables in §8,
   RLS policies in §9, indexes, and nothing else. Purely additive; touches
   no existing table.
2. Deploy the three new server routes (`/api/billing/checkout`,
   `/api/billing/portal`, `/api/billing/webhook`) alongside the existing
   TanStack Start route tree — no change to any existing route.
3. Configure the Stripe webhook endpoint in the Stripe Dashboard (test mode
   first, then live) pointing at the deployed URL.
4. Add the secrets in §17 to the Cloudflare Worker / GitHub Actions
   `production` environment (same protected-environment mechanism already
   used for `CLOUDFLARE_API_TOKEN`, per `DEPLOYMENT.md`).
5. Add `requirePremium` gating to the specific lesson/review/practice
   surfaces the entitlement matrix (§4) names, once §23's exact division is
   approved.
6. Add the `/premium` and `/settings/billing` UI routes.

Each step is independently revertable; step 1 (the migration) is the only
one that touches the database, and it's purely additive (new tables only).

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

## 23. Decisions requiring owner approval

None of the following are decided by this document; implementation of
anything price- or policy-dependent waits on these:

1. **Monthly price.**
2. **Annual price** (and the discount-vs-monthly framing).
3. **Trial policy** — free trial length, if any (0 days is a valid answer).
4. **Free/Premium feature division** — §4's matrix is a starting proposal
   only (which levels/how much preview, memorization/review caps).
5. **Refund policy** — window, conditions, whether self-service or
   support-only.
6. **Tax handling** — whether Stripe Tax is enabled, which jurisdictions
   collect VAT/sales tax.
7. **Supported countries** — which countries Checkout is offered in.
8. **Supported currencies** — single currency (e.g. USD) vs.
   Stripe-localized presentment currencies.

---

*No live Stripe connection, product, price, webhook, or billing table was
created while producing this document. No payment was accepted. No Supabase
migration was executed.*

-- Payment foundation: additive billing schema only. Creates three new
-- tables (billing_customers, billing_subscriptions, billing_webhook_events)
-- and nothing else -- no existing table (curriculum, progress, profiles,
-- auth) is touched, altered, or read here. See PAYMENT-ARCHITECTURE.md for
-- the full design this migration implements (§8 schema, §9 RLS, §11
-- subscription states, §12 idempotency, §13 out-of-order handling).
--
-- *** NOT APPLIED TO PRODUCTION BY THIS COMMIT. *** Premium enforcement
-- (src/lib/billing/entitlement.ts's PREMIUM_ENFORCEMENT_ENABLED) is
-- hard-coded false regardless of this schema's existence -- applying this
-- migration alone changes nothing about who can access what; see that
-- module's own comment and PAYMENT-ARCHITECTURE.md's security note for why
-- a further, separately-reviewed phase is required before enforcement can
-- safely turn on.
--
-- Money/identifier values are never re-derived locally -- every column here
-- is either a direct mirror of a Stripe field or bookkeeping metadata
-- (received_at/processed_at). Status values mirror Stripe's own vocabulary
-- verbatim (CHECK constraint below), never remapped to a local model.
--
-- WRITES: every row in these three tables is written exclusively by the
-- server-side webhook handler using the service-role key (bypasses RLS by
-- design), matching this schema's own existing convention for every other
-- service-role-write / owner-read table (see PHASE8C-CONTENT-SOURCE-
-- GOVERNANCE.md for the precedent). No client (anon or authenticated) has
-- any INSERT/UPDATE/DELETE path to any of these three tables -- confirmed
-- by the RLS policies below, which grant SELECT only, and only on the two
-- customer-facing tables.

CREATE TABLE public.billing_customers (
  user_id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id  text NOT NULL UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

-- Owner-only read. No INSERT/UPDATE/DELETE policy for anon/authenticated at
-- all -- with RLS enabled and no such policy, every such write is denied by
-- default, regardless of any future policy added elsewhere by mistake.
CREATE POLICY "billing_customers_select_own" ON public.billing_customers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER billing_customers_updated_at
  BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.billing_subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id       text NOT NULL,
  stripe_subscription_id   text NOT NULL UNIQUE,
  stripe_price_id          text NOT NULL,
  -- Mirrors Stripe's own subscription.status values verbatim -- every
  -- status this app's webhook handler and entitlement module
  -- (src/lib/billing/entitlement.ts) know about, and no others.
  status                   text NOT NULL CHECK (status IN (
                             'trialing', 'active', 'past_due', 'canceled',
                             'unpaid', 'incomplete', 'incomplete_expired', 'paused'
                           )),
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  current_period_end       timestamptz,
  trial_end                timestamptz,
  -- When `status` most recently changed value (set by the webhook handler
  -- only on an actual transition, not on every update) -- entitlement.ts's
  -- past_due grace window is measured from this column, not updated_at,
  -- so an unrelated field update (e.g. cancel_at_period_end toggling)
  -- never silently resets the grace clock.
  status_changed_at        timestamptz NOT NULL DEFAULT now(),
  -- The Stripe event's own `created` timestamp that produced the current
  -- row state -- compared against incoming events by the webhook handler
  -- so a delayed/out-of-order event can never regress newer stored state
  -- (PAYMENT-ARCHITECTURE.md §13; same "last-writer-wins by event
  -- timestamp, not arrival order" principle already used for lesson-
  -- position persistence in src/lib/curriculum.ts's createSerialLatestQueue).
  stripe_event_created_at  timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- When the webhook handler finished processing the event that produced
  -- this row version (bookkeeping only; entitlement never reads this).
  processed_at             timestamptz
);

CREATE INDEX billing_subscriptions_user_idx ON public.billing_subscriptions (user_id);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_subscriptions_select_own" ON public.billing_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Idempotency ledger (PAYMENT-ARCHITECTURE.md §12): one row per processed
-- Stripe event id. `INSERT ... ON CONFLICT (stripe_event_id) DO NOTHING
-- RETURNING *` is how the webhook handler detects and skips a duplicate
-- delivery -- no row returned means this exact event was already recorded,
-- so the handler returns 200 without re-running any side effect.
CREATE TABLE public.billing_webhook_events (
  stripe_event_id   text PRIMARY KEY,
  event_type        text NOT NULL,
  -- The event's own `created` timestamp, as reported by Stripe -- distinct
  -- from received_at (when *we* saw it, which can lag behind delivery).
  event_created_at  timestamptz,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz
);

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

-- No policy at all for anon/authenticated, on purpose: this is an internal
-- idempotency ledger, never read by any client. With RLS enabled and zero
-- policies for those roles, every SELECT/INSERT/UPDATE/DELETE from a
-- client-side session is denied by default -- only the service-role key
-- (used exclusively by the webhook handler) can touch this table at all.

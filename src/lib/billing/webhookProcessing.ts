import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import type { Database } from "@/integrations/supabase/types";
import { isBillingStatus } from "./entitlement";

type AdminClient = SupabaseClient<Database>;

const HANDLED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

export type WebhookOutcome =
  | { kind: "duplicate" }
  | { kind: "record_failed"; message: string }
  | { kind: "processed" }
  | { kind: "processing_failed"; message: string };

/**
 * The whole idempotent-record-then-process flow, given an *already
 * signature-verified* Stripe event -- signature verification itself lives
 * in handlers/webhook.ts, the only place that needs the raw request/Stripe
 * SDK; everything here is unit-testable against a mocked Supabase client
 * and a hand-constructed event payload (webhookProcessing.test.ts).
 */
export async function recordAndProcessEvent(
  admin: AdminClient,
  event: Stripe.Event,
): Promise<WebhookOutcome> {
  const eventCreatedAt = new Date(event.created * 1000).toISOString();

  const { error: insertError } = await admin.from("billing_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    event_created_at: eventCreatedAt,
  });

  if (insertError) {
    // Postgres unique_violation -- this exact event id is already on
    // record. Check whether it finished processing last time: if so, this
    // is a true duplicate delivery/manual replay, skip entirely (never
    // process a completed event twice). If not, a prior attempt recorded
    // the event but failed before finishing -- fall through and retry
    // processing only, never re-inserting.
    if (insertError.code === "23505") {
      const { data: existing, error: fetchError } = await admin
        .from("billing_webhook_events")
        .select("processed_at")
        .eq("stripe_event_id", event.id)
        .maybeSingle();
      if (fetchError) {
        return { kind: "record_failed", message: fetchError.message };
      }
      if (existing?.processed_at) {
        return { kind: "duplicate" };
      }
      // else: recorded but never processed -- retry below.
    } else {
      return { kind: "record_failed", message: insertError.message };
    }
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    await admin
      .from("billing_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);
    return { kind: "processed" };
  }

  try {
    await dispatchEvent(admin, event);
  } catch (error) {
    return {
      kind: "processing_failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  await admin
    .from("billing_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("stripe_event_id", event.id);
  return { kind: "processed" };
}

async function dispatchEvent(admin: AdminClient, event: Stripe.Event): Promise<void> {
  const eventCreatedAt = new Date(event.created * 1000);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await upsertCustomerFromCheckoutSession(admin, session);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertSubscriptionFromStripeObject(admin, subscription, eventCreatedAt);
      return;
    }
    default:
      return;
  }
}

async function upsertCustomerFromCheckoutSession(
  admin: AdminClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  // Never derived from anything the browser sent on this request -- both
  // fields come from Stripe's own signed event payload, and
  // client_reference_id was itself set server-side (handlers/checkout.ts)
  // from an already-verified Supabase session, never from client input.
  const userId = session.client_reference_id ?? session.metadata?.["supabase_user_id"];
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!userId || !customerId) {
    throw new Error(
      `checkout.session.completed ${session.id} is missing client_reference_id/metadata or customer id -- cannot attribute this checkout to a user.`,
    );
  }

  const { error } = await admin
    .from("billing_customers")
    .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: "user_id" });
  if (error) throw new Error(`billing_customers upsert failed: ${error.message}`);
}

/** Resolves the Supabase user id for a subscription event: prefers the
 * subscription's own metadata (set at Checkout creation time via
 * subscription_data.metadata, so present on every subscription this app's
 * own Checkout flow creates), falling back to an existing billing_customers
 * row keyed by Stripe customer id (covers the checkout.session.completed /
 * customer.subscription.created out-of-order race PAYMENT-ARCHITECTURE.md
 * §13 describes, and a subscription created directly in the Stripe
 * Dashboard with no metadata). Never guesses; throws if neither resolves. */
async function resolveUserIdForSubscription(
  admin: AdminClient,
  subscription: Stripe.Subscription,
): Promise<{ userId: string; customerId: string }> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const metadataUserId = subscription.metadata?.["supabase_user_id"];
  if (metadataUserId) return { userId: metadataUserId, customerId };

  const { data: existingCustomer, error } = await admin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(`billing_customers lookup failed: ${error.message}`);
  if (existingCustomer) return { userId: existingCustomer.user_id, customerId };

  throw new Error(
    `subscription ${subscription.id} has no supabase_user_id metadata and no matching billing_customers row for customer ${customerId} -- cannot attribute it to a user.`,
  );
}

/** Stripe's `current_period_end` moved from the top-level Subscription
 * object onto each subscription item in newer API versions; read both
 * locations defensively rather than assume one. Verify against the pinned
 * API version (src/lib/billing/stripe.ts uses the SDK's own default) in a
 * real Stripe test-mode account before this goes live -- not exercised by
 * this PR, since no live Stripe call is made anywhere in it. */
function readCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
  const topLevel = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (typeof topLevel === "number") return topLevel;
  const itemLevel = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  return typeof itemLevel?.current_period_end === "number" ? itemLevel.current_period_end : null;
}

async function upsertSubscriptionFromStripeObject(
  admin: AdminClient,
  subscription: Stripe.Subscription,
  eventCreatedAt: Date,
): Promise<void> {
  if (!isBillingStatus(subscription.status)) {
    throw new Error(`Unrecognized Stripe subscription status "${subscription.status}".`);
  }

  const { userId, customerId } = await resolveUserIdForSubscription(admin, subscription);

  // Out-of-order protection (PAYMENT-ARCHITECTURE.md §13): only apply this
  // write if the incoming event is newer than whatever produced the
  // currently-stored row, so a delayed event can never regress state a
  // more recent one already set.
  const { data: existingRow, error: existingRowError } = await admin
    .from("billing_subscriptions")
    .select("status, stripe_event_created_at")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (existingRowError) {
    throw new Error(`billing_subscriptions lookup failed: ${existingRowError.message}`);
  }

  if (existingRow?.stripe_event_created_at) {
    const storedEventTime = new Date(existingRow.stripe_event_created_at).getTime();
    if (eventCreatedAt.getTime() <= storedEventTime) {
      // Stale/duplicate-order event for an already-newer row. Not an
      // error -- just nothing to do.
      return;
    }
  }

  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (!priceId) {
    throw new Error(`subscription ${subscription.id} has no price id on its first item.`);
  }

  const currentPeriodEndUnix = readCurrentPeriodEnd(subscription);
  const statusChangedAt =
    existingRow && existingRow.status === subscription.status
      ? undefined
      : new Date().toISOString();

  const { error } = await admin.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      stripe_event_created_at: eventCreatedAt.toISOString(),
      processed_at: new Date().toISOString(),
      ...(statusChangedAt ? { status_changed_at: statusChangedAt } : {}),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw new Error(`billing_subscriptions upsert failed: ${error.message}`);
}

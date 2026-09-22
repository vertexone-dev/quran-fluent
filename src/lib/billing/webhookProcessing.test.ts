import { describe, expect, test } from "vitest";
import type Stripe from "stripe";

import { recordAndProcessEvent } from "./webhookProcessing";

/**
 * A small, purpose-built in-memory fake of the exact Supabase query-builder
 * surface webhookProcessing.ts calls (insert/upsert/select/eq/maybeSingle/
 * update), simulating real unique-constraint conflict on
 * billing_webhook_events.stripe_event_id and billing_subscriptions.
 * stripe_subscription_id -- not a generic Supabase mock, just enough to
 * exercise this module's own branching (idempotency, out-of-order
 * protection) against real state transitions instead of canned responses.
 */
type FakeTables = {
  billing_webhook_events: Record<string, unknown>[];
  billing_customers: Record<string, unknown>[];
  billing_subscriptions: Record<string, unknown>[];
};

function createFakeAdmin() {
  const tables: FakeTables = {
    billing_webhook_events: [],
    billing_customers: [],
    billing_subscriptions: [],
  };
  const uniqueKey: Record<keyof FakeTables, string> = {
    billing_webhook_events: "stripe_event_id",
    billing_customers: "user_id",
    billing_subscriptions: "stripe_subscription_id",
  };

  function from(table: keyof FakeTables) {
    const rows = tables[table];
    const pk = uniqueKey[table];

    return {
      insert(row: Record<string, unknown>) {
        const conflict = rows.some((r) => r[pk] === row[pk]);
        if (conflict) {
          return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
        }
        rows.push({ ...row });
        return Promise.resolve({ error: null });
      },
      upsert(row: Record<string, unknown>, _opts: { onConflict: string }) {
        const idx = rows.findIndex((r) => r[pk] === row[pk]);
        if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
        else rows.push({ ...row });
        return Promise.resolve({ error: null });
      },
      select(_cols: string) {
        return {
          eq(col: string, val: unknown) {
            const match = rows.find((r) => r[col] === val);
            return {
              maybeSingle: () => Promise.resolve({ data: match ?? null, error: null }),
            };
          },
        };
      },
      update(patch: Record<string, unknown>) {
        return {
          eq(col: string, val: unknown) {
            const row = rows.find((r) => r[col] === val);
            if (row) Object.assign(row, patch);
            return Promise.resolve({ error: null });
          },
        };
      },
    };
  }

  // Cast: this fake only implements the exact subset of the Supabase client
  // surface webhookProcessing.ts calls, not the full SupabaseClient type.
  return { from, _tables: tables } as unknown as Parameters<typeof recordAndProcessEvent>[0] & {
    _tables: typeof tables;
  };
}

function checkoutEvent(
  overrides: Partial<Stripe.Checkout.Session> = {},
  created = 1000,
): Stripe.Event {
  return {
    id: "evt_checkout_1",
    type: "checkout.session.completed",
    created,
    data: {
      object: {
        id: "cs_1",
        client_reference_id: "user-1",
        customer: "cus_1",
        ...overrides,
      } as Stripe.Checkout.Session,
    },
  } as unknown as Stripe.Event;
}

function subscriptionEvent(
  eventId: string,
  overrides: Partial<Stripe.Subscription> = {},
  created = 1000,
): Stripe.Event {
  return {
    id: eventId,
    type: "customer.subscription.updated",
    created,
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        cancel_at_period_end: false,
        trial_end: null,
        metadata: { supabase_user_id: "user-1" },
        items: { data: [{ price: { id: "price_monthly" } }] },
        ...overrides,
      } as Stripe.Subscription,
    },
  } as unknown as Stripe.Event;
}

describe("recordAndProcessEvent — idempotency", () => {
  test("a fresh event is recorded and processed", async () => {
    const admin = createFakeAdmin();
    const outcome = await recordAndProcessEvent(admin, checkoutEvent());
    expect(outcome.kind).toBe("processed");
    expect(admin._tables.billing_customers).toHaveLength(1);
    expect(admin._tables.billing_customers[0]).toMatchObject({
      user_id: "user-1",
      stripe_customer_id: "cus_1",
    });
  });

  test("processing the exact same event id twice results in exactly one applied state change", async () => {
    const admin = createFakeAdmin();
    await recordAndProcessEvent(admin, checkoutEvent());
    const secondOutcome = await recordAndProcessEvent(admin, checkoutEvent());

    expect(secondOutcome.kind).toBe("duplicate");
    // Still exactly one billing_customers row, not two/updated-twice.
    expect(admin._tables.billing_customers).toHaveLength(1);
    expect(admin._tables.billing_webhook_events).toHaveLength(1);
  });

  test("a manual Dashboard resend of an already-processed event changes nothing", async () => {
    const admin = createFakeAdmin();
    await recordAndProcessEvent(admin, checkoutEvent());
    const before = JSON.stringify(admin._tables.billing_customers);

    await recordAndProcessEvent(admin, checkoutEvent());
    expect(JSON.stringify(admin._tables.billing_customers)).toBe(before);
  });
});

describe("recordAndProcessEvent — out-of-order delivery", () => {
  test("a stale event (older event.created) never overwrites newer stored state", async () => {
    const admin = createFakeAdmin();

    // Newer event arrives first: active.
    await recordAndProcessEvent(admin, subscriptionEvent("evt_new", { status: "active" }, 2000));
    expect(admin._tables.billing_subscriptions[0]?.["status"]).toBe("active");

    // Older, delayed event arrives after: past_due -- must NOT regress the
    // already-newer "active" state.
    await recordAndProcessEvent(admin, subscriptionEvent("evt_old", { status: "past_due" }, 1000));
    expect(admin._tables.billing_subscriptions[0]?.["status"]).toBe("active");
  });

  test("a genuinely newer event does update the stored state", async () => {
    const admin = createFakeAdmin();
    await recordAndProcessEvent(admin, subscriptionEvent("evt_1", { status: "active" }, 1000));
    await recordAndProcessEvent(admin, subscriptionEvent("evt_2", { status: "canceled" }, 2000));
    expect(admin._tables.billing_subscriptions[0]?.["status"]).toBe("canceled");
  });

  test("status_changed_at only advances on an actual status transition", async () => {
    const admin = createFakeAdmin();
    await recordAndProcessEvent(admin, subscriptionEvent("evt_1", { status: "active" }, 1000));
    const firstChangedAt = admin._tables.billing_subscriptions[0]?.["status_changed_at"];

    // Same status, later event (e.g. cancel_at_period_end toggled) — the
    // grace-window anchor must not reset.
    await recordAndProcessEvent(
      admin,
      subscriptionEvent("evt_2", { status: "active", cancel_at_period_end: true }, 2000),
    );
    expect(admin._tables.billing_subscriptions[0]?.["status_changed_at"]).toBe(firstChangedAt);
  });
});

describe("recordAndProcessEvent — user-id resolution", () => {
  test("resolves the user id from an existing billing_customers row when subscription metadata is absent", async () => {
    const admin = createFakeAdmin();
    admin._tables.billing_customers.push({ user_id: "user-2", stripe_customer_id: "cus_2" });

    const outcome = await recordAndProcessEvent(
      admin,
      subscriptionEvent("evt_1", { customer: "cus_2", metadata: {} }, 1000),
    );

    expect(outcome.kind).toBe("processed");
    expect(admin._tables.billing_subscriptions[0]?.["user_id"]).toBe("user-2");
  });

  test("cannot attribute a subscription with no metadata and no matching customer row", async () => {
    const admin = createFakeAdmin();
    const outcome = await recordAndProcessEvent(
      admin,
      subscriptionEvent("evt_1", { customer: "cus_unknown", metadata: {} }, 1000),
    );
    expect(outcome.kind).toBe("processing_failed");
    expect(admin._tables.billing_subscriptions).toHaveLength(0);
  });
});

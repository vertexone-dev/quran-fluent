import { test, expect } from "@playwright/test";

import { createFreshTestUserClient } from "./utils/db";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/daily",
  "/onboarding",
  "/placement",
  "/learning-plan",
  "/progress",
  "/settings",
  "/settings/billing",
  "/bookmarks",
  "/notes",
  "/memorize",
  "/practice",
];

test.describe("security", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`unauthenticated visitor to ${route} is redirected to /auth`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth\?mode=login/);
    });
  }

  test("the anon key cannot read rows from a user-owned table (RLS)", async ({ request }) => {
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

    const response = await request.get(`${url}/rest/v1/study_sessions?select=*`, {
      headers: { apikey: anonKey },
    });

    if (response.ok()) {
      const body = await response.json();
      expect(Array.isArray(body) ? body.length : 0).toBe(0);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("an authenticated user cannot read another user's rows by forging a filter", async ({
    request,
  }) => {
    // Fresh sign-in, not the shared session: this runs in the "public"
    // project, before "setup" has captured a browser session to restore.
    const { client, userId } = await createFreshTestUserClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    expect(session?.access_token).toBeTruthy();

    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const forgedUserId = "00000000-0000-0000-0000-000000000000";
    expect(forgedUserId).not.toBe(userId);

    const response = await request.get(
      `${url}/rest/v1/study_sessions?select=*&user_id=eq.${forgedUserId}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${session!.access_token}`,
        },
      },
    );

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body).toEqual([]);
  });

  test("an authenticated user cannot read, insert into, or update another user's bookmarks, notes or memorization rows", async ({
    request,
  }) => {
    const { client, userId } = await createFreshTestUserClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    expect(session?.access_token).toBeTruthy();

    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const forgedUserId = "00000000-0000-0000-0000-000000000000";
    expect(forgedUserId).not.toBe(userId);
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${session!.access_token}`,
      "Content-Type": "application/json",
    };

    for (const table of ["bookmarks", "notes", "memorization_progress"]) {
      // SELECT: forging another user_id in the filter must not surface their rows.
      const selectResponse = await request.get(
        `${url}/rest/v1/${table}?select=*&user_id=eq.${forgedUserId}`,
        {
          headers,
        },
      );
      expect(selectResponse.ok()).toBe(true);
      expect(await selectResponse.json()).toEqual([]);

      // INSERT: the WITH CHECK clause must reject a row claiming to belong
      // to someone else, even though the request itself is authenticated.
      const row =
        table === "notes"
          ? { user_id: forgedUserId, surah_number: 1, ayah_number: 1, content: "forged" }
          : { user_id: forgedUserId, surah_number: 1, ayah_number: 1 };
      const insertResponse = await request.post(`${url}/rest/v1/${table}`, { headers, data: row });
      expect(insertResponse.ok()).toBe(false);
    }

    // UPDATE: forging the filter must affect zero rows rather than erroring
    // or silently touching someone else's data. Prefer: return=representation
    // is required here — without it PostgREST replies 204 with an empty body
    // on a zero-row update, and there'd be nothing to assert against.
    const updateResponse = await request.patch(`${url}/rest/v1/notes?user_id=eq.${forgedUserId}`, {
      headers: { ...headers, Prefer: "return=representation" },
      data: { content: "hijacked" },
    });
    expect(updateResponse.ok()).toBe(true);
    expect(await updateResponse.json()).toEqual([]);
  });

  test("no Supabase service-role key is present in the shipped client bundle", async ({ page }) => {
    const seenScripts: string[] = [];
    page.on("response", async (response) => {
      const contentType = response.headers()["content-type"] ?? "";
      if (contentType.includes("javascript") || response.url().endsWith(".js")) {
        try {
          seenScripts.push(await response.text());
        } catch {
          // Ignore bodies that can't be read (e.g. already-consumed streams).
        }
      }
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const html = await page.content();
    const haystacks = [html, ...seenScripts];
    // Match an actual key *value* (prefix plus its opaque body), not the bare
    // "sb_secret_" prefix string the client's own key-type check legitimately
    // ships (see isNewSupabaseApiKey in src/integrations/supabase/client.ts).
    for (const text of haystacks) {
      expect(text).not.toMatch(/sb_secret_[A-Za-z0-9_-]{10,}/);
      expect(text).not.toMatch(/"service_role"/);
    }
  });

  test("no Stripe secret key or webhook signing secret is present in the shipped client bundle", async ({
    page,
  }) => {
    const seenScripts: string[] = [];
    page.on("response", async (response) => {
      const contentType = response.headers()["content-type"] ?? "";
      if (contentType.includes("javascript") || response.url().endsWith(".js")) {
        try {
          seenScripts.push(await response.text());
        } catch {
          // Ignore bodies that can't be read (e.g. already-consumed streams).
        }
      }
    });

    // /premium is the page most likely to pull in billing-related client
    // code (checkoutFlag.ts, the Checkout-starting buttons) -- the page
    // this check most needs to cover.
    await page.goto("/premium");
    await page.waitForLoadState("networkidle");

    const html = await page.content();
    const haystacks = [html, ...seenScripts];
    for (const text of haystacks) {
      expect(text).not.toMatch(/sk_live_[A-Za-z0-9]{10,}/);
      expect(text).not.toMatch(/sk_test_[A-Za-z0-9]{10,}/);
      expect(text).not.toMatch(/whsec_[A-Za-z0-9]{10,}/);
    }
  });

  // Real-HTTP-level coverage of src/server.ts's billing routing + each
  // handler's own auth/validation guard -- distinct from src/lib/billing/
  // handlers/checkout.test.ts's mocked unit tests, which import and call
  // handleCheckout directly and so never exercise src/server.ts's own
  // request routing at all.
  test.describe("billing API", () => {
    test("POST /api/billing/checkout without authentication returns 401", async ({
      request,
      baseURL,
    }) => {
      const response = await request.post(`${baseURL}/api/billing/checkout`, {
        headers: { "content-type": "application/json" },
        data: { plan: "monthly" },
      });
      expect(response.status()).toBe(401);
    });

    test("POST /api/billing/checkout with an authenticated but invalid plan returns 400, not a Checkout Session", async ({
      request,
      baseURL,
    }) => {
      const { client } = await createFreshTestUserClient();
      const {
        data: { session },
      } = await client.auth.getSession();
      expect(session?.access_token).toBeTruthy();

      const response = await request.post(`${baseURL}/api/billing/checkout`, {
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        data: { priceId: "price_evil_free_forever" },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.url).toBeUndefined();
    });

    test("GET /api/billing/status without authentication returns 401", async ({
      request,
      baseURL,
    }) => {
      const response = await request.get(`${baseURL}/api/billing/status`);
      expect(response.status()).toBe(401);
    });

    test("POST /api/billing/webhook without a Stripe-Signature header returns 400", async ({
      request,
      baseURL,
    }) => {
      const response = await request.post(`${baseURL}/api/billing/webhook`, {
        headers: { "content-type": "application/json" },
        data: { type: "checkout.session.completed" },
      });
      expect(response.status()).toBe(400);
    });

    test("POST /api/billing/webhook with an invalid Stripe-Signature header returns 400, never processing the event", async ({
      request,
      baseURL,
    }) => {
      const response = await request.post(`${baseURL}/api/billing/webhook`, {
        headers: {
          "content-type": "application/json",
          "stripe-signature": "t=1,v1=not-a-real-signature",
        },
        data: { type: "checkout.session.completed" },
      });
      expect(response.status()).toBe(400);
    });
  });
});

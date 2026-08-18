import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/daily",
  "/onboarding",
  "/placement",
  "/learning-plan",
  "/progress",
  "/settings",
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
    const { client, userId } = await createTestUserClient();
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
    for (const text of haystacks) {
      expect(text).not.toMatch(/sb_secret_/);
      expect(text).not.toMatch(/service_role/);
    }
  });
});

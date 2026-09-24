import { beforeEach, describe, expect, test, vi } from "vitest";

async function loadHandlerWithMocks(
  userId: string | null,
  rows: Array<Record<string, unknown>> = [],
) {
  vi.resetModules();
  vi.doMock("../requestAuth", () => ({
    requireAuthenticatedUserId: vi.fn(async () => userId),
  }));
  vi.doMock("../supabaseAdmin", () => ({
    getSupabaseAdminClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: rows, error: null }),
            }),
          }),
        }),
      }),
    }),
  }));
  const { handleStatus } = await import("./status");
  return handleStatus;
}

function getRequest() {
  return new Request("https://example.test/api/billing/status", { method: "GET" });
}

describe("handleStatus", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("401s an unauthenticated request before ever querying billing_subscriptions", async () => {
    const handleStatus = await loadHandlerWithMocks(null);
    const response = await handleStatus(getRequest());
    expect(response.status).toBe(401);
  });

  test("an authenticated user with no subscription row gets a safe free-plan response, never a 500", async () => {
    const handleStatus = await loadHandlerWithMocks("user-1", []);
    const response = await handleStatus(getRequest());
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      hasSubscription: boolean;
      enforcementEnabled: boolean;
    };
    expect(body.hasSubscription).toBe(false);
    expect(body.enforcementEnabled).toBe(false);
  });
});

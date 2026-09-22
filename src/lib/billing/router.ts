import { handleCheckout } from "./handlers/checkout";
import { handlePortal } from "./handlers/portal";
import { handleWebhook } from "./handlers/webhook";
import { handleStatus } from "./handlers/status";
import { jsonError } from "./http";

/**
 * This TanStack Start version has no file-based API-route mechanism (no
 * `createServerFileRoute`/`createAPIFileRoute` exists anywhere in the
 * installed @tanstack packages -- confirmed by inspecting
 * @tanstack/router-generator's own source, which has no API-route concept
 * at all). src/server.ts is this app's single Cloudflare Worker `fetch`
 * entry point and already wraps everything else (SSR, static assets) --
 * see its own comments -- so it is also the correct, and only reliable,
 * place to add real HTTP endpoints Stripe's webhook can POST to directly
 * with a raw, unparsed body (a requirement `createServerFn`'s own RPC wire
 * protocol cannot satisfy).
 */

const BILLING_PATH_PREFIX = "/api/billing/";

export function isBillingApiRequest(pathname: string): boolean {
  return pathname.startsWith(BILLING_PATH_PREFIX);
}

export async function handleBillingApiRequest(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();

  if (pathname === "/api/billing/checkout" && method === "POST") return handleCheckout(request);
  if (pathname === "/api/billing/portal" && method === "POST") return handlePortal(request);
  if (pathname === "/api/billing/webhook" && method === "POST") return handleWebhook(request);
  if (pathname === "/api/billing/status" && method === "GET") return handleStatus(request);

  return jsonError(404, "Not found.");
}

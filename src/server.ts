import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleBillingApiRequest, isBillingApiRequest } from "./lib/billing/router";
import { buildCsp, generateNonce, parseCspMode, type CspMode } from "./lib/csp";
import { runWithNonce } from "./lib/request-nonce.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// Baseline security response headers, enforced here rather than relying on
// public/_headers: with the Cloudflare Workers Static Assets [assets]
// binding this project uses (see .output/server/wrangler.json) and no
// `run_worker_first`, a request is served straight from the assets layer
// whenever it matches a real static file -- _headers applies there. Every
// other request (every SSR route, every HTML 404) never touches the assets
// layer at all and lands here instead, so _headers' rules never apply to
// it. This is the single funnel every non-asset response passes through
// (see the `fetch` handler below), which makes it the one place that can
// guarantee these headers on HTML/SSR output, including error and 404
// responses. Intentionally excludes CSP -- see PAYMENT-ARCHITECTURE.md-
// adjacent launch-readiness notes; a CSP needs staging verification against
// Google Fonts and Supabase before it can ship safely.
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
};

// Pure and independently unit-tested (src/server.test.ts) -- adds/overwrites
// only the four security headers above, preserving every other header the
// wrapped response already carries (content-type, cache-control, Location
// on redirects, etc.) untouched. Never consumes `response.body`, so this is
// safe to apply to a streamed SSR body.
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Applies the per-request CSP in the given mode (see parseCspMode): `enforce`
 * sets Content-Security-Policy, `report-only` sets the report-only header (the
 * browser logs violations, blocks nothing), `off` sets neither. Any CSP the
 * wrapped response already carried is replaced. Never consumes `response.body`. */
export function withContentSecurityPolicy(
  response: Response,
  policy: string,
  mode: CspMode = "enforce",
): Response {
  const headers = new Headers(response.headers);
  headers.delete("content-security-policy");
  headers.delete("content-security-policy-report-only");
  if (mode === "enforce") headers.set("Content-Security-Policy", policy);
  else if (mode === "report-only") headers.set("Content-Security-Policy-Report-Only", policy);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Both the runtime and the build-time Supabase URL, so the policy matches
 * whichever the client bundle was built against. */
function supabaseUrls(): string[] {
  const urls = [process.env["SUPABASE_URL"], import.meta.env["VITE_SUPABASE_URL"]];
  return urls.filter((u): u is string => typeof u === "string" && u.length > 0);
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(incoming: Request, env: unknown, ctx: unknown) {
    // A fresh nonce per request, scoped to this request's async chain for the
    // SSR pipeline (src/router.tsx reads it). A client can never choose it.
    const nonce = generateNonce();
    return runWithNonce(nonce, () => handle(incoming, env, ctx, nonce));
  },
};

async function handle(request: Request, env: unknown, ctx: unknown, nonce: string) {
  let response: Response;
  try {
    // Billing endpoints are plain HTTP handlers (see
    // src/lib/billing/router.ts for why this exact TanStack Start
    // version needs them handled here rather than as file-based routes),
    // intercepted before the SSR pipeline ever sees them -- in
    // particular, POST /api/billing/webhook needs its raw, unparsed
    // request body for Stripe signature verification, which nothing
    // downstream of this point would preserve.
    const { pathname } = new URL(request.url);
    if (isBillingApiRequest(pathname)) {
      response = await handleBillingApiRequest(request);
    } else {
      const handler = await getServerEntry();
      const raw = await handler.fetch(request, env, ctx);
      response = await normalizeCatastrophicSsrResponse(raw);
    }
  } catch (error) {
    console.error(error);
    response = new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  // Single funnel: every response this handler can produce -- success,
  // normalized-catastrophic, or hard-caught -- gets the security headers
  // exactly once, right before it leaves the Worker.
  const [primary, ...extra] = supabaseUrls();
  const policy = buildCsp({
    nonce,
    supabaseUrl: primary,
    extraSupabaseUrls: extra,
    upgradeInsecure: new URL(request.url).protocol === "https:",
    dev: import.meta.env.DEV,
  });
  return withContentSecurityPolicy(
    withSecurityHeaders(response),
    policy,
    parseCspMode(process.env["CSP_MODE"]),
  );
}

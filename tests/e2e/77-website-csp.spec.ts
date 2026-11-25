import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// QR-DESIGN-008A: the website's Content-Security-Policy (src/lib/csp.ts,
// applied per request in src/server.ts). Signed-out and network-independent:
// no request leaves for a third party, and nothing here needs a session.
//
// Two halves. The first proves the policy does not break the pages (no
// violation while a route loads, hydrates and applies the theme). The second
// proves it actually blocks: a policy that blocked nothing would pass the
// first half too.

const ROUTES = ["/", "/quran", "/learn", "/auth", "/pricing", "/about", "/does-not-exist-404"];

async function trackViolations(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.effectiveDirective} blocked ${e.blockedURI}`,
      ),
    );
  });
}

// CSP_MODE defaults to report-only (fail-safe), so a deployed target may carry
// the policy in either header. Policy-shape checks accept both; tests that need
// the browser to actually BLOCK something are skipped (and say so) unless the
// target enforces. Local runs start their servers with CSP_MODE=enforce.
async function policyOf(request: APIRequestContext, route = "/") {
  const response = await request.get(route);
  const headers = response.headers();
  const enforcing = headers["content-security-policy"];
  const reportOnly = headers["content-security-policy-report-only"];
  return { response, csp: enforcing ?? reportOnly, enforcing: enforcing !== undefined };
}

const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

test.describe("website Content-Security-Policy", () => {
  test("every document response carries a nonce-based policy in exactly one CSP header", async ({
    request,
  }) => {
    for (const route of ROUTES) {
      const { response, csp } = await policyOf(request, route);
      expect(csp, `${route} has no Content-Security-Policy`).toBeTruthy();
      expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/]{22}=='/);
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).not.toContain("unsafe-eval");
      expect(csp).not.toMatch(/https?:\/\/\*|\s\*[\s;]|\s\*$/);
      const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src "))!;
      expect(scriptSrc).not.toContain("unsafe-inline");
      // never both headers at once
      const h = response.headers();
      expect(
        Number("content-security-policy" in h) + Number("content-security-policy-report-only" in h),
      ).toBe(1);
    }
  });

  test("a fresh nonce is issued for every request, and a client-supplied one is ignored", async ({
    request,
  }) => {
    const nonceOf = async (headers?: Record<string, string>) => {
      const r = await request.get("/", headers ? { headers } : {});
      const h = r.headers();
      const csp = h["content-security-policy"] ?? h["content-security-policy-report-only"]!;
      return /nonce-([^']+)'/.exec(csp)![1]!;
    };
    const a = await nonceOf();
    const b = await nonceOf();
    const c = await nonceOf({ "x-qr-csp-nonce": "attackerchosen" });
    expect(new Set([a, b, c]).size).toBe(3);
    expect(c).not.toBe("attackerchosen");
  });

  test("every inline script in the HTML carries the request's nonce", async ({ request }) => {
    const { response, csp } = await policyOf(request);
    const nonce = /nonce-([^']+)'/.exec(csp!)![1]!;
    const html = await response.text();
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]!);
    expect(scripts.length).toBeGreaterThan(0);
    for (const attrs of scripts) {
      expect(attrs, `script without the nonce: <script${attrs}>`).toContain(`nonce="${nonce}"`);
    }
  });

  for (const route of ROUTES) {
    test(`${route} loads and hydrates with no CSP violation`, async ({ page }) => {
      await trackViolations(page);
      await page.goto(route);
      // The blocking theme script ran (dark is the default theme) and React hydrated.
      await expect(page.locator("html")).toHaveClass(/dark/);
      await page.waitForLoadState("networkidle");
      expect(await violations(page)).toEqual([]);
    });
  }

  test("Arabic (RTL) home loads with no CSP violation", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("quranroots-lang", "ar"));
    await trackViolations(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(await violations(page)).toEqual([]);
  });

  test("blocks an injected inline script, an inline handler and a foreign script", async ({
    page,
    request,
  }) => {
    test.skip(!(await policyOf(request)).enforcing, "target is not enforcing (CSP_MODE)");
    await trackViolations(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const result = await page.evaluate(async () => {
      const w = window as unknown as { __x?: number };
      const s = document.createElement("script");
      s.textContent = "window.__x = 1";
      document.body.appendChild(s);
      document.body.insertAdjacentHTML("beforeend", '<img src="x" onerror="window.__x = 2">');
      const foreign = document.createElement("script");
      foreign.src = "https://evil.example/x.js";
      document.body.appendChild(foreign);
      await new Promise((r) => setTimeout(r, 400));
      return w.__x ?? 0;
    });
    expect(result, "an injected script executed").toBe(0);
    const seen = await violations(page);
    expect(seen.some((v) => v.startsWith("script-src-elem"))).toBe(true);
    expect(seen.some((v) => v.includes("evil.example"))).toBe(true);
  });

  test("blocks connections, images, frames and media to hosts that are not allowed", async ({
    page,
    request,
  }) => {
    test.skip(!(await policyOf(request)).enforcing, "target is not enforcing (CSP_MODE)");
    await trackViolations(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      await fetch("https://evil.example/collect").catch(() => undefined);
      const img = new Image();
      img.src = "https://evil.example/p.png";
      const frame = document.createElement("iframe");
      frame.src = "https://evil.example/";
      document.body.appendChild(frame);
      const audio = new Audio();
      audio.src = "https://example.com/a.mp3";
      await new Promise((r) => setTimeout(r, 400));
    });
    const directives = (await violations(page)).map((v) => v.split(" ")[0]);
    expect(directives).toEqual(expect.arrayContaining(["connect-src", "img-src", "frame-src"]));
    expect(directives).toContain("media-src");
  });

  test("allows the audio hosts and the Quran API the application uses (policy check)", async ({
    request,
  }) => {
    const csp = (await policyOf(request)).csp!;
    const directive = (name: string) =>
      csp
        .split("; ")
        .find((d) => d.startsWith(`${name} `))!
        .split(" ");
    expect(directive("media-src")).toEqual(
      expect.arrayContaining(["https://audio.qurancdn.com", "https://mirrors.quranicaudio.com"]),
    );
    expect(directive("connect-src")).toContain("https://api.quran.com");
    expect(directive("font-src")).toContain("https://fonts.gstatic.com");
    expect(directive("style-src-elem")).toContain("https://fonts.googleapis.com");
  });
});

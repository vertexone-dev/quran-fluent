import { expect, test } from "@playwright/test";
import { CSP } from "../csp";

// Collects every CSP violation the page reports, before any app code runs.
async function watch(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    (window as unknown as { __v: string[] }).__v = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __v: string[] }).__v.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
    try {
      localStorage.setItem("qr.onboarding.done", "true");
    } catch {
      /* ignore */
    }
  });
}
const violations = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __v: string[] }).__v);

test("the built page carries exactly the policy from csp.ts", async ({ page }) => {
  await watch(page);
  await page.goto("/");
  const meta = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(meta).toBe(CSP);
});

test("the policy has no wildcard, no unsafe-eval and no unsafe script/style", () => {
  expect(CSP).not.toMatch(/\*/);
  expect(CSP).not.toMatch(/(?<!wasm-)unsafe-eval/);
  expect(CSP).not.toMatch(/script-src[^;]*unsafe-inline/);
  expect(CSP).not.toMatch(/style-src 'self'[^;]*unsafe-inline/);
  expect(CSP).not.toMatch(/https?:/);
});

test("every screen works under the policy with zero violations and no outside requests", async ({
  page,
}) => {
  await watch(page);
  const outside: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:5193/") && !r.url().startsWith("data:"))
      outside.push(r.url());
  });
  await page.goto("/");
  // The database loaded (sql.js WASM compiled and the SQLite file fetched).
  const tabs = page.locator(".tab-item");
  await tabs.first().waitFor();
  const n = await tabs.count();
  expect(n).toBeGreaterThanOrEqual(5);
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(700);
  }
  // Reader: pick the first surah in the Qur'an tab and see Arabic text rendered from the DB.
  await tabs.nth(1).click();
  await page.waitForTimeout(700);
  await page.getByText("Al-Fatiha", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText("ٱلْحَمْدُ", { timeout: 10_000 });
  // Settings sub-pages (fonts, inline style attributes, language switch).
  await tabs.nth(n - 1).click();
  await page.waitForTimeout(700);
  expect(await violations(page)).toEqual([]);
  expect(outside).toEqual([]);
});

test("control: the policy really blocks inline script and remote loads", async ({ page }) => {
  await watch(page);
  await page.goto("/");
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const s = document.createElement("script");
    s.textContent = "window.__ran = true";
    document.body.appendChild(s);
    const i = document.createElement("img");
    i.src = "https://example.com/x.png";
    document.body.appendChild(i);
  });
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => (window as unknown as { __ran?: boolean }).__ran),
  ).toBeUndefined();
  const v = await violations(page);
  expect(v.some((x) => x.startsWith("script-src"))).toBe(true);
  expect(v.some((x) => x.startsWith("img-src"))).toBe(true);
});

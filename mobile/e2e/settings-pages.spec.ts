import { test, expect, type Page } from "@playwright/test";

/**
 * QR-DESIGN-007B: Settings category list and sub-pages (Design Lock
 * "Mobile App - Settings"), and the safe Tanzil external link. Only categories
 * with working controls exist; nothing is a placeholder.
 */

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
}
async function openSettings(page: Page) {
  await page.getByTestId("tab-settings").click();
  await expect(page.getByTestId("settings-screen")).toBeVisible();
}

const ORDER = [
  "settings-nav-general",
  "settings-nav-reading",
  "settings-language-row",
  "settings-nav-appearance",
  "settings-nav-offline",
  "settings-nav-privacy",
  "setting-about",
];

test.describe("Settings category list", () => {
  test("lists the working categories in the Design Lock order, each with icon, hint and chevron", async ({
    page,
  }) => {
    await boot(page);
    await openSettings(page);
    const rows = page.locator(".settings-nav-row");
    await expect(rows).toHaveCount(ORDER.length);
    expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))).toEqual(
      ORDER,
    );
    await expect(page.locator(".settings-nav-row svg")).toHaveCount(ORDER.length * 2); // icon + chevron
    for (const row of await rows.all()) {
      const box = await row.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await expect(row.locator(".setting-hint")).not.toBeEmpty();
    }
  });

  test("does not invent profile, audio, notification or family rows", async ({ page }) => {
    await boot(page);
    await openSettings(page);
    const text = (await page.getByTestId("settings-screen").innerText()).toLowerCase();
    for (const bad of ["audio", "recitation", "notification", "family", "children", "@", "sync"]) {
      expect(text, `Settings text must not mention "${bad}"`).not.toContain(bad);
    }
  });

  for (const [testId, page_] of [
    ["settings-nav-general", "general"],
    ["settings-nav-reading", "reading"],
    ["settings-language-row", "language"],
    ["settings-nav-appearance", "appearance"],
    ["settings-nav-privacy", "privacy"],
  ] as const) {
    test(`the ${page_} page opens, and back returns to the list`, async ({ page }) => {
      await boot(page);
      await openSettings(page);
      await page.getByTestId(testId).click();
      await expect(page.getByTestId(`settings-page-${page_}`)).toBeVisible();
      await page.getByTestId("appbar-back").click();
      await expect(page.getByTestId("settings-screen")).toBeVisible();
    });
  }

  test("browser/hardware back unwinds one level at a time", async ({ page }) => {
    await boot(page);
    await openSettings(page);
    await page.getByTestId("settings-nav-appearance").click();
    await expect(page.getByTestId("settings-page-appearance")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("settings-screen")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("home-screen")).toBeVisible();
  });

  test("Offline access opens the real Offline Access screen", async ({ page }) => {
    await boot(page);
    await openSettings(page);
    await page.getByTestId("settings-nav-offline").click();
    await expect(page.locator(".appbar-title")).toHaveText("Offline Access");
  });
});

test.describe("Settings sub-pages keep state", () => {
  test("a change survives leaving and re-entering the page", async ({ page }) => {
    await boot(page);
    await openSettings(page);
    await page.getByTestId("settings-nav-appearance").click();
    await page.getByTestId("setting-text-size").selectOption("large");
    await page.getByTestId("appbar-back").click();
    await page.getByTestId("settings-nav-appearance").click();
    await expect(page.getByTestId("setting-text-size")).toHaveValue("large");
    await page.getByTestId("appbar-back").click();
    await page.getByTestId("settings-nav-general").click();
    await page.getByTestId("setting-start-screen").selectOption("quran");
    await page.getByTestId("appbar-back").click();
    await page.getByTestId("settings-nav-general").click();
    await expect(page.getByTestId("setting-start-screen")).toHaveValue("quran");
  });

  test("Quran & Reading is read-only and links to the sources page", async ({ page }) => {
    await boot(page);
    await openSettings(page);
    await page.getByTestId("settings-nav-reading").click();
    await expect(page.getByTestId("settings-translations")).toContainText("Pickthall");
    await expect(page.getByTestId("settings-translations")).toContainText("Kazimirski");
    await page.getByTestId("settings-reading-sources").click();
    await expect(page.getByTestId("about-screen")).toBeVisible();
  });
});

test.describe("Language page", () => {
  test("options switch the interface live and report the selected one", async ({ page }) => {
    await boot(page);
    await openSettings(page);
    await page.getByTestId("settings-language-row").click();
    const group = page.getByTestId("language-options");
    await expect(group).toHaveAttribute("role", "radiogroup");
    await expect(page.getByTestId("language-option-en")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("language-option-fr").click();
    await expect(page.getByTestId("language-option-fr")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".appbar-title")).toHaveText("Langue");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await page.getByTestId("language-option-ar").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".appbar-title")).toHaveText("اللغة");
  });

  test("every category title is translated in French and Arabic", async ({ page }) => {
    await boot(page);
    await openSettings(page);
    await page.getByTestId("settings-language-row").click();
    await page.getByTestId("language-option-fr").click();
    await page.getByTestId("appbar-back").click();
    const fr = await page.locator(".settings-nav-row .setting-title").allTextContents();
    expect(fr).toEqual([
      "Général",
      "Coran et lecture",
      "Langue",
      "Apparence",
      "Accès hors ligne",
      "Confidentialité et données",
      "À propos et sources",
    ]);
    await page.getByTestId("settings-language-row").click();
    await page.getByTestId("language-option-ar").click();
    await page.getByTestId("appbar-back").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const ar = await page.locator(".settings-nav-row .setting-title").allTextContents();
    expect(ar.every((t) => /[؀-ۿ]/.test(t))).toBe(true);
  });
});

test.describe("Large text", () => {
  test("the category list and a sub-page stay inside the screen at 3.1x", async ({ page }) => {
    await boot(page);
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--qr-system-text-scale", "3.1"),
    );
    await openSettings(page);
    const vp = page.viewportSize()!;
    for (const row of await page.locator(".settings-nav-row").all()) {
      const box = await row.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
    }
    await page.getByTestId("settings-nav-appearance").click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("Tanzil external link", () => {
  async function openAbout(page: Page) {
    await boot(page);
    await openSettings(page);
    await page.getByTestId("setting-about").click();
    await expect(page.getByTestId("about-screen")).toBeVisible();
  }

  test("is a real https link with noopener, a 44pt target and an accessible name", async ({
    page,
  }) => {
    await openAbout(page);
    const link = page.getByTestId("about-tanzil-link");
    await expect(link).toHaveAttribute("href", "https://tanzil.net/");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("rel", /noreferrer/);
    await expect(
      page.getByRole("link", { name: /Tanzil Project website.*Opens in your browser/ }),
    ).toBeVisible();
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test("activating it opens exactly tanzil.net in a new context and leaves the app untouched", async ({
    page,
    context,
  }) => {
    // No real network: serve a stub for the allowlisted host and fail anything else.
    const requested: string[] = [];
    await context.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "tanzil.net") {
        requested.push(route.request().url());
        return route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<title>stub</title>",
        });
      }
      return route.continue();
    });
    await openAbout(page);
    const appUrl = page.url();
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByTestId("about-tanzil-link").click(),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe("https://tanzil.net/");
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    expect(requested).toEqual(["https://tanzil.net/"]);
    // The app page is exactly where it was.
    expect(page.url()).toBe(appUrl);
    await expect(page.getByTestId("about-screen")).toBeVisible();
    await popup.close();
  });

  test("sends no tokens, user data or referrer to the destination", async ({ page, context }) => {
    let referer: string | undefined;
    let search = "";
    await context.route("https://tanzil.net/**", async (route) => {
      referer = route.request().headers()["referer"];
      search = new URL(route.request().url()).search;
      return route.fulfill({ status: 200, contentType: "text/html", body: "ok" });
    });
    await openAbout(page);
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByTestId("about-tanzil-link").click(),
    ]);
    await popup.waitForLoadState();
    expect(search).toBe("");
    expect(referer ?? "").toBe("");
    await popup.close();
  });

  test("a failure message is always available if the browser does not open", async ({ page }) => {
    await openAbout(page);
    await expect(page.getByTestId("about-screen")).toContainText(
      "If nothing happens, visit tanzil.net",
    );
  });

  test("the only external anchor in Settings and About is the allowlisted one", async ({
    page,
  }) => {
    await openAbout(page);
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => (a as HTMLAnchorElement).href),
    );
    expect(hrefs).toEqual(["https://tanzil.net/"]);
  });
});

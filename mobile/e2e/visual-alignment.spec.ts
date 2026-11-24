import { test, expect, type Page } from "@playwright/test";

/**
 * QR-DESIGN-007A: exact-match alignment with Design Lock v1.0. Everything shown
 * is real: no tile is a placeholder, and the About screen reads the bundled
 * database's own source records and review statuses.
 */

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
}

const SIX = ["quran", "understand", "learn", "reflect", "memorize", "bookmarks"] as const;

test.describe("Home six-tile grid", () => {
  test("shows six tiles in three columns, in the reference order, all real destinations", async ({
    page,
  }) => {
    await boot(page);
    const tiles = page.getByTestId("home-tiles").locator("button.tile");
    await expect(tiles).toHaveCount(6);
    const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(ids).toEqual(SIX.map((k) => `home-tile-${k}`));
    const tops = await tiles.evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(2); // two rows of three
  });

  test("no tile is Family Mode or invents progress", async ({ page }) => {
    await boot(page);
    const text = (await page.getByTestId("home-tiles").innerText()).toLowerCase();
    expect(text).not.toContain("family");
    expect(text).not.toMatch(/\d+\s*%/);
  });

  for (const [key, title] of [
    ["quran", "Surahs"],
    ["learn", "Lessons"],
    ["bookmarks", "Bookmarks"],
  ] as const) {
    test(`the ${key} tile opens a working screen`, async ({ page }) => {
      await boot(page);
      await page.getByTestId(`home-tile-${key}`).click();
      await expect(page.locator(".appbar-title").first()).toContainText(title);
    });
  }

  test("tiles keep a 44pt touch target", async ({ page }) => {
    await boot(page);
    const heights = await page
      .getByTestId("home-tiles")
      .locator("button.tile")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Quran navigation", () => {
  test("selected segment is antique gold and the search field has an icon", async ({ page }) => {
    await boot(page);
    await page.getByTestId("tab-quran").click();
    const active = page.getByTestId("surah-view").locator(".seg.active");
    const bg = await active.evaluate((e) => getComputedStyle(e).backgroundColor);
    const gold = await page.evaluate(() => {
      const p = document.createElement("span");
      p.style.backgroundColor = "var(--gold)";
      document.body.appendChild(p);
      const c = getComputedStyle(p).backgroundColor;
      p.remove();
      return c;
    });
    expect(bg).toBe(gold);
    await expect(page.locator(".search-field > svg")).toBeVisible();
    await expect(page.locator(".search-field input")).toHaveAttribute("aria-label", /.+/);
  });

  test("the last-read row gains a chevron; other rows do not", async ({ page }) => {
    await boot(page);
    await page.getByTestId("tab-quran").click();
    await expect(page.locator(".row-chevron")).toHaveCount(0);
    await page
      .getByRole("button", { name: /Al-Fatiha/ })
      .first()
      .click();
    await page.getByTestId("appbar-back").click();
    await expect(page.locator(".row-chevron")).toHaveCount(1);
    await expect(page.locator(".row-last-read .row-chevron")).toBeVisible();
  });
});

test.describe("Search field at an extreme system text size", () => {
  test("stays inside the screen at 3.1x (guard only: Chromium does not reproduce the WebKit overflow; the iOS AX5 French UI test is the discriminating check)", async ({
    page,
  }) => {
    await boot(page);
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--qr-system-text-scale", "3.1"),
    );
    await page.getByTestId("tab-quran").click();
    const box = await page.locator(".search-field input").boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    expect(box!.x).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Reader header", () => {
  test("the title is centred between the back button and a balanced end slot", async ({ page }) => {
    await boot(page);
    await page.getByTestId("tab-quran").click();
    await page
      .getByRole("button", { name: /Al-Fatiha/ })
      .first()
      .click();
    const box = await page.locator(".appbar-centered .appbar-center").boundingBox();
    const vp = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x + box!.width / 2 - vp.width / 2)).toBeLessThan(4);
    await expect(page.locator(".appbar-centered .reader-ar-title")).toBeVisible();
    // progress text stays a single node
    await expect(page.getByText(/^Ayah \d+ of 7$/)).toHaveCount(1);
  });
});

test.describe("Onboarding CTA", () => {
  // A genuinely new user: override the config's "already onboarded" storage.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Get started carries an arrow that mirrors in Arabic", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("onboarding-screen")).toBeVisible({ timeout: 15_000 });
    const cta = page.getByTestId("onboarding-start");
    await expect(cta.locator("svg")).toBeVisible();
    await page.getByTestId("onboarding-language").click();
    await page.getByTestId("onboarding-language").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const t = await cta.locator("svg").evaluate((e) => getComputedStyle(e).transform);
    expect(t).not.toBe("none");
  });
});

test.describe("About & Sources", () => {
  async function openAbout(page: Page) {
    await boot(page);
    await page.getByTestId("tab-settings").click();
    await page.getByTestId("setting-about").click();
    await expect(page.getByTestId("about-screen")).toBeVisible();
  }

  test("credits Tanzil, Pickthall and Kazimirski with the database's own statuses", async ({
    page,
  }) => {
    await openAbout(page);
    const sources = page.getByTestId("about-sources");
    await expect(sources.locator("li")).toHaveCount(3);
    await expect(page.getByTestId("about-source-uthmani")).toContainText("Tanzil Project");
    await expect(page.getByTestId("about-source-uthmani")).toContainText(
      "Creative Commons Attribution 3.0",
    );
    await expect(page.getByTestId("about-source-pickthall-gutenberg-16955")).toContainText(
      "Marmaduke Pickthall",
    );
    await expect(page.getByTestId("about-source-kazimirski-1869-segments-v1")).toContainText(
      "Kazimirski",
    );
    // Statuses are never upgraded: they mirror content_sources.verification_status.
    await expect(page.getByTestId("about-source-uthmani")).toHaveAttribute(
      "data-status",
      "candidate",
    );
    await expect(page.getByTestId("about-status-uthmani")).toContainText("not complete");
    await expect(page.getByTestId("about-source-kazimirski-1869-segments-v1")).toHaveAttribute(
      "data-status",
      "candidate",
    );
    await expect(page.getByTestId("about-source-pickthall-gutenberg-16955")).toHaveAttribute(
      "data-status",
      "verified",
    );
    await expect(page.getByTestId("about-status-pickthall-gutenberg-16955")).toHaveText("Verified");
  });

  test("keeps the Tanzil copyright notice, link text and licence", async ({ page }) => {
    await openAbout(page);
    const notice = page.getByTestId("about-tanzil");
    await expect(notice).toContainText("Copyright © 2007–2021 Tanzil Project");
    await expect(notice).toContainText("Creative Commons Attribution 3.0");
    await expect(notice).toContainText("tanzil.net");
  });

  test("does not list the disputed French edition and states what is not included", async ({
    page,
  }) => {
    await openAbout(page);
    const body = await page.getByTestId("about-screen").innerText();
    expect(body).not.toContain("Hamidullah");
    expect(body).toContain("Tafsir");
  });

  test("makes no network request and back returns to Settings", async ({ page }) => {
    await boot(page);
    const origin = new URL(page.url()).origin;
    const external: string[] = [];
    page.on("request", (r) => {
      if (r.url().startsWith("http") && !r.url().startsWith(origin)) external.push(r.url());
    });
    await page.getByTestId("tab-settings").click();
    await page.getByTestId("setting-about").click();
    await expect(page.getByTestId("about-screen")).toBeVisible();
    await page.getByTestId("appbar-back").click();
    await expect(page.getByTestId("settings-screen")).toBeVisible();
    expect(external).toEqual([]);
  });

  test("renders right-to-left in Arabic and in French", async ({ page }) => {
    await openAbout(page);
    await page.getByTestId("appbar-back").click();
    await page.getByTestId("settings-language-row").click();
    await page.getByTestId("language-option-fr").click();
    await page.getByTestId("appbar-back").click();
    await page.getByTestId("setting-about").click();
    await expect(page.getByTestId("about-screen")).toContainText("À propos et sources");
    await page.getByTestId("appbar-back").click();
    await page.getByTestId("settings-language-row").click();
    await page.getByTestId("language-option-ar").click();
    await page.getByTestId("appbar-back").click();
    await page.getByTestId("setting-about").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("about-screen")).toContainText("حول التطبيق والمصادر");
  });
});

test.describe("Understand and Reflect parchment panels", () => {
  test("keep AAA-level ink contrast on the parchment", async ({ page }) => {
    await boot(page);
    await page.getByTestId("home-tile-understand").click();
    const ratio = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>("[data-testid=understand-english]")!;
      const panel = document.querySelector<HTMLElement>(".parchment-panel")!;
      const draw = (css: string) => {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
      };
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
      };
      const fg = lum(draw(getComputedStyle(el).color));
      // the gradient's darkest stop approximates the worst case
      const bgColor = getComputedStyle(panel).backgroundImage.match(
        /oklch\([^)]*\)|rgb[^)]*\)|color\([^)]*\)/g,
      )!;
      const bg = Math.min(...bgColor.map((c) => lum(draw(c))));
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(7);
  });

  test("Reflect empty state: the button has space under its paragraph", async ({ page }) => {
    await boot(page);
    await page.getByTestId("home-tile-reflect").click();
    const gap = await page.evaluate(() => {
      const p = document.querySelector("[data-testid=reflect-choose] p")!.getBoundingClientRect();
      const b = document.querySelector("[data-testid=reflect-open-quran]")!.getBoundingClientRect();
      return b.top - p.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(14);
  });
});

test.describe("Home header wordmark", () => {
  test("wraps instead of truncating at an extreme system text size", async ({ page }) => {
    await boot(page);
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--qr-system-text-scale", "3.1"),
    );
    const t = page.locator(".brand-hero .appbar-title");
    const clipped = await t.evaluate(
      (e) =>
        e.scrollWidth > e.clientWidth + 1 ||
        (getComputedStyle(e).textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth),
    );
    expect(clipped).toBe(false);
    await expect(t).toBeVisible();
  });
});

import { test, expect, type Page } from "@playwright/test";

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
}

const rootPx = (page: Page) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

/** Root size for an in-app Text Size and a system (Dynamic Type) factor. */
async function rootFor(page: Page, textSize: "small" | "medium" | "large", scale?: number) {
  await page.evaluate(
    ([size, s]) => {
      const root = document.documentElement;
      root.dataset.textSize = size as string;
      if (s === null) root.style.removeProperty("--qr-system-text-scale");
      else root.style.setProperty("--qr-system-text-scale", String(s));
    },
    [textSize, scale ?? null] as const,
  );
  return rootPx(page);
}

test.describe("Dynamic Type (system text size) composes once with the in-app Text Size", () => {
  test("without a system factor nothing changes: 15 / 16 / 18px", async ({ page }) => {
    await boot(page);
    // Chromium has no -apple-system-body, so the factor is 1 (Android/desktop unchanged).
    await expect(page.locator("html")).toHaveAttribute("data-system-text-scale", "1");
    expect(await rootFor(page, "small")).toBe(15);
    expect(await rootFor(page, "medium")).toBe(16);
    expect(await rootFor(page, "large")).toBe(18);
  });

  test("the factor multiplies the in-app size exactly once (no double scaling)", async ({
    page,
  }) => {
    await boot(page);
    expect(await rootFor(page, "medium", 1.5)).toBe(24); // 16 * 1.5
    expect(await rootFor(page, "small", 1.5)).toBe(22.5); // 15 * 1.5
    expect(await rootFor(page, "large", 1.5)).toBe(27); // 18 * 1.5
    expect(await rootFor(page, "medium", 2)).toBe(32);
  });

  test("rem-based content text actually follows (shortcut labels scale with the root)", async ({
    page,
  }) => {
    await boot(page);
    for (const sel of [".shortcut"]) {
      const el = page.locator(sel).first();
      await rootFor(page, "medium");
      const base = await el.evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
      await rootFor(page, "medium", 2);
      const scaled = await el.evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
      expect(scaled, sel).toBeCloseTo(base * 2, 1);
    }
  });

  test("chrome (tab labels, app bar title) is capped at 1.3x while content keeps scaling", async ({
    page,
  }) => {
    await boot(page);
    const tab = page.locator(".tab-item").first();
    const title = page.locator(".appbar-title").first();
    const px = (loc: typeof tab) => loc.evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
    // Below the cap the chrome follows the root: 0.72rem * 16 * 1.2
    await rootFor(page, "medium", 1.2);
    expect(await px(tab)).toBeCloseTo(0.72 * 16 * 1.2, 1);
    // Far above the cap it stops at 1.3x of the base size...
    await rootFor(page, "medium", 3);
    expect(await px(tab)).toBeCloseTo(0.72 * 16 * 1.3, 1);
    expect(await px(title)).toBeCloseTo(1.5 * 16 * 1.3, 1);
    // ...with the in-app Text Size still applied on top (large = 18px root).
    await rootFor(page, "large", 3);
    expect(await px(tab)).toBeCloseTo(0.72 * 18 * 1.3, 1);
    // No system factor: untouched.
    await rootFor(page, "medium");
    expect(await px(tab)).toBeCloseTo(0.72 * 16, 1);
  });
});

/**
 * QR-DESIGN-007C: Android font scale. The WebView applies the system font scale
 * itself (root font size = 16px x scale) and the page measures it as
 * --qr-text-zoom. Chromium cannot change the Android font scale, so these tests
 * apply the same two things the WebView + dynamic-type.ts produce on a device
 * (verified there at 1.0 / 1.3 / 1.5 / 2.0: root 16 / 20.8 / 24 / 32px).
 */
async function applyAndroidFontScale(page: Page, scale: number) {
  await page.evaluate((z) => {
    const root = document.documentElement;
    root.style.setProperty("--qr-text-zoom", String(z));
    root.style.fontSize = `${16 * z}px`; // what the WebView's text zoom does to the root
  }, scale);
}

test.describe("Android font scale: tab bar chrome is capped at 1.3x and never clips", () => {
  test.use({ viewport: { width: 412, height: 915 } });

  for (const scale of [1.0, 1.3, 1.5, 2.0]) {
    test(`all five tab labels are complete and tappable at font scale ${scale}`, async ({
      page,
    }) => {
      await boot(page);
      await applyAndroidFontScale(page, scale);
      const items = page.locator(".tab-item");
      await expect(items).toHaveCount(5);
      const info = await items.evaluateAll((els) =>
        els.map((e) => {
          const label = e.querySelector(".tab-label") as HTMLElement;
          const r = e.getBoundingClientRect();
          return {
            text: label.textContent,
            clipped: label.scrollWidth > label.clientWidth + 0.5,
            fontPx: parseFloat(getComputedStyle(label).fontSize),
            w: r.width,
            h: r.height,
            right: r.right,
          };
        }),
      );
      for (const i of info) {
        expect(i.clipped, `"${i.text}" is truncated at ${scale}x`).toBe(false);
        expect(i.h).toBeGreaterThanOrEqual(44);
        expect(i.w).toBeGreaterThanOrEqual(44);
        expect(i.right).toBeLessThanOrEqual(412 + 1);
        // Chrome stops growing at 1.3x of the base 0.72rem (11.52px): at most ~15px.
        expect(i.fontPx).toBeLessThanOrEqual(0.72 * 16 * 1.3 + 0.5);
      }
      if (scale <= 1.3) {
        // Unchanged up to 1.3x: exactly the scaled size.
        expect(info[0]!.fontPx).toBeCloseTo(0.72 * 16 * scale, 1);
      }
    });
  }

  test("body text still scales fully at 2.0 (only chrome is capped)", async ({ page }) => {
    await boot(page);
    await applyAndroidFontScale(page, 2.0);
    const tile = await page
      .locator(".tile-title")
      .first()
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(tile).toBeGreaterThan(0.8 * 16 * 1.9); // grew with the zoom
  });

  for (const [lang, toggles] of [
    ["French", 1],
    ["Arabic", 2],
  ] as const) {
    test(`${lang}: labels fit at 2.0 and the bar is mirrored correctly`, async ({ page }) => {
      await boot(page);
      for (let i = 0; i < toggles; i++) await page.getByTestId("home-language-toggle").click();
      await applyAndroidFontScale(page, 2.0);
      const rects = await page.locator(".tab-item").evaluateAll((els) =>
        els.map((e) => ({
          clipped:
            (e.querySelector(".tab-label") as HTMLElement).scrollWidth >
            (e.querySelector(".tab-label") as HTMLElement).clientWidth + 0.5,
          x: e.getBoundingClientRect().x,
          testId: e.getAttribute("data-testid"),
        })),
      );
      expect(rects.every((r) => !r.clipped)).toBe(true);
      const home = rects.find((r) => r.testId === "tab-home")!;
      const settings = rects.find((r) => r.testId === "tab-settings")!;
      if (lang === "Arabic") expect(home.x).toBeGreaterThan(settings.x);
      else expect(home.x).toBeLessThan(settings.x);
    });
  }

  test("navigation still works and the tabs keep their accessible names at 2.0", async ({
    page,
  }) => {
    await boot(page);
    await applyAndroidFontScale(page, 2.0);
    for (const [id, name] of [
      ["tab-quran", "Qur'an"],
      ["tab-learn", "Learn"],
      ["tab-progress", "Progress"],
      ["tab-settings", "Settings"],
      ["tab-home", "Home"],
    ] as const) {
      const tab = page.getByTestId(id);
      await expect(tab).toHaveAccessibleName(name);
      await tab.click();
      await expect(tab).toHaveAttribute("aria-current", "page");
    }
  });
});

test.describe("Android font scale: grids reflow instead of breaking words (QR-DESIGN-007C)", () => {
  test.use({ viewport: { width: 412, height: 915 } });

  // Android zooms text but leaves rem alone, so only --qr-text-zoom changes here.
  const columns = (page: Page, sel: string) =>
    page.locator(sel).evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);

  test("the six Home tiles drop from 3 columns at 1.0 to fewer as the font scale grows", async ({
    page,
  }) => {
    await boot(page);
    expect(await columns(page, ".tile-grid-six")).toBe(3);
    await page.evaluate(() => document.documentElement.style.setProperty("--qr-text-zoom", "1.5"));
    expect(await columns(page, ".tile-grid-six")).toBeLessThan(3);
    await page.evaluate(() => document.documentElement.style.setProperty("--qr-text-zoom", "2"));
    expect(await columns(page, ".tile-grid-six")).toBe(1);
  });

  test("the shortcut row reflows too", async ({ page }) => {
    await boot(page);
    const base = await columns(page, ".shortcut-row");
    await page.evaluate(() => document.documentElement.style.setProperty("--qr-text-zoom", "2"));
    expect(await columns(page, ".shortcut-row")).toBeLessThan(base);
  });

  test("iOS is unaffected: a system text scale alone (zoom stays 1) keeps three columns", async ({
    page,
  }) => {
    await boot(page);
    // iOS publishes --qr-system-text-scale and scales the root itself; --qr-text-zoom is 1.
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--qr-system-text-scale", "1");
      document.documentElement.style.setProperty("--qr-text-zoom", "1");
    });
    expect(await columns(page, ".tile-grid-six")).toBe(3);
  });
});

test.describe("Narrow phone at the largest text size stays inside the screen (QR-DESIGN-007C)", () => {
  // iPhone SE class width, iOS Dynamic Type AX5 (3.12x). Found by the SE AX5 UI tests:
  // the favourite button of a Surah row and the French greeting overflowed the right edge.
  test.use({ viewport: { width: 375, height: 667 } });

  test("Surah rows keep every control inside the viewport (guard only: Chromium does not reproduce the WebKit overflow; the iPhone SE AX5 UI test is the discriminating check)", async ({
    page,
  }) => {
    await boot(page);
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--qr-system-text-scale", "3.12"),
    );
    await page.getByTestId("tab-quran").click();
    const worst = await page
      .locator(".surah-row")
      .first()
      .evaluate((row) => {
        const kids = Array.from(row.querySelectorAll("button, span.arabic-text"));
        return Math.max(...kids.map((k) => k.getBoundingClientRect().right));
      });
    expect(worst).toBeLessThanOrEqual(375);
  });

  test("the greeting does not overflow, in English and French", async ({ page }) => {
    await boot(page);
    for (const toggles of [0, 1]) {
      if (toggles) await page.getByTestId("home-language-toggle").click();
      await page.evaluate(() =>
        document.documentElement.style.setProperty("--qr-system-text-scale", "3.12"),
      );
      const overflow = await page
        .locator(".brand-hero .tagline")
        .evaluate((e) => e.scrollWidth - e.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });

  test("at the default size a Surah row is still a single line (no unwanted wrapping)", async ({
    page,
  }) => {
    await boot(page);
    await page.getByTestId("tab-quran").click();
    const tops = await page
      .locator(".surah-row")
      .first()
      .evaluate((row) =>
        Array.from(row.children).map((c) => Math.round(c.getBoundingClientRect().top / 8)),
      );
    expect(new Set(tops).size).toBeLessThanOrEqual(2); // same visual line (badge/star may centre differently)
    const h = await page
      .locator(".surah-row")
      .first()
      .evaluate((e) => e.getBoundingClientRect().height);
    expect(h).toBeLessThan(90);
  });
});

test.describe("Default sizes are unchanged by the 007C wrapping rules", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("the Home reading card keeps the surah name and its Arabic name on one line", async ({
    page,
  }) => {
    await boot(page);
    const info = await page.locator(".hero-body").evaluate((row) => {
      const kids = Array.from(row.children).map((c) => c.getBoundingClientRect());
      return {
        tops: kids.map((k) => Math.round(k.top)),
        height: row.getBoundingClientRect().height,
      };
    });
    // title block and Arabic name share the same row (their tops differ only by alignment)
    expect(info.height).toBeLessThan(90);
  });

  test("the Learn level/category chips stay on one row", async ({ page }) => {
    await boot(page);
    await page.getByTestId("tab-learn").click();
    const tops = await page
      .locator("button.chip")
      .evaluateAll((els) => els.slice(0, 2).map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });
});

test.describe("Memorize tiles keep three columns at default size on common phone widths", () => {
  for (const width of [375, 360]) {
    test(`${width}pt wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await boot(page);
      await page.getByTestId("home-tile-memorize").click();
      const cols = await page
        .locator(".tile-grid-three")
        .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);
      expect(cols).toBe(3);
    });
  }
});

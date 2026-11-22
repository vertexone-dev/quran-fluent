import { test, expect, type Page } from "@playwright/test";

/**
 * QR-DESIGN-004A: parchment Reader card, Home greeting + journey card,
 * Surah list (Surah/Bookmarks, hexagon badges, last-read), Learn level cards.
 * Everything is backed by real local data; nothing is sample content.
 */

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
}

/** WCAG contrast between two CSS colours, resolved through a canvas so that
 * oklch()/color-mix() values work. */
async function contrast(page: Page, fg: string, bg: string): Promise<number> {
  return page.evaluate(
    ([a, b]) => {
      const rgb = (css: string) => {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#000";
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
      };
      const lum = ([r, g, bl]: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(bl!);
      };
      const l1 = lum(rgb(a!));
      const l2 = lum(rgb(b!));
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    },
    [fg, bg],
  );
}

test.describe("Parchment Reader card", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`Arabic ink on parchment has AAA contrast in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem("qr.settings.theme", JSON.stringify(t));
      }, theme);
      await boot(page);
      await page.getByTestId("tab-quran").click();
      await page.locator(".list-row").first().click();
      const card = page.locator(".verse-card.parchment").first();
      await expect(card).toBeVisible();
      const ink = await card.locator(".quran-text").evaluate((el) => getComputedStyle(el).color);
      const paperDark = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--qr-ivory-muted").trim(),
      );
      expect(await contrast(page, ink, paperDark)).toBeGreaterThan(7);
      const bg = await card.evaluate((el) => getComputedStyle(el).backgroundImage);
      expect(bg).toContain("gradient");
    });
  }

  test("translations and Arabic text are unchanged by the restyle", async ({ page }) => {
    await boot(page);
    await page.getByTestId("tab-quran").click();
    await page.locator(".list-row").first().click();
    await page.getByTestId("reader-translation-en").click();
    await expect(page.locator(".verse-card .quran-text").first()).toContainText("بِسْمِ");
    await expect(page.locator(".verse-card .translation-text").first()).toHaveText(
      "In the name of Allah, the Beneficent, the Merciful.",
    );
  });
});

test.describe("Home greeting and journey card", () => {
  test("greeting is As-Salāmu ʿAlaykum; no journey card on a fresh install", async ({ page }) => {
    await boot(page);
    await expect(page.locator(".brand-hero .eyebrow")).toHaveText("As-Salāmu ʿAlaykum");
    await expect(page.getByTestId("home-journey-card")).toHaveCount(0);
  });

  test("after reading, the journey card shows the real position and opens Progress", async ({
    page,
  }) => {
    await boot(page);
    await page.getByTestId("tab-quran").click();
    await page.locator(".list-row").nth(1).click(); // Al-Baqara, records a position
    await expect(page.locator("h1")).toHaveText("Al-Baqara");
    await page.goto("/");
    const card = page.getByTestId("home-journey-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Your Journey");
    await expect(card).toContainText("Al-Baqara 2:");
    await expect(card).not.toContainText("42%"); // no invented figure
    await card.click();
    await expect(page.getByTestId("progress-screen")).toBeVisible();
  });

  test("greeting is localised (Arabic)", async ({ page }) => {
    await boot(page);
    await page.getByTestId("home-language-toggle").click();
    await page.getByTestId("home-language-toggle").click();
    await expect(page.locator(".brand-hero .eyebrow")).toHaveText("السلام عليكم");
  });
});

test.describe("Surah list", () => {
  test.beforeEach(async ({ page }) => boot(page));

  test("every surah has a hexagon badge, and nothing is highlighted before any reading", async ({
    page,
  }) => {
    await page.getByTestId("tab-quran").click();
    await expect(page.locator(".surah-hex")).toHaveCount(114);
    await expect(page.locator(".row-last-read")).toHaveCount(0);
  });

  test("the last-read surah is highlighted and labelled", async ({ page }) => {
    await page.getByTestId("tab-quran").click();
    await page.locator(".list-row").nth(1).click();
    await expect(page.locator("h1")).toHaveText("Al-Baqara");
    await page.getByTestId("tab-quran").click();
    const row = page.locator(".row-last-read");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Al-Baqara");
    await expect(row).toContainText("Last read");
  });

  test("Surah / Bookmarks view switch shows real bookmarks and an empty state otherwise", async ({
    page,
  }) => {
    await page.getByTestId("tab-quran").click();
    await expect(page.getByTestId("surah-view-surah")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("surah-view-bookmarks").click();
    await expect(page.getByTestId("bookmark-open")).toHaveCount(0);
    await page.getByTestId("surah-view-surah").click();
    await page.locator(".list-row").first().click();
    await page
      .getByRole("button", { name: /add bookmark|bookmark/i })
      .first()
      .click();
    await page.getByTestId("tab-quran").click();
    await page.getByTestId("surah-view-bookmarks").click();
    await expect(page.getByTestId("bookmark-open")).toHaveCount(1);
    await expect(page.getByTestId("bookmark-open")).toContainText("Al-Fatiha");
  });
});

test.describe("Learn level cards", () => {
  test("the six real levels are separate cards with numbered badges", async ({ page }) => {
    await boot(page);
    await page.getByTestId("tab-learn").click();
    await expect(page.locator(".level-card")).toHaveCount(6);
    await expect(page.locator(".level-badge")).toHaveText(["1", "2", "3", "4", "5", "6"]);
    await expect(page.locator(".level-card").first()).toContainText("Foundations of Arabic Script");
    await page.locator(".level-card").first().click();
    await expect(page.locator(".list-row").first()).toBeVisible();
  });
});

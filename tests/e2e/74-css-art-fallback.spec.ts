import { expect, test, type Page } from "@playwright/test";

// QR-WEB-006: the CSS-only artwork treatment is what every release build ships
// (src/design/artwork.ts). Runs signed out against the dev server started with
// VITE_ART_MODE=css (playwright.config.ts, project "css-art"). The cinematic
// photo set is AI-generated and blocked from production until written rights
// exist, so nothing here may ever request it.

const CINEMATIC = /quranroots-(hero|journeys)-cinematic/;

function trackCinematicRequests(page: Page): string[] {
  const hits: string[] = [];
  page.on("request", (r) => {
    if (CINEMATIC.test(r.url())) hits.push(r.url());
  });
  return hits;
}

/**
 * Worst-case contrast of white text over the artwork behind it: hides the
 * element's text, screenshots its box, and takes the brightest background
 * pixel (the least favourable for light text).
 */
async function whiteTextContrast(page: Page, selector: string): Promise<number> {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.addStyleTag({
    content: `[data-testid="hero-section"] h1, [data-testid="hero-section"] h1 *, [data-testid="hero-section"] p, [data-testid="hero-section"] p * { color: transparent !important; text-shadow: none !important; }`,
  });
  const shot = await page.screenshot({
    clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height },
  });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const lin = (v: number) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    let maxL = 0;
    for (let i = 0; i < data.length; i += 4) {
      maxL = Math.max(
        maxL,
        0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]),
      );
    }
    return 1.05 / (maxL + 0.05);
  }, shot.toString("base64"));
}

for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe(`CSS-only artwork, ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("homepage hero renders the CSS backdrop and never requests the cinematic images", async ({
      page,
    }) => {
      const hits = trackCinematicRequests(page);
      await page.goto("/");
      await expect(page.getByTestId("hero-section")).toBeVisible();
      await expect(page.getByTestId("css-art-hero")).toBeVisible();
      await expect(page.locator("main img[src*='cinematic']")).toHaveCount(0);
      await expect(page.getByTestId("hero-continue-reading-button")).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(hits).toEqual([]);
    });

    test("hero text stays readable over the CSS backdrop (WCAG AA)", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByTestId("css-art-hero")).toBeVisible();
      await page.waitForTimeout(1800); // entrance animation settled
      const title = await whiteTextContrast(page, '[data-testid="hero-section"] h1');
      expect(title).toBeGreaterThanOrEqual(4.5);
      const subtitle = await whiteTextContrast(page, '[data-testid="hero-section"] h1 + p');
      expect(subtitle).toBeGreaterThanOrEqual(4.5);
    });

    test("Continue Reading CTA: gold-outlined glass pill, readable, with hover and keyboard focus states", async ({
      page,
    }) => {
      await page.goto("/");
      const cta = page.getByTestId("hero-continue-reading-button");
      await expect(cta).toBeVisible();
      await page.waitForTimeout(1800); // entrance animation settled

      // refined gold-outlined glass: a dark translucent fill, not the old solid teal
      const fill = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
      // computed colour is "oklch(L C H / A)" or "rgba(r, g, b, A)"; no alpha part means opaque
      const alphaMatch = /(?:\/|,)\s*([\d.]+)\s*\)$/.exec(fill);
      expect(alphaMatch, `unparsed fill: ${fill}`).not.toBeNull();
      const alpha = Number(alphaMatch![1]);
      expect(alpha).toBeLessThan(0.9);
      expect(await cta.locator(".cta-ring").count()).toBe(1); // the gold outline

      // ivory text over the glass fill: worst-case contrast (WCAG AA)
      const contrast = async () => {
        const box = (await cta.boundingBox())!;
        await page.addStyleTag({
          content: `[data-testid="hero-continue-reading-button"] > span.relative { visibility: hidden !important; }`,
        });
        const shot = await page.screenshot({
          clip: { x: box.x, y: box.y, width: box.width, height: box.height },
        });
        return page.evaluate(async (b64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const { data } = ctx.getImageData(
            Math.floor(c.width * 0.12),
            Math.floor(c.height * 0.2),
            Math.floor(c.width * 0.76),
            Math.floor(c.height * 0.6),
          );
          const lin = (v: number) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          let maxL = 0;
          for (let i = 0; i < data.length; i += 4) {
            maxL = Math.max(
              maxL,
              0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]),
            );
          }
          const ivory = 0.2126 * lin(249) + 0.7152 * lin(246) + 0.0722 * lin(239);
          return (ivory + 0.05) / (maxL + 0.05);
        }, shot.toString("base64"));
      };
      expect(await contrast()).toBeGreaterThanOrEqual(4.5);
      await page.addStyleTag({
        content: `[data-testid="hero-continue-reading-button"] > span.relative { visibility: visible !important; }`,
      });

      // hover: stronger glow
      const shadowBefore = await cta.evaluate((el) => getComputedStyle(el).boxShadow);
      await cta.hover();
      await page.waitForTimeout(450);
      const shadowHover = await cta.evaluate((el) => getComputedStyle(el).boxShadow);
      expect(shadowHover).not.toBe(shadowBefore);
      await page.mouse.move(0, 0);

      // keyboard focus: a visible gold focus ring, and Enter still follows the link
      await cta.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(cta).toBeFocused();
      const ring = await cta.evaluate((el) => getComputedStyle(el).boxShadow);
      expect(ring).not.toBe(shadowBefore);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/quran/);
    });

    test("the fifth feature card is Guided Learning and leads to /learn", async ({ page }) => {
      await page.goto("/");
      const card = page
        .getByRole("region", { name: "Explore QuranRoots" })
        .getByRole("link", { name: /Guided Learning/ });
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("href", "/learn");
    });

    test("no horizontal overflow", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByTestId("css-art-hero")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("Guided Journeys shows the CSS panel and its levels", async ({ page }) => {
      const hits = trackCinematicRequests(page);
      await page.goto("/");
      const section = page.getByTestId("home-journeys-section");
      await section.scrollIntoViewIfNeeded();
      const panel = section.getByTestId("css-art-journeys");
      await expect(panel).toBeVisible();
      // the backdrop panel is tall enough to show its arch (it was a short, squat strip on mobile)
      expect((await panel.boundingBox())!.height).toBeGreaterThanOrEqual(240);
      await expect(section.getByTestId("journey-level").first()).toBeVisible();
      expect(hits).toEqual([]);
    });

    test("auth shell renders the CSS backdrop with its form intact", async ({ page }) => {
      const hits = trackCinematicRequests(page);
      await page.goto("/auth");
      await expect(page.getByTestId("auth-shell")).toBeVisible();
      await expect(page.getByTestId("css-art-auth")).toBeVisible();
      await expect(page.getByLabel(/email/i).first()).toBeVisible();
      expect(hits).toEqual([]);
    });
  });
}

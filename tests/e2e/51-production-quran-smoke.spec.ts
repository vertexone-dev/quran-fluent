import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Focused production release gate for the Quran Reader (Phase 8B.3):
 * Arabic, Pickthall, and the certified Kazimirski French corpus, plus
 * general Reader stability. Runs only against a real deployed target --
 * local dev and the PR/main CI database never carry the certified
 * Kazimirski corpus (see scripts/validate-quran-content.mjs and
 * PHASE8A-CONTENT-INVENTORY.md), so this suite is a no-op there rather than
 * a false failure. In this repo, PLAYWRIGHT_BASE_URL is only ever set by
 * production-validation.yml, pointed at the real production Worker.
 *
 * Deliberately narrow -- a release gate, not a general regression suite
 * (that's specs 06/14/15/49/50, which already cover the Reader in CI
 * against local dev). Assertions read real production data via
 * createTestUserClient() rather than hand-typed fixtures wherever the exact
 * text matters, so this stays correct if the certified corpus is ever
 * legitimately re-certified with different wording.
 */
test.describe("Production Quran Reader smoke suite", () => {
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL,
    "production-only: requires a real deployed target (PLAYWRIGHT_BASE_URL) so the certified Kazimirski corpus is actually present",
  );

  let consoleErrors: string[] = [];
  let failedRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    failedRequests = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (req) => {
      if (req.failure()?.errorText === "net::ERR_ABORTED") return; // benign nav/route cancellation
      failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
    });
    page.on("response", (res) => {
      if (res.status() >= 500) failedRequests.push(`${res.status()} ${res.url()}`);
    });
  });

  test.afterEach(() => {
    expect(consoleErrors, `unexpected console errors: ${consoleErrors.join("; ")}`).toEqual([]);
    expect(
      failedRequests,
      `failed critical network requests: ${failedRequests.join("; ")}`,
    ).toEqual([]);
  });

  test("Al-Fatiha (Surah 1): Arabic RTL/lang, Pickthall attribution, exactly 7 ayah cards", async ({
    page,
  }) => {
    await page.goto("/quran?surah=1");
    await expect(page.locator('[id^="ayah-1-"]')).toHaveCount(7);

    const arabic = page.locator('[lang="ar"][dir="rtl"]').first();
    await expect(arabic).toBeVisible();
    expect((await arabic.innerText()).trim().length).toBeGreaterThan(0);

    await expect(
      page.getByRole("button", { name: "Translator: Marmaduke Pickthall" }).first(),
    ).toBeVisible();

    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(/\bnull\b/);
  });

  test("Kazimirski French: correct attribution, never Hamidullah, no unavailable fallback on Al-Fatiha", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      await page.goto("/quran?surah=1");
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(
        page.getByText(/Traducteur\s*:\s*Albin de Kazimirski Biberstein/).first(),
      ).toBeVisible();
      await expect(page.getByText(/Hamidullah/)).toHaveCount(0);
      await expect(
        page.getByText("Traduction française pas encore disponible pour ce verset."),
      ).toHaveCount(0);

      const bodyText = await page.locator("main").innerText();
      expect(bodyText).not.toMatch(/\bnull\b/);
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("Quraish (Surah 106): 4 ayah cards; the compound-boundary segment renders once on ayah 3, never duplicated onto ayah 4", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      const { data: kazSource } = await client
        .from("content_sources")
        .select("id")
        .eq("edition_identifier", "kazimirski-1869-segments-v1")
        .single();

      // Real production join data drives the assertion -- not a hand-typed
      // fixture -- so this stays correct even if the certified corpus is
      // ever legitimately re-certified with different text for this Surah.
      const { data: joinRows } = await client
        .from("translation_segment_ayahs")
        .select("ayah_number, segment:translation_segments!inner(id, text)")
        .eq("surah_number", 106)
        .eq("translation_segments.source_id", kazSource!.id)
        .order("ayah_number");

      type Join = { ayah_number: number; segment: { id: string; text: string } };
      const rows = (joinRows ?? []) as unknown as Join[];
      const ayah3SegmentIds = new Set(
        rows.filter((r) => r.ayah_number === 3).map((r) => r.segment.id),
      );
      const ayah4SegmentIds = new Set(
        rows.filter((r) => r.ayah_number === 4).map((r) => r.segment.id),
      );
      const sharedSegmentIds = [...ayah3SegmentIds].filter((id) => ayah4SegmentIds.has(id));
      // This is exactly the shape src/lib/kazimirski.ts's "home ayah"
      // algorithm exists to handle correctly -- assert the precondition
      // holds in production rather than assuming it (architecture-based,
      // per this audit's own guidance against hardcoding fragile
      // assumptions about Kazimirski's historical numbering).
      expect(
        sharedSegmentIds.length,
        "expected ayah 3 and 4 to share a compound-boundary segment in the certified corpus",
      ).toBeGreaterThan(0);

      const sharedSegment = rows.find((r) => sharedSegmentIds.includes(r.segment.id))!.segment;
      const ayah4OwnSegment = rows.find(
        (r) => r.ayah_number === 4 && !sharedSegmentIds.includes(r.segment.id),
      );

      await page.goto("/quran?surah=106");
      await expect(page.locator('[id^="ayah-106-"]')).toHaveCount(4);

      // The shared segment's full text appears exactly once on the page
      // (its "home" ayah, 3) -- not repeated onto ayah 4.
      await expect(page.getByText(sharedSegment.text, { exact: false })).toHaveCount(1);
      if (ayah4OwnSegment) {
        const wouldBeDuplicated = `${sharedSegment.text} ${ayah4OwnSegment.segment.text}`;
        await expect(page.getByText(wouldBeDuplicated, { exact: false })).toHaveCount(0);
      }
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("Reader is stable across navigation and reload, with no horizontal overflow at the established mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/quran?surah=1");
    await expect(page.locator('[id^="ayah-1-"]').first()).toBeVisible();

    await page.goto("/quran?surah=2");
    await expect(page.locator('[id^="ayah-2-"]').first()).toBeVisible();

    await page.reload();
    await expect(page.locator('[id^="ayah-2-"]').first()).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});

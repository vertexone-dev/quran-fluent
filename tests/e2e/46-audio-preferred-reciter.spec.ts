import { test, expect, type Page } from "@playwright/test";

import { createTestUserClient, resetLessonProgress } from "./utils/db";

/**
 * Covers Audio Foundation Phase 2: wiring the already-persisted
 * `preferred_reciter` setting into the centralized audio player
 * (usePreferredReciter in AyahPlayButton, resolvePreferredReciter in
 * src/lib/audio.ts). resolvePreferredReciter's own fallback/validation
 * logic is covered directly and deterministically by src/lib/audio.test.ts
 * (vitest) -- this file covers what only a real browser session can prove:
 * the preference is actually read from the DB, actually reaches the
 * provider request, actually propagates live after a Settings save, and
 * never lets a changed preference reach into audio already playing.
 *
 * Every external request is intercepted exactly as Phase 1 does -- CI
 * never depends on live api.quran.com.
 */

const RECITER_PROVIDER_IDS: Record<string, number> = {
  mishary_alafasy: 7,
  abdulbasit_murattal: 2,
  husary: 6,
};

function makeSilentWav(durationSeconds: number, sampleRate = 8000): Buffer {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const buffer = Buffer.alloc(44 + numSamples);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate, 28);
  buffer.writeUInt16LE(1, 32);
  buffer.writeUInt16LE(8, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples, 40);
  buffer.fill(128, 44);
  return buffer;
}

const LONG_WAV = makeSilentWav(3);

/** Records every reciter ID actually requested from the provider, and
 * serves a real playable WAV for any of them. */
async function mockRecitationAudio(page: Page): Promise<number[]> {
  const requestedReciterIds: number[] = [];
  await page.route("**/api.quran.com/api/v4/recitations/*/by_ayah/*", async (route) => {
    const url = new URL(route.request().url());
    const reciterId = Number(url.pathname.split("/recitations/")[1]!.split("/")[0]);
    requestedReciterIds.push(reciterId);
    const key = url.pathname.split("/by_ayah/")[1]!;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        audio_files: [{ url: `mock-audio/${reciterId}-${key.replace(":", "-")}.wav` }],
      }),
    });
  });
  await page.route("**/mock-audio/*.wav", async (route) => {
    await route.fulfill({ status: 200, contentType: "audio/wav", body: LONG_WAV });
  });
  return requestedReciterIds;
}

test.describe("Audio Foundation Phase 2 — preferred reciter", () => {
  for (const [reciterKey, reciterId] of Object.entries(RECITER_PROVIDER_IDS)) {
    test(`an authenticated user's "${reciterKey}" preference resolves to provider reciter ID ${reciterId}`, async ({
      page,
    }) => {
      const { client, userId } = await createTestUserClient();
      await client
        .from("learning_preferences")
        .update({ preferred_reciter: reciterKey })
        .eq("user_id", userId);

      try {
        const requestedIds = await mockRecitationAudio(page);
        await page.goto("/quran");
        await page.getByRole("button", { name: "Play recitation" }).first().click();
        await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();
        expect(requestedIds).toEqual([reciterId]);
      } finally {
        await client
          .from("learning_preferences")
          .update({ preferred_reciter: "mishary_alafasy" })
          .eq("user_id", userId);
      }
    });
  }

  test("an invalid stored preference falls back to the default reciter without breaking playback", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ preferred_reciter: "some_unrecognized_reciter" })
      .eq("user_id", userId);

    try {
      const requestedIds = await mockRecitationAudio(page);
      await page.goto("/quran");
      await page.getByRole("button", { name: "Play recitation" }).first().click();
      await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();
      expect(requestedIds).toEqual([RECITER_PROVIDER_IDS.mishary_alafasy]);
    } finally {
      await client
        .from("learning_preferences")
        .update({ preferred_reciter: "mishary_alafasy" })
        .eq("user_id", userId);
    }
  });

  test("an anonymous visitor uses the default reciter", async ({ browser }) => {
    // A fresh, unauthenticated context -- deliberately not the project's
    // shared logged-in storageState.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      const requestedIds = await mockRecitationAudio(page);
      await page.goto("/quran");
      await page.getByRole("button", { name: "Play recitation" }).first().click();
      await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();
      expect(requestedIds).toEqual([RECITER_PROVIDER_IDS.mishary_alafasy]);
    } finally {
      await context.close();
    }
  });

  test("the Qur'an reader and a lesson's quran_example section use the same preferred reciter", async ({
    page,
    request,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ preferred_reciter: "husary" })
      .eq("user_id", userId);

    try {
      const requestedIds = await mockRecitationAudio(page);

      await page.goto("/quran");
      await page.getByRole("button", { name: "Play recitation" }).first().click();
      await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();

      const url = process.env.VITE_SUPABASE_URL!;
      const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
      const lessonsRes = await request.get(
        `${url}/rest/v1/lessons?select=id&slug=eq.reading-with-grammar-awareness`,
        { headers: { apikey: anonKey } },
      );
      const lessons = (await lessonsRes.json()) as { id: string }[];
      const lessonId = lessons[0]!.id;
      await resetLessonProgress(lessonId);

      await page.goto(`/lesson/${lessonId}`);
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Play recitation" }).click();
      await expect(page.getByRole("button", { name: "Pause recitation" })).toBeVisible();

      expect(requestedIds).toEqual([RECITER_PROVIDER_IDS.husary, RECITER_PROVIDER_IDS.husary]);
    } finally {
      await client
        .from("learning_preferences")
        .update({ preferred_reciter: "mishary_alafasy" })
        .eq("user_id", userId);
    }
  });

  test("changing the reciter in Settings and saving affects subsequent playback, without logging out, and never touches audio already playing", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ preferred_reciter: "mishary_alafasy" })
      .eq("user_id", userId);

    try {
      const requestedIds = await mockRecitationAudio(page);

      // Start playback under the current (Alafasy) preference.
      await page.goto("/quran");
      await page.getByRole("button", { name: "Play recitation" }).first().click();
      await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();

      // Client-side navigation to Settings (via the app's own <Link>, not
      // page.goto -- a goto is a full page reload that would destroy the
      // singleton this test is specifically verifying survives). The
      // shared <audio> element is a module-level singleton, not tied to
      // any component's lifecycle, so it must keep playing straight
      // through this route change.
      await page.getByTestId("account-menu-trigger").click();
      await page.getByRole("menuitem", { name: "Settings" }).click();
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
      const stillPlaying = await page.evaluate(() => {
        const el = document.querySelector("audio");
        return el ? !el.paused : false;
      });
      expect(stillPlaying).toBe(true);

      // Change the reciter and save -- this is the app's own existing
      // save flow, which already invalidates the ["learner", userId]
      // query React Query cache -- no new propagation mechanism added.
      await page.getByLabel("Preferred reciter").click();
      await page.getByRole("option", { name: "Mahmoud Khalil Al-Husary" }).click();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();

      // The original playback is still completely undisturbed by the save.
      const stillPlayingAfterSave = await page.evaluate(() => {
        const el = document.querySelector("audio");
        return el ? !el.paused : false;
      });
      expect(stillPlayingAfterSave).toBe(true);
      expect(requestedIds).toEqual([RECITER_PROVIDER_IDS.mishary_alafasy]);

      // Back to the reader (again via a real client-side <Link>, not
      // goto): the ORIGINAL audio element is still the same one, still
      // playing, still under the old reciter -- switching never silently
      // happened mid-āyah.
      await page.getByRole("link", { name: "Qur'an" }).first().click();
      const stillPlayingOnReturn = await page.evaluate(() => {
        const el = document.querySelector("audio");
        return el ? !el.paused : false;
      });
      expect(stillPlayingOnReturn).toBe(true);

      // A genuinely NEW play request -- on a different āyah -- is the
      // first place the new preference is actually used. Starting it also
      // stops the original (Phase 1's "no overlapping playback" guarantee
      // still applies), so exactly one "Pause" button exists afterward,
      // not two.
      await page.getByRole("button", { name: "Play recitation" }).nth(1).click();
      await expect(page.getByRole("button", { name: "Pause recitation" })).toHaveCount(1);
      expect(requestedIds).toEqual([
        RECITER_PROVIDER_IDS.mishary_alafasy,
        RECITER_PROVIDER_IDS.husary,
      ]);
    } finally {
      await client
        .from("learning_preferences")
        .update({ preferred_reciter: "mishary_alafasy" })
        .eq("user_id", userId);
    }
  });

  test("the reciter setting still renders correctly in French, and the reader remains usable at 390x844", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      await page.goto("/settings");
      await expect(page.getByText("Récitateur préféré")).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await mockRecitationAudio(page);
    await page.goto("/quran");
    await expect(page.getByRole("button", { name: "Play recitation" }).first()).toBeVisible();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });
});

import { test, expect, type Page } from "@playwright/test";

import { resetLessonProgress } from "./utils/db";

/**
 * Covers Audio Foundation Phase 1: the centralized recitation-audio
 * abstraction (src/lib/audio.ts) and its reusable <AyahPlayButton />
 * consumer, wired into both the Qur'an reader (AyahReader) and lesson
 * quran_example sections (LessonSectionRenderer).
 *
 * Every external request (the api.quran.com resource-resolution call AND
 * the actual audio byte stream) is intercepted and replaced with a
 * deterministic, fully local response -- CI never depends on the real
 * provider being reachable or fast. The mocked audio is a genuinely
 * valid, tiny (0.3s) silent WAV, not a stub -- so "playing"/"ended"
 * assertions exercise real <audio> element behavior, not a fake state.
 */

/** A tiny, valid, silent WAV file -- real enough for a headless browser's
 * <audio> element to genuinely decode and play, so tests exercise actual
 * playback events (ended, etc.) rather than a hand-waved stand-in. */
function makeSilentWav(durationSeconds: number, sampleRate = 8000): Buffer {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const dataSize = numSamples;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
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
  buffer.writeUInt32LE(dataSize, 40);
  buffer.fill(128, 44);
  return buffer;
}

const SHORT_WAV = makeSilentWav(0.3);
const MOCK_AUDIO_PATH = "**/mock-audio/*.wav";

/** Intercepts the recitation-resolution API for every (surah, ayah) with a
 * controllable per-key response, and serves the mocked WAV for the audio
 * byte request itself -- the two network hops the real player makes. */
async function mockRecitationAudio(
  page: Page,
  responses: Record<string, "ok" | "empty" | "fail"> = {},
) {
  await page.route("**/api.quran.com/api/v4/recitations/*/by_ayah/*", async (route) => {
    const url = new URL(route.request().url());
    const key = url.pathname.split("/by_ayah/")[1]!;
    const mode = responses[key] ?? "ok";
    if (mode === "fail") {
      await route.fulfill({ status: 500, body: "provider error" });
      return;
    }
    if (mode === "empty") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ audio_files: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ audio_files: [{ url: `mock-audio/${key.replace(":", "-")}.wav` }] }),
    });
  });

  await page.route(MOCK_AUDIO_PATH, async (route) => {
    await route.fulfill({ status: 200, contentType: "audio/wav", body: SHORT_WAV });
  });
}

test.describe("Audio Foundation Phase 1", () => {
  test("play, pause and resume on the Qur'an reader, with no overlapping playback across āyāt", async ({
    page,
  }) => {
    await mockRecitationAudio(page);
    await page.goto("/quran");
    await expect(page.getByRole("heading", { name: "Read" })).toBeVisible();

    const playButtons = page.getByRole("button", { name: "Play recitation" });
    const firstPlay = playButtons.first();
    await expect(firstPlay).toBeVisible();
    await firstPlay.click();

    // loading -> playing
    await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();

    // Pause.
    await page.getByRole("button", { name: "Pause recitation" }).first().click();
    await expect(playButtons.first()).toBeVisible();

    // Resume without an error state.
    await playButtons.first().click();
    await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();

    // Starting a second āyah's playback must stop the first one -- its
    // button must revert to idle "Play", never stay stuck on "Pause".
    const secondPlay = page.getByRole("button", { name: "Play recitation" }).nth(0);
    await secondPlay.click();
    await expect(page.getByRole("button", { name: "Pause recitation" })).toHaveCount(1);
  });

  test("a short āyah reaches the ended state and offers replay", async ({ page }) => {
    await mockRecitationAudio(page);
    await page.goto("/quran");

    const playButton = page.getByRole("button", { name: "Play recitation" }).first();
    await playButton.click();
    await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();

    // The mocked clip is 0.3s -- wait for it to naturally end.
    const replayButton = page.getByRole("button", { name: "Replay from start" }).first();
    await expect(replayButton).toBeVisible({ timeout: 5_000 });

    await replayButton.click();
    await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();
  });

  test("provider failure surfaces an error state without breaking the reader, and rapid clicks cause no unhandled rejection", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await mockRecitationAudio(page, { "1:1": "fail" });
    await page.goto("/quran");
    await expect(page.getByRole("heading", { name: "Read" })).toBeVisible();

    const playButton = page.getByRole("button", { name: "Play recitation" }).first();
    // Rapid repeated clicks on a failing request -- must never throw an
    // unhandled promise rejection, and must settle into a single coherent
    // error state, not several conflicting ones.
    await playButton.click();
    await playButton.click().catch(() => {});
    await playButton.click().catch(() => {});

    await expect(
      page.getByRole("button", { name: "Couldn't play the recitation. Try again." }),
    ).toBeVisible();
    // The Qur'an text itself must still be fully intact.
    await expect(page.locator("p[dir='rtl'][lang='ar']").first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("an āyah with no audio file resolves to a distinct, disabled unavailable state (not the generic retry error), and existing Qur'an reader behavior is unaffected", async ({
    page,
  }) => {
    await mockRecitationAudio(page, { "1:1": "empty" });
    await page.goto("/quran");

    const playButton = page.getByRole("button", { name: "Play recitation" }).first();
    await playButton.click();
    const unavailableButton = page.getByRole("button", {
      name: "Recitation audio isn't available for this Ayah.",
    });
    await expect(unavailableButton).toBeVisible();
    await expect(unavailableButton).toBeDisabled();

    // Existing reader functionality (Arabic text + translation) untouched.
    await expect(page.locator("p[dir='rtl'][lang='ar']").first()).toBeVisible();
    await expect(page.getByText(/./).first()).toBeVisible();
  });

  test("the play control is keyboard-operable", async ({ page }) => {
    await mockRecitationAudio(page);
    await page.goto("/quran");

    const playButton = page.getByRole("button", { name: "Play recitation" }).first();
    await playButton.focus();
    const isFocused = await playButton.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Pause recitation" }).first()).toBeVisible();
  });

  test("renders correctly at 390x844 with no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockRecitationAudio(page);
    await page.goto("/quran");

    await expect(page.getByRole("button", { name: "Play recitation" }).first()).toBeVisible();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test("a lesson quran_example section renders its play control alongside the canonical Arabic text without disrupting the lesson", async ({
    page,
    request,
  }) => {
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const lessonsRes = await request.get(
      `${url}/rest/v1/lessons?select=id&slug=eq.reading-with-grammar-awareness`,
      { headers: { apikey: anonKey } },
    );
    const lessons = (await lessonsRes.json()) as { id: string }[];
    const lessonId = lessons[0]!.id;
    await resetLessonProgress(lessonId);

    await mockRecitationAudio(page);
    await page.goto(`/lesson/${lessonId}`);
    await expect(
      page.getByRole("heading", { name: "Reading With Grammar Awareness" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // past explanation, to quran_example

    await expect(page.locator("p[dir='rtl'][lang='ar']").first()).toBeVisible();
    const lessonPlayButton = page.getByRole("button", { name: "Play recitation" });
    await expect(lessonPlayButton).toBeVisible();
    await lessonPlayButton.click();
    await expect(page.getByRole("button", { name: "Pause recitation" })).toBeVisible();
  });
});

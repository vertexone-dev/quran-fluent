import { test, expect, type Page } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Covers Memorization Audio Phase 1: real Play/Pause/Replay/repeat-count
 * controls on the memorization page (MemorizationAudioControls in
 * src/routes/_authenticated/memorize.tsx), reusing the exact same
 * ayahAudioPlayer singleton and usePreferredReciter loading-gate already
 * proven by the Audio Foundation and preferred-reciter specs -- this file
 * only exercises what's new here: the repeat cycle (N total plays driven
 * by the player's own "ended" event) and Previous/Next interrupting it.
 *
 * Every external request is intercepted exactly as the other audio specs
 * do -- CI never depends on live api.quran.com. The mocked clip is a
 * genuinely valid, playable silent WAV, not a stub. Tests that only wait
 * for a cycle to finish naturally use a short (0.3s) clip; tests that
 * perform a second real UI action while audio is expected to still be
 * mid-playback (pause, replay, Next/Previous) use a longer (5s) one --
 * a too-short clip there could reach a genuine natural "ended" before
 * that second action lands on a loaded CI runner, which would look
 * identical to a real interruption (the exact failure class the Audio
 * Foundation Phase 2 fix gate diagnosed for the same reason).
 *
 * Surah 112 (Al-Ikhlas, 4 āyāt) is used throughout for stable, well-known
 * first/last boundaries.
 */

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

const SHORT_WAV = makeSilentWav(0.3);
const LONG_WAV = makeSilentWav(5);

/** Records every (reciterId, surah:ayah) key actually requested from the
 * provider, and serves a real playable WAV -- or a failure/empty response
 * for a given key, when `mode` requests one. */
async function mockRecitationAudio(
  page: Page,
  mode: "ok" | "fail" | "empty" = "ok",
  clip: Buffer = SHORT_WAV,
): Promise<string[]> {
  const requested: string[] = [];
  await page.route("**/api.quran.com/api/v4/recitations/*/by_ayah/*", async (route) => {
    const url = new URL(route.request().url());
    const reciterId = url.pathname.split("/recitations/")[1]!.split("/")[0];
    const key = url.pathname.split("/by_ayah/")[1]!;
    requested.push(`${reciterId}:${key}`);
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
      body: JSON.stringify({
        audio_files: [{ url: `mock-audio/${reciterId}-${key.replace(":", "-")}.wav` }],
      }),
    });
  });
  await page.route("**/mock-audio/*.wav", async (route) => {
    await route.fulfill({ status: 200, contentType: "audio/wav", body: clip });
  });
  return requested;
}

test.describe("Memorization Audio Phase 1", () => {
  test("the memorization page renders Play, Replay and repeat-count controls for the current āyah", async ({
    page,
  }) => {
    await mockRecitationAudio(page);
    await page.goto("/memorize?surah=112&ayah=1");

    await expect(page.getByRole("button", { name: "Play recitation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Replay from start" })).toBeVisible();
    for (const label of ["1×", "3×", "5×", "10×"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    // Default is 1x, not the old self-tally default of 3x.
    await expect(page.getByRole("button", { name: "1×", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("the current āyah's playback uses the persisted preferred reciter", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ preferred_reciter: "husary" })
      .eq("user_id", userId);

    try {
      const requested = await mockRecitationAudio(page);
      await page.goto("/memorize?surah=112&ayah=1");
      await page.getByRole("button", { name: "Play recitation" }).click();
      await expect(page.getByRole("button", { name: "Pause recitation" })).toBeVisible();
      expect(requested).toEqual(["6:112:1"]);
    } finally {
      await client
        .from("learning_preferences")
        .update({ preferred_reciter: "mishary_alafasy" })
        .eq("user_id", userId);
    }
  });

  test("authenticated playback never starts with the default reciter while the preference is still loading", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ preferred_reciter: "husary" })
      .eq("user_id", userId);

    try {
      const requested = await mockRecitationAudio(page);
      await page.route("**/rest/v1/learning_preferences*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.continue();
      });

      await page.goto("/memorize?surah=112&ayah=1");

      await expect(page.getByRole("button", { name: "Loading recitation…" })).toBeVisible();
      expect(requested).toEqual([]);

      await expect(page.getByRole("button", { name: "Play recitation" })).toBeVisible();
      await page.getByRole("button", { name: "Play recitation" }).click();
      await expect(page.getByRole("button", { name: "Pause recitation" })).toBeVisible();
      expect(requested).toEqual(["6:112:1"]);
    } finally {
      await client
        .from("learning_preferences")
        .update({ preferred_reciter: "mishary_alafasy" })
        .eq("user_id", userId);
    }
  });

  test("1x plays the āyah exactly once, then returns to Play/ready", async ({ page }) => {
    const requested = await mockRecitationAudio(page);
    await page.goto("/memorize?surah=112&ayah=1");

    await page.getByRole("button", { name: "Play recitation" }).click();
    await expect(page.getByRole("button", { name: "Pause recitation" })).toBeVisible();

    // 0.3s clip: wait for it to naturally finish the (single) cycle.
    await expect(page.getByRole("button", { name: "Play recitation" })).toBeVisible({
      timeout: 5_000,
    });
    expect(requested).toEqual(["7:112:1"]);
  });

  test("3x produces exactly 3 completed plays of the same āyah", async ({ page }) => {
    const requested = await mockRecitationAudio(page);
    await page.goto("/memorize?surah=112&ayah=1");

    await page.getByRole("button", { name: "3×", exact: true }).click();
    await page.getByRole("button", { name: "Play recitation" }).click();

    await expect(page.getByText("Playing 1 of 3")).toBeVisible();
    // Waits for the cycle to run its course (3 natural "ended" events,
    // each restarting until the target is reached) purely by observing
    // state, not a fixed sleep.
    await expect(page.getByRole("button", { name: "Play recitation" })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByText(/Playing \d of 3/)).toBeHidden();
    expect(requested).toEqual(["7:112:1", "7:112:1", "7:112:1"]);
  });

  test("5x produces exactly 5 completed plays of the same āyah", async ({ page }) => {
    const requested = await mockRecitationAudio(page);
    await page.goto("/memorize?surah=112&ayah=1");

    await page.getByRole("button", { name: "5×", exact: true }).click();
    await page.getByRole("button", { name: "Play recitation" }).click();

    await expect(page.getByRole("button", { name: "Play recitation" })).toBeVisible({
      timeout: 12_000,
    });
    expect(requested).toEqual(Array(5).fill("7:112:1"));
  });

  test("pausing mid-cycle stops repetition, and resuming continues the same cycle rather than restarting it", async ({
    page,
  }) => {
    // Long clip: pause is clicked almost immediately after Play, and must
    // land while genuinely still mid-playback, not race a natural "ended".
    const requested = await mockRecitationAudio(page, "ok", LONG_WAV);
    await page.goto("/memorize?surah=112&ayah=1");

    await page.getByRole("button", { name: "3×", exact: true }).click();
    await page.getByRole("button", { name: "Play recitation" }).click();
    await expect(page.getByText("Playing 1 of 3")).toBeVisible();

    await page.getByRole("button", { name: "Pause recitation" }).click();
    await expect(page.getByRole("button", { name: "Play recitation" })).toBeVisible();

    // Still mid the *first* play of the cycle -- pausing neither advanced
    // nor reset it, and issued no further request.
    await expect(page.getByText("Playing 1 of 3")).toBeVisible();
    expect(requested.length).toBe(1);

    await page.getByRole("button", { name: "Play recitation" }).click();
    await expect(page.getByRole("button", { name: "Pause recitation" })).toBeVisible();
    // Resuming reuses the in-flight playback -- no re-fetch.
    expect(requested.length).toBe(1);

    // Left to run, it naturally completes play #1 and auto-restarts into
    // play #2 of the *same* 3x cycle, not a fresh one.
    await expect(page.getByText("Playing 2 of 3")).toBeVisible({ timeout: 8_000 });
    expect(requested.length).toBe(2);
  });

  test("Replay restarts the current repetition cycle cleanly, even mid-cycle", async ({ page }) => {
    // Short clip so the cycle naturally advances to play #2 quickly;
    // medium margin after that so the Replay click reliably lands before
    // play #2 would end on its own.
    await mockRecitationAudio(page, "ok", makeSilentWav(2));
    await page.goto("/memorize?surah=112&ayah=1");

    await page.getByRole("button", { name: "3×", exact: true }).click();
    await page.getByRole("button", { name: "Play recitation" }).click();
    await expect(page.getByText("Playing 2 of 3")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "Replay from start" }).click();

    // Back to "1 of 3", not "3 of 3" -- a genuine reset, not a continuation.
    await expect(page.getByText("Playing 1 of 3")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause recitation" })).toBeVisible();
  });

  test("pressing Next stops the current repeat cycle immediately and starts idle on the new āyah", async ({
    page,
  }) => {
    const requested = await mockRecitationAudio(page, "ok", LONG_WAV);
    await page.goto("/memorize?surah=112&ayah=1");

    await page.getByRole("button", { name: "5×", exact: true }).click();
    await page.getByRole("button", { name: "Play recitation" }).click();
    await expect(page.getByRole("button", { name: "Pause recitation" })).toBeVisible();

    await page.getByRole("button", { name: "Next Ayah" }).click();
    await expect(page.getByText("Ayah 2")).toBeVisible();

    // New āyah starts idle -- no auto-continuation of the old cycle, and
    // no orphaned loop still issuing requests in the background.
    await expect(page.getByRole("button", { name: "Play recitation" })).toBeVisible();
    await expect(page.getByText(/Playing \d/)).toBeHidden();
    const countAfterNext = requested.length;
    await page.waitForTimeout(500);
    expect(requested.length).toBe(countAfterNext);
  });

  test("pressing Previous stops the current repeat cycle immediately and starts idle on the new āyah", async ({
    page,
  }) => {
    const requested = await mockRecitationAudio(page, "ok", LONG_WAV);
    await page.goto("/memorize?surah=112&ayah=2");

    await page.getByRole("button", { name: "5×", exact: true }).click();
    await page.getByRole("button", { name: "Play recitation" }).click();
    await expect(page.getByRole("button", { name: "Pause recitation" })).toBeVisible();

    await page.getByRole("button", { name: "Previous Ayah" }).click();
    await expect(page.getByText("Ayah 1")).toBeVisible();

    await expect(page.getByRole("button", { name: "Play recitation" })).toBeVisible();
    await expect(page.getByText(/Playing \d/)).toBeHidden();
    const countAfterPrevious = requested.length;
    await page.waitForTimeout(500);
    expect(requested.length).toBe(countAfterPrevious);
  });

  test("Previous is disabled on the first āyah of the Surah", async ({ page }) => {
    await mockRecitationAudio(page);
    await page.goto("/memorize?surah=112&ayah=1");
    await expect(page.getByRole("button", { name: "Previous Ayah" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Next Ayah" })).toBeEnabled();
  });

  test("Next is disabled on the last āyah of the Surah", async ({ page }) => {
    await mockRecitationAudio(page);
    await page.goto("/memorize?surah=112&ayah=4");
    await expect(page.getByRole("button", { name: "Next Ayah" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Previous Ayah" })).toBeEnabled();
  });

  test("a provider failure mid-cycle stops the cycle cleanly with no retry loop, and never touches memorization status", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("memorization_progress").delete().eq("user_id", userId);

    const requested = await mockRecitationAudio(page, "fail");
    await page.goto("/memorize?surah=112&ayah=1");

    await page.getByRole("button", { name: "3×", exact: true }).click();
    await page.getByRole("button", { name: "Play recitation" }).click();
    await expect(
      page.getByRole("button", { name: "Couldn't play the recitation. Try again." }),
    ).toBeVisible();

    expect(requested.length).toBe(1);
    await page.waitForTimeout(500);
    expect(requested.length).toBe(1);
    await expect(page.getByText(/Playing \d/)).toBeHidden();

    const { data } = await client
      .from("memorization_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("surah_number", 112)
      .eq("ayah_number", 1)
      .maybeSingle();
    expect(data).toBeNull();
  });

  test("an āyah with no recitation audio shows the distinct unavailable state, disabled, with no retry loop", async ({
    page,
  }) => {
    const requested = await mockRecitationAudio(page, "empty");
    await page.goto("/memorize?surah=112&ayah=1");

    await page.getByRole("button", { name: "Play recitation" }).click();
    const unavailable = page.getByRole("button", {
      name: "Recitation audio isn't available for this Ayah.",
    });
    await expect(unavailable).toBeVisible();
    await expect(unavailable).toBeDisabled();
    expect(requested.length).toBe(1);
  });

  test("switching āyah mid-cycle never leaves two Pause controls or a stale request stream from the old āyah", async ({
    page,
  }) => {
    const requested = await mockRecitationAudio(page, "ok", LONG_WAV);
    await page.goto("/memorize?surah=112&ayah=1");

    await page.getByRole("button", { name: "5×", exact: true }).click();
    await page.getByRole("button", { name: "Play recitation" }).click();
    await expect(page.getByRole("button", { name: "Pause recitation" })).toBeVisible();

    await page.getByRole("button", { name: "Next Ayah" }).click();
    await expect(page.getByText("Ayah 2")).toBeVisible();
    await page.getByRole("button", { name: "Play recitation" }).click();

    await expect(page.getByRole("button", { name: "Pause recitation" })).toHaveCount(1);
    // The newest request is for āyah 2, not a continuation of āyah 1.
    expect(requested.at(-1)).toBe("7:112:2");
  });

  test("the reciter setting still renders correctly in French", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      await mockRecitationAudio(page);
      await page.goto("/memorize?surah=112&ayah=1");
      await expect(page.getByRole("button", { name: "Lire la récitation" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Rejouer depuis le début" })).toBeVisible();
      await page.getByRole("button", { name: "3×", exact: true }).click();
      await page.getByRole("button", { name: "Lire la récitation" }).click();
      await expect(page.getByText("Lecture 1 sur 3")).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("the memorization audio controls remain usable at 390x844 with no overflow", async ({
    page,
  }) => {
    await mockRecitationAudio(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/memorize?surah=112&ayah=1");

    await expect(page.getByRole("button", { name: "Play recitation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Replay from start" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next Ayah" })).toBeVisible();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });
});

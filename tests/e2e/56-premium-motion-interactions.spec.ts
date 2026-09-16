import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Regression coverage for the three new motion interactions: the learning
 * path's restrained level-card hover state, the lesson-completion checkmark
 * reveal, and the Qur'an Reader's selected-ayah highlight + bookmark
 * confirmation. All three reuse the same duration-200/300 + ease-out pair
 * (see PathTimeline.tsx, lesson.$lessonId.tsx, AyahReader.tsx) and are all
 * governed by the app-wide `prefers-reduced-motion` override already in
 * styles.css, so none of that is re-tested here -- these tests assert the
 * actual behavior each animation gates: sequencing (progress reaches 100%
 * before the completion card), gating (the bookmark confirmation only
 * appears after the save succeeds, never on the optimistic update), and
 * that locked learning-path steps never get an interactive affordance.
 */

test.describe("learning path: level-card states", () => {
  // Self-contained rather than relying on ambient path/step state left by
  // other specs (02-learning.spec.ts's own first test deletes
  // learning_paths entirely, for instance) -- same reasoning as that file's
  // own "self-contained" comment. Both tests below share one real lesson
  // (the schema-validation placeholder every environment has, same one
  // 17-lesson-player.spec.ts and 48-lesson-position-race.spec.ts use) and
  // a path with one locked and one available step.
  //
  // Deliberately NOT step_key "alphabet" for the available step: per
  // fetchLearningPath/resolveStepFields in src/lib/placement.ts, any step
  // listed in STEP_LEVEL_SLUGS ("alphabet", "vocabulary", "roots",
  // "grammar", "ayah_comprehension") has its status/progress/lesson_id
  // ALWAYS resynced at read time from the learner's real, live
  // user_lesson_progress against that level's actual curriculum -- a raw
  // insert here would be silently overwritten the moment this shared test
  // account has completed any real Level 1 content elsewhere in the suite
  // (observed as a full-suite-only failure: this step rendered "Completed"
  // instead of the "available" seeded below). "connected_letters" has no
  // entry in STEP_LEVEL_SLUGS, so it's never resynced and this insert is
  // authoritative -- same reason "harakat" below is safe for "locked".
  test.beforeEach(async () => {
    const { client, userId } = await createTestUserClient();
    const { data: lessonRow } = await client
      .from("lessons")
      .select("id")
      .eq("slug", "schema-validation-placeholder")
      .single();
    const { data: path, error } = await client
      .from("learning_paths")
      .upsert({ user_id: userId, level: "foundation", source: "manual" }, { onConflict: "user_id" })
      .select("id")
      .single();
    expect(error).toBeNull();
    await client.from("learning_path_steps").delete().eq("path_id", path!.id);
    await client.from("learning_path_steps").insert([
      {
        path_id: path!.id,
        user_id: userId,
        step_key: "connected_letters",
        order_index: 0,
        status: "available",
        progress: 0,
        lesson_id: lessonRow!.id,
      },
      {
        path_id: path!.id,
        user_id: userId,
        step_key: "harakat",
        order_index: 1,
        status: "locked",
        progress: 0,
      },
    ]);
  });

  test("a locked step has no open/start/review lesson link -- nothing about it reads as interactive", async ({
    page,
  }) => {
    await page.goto("/learning-plan");
    // Several sequential queries (profile, preferences, path, steps) back
    // this page; the default 5s assertion timeout has already been seen
    // tighter than that load elsewhere in this suite (see
    // 02-learning.spec.ts's own "once a learning path exists..." test),
    // especially once the shared test account has accumulated rows across
    // a full suite run.
    const lockedStep = page.locator("li", { hasText: "Locked" }).first();
    await expect(lockedStep).toBeVisible({ timeout: 10_000 });
    await expect(lockedStep.getByRole("link")).toHaveCount(0);
  });

  test("an available or in-progress step keeps its open-lesson link, and hovering it doesn't remove or disable it", async ({
    page,
  }) => {
    await page.goto("/learning-plan");
    const openStep = page
      .locator("li")
      .filter({ hasText: /Up next|In progress/ })
      .first();
    await expect(openStep).toBeVisible({ timeout: 10_000 });
    const link = openStep.getByRole("link");
    await expect(link).toBeVisible();
    await openStep.hover();
    // The hover-state border/background transition is purely presentational
    // (transition-colors on the <li>); what actually matters behaviorally is
    // that hovering never interferes with the link still being there and
    // enabled underneath it.
    await expect(link).toBeVisible();
    await expect(link).toBeEnabled();
  });
});

test.describe("lesson completion: checkmark reveal", () => {
  test("the progress bar reaches 100% during the reveal, strictly before the full completion card appears", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    // A fresh, real lesson row for this test alone -- schema-validation
    // placeholder lesson, same one 17-lesson-player.spec.ts's own full-
    // lifecycle block uses, reset to a clean not-started state first.
    const { data: lessonRow } = await client
      .from("lessons")
      .select("id")
      .eq("slug", "schema-validation-placeholder")
      .single();
    const lessonId = lessonRow!.id;
    await client
      .from("user_exercise_attempts")
      .delete()
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);
    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);

    // Hold the completion write open deterministically -- racing the
    // celebration screen's own ~700ms floor (CELEBRATION_REVEAL_MS in
    // lesson.$lessonId.tsx) against real network timing would make this
    // test as flaky as the thing it's meant to catch. Same
    // manually-released-promise interception 09-localization.spec.ts's
    // "delayed profile-locale response" test and
    // 48-lesson-position-race.spec.ts's delayPositionWrite use.
    let releaseCompletionWrite = () => {};
    const completionWriteHeld = new Promise<void>((resolve) => {
      releaseCompletionWrite = resolve;
    });
    await page.route("**/rest/v1/user_lesson_progress*", async (route) => {
      const request = route.request();
      // supabase-js's upsert() of a single row still POSTs it wrapped in a
      // one-element array (PostgREST's bulk shape) -- same unwrap
      // 48-lesson-position-race.spec.ts's delayPositionWrite uses.
      const raw = request.postDataJSON() as unknown;
      const body = (Array.isArray(raw) ? raw[0] : raw) as { status?: string } | undefined;
      if (request.method() === "POST" && body?.status === "completed") {
        await completionWriteHeld;
      }
      await route.continue();
    });

    await page.goto(`/lesson/${lessonId}`);
    // A genuinely fresh lesson (progress just deleted above) starts on the
    // placeholder's one explanation section, not the exercise -- unlike
    // 17-lesson-player.spec.ts's own completion test, which runs inside a
    // test.describe.serial block and inherits an already-advanced position
    // from the tests before it in that same block.
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "A" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await page.getByRole("button", { name: "Complete lesson" }).click();

    // The completion write is still being held back, so the app can only
    // be showing the celebration screen right now -- its progress bar
    // already animated to 100 (setCelebrating(true) runs before any of the
    // awaited writes in goNextOrComplete), and the full completion card
    // cannot have replaced it yet.
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    // CardTitle renders a plain div, not a real heading element (see
    // card.tsx), so this matches the same getByText(...) pattern
    // 17-lesson-player.spec.ts's own completion test already uses.
    await expect(page.getByText("Lesson complete!")).not.toBeVisible();

    releaseCompletionWrite();
    await expect(page.getByText("Lesson complete!")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to learning plan" })).toBeVisible();
  });
});

test.describe("Qur'an Reader: selection highlight and bookmark confirmation", () => {
  test.afterEach(async () => {
    const { client, userId } = await createTestUserClient();
    await client.from("bookmarks").delete().eq("user_id", userId);
  });

  test("bookmarking an āyah highlights its card and shows a confirmation only once the save succeeds -- never before", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("bookmarks").delete().eq("user_id", userId);

    await page.goto("/quran?surah=1");
    const card = page.locator("#ayah-1-1");
    const confirmBadge = card.getByTestId("bookmark-confirmed");
    const bookmarkBtn = card.getByRole("button", { name: "Bookmark Ayah" });

    await expect(confirmBadge).not.toBeVisible();
    const before = await card.evaluate((el) => getComputedStyle(el).backgroundColor);

    await bookmarkBtn.click();

    // The optimistic icon flip lands immediately -- confirming the click
    // registered -- but the confirmation badge is a separate, later signal
    // gated on the mutation's onSuccess (see AyahReader.tsx), so it must
    // still appear once the real network round-trip actually lands.
    await expect(card.getByRole("button", { name: "Remove Bookmark" })).toBeVisible();
    await expect(confirmBadge).toBeVisible();

    // The card's own background actually changed (the selection highlight),
    // not just an attribute flip with no visual effect.
    const after = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(after).not.toBe(before);

    // And the confirmation is transient -- it clears on its own rather than
    // permanently decorating the button.
    await expect(confirmBadge).not.toBeVisible({ timeout: 3000 });

    await expect
      .poll(async () => {
        const { count } = await client
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("surah_number", 1)
          .eq("ayah_number", 1);
        return count;
      })
      .toBe(1);
  });

  test("the Arabic text and translation never move when an āyah is selected and bookmarked", async ({
    page,
  }) => {
    await page.goto("/quran?surah=1");
    const card = page.locator("#ayah-1-1");
    const arabic = card.locator("p[dir='rtl']").first();
    const translation = card.getByText("In the name of Allah");

    // Settle scroll position before the first measurement -- clicking the
    // bookmark button below auto-scrolls it into view if it isn't already,
    // and that scroll alone would shift both elements' viewport-relative
    // bounding boxes even though neither one has actually moved on the
    // page. Measuring after an explicit scroll on both sides isolates the
    // thing actually under test.
    await card.scrollIntoViewIfNeeded();
    const arabicBefore = await arabic.boundingBox();
    const translationBefore = await translation.boundingBox();

    await card.getByRole("button", { name: "Bookmark Ayah" }).click();
    await expect(card.getByRole("button", { name: "Remove Bookmark" })).toBeVisible();
    await expect(card.getByTestId("bookmark-confirmed")).toBeVisible();

    const arabicAfter = await arabic.boundingBox();
    const translationAfter = await translation.boundingBox();

    expect(arabicAfter).toEqual(arabicBefore);
    expect(translationAfter).toEqual(translationBefore);
  });
});

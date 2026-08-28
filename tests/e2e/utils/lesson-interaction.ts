import { type ConsoleMessage, type Page } from "@playwright/test";

/**
 * Shared resilience layer for lesson-player interaction loops
 * (completeLesson/advanceUntilVisible-style helpers), extracted after
 * run #49's final-main CI investigation. Root cause: /lesson/:id (like
 * /auth, already worked around in utils/auth.ts's loginAndExpect) can
 * undergo a transient SSR/client hydration remount under slow network or
 * loading conditions -- "Hydration failed... this tree will be
 * regenerated on the client." When that happens mid-interaction, the
 * React tree is torn down and rebuilt, silently discarding whatever
 * local state (a selected radio, an in-flight click) the test had just
 * set up.
 *
 * The pre-existing per-file loops used a *fixed iteration count* (60)
 * with no memory of remounts, so a storm of these events could exhaust
 * the whole budget without any real progress, regardless of the test's
 * own timeout. These helpers replace that with wall-clock-bounded
 * retries that re-attempt the *whole* interaction (not just the last
 * click) on failure, and that keep a genuine app bug (a wrong grading
 * result, a "Incorrect" outcome) from ever being silently retried away --
 * only "no feedback appeared yet" is treated as transient.
 */

const DEFAULT_MAX_MS = 60_000;

/** Tracks the app's own "Hydration failed" signal on this page, so a
 * loop's eventual failure message can say whether it saw the known
 * transient condition or genuinely never did (the latter points at a
 * real regression, not test timing). */
export function trackHydrationRemounts(page: Page): () => number {
  let count = 0;
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === "error" && msg.text().includes("Hydration failed")) count++;
  };
  const onPageError = (err: Error) => {
    if (err.message.includes("Hydration")) count++;
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  return () => count;
}

function remountDiagnostic(remounts: number): string {
  return remounts > 0
    ? `Observed ${remounts} hydration-remount event(s) during this wait -- consistent with the known transient /lesson/:id characteristic (see utils/auth.ts for the same pattern on /auth) outlasting this budget, not necessarily an application regression.`
    : `No hydration-remount events were observed during this wait -- this does NOT look like the known transient characteristic and likely indicates a genuine application issue.`;
}

/**
 * Selects an answer (via the caller's exercise-type-specific
 * `selectAnswer`) and clicks "Check answer", retrying the *entire*
 * select+check sequence -- not just the click -- if no feedback text
 * appears in time, since a remount mid-interaction discards whatever was
 * selected. An "Incorrect" result is a genuine failure and is thrown
 * immediately, never retried: silently retrying past a real wrong-answer
 * grading result would hide a real learner-facing bug instead of
 * surfacing it.
 */
export async function resilientAnswerAndCheck(
  page: Page,
  selectAnswer: () => Promise<void>,
  options: {
    maxMs?: number;
    checkButtonName?: string;
    correctText?: string;
    incorrectText?: string;
  } = {},
): Promise<void> {
  const maxMs = options.maxMs ?? 20_000;
  const checkButtonName = options.checkButtonName ?? "Check answer";
  const correctText = options.correctText ?? "Correct!";
  const incorrectText = options.incorrectText ?? "Incorrect";
  const getRemounts = trackHydrationRemounts(page);
  const start = Date.now();
  let lastIssue = "no attempt made yet";

  while (Date.now() - start < maxMs) {
    try {
      await selectAnswer();
      await page.getByRole("button", { name: checkButtonName }).click({ timeout: 3_000 });
    } catch (err) {
      // Selecting/clicking failed outright (element not attached/visible) --
      // almost certainly a remount mid-interaction. Loop and retry the
      // whole sequence rather than treating this as fatal.
      lastIssue = `select/check click failed: ${err instanceof Error ? err.message : String(err)}`;
      await page.waitForTimeout(250);
      continue;
    }

    const outcome = await Promise.race([
      page
        .getByText(correctText)
        .waitFor({ state: "visible", timeout: 4_000 })
        .then(() => "correct" as const),
      page
        .getByText(incorrectText)
        .waitFor({ state: "visible", timeout: 4_000 })
        .then(() => "incorrect" as const),
    ]).catch(() => "none" as const);

    if (outcome === "correct") return;
    if (outcome === "incorrect") {
      throw new Error(
        `resilientAnswerAndCheck: the app graded this answer "${incorrectText}" -- a genuine failure, not a hydration-timing issue, and was not retried.`,
      );
    }
    // outcome === "none": neither text appeared -- likely a remount wiped
    // the selection/click before it could register. Retry the full
    // select+check sequence.
    lastIssue = `neither "${correctText}" nor "${incorrectText}" appeared within 4s of clicking`;
  }

  throw new Error(
    `resilientAnswerAndCheck: did not observe "${correctText}" within ${maxMs}ms. Last issue: ${lastIssue}. ${remountDiagnostic(getRemounts())}`,
  );
}

/**
 * Drives a lesson to "Lesson complete!", replacing the old fixed-60-
 * iteration loop with a wall-clock bound. `answerExercise` is the
 * caller's own exercise-type dispatcher (expected to call
 * resilientAnswerAndCheck internally) -- same `(page, exercise)`
 * signature every existing per-file `answerExercise` already uses, so
 * call sites outside the loop (which call it directly) need no change.
 */
export async function completeLessonResilient<T>(
  page: Page,
  exercises: T[],
  answerExercise: (page: Page, exercise: T) => Promise<void>,
  options: { maxMs?: number } = {},
): Promise<void> {
  const maxMs = options.maxMs ?? DEFAULT_MAX_MS;
  const getRemounts = trackHydrationRemounts(page);
  const start = Date.now();
  let exerciseIndex = 0;

  while (Date.now() - start < maxMs) {
    if (
      await page
        .getByText("Lesson complete!")
        .isVisible()
        .catch(() => false)
    )
      return;

    const checkAnswerVisible = await page
      .getByRole("button", { name: "Check answer" })
      .isVisible()
      .catch(() => false);
    if (checkAnswerVisible) {
      if (exerciseIndex >= exercises.length) {
        throw new Error(
          `completeLessonResilient: a "Check answer" step appeared but exerciseIndex (${exerciseIndex}) already exhausted the expected ${exercises.length} exercises -- likely a genuine app/content mismatch, not a timing issue.`,
        );
      }
      await answerExercise(page, exercises[exerciseIndex]!);
      exerciseIndex++;
      continue;
    }

    await page
      .getByRole("button", { name: /^(Next|Complete lesson)$/ })
      .click({ timeout: 2_000 })
      .catch(() => {});
    // Whether or not the click landed, pace the next check rather than
    // re-checking (and potentially re-clicking) immediately: a successful
    // click's effect -- an API round trip and a state transition -- takes
    // real wall-clock time to land, especially under a slow network, and
    // re-clicking "Next"/"Complete lesson" while that's still in flight
    // would fire the same action multiple times instead of waiting for
    // the one legitimate click to resolve. When the click failed outright,
    // this same pause also gives a transient remount time to settle
    // before the next attempt.
    await page.waitForTimeout(300);
  }

  throw new Error(
    `completeLessonResilient: did not reach "Lesson complete!" within ${maxMs}ms (stuck at exerciseIndex=${exerciseIndex}). ${remountDiagnostic(getRemounts())}`,
  );
}

/**
 * Advances through a lesson (answering exercises as encountered) until
 * `targetText` becomes visible, replacing the old fixed-60-iteration
 * loop with a wall-clock bound. Same answerExercise contract as
 * completeLessonResilient.
 */
export async function advanceUntilVisibleResilient<T>(
  page: Page,
  exercises: T[],
  targetText: string | RegExp,
  answerExercise: (page: Page, exercise: T) => Promise<void>,
  options: { maxMs?: number } = {},
): Promise<void> {
  const maxMs = options.maxMs ?? DEFAULT_MAX_MS;
  const getRemounts = trackHydrationRemounts(page);
  const start = Date.now();
  let exerciseIndex = 0;

  while (Date.now() - start < maxMs) {
    const appeared = await page
      .getByText(targetText, typeof targetText === "string" ? { exact: true } : undefined)
      .first()
      .waitFor({ state: "visible", timeout: 800 })
      .then(() => true)
      .catch(() => false);
    if (appeared) return;

    const checkAnswerVisible = await page
      .getByRole("button", { name: "Check answer" })
      .isVisible()
      .catch(() => false);
    if (checkAnswerVisible) {
      if (exerciseIndex >= exercises.length) {
        throw new Error(
          `advanceUntilVisibleResilient: a "Check answer" step appeared but exerciseIndex (${exerciseIndex}) already exhausted the expected ${exercises.length} exercises -- likely a genuine app/content mismatch, not a timing issue.`,
        );
      }
      await answerExercise(page, exercises[exerciseIndex]!);
      exerciseIndex++;
      continue;
    }

    await page
      .getByRole("button", { name: /^(Next|Complete lesson)$/ })
      .click({ timeout: 2_000 })
      .catch(() => {});
    // Same reasoning as completeLessonResilient: pace this regardless of
    // whether the click landed, so a click's in-flight effect isn't
    // re-triggered by an immediate re-check/re-click.
    await page.waitForTimeout(300);
  }

  throw new Error(
    `advanceUntilVisibleResilient: "${String(targetText)}" did not appear within ${maxMs}ms (stuck at exerciseIndex=${exerciseIndex}). ${remountDiagnostic(getRemounts())}`,
  );
}

/**
 * Waits for a role="heading" with the given accessible name, tolerating
 * the same transient hydration remount, rather than relying solely on
 * Playwright's default 5s assertion timeout (which the remount storm can
 * outlast even though the heading would have appeared given more time).
 * On genuine failure, includes a body-text snapshot for diagnosis.
 */
export async function waitForHeadingResilient(
  page: Page,
  name: string,
  options: { maxMs?: number } = {},
): Promise<void> {
  const maxMs = options.maxMs ?? 30_000;
  const getRemounts = trackHydrationRemounts(page);
  const start = Date.now();

  while (Date.now() - start < maxMs) {
    if (
      await page
        .getByRole("heading", { name })
        .isVisible()
        .catch(() => false)
    )
      return;
    await page.waitForTimeout(300);
  }

  const bodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "<unavailable>");
  throw new Error(
    `waitForHeadingResilient: heading "${name}" did not become visible within ${maxMs}ms. ${remountDiagnostic(getRemounts())} Body snapshot:\n${bodyText.slice(0, 300)}`,
  );
}

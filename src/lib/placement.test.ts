import { describe, expect, test } from "vitest";

import {
  buildPathSteps,
  LEVEL_START_STEP,
  PATH_STEPS,
  PLACEMENT_LEVELS,
  resolveStepFields,
} from "./placement";
import type { CurriculumEntryPoint } from "./curriculum";

function entryPoint(overrides: Partial<CurriculumEntryPoint> = {}): CurriculumEntryPoint {
  return {
    lessonId: "lesson-1",
    slug: "lesson-1-slug",
    title: "Lesson 1",
    moduleSlug: "module-1",
    completedCount: 0,
    totalCount: 5,
    ...overrides,
  };
}

describe("resolveStepFields — the one place a live findCurriculumEntryPoint result becomes a path step's status/progress/lesson_id", () => {
  test("no progress yet -> available, 0%", () => {
    expect(resolveStepFields(entryPoint({ completedCount: 0, totalCount: 5 }))).toEqual({
      status: "available",
      progress: 0,
      lesson_id: "lesson-1",
    });
  });

  test("partial progress -> in_progress, rounded percent", () => {
    expect(resolveStepFields(entryPoint({ completedCount: 1, totalCount: 3 }))).toEqual({
      status: "in_progress",
      progress: 33, // round(1/3 * 100)
      lesson_id: "lesson-1",
    });
  });

  test("completedCount === totalCount -> completed, 100%, regardless of totalCount", () => {
    expect(resolveStepFields(entryPoint({ completedCount: 8, totalCount: 8 }))).toEqual({
      status: "completed",
      progress: 100,
      lesson_id: "lesson-1",
    });
  });

  test("totalCount === 0 never divides by zero", () => {
    expect(resolveStepFields(entryPoint({ completedCount: 0, totalCount: 0 }))).toEqual({
      status: "completed", // 0 === 0
      progress: 0,
      lesson_id: "lesson-1",
    });
  });

  test("always carries the entry point's real lessonId -- never a guessed/synthetic link", () => {
    expect(resolveStepFields(entryPoint({ lessonId: "a-specific-real-lesson-id" })).lesson_id).toBe(
      "a-specific-real-lesson-id",
    );
  });
});

describe("buildPathSteps", () => {
  test("every placement level produces exactly PATH_STEPS.length steps, in order", () => {
    for (const level of PLACEMENT_LEVELS) {
      const steps = buildPathSteps(level);
      expect(steps).toHaveLength(PATH_STEPS.length);
      expect(steps.map((s) => s.step_key)).toEqual([...PATH_STEPS]);
    }
  });

  test("complete_beginner starts at the very first step, nothing pre-completed", () => {
    const steps = buildPathSteps("complete_beginner");
    expect(steps[0]).toMatchObject({ step_key: "alphabet", status: "in_progress", progress: 0 });
    expect(steps.filter((s) => s.status === "completed")).toHaveLength(0);
  });

  test("a later starting level marks every earlier step completed, never skipped or locked", () => {
    const steps = buildPathSteps("developing_reader"); // starts at "vocabulary"
    const startIndex = PATH_STEPS.indexOf(LEVEL_START_STEP.developing_reader);
    for (let i = 0; i < startIndex; i++) {
      expect(steps[i]).toMatchObject({ status: "completed", progress: 100 });
    }
    expect(steps[startIndex]).toMatchObject({ status: "in_progress" });
  });

  test("exactly one step is in_progress and at most one is available, for every level", () => {
    for (const level of PLACEMENT_LEVELS) {
      const steps = buildPathSteps(level);
      expect(steps.filter((s) => s.status === "in_progress")).toHaveLength(1);
      expect(steps.filter((s) => s.status === "available").length).toBeLessThanOrEqual(1);
    }
  });
});

describe("PATH_STEPS / LEVEL_START_STEP shape sanity (vocabulary, roots, grammar mappings)", () => {
  test("every LEVEL_START_STEP value is a real entry in PATH_STEPS", () => {
    for (const level of PLACEMENT_LEVELS) {
      expect(PATH_STEPS).toContain(LEVEL_START_STEP[level]);
    }
  });

  test("PATH_STEPS includes the vocabulary/roots/grammar steps this sprint's curriculum mapping covers", () => {
    expect(PATH_STEPS).toEqual(
      expect.arrayContaining(["vocabulary", "roots", "grammar", "ayah_comprehension"]),
    );
  });

  test("PATH_STEPS has no duplicate step keys", () => {
    expect(new Set(PATH_STEPS).size).toBe(PATH_STEPS.length);
  });
});

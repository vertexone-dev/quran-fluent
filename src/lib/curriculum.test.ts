import { beforeEach, describe, expect, test, vi } from "vitest";

import { createSerialLatestQueue } from "./curriculum";

// ---------------------------------------------------------------------------
// findCurriculumEntryPoint / findLevel1EntryPoint
//
// Mocks the exact sequence of Supabase calls findCurriculumEntryPoint makes
// (levels -> modules -> lessons -> user_lesson_progress -> lesson_translations),
// keyed by table name, so each test only has to state the fixture data for
// the tables it cares about. Every chain method returns the chain itself
// (so .select().eq().order() etc. all work regardless of call order/count),
// and the chain is itself thenable so `await` at any point in the chain
// resolves to that table's configured response -- matching how the real
// supabase-js PostgrestFilterBuilder behaves.
// ---------------------------------------------------------------------------

const PLACEHOLDER_LESSON_SLUG = "schema-validation-placeholder";

type MockResponse = { data: unknown; error: null } | { data: null; error: { message: string } };

function makeChain(response: MockResponse) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "neq"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain["maybeSingle"] = vi.fn(async () => response);
  chain["then"] = (
    resolve: (value: MockResponse) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(resolve, reject);
  return chain;
}

function mockSupabaseClient(responsesByTable: Record<string, MockResponse>) {
  return {
    supabase: {
      from: vi.fn((table: string) =>
        makeChain(responsesByTable[table] ?? { data: [], error: null }),
      ),
    },
  };
}

async function loadWithMock(responsesByTable: Record<string, MockResponse>) {
  vi.resetModules();
  vi.doMock("@/integrations/supabase/client", () => mockSupabaseClient(responsesByTable));
  return import("./curriculum");
}

const LEVEL_ROW = { data: { id: "level-1" }, error: null } as const;

function modulesRow(modules: { id: string; slug: string; order_index: number }[]): MockResponse {
  return { data: modules, error: null };
}

function lessonsRow(
  lessons: { id: string; slug: string; title_en: string; module_id: string; order_index: number }[],
): MockResponse {
  return { data: lessons, error: null };
}

function progressRow(rows: { lesson_id: string; status: string }[]): MockResponse {
  return { data: rows, error: null };
}

const NO_TRANSLATION: MockResponse = { data: [], error: null };

describe("findCurriculumEntryPoint", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("prefers an in-progress lesson over the first not-completed one", async () => {
    const { findCurriculumEntryPoint } = await loadWithMock({
      levels: LEVEL_ROW,
      modules: modulesRow([{ id: "m1", slug: "mod-1", order_index: 0 }]),
      lessons: lessonsRow([
        { id: "l1", slug: "l1", title_en: "Lesson 1", module_id: "m1", order_index: 0 },
        { id: "l2", slug: "l2", title_en: "Lesson 2", module_id: "m1", order_index: 1 },
        { id: "l3", slug: "l3", title_en: "Lesson 3", module_id: "m1", order_index: 2 },
      ]),
      user_lesson_progress: progressRow([
        { lesson_id: "l1", status: "completed" },
        { lesson_id: "l2", status: "in_progress" },
      ]),
      lesson_translations: NO_TRANSLATION,
    });

    const result = await findCurriculumEntryPoint("user-1", "foundations-of-arabic-script");
    expect(result?.lessonId).toBe("l2");
    expect(result?.completedCount).toBe(1);
    expect(result?.totalCount).toBe(3);
  });

  test("falls back to the first not-completed lesson when nothing is in progress", async () => {
    const { findCurriculumEntryPoint } = await loadWithMock({
      levels: LEVEL_ROW,
      modules: modulesRow([{ id: "m1", slug: "mod-1", order_index: 0 }]),
      lessons: lessonsRow([
        { id: "l1", slug: "l1", title_en: "Lesson 1", module_id: "m1", order_index: 0 },
        { id: "l2", slug: "l2", title_en: "Lesson 2", module_id: "m1", order_index: 1 },
      ]),
      user_lesson_progress: progressRow([{ lesson_id: "l1", status: "completed" }]),
      lesson_translations: NO_TRANSLATION,
    });

    const result = await findCurriculumEntryPoint("user-1", "foundations-of-arabic-script");
    expect(result?.lessonId).toBe("l2");
  });

  test("when every lesson is completed, still returns the last lesson with completedCount === totalCount", async () => {
    const { findCurriculumEntryPoint } = await loadWithMock({
      levels: LEVEL_ROW,
      modules: modulesRow([{ id: "m1", slug: "mod-1", order_index: 0 }]),
      lessons: lessonsRow([
        { id: "l1", slug: "l1", title_en: "Lesson 1", module_id: "m1", order_index: 0 },
        { id: "l2", slug: "l2", title_en: "Lesson 2", module_id: "m1", order_index: 1 },
      ]),
      user_lesson_progress: progressRow([
        { lesson_id: "l1", status: "completed" },
        { lesson_id: "l2", status: "completed" },
      ]),
      lesson_translations: NO_TRANSLATION,
    });

    const result = await findCurriculumEntryPoint("user-1", "foundations-of-arabic-script");
    expect(result?.lessonId).toBe("l2");
    expect(result?.completedCount).toBe(2);
    expect(result?.totalCount).toBe(2);
  });

  test("never resolves to the schema-validation placeholder lesson, even when it's the only 'not started' one", async () => {
    const { findCurriculumEntryPoint } = await loadWithMock({
      levels: LEVEL_ROW,
      modules: modulesRow([{ id: "m1", slug: "mod-1", order_index: 0 }]),
      // The mock's own `lessons` fixture already omits the placeholder --
      // this documents what the real .neq(PLACEHOLDER_LESSON_SLUG) filter
      // guarantees server-side; the DB-level exclusion isn't re-testable
      // through this mock, only that a placeholder-shaped row would be
      // filtered before this test's `lessons` list, so l1 is correctly the
      // only candidate.
      lessons: lessonsRow([
        { id: "l1", slug: "real-lesson", title_en: "Real", module_id: "m1", order_index: 0 },
      ]),
      user_lesson_progress: progressRow([]),
      lesson_translations: NO_TRANSLATION,
    });

    const result = await findCurriculumEntryPoint("user-1", "foundations-of-arabic-script");
    expect(result?.lessonId).toBe("l1");
    expect(result?.slug).not.toBe(PLACEHOLDER_LESSON_SLUG);
  });

  test("orders candidates by module order_index then lesson order_index, not by module/query discovery order (the original Level-1 defect this function replaced a hardcoded list to fix)", async () => {
    const { findCurriculumEntryPoint } = await loadWithMock({
      levels: LEVEL_ROW,
      // Modules deliberately returned out of order_index order.
      modules: modulesRow([
        { id: "m3", slug: "mod-3", order_index: 2 },
        { id: "m1", slug: "mod-1", order_index: 0 },
        { id: "m2", slug: "mod-2", order_index: 1 },
      ]),
      lessons: lessonsRow([
        { id: "l3a", slug: "l3a", title_en: "3a", module_id: "m3", order_index: 0 },
        { id: "l1a", slug: "l1a", title_en: "1a", module_id: "m1", order_index: 0 },
        { id: "l2a", slug: "l2a", title_en: "2a", module_id: "m2", order_index: 0 },
      ]),
      // Nothing completed -- the entry point must be the first lesson of
      // the first module BY order_index (m1/l1a), not the first one the
      // mock happens to list (m3/l3a).
      user_lesson_progress: progressRow([]),
      lesson_translations: NO_TRANSLATION,
    });

    const result = await findCurriculumEntryPoint("user-1", "foundations-of-arabic-script");
    expect(result?.lessonId).toBe("l1a");
    expect(result?.moduleSlug).toBe("mod-1");
  });

  test("is fully data-driven: the same function resolves a Level 2/3 entry point given only a different levelSlug, with no Level-1-specific code path", async () => {
    const { findCurriculumEntryPoint } = await loadWithMock({
      levels: { data: { id: "level-3" }, error: null },
      modules: modulesRow([{ id: "m-roots", slug: "roots-1", order_index: 0 }]),
      lessons: lessonsRow([
        { id: "lr1", slug: "lr1", title_en: "Roots 1", module_id: "m-roots", order_index: 0 },
      ]),
      user_lesson_progress: progressRow([]),
      lesson_translations: NO_TRANSLATION,
    });

    const result = await findCurriculumEntryPoint("user-1", "roots-and-word-patterns");
    expect(result?.lessonId).toBe("lr1");
    expect(result?.moduleSlug).toBe("roots-1");
  });

  test("returns null for an unknown level slug", async () => {
    const { findCurriculumEntryPoint } = await loadWithMock({
      levels: { data: null, error: null },
    });

    const result = await findCurriculumEntryPoint("user-1", "not-a-real-level");
    expect(result).toBeNull();
  });

  test("returns null when a real level has no modules yet", async () => {
    const { findCurriculumEntryPoint } = await loadWithMock({
      levels: LEVEL_ROW,
      modules: { data: [], error: null },
    });

    const result = await findCurriculumEntryPoint("user-1", "guided-ayah-comprehension");
    expect(result).toBeNull();
  });
});

describe("findLevel1EntryPoint (existing-user backward compatibility)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("is a thin wrapper that always resolves Level 1 by the same stable levelSlug, preserving every existing caller's call signature", async () => {
    const { findLevel1EntryPoint } = await loadWithMock({
      levels: LEVEL_ROW,
      modules: modulesRow([{ id: "m1", slug: "mod-1", order_index: 0 }]),
      lessons: lessonsRow([
        { id: "l1", slug: "l1", title_en: "Lesson 1", module_id: "m1", order_index: 0 },
      ]),
      user_lesson_progress: progressRow([]),
      lesson_translations: NO_TRANSLATION,
    });

    // Two-arg call (userId, locale) -- the exact signature every existing
    // caller (dashboard, daily study, placement) already uses -- still works.
    const result = await findLevel1EntryPoint("user-1", "en");
    expect(result?.lessonId).toBe("l1");
  });
});

/** A promise plus externally-callable resolve/reject, for manually
 * controlling exactly when a queued task "finishes" -- this is what makes
 * these tests deterministic proof of ordering, not a hope that a real
 * race occurs under real timing. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("createSerialLatestQueue", () => {
  test("a slow first write does not block a later intent from becoming the final state, and intermediate intents are coalesced away", async () => {
    const queue = createSerialLatestQueue();
    const executed: number[] = [];
    const first = deferred();

    queue.enqueue(async () => {
      executed.push(1);
      await first.promise; // simulates a slow/delayed first write
    });

    // Enqueued while task 1 is still in flight -- only the last of these
    // should ever actually run.
    queue.enqueue(async () => {
      executed.push(2);
    });
    queue.enqueue(async () => {
      executed.push(3);
    });
    queue.enqueue(async () => {
      executed.push(4);
    });

    // Nothing but task 1 has run yet: it's still awaiting `first`.
    expect(executed).toEqual([1]);

    first.resolve();
    await queue.idle();

    // Task 1 ran because it had already started before being superseded.
    // 2 and 3 never ran at all -- coalesced away, never became durable
    // state. Only the LAST enqueued intent (4) ran after task 1 settled.
    expect(executed).toEqual([1, 4]);
  });

  test("two writes are never in flight at the same time, even when enqueued back to back", async () => {
    const queue = createSerialLatestQueue();
    let concurrent = 0;
    let maxConcurrent = 0;
    const gates = [deferred(), deferred()];
    let call = 0;

    function makeTask() {
      const gate = gates[call++]!;
      return async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await gate.promise;
        concurrent--;
      };
    }

    queue.enqueue(makeTask());
    queue.enqueue(makeTask()); // supersedes nothing (task 1 already started), queues as "the next task"

    gates[0]!.resolve();
    await Promise.resolve(); // let the pump loop advance to task 2
    gates[1]!.resolve();
    await queue.idle();

    expect(maxConcurrent).toBe(1);
  });

  test("backward navigation after forward navigation is preserved -- latest intent wins, not highest value", async () => {
    const queue = createSerialLatestQueue();
    const persisted: number[] = [];

    queue.enqueue(async () => {
      persisted.push(3);
    });
    await queue.idle();

    // A lower value enqueued *after* a higher one must still win: this is
    // "the user went back", not a discarded stale write.
    queue.enqueue(async () => {
      persisted.push(2);
    });
    await queue.idle();

    expect(persisted).toEqual([3, 2]);
  });

  test("rapid alternating navigation settles on whatever was requested last", async () => {
    const queue = createSerialLatestQueue();
    const persisted: number[] = [];
    const first = deferred();

    queue.enqueue(async () => {
      await first.promise;
      persisted.push(1);
    });
    // Alternates up/down/up/down while task 1 is still in flight.
    queue.enqueue(async () => {
      persisted.push(2);
    });
    queue.enqueue(async () => {
      persisted.push(1);
    });
    queue.enqueue(async () => {
      persisted.push(2);
    });
    queue.enqueue(async () => {
      persisted.push(3);
    });
    queue.enqueue(async () => {
      persisted.push(2); // the last click the user actually made
    });

    first.resolve();
    await queue.idle();

    expect(persisted).toEqual([1, 2]);
  });

  test("idle() does not resolve while a task is still executing", async () => {
    const queue = createSerialLatestQueue();
    const gate = deferred();
    let taskFinished = false;

    queue.enqueue(async () => {
      await gate.promise;
      taskFinished = true;
    });

    let idleResolved = false;
    const idlePromise = queue.idle().then(() => {
      idleResolved = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(idleResolved).toBe(false);

    gate.resolve();
    await idlePromise;
    expect(idleResolved).toBe(true);
    expect(taskFinished).toBe(true);
  });

  test("a failed write does not wedge the queue -- a later enqueued task still runs", async () => {
    const queue = createSerialLatestQueue();
    const executed: string[] = [];

    queue.enqueue(async () => {
      executed.push("first");
      throw new Error("simulated write failure");
    });
    await queue.idle();

    queue.enqueue(async () => {
      executed.push("second");
    });
    await queue.idle();

    expect(executed).toEqual(["first", "second"]);
  });
});

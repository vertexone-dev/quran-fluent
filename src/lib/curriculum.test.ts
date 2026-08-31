import { describe, expect, test } from "vitest";

import { createSerialLatestQueue } from "./curriculum";

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
    queue.enqueue(async () => persisted.push(2));
    queue.enqueue(async () => persisted.push(1));
    queue.enqueue(async () => persisted.push(2));
    queue.enqueue(async () => persisted.push(3));
    queue.enqueue(async () => persisted.push(2)); // the last click the user actually made

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

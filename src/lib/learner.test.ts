import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

import { LEARNER_SNAPSHOT_STALE_TIME_MS, resolveGreetingName } from "./learner";

describe("resolveGreetingName", () => {
  test("uses a real name when one is set", () => {
    expect(resolveGreetingName("Amina", "friend")).toBe("Amina");
  });

  test("falls back when the stored name is an email address", () => {
    expect(resolveGreetingName("learner@example.com", "friend")).toBe("friend");
  });

  test("falls back when there is no name at all", () => {
    expect(resolveGreetingName(null, "friend")).toBe("friend");
    expect(resolveGreetingName(undefined, "friend")).toBe("friend");
    expect(resolveGreetingName("", "friend")).toBe("friend");
  });

  test("a name that merely contains '@' (not just bare emails) still falls back", () => {
    // Deliberately conservative: anything with '@' is treated as
    // email-shaped rather than trying to parse it more precisely.
    expect(resolveGreetingName("weird@name", "friend")).toBe("friend");
  });
});

/**
 * Root-caused for CI #163: AyahReader and AyahPlayButton both query
 * ["learner", user.id] (see the constant's own doc comment). With the
 * default staleTime of 0, AyahPlayButton's later mount (it only exists
 * once the ayah list renders) saw AyahReader's already-settled fetch as
 * immediately stale and re-fetched it -- not wrong data, just a redundant
 * round-trip that made 46-audio-preferred-reciter.spec.ts's "still
 * loading" assertion race on which of the two identically-keyed queries
 * happened to resolve first. These tests exercise the exact react-query
 * contract the fix depends on, directly against a real QueryClient --
 * no DOM/React rendering needed, so no sleep-based timing is involved.
 */
describe("LEARNER_SNAPSHOT_STALE_TIME_MS cache behavior", () => {
  function learnerQueryOptions(userId: string, queryFn: () => Promise<unknown>) {
    return {
      queryKey: ["learner", userId] as const,
      queryFn,
      staleTime: LEARNER_SNAPSHOT_STALE_TIME_MS,
    };
  }

  test("a second observer for the same user within the stale window reuses the cached fetch instead of re-fetching", async () => {
    const queryClient = new QueryClient();
    const queryFn = vi.fn().mockResolvedValue({ preferred_reciter: "husary" });
    const options = learnerQueryOptions("user-1", queryFn);

    // Simulates AyahReader's own query resolving first.
    const first = await queryClient.fetchQuery(options);
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Simulates AyahPlayButton mounting moments later with the identical
    // key/staleTime -- this must be served from cache, not a second
    // network round-trip.
    const second = await queryClient.fetchQuery(options);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);

    queryClient.clear();
  });

  test("an explicit invalidation (Settings' own save flow) still forces a fresh fetch within the stale window", async () => {
    const queryClient = new QueryClient();
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ preferred_reciter: "mishary_alafasy" })
      .mockResolvedValueOnce({ preferred_reciter: "husary" });
    const options = learnerQueryOptions("user-1", queryFn);

    const beforeSave = await queryClient.fetchQuery(options);
    expect(beforeSave).toEqual({ preferred_reciter: "mishary_alafasy" });

    // settings.index.tsx explicitly invalidates this exact key after a
    // successful save -- staleTime must never suppress that.
    await queryClient.invalidateQueries({ queryKey: ["learner", "user-1"] });
    const afterSave = await queryClient.fetchQuery(options);

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(afterSave).toEqual({ preferred_reciter: "husary" });

    queryClient.clear();
  });

  test("invalidating one user's learner snapshot does not refetch an unrelated query", async () => {
    const queryClient = new QueryClient();
    const learnerQueryFn = vi.fn().mockResolvedValue({ preferred_reciter: "husary" });
    const surahsQueryFn = vi.fn().mockResolvedValue([{ number: 1, name_en: "Al-Fatiha" }]);

    await queryClient.fetchQuery(learnerQueryOptions("user-1", learnerQueryFn));
    await queryClient.fetchQuery({ queryKey: ["surahs"] as const, queryFn: surahsQueryFn });

    await queryClient.invalidateQueries({ queryKey: ["learner", "user-1"] });

    // ["surahs"] is unrelated content data, not scoped to any user -- it
    // must not be refetched just because a learner-scoped query was.
    expect(queryClient.getQueryState(["surahs"])?.isInvalidated ?? false).toBe(false);
    expect(surahsQueryFn).toHaveBeenCalledTimes(1);

    queryClient.clear();
  });

  test("daily.tsx's fire-and-forget logStudySession().then(invalidate) still forces a fresh fetch, same as Settings' awaited save", async () => {
    const queryClient = new QueryClient();
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ current_streak: 3 })
      .mockResolvedValueOnce({ current_streak: 4 });
    const options = learnerQueryOptions("user-1", queryFn);

    const beforeStudySession = await queryClient.fetchQuery(options);
    expect(beforeStudySession).toEqual({ current_streak: 3 });

    // daily.tsx never awaits logStudySession() itself (it's fired from a
    // useEffect, not a submit handler), but chains the invalidation onto
    // its promise with .then() rather than skipping it -- this must still
    // land, same as Settings' own `await invalidateQueries(...)`.
    const fakeLogStudySession = Promise.resolve();
    await fakeLogStudySession.then(() =>
      queryClient.invalidateQueries({ queryKey: ["learner", "user-1"] }),
    );

    const afterStudySession = await queryClient.fetchQuery(options);
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(afterStudySession).toEqual({ current_streak: 4 });

    queryClient.clear();
  });

  test("two different users never share a cached snapshot", async () => {
    const queryClient = new QueryClient();
    const queryFnA = vi.fn().mockResolvedValue({ preferred_reciter: "husary" });
    const queryFnB = vi.fn().mockResolvedValue({ preferred_reciter: "mishary_alafasy" });

    await queryClient.fetchQuery(learnerQueryOptions("user-A", queryFnA));
    const resultB = await queryClient.fetchQuery(learnerQueryOptions("user-B", queryFnB));

    expect(queryFnB).toHaveBeenCalledTimes(1);
    expect(resultB).toEqual({ preferred_reciter: "mishary_alafasy" });

    queryClient.clear();
  });
});

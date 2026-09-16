import { describe, expect, test } from "vitest";

import { resolveGreetingName } from "./learner";

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

import { describe, expect, it } from "vitest";
import {
  ACTIVE_KAZIMIRSKI_EDITION,
  ACTIVE_KAZIMIRSKI_TRANSLATOR,
  LEGACY_KAZIMIRSKI_EDITION,
  PHASE8C_MARKER,
  checkLegacyKazimirskiGovernance,
  computeArabicAggregateSha256,
  countOccurrences,
  findActiveKazimirskiRows,
  findLegacyKazimirskiRows,
} from "./content-source-governance.mjs";

// Mirrors the real, certified production content_sources state (Phase 8C.2,
// post-migration) — all 5 rows, trimmed to the fields these functions use.
// Any test below starts from a deep copy of this and mutates one thing.
function certifiedFixture() {
  return [
    {
      id: "5fe9ddf8-bc18-4326-899d-a247856c306b",
      content_type: "arabic_text",
      language: "ar",
      edition_identifier: "uthmani",
      legacy_interim: false,
      verification_status: "candidate",
      translator: null,
      notes: "Canonical production Arabic source.",
    },
    {
      id: "f32639a6-8dc1-4be0-b8fc-bc9ac1c0fb76",
      content_type: "translation",
      language: "en",
      edition_identifier: "pickthall-gutenberg-16955",
      legacy_interim: false,
      verification_status: "verified",
      translator: "Marmaduke Pickthall",
      notes: "Governed English translation source.",
    },
    {
      id: "f8443b10-3cc8-59ee-954f-5b1129c1cec4",
      content_type: "translation",
      language: "fr",
      edition_identifier: ACTIVE_KAZIMIRSKI_EDITION,
      legacy_interim: false,
      verification_status: "candidate",
      translator: ACTIVE_KAZIMIRSKI_TRANSLATOR,
      notes: "Segment-based, production-governed Kazimirski FR source.",
    },
    {
      id: "ed6028cb-a507-4bf4-9f74-4b71602bb4e4",
      content_type: "translation",
      language: "fr",
      edition_identifier: LEGACY_KAZIMIRSKI_EDITION,
      legacy_interim: true,
      verification_status: "deprecated",
      translator: "Albin de Kazimirski (Biberstein)",
      notes:
        "Interim/legacy FR translation for Phase 2A only." +
        `${PHASE8C_MARKER}2026-09-03] Deprecated. Superseded by the active certified source edition_identifier='${ACTIVE_KAZIMIRSKI_EDITION}'.`,
    },
    {
      id: "72059e3a-3b4c-4060-a221-0f91ca219ed6",
      content_type: "translation",
      language: "fr",
      edition_identifier: "fr.hamidullah-crf",
      legacy_interim: true,
      verification_status: "disputed",
      translator: "Muhammad Hamidullah",
      notes: "Formally registers the disputed source.",
    },
  ];
}

function ok(results: ReturnType<typeof checkLegacyKazimirskiGovernance>, name: string) {
  const r = results.find((x) => x.name === name);
  if (!r)
    throw new Error(`no result named "${name}" (have: ${results.map((x) => x.name).join(", ")})`);
  return r.ok;
}

function allOk(results: ReturnType<typeof checkLegacyKazimirskiGovernance>) {
  return results.every((r) => r.ok);
}

describe("checkLegacyKazimirskiGovernance — the certified fixture passes every check", () => {
  it("passes all 7 checks against the real certified production state", () => {
    const results = checkLegacyKazimirskiGovernance(certifiedFixture());
    expect(results).toHaveLength(7);
    expect(allOk(results)).toBe(true);
  });
});

describe("checkLegacyKazimirskiGovernance — legacy source missing or duplicated", () => {
  it("fails 'exactly one legacy row' when the legacy row is missing", () => {
    const rows = certifiedFixture().filter(
      (r) => r.edition_identifier !== LEGACY_KAZIMIRSKI_EDITION,
    );
    const results = checkLegacyKazimirskiGovernance(rows);
    expect(ok(results, "exactly one legacy kazimirski-1869 content_sources row exists")).toBe(
      false,
    );
  });

  it("fails 'exactly one legacy row' when the legacy row is duplicated", () => {
    const rows = certifiedFixture();
    const legacy = rows.find((r) => r.edition_identifier === LEGACY_KAZIMIRSKI_EDITION)!;
    rows.push({ ...legacy, id: "00000000-0000-0000-0000-000000000000" });
    const results = checkLegacyKazimirskiGovernance(rows);
    expect(ok(results, "exactly one legacy kazimirski-1869 content_sources row exists")).toBe(
      false,
    );
  });
});

describe("checkLegacyKazimirskiGovernance — legacy status changed away from deprecated", () => {
  it.each(["candidate", "verified", "disputed"])("fails when status is %s", (status) => {
    const rows = certifiedFixture();
    const legacy = rows.find((r) => r.edition_identifier === LEGACY_KAZIMIRSKI_EDITION)!;
    legacy.verification_status = status;
    const results = checkLegacyKazimirskiGovernance(rows);
    expect(ok(results, "legacy kazimirski-1869 row is verification_status=deprecated")).toBe(false);
  });
});

describe("checkLegacyKazimirskiGovernance — marker missing or duplicated", () => {
  it("fails when the Phase 8C marker is missing from notes", () => {
    const rows = certifiedFixture();
    const legacy = rows.find((r) => r.edition_identifier === LEGACY_KAZIMIRSKI_EDITION)!;
    legacy.notes = "Interim/legacy FR translation for Phase 2A only.";
    const results = checkLegacyKazimirskiGovernance(rows);
    expect(ok(results, "legacy row's Phase 8C successor marker appears exactly once")).toBe(false);
    expect(
      ok(results, "legacy row's notes name the active successor (kazimirski-1869-segments-v1)"),
    ).toBe(false);
  });

  it("fails when the Phase 8C marker is duplicated", () => {
    const rows = certifiedFixture();
    const legacy = rows.find((r) => r.edition_identifier === LEGACY_KAZIMIRSKI_EDITION)!;
    legacy.notes = legacy.notes + legacy.notes.slice(legacy.notes.indexOf(PHASE8C_MARKER));
    const results = checkLegacyKazimirskiGovernance(rows);
    expect(ok(results, "legacy row's Phase 8C successor marker appears exactly once")).toBe(false);
  });
});

describe("checkLegacyKazimirskiGovernance — a legacy_interim source has an impermissible status", () => {
  it("fails when a legacy_interim row is 'candidate' (neither deprecated nor disputed)", () => {
    const rows = certifiedFixture();
    const hamidullah = rows.find((r) => r.edition_identifier === "fr.hamidullah-crf")!;
    hamidullah.verification_status = "candidate";
    const results = checkLegacyKazimirskiGovernance(rows);
    expect(ok(results, "every legacy_interim=true source is deprecated or disputed")).toBe(false);
  });

  it("fails when a legacy_interim row is 'verified'", () => {
    const rows = certifiedFixture();
    const legacy = rows.find((r) => r.edition_identifier === LEGACY_KAZIMIRSKI_EDITION)!;
    legacy.verification_status = "verified";
    const results = checkLegacyKazimirskiGovernance(rows);
    expect(ok(results, "every legacy_interim=true source is deprecated or disputed")).toBe(false);
  });
});

describe("checkLegacyKazimirskiGovernance — active source missing, duplicated, disputed, or mismarked legacy", () => {
  it("fails 'resolves uniquely' when the active source is missing", () => {
    const rows = certifiedFixture().filter(
      (r) => r.edition_identifier !== ACTIVE_KAZIMIRSKI_EDITION,
    );
    const results = checkLegacyKazimirskiGovernance(rows);
    expect(
      ok(results, "active Kazimirski source resolves uniquely (app's exact identity predicate)"),
    ).toBe(false);
    expect(
      ok(
        results,
        "no disputed or legacy_interim source can satisfy the active French-source predicate",
      ),
    ).toBe(false);
  });

  it("fails 'resolves uniquely' when the active source is duplicated", () => {
    const rows = certifiedFixture();
    const active = rows.find((r) => r.edition_identifier === ACTIVE_KAZIMIRSKI_EDITION)!;
    rows.push({ ...active, id: "11111111-1111-1111-1111-111111111111" });
    const results = checkLegacyKazimirskiGovernance(rows);
    expect(
      ok(results, "active Kazimirski source resolves uniquely (app's exact identity predicate)"),
    ).toBe(false);
  });

  it("excludes a disputed row from ever resolving as active (structural, not incidental)", () => {
    const rows = certifiedFixture();
    const active = rows.find((r) => r.edition_identifier === ACTIVE_KAZIMIRSKI_EDITION)!;
    active.verification_status = "disputed";
    const results = checkLegacyKazimirskiGovernance(rows);
    // The predicate itself excludes disputed rows, so "resolves uniquely" now
    // legitimately finds zero — proving disputed can never satisfy it.
    expect(
      ok(results, "active Kazimirski source resolves uniquely (app's exact identity predicate)"),
    ).toBe(false);
    expect(findActiveKazimirskiRows(rows)).toHaveLength(0);
  });

  it("excludes a legacy_interim=true row from ever resolving as active, even with the right identifiers", () => {
    const rows = certifiedFixture();
    const active = rows.find((r) => r.edition_identifier === ACTIVE_KAZIMIRSKI_EDITION)!;
    active.legacy_interim = true; // mismarked
    const results = checkLegacyKazimirskiGovernance(rows);
    // findActiveKazimirskiRows doesn't filter on legacy_interim itself (the
    // app's own resolver doesn't either), so it still "finds" the row — the
    // structural-exclusion check is what must catch a mismarked active row.
    expect(
      ok(
        results,
        "no disputed or legacy_interim source can satisfy the active French-source predicate",
      ),
    ).toBe(false);
  });
});

describe("findLegacyKazimirskiRows / findActiveKazimirskiRows — predicate correctness", () => {
  it("never matches the legacy row against the active predicate (different translator string)", () => {
    const rows = certifiedFixture();
    expect(
      findActiveKazimirskiRows(rows).some(
        (r) => r.edition_identifier === LEGACY_KAZIMIRSKI_EDITION,
      ),
    ).toBe(false);
  });

  it("never matches the disputed hamidullah row against either predicate", () => {
    const rows = certifiedFixture();
    expect(
      findLegacyKazimirskiRows(rows).some((r) => r.edition_identifier === "fr.hamidullah-crf"),
    ).toBe(false);
    expect(
      findActiveKazimirskiRows(rows).some((r) => r.edition_identifier === "fr.hamidullah-crf"),
    ).toBe(false);
  });
});

describe("countOccurrences", () => {
  it("counts non-overlapping occurrences", () => {
    expect(countOccurrences("abcabcabc", "abc")).toBe(3);
    expect(countOccurrences("aaaa", "aa")).toBe(2);
    expect(countOccurrences("", "x")).toBe(0);
    expect(countOccurrences("x", "")).toBe(0);
    expect(countOccurrences(null as unknown as string, "x")).toBe(0);
  });
});

describe("computeArabicAggregateSha256", () => {
  const base = [
    { surah_number: 1, ayah_number: 1, arabic_text: "بِسْمِ اللَّهِ" },
    { surah_number: 1, ayah_number: 2, arabic_text: "الْحَمْدُ لِلَّهِ" },
    { surah_number: 2, ayah_number: 1, arabic_text: "الم" },
  ];

  it("is deterministic for the same rows", () => {
    expect(computeArabicAggregateSha256(base)).toBe(computeArabicAggregateSha256(base));
  });

  it("is independent of input row order (sorts internally by surah_number, ayah_number)", () => {
    const shuffled = [base[2], base[0], base[1]];
    expect(computeArabicAggregateSha256(shuffled)).toBe(computeArabicAggregateSha256(base));
  });

  it("changes if a single Arabic character changes", () => {
    const mutated = base.map((r, i) => (i === 1 ? { ...r, arabic_text: r.arabic_text + "ّ" } : r));
    expect(computeArabicAggregateSha256(mutated)).not.toBe(computeArabicAggregateSha256(base));
  });

  it("changes if a row is missing", () => {
    expect(computeArabicAggregateSha256(base.slice(0, 2))).not.toBe(
      computeArabicAggregateSha256(base),
    );
  });

  it("changes if a row is duplicated", () => {
    expect(computeArabicAggregateSha256([...base, base[0]])).not.toBe(
      computeArabicAggregateSha256(base),
    );
  });

  it("changes if row content is identical but (surah_number, ayah_number) ordering keys differ", () => {
    // Same three texts, but assigned to different (surah,ayah) keys — proves
    // the hash is sensitive to *which* ayah each text is attributed to, not
    // just to the multiset of text values.
    const reassigned = [
      { surah_number: 1, ayah_number: 1, arabic_text: base[2].arabic_text },
      { surah_number: 1, ayah_number: 2, arabic_text: base[0].arabic_text },
      { surah_number: 2, ayah_number: 1, arabic_text: base[1].arabic_text },
    ];
    expect(computeArabicAggregateSha256(reassigned)).not.toBe(computeArabicAggregateSha256(base));
  });

  it("matches a hand-computed sha256 over the exact documented algorithm (order, U+001E separator, raw UTF-8, no normalization)", async () => {
    const { createHash } = await import("node:crypto");
    const RS = String.fromCharCode(0x1e);
    const expected = createHash("sha256")
      .update(base.map((r) => r.arabic_text).join(RS), "utf8")
      .digest("hex");
    expect(computeArabicAggregateSha256(base)).toBe(expected);
  });
});

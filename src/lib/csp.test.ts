import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

import {
  EMPTY_STYLE_HASH,
  SONNER_STYLE_HASH,
  buildCsp,
  generateNonce,
  parseCspMode,
  supabaseOrigin,
} from "./csp";

const SB = "https://abcd1234.supabase.co";
const policy = (o: Partial<Parameters<typeof buildCsp>[0]> = {}) =>
  buildCsp({ nonce: "TESTNONCE==", supabaseUrl: SB, ...o });
const directive = (p: string, name: string) =>
  p
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(" ");

describe("buildCsp", () => {
  test("starts from default-src 'none'", () => {
    expect(directive(policy(), "default-src")).toEqual(["'none'"]);
  });

  test("scripts: self plus this request's nonce only", () => {
    expect(directive(policy(), "script-src")).toEqual(["'self'", "'nonce-TESTNONCE=='"]);
  });

  test("never allows unsafe-eval, wildcard hosts or unsafe-inline for scripts", () => {
    const p = policy();
    expect(p).not.toContain("unsafe-eval");
    expect(p).not.toMatch(/(^|[\s;])\*([\s;]|$)/);
    expect(p).not.toMatch(/https?:\/\/\*/);
    expect(directive(p, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(p, "style-src-elem")).not.toContain("'unsafe-inline'");
  });

  test("the only inline relaxation is style attributes", () => {
    const withInline = policy()
      .split("; ")
      .filter((d) => d.includes("'unsafe-inline'"));
    expect(withInline).toEqual(["style-src-attr 'unsafe-inline'"]);
  });

  test("connect-src: self, the Quran API and the Supabase origin only", () => {
    expect(directive(policy(), "connect-src")).toEqual(["'self'", "https://api.quran.com", SB]);
  });

  test("media-src names exactly the audio hosts the reciters resolve to", () => {
    expect(directive(policy(), "media-src")).toEqual([
      "'self'",
      "https://audio.qurancdn.com",
      "https://mirrors.quranicaudio.com",
    ]);
  });

  test("fonts and stylesheets come only from Google Fonts", () => {
    expect(directive(policy(), "font-src")).toEqual(["'self'", "https://fonts.gstatic.com"]);
    expect(directive(policy(), "style-src-elem")).toContain("https://fonts.googleapis.com");
  });

  test("framing, plugins, base and form targets are locked down", () => {
    const p = policy();
    expect(directive(p, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(p, "frame-src")).toEqual(["'none'"]);
    expect(directive(p, "object-src")).toEqual(["'none'"]);
    expect(directive(p, "base-uri")).toEqual(["'self'"]);
    expect(directive(p, "form-action")).toEqual(["'self'"]);
  });

  test("a missing or malformed Supabase URL adds no origin", () => {
    expect(directive(policy({ supabaseUrl: undefined }), "connect-src")).toEqual([
      "'self'",
      "https://api.quran.com",
    ]);
    expect(directive(policy({ supabaseUrl: "javascript:alert(1)" }), "connect-src")).toEqual([
      "'self'",
      "https://api.quran.com",
    ]);
  });

  test("a build-time Supabase URL that differs is allowed once; duplicates collapse", () => {
    const p = policy({ extraSupabaseUrls: [`${SB}/rest/v1`, "https://other.supabase.co"] });
    expect(directive(p, "connect-src")).toEqual([
      "'self'",
      "https://api.quran.com",
      SB,
      "https://other.supabase.co",
    ]);
  });

  test("upgrade-insecure-requests only when asked; dev adds only the HMR websocket", () => {
    expect(policy()).not.toContain("upgrade-insecure-requests");
    expect(policy({ upgradeInsecure: true })).toContain("upgrade-insecure-requests");
    expect(policy()).not.toContain("ws:");
    expect(directive(policy({ dev: true }), "connect-src")).toContain("ws://localhost:*");
  });
});

describe("nonce and origin helpers", () => {
  test("nonces are base64, 16 bytes, and not repeated", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(a).not.toBe(b);
  });

  test("supabaseOrigin accepts only http(s)", () => {
    expect(supabaseOrigin(`${SB}/auth/v1`)).toBe(SB);
    expect(supabaseOrigin("ftp://x.test")).toBeUndefined();
    expect(supabaseOrigin("not a url")).toBeUndefined();
  });
});

describe("Sonner stylesheet hash", () => {
  test("matches the stylesheet the installed sonner injects (update csp.ts when sonner changes)", () => {
    const require = createRequire(import.meta.url);
    const entry = require.resolve("sonner").replace(/index\.js$/, "index.mjs");
    const source = readFileSync(entry, "utf8");
    const call = source.match(/^__insertCSS\((".*")\);?\s*$/m);
    expect(call, "sonner no longer calls __insertCSS with a string literal").not.toBeNull();
    const css = JSON.parse(call![1]!) as string;
    const hash = `sha256-${createHash("sha256").update(css, "utf8").digest("base64")}`;
    expect(hash).toBe(SONNER_STYLE_HASH);
  });

  test("the empty-style hash really is the hash of the empty string", () => {
    expect(`sha256-${createHash("sha256").update("").digest("base64")}`).toBe(EMPTY_STYLE_HASH);
  });

  test("the style-src-elem hashes are exactly the Sonner stylesheet and the empty string", () => {
    const hashes = (directive(policy(), "style-src-elem") ?? []).filter((v) =>
      v.includes("sha256-"),
    );
    expect(hashes).toEqual([`'${SONNER_STYLE_HASH}'`, `'${EMPTY_STYLE_HASH}'`]);
  });
});

describe("parseCspMode (fail-safe)", () => {
  test("enforcement and off must be asked for explicitly", () => {
    expect(parseCspMode("enforce")).toBe("enforce");
    expect(parseCspMode(" ENFORCE ")).toBe("enforce");
    expect(parseCspMode("off")).toBe("off");
  });

  test("missing, empty, mistyped or unknown values mean report-only, never enforce", () => {
    for (const v of [undefined, "", " ", "report-only", "enforced", "true", "1", "on", "enable"]) {
      expect(parseCspMode(v), String(v)).toBe("report-only");
    }
  });
});

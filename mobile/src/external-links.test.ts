import { describe, expect, it } from "vitest";
import { EXTERNAL_LINKS, isAllowedExternalUrl } from "./external-links";

describe("isAllowedExternalUrl", () => {
  it("allows the Tanzil site over https", () => {
    expect(isAllowedExternalUrl(EXTERNAL_LINKS.tanzil)).toBe(true);
    expect(isAllowedExternalUrl("https://tanzil.net")).toBe(true);
    expect(isAllowedExternalUrl("https://TANZIL.NET/download/")).toBe(true);
  });

  it.each([
    ["plain http", "http://tanzil.net/"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["file scheme", "file:///etc/passwd"],
    ["tel scheme", "tel:+123456789"],
    ["intent scheme", "intent://tanzil.net#Intent;scheme=https;end"],
    ["another host", "https://example.com/"],
    ["lookalike suffix", "https://tanzil.net.evil.example/"],
    ["lookalike prefix", "https://eviltanzil.net/"],
    ["subdomain", "https://www.tanzil.net/"],
    ["userinfo trick", "https://tanzil.net@evil.example/"],
    ["credentials", "https://user:pass@tanzil.net/"],
    ["explicit port", "https://tanzil.net:8443/"],
    ["empty", ""],
    ["not a URL", "tanzil.net"],
  ])("rejects %s", (_name, url) => {
    expect(isAllowedExternalUrl(url)).toBe(false);
  });
});

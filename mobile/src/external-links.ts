/**
 * Safe external links (QR-DESIGN-007B).
 *
 * The app has no unrestricted navigation bridge. Capacitor already hands any
 * top-level navigation to a non-app host to the system browser (Android:
 * ACTION_VIEW; iOS: UIApplication.open), so no plugin or new permission is
 * needed. This module makes the one link the app renders strict: an exact
 * allowlist of https URLs, checked both when rendering and when the link is
 * activated. Anything else (other schemes, other hosts, userinfo tricks,
 * lookalike hosts, ports) is rejected.
 */

/** The only external destinations the app may open. */
export const EXTERNAL_LINKS = {
  tanzil: "https://tanzil.net/",
} as const;

export type ExternalLinkKey = keyof typeof EXTERNAL_LINKS;

const ALLOWED_HOSTS: ReadonlySet<string> = new Set(
  Object.values(EXTERNAL_LINKS).map((u) => new URL(u).host),
);

/** True only for a plain https URL on an allowlisted host (no credentials, no port). */
export function isAllowedExternalUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    ALLOWED_HOSTS.has(url.host)
  );
}

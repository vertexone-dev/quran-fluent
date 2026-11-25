// Content-Security-Policy for the QuranRoots website (QR-DESIGN-008A).
//
// Built per request in the Worker funnel (src/server.ts) because the policy
// carries a fresh nonce for the inline scripts TanStack Start emits for
// hydration/streaming and for our blocking theme script. Pure so it can be
// unit-tested without a Worker runtime.
//
// Every non-'self' source below is a connection the application genuinely
// makes (audited in docs/WEBSITE-CSP.md). There are no wildcards, no
// 'unsafe-eval' and no 'unsafe-inline' for scripts.

/** Quran recitation: the metadata API and the two audio hosts reciters resolve to. */
export const QURAN_API_ORIGIN = "https://api.quran.com";
export const QURAN_AUDIO_ORIGINS = [
  "https://audio.qurancdn.com",
  // Husary's by_ayah URL is `//mirrors.quranicaudio.com/everyayah/...`
  // (verified against api.quran.com; no redirects).
  "https://mirrors.quranicaudio.com",
] as const;

/**
 * Sonner (toasts) injects one <style> element at import time and offers no
 * way to give it a nonce. Rather than allow every inline <style>, the policy
 * allows exactly that stylesheet by hash. src/lib/csp.test.ts recomputes the
 * hash from the installed sonner, so upgrading sonner fails a test until this
 * value is reviewed and updated.
 */
export const SONNER_STYLE_HASH = "sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY=";

/** Hash of the empty string: Sonner appends its <style> to <head> empty and
 * fills it afterwards, and browsers check the empty element too. It permits no
 * CSS at all. */
export const EMPTY_STYLE_HASH = "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com";
const GOOGLE_FONTS_FILES = "https://fonts.gstatic.com";

export type CspOptions = {
  nonce: string;
  /** SUPABASE_URL (the project REST/auth origin). Omitted => no Supabase origin is allowed. */
  supabaseUrl?: string | undefined;
  /** Further Supabase URLs (e.g. the build-time VITE_ value when it differs). */
  extraSupabaseUrls?: string[];
  /** Add `upgrade-insecure-requests` (only meaningful, and only safe, over https). */
  upgradeInsecure?: boolean;
  /** Local development servers only: HMR websocket. Never set in a build. */
  dev?: boolean;
};

/** The origin of a Supabase URL, or undefined when it is missing or not http(s). */
export function supabaseOrigin(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : undefined;
  } catch {
    return undefined;
  }
}

export function buildCsp({
  nonce,
  supabaseUrl,
  extraSupabaseUrls = [],
  upgradeInsecure,
  dev,
}: CspOptions): string {
  const supabase = [...new Set([supabaseUrl, ...extraSupabaseUrls].map(supabaseOrigin))].filter(
    (o): o is string => o !== undefined,
  );
  const connect = ["'self'", QURAN_API_ORIGIN, ...supabase];
  if (dev) connect.push("ws://localhost:*", "ws://127.0.0.1:*");

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'none'"]],
    ["script-src", ["'self'", `'nonce-${nonce}'`]],
    // Stylesheets: our own CSS and the Google Fonts stylesheet. Element-level
    // only: the nonce lets runtime-injected <style> tags that we control through.
    [
      "style-src-elem",
      [
        "'self'",
        GOOGLE_FONTS_CSS,
        `'nonce-${nonce}'`,
        `'${SONNER_STYLE_HASH}'`,
        `'${EMPTY_STYLE_HASH}'`,
      ],
    ],
    // `style="..."` attributes (React inline styles in SSR output, Radix/Sonner
    // positioning). Attributes cannot run script; this is the one accepted
    // inline relaxation and is documented as such.
    ["style-src-attr", ["'unsafe-inline'"]],
    ["font-src", ["'self'", GOOGLE_FONTS_FILES]],
    ["img-src", ["'self'", "data:"]],
    ["media-src", ["'self'", ...QURAN_AUDIO_ORIGINS]],
    ["connect-src", connect],
    ["manifest-src", ["'self'"]],
    ["worker-src", ["'self'"]],
    ["frame-src", ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  const parts = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  if (upgradeInsecure) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** 128 bits of randomness, base64 (CSP nonces are base64 values). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Request header the Worker uses to hand the nonce to the SSR pipeline. */
export const NONCE_HEADER = "x-qr-csp-nonce";

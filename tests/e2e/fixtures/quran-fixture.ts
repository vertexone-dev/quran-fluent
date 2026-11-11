import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Page, Route } from "@playwright/test";

type Fixture = {
  surahs: { number: number; ayah_count: number; [k: string]: unknown }[];
  ayahs: { surah_number: number; ayah_number: number; arabic_text: string; [k: string]: unknown }[];
  pickthall: { ayah_number: number; text: string }[];
  kazimirski: unknown[];
};
const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./al-fatiha.fixture.json", import.meta.url)), "utf8"),
) as Fixture;

/**
 * TEST-ONLY Quran fixture (QR-INT-007, Milestone C). Answers the Reader's
 * Supabase REST calls with GENUINE, attributed data so the real UI can be
 * exercised without a database -- the same route-interception convention as
 * 14-translation-fallback / 49 / 50. Never imported by src/, never shipped.
 *
 * Provenance (see al-fatiha.fixture.json `_provenance`):
 * - Arabic: Tanzil Project Uthmani v1.1 (CC BY 3.0), verbatim, Al-Fatihah.
 * - Surah list: Tanzil metadata for all 114 Surahs / 6,236 Ayahs.
 * - English: Pickthall, Project Gutenberg #16955 (public domain), verbatim.
 * - French: Kazimirski 1869 (public domain), verbatim from spec 50's
 *   production-data fixture.
 * Only Al-Fatihah has āyah rows; every other Surah answers with no rows, which
 * the UI must render as an honest empty/unavailable state.
 */
export const PICKTHALL_SOURCE_ID = "fixture-pickthall-source";
export const KAZIMIRSKI_SOURCE_ID = "f8443b10-3cc8-59ee-954f-5b1129c1cec4";
export const FIXTURE = fixture;

function param(url: string, key: string): string | null {
  const m = new URL(url).searchParams.get(key);
  return m ? m.replace(/^eq\./, "") : null;
}

async function reply(route: Route, rows: unknown[]) {
  const wantsObject = (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");
  await route.fulfill({
    status: rows.length === 0 && wantsObject ? 406 : 200,
    contentType: "application/json",
    body: JSON.stringify(wantsObject ? (rows[0] ?? {}) : rows),
  });
}

export async function installQuranFixture(
  page: Page,
  opts: { audio?: "unavailable" | "fail" } = {},
) {
  await page.route("**/rest/v1/surahs*", (route) => {
    const n = param(route.request().url(), "number");
    return reply(route, n ? fixture.surahs.filter((s) => String(s.number) === n) : fixture.surahs);
  });
  await page.route("**/rest/v1/ayahs*", (route) => {
    const url = route.request().url();
    const s = param(url, "surah_number");
    const a = param(url, "ayah_number");
    return reply(
      route,
      fixture.ayahs.filter(
        (r) => String(r.surah_number) === s && (!a || String(r.ayah_number) === a),
      ),
    );
  });
  await page.route("**/rest/v1/content_sources*", (route) => {
    const lang = param(route.request().url(), "language");
    if (lang === "en")
      return reply(route, [{ id: PICKTHALL_SOURCE_ID, translator: "Marmaduke Pickthall" }]);
    if (lang === "fr")
      return reply(route, [
        { id: KAZIMIRSKI_SOURCE_ID, translator: "Albin de Kazimirski Biberstein" },
      ]);
    return reply(route, []);
  });
  await page.route("**/rest/v1/translations*", (route) =>
    reply(route, param(route.request().url(), "surah_number") === "1" ? fixture.pickthall : []),
  );
  await page.route("**/rest/v1/translation_segment_ayahs*", (route) =>
    reply(route, param(route.request().url(), "surah_number") === "1" ? fixture.kazimirski : []),
  );
  await page.route("**/recitations/**", (route) =>
    opts.audio === "fail"
      ? route.fulfill({ status: 503, body: "" })
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ audio_files: [] }),
        }),
  );
}

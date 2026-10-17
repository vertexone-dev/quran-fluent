import { useEffect, useState } from "react";
import type { Database } from "sql.js";

import {
  loadContentDb,
  listSurahs,
  getAyahsWithEnglish,
  getKazimirskiJoinRows,
  getContentVersion,
  type Surah,
  type ContentVersion,
} from "./db";
import { buildKazimirskiRenderMap } from "./kazimirski-render";

/**
 * Phase 0 feasibility proof-of-concept: a minimal offline Qur'an Reader
 * that reads exclusively from the bundled, local content.sqlite --
 * nothing on this screen ever calls fetch() against Supabase, Stripe, or
 * any remote host. This is intentionally not a port of the production
 * AyahReader component (different data path, no React Query, no auth) --
 * it exists to prove the bundled-content-works-offline concept, not to
 * replace anything.
 */
export function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [version, setVersion] = useState<ContentVersion | null>(null);
  const [selectedSurah, setSelectedSurah] = useState<number>(106);

  useEffect(() => {
    loadContentDb()
      .then((loaded) => {
        setDb(loaded);
        setSurahs(listSurahs(loaded));
        setVersion(getContentVersion(loaded));
      })
      .catch((err) => setError(String(err?.message ?? err)));
  }, []);

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Offline content failed to load</h1>
        <p style={{ color: "#a23a2e" }}>{error}</p>
      </main>
    );
  }

  if (!db) {
    return (
      <main style={{ padding: 24 }}>
        <p>Loading bundled content database&hellip;</p>
      </main>
    );
  }

  const ayahs = getAyahsWithEnglish(db, selectedSurah);
  const kazimirskiRows = getKazimirskiJoinRows(db, selectedSurah);
  const kazimirskiRender = buildKazimirskiRenderMap(
    kazimirskiRows.map((r) => ({
      ayah_number: r.ayah_number,
      segment: {
        id: r.seg_id,
        source_ordinal: r.source_ordinal,
        text: r.seg_text,
        alignment_type: r.alignment_type,
      },
    })),
  );

  return (
    <main style={{ padding: "24px 16px", maxWidth: 680, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>QuranRoots Offline (Feasibility)</h1>
      <p style={{ fontSize: 12, color: "#5c5546", marginTop: 0 }}>
        Reading entirely from a bundled local file. No network request is made by this screen.
      </p>
      {version && (
        <p style={{ fontSize: 11, color: "#8a8270", fontFamily: "monospace" }}>
          content v{version.version} &middot; built from {version.source_commit.slice(0, 7)}{" "}
          &middot; hash {version.overall_sha256.slice(0, 12)}&hellip;
        </p>
      )}

      <label style={{ display: "block", margin: "16px 0 8px", fontSize: 13 }}>
        Surah
        <select
          value={selectedSurah}
          onChange={(e) => setSelectedSurah(Number(e.target.value))}
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        >
          {surahs.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.name_en}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 16 }}>
        {ayahs.map((ayah) => {
          const fr = kazimirskiRender.get(ayah.ayah_number);
          return (
            <article
              key={ayah.ayah_number}
              style={{ borderBottom: "1px solid #ddd4c0", paddingBottom: 14 }}
            >
              <div style={{ fontSize: 12, color: "#8a8270", marginBottom: 6 }}>
                Ayah {ayah.ayah_number}
              </div>
              <p dir="rtl" lang="ar" style={{ fontSize: 22, lineHeight: 1.7, margin: "0 0 8px" }}>
                {ayah.arabic_text}
              </p>
              <p style={{ fontSize: 14, color: "#241f16", margin: "0 0 4px" }}>
                <strong>EN:</strong> {ayah.english ?? "(unavailable)"}
              </p>
              <p style={{ fontSize: 14, color: "#1f5b61", margin: 0 }}>
                <strong>FR:</strong>{" "}
                {fr?.text ??
                  (fr?.continuesFromAyah
                    ? `(continues from ayah ${fr.continuesFromAyah})`
                    : "(unavailable)")}
              </p>
            </article>
          );
        })}
      </div>
    </main>
  );
}

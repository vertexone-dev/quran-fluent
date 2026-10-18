import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { getAyahsWithEnglish, getKazimirskiJoinRows, listSurahs } from "../db";
import { buildKazimirskiRenderMap } from "../kazimirski-render";
import { AppBar } from "../AppBar";
import type { Route } from "../navigation";

type Tab = "ar" | "en" | "fr";

/** Mockup panel 4: Reading View. No per-ayah transliteration is shown --
 * the real `ayahs` table has no transliteration column (unlike
 * word_frequency, which does), so this screen never invents one. Word-tap
 * is intentionally not wired here either: production has no reliable
 * per-word mapping from ayah text to word_frequency rows (that table is a
 * standalone reference list, not tokenized against specific ayahs), so
 * guessing word boundaries risks showing a wrong word's meaning. Word
 * Details is reached via the dedicated Words browser instead (real data,
 * real navigation). */
export function ReadingScreen({
  surahNumber,
  onNavigate,
  onBack,
}: {
  surahNumber: number;
  onNavigate: (route: Route) => void;
  onBack: () => void;
}) {
  const { d, locale } = useI18n();
  const { db } = useDb();
  const [tab, setTab] = useState<Tab>("ar");

  const surah = useMemo(
    () => listSurahs(db).find((s) => s.number === surahNumber),
    [db, surahNumber],
  );
  const ayahs = useMemo(() => getAyahsWithEnglish(db, surahNumber), [db, surahNumber]);
  const kazimirskiRows = useMemo(() => getKazimirskiJoinRows(db, surahNumber), [db, surahNumber]);
  const kazimirskiRender = useMemo(
    () =>
      buildKazimirskiRenderMap(
        kazimirskiRows.map((r) => ({
          ayah_number: r.ayah_number,
          segment: {
            id: r.seg_id,
            source_ordinal: r.source_ordinal,
            text: r.seg_text,
            alignment_type: r.alignment_type,
          },
        })),
      ),
    [kazimirskiRows],
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "ar", label: d.reader.tabArabic },
    { key: "en", label: d.reader.tabEnglish },
    { key: "fr", label: d.reader.tabFrench },
  ];

  return (
    <div>
      <AppBar title={surah?.name_en ?? ""} onBack={onBack} />
      {surah && (
        <div
          className="text-muted"
          style={{ marginTop: -8, marginBottom: 12, fontSize: "0.85rem" }}
        >
          {surah.ayah_count} {locale === "fr" ? "versets" : "ayahs"}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? "chip" : "chip chip-muted"}
            style={{ border: "none", cursor: "pointer" }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {ayahs.map((ayah) => {
        const fr = kazimirskiRender.get(ayah.ayah_number);
        return (
          <div key={ayah.ayah_number} className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  color: "var(--accent-foreground)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                }}
              >
                {ayah.ayah_number}
              </span>
            </div>
            {tab === "ar" && (
              <p className="quran-text" style={{ fontSize: "1.6rem", lineHeight: 1.9, margin: 0 }}>
                {ayah.arabic_text}
              </p>
            )}
            {tab === "en" && <p style={{ margin: 0 }}>{ayah.english ?? "—"}</p>}
            {tab === "fr" && (
              <p style={{ margin: 0 }}>
                {fr?.text ??
                  (fr?.continuesFromAyah ? `(suite du verset ${fr.continuesFromAyah})` : "—")}
              </p>
            )}
          </div>
        );
      })}

      <button
        className="btn btn-outline btn-block"
        type="button"
        style={{ marginTop: 16 }}
        onClick={() => onNavigate({ screen: "word-list" })}
      >
        {d.reader.words}
      </button>
    </div>
  );
}

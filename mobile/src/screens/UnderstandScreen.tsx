import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { AppBar } from "../AppBar";
import { useDb } from "../DbContext";
import { getAyah, getKazimirskiJoinRows, listSurahs } from "../db";
import { useI18n } from "../i18n";
import { buildKazimirskiRenderMap } from "../kazimirski-render";
import type { Route } from "../navigation";
import { neighbouringAyahs } from "../understand";

type TabKey = "meaning" | "words" | "tafsir";

/** Understand This Ayah (Design Lock v1.0 mobile reference, screen 6).
 *
 * Content integrity: the Arabic and both translations come ONLY from the
 * bundled, verified database, through the same queries the Reader uses. The
 * reference's "Key Lessons" are not reproduced: they have no approved source.
 * Word-by-word and tafsir have no approved source bundled either, so those
 * tabs say so explicitly instead of showing anything that looks like content. */
export function UnderstandScreen({
  surahNumber,
  ayahNumber,
  onNavigate,
  onBack,
}: {
  surahNumber: number;
  ayahNumber: number;
  onNavigate: (route: Route) => void;
  onBack: () => void;
}) {
  const { d, locale } = useI18n();
  const { db } = useDb();
  const [tab, setTab] = useState<TabKey>("meaning");

  const surahs = useMemo(() => listSurahs(db), [db]);
  const surah = surahs.find((s) => s.number === surahNumber);
  const ayah = useMemo(() => getAyah(db, surahNumber, ayahNumber), [db, surahNumber, ayahNumber]);
  const french = useMemo(() => {
    const rows = getKazimirskiJoinRows(db, surahNumber).map((r) => ({
      ayah_number: r.ayah_number,
      segment: {
        id: r.seg_id,
        source_ordinal: r.source_ordinal,
        text: r.seg_text,
        alignment_type: r.alignment_type,
      },
    }));
    return buildKazimirskiRenderMap(rows).get(ayahNumber);
  }, [db, surahNumber, ayahNumber]);

  const { prev, next } = neighbouringAyahs(surahs, { surah: surahNumber, ayah: ayahNumber });
  const go = (to: { surah: number; ayah: number }) =>
    onNavigate({ screen: "understand", surahNumber: to.surah, ayahNumber: to.ayah });

  const name = surah
    ? locale === "ar"
      ? surah.name_ar
      : locale === "fr"
        ? (surah.name_fr ?? surah.name_en)
        : surah.name_en
    : String(surahNumber);
  const label = `${name} ${surahNumber}:${ayahNumber}`;
  const tabs: { key: TabKey; text: string }[] = [
    { key: "meaning", text: d.understand.meaning },
    { key: "words", text: d.understand.wordByWord },
    { key: "tafsir", text: d.understand.tafsir },
  ];

  if (!surah || !ayah) {
    return (
      <div data-testid="understand-screen">
        <AppBar title={d.understand.title} onBack={onBack} />
        <p className="text-muted" data-testid="understand-not-found">
          {d.understand.notFound}
        </p>
      </div>
    );
  }

  return (
    <div className="stagger" data-testid="understand-screen">
      <AppBar title={d.understand.title} onBack={onBack} />

      <div className="row-between" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="icon-btn icon-btn-bordered"
          disabled={!prev}
          onClick={() => prev && go(prev)}
          aria-label={d.understand.prev}
          data-testid="understand-prev"
        >
          <ChevronLeft size={18} className="dir-icon" />
        </button>
        <span className="chip" data-testid="understand-ref">
          {label}
        </span>
        <button
          type="button"
          className="icon-btn icon-btn-bordered"
          disabled={!next}
          onClick={() => next && go(next)}
          aria-label={d.understand.next}
          data-testid="understand-next"
        >
          <ChevronRight size={18} className="dir-icon" />
        </button>
      </div>

      <div className="card verse-card parchment">
        <div className="ayah-arabic">
          <p className="quran-text" lang="ar" dir="rtl" data-testid="understand-arabic">
            {ayah.arabic_text}
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label={d.understand.title}
        className="segmented"
        style={{ margin: "16px 0" }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`understand-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="understand-panel"
            className={`seg${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
            data-testid={`understand-tab-${t.key}`}
          >
            {t.text}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="understand-panel"
        aria-labelledby={`understand-tab-${tab}`}
        className="card"
        data-testid="understand-panel"
      >
        {tab === "meaning" && (
          <div>
            <h3 className="group-label" style={{ marginTop: 0 }}>
              {d.understand.englishLabel}
            </h3>
            <p className="translation-text" dir="ltr" lang="en" data-testid="understand-english">
              {ayah.english ?? "—"}
            </p>
            <h3 className="group-label">{d.understand.frenchLabel}</h3>
            <p className="translation-text" dir="ltr" lang="fr" data-testid="understand-french">
              {french?.text ??
                (french?.continuesFromAyah ? `(suite du verset ${french.continuesFromAyah})` : "—")}
            </p>
          </div>
        )}
        {tab !== "meaning" && (
          <div data-testid={`understand-${tab}-unavailable`}>
            <span className="chip chip-planned">{d.understand.unavailableBadge}</span>
            <p className="text-muted" style={{ marginBottom: 0, lineHeight: 1.6 }}>
              {tab === "words" ? d.understand.wordsUnavailable : d.understand.tafsirUnavailable}
            </p>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        <button
          type="button"
          className="list-row"
          style={{ padding: 14 }}
          onClick={() =>
            onNavigate({ screen: "reading", surahNumber, targetAyahNumber: ayahNumber })
          }
          data-testid="understand-open-reader"
        >
          <span className="row-icon">
            <BookOpen size={18} />
            {d.understand.openInReader}
          </span>
          <ChevronRight size={18} className="text-muted dir-icon" />
        </button>
        <button
          type="button"
          className="list-row"
          style={{ padding: 14 }}
          onClick={() => onNavigate({ screen: "reflect", surahNumber, ayahNumber })}
          data-testid="understand-reflect"
        >
          <span className="row-icon">
            <Sparkles size={18} />
            {d.understand.reflectOnThis}
          </span>
          <ChevronRight size={18} className="text-muted dir-icon" />
        </button>
      </div>
    </div>
  );
}

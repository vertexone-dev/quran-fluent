import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { AppBar } from "../AppBar";
import { useDb } from "../DbContext";
import { listSurahs, type Surah } from "../db";
import { useI18n, type Locale } from "../i18n";
import {
  MAX_REFLECTION_LENGTH,
  addReflection,
  deleteReflection,
  getReadingPosition,
  getReflections,
  type Reflection,
} from "../local-store";
import type { Route } from "../navigation";

function nameOf(surah: Surah | undefined, locale: Locale, fallback: number): string {
  if (!surah) return String(fallback);
  return locale === "ar"
    ? surah.name_ar
    : locale === "fr"
      ? (surah.name_fr ?? surah.name_en)
      : surah.name_en;
}

/** Reflect (Design Lock v1.0 mobile reference, screen 8). A private notebook:
 * the user's own words about an ayah, saved on this device only. The single
 * prompt is a question, not an interpretation; no sample reflections and no
 * pre-filled text are ever shown. The reference's topic chips (Gratitude,
 * Patience, Trust in Allah) are not included: they would steer the reader
 * toward themes the app has no approved content for. */
export function ReflectScreen({
  surahNumber,
  ayahNumber,
  onNavigate,
  onBack,
}: {
  surahNumber?: number;
  ayahNumber?: number;
  onNavigate: (route: Route) => void;
  onBack: () => void;
}) {
  const { d, locale } = useI18n();
  const { db } = useDb();
  const surahs = useMemo(() => listSurahs(db), [db]);
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<Reflection[]>(() => getReflections());

  const position = getReadingPosition();
  const target =
    surahNumber && ayahNumber
      ? { surah: surahNumber, ayah: ayahNumber }
      : position
        ? { surah: position.surahNumber, ayah: position.ayahNumber }
        : null;
  const targetSurah = target ? surahs.find((s) => s.number === target.surah) : undefined;
  const validTarget = Boolean(target && targetSurah && target.ayah <= targetSurah.ayah_count);

  function save() {
    if (!target || !validTarget) return;
    if (addReflection(target.surah, target.ayah, text)) {
      setText("");
      setEntries(getReflections());
    }
  }

  return (
    <div className="stagger" data-testid="reflect-screen">
      <AppBar title={d.reflectUi.title} onBack={onBack} />

      {validTarget && target ? (
        <section className="card parchment-panel" data-testid="reflect-composer">
          <div className="setting-hint">{d.reflectUi.reflectingOn}</div>
          <div className="setting-title" data-testid="reflect-target">
            {nameOf(targetSurah, locale, target.surah)} {target.surah}:{target.ayah}
          </div>
          <h3 className="group-label">{d.reflectUi.promptTitle}</h3>
          <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>{d.reflectUi.prompt}</p>
          <textarea
            className="reflect-input"
            value={text}
            maxLength={MAX_REFLECTION_LENGTH}
            placeholder={d.reflectUi.placeholder}
            aria-label={d.reflectUi.placeholder}
            onChange={(e) => setText(e.target.value)}
            data-testid="reflect-input"
          />
          <div className="row-between" style={{ marginTop: 10 }}>
            <span className="setting-hint">{d.reflectUi.saved}</span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!text.trim()}
              onClick={save}
              data-testid="reflect-save"
            >
              {d.reflectUi.save}
            </button>
          </div>
        </section>
      ) : (
        <section className="card parchment-panel" data-testid="reflect-choose">
          <p className="text-muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
            {d.reflectUi.chooseAyah}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => onNavigate({ screen: "surah-list" })}
            data-testid="reflect-open-quran"
          >
            <BookOpen size={18} />
            {d.reflectUi.openQuran}
          </button>
        </section>
      )}

      <h2 className="group-label" style={{ marginTop: 20 }}>
        {d.reflectUi.yours}
      </h2>
      {entries.length === 0 ? (
        <p className="text-muted" data-testid="reflect-empty">
          {d.reflectUi.empty}
        </p>
      ) : (
        <div className="card" style={{ padding: 0 }} data-testid="reflect-list">
          {entries.map((r) => {
            const s = surahs.find((x) => x.number === r.surahNumber);
            return (
              <div key={r.id} className="setting-row reflect-entry" data-testid="reflect-entry">
                <span className="setting-text">
                  <span className="setting-hint">
                    {nameOf(s, locale, r.surahNumber)} {r.surahNumber}:{r.ayahNumber}
                  </span>
                  <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.text}</span>
                </span>
                <button
                  type="button"
                  className="chip"
                  style={{ border: 0, cursor: "pointer", flexShrink: 0 }}
                  onClick={() => {
                    deleteReflection(r.id);
                    setEntries(getReflections());
                  }}
                  aria-label={`${d.reflectUi.delete}: ${nameOf(s, locale, r.surahNumber)} ${r.surahNumber}:${r.ayahNumber}`}
                  data-testid="reflect-delete"
                >
                  {d.reflectUi.delete}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <p className="setting-hint" style={{ margin: "12px 4px" }}>
        {d.reflectUi.privacy}
      </p>
    </div>
  );
}

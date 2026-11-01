import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Minus, Plus, Play, SkipBack, SkipForward } from "lucide-react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { getAyahsWithEnglish, getKazimirskiJoinRows, listSurahs } from "../db";
import { buildKazimirskiRenderMap } from "../kazimirski-render";
import { setLastReadSurah } from "../local-store";
import { AppBar } from "../AppBar";
import { ProgressBar, Segmented } from "../components/ui";
import type { Route } from "../navigation";

type Translation = "none" | "en" | "fr";

/** Arabic font size steps (px), carried over from the approved Stage B
 * prototype (src/qr/screens/ReaderScreen.tsx) verbatim. */
const FONT_SIZES = [22, 26, 30, 34, 40];

/** Tracks scroll position within the shared `.screen` container (App.tsx's
 * single scrollable region for every route) to drive the reading-progress
 * bar and "Ayah N of M" label. DOM-coupled, so it stays colocated here
 * rather than in a separate pure-logic module like home-dashboard.ts. */
function useScrollProgress(ref: RefObject<HTMLDivElement | null>) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const scroller = ref.current?.closest(".screen");
    if (!scroller) return;
    const onScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      setProgress(max > 0 ? scroller.scrollTop / max : 1);
    };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [ref]);
  return progress;
}

/** Visibly disabled, not a functional player: mobile has no bundled
 * reciter audio (see MoreScreen.tsx and SettingsScreen.tsx's own Phase 1
 * decisions). Shown so the Reader layout matches the approved design
 * without implying playback exists -- never wire this to real audio
 * without also bundling reciter data offline. */
function AudioBar() {
  const { d } = useI18n();
  return (
    <div className="audio-bar" aria-disabled="true">
      <div className="audio-controls">
        <button type="button" className="icon-btn" disabled aria-label={d.reader.previousVerse}>
          <SkipBack size={18} />
        </button>
        <button type="button" className="audio-play" disabled aria-label={d.reader.audio}>
          <Play size={18} />
        </button>
        <button type="button" className="icon-btn" disabled aria-label={d.reader.nextVerse}>
          <SkipForward size={18} />
        </button>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="small" style={{ fontWeight: 700 }}>
          {d.reader.audio}
        </div>
        <div className="small text-muted">{d.reader.audioUnavailable}</div>
      </div>
    </div>
  );
}

/** Mockup panel 4: Reading View, Phase 2A of the Emergent UI integration
 * (approved Stage B reference, src/qr/screens/ReaderScreen.tsx). Arabic is
 * always shown; the translation selector adds English or French alongside
 * it rather than replacing it, per the approved design. Ayah-level
 * bookmarking from the prototype is deliberately NOT carried over here --
 * that is separate Phase 2B scope, pending its own approval, so no
 * bookmark control is shown at all rather than one that looks functional
 * but doesn't persist.
 *
 * No per-ayah transliteration is shown -- the real `ayahs` table has no
 * transliteration column (unlike word_frequency, which does), so this
 * screen never invents one. Word-tap is intentionally not wired here
 * either: production has no reliable per-word mapping from ayah text to
 * word_frequency rows (that table is a standalone reference list, not
 * tokenized against specific ayahs), so guessing word boundaries risks
 * showing a wrong word's meaning. Word Details is reached via the
 * dedicated Words browser instead (real data, real navigation). */
export function ReadingScreen({
  surahNumber,
  onNavigate,
  onBack,
}: {
  surahNumber: number;
  onNavigate: (route: Route) => void;
  onBack: () => void;
}) {
  const { d } = useI18n();
  const { db } = useDb();
  const [translation, setTranslation] = useState<Translation>("none");
  const [sizeIdx, setSizeIdx] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(rootRef);

  // Surah-level only -- feeds the Home Dashboard's Continue Reading card
  // (mobile/src/home-dashboard.ts). No per-ayah position is tracked.
  useEffect(() => {
    setLastReadSurah(surahNumber);
  }, [surahNumber]);

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

  const currentAyah = surah ? Math.max(1, Math.ceil(progress * surah.ayah_count)) : 1;

  return (
    <div ref={rootRef}>
      <div className="reader-sticky">
        <AppBar
          title={surah?.name_en ?? ""}
          onBack={onBack}
          right={surah && <span className="arabic-text reader-ar-title">{surah.name_ar}</span>}
        />
        {surah && (
          <div className="row-between small text-muted" style={{ marginBottom: 6 }}>
            <span>{d.reader.progress}</span>
            <span>
              {d.reader.ayah} {currentAyah} {d.reader.of} {surah.ayah_count}
            </span>
          </div>
        )}
        <ProgressBar value={progress} label={d.reader.progress} />
      </div>

      <div className="reader-controls card">
        <div className="small control-label">{d.reader.translation}</div>
        <Segmented
          label={d.reader.translation}
          testId="reader-translation"
          value={translation}
          onChange={setTranslation}
          options={[
            { value: "none", label: d.reader.arabicOnly },
            { value: "en", label: d.reader.tabEnglish },
            { value: "fr", label: d.reader.tabFrench },
          ]}
        />
        <div className="row-between" style={{ marginTop: 14 }}>
          <span className="small control-label" style={{ margin: 0 }}>
            {d.reader.fontSize}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className="icon-btn icon-btn-bordered"
              disabled={sizeIdx === 0}
              onClick={() => setSizeIdx((i) => i - 1)}
              aria-label={d.reader.smaller}
            >
              <Minus size={16} />
            </button>
            <span className="font-size-value">{FONT_SIZES[sizeIdx]}px</span>
            <button
              type="button"
              className="icon-btn icon-btn-bordered"
              disabled={sizeIdx === FONT_SIZES.length - 1}
              onClick={() => setSizeIdx((i) => i + 1)}
              aria-label={d.reader.larger}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      <AudioBar />

      {ayahs.map((ayah) => {
        const fr = kazimirskiRender.get(ayah.ayah_number);
        return (
          <div key={ayah.ayah_number} className="card verse-card">
            <div className="row-between" style={{ marginBottom: 10 }}>
              <span className="ayah-marker" aria-label={`${d.reader.ayah} ${ayah.ayah_number}`}>
                {ayah.ayah_number}
              </span>
            </div>
            <div className="ayah-arabic">
              <p className="quran-text" style={{ fontSize: FONT_SIZES[sizeIdx], margin: 0 }}>
                {ayah.arabic_text}
              </p>
            </div>
            {translation === "en" && <p style={{ margin: 0 }}>{ayah.english ?? "—"}</p>}
            {translation === "fr" && (
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

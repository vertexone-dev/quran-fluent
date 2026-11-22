import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  BookmarkCheck,
  BookmarkPlus,
  Minus,
  Plus,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { getAyahsWithEnglish, getKazimirskiJoinRows, listSurahs } from "../db";
import { buildKazimirskiRenderMap } from "../kazimirski-render";
import {
  getReaderFontSizeIndex,
  getReaderTranslation,
  getReadingPosition,
  isAyahBookmarked,
  setReaderFontSizeIndex,
  setReaderTranslation,
  setReadingPosition,
  toggleAyahBookmark,
  type ReaderTranslation,
} from "../local-store";
import { resolveResumeAyah } from "../reading-position";
import { AppBar } from "../AppBar";
import { ProgressBar, Segmented } from "../components/ui";
import type { Route } from "../navigation";

/** Arabic font size steps (px), carried over from the approved Stage B
 * prototype (src/qr/screens/ReaderScreen.tsx) verbatim. */
const FONT_SIZES = [22, 26, 30, 34, 40];

/** Tracks scroll position within the shared `.screen` container (App.tsx's
 * single scrollable region for every route) to drive the reading-progress
 * bar. DOM-coupled, so it stays colocated here rather than in a separate
 * pure-logic module like home-dashboard.ts. */
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

/**
 * Sprint 2, Feature B: deterministic, debounced tracking of which ayah the
 * reader is actually at while scrolling -- the exact-position analog of
 * useScrollProgress's approximate percentage above.
 *
 * Each verse card carries a `data-ayah` attribute; IntersectionObserver
 * watches all of them against the scroll container, with its top shrunk
 * inward by the sticky header's height so the area hidden behind the
 * header never counts as "visible." Of the cards currently intersecting,
 * the one whose top edge sits closest to a fixed anchor line just below
 * the header -- where the eye naturally lands -- is treated as "the ayah
 * being read."
 *
 * This is deliberately an anchor-distance rule, not "smallest top" (which
 * would wrongly favor a card mostly scrolled past, whose top is far
 * *above* the viewport and therefore a large negative number) and not
 * "largest visible area" (which would favor a tall card lower on screen
 * over the one actually at the top of the reading area). The set of
 * currently-intersecting cards is tracked across callbacks -- a single
 * IntersectionObserver callback only reports cards whose status just
 * *changed*, not every card already visible, so a card that became
 * visible in an earlier scroll step would otherwise be forgotten the
 * moment a different card crosses a boundary.
 *
 * IntersectionObserver already fires far less often than scroll events;
 * `onSettledAyah` is debounced on top of that so a fast scroll-flick
 * writes to storage only for the ayah the reader actually stops on, never
 * for every intermediate one it passes through.
 *
 * `ready` gates the whole thing: it only starts watching once the caller
 * says the resume-scroll (see the effect below, in ReadingScreen) has
 * already landed. Without this, the observer's very first callback fires
 * against whatever ayah happens to be on screen *before* that scroll runs
 * -- on a fresh mount that's ayah 1 -- and nothing stops its own 400ms
 * timer from firing before the real resume-scroll (two animation frames
 * later, normally far sooner, but not guaranteed) gets a chance to
 * re-trigger the observer and reset it. That pending "1" would otherwise
 * be free to land after the resume/bookmark write, silently reverting it.
 *
 * Two more guarantees close the remaining write-loss windows a debounced,
 * fire-and-forget write otherwise has: a pending write is flushed
 * immediately (not dropped) both on unmount -- a fast tab change away
 * from the Reader must not discard the last ayah actually scrolled to --
 * and when the app is backgrounded (`visibilitychange`), since that is
 * how an Android app's process is actually reclaimed in practice; a true
 * `force-stop`/kill -9 gives no JS any chance to run at all, so some loss
 * there is unavoidable and bounded to this debounce's own window.
 */
function useCurrentAyahTracking(
  rootRef: RefObject<HTMLDivElement | null>,
  ready: boolean,
  onSettledAyah: (ayahNumber: number) => void,
): number | null {
  const [currentAyah, setCurrentAyah] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    const container = rootRef.current;
    const scroller = container?.closest(".screen");
    const targets = container
      ? Array.from(container.querySelectorAll<HTMLElement>("[data-ayah]"))
      : [];
    if (!container || !scroller || targets.length === 0) return;

    const headerHeight =
      container.querySelector<HTMLElement>(".reader-sticky")?.getBoundingClientRect().height ?? 0;
    const anchorY = scroller.getBoundingClientRect().top + headerHeight + 48;
    const visibleByAyah = new Map<number, IntersectionObserverEntry>();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let latestAyah: number | null = null;

    function flush() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        if (latestAyah != null) onSettledAyah(latestAyah);
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const ayahNumber = Number(entry.target.getAttribute("data-ayah"));
          if (!Number.isInteger(ayahNumber)) continue;
          if (entry.isIntersecting) {
            visibleByAyah.set(ayahNumber, entry);
          } else {
            visibleByAyah.delete(ayahNumber);
          }
        }
        if (visibleByAyah.size === 0) return;

        // Distance from the anchor point to the card's rect, not to its
        // top edge: a card whose rect already contains the anchor (the
        // common case) is distance 0, whatever its own height, rather
        // than losing to some other card that merely has a numerically
        // closer top edge while the anchor itself sits elsewhere.
        let bestAyah: number | null = null;
        let bestDistance = Infinity;
        for (const [ayahNumber, entry] of visibleByAyah) {
          const { top, bottom } = entry.boundingClientRect;
          const distance = anchorY < top ? top - anchorY : anchorY > bottom ? anchorY - bottom : 0;
          if (distance < bestDistance) {
            bestDistance = distance;
            bestAyah = ayahNumber;
          }
        }
        if (bestAyah == null) return;
        setCurrentAyah(bestAyah);
        latestAyah = bestAyah;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          if (latestAyah != null) onSettledAyah(latestAyah);
        }, 400);
      },
      { root: scroller, rootMargin: `-${Math.round(headerHeight)}px 0px 0px 0px`, threshold: 0 },
    );

    targets.forEach((el) => observer.observe(el));

    const onVisibilityChange = () => {
      if (document.hidden) flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
  }, [rootRef, ready, onSettledAyah]);

  return currentAyah;
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
 * it rather than replacing it, per the approved design.
 *
 * Sprint 2 adds ayah-level bookmarks (Feature A), exact reading-position
 * resume (Feature B), and persistent translation/font-size preferences
 * (Feature C) -- see local-store.ts and reading-position.ts.
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
  targetAyahNumber,
  onNavigate,
  onBack,
}: {
  surahNumber: number;
  targetAyahNumber?: number;
  onNavigate: (route: Route) => void;
  onBack: () => void;
}) {
  const { d } = useI18n();
  const { db } = useDb();
  const [translation, setTranslationState] = useState<ReaderTranslation>(() =>
    getReaderTranslation(),
  );
  const [sizeIdx, setSizeIdxState] = useState(() =>
    getReaderFontSizeIndex(FONT_SIZES.length - 1, 1),
  );
  const [, forceRender] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(rootRef);

  function setTranslation(next: ReaderTranslation) {
    setTranslationState(next);
    setReaderTranslation(next);
  }

  function setSizeIdx(next: number) {
    setSizeIdxState(next);
    setReaderFontSizeIndex(next);
  }

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

  // Feature B: resumes at the exact saved ayah, except when an explicit
  // targetAyahNumber (opening a bookmark) overrides it, and never applies
  // a saved position belonging to a *different* surah than the one just
  // opened -- see reading-position.ts for the three cases this
  // distinguishes (Continue Reading, opening a surah from the list,
  // opening a bookmarked ayah).
  //
  // trackingReady is reset to false at the start of every run of this
  // effect (including a same-component surah switch) and only flips true
  // once this resume attempt -- successful or not -- has fully landed.
  // useCurrentAyahTracking stays fully inactive until then, so a rapid
  // surah switch can never leave the *previous* surah's observer racing
  // to write under the *new* surah's number, and a bookmark jump's
  // explicit target can never lose a race against the observer's own
  // pre-scroll reading of whatever ayah happened to be on screen before
  // this effect's scroll ran.
  const [trackingReady, setTrackingReady] = useState(false);

  useEffect(() => {
    setTrackingReady(false);
    if (!surah) return;
    const resumeTarget = resolveResumeAyah(
      surahNumber,
      surah.ayah_count,
      targetAyahNumber,
      getReadingPosition(),
    );
    // Recorded immediately (not debounced) so "last read" reflects this
    // visit even if the reader leaves before the scroll/observer settle --
    // same eager-write timing the old surah-only tracking had, just with
    // an honest starting ayah instead of none at all.
    setReadingPosition(surahNumber, resumeTarget ?? 1);
    // Ayah 1 is already where an unscrolled page naturally lands -- the
    // translation/font-size controls and the audio bar sit between the
    // sticky header and the first verse card, so forcing a scroll that
    // aligns ayah 1 with the anchor line (the same offset math real
    // resume targets need) would instead push those controls out of view
    // behind the header for no reason. Caught via the Android smoke suite
    // after a real resume-to-ayah-1 case: the Translation control became
    // untappable, clipped under the sticky header.
    if (!resumeTarget || resumeTarget <= 1) {
      setTrackingReady(true);
      return;
    }

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const container = rootRef.current;
        const scroller = container?.closest(".screen");
        const target = container?.querySelector(`[data-ayah="${resumeTarget}"]`);
        if (container && scroller instanceof HTMLElement && target) {
          const headerHeight =
            container.querySelector<HTMLElement>(".reader-sticky")?.getBoundingClientRect()
              .height ?? 0;
          const offset =
            target.getBoundingClientRect().top -
            scroller.getBoundingClientRect().top -
            headerHeight -
            8;
          scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + offset) });
        }
        // Always unblocks tracking, even if the target card wasn't found --
        // an indefinitely-stuck tracker would be a worse failure than
        // starting from whatever is on screen.
        setTrackingReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [surahNumber, targetAyahNumber, surah, ayahs]);

  const persistSettledAyah = useCallback(
    (ayahNumber: number) => setReadingPosition(surahNumber, ayahNumber),
    [surahNumber],
  );
  const observedAyah = useCurrentAyahTracking(rootRef, trackingReady, persistSettledAyah);

  const currentAyah =
    observedAyah ?? (surah ? Math.max(1, Math.ceil(progress * surah.ayah_count)) : 1);

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
              onClick={() => setSizeIdx(sizeIdx - 1)}
              aria-label={d.reader.smaller}
            >
              <Minus size={16} />
            </button>
            <span className="font-size-value">{FONT_SIZES[sizeIdx]}px</span>
            <button
              type="button"
              className="icon-btn icon-btn-bordered"
              disabled={sizeIdx === FONT_SIZES.length - 1}
              onClick={() => setSizeIdx(sizeIdx + 1)}
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
        const bookmarked = isAyahBookmarked(surahNumber, ayah.ayah_number);
        return (
          <div key={ayah.ayah_number} className="card verse-card" data-ayah={ayah.ayah_number}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <span className="ayah-marker" aria-label={`${d.reader.ayah} ${ayah.ayah_number}`}>
                {ayah.ayah_number}
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={bookmarked ? d.bookmarks.remove : d.bookmarks.add}
                onClick={() => {
                  toggleAyahBookmark(surahNumber, ayah.ayah_number);
                  forceRender((n) => n + 1);
                }}
              >
                {bookmarked ? (
                  <BookmarkCheck size={18} className="text-gold" />
                ) : (
                  <BookmarkPlus size={18} />
                )}
              </button>
            </div>
            <div className="ayah-arabic">
              <p className="quran-text" style={{ fontSize: FONT_SIZES[sizeIdx], margin: 0 }}>
                {ayah.arabic_text}
              </p>
            </div>
            {translation === "en" && (
              <p className="translation-text" dir="ltr" lang="en">
                {ayah.english ?? "—"}
              </p>
            )}
            {translation === "fr" && (
              <p className="translation-text" dir="ltr" lang="fr">
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

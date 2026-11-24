import { useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, ChevronRight, Search } from "lucide-react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { listSurahs } from "../db";
import { getFavoriteSurahs, getReadingPosition, toggleFavoriteSurah } from "../local-store";
import { AyahBookmarksScreen } from "./AyahBookmarksScreen";
import { Logo } from "../Logo";
import { Segmented } from "../components/ui";
import type { Route } from "../navigation";

type Filter = "all" | "meccan" | "medinan" | "favorites";
type View = "surah" | "bookmarks";

/** Mockup panel 3: Surah List. The real `surahs` table has no separate
 * English-meaning gloss column (name_en is already a transliteration, e.g.
 * "Al-Fatiha") -- so unlike the mockup's "Al-Fatihah / The Opening"
 * two-line layout, this screen shows the transliterated name plus the
 * Arabic script name, never an invented English gloss. */
export function SurahListScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { d } = useI18n();
  const { db } = useDb();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("surah");
  const lastReadSurah = getReadingPosition()?.surahNumber ?? null;
  const [, forceRender] = useState(0);

  const allSurahs = useMemo(() => listSurahs(db), [db]);
  const favorites = getFavoriteSurahs();

  const filtered = allSurahs.filter((s) => {
    if (filter === "favorites" && !favorites.has(s.number)) return false;
    if (filter === "meccan" && s.revelation_type !== "meccan") return false;
    if (filter === "medinan" && s.revelation_type !== "medinan") return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesName = s.name_en.toLowerCase().includes(q) || s.name_ar.includes(search);
      const matchesNumber = String(s.number) === search.trim();
      if (!matchesName && !matchesNumber) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="appbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo showWordmark={false} size={28} />
          <h1 className="appbar-title">{d.reader.surahs}</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="icon-btn icon-btn-bordered"
            type="button"
            aria-label={d.bookmarks.title}
            onClick={() => onNavigate({ screen: "ayah-bookmarks" })}
          >
            <BookmarkCheck size={18} />
          </button>
          <button
            className="back-button"
            type="button"
            onClick={() => onNavigate({ screen: "word-list" })}
          >
            {d.reader.words}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Segmented
          label={d.surahList.viewSwitch}
          testId="surah-view"
          value={view}
          onChange={setView}
          options={[
            { value: "surah", label: d.surahList.surahTab },
            { value: "bookmarks", label: d.surahList.bookmarksTab },
          ]}
        />
      </div>

      {view === "bookmarks" ? (
        <AyahBookmarksScreen embedded onNavigate={onNavigate} onBack={() => setView("surah")} />
      ) : (
        <>
          <div className="search-field" style={{ marginBottom: 12 }}>
            <Search size={18} aria-hidden="true" />
            <input
              className="input"
              type="text"
              inputMode="search"
              enterKeyHint="search"
              aria-label={d.reader.search}
              placeholder={d.reader.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 12, overflowX: "auto" }}>
            <Segmented
              label={d.reader.surahs}
              testId="surah-filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: d.reader.filterAll },
                { value: "meccan", label: d.reader.filterMakki },
                { value: "medinan", label: d.reader.filterMadani },
                { value: "favorites", label: d.reader.favoritesOnly },
              ]}
            />
          </div>

          <div className="card" style={{ padding: 0 }}>
            {filtered.map((s) => (
              <div
                key={s.number}
                className={`list-row surah-row${s.number === lastReadSurah ? " row-last-read" : ""}`}
                style={{ padding: "12px 12px" }}
                data-last-read={s.number === lastReadSurah ? "true" : undefined}
              >
                <button
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minWidth: 0,
                    minHeight: 44,
                    flex: "1 1 8rem",
                    background: "none",
                    border: "none",
                    color: "inherit",
                    font: "inherit",
                    textAlign: "start",
                    cursor: "pointer",
                  }}
                  onClick={() => onNavigate({ screen: "reading", surahNumber: s.number })}
                >
                  <span className="surah-hex" aria-hidden="true">
                    <span>{s.number}</span>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                      {s.name_en}
                      {s.number === lastReadSurah && (
                        <span className="chip chip-gold" style={{ marginInlineStart: 8 }}>
                          {d.surahList.lastRead}
                        </span>
                      )}
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                      {s.ayah_count} ·{" "}
                      {s.revelation_type === "meccan"
                        ? d.reader.filterMakki
                        : d.reader.filterMadani}
                    </div>
                  </div>
                </button>
                <span className="arabic-text" style={{ fontSize: "1.1rem", flexShrink: 0 }}>
                  {s.name_ar}
                </span>
                {s.number === lastReadSurah && (
                  <ChevronRight size={18} className="row-chevron dir-icon" aria-hidden="true" />
                )}
                <button
                  type="button"
                  className="hit-44"
                  aria-label={favorites.has(s.number) ? d.reader.unfavorite : d.reader.favorite}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    color: favorites.has(s.number) ? "var(--gold)" : "var(--muted-foreground)",
                    flexShrink: 0,
                  }}
                  onClick={() => {
                    toggleFavoriteSurah(s.number);
                    forceRender((n) => n + 1);
                  }}
                >
                  <Bookmark size={18} fill={favorites.has(s.number) ? "currentColor" : "none"} />
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-muted" style={{ padding: 16, textAlign: "center" }}>
                {d.reader.noResults}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

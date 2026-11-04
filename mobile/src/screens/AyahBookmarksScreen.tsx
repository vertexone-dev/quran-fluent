import { useState } from "react";
import { BookmarkX } from "lucide-react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { getAyah, listSurahs } from "../db";
import { getAyahBookmarks, toggleAyahBookmark } from "../local-store";
import { AppBar } from "../AppBar";
import type { Route } from "../navigation";

/** Sprint 2, Feature A: the discoverable list of saved ayah-level
 * bookmarks, reached from the Surah List's app bar. Deliberately a
 * separate screen from Surah List's own Favorites filter -- that filters
 * whole surahs via getFavoriteSurahs/toggleFavoriteSurah (SurahListScreen),
 * a different scope and a different storage key from the ayah-level
 * bookmarks here, so the two are never merged into one list or one toggle
 * even though both use a bookmark-shaped icon. */
export function AyahBookmarksScreen({
  onNavigate,
  onBack,
}: {
  onNavigate: (route: Route) => void;
  onBack: () => void;
}) {
  const { d } = useI18n();
  const { db } = useDb();
  const [, forceRender] = useState(0);

  const surahs = listSurahs(db);
  const bookmarks = [...getAyahBookmarks()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div>
      <AppBar title={d.bookmarks.title} onBack={onBack} />
      <div className="card" style={{ padding: 0 }}>
        {bookmarks.map((b) => {
          const surah = surahs.find((s) => s.number === b.surahNumber);
          const ayah = getAyah(db, b.surahNumber, b.ayahNumber);
          return (
            <div
              key={`${b.surahNumber}:${b.ayahNumber}`}
              className="list-row"
              style={{ padding: "12px" }}
            >
              <button
                type="button"
                data-testid="bookmark-open"
                style={{
                  minWidth: 0,
                  flex: 1,
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  color: "inherit",
                  font: "inherit",
                  textAlign: "left",
                }}
                onClick={() =>
                  onNavigate({
                    screen: "reading",
                    surahNumber: b.surahNumber,
                    targetAyahNumber: b.ayahNumber,
                  })
                }
              >
                <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                  {surah?.name_en ?? b.surahNumber} &middot; {d.reader.ayah} {b.ayahNumber}
                </div>
                {ayah && (
                  <div
                    className="arabic-text text-muted"
                    style={{
                      fontSize: "1rem",
                      marginTop: 4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {ayah.arabic_text}
                  </div>
                )}
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={d.bookmarks.remove}
                onClick={() => {
                  toggleAyahBookmark(b.surahNumber, b.ayahNumber);
                  forceRender((n) => n + 1);
                }}
              >
                <BookmarkX size={18} />
              </button>
            </div>
          );
        })}
        {bookmarks.length === 0 && (
          <div className="text-muted" style={{ padding: 16, textAlign: "center" }}>
            {d.bookmarks.empty}
          </div>
        )}
      </div>
    </div>
  );
}

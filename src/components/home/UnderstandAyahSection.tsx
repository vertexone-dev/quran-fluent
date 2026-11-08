import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Feather } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentState, GlassPanel, GOLD, SectionHeading } from "@/design/primitives";
import { fetchAyahsWithTranslations, fetchSurah, surahName } from "@/lib/quran";
import { useI18n } from "@/lib/i18n";

// QR-INT-006: homepage "Understand This Ayah". The ayah (Al-Fatihah 1:2),
// its translation and translator come from the canonical content tables via
// the existing lib/quran.ts services. Word-by-word and tafsir show an honest
// "awaiting a verified source" state: no explanatory text is authored here.
const SURAH = 1;
const AYAH = 2;

const TAB =
  "rounded-full px-4 py-2 text-sm text-white/80 data-[state=active]:bg-[oklch(0.767_0.139_91.1)] data-[state=active]:text-[oklch(0.2_0.035_195.1)] data-[state=active]:shadow-none";
const LINK =
  "inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/10";

export function UnderstandAyahSection() {
  const { t, d, locale } = useI18n();
  const u = d.home.understand;
  const query = useQuery({
    queryKey: ["home-understand", SURAH, AYAH, locale],
    queryFn: async ({ signal }) => {
      const [surah, ayahs] = await Promise.all([
        fetchSurah(SURAH),
        fetchAyahsWithTranslations(SURAH, locale, signal),
      ]);
      return { surah, ayah: ayahs.find((a) => a.ayah_number === AYAH) ?? null };
    },
    retry: 1,
  });
  const ayah = query.data?.ayah ?? null;
  const surah = query.data?.surah ?? null;

  return (
    <section
      className="section-py-normal mx-auto max-w-6xl px-4"
      aria-labelledby="understand-ayah"
      data-testid="home-understand-section"
    >
      <SectionHeading id="understand-ayah" eyebrow={u.eyebrow} title={u.title} body={u.body} />
      <GlassPanel className="mt-8 grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div
          className="flex min-h-[220px] flex-col justify-center rounded-2xl border border-[oklch(0.767_0.139_91.1/0.3)] bg-black/15 p-5 sm:p-7"
          data-testid="understand-ayah-card"
        >
          {query.isPending ? (
            <ContentState kind="loading" message={u.loading} />
          ) : query.isError || !ayah ? (
            <ContentState
              kind="error"
              message={u.error}
              action={
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className={LINK}
                  style={{ borderColor: GOLD }}
                  data-testid="understand-retry-button"
                >
                  {u.retry}
                </button>
              }
            />
          ) : (
            <>
              <p
                className="text-quran text-center text-white"
                lang="ar"
                dir="rtl"
                data-testid="understand-arabic"
              >
                {ayah.arabic_text}
              </p>
              <p
                className="mt-4 text-center text-sm"
                style={{ color: GOLD }}
                data-testid="understand-reference"
              >
                {t("home.understand.reference", {
                  surah: surah ? surahName(surah, locale) : String(SURAH),
                  surahNumber: String(SURAH),
                  ayah: String(AYAH),
                })}
              </p>
            </>
          )}
        </div>

        <Tabs defaultValue="meaning" className="min-w-0">
          <TabsList className="h-auto flex-wrap gap-1 rounded-full bg-white/10 p-1">
            <TabsTrigger value="meaning" className={TAB} data-testid="understand-tab-meaning">
              {u.tabs.meaning}
            </TabsTrigger>
            <TabsTrigger value="words" className={TAB} data-testid="understand-tab-words">
              {u.tabs.words}
            </TabsTrigger>
            <TabsTrigger value="tafsir" className={TAB} data-testid="understand-tab-tafsir">
              {u.tabs.tafsir}
            </TabsTrigger>
            <TabsTrigger value="reflect" className={TAB} data-testid="understand-tab-reflect">
              {u.tabs.reflect}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meaning" className="mt-5" data-testid="understand-panel-meaning">
            {ayah?.resolvedTranslation ? (
              <figure>
                <blockquote className="text-lg leading-relaxed text-white/90">
                  {ayah.resolvedTranslation}
                </blockquote>
                {ayah.translationSource ? (
                  <figcaption className="mt-3 text-xs text-white/70">
                    {d.quran.reader.attribution.label.replace(
                      "{translator}",
                      ayah.translationSource.translator,
                    )}
                  </figcaption>
                ) : null}
              </figure>
            ) : ayah ? (
              <ContentState kind="unavailable" message={d.quran.reader.translationUnavailable} />
            ) : (
              <ContentState
                kind={query.isPending ? "loading" : "error"}
                message={query.isPending ? u.loading : u.error}
              />
            )}
            <Link
              to="/quran"
              search={{ surah: SURAH, ayah: AYAH }}
              className={`${LINK} mt-5`}
              style={{ borderColor: GOLD }}
              data-testid="understand-open-reader"
            >
              <BookOpen className="size-4" aria-hidden />
              {u.openReader}
            </Link>
          </TabsContent>

          <TabsContent value="words" className="mt-5">
            <ContentState
              kind="unavailable"
              message={u.wordsUnavailable}
              action={
                <Link to="/practice" className={LINK} style={{ borderColor: GOLD }}>
                  {u.wordsCta}
                </Link>
              }
            />
          </TabsContent>

          <TabsContent value="tafsir" className="mt-5">
            <ContentState kind="unavailable" message={u.tafsirUnavailable} />
          </TabsContent>

          <TabsContent value="reflect" className="mt-5">
            <p className="font-display text-xl text-white">{u.reflectPrompt}</p>
            <Link
              to="/reflect"
              className={`${LINK} mt-5`}
              style={{ borderColor: GOLD }}
              data-testid="understand-reflect-link"
            >
              <Feather className="size-4" aria-hidden />
              {u.reflectCta}
            </Link>
          </TabsContent>
        </Tabs>
      </GlassPanel>
    </section>
  );
}

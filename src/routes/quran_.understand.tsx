import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { z } from "zod";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AudioMiniPlayer } from "@/components/quran/AudioMiniPlayer";
import { AyahPlayButton } from "@/components/quran/AyahPlayButton";
import { TranslationComparison } from "@/components/understand/TranslationComparison";
import { Skeleton } from "@/components/ui/skeleton";
import { CinematicButton } from "@/design/CinematicButton";
import {
  CinematicTabs,
  CinematicTabsContent,
  CinematicTabsList,
  CinematicTabsTrigger,
} from "@/design/CinematicTabs";
import { ContentState, GlassPanel, SectionHeading } from "@/design/primitives";
import { VerseFrame } from "@/design/VerseFrame";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useI18n } from "@/lib/i18n";
import { fetchAyahsWithTranslations, fetchSurahs, surahName, type Surah } from "@/lib/quran";

// QR-INT-007 (Milestone C): public "Understand this Ayah" page at
// /quran/understand?surah=&ayah=. The trailing underscore opts out of nesting
// under /quran (whose component has no <Outlet />). Search params use .catch
// so malformed values are dropped instead of erroring. Content integrity:
// Arabic and translations come only from src/lib/quran.ts; words, tafsir and
// context have no approved source yet and show explicit unavailable states.
const searchSchema = z.object({
  surah: z.number().int().positive().optional().catch(undefined),
  ayah: z.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/quran_/understand")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Understand this Ayah — QuranRoots" },
      {
        name: "description",
        content:
          "Study one Ayah: the Arabic as stored, verified English and French translations with their sources, and honest notes on what still awaits a verified source.",
      },
    ],
  }),
  component: UnderstandPage,
});

type Ref = { surah: number; ayah: number };

/** Previous / next āyah across Surah boundaries, from the database's own
 * surah rows (number + ayah_count) -- no hard-coded 114/6236 limits. */
function neighbours(surahs: Surah[], ref: Ref): { prev: Ref | null; next: Ref | null } {
  const i = surahs.findIndex((s) => s.number === ref.surah);
  const current = surahs[i];
  if (i < 0 || !current) return { prev: null, next: null };
  const before = surahs[i - 1];
  const after = surahs[i + 1];
  const prev =
    ref.ayah > 1
      ? { surah: ref.surah, ayah: ref.ayah - 1 }
      : before
        ? { surah: before.number, ayah: before.ayah_count }
        : null;
  const next =
    ref.ayah < current.ayah_count
      ? { surah: ref.surah, ayah: ref.ayah + 1 }
      : after
        ? { surah: after.number, ayah: 1 }
        : null;
  return { prev, next };
}

function UnderstandPage() {
  const { d, locale } = useI18n();
  const u = d.quran.understand;
  const online = useOnlineStatus();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/quran/understand" });
  const ref: Ref = { surah: search.surah ?? 1, ayah: search.ayah ?? 1 };

  const surahsQuery = useQuery({
    queryKey: ["surahs"],
    queryFn: ({ signal }) => fetchSurahs(signal),
  });
  const surahs = surahsQuery.data ?? [];
  const surah = surahs.find((s) => s.number === ref.surah);
  const exists = Boolean(surah && ref.ayah <= surah.ayah_count);

  const english = useQuery({
    queryKey: ["understand-ayahs", ref.surah, "en"],
    queryFn: ({ signal }) => fetchAyahsWithTranslations(ref.surah, "en", signal, null),
    enabled: exists,
  });
  const french = useQuery({
    queryKey: ["understand-ayahs", ref.surah, "fr"],
    queryFn: ({ signal }) => fetchAyahsWithTranslations(ref.surah, "fr", signal, null),
    enabled: exists,
  });
  const enAyah = english.data?.find((a) => a.ayah_number === ref.ayah);
  const frAyah = french.data?.find((a) => a.ayah_number === ref.ayah);
  const { prev, next } = neighbours(surahs, ref);
  const go = (to: Ref) => void navigate({ search: to });
  const label = surah
    ? `${surahName(surah, locale)} ${ref.surah}:${ref.ayah}`
    : `${ref.surah}:${ref.ayah}`;
  const failed = surahsQuery.isError || english.isError;
  const loading = surahsQuery.isLoading || (exists && english.isLoading);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main
        className="section-py-normal mx-auto w-full max-w-5xl flex-1 px-4 pb-32"
        data-testid="understand-page"
      >
        <SectionHeading id="understand-title" eyebrow={u.eyebrow} title={u.title} body={u.intro} />

        <div className="mt-8 space-y-6">
          {failed ? (
            <ContentState
              tone="theme"
              kind={online ? "error" : "offline"}
              message={online ? u.error : d.quran.readerUi.offline}
              action={
                <CinematicButton
                  variant="gold"
                  size="sm"
                  onClick={() => {
                    void surahsQuery.refetch();
                    void english.refetch();
                    void french.refetch();
                  }}
                >
                  {u.retry}
                </CinematicButton>
              }
            />
          ) : loading ? (
            <Skeleton className="h-56 w-full rounded-[28px]" data-testid="understand-loading" />
          ) : !exists ? (
            <ContentState tone="theme" kind="unavailable" message={u.notFound} />
          ) : !enAyah ? (
            <ContentState tone="theme" kind="empty" message={d.quran.readerUi.empty} />
          ) : (
            <VerseFrame size="lg" label={label} data-testid="understand-ayah">
              <p
                className="text-quran mt-6 text-right text-3xl leading-[2.2] text-[oklch(0.97_0.012_85)] sm:text-5xl"
                dir="rtl"
                lang="ar"
                data-testid="understand-arabic"
              >
                {enAyah.arabic_text}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4 [&_button]:text-white">
                <AyahPlayButton surahNumber={ref.surah} ayahNumber={ref.ayah} />
                <CinematicButton variant="ghost" size="sm" asChild>
                  <Link
                    to="/quran"
                    search={{ surah: ref.surah, ayah: ref.ayah }}
                    data-testid="understand-open-reader"
                  >
                    <BookOpenText aria-hidden />
                    {u.openReader}
                  </Link>
                </CinematicButton>
                <CinematicButton variant="ghost" size="sm" asChild>
                  <Link
                    to="/reflect"
                    search={{ surah: ref.surah, ayah: ref.ayah }}
                    data-testid="understand-reflect"
                  >
                    <Sparkles aria-hidden />
                    {u.reflect}
                  </Link>
                </CinematicButton>
              </div>
            </VerseFrame>
          )}

          <nav
            aria-label={d.quran.readerUi.toolbarLabel}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <CinematicButton
              variant="ghost"
              size="md"
              disabled={!prev}
              onClick={() => prev && go(prev)}
              data-testid="understand-prev"
            >
              <ChevronLeft className="dir-icon" aria-hidden />
              {u.prev}
            </CinematicButton>
            <CinematicButton
              variant="ghost"
              size="md"
              disabled={!next}
              onClick={() => next && go(next)}
              data-testid="understand-next"
            >
              {u.next}
              <ChevronRight className="dir-icon" aria-hidden />
            </CinematicButton>
          </nav>

          {exists && enAyah && !failed && !loading && (
            <GlassPanel className="p-4 sm:p-6">
              <CinematicTabs defaultValue="translations" dir={locale === "ar" ? "rtl" : "ltr"}>
                <CinematicTabsList aria-label={u.title}>
                  {(["translations", "words", "tafsir", "context"] as const).map((tab) => (
                    <CinematicTabsTrigger
                      key={tab}
                      value={tab}
                      data-testid={`understand-tab-${tab}`}
                    >
                      {u.tabs[tab]}
                    </CinematicTabsTrigger>
                  ))}
                </CinematicTabsList>
                <CinematicTabsContent value="translations" className="mt-5">
                  <TranslationComparison
                    english={enAyah}
                    french={frAyah}
                    frenchLoading={french.isLoading}
                  />
                </CinematicTabsContent>
                <CinematicTabsContent value="words" className="mt-5">
                  <ContentState kind="unavailable" message={u.wordsUnavailable} />
                </CinematicTabsContent>
                <CinematicTabsContent value="tafsir" className="mt-5">
                  <ContentState kind="unavailable" message={u.tafsirUnavailable} />
                </CinematicTabsContent>
                <CinematicTabsContent value="context" className="mt-5">
                  <ContentState kind="unavailable" message={u.contextUnavailable} />
                </CinematicTabsContent>
              </CinematicTabs>
            </GlassPanel>
          )}
        </div>
      </main>
      <AudioMiniPlayer />
      <SiteFooter />
    </div>
  );
}

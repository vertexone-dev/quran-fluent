import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ayahAudioPlayer } from "@/lib/audio";
import { useAyahAudioState, usePreferredReciter } from "@/components/quran/AyahPlayButton";
import {
  fetchAyahsWithTranslations,
  fetchSurah,
  fetchSurahs,
  surahName,
  type ResolvedAyah,
  type Surah,
} from "@/lib/quran";
import {
  addToReview,
  countDueMemorizationReviews,
  fetchMemorizationProgress,
  fetchSurahProgress,
  markMemorized,
  mostRecentSurah,
  startLearning,
  type MemorizationProgress,
} from "@/lib/memorization";

const searchSchema = z.object({
  surah: z.number().int().positive().optional(),
  ayah: z.number().int().positive().optional(),
});

export const Route = createFileRoute("/_authenticated/memorize")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Memorize (Hifz) — QuranRoots" },
      {
        name: "description",
        content: "Listen, repeat, hide and recite with structured Hifz tools.",
      },
      { property: "og:title", content: "Memorize (Hifz) — QuranRoots" },
      {
        property: "og:description",
        content: "A dedicated memorization workflow with review scheduling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Memorize,
});

const REPEAT_OPTIONS = [1, 3, 5, 10] as const;

function Memorize() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  if (!user) return null;

  if (search.surah) {
    return (
      <MemorizeSession
        userId={user.id}
        surahNumber={search.surah}
        initialAyah={search.ayah}
        onExit={() => void navigate({ search: {} })}
      />
    );
  }

  return <MemorizeOverview userId={user.id} />;
}

function MemorizeOverview({ userId }: { userId: string }) {
  const { d, locale } = useI18n();
  const navigate = useNavigate({ from: Route.fullPath });
  const m = d.memorization;

  const { data: surahs, isLoading: surahsLoading } = useQuery({
    queryKey: ["surahs"],
    queryFn: ({ signal }) => fetchSurahs(signal),
  });
  const { data: progress } = useQuery({
    queryKey: ["memorization-progress", userId],
    queryFn: () => fetchMemorizationProgress(userId),
  });
  const { data: surahProgress, isLoading: progressLoading } = useQuery({
    queryKey: ["surah-progress", userId, surahs?.length],
    queryFn: () => fetchSurahProgress(userId, surahs!),
    enabled: Boolean(surahs),
  });
  const { data: dueCount } = useQuery({
    queryKey: ["memorization-due-count", userId],
    queryFn: () => countDueMemorizationReviews(userId),
  });

  const memorizedTotal = surahProgress?.reduce((sum, s) => sum + s.memorizedCount, 0) ?? 0;
  const continueSurah = progress ? mostRecentSurah(progress) : null;
  const continueSurahRow = surahs?.find((s) => s.number === continueSurah);
  const loading = surahsLoading || progressLoading;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{m.title}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{m.intro}</p>

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card className="shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{m.overview.continueTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                {continueSurahRow ? (
                  <Button
                    className="w-full"
                    onClick={() => void navigate({ search: { surah: continueSurahRow.number } })}
                  >
                    {m.overview.continueCta.replace("{surah}", surahName(continueSurahRow, locale))}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">{m.overview.continueEmpty}</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{m.overview.dueTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dueCount ? (
                  <>
                    <p className="text-2xl font-bold">
                      {m.overview.dueCount.replace("{count}", String(dueCount))}
                    </p>
                    <Button variant="secondary" size="sm" asChild>
                      <Link to="/practice">{d.learning.practice.today.start}</Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{m.overview.dueEmpty}</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{m.overview.memorizedTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {m.overview.memorizedCount.replace("{count}", String(memorizedTotal))}
                </p>
              </CardContent>
            </Card>
          </div>

          <h2 className="mt-10 font-display text-xl font-bold">{m.overview.surahProgressTitle}</h2>
          <div className="mt-4 space-y-3">
            {(surahProgress ?? []).map(({ surah, memorizedCount }) => (
              <Card key={surah.number} className="shadow-soft">
                <CardContent className="flex items-center justify-between gap-4 pt-6">
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold">{surahName(surah, locale)}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.overview.ayahCount
                        .replace("{memorized}", String(memorizedCount))
                        .replace("{total}", String(surah.ayah_count))}
                    </p>
                    <Progress value={(memorizedCount / surah.ayah_count) * 100} className="mt-2" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void navigate({ search: { surah: surah.number } })}
                  >
                    {m.overview.startSurah}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function MemorizeSession({
  userId,
  surahNumber,
  initialAyah,
  onExit,
}: {
  userId: string;
  surahNumber: number;
  initialAyah?: number | undefined;
  onExit: () => void;
}) {
  const { d, locale, t } = useI18n();
  const queryClient = useQueryClient();
  const m = d.memorization;

  const { data: surah } = useQuery({
    queryKey: ["surah", surahNumber],
    queryFn: () => fetchSurah(surahNumber),
  });
  const {
    data: ayahs,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["ayahs", surahNumber, locale],
    queryFn: ({ signal }) => fetchAyahsWithTranslations(surahNumber, locale, signal),
  });
  const { data: progress } = useQuery({
    queryKey: ["memorization-progress", userId],
    queryFn: () => fetchMemorizationProgress(userId),
  });

  const [index, setIndex] = useState(0);
  const [showArabic, setShowArabic] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [repeatTarget, setRepeatTarget] = useState<(typeof REPEAT_OPTIONS)[number]>(1);

  useEffect(() => {
    if (!ayahs || initialAyah == null) return;
    const i = ayahs.findIndex((a) => a.ayah_number === initialAyah);
    if (i >= 0) setIndex(i);
  }, [ayahs, initialAyah]);

  const current: ResolvedAyah | undefined = ayahs?.[index];
  const currentProgress = useMemo<MemorizationProgress | undefined>(
    () =>
      progress?.find(
        (p) => p.surah_number === surahNumber && p.ayah_number === current?.ayah_number,
      ),
    [progress, surahNumber, current],
  );
  const status = currentProgress?.status ?? "not_started";

  function invalidateProgress() {
    void queryClient.invalidateQueries({ queryKey: ["memorization-progress", userId] });
    void queryClient.invalidateQueries({ queryKey: ["memorization-due-count", userId] });
    void queryClient.invalidateQueries({ queryKey: ["surah-progress", userId] });
  }

  const startLearningMutation = useMutation({
    mutationFn: () => startLearning(userId, surahNumber, current!.ayah_number),
    onSuccess: invalidateProgress,
    onError: () => toast.error(m.toast.actionFailed),
  });
  const markMemorizedMutation = useMutation({
    mutationFn: () => markMemorized(userId, current!),
    onSuccess: ({ reviewScheduled }) => {
      toast.success(reviewScheduled ? m.toast.memorized : m.toast.memorizedNoTranslation);
      invalidateProgress();
    },
    onError: () => toast.error(m.toast.actionFailed),
  });
  const addToReviewMutation = useMutation({
    mutationFn: () => addToReview(userId, current!),
    onSuccess: ({ reviewScheduled }) => {
      toast.success(reviewScheduled ? m.toast.addedToReview : m.toast.addedToReviewNoTranslation);
      invalidateProgress();
    },
    onError: () => toast.error(m.toast.actionFailed),
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Button variant="ghost" size="sm" onClick={onExit}>
        <ChevronLeft className="size-4" aria-hidden />
        {t("common.actions.back")}
      </Button>

      {isLoading && <Skeleton className="mt-6 h-64 w-full" />}

      {isError && (
        <Card className="mt-6 shadow-soft">
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-muted-foreground">{m.error.title}</p>
            <Button variant="secondary" onClick={() => void refetch()}>
              {m.error.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && current && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold">
              {surah ? surahName(surah, locale) : ""}
            </h1>
            <Badge variant="outline">{m.status[status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.quran.reader.ayahLabel.replace("{number}", String(current.ayah_number))} ·{" "}
            {current.ayah_number} / {surah?.ayah_count ?? "…"}
          </p>

          <Card className="mt-6 shadow-elevated">
            <CardContent className="min-h-56 space-y-4 pt-8 text-center">
              {showArabic ? (
                <p
                  className="text-quran text-3xl leading-loose text-foreground"
                  dir="rtl"
                  lang="ar"
                >
                  {current.arabic_text}
                </p>
              ) : (
                <Button variant="ghost" onClick={() => setShowArabic(true)}>
                  <Eye className="size-4" aria-hidden />
                  {m.controls.showArabic}
                </Button>
              )}
              {showTranslation ? (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {current.resolvedTranslation ?? d.quran.reader.translationUnavailable}
                  </p>
                  {current.translationSource && (
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      {d.quran.reader.attribution.label.replace(
                        "{translator}",
                        current.translationSource.translator,
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowTranslation(true)}>
                  <Eye className="size-4" aria-hidden />
                  {m.controls.showTranslation}
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowArabic((v) => !v)}>
              {showArabic ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
              {showArabic ? m.controls.hideArabic : m.controls.showArabic}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTranslation((v) => !v)}>
              {showTranslation ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
              {showTranslation ? m.controls.hideTranslation : m.controls.showTranslation}
            </Button>
          </div>

          <Card className="mt-4 shadow-soft">
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {REPEAT_OPTIONS.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={repeatTarget === n ? "default" : "outline"}
                    size="sm"
                    aria-pressed={repeatTarget === n}
                    onClick={() => setRepeatTarget(n)}
                  >
                    {n}×
                  </Button>
                ))}
              </div>
              <MemorizationAudioControls
                key={`${surahNumber}:${current.ayah_number}`}
                surahNumber={surahNumber}
                ayahNumber={current.ayah_number}
                repeatTarget={repeatTarget}
              />
            </CardContent>
          </Card>

          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="ghost"
              disabled={index === 0}
              onClick={() => {
                ayahAudioPlayer.stop();
                setIndex((i) => Math.max(0, i - 1));
              }}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {m.controls.previous}
            </Button>
            <Button
              variant="ghost"
              disabled={!ayahs || index >= ayahs.length - 1}
              onClick={() => {
                ayahAudioPlayer.stop();
                setIndex((i) => Math.min((ayahs?.length ?? 1) - 1, i + 1));
              }}
            >
              {m.controls.next}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {status !== "learning" && status !== "memorized" && (
              <Button
                variant="secondary"
                onClick={() => startLearningMutation.mutate()}
                disabled={startLearningMutation.isPending}
              >
                {m.controls.markLearning}
              </Button>
            )}
            <Button
              onClick={() => markMemorizedMutation.mutate()}
              disabled={markMemorizedMutation.isPending || status === "memorized"}
            >
              {m.controls.markMemorized}
            </Button>
            <Button
              variant="outline"
              onClick={() => addToReviewMutation.mutate()}
              disabled={addToReviewMutation.isPending}
            >
              {m.controls.addToReview}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

/**
 * Play / Pause / Replay for one āyah, driving `repeatTarget` total plays
 * through `ayahAudioPlayer` -- reusing the same singleton, provider
 * resolution and preferred-reciter loading gate as the Qur'an reader and
 * lessons (usePreferredReciter, exported from AyahPlayButton). No second
 * <audio> element and no separate player engine: the only new logic here
 * is the repeat-cycle bookkeeping (`cycleTarget` / `playsCompleted`),
 * which reacts to the player's own "ended" event rather than a timer.
 *
 * `cycleTarget` is a snapshot taken only when a fresh Play or Replay is
 * pressed -- changing the repeatTarget selector mid-cycle therefore never
 * alters the cycle already in flight, only the next one. Mounted with a
 * `key` scoped to (surah, āyah) by the caller, so switching āyah always
 * starts this component (and its cycle bookkeeping) fresh; the caller is
 * responsible for stopping the actual player on that same transition.
 */
function MemorizationAudioControls({
  surahNumber,
  ayahNumber,
  repeatTarget,
}: {
  surahNumber: number;
  ayahNumber: number;
  repeatTarget: number;
}) {
  const { d } = useI18n();
  const copy = d.quran.audio;
  const mCopy = d.memorization.controls;
  const state = useAyahAudioState();
  const { reciter, isReady } = usePreferredReciter();
  const [cycleTarget, setCycleTarget] = useState<number | null>(null);
  const [playsCompleted, setPlaysCompleted] = useState(0);

  const isActive = state.surahNumber === surahNumber && state.ayahNumber === ayahNumber;
  const status = isActive ? state.status : "idle";

  useEffect(() => {
    if (!isActive || cycleTarget == null) return;
    if (status === "ended") {
      const completed = playsCompleted + 1;
      setPlaysCompleted(completed);
      if (completed < cycleTarget) {
        void ayahAudioPlayer.restart(reciter, surahNumber, ayahNumber);
      } else {
        setCycleTarget(null);
      }
    } else if (status === "error") {
      // A failure mid-cycle stops the cycle -- the existing error state is
      // shown below, never an endless retry, and memorization progress is
      // a separate mutation entirely unaffected by playback outcome.
      setCycleTarget(null);
    }
  }, [isActive, status, cycleTarget, playsCompleted, reciter, surahNumber, ayahNumber]);

  function startCycle() {
    setPlaysCompleted(0);
    setCycleTarget(repeatTarget);
  }

  function handlePlayPauseClick() {
    if (status === "playing") {
      ayahAudioPlayer.pause();
      return;
    }
    if (isActive && status === "paused") {
      void ayahAudioPlayer.play(reciter, surahNumber, ayahNumber);
      return;
    }
    startCycle();
    // Same distinction AyahPlayButton makes: after a natural "ended", seek
    // back to 0 explicitly via restart() rather than relying on re-setting
    // the same src to implicitly reset playback position.
    if (isActive && status === "ended") {
      void ayahAudioPlayer.restart(reciter, surahNumber, ayahNumber);
    } else {
      void ayahAudioPlayer.play(reciter, surahNumber, ayahNumber);
    }
  }

  function handleReplayClick() {
    startCycle();
    void ayahAudioPlayer.restart(reciter, surahNumber, ayahNumber);
  }

  const isUnavailable = isActive && status === "error" && state.errorReason === "unavailable";
  const isBusy = status === "loading" || (status === "idle" && !isReady);
  const playPauseLabel = isBusy
    ? copy.loading
    : status === "playing"
      ? copy.pause
      : isActive && status === "error"
        ? isUnavailable
          ? copy.unavailable
          : copy.error
        : copy.play;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={playPauseLabel}
          title={playPauseLabel}
          disabled={isBusy || isUnavailable}
          onClick={handlePlayPauseClick}
        >
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : status === "playing" ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play
              className={isActive && status === "error" ? "size-4 text-destructive" : "size-4"}
              aria-hidden
            />
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={copy.restart}
          title={copy.restart}
          disabled={isBusy}
          onClick={handleReplayClick}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>
      {cycleTarget != null && (
        <span className="text-sm text-muted-foreground">
          {mCopy.repetitionOf
            .replace("{current}", String(Math.min(playsCompleted + 1, cycleTarget)))
            .replace("{total}", String(cycleTarget))}
        </span>
      )}
    </div>
  );
}

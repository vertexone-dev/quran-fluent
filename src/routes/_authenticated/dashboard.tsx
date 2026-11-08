import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactElement, type ReactNode } from "react";
import {
  BookMarked,
  Brain,
  Flame,
  GraduationCap,
  Library,
  NotebookPen,
  Repeat2,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/common/ProgressRing";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { findLevel1EntryPoint } from "@/lib/curriculum";
import {
  fetchLearnerSnapshot,
  LEARNER_SNAPSHOT_STALE_TIME_MS,
  resolveGreetingName,
} from "@/lib/learner";
import { fetchLearningPath, nextStep } from "@/lib/placement";
import { countDueReviews, getDailyStats, getWeakAreas, WEAK_AREA_LABEL_KEYS } from "@/lib/study";
import { fetchBookmarks } from "@/lib/bookmarks";
import { fetchNotes } from "@/lib/notes";
import { countDueMemorizationReviews, fetchMemorizationProgress } from "@/lib/memorization";
import { useDocumentTitle } from "@/lib/use-document-title";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — QuranRoots" },
      { name: "description", content: "Continue your Qur'anic Arabic journey where you left off." },
      { property: "og:title", content: "Your dashboard — QuranRoots" },
      { property: "og:description", content: "Your daily lessons, review queue and progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

// Presentation-only: translates a raw weak_areas.area value (always in
// English -- see SECTION_WEAK_AREAS in src/lib/study.ts) into the active
// locale via dashboard.weakAreas, without touching the stored row. Falls
// back to the raw value for anything not in WEAK_AREA_LABEL_KEYS (never
// expected, but safer than silently hiding the area from the learner).
function translateWeakArea(area: string, t: (key: string) => string): string {
  const key = WEAK_AREA_LABEL_KEYS[area];
  return key ? t(`dashboard.weakAreas.${key}`) : area;
}

/**
 * Understanding dimensions stay at zero until lesson, vocabulary and
 * memorization tracking ship in Phases 2-5. Nothing here is estimated.
 */
const UNDERSTANDING_KEYS = [
  "reading",
  "vocabulary",
  "grammar",
  "comprehension",
  "tajweed",
  "memorization",
] as const;

/* Dashboard banner primitives (QR-INT-006). Dark-glass surface: literal
   Ivory/Sand/Antique Gold, independent of the light/dark theme. */
function DashBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-[oklch(0.767_0.139_91.1/0.45)] px-2.5 py-0.5 text-xs font-medium text-[oklch(0.891_0.031_77)]">
      {children}
    </span>
  );
}

function GoldProgress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={`h-2 w-full overflow-hidden rounded-full bg-[oklch(0.5_0.08_186/0.35)] ${className ?? ""}`}
    >
      <div
        className="dash-progress-fill h-full rounded-full bg-[linear-gradient(90deg,oklch(0.65_0.12_88),oklch(0.85_0.12_92))]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function DashCta({ children }: { children: ReactElement }) {
  return (
    <Button
      asChild
      className="min-h-11 shrink-0 bg-[oklch(0.767_0.139_91.1)] font-semibold text-[oklch(0.2_0.04_190)] shadow-[0_0_20px_oklch(0.767_0.139_91.1/0.35)] hover:bg-[oklch(0.82_0.13_91)]"
    >
      {children}
    </Button>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, d, locale } = useI18n();
  const copy = d.dashboard;
  useDocumentTitle(copy.documentTitle);

  const { data, isLoading } = useQuery({
    queryKey: ["learner", user?.id],
    queryFn: () => fetchLearnerSnapshot(user!.id),
    enabled: Boolean(user?.id),
    staleTime: LEARNER_SNAPSHOT_STALE_TIME_MS,
  });

  const { data: path } = useQuery({
    queryKey: ["learning-path", user?.id],
    queryFn: () => fetchLearningPath(user!.id),
    enabled: Boolean(user?.id),
  });

  // Live, always-accurate ("Continue learning" must never point at an
  // already-completed lesson, even if the learner hasn't retaken
  // placement since finishing it — see findLevel1EntryPoint).
  const { data: lessonEntryPoint } = useQuery({
    queryKey: ["level1-entry-point", user?.id, locale],
    queryFn: () => findLevel1EntryPoint(user!.id, locale),
    enabled: Boolean(user?.id),
  });

  const { data: dailyStats } = useQuery({
    queryKey: ["daily-stats", user?.id],
    queryFn: () => getDailyStats(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: dueCount } = useQuery({
    queryKey: ["due-reviews", user?.id],
    queryFn: () => countDueReviews(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: weakAreas } = useQuery({
    queryKey: ["weak-areas", user?.id],
    queryFn: () => getWeakAreas(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: bookmarks } = useQuery({
    queryKey: ["bookmarks", user?.id],
    queryFn: () => fetchBookmarks(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: notes } = useQuery({
    queryKey: ["notes", user?.id],
    queryFn: () => fetchNotes(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: memorizationProgress } = useQuery({
    queryKey: ["memorization-progress", user?.id],
    queryFn: () => fetchMemorizationProgress(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: memorizationDue } = useQuery({
    queryKey: ["memorization-due-count", user?.id],
    queryFn: () => countDueMemorizationReviews(user!.id),
    enabled: Boolean(user?.id),
  });

  const pathCopy = d.learning.path;
  const recommended = nextStep(path ?? null);
  const recommendedMeta = recommended
    ? pathCopy.steps[recommended.step_key as keyof typeof pathCopy.steps]
    : null;

  const onboardingDone = data?.preferences?.onboarding_completed;

  useEffect(() => {
    if (data && onboardingDone === false) navigate({ to: "/onboarding", replace: true });
  }, [data, onboardingDone, navigate]);

  const firstName = resolveGreetingName(
    data?.profile?.first_name ?? data?.profile?.display_name,
    copy.friend,
  );
  const dailyGoal = data?.preferences?.daily_goal_minutes ?? 10;
  const level = data?.preferences?.arabic_level;
  const goal = data?.preferences?.primary_goal;

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <Skeleton className="h-10 w-72" />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 lg:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      {/* QR-INT-006 milestone 1: cinematic banner band. Everything inside is
          the same real learner data the dashboard already showed (greeting,
          streak, current lesson + its real completed/total, plan) -- only
          the presentation changed. Theme-independent dark glass over the
          Emergent night artwork (see docs/QR-INT-006-ASSET-SOURCES.md).
          The header keeps its flex-col -> sm:flex-row pattern: stacked
          below sm: so the greeting wraps instead of clipping at 390px. */}
      <div className="dash-banner shadow-elevated relative isolate overflow-hidden rounded-3xl border border-gold/30 p-4 sm:p-8 sm:pt-10">
        <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-start gap-4 duration-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold sm:text-4xl">
              {t("dashboard.greeting", { name: firstName })}
            </h1>
            <p className="mt-1 text-[oklch(0.891_0.031_77)]">{copy.subtitle}</p>
          </div>
          <div className="dash-glass flex shrink-0 items-center gap-2 px-3 py-2">
            <Flame className="size-5 text-[oklch(0.767_0.139_91.1)]" aria-hidden />
            <div className="text-sm">
              <div className="font-semibold">
                {t("dashboard.streak", { count: data?.streak?.current_streak ?? 0 })}
              </div>
              <div className="text-xs text-[oklch(0.891_0.031_77)]">
                {t("dashboard.longest", { count: data?.streak?.longest_streak ?? 0 })}
              </div>
            </div>
          </div>
        </header>

        <div className="mt-8 grid gap-4 sm:mt-20 lg:grid-cols-3">
          <section
            className="dash-glass animate-in fade-in slide-in-from-bottom-3 border-s-4 border-s-[oklch(0.767_0.139_91.1)] p-5 delay-150 duration-700 fill-mode-backwards lg:col-span-2"
            aria-labelledby="continue-learning"
          >
            <h2 id="continue-learning" className="text-base font-semibold">
              {copy.continueLearning}
            </h2>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {lessonEntryPoint &&
                lessonEntryPoint.completedCount < lessonEntryPoint.totalCount ? (
                  <>
                    <DashBadge>{pathCopy.nextUp}</DashBadge>
                    <h3 className="mt-3 font-display text-xl font-semibold">
                      {lessonEntryPoint.title}
                    </h3>
                    <p className="mt-1 text-sm text-[oklch(0.891_0.031_77)]">
                      {d.learning.daily.lessonProgress
                        .replace("{completed}", String(lessonEntryPoint.completedCount))
                        .replace("{total}", String(lessonEntryPoint.totalCount))}
                    </p>
                    <GoldProgress
                      value={(lessonEntryPoint.completedCount / lessonEntryPoint.totalCount) * 100}
                      className="mt-4 max-w-sm"
                    />
                  </>
                ) : lessonEntryPoint ? (
                  <>
                    <DashBadge>{copy.today.path.title}</DashBadge>
                    <h3 className="mt-3 font-display text-xl font-semibold">
                      {d.learning.daily.allLessonsComplete}
                    </h3>
                  </>
                ) : recommended && recommendedMeta ? (
                  <>
                    <DashBadge>{pathCopy.nextUp}</DashBadge>
                    <h3 className="mt-3 font-display text-xl font-semibold">
                      {recommendedMeta.label}
                    </h3>
                    <p className="mt-1 text-sm text-[oklch(0.891_0.031_77)]">
                      {recommendedMeta.blurb}
                    </p>
                    <GoldProgress value={recommended.progress} className="mt-4 max-w-sm" />
                  </>
                ) : (
                  <>
                    <DashBadge>{d.learning.placement.optional}</DashBadge>
                    <h3 className="mt-3 font-display text-xl font-semibold">
                      {d.learning.placement.title}
                    </h3>
                    <p className="mt-1 text-sm text-[oklch(0.891_0.031_77)]">{pathCopy.noPath}</p>
                  </>
                )}
              </div>
              {lessonEntryPoint && lessonEntryPoint.completedCount < lessonEntryPoint.totalCount ? (
                <DashCta>
                  <Link to="/lesson/$lessonId" params={{ lessonId: lessonEntryPoint.lessonId }}>
                    {lessonEntryPoint.completedCount > 0
                      ? pathCopy.continueLesson
                      : pathCopy.openLesson}
                  </Link>
                </DashCta>
              ) : lessonEntryPoint ? (
                <DashCta>
                  <Link to="/learning-plan">{d.learning.daily.viewLearningPlan}</Link>
                </DashCta>
              ) : recommended ? (
                <DashCta>
                  <Link to="/learning-plan">{pathCopy.viewPath}</Link>
                </DashCta>
              ) : (
                <DashCta>
                  <Link to="/placement">{pathCopy.takeTest}</Link>
                </DashCta>
              )}
            </div>
          </section>

          <section
            className="dash-glass animate-in fade-in slide-in-from-bottom-3 p-5 delay-300 duration-700 fill-mode-backwards"
            aria-labelledby="your-plan"
          >
            <h2 id="your-plan" className="text-base font-semibold">
              {copy.yourPlan}
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-[oklch(0.767_0.139_91.1)]" aria-hidden />
                <span>{level ? t(`learning.levels.${level}.label`) : copy.levelNotSet}</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="size-4 text-[oklch(0.767_0.139_91.1)]" aria-hidden />
                <span>{goal ? t(`learning.goals.${goal}`) : copy.goalNotSet}</span>
              </div>
              <div className="flex items-center gap-2">
                <Repeat2 className="size-4 text-[oklch(0.767_0.139_91.1)]" aria-hidden />
                <span>{t("dashboard.minutesADay", { count: dailyGoal })}</span>
              </div>
              <Link
                to="/learning-plan"
                className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md border border-[oklch(0.767_0.139_91.1/0.5)] px-4 text-sm font-medium text-[oklch(0.974_0.01_87.5)] transition-colors hover:bg-[oklch(0.767_0.139_91.1/0.14)]"
              >
                {t("common.nav.learningPlan")}
              </Link>
            </div>
          </section>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="today">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="today" className="font-display text-xl font-bold">
            {copy.todayTitle}
          </h2>
          <Button size="sm" asChild>
            <Link to="/daily">{copy.startDaily}</Link>
          </Button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-soft hover:shadow-elevated h-full transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <Repeat2 className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-display text-base font-semibold">
                {copy.today.review.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("dashboard.reviewsDue", { count: dueCount ?? 0 })}
              </p>
              <Button variant="ghost" size="sm" className="mt-3 px-0" asChild>
                <Link to="/practice">{copy.today.review.cta}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-elevated h-full transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <Brain className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-display text-base font-semibold">{copy.today.weak.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {weakAreas && weakAreas.length > 0 && weakAreas[0]
                  ? translateWeakArea(weakAreas[0].area, t)
                  : copy.today.weak.none}
              </p>

              <Badge variant="outline" className="mt-3">
                {copy.today.weak.cta}
              </Badge>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-elevated h-full transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <Library className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-display text-base font-semibold">{copy.today.path.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {lessonEntryPoint ? lessonEntryPoint.title : copy.today.path.none}
              </p>
              <Badge variant="outline" className="mt-3">
                {copy.today.path.cta}
              </Badge>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-elevated h-full transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <Target className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-display text-base font-semibold">{copy.today.goal.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("dashboard.goalProgress", {
                  minutes: dailyStats?.minutes ?? 0,
                  target: dailyGoal,
                })}
              </p>
              <Progress
                value={Math.min(100, ((dailyStats?.minutes ?? 0) / dailyGoal) * 100)}
                className="mt-3"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="understanding">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="understanding" className="font-display text-xl font-bold">
            {copy.understandingTitle}
          </h2>
          <Badge variant="outline">{copy.awaiting}</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.understandingNote}</p>
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {UNDERSTANDING_KEYS.map((key) => (
            <ProgressRing key={key} value={0} label={copy.dimensions[key]} size={88} />
          ))}
        </div>
      </section>

      <section
        className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label={copy.activityLabel}
      >
        <Card className="shadow-soft hover:shadow-elevated h-full transition-all duration-300 hover:-translate-y-1">
          <CardContent className="pt-6">
            <Library className="size-5 text-primary" aria-hidden />
            <h3 className="mt-3 font-display text-base font-semibold">
              {copy.memorizationCard.title}
            </h3>
            {memorizationProgress && memorizationProgress.some((p) => p.status === "memorized") ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  {copy.memorizationCard.memorizedCount.replace(
                    "{count}",
                    String(memorizationProgress.filter((p) => p.status === "memorized").length),
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {copy.memorizationCard.dueCount.replace("{count}", String(memorizationDue ?? 0))}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{copy.memorizationCard.empty}</p>
            )}
            <Button variant="ghost" size="sm" className="mt-3 px-0" asChild>
              <Link to="/memorize">{t("common.actions.open")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-elevated h-full transition-all duration-300 hover:-translate-y-1">
          <CardContent className="pt-6">
            <BookMarked className="size-5 text-primary" aria-hidden />
            <h3 className="mt-3 font-display text-base font-semibold">
              {copy.bookmarksCard.title}
            </h3>
            {bookmarks && bookmarks.length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {d.bookmarks.count.replace("{count}", String(bookmarks.length))}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{copy.bookmarksCard.empty}</p>
            )}
            <Button variant="ghost" size="sm" className="mt-3 px-0" asChild>
              <Link to="/bookmarks">{t("common.actions.open")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-elevated h-full transition-all duration-300 hover:-translate-y-1">
          <CardContent className="pt-6">
            <NotebookPen className="size-5 text-primary" aria-hidden />
            <h3 className="mt-3 font-display text-base font-semibold">{copy.notesCard.title}</h3>
            {notes && notes.length > 0 ? (
              <p className="mt-1 truncate text-sm text-muted-foreground">{notes[0]?.content}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{copy.notesCard.empty}</p>
            )}
            <Button variant="ghost" size="sm" className="mt-3 px-0" asChild>
              <Link to="/notes">{t("common.actions.open")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

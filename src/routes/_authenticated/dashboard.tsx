import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
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
import { fetchLearnerSnapshot } from "@/lib/learner";
import { fetchLearningPath, nextStep } from "@/lib/placement";
import { countDueReviews, getDailyStats, getWeakAreas } from "@/lib/study";
import { fetchBookmarks } from "@/lib/bookmarks";
import { fetchNotes } from "@/lib/notes";
import { countDueMemorizationReviews, fetchMemorizationProgress } from "@/lib/memorization";

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

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, d } = useI18n();
  const copy = d.dashboard;

  const { data, isLoading } = useQuery({
    queryKey: ["learner", user?.id],
    queryFn: () => fetchLearnerSnapshot(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: path } = useQuery({
    queryKey: ["learning-path", user?.id],
    queryFn: () => fetchLearningPath(user!.id),
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

  const firstName = data?.profile?.first_name ?? data?.profile?.display_name ?? copy.friend;
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
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold sm:text-3xl">
            {t("dashboard.greeting", { name: firstName })}
          </h1>
          <p className="mt-1 text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Flame className="size-5 text-gold" aria-hidden />
          <div className="text-sm">
            <div className="font-semibold">
              {t("dashboard.streak", { count: data?.streak?.current_streak ?? 0 })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("dashboard.longest", { count: data?.streak?.longest_streak ?? 0 })}
            </div>
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{copy.continueLearning}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {recommended && recommendedMeta ? (
                  <>
                    <Badge variant="secondary">{pathCopy.nextUp}</Badge>
                    <h2 className="mt-3 font-display text-xl font-semibold">
                      {recommendedMeta.label}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{recommendedMeta.blurb}</p>
                    <Progress value={recommended.progress} className="mt-4 max-w-sm" />
                  </>
                ) : (
                  <>
                    <Badge variant="secondary">{d.learning.placement.optional}</Badge>
                    <h2 className="mt-3 font-display text-xl font-semibold">
                      {d.learning.placement.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{pathCopy.noPath}</p>
                  </>
                )}
              </div>
              {recommended ? (
                <Button className="shrink-0" asChild>
                  <Link to="/learning-plan">{pathCopy.viewPath}</Link>
                </Button>
              ) : (
                <Button className="shrink-0" asChild>
                  <Link to="/placement">{pathCopy.takeTest}</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{copy.yourPlan}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-4 text-primary" aria-hidden />
              <span>{level ? t(`learning.levels.${level}.label`) : copy.levelNotSet}</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="size-4 text-primary" aria-hidden />
              <span>{goal ? t(`learning.goals.${goal}`) : copy.goalNotSet}</span>
            </div>
            <div className="flex items-center gap-2">
              <Repeat2 className="size-4 text-primary" aria-hidden />
              <span>{t("dashboard.minutesADay", { count: dailyGoal })}</span>
            </div>
            <Button variant="secondary" className="mt-2 w-full" asChild>
              <Link to="/learning-plan">{t("common.nav.learningPlan")}</Link>
            </Button>
          </CardContent>
        </Card>
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
          <Card className="h-full">
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

          <Card className="h-full">
            <CardContent className="pt-6">
              <Brain className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-display text-base font-semibold">{copy.today.weak.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {weakAreas && weakAreas.length > 0 ? weakAreas[0]?.area : copy.today.weak.none}
              </p>

              <Badge variant="outline" className="mt-3">
                {copy.today.weak.cta}
              </Badge>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardContent className="pt-6">
              <Library className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-display text-base font-semibold">{copy.today.path.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {recommended && recommendedMeta ? recommendedMeta.label : copy.today.path.none}
              </p>
              <Badge variant="outline" className="mt-3">
                {copy.today.path.cta}
              </Badge>
            </CardContent>
          </Card>

          <Card className="h-full">
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
        <Card className="h-full">
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

        <Card className="h-full">
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

        <Card className="h-full">
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

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, Flame, Target, TrendingUp, Zap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fetchLearnerSnapshot } from "@/lib/learner";
import { getWeakAreas, getDailyStats } from "@/lib/study";
import { getVocabularyStats, getWeeklyStudyMinutes } from "@/lib/vocabulary";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Your progress — QuranRoots" },
      {
        name: "description",
        content: "Streaks, vocabulary mastery, reading level and study time.",
      },
      { property: "og:title", content: "Your progress — QuranRoots" },
      {
        property: "og:description",
        content: "Meaningful progress visualisations built from real activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProgressPage,
});

const STATUS_ORDER = ["new", "learning", "known", "mastered"] as const;

function ProgressPage() {
  const { user } = useAuth();
  const { t, d } = useI18n();
  const p = d.progress;

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ["learner", user?.id],
    queryFn: () => fetchLearnerSnapshot(user!.id),
    enabled: Boolean(user),
  });

  const { data: weakAreas } = useQuery({
    queryKey: ["weak-areas", user?.id],
    queryFn: () => getWeakAreas(user!.id),
    enabled: Boolean(user),
  });

  const { data: vocabStats } = useQuery({
    queryKey: ["vocabulary-stats", user?.id],
    queryFn: () => getVocabularyStats(user!.id),
    enabled: Boolean(user),
  });

  const { data: dailyStats } = useQuery({
    queryKey: ["daily-stats", user?.id],
    queryFn: () => getDailyStats(user!.id),
    enabled: Boolean(user),
  });

  const { data: weeklyMinutes } = useQuery({
    queryKey: ["weekly-minutes", user?.id],
    queryFn: () => getWeeklyStudyMinutes(user!.id),
    enabled: Boolean(user),
  });

  const streak = snapshot?.streak?.current_streak ?? 0;
  const dailyGoal = snapshot?.preferences?.daily_goal_minutes ?? 10;
  const level = snapshot?.preferences?.arabic_level;
  const goal = snapshot?.preferences?.primary_goal;

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <Skeleton className="h-10 w-48" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{p.title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{p.intro}</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Flame}
          label={p.metrics.currentStreak}
          value={t("dashboard.streak", { count: streak })}
          accent="text-gold"
        />
        <StatCard
          icon={Clock}
          label={p.weeklyMinutes}
          value={t("progress.minutes", { count: weeklyMinutes ?? 0 })}
          accent="text-sky-600"
        />
        <StatCard
          icon={TrendingUp}
          label={p.today}
          value={t("progress.minutes", { count: dailyStats?.minutes ?? 0 })}
          accent="text-emerald-600"
        />
        <StatCard
          icon={BookOpen}
          label={p.metrics.wordsLearned}
          value={String(vocabStats?.total ?? 0)}
          accent="text-primary"
        />
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-4 text-gold" aria-hidden />
              {p.weakAreas}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(weakAreas ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{p.weakAreasEmpty}</p>
            ) : (
              <ul className="space-y-4">
                {weakAreas!.map((area) => (
                  <li key={area.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{area.area}</span>
                      <Badge variant="outline">{area.strength}%</Badge>
                    </div>
                    <Progress value={area.strength} className="mt-2" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-primary" aria-hidden />
              {p.vocabularyTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(vocabStats?.total ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">{p.vocabularyEmpty}</p>
            ) : (
              <ul className="space-y-3">
                {STATUS_ORDER.map((status) => {
                  const count = vocabStats?.byStatus[status] ?? 0;
                  const percentage = vocabStats?.total ? (count / vocabStats.total) * 100 : 0;
                  const labelKey = status === "new" ? "unknown" : status;
                  return (
                    <li key={status}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {p.vocabulary[labelKey as keyof typeof p.vocabulary]}
                        </span>
                        <span className="font-medium">
                          {count} ({Math.round(percentage)}%)
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            status === "new" && "bg-muted-foreground",
                            status === "learning" && "bg-gold",
                            status === "known" && "bg-primary",
                            status === "mastered" && "bg-emerald-500",
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{p.level}</div>
            <div className="mt-1 font-display text-lg font-semibold">
              {level ? t(`learning.levels.${level}.label`) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{p.goal}</div>
            <div className="mt-1 font-display text-lg font-semibold">
              {goal ? t(`learning.goals.${goal}`) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{p.metrics.studyTime}</div>
            <div className="mt-1 font-display text-lg font-semibold">
              {t("progress.minutes", { count: dailyGoal })}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold">{value}</p>
          </div>
          <Icon className={cn("size-5", accent)} aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}

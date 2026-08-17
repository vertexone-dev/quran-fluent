import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PathTimeline } from "@/components/learning/PathTimeline";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fetchLearnerSnapshot } from "@/lib/learner";
import { fetchLearningPath } from "@/lib/placement";

export const Route = createFileRoute("/_authenticated/learning-plan")({
  head: () => ({
    meta: [
      { title: "My learning plan — QuranRoots" },
      { name: "description", content: "Your Arabic level, goal and daily study target." },
      { property: "og:title", content: "My learning plan — QuranRoots" },
      { property: "og:description", content: "Review and adjust your personalized plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LearningPlan,
});

function LearningPlan() {
  const { user } = useAuth();
  const { t, d } = useI18n();
  const plan = d.learning.plan;
  const pathCopy = d.learning.path;
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

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Skeleton className="h-48 w-full" />
      </main>
    );
  }

  const level = data?.preferences?.arabic_level;
  const goal = data?.preferences?.primary_goal;

  const rows = [
    {
      label: plan.arabicLevel,
      value: level ? t(`learning.levels.${level}.label`) : plan.notSet,
    },
    {
      label: plan.primaryGoal,
      value: goal ? t(`learning.goals.${goal}`) : plan.notSet,
    },
    {
      label: plan.dailyGoal,
      value: t("learning.plan.minutes", { count: data?.preferences?.daily_goal_minutes ?? 10 }),
    },
    {
      label: plan.interfaceLanguage,
      value: data?.profile?.interface_language === "fr" ? "Français" : "English",
    },
    { label: plan.preferredTranslation, value: data?.preferences?.preferred_translation ?? "—" },
    { label: plan.preferredReciter, value: data?.preferences?.preferred_reciter ?? "—" },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{plan.title}</h1>
      <p className="mt-2 text-muted-foreground">{plan.intro}</p>

      <Card className="mt-8 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">{plan.current}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/onboarding">{plan.update}</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/settings">{t("common.nav.settings")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="mt-10" aria-labelledby="path">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="path" className="font-display text-2xl font-bold">
            {pathCopy.title}
          </h2>
          {path && (
            <Badge variant="outline">
              {pathCopy.startingLevel}: {d.learning.placement.levels[path.level].label}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-muted-foreground">{path ? pathCopy.intro : pathCopy.noPath}</p>

        {path ? (
          <>
            <div className="mt-6">
              <PathTimeline steps={path.steps} />
            </div>
            <Button variant="ghost" className="mt-4 px-0" asChild>
              <Link to="/placement">{d.learning.placement.retake}</Link>
            </Button>
          </>
        ) : (
          <Button className="mt-4" asChild>
            <Link to="/placement">{pathCopy.takeTest}</Link>
          </Button>
        )}
      </section>
    </main>
  );
}

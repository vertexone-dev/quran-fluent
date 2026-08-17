import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "The Qur'anic Arabic course — QuranRoots" },
      {
        name: "description",
        content:
          "Six levels from the Arabic alphabet to full Qur'an comprehension: reading, vocabulary, grammar, roots.",
      },
      { property: "og:title", content: "The Qur'anic Arabic course — QuranRoots" },
      {
        property: "og:description",
        content: "From the alphabet to understanding complete Ayat, one level at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Learn,
});

function Learn() {
  const { user } = useAuth();
  const { t, d } = useI18n();
  const course = d.learning.course;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-14">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{course.title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{course.intro}</p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {course.levels.map((level) => (
            <Card key={level.level} className="h-full shadow-soft">
              <CardContent className="pt-6">
                <Badge variant="secondary">{level.level}</Badge>
                <h2 className="mt-3 font-display text-lg font-semibold">{level.title}</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {level.topics.map((topic) => (
                    <li key={topic} className="flex gap-2">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                      {topic}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-10 border-dashed">
          <CardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{course.ctaNote}</p>
            <Button asChild>
              {user ? (
                <Link to="/dashboard">{course.goToDashboard}</Link>
              ) : (
                <Link to="/auth" search={{ mode: "signup" }}>
                  {t("common.actions.startLearning")}
                </Link>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}

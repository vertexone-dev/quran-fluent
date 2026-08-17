import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpenText,
  Sparkles,
  Headphones,
  Brain,
  GraduationCap,
  LineChart,
  Languages,
  Compass,
} from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuranRoots — Learn Arabic. Understand the Qur'an." },
      {
        name: "description",
        content:
          "A premium academy for Qur'anic Arabic in English and French: read, understand word by word, memorize and track real progress.",
      },
      { property: "og:title", content: "QuranRoots — Learn Arabic. Understand the Qur'an." },
      {
        property: "og:description",
        content:
          "Build your Qur'anic Arabic skills one word, one verse, and one lesson at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const pillarIcons = [GraduationCap, BookOpenText, Brain, Languages, Headphones, LineChart];

function Home() {
  const { t, d } = useI18n();
  const home = d.home;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main>
        <section className="surface-hero relative overflow-hidden">
          <div
            aria-hidden
            className="pattern-geometric pointer-events-none absolute inset-0 opacity-40"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
            <div className="max-w-2xl">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="size-3.5" aria-hidden /> {home.hero.badge}
              </Badge>
              <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-foreground sm:text-6xl">
                {home.hero.titleLine1}
                <br />
                {home.hero.titleLine2}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">{home.hero.subtitle}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link to="/auth" search={{ mode: "signup" }}>
                    {t("common.actions.startLearning")}
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/quran">{t("common.actions.exploreQuran")}</Link>
                </Button>
              </div>
              <p className="mt-6 max-w-md text-sm text-muted-foreground">{home.hero.note}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="font-display text-2xl font-bold sm:text-3xl">
            {home.how.title}
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {home.how.steps.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full shadow-soft">
                  <CardContent className="pt-6">
                    <span className="font-display text-sm font-bold text-gold">0{index + 1}</span>
                    <h3 className="mt-2 font-display text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-secondary/60 py-16" aria-labelledby="pillars">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="pillars" className="font-display text-2xl font-bold sm:text-3xl">
              {home.pillars.title}
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {home.pillars.items.map((pillar, index) => {
                const Icon = pillarIcons[index] ?? GraduationCap;
                return (
                  <Card key={pillar.title} className="h-full border-border/70 shadow-soft">
                    <CardContent className="pt-6">
                      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <h3 className="mt-4 font-display text-lg font-semibold">{pillar.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{pillar.body}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="word-study">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 id="word-study" className="font-display text-2xl font-bold sm:text-3xl">
                {home.wordStudy.title}
              </h2>
              <p className="mt-4 text-muted-foreground">{home.wordStudy.body}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {home.wordStudy.bullets.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Compass className="size-4 text-gold" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Card className="shadow-elevated">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {home.wordStudy.panelLabel}
                </p>
                <p className="font-arabic mt-3 text-4xl text-foreground" lang="ar" dir="rtl">
                  الحمد
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{home.wordStudy.meaning}</dt>
                    <dd className="font-medium">{home.wordStudy.meaningValue}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{home.wordStudy.transliteration}</dt>
                    <dd className="font-medium">al-ḥamdu</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{home.wordStudy.root}</dt>
                    <dd className="font-arabic text-lg" lang="ar" dir="rtl">
                      ح م د
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{home.wordStudy.wordType}</dt>
                    <dd className="font-medium">{home.wordStudy.wordTypeValue}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="bg-secondary/60 py-16" aria-labelledby="testimonials">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="testimonials" className="font-display text-2xl font-bold sm:text-3xl">
              {home.testimonials.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{home.testimonials.note}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <Card key={n} className="h-full">
                  <CardContent className="pt-6">
                    <div className="h-3 w-24 rounded bg-muted" />
                    <div className="mt-4 space-y-2">
                      <div className="h-3 w-full rounded bg-muted" />
                      <div className="h-3 w-11/12 rounded bg-muted" />
                      <div className="h-3 w-8/12 rounded bg-muted" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="font-display text-3xl font-bold">{home.cta.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{home.cta.body}</p>
          <Button size="lg" className="mt-8" asChild>
            <Link to="/auth" search={{ mode: "signup" }}>
              {t("common.actions.startLearning")}
            </Link>
          </Button>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About QuranRoots — our approach to Qur'anic Arabic" },
      {
        name: "description",
        content:
          "Why QuranRoots exists, how we treat Qur'anic data, and the principles behind the learning method.",
      },
      { property: "og:title", content: "About QuranRoots" },
      {
        property: "og:description",
        content: "Our approach to teaching Qur'anic Arabic with verified, attributable sources.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  const { d } = useI18n();
  const about = d.home.about;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{about.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{about.intro}</p>

        <div className="mt-10 space-y-6">
          {about.cards.map((card) => (
            <Card key={card.title} className="shadow-soft">
              <CardContent className="pt-6">
                <h2 className="font-display text-xl font-semibold">{card.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{card.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

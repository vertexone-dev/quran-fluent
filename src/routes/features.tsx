import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — QuranRoots" },
      {
        name: "description",
        content:
          "Word-by-word study, root explorer, vocabulary training, Hifz mode, Tajweed and the Qur'an Understanding Score.",
      },
      { property: "og:title", content: "Features — QuranRoots" },
      {
        property: "og:description",
        content:
          "Everything QuranRoots offers for reading, understanding and memorizing the Qur'an.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Features,
});

function Features() {
  const { d } = useI18n();
  const features = d.home.features;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-14">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{features.title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{features.intro}</p>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.groups.map((group) => (
            <Card key={group.phase} className="h-full shadow-soft">
              <CardContent className="pt-6">
                <Badge variant="secondary">{group.phase}</Badge>
                <ul className="mt-4 space-y-2 text-sm text-foreground">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

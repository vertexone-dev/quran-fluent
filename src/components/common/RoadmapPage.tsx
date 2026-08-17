import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

type RoadmapPageProps = {
  title: string;
  phase: string;
  intro: string;
  planned: readonly string[];
  note?: string;
};

export function RoadmapPage({ title, phase, intro, planned, note }: RoadmapPageProps) {
  const { t } = useI18n();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Badge variant="secondary" className="mb-3">
        {phase}
      </Badge>
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{intro}</p>

      <Card className="mt-8 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">{t("common.roadmap.included")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {planned.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-foreground">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                {item}
              </li>
            ))}
          </ul>
          {note && <p className="mt-6 text-sm text-muted-foreground">{note}</p>}
        </CardContent>
      </Card>
    </main>
  );
}

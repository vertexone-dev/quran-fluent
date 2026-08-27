import { useQuery } from "@tanstack/react-query";
import { BookOpen, Lightbulb, ListChecks, Quote, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import type { LessonSection } from "@/lib/curriculum";
import { ayahTranslation, fetchAyah } from "@/lib/quran";
import { cn } from "@/lib/utils";

const CALLOUT_ICON: Partial<Record<LessonSection["content_type"], typeof Lightbulb>> = {
  tip: Lightbulb,
  rule: ListChecks,
  summary: Sparkles,
  quran_example: Quote,
};

/**
 * Renders one lesson_sections row. Every content_type from the 2.1 schema
 * CHECK constraint is handled explicitly; an unrecognized value falls
 * through to a neutral notice rather than throwing, so a future schema
 * addition can never crash an in-progress lesson.
 */
export function LessonSectionRenderer({ section }: { section: LessonSection }) {
  const { d } = useI18n();
  const copy = d.learning.lesson;
  const Icon = CALLOUT_ICON[section.content_type];
  const body = section.body;

  const bodyBlock = body && (
    <p className="whitespace-pre-line leading-relaxed text-foreground">{body}</p>
  );

  switch (section.content_type) {
    case "explanation":
    case "example":
    case "vocabulary":
      return (
        <Card className="shadow-soft">
          <CardContent className="pt-6">{bodyBlock}</CardContent>
        </Card>
      );

    case "tip":
    case "rule":
    case "summary":
      return (
        <Card className={cn("shadow-soft border-l-4", "border-l-primary")}>
          <CardContent className="flex gap-3 pt-6">
            {Icon && <Icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />}
            <div>{bodyBlock}</div>
          </CardContent>
        </Card>
      );

    case "arabic_text":
      return (
        <Card className="shadow-soft">
          <CardContent className="space-y-3 pt-6">
            {section.arabic_text && (
              <p
                className="font-quran text-right text-3xl leading-loose text-foreground"
                dir="rtl"
                lang="ar"
              >
                {section.arabic_text}
              </p>
            )}
            {bodyBlock}
          </CardContent>
        </Card>
      );

    case "quran_example":
      return <QuranExampleSection section={section} />;

    default:
      // Exhaustive per the 2.1 CHECK constraint's known values; anything
      // else means the schema has grown a type this renderer doesn't know
      // yet — fail safely rather than crash the lesson.
      return (
        <Card className="shadow-soft border-dashed">
          <CardContent className="py-6 text-sm text-muted-foreground">
            {copy.unsupportedContentType}
          </CardContent>
        </Card>
      );
  }
}

function QuranExampleSection({ section }: { section: LessonSection }) {
  const { locale, t, d } = useI18n();
  const copy = d.learning.lesson;
  const body = section.body;
  const surah = section.surah_number;
  const ayah = section.ayah_number;

  const { data, isLoading } = useQuery({
    queryKey: ["lesson-quran-example", surah, ayah],
    queryFn: () => fetchAyah(surah!, ayah!),
    enabled: surah != null && ayah != null,
  });

  return (
    <Card className="shadow-soft border-l-4 border-l-gold">
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start gap-3">
          <Quote className="mt-1 size-5 shrink-0 text-gold" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            {body && <p className="leading-relaxed text-foreground">{body}</p>}
            {isLoading && <Skeleton className="h-16 w-full" />}
            {!isLoading && data && (
              <div>
                <p
                  className="font-quran text-right text-2xl leading-loose text-foreground"
                  dir="rtl"
                  lang="ar"
                >
                  {data.arabic_text}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {ayahTranslation(data, locale) ?? d.quran.reader.translationUnavailable}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  {t("learning.lesson.quranExampleReference", { surah: surah!, ayah: ayah! })}
                </p>
              </div>
            )}
            {!isLoading && !data && (
              <p className="text-sm text-muted-foreground">{copy.quranExampleUnavailable}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

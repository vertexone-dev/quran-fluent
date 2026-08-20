import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { ayahTranslation, type Ayah } from "@/lib/quran";

type AyahCardProps = {
  ayah: Ayah;
  surahLabel: string;
  locale: Locale;
  highlighted?: boolean;
  actions?: ReactNode;
};

/** Shared ayah display: reader, bookmarks and notes all render the same card. */
export function AyahCard({ ayah, surahLabel, locale, highlighted, actions }: AyahCardProps) {
  const { d } = useI18n();
  const translation = ayahTranslation(ayah, locale);
  return (
    <Card
      id={`ayah-${ayah.surah_number}-${ayah.ayah_number}`}
      className={cn("shadow-soft scroll-mt-24", highlighted && "ring-2 ring-primary")}
    >
      <CardContent className="pt-6">
        <Badge variant="outline">{surahLabel}</Badge>
        <p
          className="text-quran mt-4 text-right text-2xl leading-loose text-foreground"
          dir="rtl"
          lang="ar"
        >
          {ayah.arabic_text}
        </p>
        <p
          className={cn(
            "mt-3 text-sm",
            translation ? "text-muted-foreground" : "italic text-muted-foreground/70",
          )}
        >
          {translation ?? d.quran.reader.translationUnavailable}
        </p>
        {actions && <div className="mt-4 flex flex-wrap items-center gap-1">{actions}</div>}
      </CardContent>
    </Card>
  );
}

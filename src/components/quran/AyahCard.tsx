import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { ResolvedAyah } from "@/lib/quran";

type AyahCardProps = {
  ayah: ResolvedAyah;
  surahLabel: string;
  highlighted?: boolean;
  actions?: ReactNode;
};

/** Shared ayah display: reader, bookmarks and notes all render the same card. */
export function AyahCard({ ayah, surahLabel, highlighted, actions }: AyahCardProps) {
  const { d } = useI18n();
  const r = d.quran.reader;
  const translation = ayah.resolvedTranslation;
  const continuesFrom = ayah.translationContinuesFromAyah;
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
          {continuesFrom !== null
            ? r.translationContinuesFrom.replace("{number}", String(continuesFrom))
            : (translation ?? r.translationUnavailable)}
        </p>
        {ayah.translationSource && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground"
              >
                <Info className="size-3" aria-hidden />
                {r.attribution.label.replace("{translator}", ayah.translationSource.translator)}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto max-w-xs text-xs text-muted-foreground"
              aria-label={r.attribution.detailsAriaLabel}
            >
              {r.attribution.details}
            </PopoverContent>
          </Popover>
        )}
        {actions && <div className="mt-4 flex flex-wrap items-center gap-1">{actions}</div>}
      </CardContent>
    </Card>
  );
}

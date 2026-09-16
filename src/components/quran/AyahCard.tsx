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
  /** True right after the learner has acted on this āyah (bookmarked it,
   * opened its note). A soft background tint, not the ring `highlighted`
   * uses -- the two need to read as different things, since a card can be
   * both at once (scrolled-to *and* just acted on). Only ever the card's
   * own background/border, never anything inside it, so the Arabic text
   * and translation never move. */
  selected?: boolean;
  actions?: ReactNode;
};

/** Shared ayah display: reader, bookmarks and notes all render the same card. */
export function AyahCard({ ayah, surahLabel, highlighted, selected, actions }: AyahCardProps) {
  const { d } = useI18n();
  const r = d.quran.reader;
  const translation = ayah.resolvedTranslation;
  const continuesFrom = ayah.translationContinuesFromAyah;
  return (
    <Card
      id={`ayah-${ayah.surah_number}-${ayah.ayah_number}`}
      className={cn(
        // duration-200/ease-out: the same restrained pair PathTimeline's
        // level cards use for their own hover/select state.
        "shadow-soft scroll-mt-24 transition-colors duration-200 ease-out",
        highlighted && "ring-2 ring-primary",
        selected && "border-primary/40 bg-primary/5",
      )}
    >
      <CardContent className="pt-6">
        <Badge variant="outline">{surahLabel}</Badge>
        {/* Arabic is the primary reason to be on this page -- given more
            visual weight (larger, more breathing room) than the
            translation/attribution below it, instead of all three
            competing at similar sizes. */}
        <p
          className="text-quran mt-5 text-right text-3xl leading-loose text-foreground sm:text-4xl"
          dir="rtl"
          lang="ar"
        >
          {ayah.arabic_text}
        </p>
        <p
          className={cn(
            "mt-4 text-base leading-relaxed",
            // text-muted-foreground/70 measured at ~3.9:1 against the card
            // background -- under WCAG AA's 4.5:1 floor for this non-large
            // text. Full-opacity muted-foreground (already used for the
            // translated case just above) clears it at 6.7:1+ and still
            // reads as secondary/quieter than the Arabic text above it.
            translation ? "text-muted-foreground" : "italic text-muted-foreground",
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
                // min-h-6 (24px) is the accessible-tap-target floor for
                // this small, tightly-spaced inline note; the surrounding
                // layout doesn't have room for the ~44px target other,
                // less cramped controls (e.g. the footer links) use. The
                // rounded/border treatment gives it a clear "control"
                // affordance instead of reading as plain body text.
                // text-muted-foreground/85 (not /70, measured): at this
                // text-xs size /70 only reaches ~3.9:1 against the card
                // background, under WCAG AA's 4.5:1 floor for normal text;
                // /85 clears it (~4.7-5.2:1 in light/dark, verified via a
                // canvas-based contrast check against the real tokens).
                className="mt-3 inline-flex min-h-6 items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs text-muted-foreground/85 transition-colors hover:border-border hover:bg-muted hover:text-muted-foreground"
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

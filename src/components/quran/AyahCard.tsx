import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VerseFrame } from "@/design/VerseFrame";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { resolveTranslationAttributionKey, type ResolvedAyah } from "@/lib/quran";

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
  /** QR-INT-007: called when the learner clicks the verse itself (not one
   * of its controls) -- the Reader uses it for verse selection. */
  onSelect?: () => void;
};

/**
 * Shared ayah display: reader, bookmarks and notes all render the same
 * card. Deliberately renders no transliteration row of any kind: no
 * per-ayah transliteration data exists anywhere (the `ayahs` table has no
 * such column -- only surah *names* and vocabulary *words* have one), and
 * this must never fabricate it. Settings' own "show transliteration"
 * preference is still saved and loaded correctly (see
 * resolveShowTransliteration in src/lib/quran.ts) for whenever real data
 * exists to show -- this component just has nothing to gate on yet.
 */
export function AyahCard({
  ayah,
  surahLabel,
  highlighted,
  selected,
  actions,
  onSelect,
}: AyahCardProps) {
  const { d } = useI18n();
  const r = d.quran.reader;
  const translation = ayah.resolvedTranslation;
  const continuesFrom = ayah.translationContinuesFromAyah;
  // Keyed by the actually active translator, not by interface locale --
  // preferred_translation can diverge from locale (Milestone 1A), so the
  // attribution popover must describe whichever source really produced
  // this text. null for any unrecognized translator (no third governed
  // source exists yet): never show one translator's details under
  // another's name, and never show blank/guessed text either -- hide the
  // whole attribution control instead of misleading.
  const attributionKey = ayah.translationSource
    ? resolveTranslationAttributionKey(ayah.translationSource.translator)
    : null;
  return (
    // QR-INT-007: rendered in the cinematic VerseFrame (was a shadcn Card).
    // Same element id, same text nodes and the same `text-quran` class on
    // the Arabic -- only the surface changed.
    <VerseFrame
      id={`ayah-${ayah.surah_number}-${ayah.ayah_number}`}
      label={surahLabel}
      highlighted={highlighted}
      selected={selected}
      data-testid={`ayah-card-${ayah.surah_number}-${ayah.ayah_number}`}
      onClick={(event) => {
        if (!onSelect) return;
        if ((event.target as HTMLElement).closest("button,a,[role=dialog]")) return;
        onSelect();
      }}
    >
      <div>
        {/* Arabic is the primary reason to be on this page -- given more
            visual weight (larger, more breathing room) than the
            translation/attribution below it, instead of all three
            competing at similar sizes. */}
        <p
          className="text-quran mt-5 text-right text-3xl leading-loose text-[oklch(0.97_0.012_85)] sm:text-4xl"
          dir="rtl"
          lang="ar"
        >
          {ayah.arabic_text}
        </p>
        <p
          dir="auto"
          className={cn(
            "mt-4 text-base leading-relaxed",
            // text-muted-foreground/70 measured at ~3.9:1 against the card
            // background -- under WCAG AA's 4.5:1 floor for this non-large
            // text. Full-opacity muted-foreground (already used for the
            // translated case just above) clears it at 6.7:1+ and still
            // reads as secondary/quieter than the Arabic text above it.
            translation ? "text-white/85" : "italic text-white/80",
          )}
        >
          {continuesFrom !== null
            ? r.translationContinuesFrom.replace("{number}", String(continuesFrom))
            : (translation ?? r.translationUnavailable)}
        </p>
        {ayah.translationSource && attributionKey && (
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
                className="mt-3 inline-flex min-h-6 items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs text-white/80 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                <Info className="size-3" aria-hidden />
                {r.attribution.label.replace("{translator}", ayah.translationSource.translator)}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto max-w-xs text-xs text-muted-foreground"
              aria-label={r.attribution.detailsAriaLabel}
            >
              {r.attribution.details[attributionKey]}
            </PopoverContent>
          </Popover>
        )}
        {actions && (
          <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-white/10 pt-3 text-white [&_a]:text-white [&_button]:text-white [&_button:hover]:bg-white/10 [&_a:hover]:bg-white/10">
            {actions}
          </div>
        )}
      </div>
    </VerseFrame>
  );
}

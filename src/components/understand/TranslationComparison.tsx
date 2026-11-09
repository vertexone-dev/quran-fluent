import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContentState, GlassPanel } from "@/design/primitives";
import { useI18n } from "@/lib/i18n";
import { resolveTranslationAttributionKey, type ResolvedAyah } from "@/lib/quran";

// QR-INT-007 (Milestone C): English and French side by side for one āyah.
// Text comes only from fetchAyahsWithTranslations (Pickthall / Kazimirski via
// the existing governed resolvers); this component never alters it. Each
// column names its actually-active source; a missing translation is an
// explicit unavailable state, and a Kazimirski one_to_many continuation shows
// the existing "see Ayah N above" note instead of a duplicate.
function TranslationColumn({
  lang,
  heading,
  ayah,
  unavailable,
  loading,
}: {
  lang: "en" | "fr";
  heading: string;
  ayah: ResolvedAyah | undefined;
  unavailable: string;
  loading?: boolean | undefined;
}) {
  const { d } = useI18n();
  const r = d.quran.reader;
  const key = ayah?.translationSource
    ? resolveTranslationAttributionKey(ayah.translationSource.translator)
    : null;
  const continues = ayah?.translationContinuesFromAyah ?? null;
  return (
    <GlassPanel className="p-5 sm:p-6" data-testid={`comparison-${lang}`}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-[oklch(0.767_0.139_91.1)]">
        {heading}
      </h3>
      {loading ? (
        <ContentState kind="loading" message={d.quran.reader.loading} className="mt-3" />
      ) : continues !== null ? (
        <p className="mt-3 text-white/85" dir="auto">
          {r.translationContinuesFrom.replace("{number}", String(continues))}
        </p>
      ) : ayah?.resolvedTranslation ? (
        <p
          className="mt-3 text-base leading-relaxed text-white/90"
          lang={lang}
          dir="ltr"
          data-testid={`comparison-${lang}-text`}
        >
          {ayah.resolvedTranslation}
        </p>
      ) : (
        <ContentState kind="unavailable" message={unavailable} className="mt-3" />
      )}
      {ayah?.translationSource && key && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="mt-4 inline-flex min-h-6 items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-white/85 transition-colors hover:bg-white/10"
              data-testid={`comparison-${lang}-source`}
            >
              <Info className="size-3" aria-hidden />
              {r.attribution.label.replace("{translator}", ayah.translationSource.translator)}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto max-w-xs text-xs text-muted-foreground"
            aria-label={r.attribution.detailsAriaLabel}
          >
            {r.attribution.details[key]}
          </PopoverContent>
        </Popover>
      )}
    </GlassPanel>
  );
}

export function TranslationComparison({
  english,
  french,
  frenchLoading,
}: {
  english: ResolvedAyah | undefined;
  french: ResolvedAyah | undefined;
  frenchLoading?: boolean | undefined;
}) {
  const { d } = useI18n();
  const u = d.quran.understand;
  return (
    <section aria-labelledby="comparison-title">
      <h2 id="comparison-title" className="sr-only">
        {u.comparisonTitle}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <TranslationColumn
          lang="en"
          heading={u.english}
          ayah={english}
          unavailable={u.unavailableEn}
        />
        <TranslationColumn
          lang="fr"
          heading={u.french}
          ayah={french}
          unavailable={u.unavailableFr}
          loading={frenchLoading}
        />
      </div>
    </section>
  );
}

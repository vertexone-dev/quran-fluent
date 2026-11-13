import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";

import { ICON_BUTTON } from "@/components/layout/navMenuStyles";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { fetchSurahs, foldArabicForSearch, surahName } from "@/lib/quran";
import { cn } from "@/lib/utils";

/**
 * QR-INT-005: the header's search control. It opens a command palette that
 * filters the real Surah list (the same `surahs` rows the reader uses -- no
 * invented entries) by name, transliteration, Arabic name or number, and
 * jumps to the existing public reader route /quran?surah=N. The list is only
 * fetched once the dialog is first opened.
 */
export function SearchDialog({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const {
    data: surahs,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["surahs"],
    queryFn: ({ signal }) => fetchSurahs(signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  return (
    <>
      <button
        type="button"
        aria-label={t("common.nav.search")}
        aria-haspopup="dialog"
        data-testid="header-search-button"
        className={cn(ICON_BUTTON, className)}
        onClick={() => setOpen(true)}
      >
        <Search className="size-5" strokeWidth={1.5} aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="overflow-hidden border-[oklch(0.767_0.139_91.1/0.25)] bg-[oklch(0.2_0.035_190/0.97)] p-0 text-[oklch(0.974_0.01_87.5)] sm:max-w-md"
          data-testid="header-search-dialog"
        >
          <DialogTitle className="sr-only">{t("common.nav.searchTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("common.nav.searchPlaceholder")}
          </DialogDescription>
          <Command className="bg-transparent text-[oklch(0.974_0.01_87.5)] [&_[cmdk-input-wrapper]]:border-[oklch(0.767_0.139_91.1/0.25)] [&_[cmdk-input]]:h-12 [&_[cmdk-input]]:placeholder:text-[oklch(0.974_0.01_87.5/0.6)] [&_[cmdk-item]]:text-[oklch(0.974_0.01_87.5)] [&_[cmdk-group-heading]]:text-[oklch(0.88_0.1_91)] [&_[cmdk-empty]]:text-[oklch(0.974_0.01_87.5/0.85)] [&_[cmdk-item][data-selected=true]]:bg-[oklch(0.767_0.139_91.1/0.14)] [&_[cmdk-item][data-selected=true]]:text-[oklch(0.974_0.01_87.5)]">
            <CommandInput
              placeholder={t("common.nav.searchPlaceholder")}
              data-testid="header-search-input"
            />
            <CommandList className="max-h-72">
              {isLoading && (
                <div className="px-4 py-6 text-center text-sm">{t("common.nav.searchLoading")}</div>
              )}
              {isError && (
                <div
                  role="alert"
                  className="px-4 py-6 text-center text-sm"
                  data-testid="header-search-error"
                >
                  {t("common.nav.searchError")}
                </div>
              )}
              {!isLoading && !isError && <CommandEmpty>{t("common.nav.searchEmpty")}</CommandEmpty>}
              {surahs && (
                <CommandGroup heading={t("common.nav.searchHeading")}>
                  {surahs.map((s) => (
                    <CommandItem
                      key={s.number}
                      value={`${s.number} ${s.name_en} ${s.transliteration ?? ""} ${s.name_fr ?? ""} ${s.name_ar} ${foldArabicForSearch(s.name_ar)}`}
                      onSelect={() => {
                        setOpen(false);
                        void navigate({ to: "/quran", search: { surah: s.number } });
                      }}
                      data-testid={`search-result-${s.number}`}
                    >
                      <span className="w-8 shrink-0 text-xs text-[oklch(0.88_0.1_91)] tabular-nums">
                        {s.number}
                      </span>
                      <span className="flex-1">{surahName(s, locale)}</span>
                      <span lang="ar" dir="rtl" className="font-arabic text-base">
                        {s.name_ar}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

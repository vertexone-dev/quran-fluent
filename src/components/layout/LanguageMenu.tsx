import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MENU_SURFACE } from "@/components/layout/navMenuStyles";
import { LOCALE_LABELS, SUPPORTED_LOCALES, useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * QR-INT-005: the Emergent globe-and-code language dropdown. A globe plus the
 * active locale code (EN / FR / AR; the code is hidden on the narrowest
 * phones, as in the reference) opens a glass menu listing each language by its
 * own native name -- English, Français, العربية -- with a gold check on the
 * active one. It drives the very same setLocale() the footer/onboarding
 * segmented switcher uses, so persistence (localStorage + profile) and the
 * html lang/dir update are unchanged.
 *
 * Built on Radix's DropdownMenu radio group, so keyboard behaviour (arrow
 * keys, Home/End, Enter/Space to select, Escape to close and return focus to
 * the trigger) and RTL alignment come from the library rather than
 * hand-rolled handlers.
 */
export function LanguageMenu({ testIdPrefix = "language-menu" }: { testIdPrefix?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("common.language.change")}
          data-testid={`${testIdPrefix}-trigger`}
          className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-[oklch(0.974_0.01_87.5/0.9)] transition-colors hover:bg-white/5 hover:text-[oklch(0.88_0.1_91)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.767_0.139_91.1)] data-[state=open]:bg-white/5"
        >
          <Globe className="size-5" strokeWidth={1.5} aria-hidden />
          <span className="hidden text-sm font-semibold tracking-wider uppercase min-[420px]:inline">
            {LOCALE_LABELS[locale].short}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className={cn("min-w-[170px]", MENU_SURFACE)}
        data-testid={`${testIdPrefix}-content`}
      >
        <DropdownMenuPrimitive.RadioGroup
          value={locale}
          onValueChange={(next) => setLocale(next as Locale)}
          aria-label={t("common.language.change")}
        >
          {SUPPORTED_LOCALES.map((code) => (
            <DropdownMenuPrimitive.RadioItem
              key={code}
              value={code}
              lang={code}
              data-testid={`language-option-${code}`}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-sm text-[oklch(0.974_0.01_87.5)] outline-none select-none data-[highlighted]:bg-[oklch(0.767_0.139_91.1/0.12)]"
            >
              <span>{LOCALE_LABELS[code].label}</span>
              <DropdownMenuPrimitive.ItemIndicator>
                <Check className="size-4 text-[oklch(0.767_0.139_91.1)]" aria-hidden />
              </DropdownMenuPrimitive.ItemIndicator>
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuPrimitive.RadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

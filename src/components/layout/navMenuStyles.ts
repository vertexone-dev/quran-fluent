// QR-INT-005: shared look for the header's dropdown surfaces (language,
// theme, account). Literal Midnight Teal / Ivory / Antique Gold values (the
// same theme-independent palette as the nav bar itself) so a menu opened from
// the dark bar never flips to a light popover in the light theme. Color
// utilities are written as arbitrary values so tailwind-merge in
// DropdownMenuContent/Item replaces the default popover/accent colors.
export const MENU_SURFACE =
  "border-[oklch(0.767_0.139_91.1/0.25)] bg-[oklch(0.2_0.035_190/0.95)] text-[oklch(0.974_0.01_87.5)] backdrop-blur-xl shadow-elevated rounded-2xl p-1.5";

export const MENU_ITEM =
  "rounded-xl px-3 py-2.5 text-sm text-[oklch(0.974_0.01_87.5)] focus:bg-[oklch(0.767_0.139_91.1/0.12)] focus:text-[oklch(0.974_0.01_87.5)]";

export const ICON_BUTTON =
  "inline-flex size-11 items-center justify-center rounded-full text-[oklch(0.974_0.01_87.5/0.9)] transition-colors hover:bg-white/5 hover:text-[oklch(0.88_0.1_91)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.767_0.139_91.1)]";

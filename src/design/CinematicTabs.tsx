import type { ComponentPropsWithoutRef } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// QR-INT-007 (Milestone C): cinematic skin over the existing shadcn/Radix
// Tabs (keyboard arrows, roles and RTL direction come from Radix -- nothing
// re-implemented). Same pill language as the Milestone B nav (nav-pill-*).
export const CinematicTabs = Tabs;
export const CinematicTabsContent = TabsContent;

export function CinematicTabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        "grid h-auto w-full grid-cols-2 justify-stretch gap-1 rounded-2xl border border-white/12 bg-white/5 p-1 sm:inline-flex sm:w-auto sm:justify-start sm:rounded-full",
        className,
      )}
      {...props}
    />
  );
}

export function CinematicTabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        "min-h-11 rounded-full px-2 text-sm sm:min-h-10 sm:px-4 font-semibold text-white/80 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[oklch(0.767_0.139_91.1)] data-[state=active]:bg-[oklch(0.767_0.139_91.1)] data-[state=active]:text-[oklch(0.2_0.035_195.1)] data-[state=active]:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

/** Dialog / sheet / popover surface matching the Milestone B menus. Apply
 * to DialogContent / SheetContent className; Radix keeps focus trapping. */
export const DIALOG_SURFACE =
  "rounded-[24px] border border-[oklch(0.767_0.139_91.1/0.3)] bg-[oklch(0.22_0.035_195.1)] text-white shadow-[0_30px_80px_-30px_oklch(0.1_0.03_195/0.95)]";

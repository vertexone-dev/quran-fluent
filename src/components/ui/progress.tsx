"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    // `value` was previously destructured out to compute the indicator's
    // transform below and never passed to Root itself, so every Progress
    // bar in the app rendered with Radix's real value/max machinery seeing
    // undefined -- aria-valuenow was always missing and data-state was
    // always "indeterminate", regardless of the (visually correct) fill
    // width. Screen readers never had a percentage to announce. Passing it
    // through via {...props} costs nothing (Root doesn't otherwise care
    // about it beyond this) and fixes that for every existing caller.
    value={value}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      // duration-300/ease-out: the same pair used for every other new
      // "emphasis" motion in the app (checkmark reveal, ayah selection,
      // bookmark confirmation) -- was the implicit 150ms/ease default
      // before, fast enough that a value jumping straight to 100% (lesson
      // completion) barely registered as movement.
      className="h-full w-full flex-1 bg-primary transition-all duration-300 ease-out"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };

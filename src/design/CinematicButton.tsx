import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// QR-INT-007 (Milestone C): the cinematic button family. Extends the
// existing Milestone B look (gold pill CTA, glass ghost pills, round icon
// buttons in navMenuStyles.ICON_BUTTON) as one reusable component instead of
// repeating long class strings per page. Colours are the fixed cinematic
// values (Antique Gold oklch(0.767 0.139 91.1) on Midnight Teal), so they
// read the same in light and dark themes. Focus ring and 44px touch target
// are built in; motion is transform/colour only and is neutralised by the
// global prefers-reduced-motion rule in styles.css.
export const cinematicButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.767_0.139_91.1)] focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.2_0.035_195.1)] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 rtl:[&_svg.dir-icon]:-scale-x-100",
  {
    variants: {
      variant: {
        gold: "rounded-full bg-[oklch(0.767_0.139_91.1)] text-[oklch(0.2_0.035_195.1)] shadow-[0_8px_24px_-10px_oklch(0.767_0.139_91.1/0.7)] hover:bg-[oklch(0.82_0.12_91.1)] active:scale-[0.98]",
        ghost:
          "rounded-full border border-[oklch(0.767_0.139_91.1/0.35)] bg-white/5 text-white hover:border-[oklch(0.767_0.139_91.1/0.7)] hover:bg-white/10 active:scale-[0.98]",
        quiet: "rounded-full text-white/85 hover:bg-white/10 hover:text-white",
        icon: "rounded-full border border-white/15 bg-white/5 text-white hover:border-[oklch(0.767_0.139_91.1/0.6)] hover:bg-white/10 hover:text-[oklch(0.767_0.139_91.1)]",
      },
      size: {
        sm: "min-h-9 px-3.5 text-xs",
        md: "min-h-11 px-5 text-sm",
        lg: "min-h-12 px-7 text-base",
        icon: "size-11 p-0",
      },
    },
    compoundVariants: [{ variant: "icon", size: ["sm", "md", "lg"], className: "size-11 px-0" }],
    defaultVariants: { variant: "gold", size: "md" },
  },
);

export type CinematicButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof cinematicButtonVariants> & { asChild?: boolean };

export const CinematicButton = forwardRef<HTMLButtonElement, CinematicButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(cinematicButtonVariants({ variant, size }), className)}
        {...(asChild ? {} : { type: type ?? "button" })}
        {...props}
      />
    );
  },
);
CinematicButton.displayName = "CinematicButton";

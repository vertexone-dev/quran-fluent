import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// QR-INT-007 (Milestone C): the gold-edged āyah frame shared by the Reader
// and the Understand page. Pure presentation: it never touches the text it
// frames -- the Arabic is passed in as children and rendered exactly as
// stored. The corner ornaments are CSS-only (`.verse-frame` in styles.css)
// so no new artwork is introduced.
export function VerseFrame({
  id,
  label,
  highlighted,
  selected,
  size = "md",
  className,
  children,
  ...rest
}: {
  id?: string | undefined;
  /** Short visible reference, e.g. "Al-Faatiha 1:2". */
  label?: ReactNode;
  highlighted?: boolean | undefined;
  selected?: boolean | undefined;
  size?: "md" | "lg";
  className?: string | undefined;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "id">) {
  return (
    <article
      id={id}
      data-highlighted={highlighted ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "verse-frame relative scroll-mt-28 rounded-[28px] border border-[oklch(0.767_0.139_91.1/0.28)] bg-[linear-gradient(180deg,oklch(0.324_0.046_195.1/0.9),oklch(0.2_0.035_195.1/0.96))] text-white shadow-[0_24px_60px_-30px_oklch(0.12_0.03_195/0.9)] transition-[border-color,box-shadow] duration-200 ease-out",
        size === "lg" ? "px-5 py-7 sm:px-10 sm:py-10" : "px-5 py-6 sm:px-8",
        highlighted &&
          "border-[oklch(0.767_0.139_91.1/0.85)] ring-2 ring-[oklch(0.767_0.139_91.1/0.55)]",
        selected &&
          "border-[oklch(0.767_0.139_91.1/0.6)] shadow-[0_0_0_1px_oklch(0.767_0.139_91.1/0.35),0_24px_60px_-30px_oklch(0.12_0.03_195/0.9)]",
        className,
      )}
      {...rest}
    >
      {label != null && (
        <div className="flex items-center gap-3">
          <span className="inline-flex min-h-7 items-center rounded-full border border-[oklch(0.767_0.139_91.1/0.45)] px-3 text-xs font-semibold tracking-wide text-[oklch(0.767_0.139_91.1)]">
            {label}
          </span>
          <span
            aria-hidden
            className="h-px flex-1 bg-gradient-to-r from-[oklch(0.767_0.139_91.1/0.45)] to-transparent rtl:bg-gradient-to-l"
          />
        </div>
      )}
      {children}
    </article>
  );
}

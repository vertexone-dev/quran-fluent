import type { ReactNode } from "react";
import { AlertCircle, Hourglass, Loader2, ShieldCheck, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";

// QR-INT-006 design system: theme-independent cinematic surfaces and the
// shared loading / error / empty / unavailable states. Pure presentation --
// no data access. See src/design/README.md.

/** Antique Gold, fixed (WCAG 6.8:1 on Midnight Teal). */
export const GOLD = "oklch(0.767 0.139 91.1)";

/** Dark Midnight-Teal glass panel used on cinematic sections in both themes. */
export function GlassPanel({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[26px] border border-[oklch(0.767_0.139_91.1/0.25)] bg-[linear-gradient(180deg,oklch(0.324_0.046_195.1/0.78),oklch(0.2_0.035_195.1/0.88))] text-white backdrop-blur-xl",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Eyebrow + display heading + gold ornament + lead paragraph. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  body,
  align = "start",
}: {
  id: string;
  eyebrow: string;
  title: string;
  body?: string;
  align?: "start" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
        {eyebrow}
      </p>
      <h2 id={id} className="mt-3 font-display text-3xl font-bold sm:text-4xl">
        {title}
      </h2>
      <span
        aria-hidden
        className={cn(
          "mt-4 block h-px w-24 bg-gradient-to-r from-transparent via-[oklch(0.767_0.139_91.1)] to-transparent",
          align === "center" && "mx-auto",
        )}
      />
      {body ? <p className="mt-4 text-muted-foreground">{body}</p> : null}
    </div>
  );
}

type StateKind = "loading" | "error" | "empty" | "unavailable" | "offline";
const STATE_ICON = {
  loading: Loader2,
  error: AlertCircle,
  empty: Hourglass,
  unavailable: ShieldCheck,
  // QR-INT-007: the device has no connection (see useOnlineStatus).
  offline: WifiOff,
} as const;

/**
 * One honest state for content that isn't showable yet. "unavailable" is for
 * content awaiting a verified source (never filled with placeholder text).
 */
export function ContentState({
  kind,
  message,
  action,
  className,
  tone = "dark",
}: {
  kind: StateKind;
  message: string;
  action?: ReactNode;
  className?: string;
  tone?: "dark" | "theme";
}) {
  const Icon = STATE_ICON[kind];
  return (
    <div
      role={kind === "error" || kind === "offline" ? "alert" : "status"}
      aria-live="polite"
      data-testid={`content-state-${kind}`}
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed px-5 py-6 text-center text-sm",
        tone === "dark" ? "border-white/25 text-white/85" : "border-border text-muted-foreground",
        className,
      )}
    >
      <Icon
        className={cn("size-6", kind === "loading" && "motion-safe:animate-spin")}
        style={{ color: GOLD }}
        aria-hidden
      />
      <p className="max-w-md">{message}</p>
      {action}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { Check, Circle, Lock, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { LearningPathStep } from "@/lib/placement";

const ICONS = {
  completed: Check,
  in_progress: PlayCircle,
  available: Circle,
  locked: Lock,
} as const;

export function PathTimeline({ steps }: { steps: LearningPathStep[] }) {
  const { t, d } = useI18n();
  const copy = d.learning.path;

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const meta = copy.steps[step.step_key as keyof typeof copy.steps];
        const Icon = ICONS[step.status];
        const active = step.status === "in_progress";
        return (
          <li
            key={step.id ?? step.step_key}
            className={cn(
              // transition-colors + duration-200/ease-out here matches the
              // same pair every dialog/popover in this app already
              // animates open with (see dialog.tsx/popover.tsx's
              // duration-200) -- reusing it, rather than picking a new
              // number, is what keeps this "restrained" instead of
              // drawing attention to itself.
              "flex gap-3 rounded-xl border p-4 transition-colors duration-200 ease-out",
              active ? "border-primary bg-primary/5" : "border-border bg-card",
              step.status === "locked"
                ? // Locked steps get no hover affordance at all -- nothing
                  // here should look interactive when it isn't.
                  "opacity-60"
                : "hover:border-primary/50",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ease-out",
                step.status === "completed"
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "bg-gold/20 text-gold"
                    : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-semibold">
                  {meta?.label ?? step.step_key}
                </h3>
                <Badge variant={active ? "default" : "outline"}>{copy.status[step.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{meta?.blurb}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("learning.path.stepOf", { index: index + 1, total: steps.length })}
              </p>
              {/* Only ever rendered when lesson_id is set, which only ever
                  happens for real curriculum content (see saveLearningPath
                  in src/lib/placement.ts) — never a guessed link, and a
                  legacy step saved before this column existed simply has
                  no lesson_id yet, so it falls through to the same
                  read-only display this timeline always had. */}
              {step.lesson_id && step.status !== "locked" && (
                <Button
                  size="sm"
                  variant="outline"
                  // A brief press-scale, scoped to this one button rather
                  // than shared Button (every button in the app would
                  // otherwise pick this up) -- confirms the tap without
                  // adding a new animation vocabulary: transform is the
                  // only property in flight, and prefers-reduced-motion is
                  // already handled globally in styles.css.
                  className="mt-3 transition-transform duration-150 ease-out active:scale-[0.97]"
                  asChild
                >
                  <Link to="/lesson/$lessonId" params={{ lessonId: step.lesson_id }}>
                    {step.status === "completed" ? copy.reviewLesson : copy.openLesson}
                  </Link>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

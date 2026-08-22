import { Check, Circle, Lock, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
              "flex gap-3 rounded-xl border p-4",
              active ? "border-primary bg-primary/5" : "border-border bg-card",
              step.status === "locked" && "opacity-60",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
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
            </div>
          </li>
        );
      })}
    </ol>
  );
}

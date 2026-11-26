import type { RingModel } from "@/lib/memorization-progress";
import { formatPercent } from "@/lib/memorization-progress";

// Progress ring for the Memorize overview. Two arcs on one track: memorized
// (Antique Gold) from the top, then learning (teal) continuing from it. The ring
// itself is decorative (aria-hidden); the same facts are in the text the parent
// renders and in `label`, which is the accessible name of the whole figure.

const R = 52;
const C = 2 * Math.PI * R;

function Arc({ from, to, className }: { from: number; to: number; className: string }) {
  const length = Math.max(0, to - from) * C;
  if (length <= 0) return null;
  return (
    <circle
      cx="60"
      cy="60"
      r={R}
      fill="none"
      strokeWidth="9"
      strokeLinecap="butt"
      strokeDasharray={`${length} ${C - length}`}
      strokeDashoffset={-from * C}
      transform="rotate(-90 60 60)"
      className={className}
    />
  );
}

export function ProgressRing({ model, label }: { model: RingModel; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      data-testid="memorize-ring"
      data-memorized={model.memorized}
      data-learning={model.learning}
      data-total={model.total}
      className="relative size-36 shrink-0"
    >
      <svg viewBox="0 0 120 120" aria-hidden className="size-full">
        <circle cx="60" cy="60" r={R} fill="none" strokeWidth="9" className="stroke-border" />
        <Arc from={0} to={model.memorizedFraction} className="stroke-[var(--gold)]" />
        <Arc from={model.memorizedFraction} to={model.startedFraction} className="stroke-primary" />
      </svg>
      <div
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
      >
        <span
          className="font-display text-2xl font-bold leading-none"
          data-testid="memorize-ring-percent"
        >
          {formatPercent(model.memorizedFraction)}
        </span>
      </div>
    </div>
  );
}

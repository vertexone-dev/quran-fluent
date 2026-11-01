/**
 * Shared, presentation-only UI primitives carried over from the Emergent
 * "Stage B" UI prototype (see mobile/e2e/android-smoke's sibling audit notes
 * for the integration assessment). Not wired into any screen yet -- Phase 0
 * of the Emergent UI integration lands these unused, ahead of Phase 1
 * screen swaps.
 *
 * Trimmed from the prototype's original ui.tsx: this file omits
 * `Placeholder`, `MockTag`, and `HeaderActions`, which depended on the
 * prototype's own `i18n`/`prefs` modules (a different locale/theme-state
 * shape than this app's existing `mobile/src/i18n.ts`) and, in MockTag's
 * case, existed specifically to label mocked progress data. Reintroduce
 * those only alongside a deliberate decision to merge the i18n/theme
 * infrastructure itself, not as a side effect of landing shared components.
 */
import type { ReactNode } from "react";

export function ProgressBar({
  value,
  label,
  testId,
}: {
  value: number;
  label: string;
  testId?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      data-testid={testId}
    >
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {right}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  testId,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  testId: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? "seg active" : "seg"}
          onClick={() => onChange(o.value)}
          data-testid={`${testId}-${o.value}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

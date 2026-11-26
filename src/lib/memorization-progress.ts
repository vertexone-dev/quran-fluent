// How the Memorize progress ring is calculated (QR-DESIGN-008B).
//
// Scope: ONE Surah (the one the learner touched most recently), the same scope as
// the Design Lock reference ("Surah Al-Mulk, memorization progress"). All numbers
// come from the learner's own records; nothing is estimated, defaulted or invented.
//
//   total       the Surah's real ayah count
//   memorized   memorization_progress rows with status = "memorized"
//   learning    memorization_progress rows with status = "learning"
//   remaining   total - memorized - learning (not started)
//   due         spaced-repetition review items for this Surah's ayahs that are due
//               today or earlier. This is a *revision* signal, not a progress state:
//               it overlaps memorized and learning ayahs, so it is shown as a count
//               and never as a ring segment.
//
//   percent     memorized / total  (learning ayahs are NOT counted as memorized)
//
// Counts are clamped so a data glitch can never draw more than 100% or a negative arc.

export type RingInput = {
  total: number;
  memorized: number;
  learning: number;
  due: number;
};

export type RingModel = {
  total: number;
  memorized: number;
  learning: number;
  remaining: number;
  due: number;
  /** memorized / total, 0 to 1. */
  memorizedFraction: number;
  /** (memorized + learning) / total, 0 to 1: where the "learning" arc ends. */
  startedFraction: number;
  /** True when the learner has no memorized and no learning ayah in this Surah. */
  empty: boolean;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const whole = (n: number) => (Number.isFinite(n) ? Math.floor(n) : 0);

export function computeRing({ total, memorized, learning, due }: RingInput): RingModel {
  const t = Math.max(0, whole(total));
  const m = clamp(whole(memorized), 0, t);
  const l = clamp(whole(learning), 0, t - m);
  const dueClamped = clamp(whole(due), 0, t);
  return {
    total: t,
    memorized: m,
    learning: l,
    remaining: t - m - l,
    due: dueClamped,
    memorizedFraction: t === 0 ? 0 : m / t,
    startedFraction: t === 0 ? 0 : (m + l) / t,
    empty: m + l === 0,
  };
}

/** "0%", "<1%" (never rounds a non-zero amount down to 0%), "42%", "100%". */
export function formatPercent(fraction: number): string {
  const pct = fraction * 100;
  if (pct <= 0) return "0%";
  if (pct < 1) return "<1%";
  if (pct >= 100) return "100%";
  return `${Math.floor(pct)}%`;
}

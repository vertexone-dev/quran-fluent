import { common as enCommon } from "./en/common";
import { home as enHome } from "./en/home";
import { auth as enAuth } from "./en/auth";
import { learning as enLearning } from "./en/learning";
import { quran as enQuran } from "./en/quran";
import { dashboard as enDashboard } from "./en/dashboard";
import { memorization as enMemorization } from "./en/memorization";
import { progress as enProgress } from "./en/progress";

import { common as frCommon } from "./fr/common";
import { home as frHome } from "./fr/home";
import { auth as frAuth } from "./fr/auth";
import { learning as frLearning } from "./fr/learning";
import { quran as frQuran } from "./fr/quran";
import { dashboard as frDashboard } from "./fr/dashboard";
import { memorization as frMemorization } from "./fr/memorization";
import { progress as frProgress } from "./fr/progress";

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const en = {
  common: enCommon,
  home: enHome,
  auth: enAuth,
  learning: enLearning,
  quran: enQuran,
  dashboard: enDashboard,
  memorization: enMemorization,
  progress: enProgress,
};

export type Dictionary = typeof en;

const fr: Dictionary = {
  common: frCommon,
  home: frHome,
  auth: frAuth,
  learning: frLearning,
  quran: frQuran,
  dashboard: frDashboard,
  memorization: frMemorization,
  progress: frProgress,
};

export const dictionaries: Record<Locale, Dictionary> = { en, fr };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

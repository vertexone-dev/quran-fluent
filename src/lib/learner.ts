import { supabase } from "@/integrations/supabase/client";

export type ArabicLevel =
  "complete_beginner" | "knows_alphabet" | "reads_slowly" | "reads_quran" | "intermediate";

export type LearningGoal =
  | "read_quran"
  | "understand_quranic_arabic"
  | "improve_tajweed"
  | "memorize_quran"
  | "improve_vocabulary"
  | "combination";

export const ARABIC_LEVEL_VALUES: ArabicLevel[] = [
  "complete_beginner",
  "knows_alphabet",
  "reads_slowly",
  "reads_quran",
  "intermediate",
];

export const LEARNING_GOAL_VALUES: LearningGoal[] = [
  "read_quran",
  "understand_quranic_arabic",
  "improve_tajweed",
  "memorize_quran",
  "improve_vocabulary",
  "combination",
];

/** English fallback labels; localized labels live in the i18n dictionaries. */
export const ARABIC_LEVELS: { value: ArabicLevel; label: string; hint: string }[] = [
  { value: "complete_beginner", label: "Complete beginner", hint: "New to Arabic letters" },
  { value: "knows_alphabet", label: "I know the alphabet", hint: "Recognise letters and sounds" },
  { value: "reads_slowly", label: "I can read slowly", hint: "Still decoding word by word" },
  {
    value: "reads_quran",
    label: "I can read the Qur'an",
    hint: "Reading fluently, meaning is limited",
  },
  { value: "intermediate", label: "Intermediate Arabic", hint: "Comfortable with grammar basics" },
];

export const LEARNING_GOALS: { value: LearningGoal; label: string }[] = [
  { value: "read_quran", label: "Learn to read the Qur'an" },
  { value: "understand_quranic_arabic", label: "Understand Qur'anic Arabic" },
  { value: "improve_tajweed", label: "Improve my Tajweed" },
  { value: "memorize_quran", label: "Memorize Qur'an" },
  { value: "improve_vocabulary", label: "Improve vocabulary" },
  { value: "combination", label: "A combination of these" },
];

export const DAILY_GOALS = [5, 10, 15, 30];

/** Interface languages. Architecture supports adding locales without code changes elsewhere. */
export const INTERFACE_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

export type LearnerSnapshot = {
  profile: {
    id: string;
    first_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    interface_language: string;
    theme: string;
  } | null;
  preferences: {
    arabic_level: ArabicLevel | null;
    primary_goal: LearningGoal | null;
    daily_goal_minutes: number;
    preferred_translation: string;
    preferred_reciter: string;
    onboarding_completed: boolean;
  } | null;
  streak: {
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
  } | null;
};

export async function fetchLearnerSnapshot(userId: string): Promise<LearnerSnapshot> {
  const [profile, preferences, streak] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("learning_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    profile: (profile.data as LearnerSnapshot["profile"]) ?? null,
    preferences: (preferences.data as LearnerSnapshot["preferences"]) ?? null,
    streak: (streak.data as LearnerSnapshot["streak"]) ?? null,
  };
}

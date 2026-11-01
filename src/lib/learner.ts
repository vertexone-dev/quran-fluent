import { supabase } from "@/integrations/supabase/client";

/**
 * Every consumer of `["learner", user.id]` (AyahReader, AyahPlayButton,
 * Dashboard, Settings, Progress, the learning plan) must use this exact
 * same `staleTime`, or the shared cache entry behaves inconsistently
 * depending on which observer happens to mount first.
 *
 * Root-caused for CI #163: AyahReader and AyahPlayButton both query this
 * identical key, but AyahPlayButton only exists once the (independent)
 * `ayahs` query resolves and mounts the ayah list -- by then, AyahReader's
 * own earlier-mounted observer has frequently already settled this query.
 * With the default `staleTime: 0`, settled-but-still-fresh data is
 * immediately "stale" to a newly-subscribing observer, so AyahPlayButton's
 * mount triggered its own redundant background refetch of data that had
 * already arrived correctly moments before (confirmed live via a traced
 * repro: fetchLearnerSnapshot called twice, once from each component,
 * seconds apart). The learner's resolved reciter/translation preference
 * was never actually wrong in that window -- the cache already held the
 * real, correct value -- but the pointless second round-trip is exactly
 * what made 46-audio-preferred-reciter.spec.ts's "still loading" assertion
 * racy: whether that assertion ever observes the loading state depends on
 * which of the two identically-keyed queries happens to resolve first.
 *
 * 10s comfortably covers that intra-page-load race (measured well under
 * 2s between the two mounts) without meaningfully risking stale data for
 * real use: the other known mutation that changes this data outside of
 * Settings' own save flow (daily.tsx's touchStreak, via logStudySession)
 * explicitly invalidates `["learner", user.id]` once the write lands, the
 * same way Settings' own save flow does
 * (`queryClient.invalidateQueries({ queryKey: ["learner", user.id] })`),
 * so both mutation paths force a fresh fetch regardless of staleTime.
 */
export const LEARNER_SNAPSHOT_STALE_TIME_MS = 10_000;

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
    // Was missing here even though the query below already selects it
    // (select("*")) -- this is a type gap, not a missing fetch, but it's
    // exactly why no consumer could read it: settings.index.tsx's loading
    // effect never populated its toggle from this field, so the toggle
    // always showed its own useState(true) default instead of the real
    // saved value.
    show_transliteration: boolean;
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

  // None of the three results' `.error` was ever checked here -- a failed
  // request (network failure, or a real RLS/Postgres error) still resolves
  // with `.data: null`, not a rejected promise, so this always returned a
  // "successful" all-null snapshot instead of ever throwing. Every caller
  // that branches on useQuery's `isError` (Settings' own error state,
  // added alongside this fix) never saw it: react-query only sets isError
  // when the query *function* throws. Surfacing the real error here is
  // also why Settings previously fell through to its form with every
  // field blank instead of the learner's real values on any transient
  // failure -- a Save from there would have overwritten real preferences.
  if (profile.error) throw profile.error;
  if (preferences.error) throw preferences.error;
  if (streak.error) throw streak.error;

  return {
    profile: (profile.data as LearnerSnapshot["profile"]) ?? null,
    preferences: (preferences.data as LearnerSnapshot["preferences"]) ?? null,
    streak: (streak.data as LearnerSnapshot["streak"]) ?? null,
  };
}

// A profile whose owner never set a real name can carry their email
// address in profiles.display_name (a Supabase-side default for plain
// email/password signups with no full_name in auth metadata) -- greeting
// a learner with their own email back at them reads as broken, not
// personal, so that case falls back to `fallback` like a genuinely empty
// name would. Presentation-only: neither profiles.first_name nor
// display_name is ever written by this.
export function resolveGreetingName(rawName: string | null | undefined, fallback: string): string {
  return rawName && !rawName.includes("@") ? rawName : fallback;
}

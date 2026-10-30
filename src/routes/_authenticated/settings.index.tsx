import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useI18n, LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
import { fetchLearnerSnapshot } from "@/lib/learner";
import { KAZIMIRSKI_EDITION_ID } from "@/lib/kazimirski";
import { resolvePreferredTranslationLocale } from "@/lib/quran";
import { PICKTHALL_EDITION_ID } from "@/lib/translations";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [
      { title: "Settings — QuranRoots" },
      { name: "description", content: "Profile, learning goals, display and account settings." },
      { property: "og:title", content: "Settings — QuranRoots" },
      { property: "og:description", content: "Manage your QuranRoots preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Settings,
});

// Both values below are the exact edition_identifier the reader's
// resolvePreferredTranslationLocale (src/lib/quran.ts) recognizes --
// picking one tells the Qur'an reader which governed translation to show,
// independently of the interface-language <Select> above. French was
// previously left out of this list under the assumption that "no approved
// French source exists yet"; that was only ever true of the disputed
// Hamidullah edition (fr.hamidullah-crf) -- the governed Kazimirski
// (1869) source this reader already serves under a French interface (see
// resolveApprovedFrenchSource) was always a legitimate option here, just
// never wired up to the reader until now.
const TRANSLATIONS = [
  { value: PICKTHALL_EDITION_ID, label: "English — Pickthall" },
  { value: KAZIMIRSKI_EDITION_ID, label: "French — Kazimirski (1869)" },
];

const RECITERS = [
  { value: "mishary_alafasy", label: "Mishary Rashid Alafasy" },
  { value: "abdulbasit_murattal", label: "Abdul Basit (Murattal)" },
  { value: "husary", label: "Mahmoud Khalil Al-Husary" },
];

function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["learner", user?.id],
    queryFn: () => fetchLearnerSnapshot(user!.id),
    enabled: Boolean(user?.id),
    // Default retry (3 attempts, exponential backoff) left every field
    // below stuck on its empty default for a long, silent stretch before
    // ever giving up -- worse, once it did give up, this page had no
    // isError branch at all (unlike Notes' established pattern below), so
    // it just rendered the form pre-filled with those defaults instead of
    // the learner's real saved values. A learner who hit Save at that
    // point would have overwritten their real preferences with blanks.
    // One retry surfaces the real error-state branch in a few seconds
    // instead of leaving the account's data one accidental Save away from
    // being clobbered. refetchOnReconnect stays off for this one: its
    // default (true) restarts the retry count from zero on every
    // reconnect event the browser fires, which compounds badly with any
    // source of reconnect churn and defeats a short, predictable retry
    // count -- this query already re-runs from Settings' own Retry button
    // and from React Query's normal invalidation after Save.
    retry: 1,
    refetchOnReconnect: false,
  });

  // Read inside the data-triggered effect below instead of the reactive
  // `locale` value directly, so that effect never needs `locale` in its
  // dependency array -- it stays keyed on `data` alone. `locale` can
  // change while Settings is mounted (the header's LanguageSwitcher isn't
  // scoped to this page), and re-running the whole effect on every such
  // change would re-apply every other field from `data` too, clobbering
  // any in-progress edit (e.g. a half-typed First Name) that has nothing
  // to do with locale.
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const [firstName, setFirstName] = useState("");
  const [language, setLanguage] = useState<Locale>(locale);
  const [translation, setTranslation] = useState(PICKTHALL_EDITION_ID);
  const [reciter, setReciter] = useState("mishary_alafasy");
  const [transliteration, setTransliteration] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFirstName(data.profile?.first_name ?? "");
    const saved = data.profile?.interface_language;
    setLanguage(saved === "fr" ? "fr" : "en");
    // Must show exactly what the reader will actually use for this saved
    // value right now -- never a fixed id. A real saved preference
    // (Pickthall or Kazimirski) round-trips through
    // resolvePreferredTranslationLocale unchanged; the legacy "en_sahih"
    // schema default and a genuinely unset preference both fall back to
    // the *current* interface locale (the same value the reader itself
    // reads), not a fixed default -- otherwise this dropdown could show
    // "Pickthall" while a French-interface learner with the untouched
    // default is actually being served Kazimirski.
    const savedTranslation = data.preferences?.preferred_translation;
    const effectiveTranslationLocale = resolvePreferredTranslationLocale(
      savedTranslation,
      localeRef.current,
    );
    setTranslation(
      effectiveTranslationLocale === "fr" ? KAZIMIRSKI_EDITION_ID : PICKTHALL_EDITION_ID,
    );
    setReciter(data.preferences?.preferred_reciter ?? "mishary_alafasy");
    setDailyGoal(data.preferences?.daily_goal_minutes ?? 10);
  }, [data]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const [profileResult, prefsResult] = await Promise.all([
      supabase
        .from("profiles")
        .update({ first_name: firstName, interface_language: language, theme })
        .eq("id", user.id),
      supabase
        .from("learning_preferences")
        .update({
          preferred_translation: translation,
          preferred_reciter: reciter,
          show_transliteration: transliteration,
          daily_goal_minutes: dailyGoal,
        })
        .eq("user_id", user.id),
    ]);
    setSaving(false);

    if (profileResult.error || prefsResult.error) {
      toast.error(t("learning.settings.saveError"));
      return;
    }
    setLocale(language);
    await queryClient.invalidateQueries({ queryKey: ["learner", user.id] });
    toast.success(t("learning.settings.saved"));
  }

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  // Never fall through to the form on a failed load: every field below is
  // seeded from `data` (see the effect above), so rendering the form
  // anyway would show empty/default values in place of the learner's real
  // saved preferences, one Save click away from overwriting them.
  if (isError) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Card className="shadow-soft">
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-muted-foreground">{t("learning.settings.error.title")}</p>
            <Button variant="secondary" onClick={() => void refetch()}>
              {t("learning.settings.error.retry")}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("learning.settings.title")}</h1>

      <div className="mt-8 space-y-6">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">{t("learning.settings.profile")}</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="first-name">{t("learning.settings.firstName")}</Label>
              <Input
                id="first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">{t("learning.settings.interfaceLanguage")}</Label>
              <Select value={language} onValueChange={(value) => setLanguage(value as Locale)}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LOCALES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {LOCALE_LABELS[code].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{t("learning.settings.languageHint")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">{t("learning.settings.quranDisplay")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="daily-goal">{t("learning.settings.dailyGoalMinutes")}</Label>
              <Input
                id="daily-goal"
                type="number"
                min={1}
                max={240}
                value={dailyGoal}
                // min/max are only an HTML/spinner hint -- direct keyboard
                // entry (or the previous `|| 1` fallback, which only ever
                // caught an empty/non-numeric field) bypassed both, and
                // whatever came out of here was written straight to
                // daily_goal_minutes on Save with nothing else in the
                // path re-checking it. Confirmed by typing "99999" here:
                // it saved to the database unchanged.
                onChange={(event) =>
                  setDailyGoal(Math.min(240, Math.max(1, Number(event.target.value) || 1)))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="translation">{t("learning.settings.preferredTranslation")}</Label>
              <Select value={translation} onValueChange={setTranslation}>
                <SelectTrigger id="translation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSLATIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reciter">{t("learning.settings.preferredReciter")}</Label>
              <Select value={reciter} onValueChange={setReciter}>
                <SelectTrigger id="reciter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECITERS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
              <Label htmlFor="transliteration" className="cursor-pointer">
                {t("learning.settings.showTransliteration")}
              </Label>
              <Switch
                id="transliteration"
                checked={transliteration}
                onCheckedChange={setTransliteration}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">{t("learning.settings.appearance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="theme">{t("common.theme.label")}</Label>
              <Select value={theme} onValueChange={(value) => setTheme(value as ThemeMode)}>
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("common.theme.light")}</SelectItem>
                  <SelectItem value="dark">{t("common.theme.dark")}</SelectItem>
                  <SelectItem value="system">{t("common.theme.system")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">{t("learning.settings.security")}</CardTitle>
            <CardDescription>{t("learning.settings.securityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!user?.email) return;
                const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else toast.success(t("learning.settings.resetSent"));
              }}
            >
              {t("learning.settings.sendReset")}
            </Button>
          </CardContent>
        </Card>

        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? t("common.actions.saving") : t("common.actions.save")}
        </Button>
      </div>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/_authenticated/settings")({
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

// French removed: no approved French translation source exists yet (the
// prior fr_hamidullah option pointed at a disputed, unlicensed edition --
// see the fr.hamidullah-crf content_sources migration). Add it back only
// once a governed French source is approved.
const TRANSLATIONS = [{ value: "en_sahih", label: "English — Saheeh International" }];

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

  const { data, isLoading } = useQuery({
    queryKey: ["learner", user?.id],
    queryFn: () => fetchLearnerSnapshot(user!.id),
    enabled: Boolean(user?.id),
  });

  const [firstName, setFirstName] = useState("");
  const [language, setLanguage] = useState<Locale>(locale);
  const [translation, setTranslation] = useState("en_sahih");
  const [reciter, setReciter] = useState("mishary_alafasy");
  const [transliteration, setTransliteration] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFirstName(data.profile?.first_name ?? "");
    const saved = data.profile?.interface_language;
    setLanguage(saved === "fr" ? "fr" : "en");
    setTranslation(data.preferences?.preferred_translation ?? "en_sahih");
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
                onChange={(event) => setDailyGoal(Number(event.target.value) || 1)}
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

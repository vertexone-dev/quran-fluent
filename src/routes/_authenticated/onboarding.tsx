import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
import {
  ARABIC_LEVEL_VALUES,
  DAILY_GOALS,
  LEARNING_GOAL_VALUES,
  type ArabicLevel,
  type LearningGoal,
} from "@/lib/learner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your learning plan — QuranRoots" },
      { name: "description", content: "Tell us your Arabic level, goal and daily study target." },
      { property: "og:title", content: "Set up your learning plan — QuranRoots" },
      { property: "og:description", content: "Personalize your Qur'anic Arabic journey." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

type Choice = { label: string; hint?: string; selected: boolean; onSelect: () => void };

function ChoiceList({ options, columns = 1 }: { options: Choice[]; columns?: number }) {
  return (
    <div className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}>
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={option.onSelect}
          aria-pressed={option.selected}
          className={cn(
            "min-h-12 rounded-xl border p-4 text-left transition-colors",
            option.selected
              ? "border-primary bg-primary/10"
              : "border-border bg-card hover:bg-accent",
          )}
        >
          <span className="block font-medium text-foreground">{option.label}</span>
          {option.hint && (
            <span className="mt-1 block text-sm text-muted-foreground">{option.hint}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, d, locale, setLocale } = useI18n();
  const copy = d.learning.onboarding;

  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<ArabicLevel | null>(null);
  const [goal, setGoal] = useState<LearningGoal | null>(null);
  const [minutes, setMinutes] = useState<number>(10);
  const [customMinutes, setCustomMinutes] = useState("");
  const [language, setLanguage] = useState<Locale>(locale);
  const [saving, setSaving] = useState(false);

  const steps = copy.steps;
  const canContinue = [level !== null, goal !== null, minutes > 0, Boolean(language)][step];

  async function finish() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("learning_preferences")
      .update({
        arabic_level: level,
        primary_goal: goal,
        daily_goal_minutes: minutes,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);

    if (!error) {
      await supabase.from("profiles").update({ interface_language: language }).eq("id", user.id);
      setLocale(language);
    }
    setSaving(false);

    if (error) {
      toast.error(copy.error);
      return;
    }
    toast.success(copy.saved);
    // Placement is optional; the test page offers "Skip for now".
    navigate({ to: "/placement" });
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <p className="text-sm text-muted-foreground">
        {t("learning.onboarding.stepOf", { current: step + 1, total: steps.length })}
      </p>
      <Progress value={((step + 1) / steps.length) * 100} className="mt-3" />

      <Card className="mt-6 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display text-2xl">{steps[step]}</CardTitle>
          <CardDescription>{copy.intro}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 0 && (
            <ChoiceList
              options={ARABIC_LEVEL_VALUES.map((value) => ({
                label: t(`learning.levels.${value}.label`),
                hint: t(`learning.levels.${value}.hint`),
                selected: level === value,
                onSelect: () => setLevel(value),
              }))}
            />
          )}

          {step === 1 && (
            <ChoiceList
              columns={2}
              options={LEARNING_GOAL_VALUES.map((value) => ({
                label: t(`learning.goals.${value}`),
                selected: goal === value,
                onSelect: () => setGoal(value),
              }))}
            />
          )}

          {step === 2 && (
            <div className="space-y-4">
              <ChoiceList
                columns={2}
                options={DAILY_GOALS.map((value) => ({
                  label: t("learning.onboarding.minutesPerDay", { count: value }),
                  selected: minutes === value && customMinutes === "",
                  onSelect: () => {
                    setMinutes(value);
                    setCustomMinutes("");
                  },
                }))}
              />
              <div className="space-y-2">
                <Label htmlFor="custom-minutes">{copy.custom}</Label>
                <Input
                  id="custom-minutes"
                  type="number"
                  min={1}
                  max={240}
                  value={customMinutes}
                  onChange={(event) => {
                    setCustomMinutes(event.target.value);
                    const parsed = Number(event.target.value);
                    if (Number.isFinite(parsed) && parsed > 0) setMinutes(parsed);
                  }}
                  placeholder={copy.customPlaceholder}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <ChoiceList
              columns={2}
              options={SUPPORTED_LOCALES.map((code) => ({
                label: LOCALE_LABELS[code].label,
                selected: language === code,
                onSelect: () => {
                  setLanguage(code);
                  // Preview the choice immediately so the rest of onboarding is in that language.
                  setLocale(code);
                },
              }))}
            />
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              {t("common.actions.back")}
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((current) => current + 1)} disabled={!canContinue}>
                {t("common.actions.continue")}
              </Button>
            ) : (
              <Button onClick={finish} disabled={!canContinue || saving}>
                {saving ? t("common.actions.saving") : copy.finish}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

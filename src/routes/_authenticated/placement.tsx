import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  PLACEMENT_LEVELS,
  PLACEMENT_QUESTIONS,
  saveLearningPath,
  savePlacementAttempt,
  scorePlacement,
  type PlacementLevel,
  type PlacementResult,
} from "@/lib/placement";
import { seedFromPlacement } from "@/lib/study";

export const Route = createFileRoute("/_authenticated/placement")({
  head: () => ({
    meta: [
      { title: "Placement test — QuranRoots" },
      {
        name: "description",
        content: "A short assessment that sets your Qur'anic Arabic starting point.",
      },
      { property: "og:title", content: "Placement test — QuranRoots" },
      { property: "og:description", content: "Find your level in about four minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Placement,
});

function Placement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, d } = useI18n();
  const copy = d.learning.placement;

  const [stage, setStage] = useState<"intro" | "test" | "result">("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | undefined>>({});
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [chosen, setChosen] = useState<PlacementLevel | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const question = PLACEMENT_QUESTIONS[index]!;
  const options =
    question.literalOptions ?? copy.options[question.id as keyof typeof copy.options] ?? [];
  const answered = answers[question.id] !== undefined;

  async function finish(finalAnswers: Record<string, number | undefined>) {
    const scored = scorePlacement(finalAnswers);
    setResult(scored);
    setChosen(scored.level);
    setStage("result");
    if (user) {
      try {
        await savePlacementAttempt(user.id, finalAnswers, scored);
        await seedFromPlacement(user.id, scored);
      } catch {
        toast.error(copy.error);
      }
    }
  }

  async function startPath(level: PlacementLevel) {
    if (!user) return;
    setSaving(true);
    try {
      await saveLearningPath(user.id, level, result ? "placement" : "manual");
      toast.success(copy.saved);
      navigate({ to: "/learning-plan" });
    } catch {
      toast.error(copy.error);
    } finally {
      setSaving(false);
    }
  }

  if (stage === "intro") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card className="shadow-soft">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              {copy.optional}
            </Badge>
            <CardTitle className="font-display text-2xl">{copy.title}</CardTitle>
            <CardDescription>{copy.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">{copy.intro}</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setStage("test")}>
                <ClipboardCheck className="size-4" aria-hidden />
                {copy.start}
              </Button>
              <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>
                {copy.skip}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (stage === "test") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <p className="text-sm text-muted-foreground">
          {t("learning.placement.questionOf", {
            current: index + 1,
            total: PLACEMENT_QUESTIONS.length,
          })}
        </p>
        <Progress value={((index + 1) / PLACEMENT_QUESTIONS.length) * 100} className="mt-3" />

        <Card className="mt-6 shadow-soft">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              {copy.sections[question.section]}
            </Badge>
            <CardTitle className="font-display text-xl">
              {copy.questions[question.id as keyof typeof copy.questions]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {question.arabic && (
              <p
                dir="rtl"
                lang="ar"
                className="font-quran text-4xl leading-relaxed text-foreground"
              >
                {question.arabic}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((option, optionIndex) => {
                const selected = answers[question.id] === optionIndex;
                const isArabic = Boolean(question.literalOptions);
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setAnswers((current) => ({ ...current, [question.id]: optionIndex }))
                    }
                    className={cn(
                      "min-h-12 rounded-xl border p-4 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "font-medium text-foreground",
                        isArabic && "font-arabic text-xl",
                      )}
                    >
                      {option}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                disabled={index === 0}
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
              >
                {t("common.actions.back")}
              </Button>
              {index < PLACEMENT_QUESTIONS.length - 1 ? (
                <Button disabled={!answered} onClick={() => setIndex((current) => current + 1)}>
                  {t("common.actions.continue")}
                </Button>
              ) : (
                <Button disabled={!answered} onClick={() => void finish(answers)}>
                  {copy.resultTitle}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const level = chosen ?? result?.level ?? "complete_beginner";
  const areas = (result?.weakSections ?? []).map((section) => copy.sections[section]).join(", ");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card className="shadow-soft">
        <CardHeader>
          <CardDescription>{copy.resultTitle}</CardDescription>
          <CardTitle className="font-display text-2xl">{copy.levels[level].label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {result && (
            <Badge variant="secondary">
              {t("learning.placement.scoreLine", { score: result.score, total: result.total })}
            </Badge>
          )}
          <div>
            <h2 className="text-sm font-semibold text-foreground">{copy.reasonLabel}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {areas ? t("learning.placement.reasonWeak", { areas }) : copy.reasonStrong}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{copy.levels[level].blurb}</p>
          </div>

          {picking && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{copy.chooseTitle}</h2>
              <p className="text-sm text-muted-foreground">{copy.chooseHint}</p>
              <div className="grid gap-3">
                {PLACEMENT_LEVELS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={chosen === value}
                    onClick={() => setChosen(value)}
                    className={cn(
                      "min-h-12 rounded-xl border p-4 text-left transition-colors",
                      chosen === value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-accent",
                    )}
                  >
                    <span className="block font-medium text-foreground">
                      {copy.levels[value].label}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {copy.levels[value].blurb}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button disabled={saving} onClick={() => void startPath(level)}>
              {copy.startRecommended}
            </Button>
            {!picking && (
              <Button variant="secondary" onClick={() => setPicking(true)}>
                {copy.chooseAnother}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

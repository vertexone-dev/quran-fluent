import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Clock, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { findLevel1EntryPoint, pickLocale, type CurriculumEntryPoint } from "@/lib/curriculum";
import { fetchLearningPath, nextStep } from "@/lib/placement";
import {
  type DailyStudyItem,
  type ReviewItem,
  getTodaysStudy,
  logStudySession,
  recordPracticeAttempt,
  seedStarterItemsForStep,
} from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/daily")({
  head: () => ({
    meta: [
      { title: "Today's study — QuranRoots" },
      { name: "description", content: "Your personalized daily study session." },
      { property: "og:title", content: "Today's study — QuranRoots" },
      { property: "og:description", content: "Review, weak areas and next step in one session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DailyStudy,
});

function DailyStudy() {
  const { user } = useAuth();
  const { t, d, locale } = useI18n();
  const copy = d.learning.daily;

  const [items, setItems] = useState<DailyStudyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [attemptedCount, setAttemptedCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [lessonEntryPoint, setLessonEntryPoint] = useState<CurriculumEntryPoint | null>(null);
  const loggedRef = useRef(false);

  const learnerId = user?.id ?? null;

  // Timer stops once the session is finished so the elapsed time (and the
  // logged minutes) are frozen at the moment the learner completed the queue.
  useEffect(() => {
    if (finished) return;
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime) / 1000)),
      1000,
    );
    return () => clearInterval(interval);
  }, [startTime, finished]);

  useEffect(() => {
    if (!learnerId) return;
    let cancelled = false;
    async function load(id: string) {
      setLoading(true);
      setLoadError(false);
      try {
        const [path, entryPoint] = await Promise.all([
          fetchLearningPath(id),
          findLevel1EntryPoint(id),
        ]);
        const step = nextStep(path)?.step_key ?? null;
        // The 'alphabet' step now has real, lesson-seeded review items
        // (Sub-phase 2.5) — seeding the old hardcoded starter flashcards
        // for it too would just create confusing, duplicate cards for the
        // same letters. Other steps still have no real content, so their
        // starter seed remains the only thing they can offer.
        if (step && step !== "alphabet") {
          await seedStarterItemsForStep(id, step);
        }
        const queue = await getTodaysStudy(id, step, 12, entryPoint);
        if (!cancelled) {
          setItems(queue);
          setLessonEntryPoint(entryPoint);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load(learnerId);
    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  // Guarded by a ref: the effect used to depend on `elapsed`, which ticks every
  // second, so a finished session inserted a study_sessions row per second.
  useEffect(() => {
    if (!finished || !learnerId || loggedRef.current) return;
    loggedRef.current = true;
    const minutes = Math.max(1, Math.round(elapsed / 60));
    void logStudySession(learnerId, "daily", minutes);
  }, [finished, learnerId, elapsed]);

  if (!user) return null;

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card className="shadow-soft">
          <CardContent className="space-y-4 py-16 text-center">
            <p className="text-muted-foreground">{t("common.errors.loadFailed")}</p>
            <Button onClick={() => window.location.reload()}>{t("common.errors.tryAgain")}</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card className="shadow-soft">
          <CardContent className="py-20 text-center">
            <p className="text-muted-foreground">{copy.loading}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Distinct from "never took placement": this learner has a real
  // curriculum entry point and has finished every lesson currently
  // authored for it — an honest, positive state, not a placement prompt.
  const allLessonsComplete =
    lessonEntryPoint !== null && lessonEntryPoint.completedCount === lessonEntryPoint.totalCount;
  const hasIncompleteLesson =
    lessonEntryPoint !== null && lessonEntryPoint.completedCount < lessonEntryPoint.totalCount;

  if (finished) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{copy.done}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatBox label={copy.stats.attempted} value={attemptedCount} />
              <StatBox label={copy.stats.correct} value={correctCount} />
              <StatBox label={copy.stats.time} value={formatTime(elapsed)} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/dashboard">{copy.backToDashboard}</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/practice">{copy.morePractice}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Reviews are done; the recommended lesson (if any) is presented
            here rather than as a queue item — it's a one-way exit into the
            real Lesson Player, never something this queue can mark
            "answered" (see getTodaysStudy in src/lib/study.ts). */}
        {hasIncompleteLesson && (
          <div className="mt-4">
            <LessonCard lesson={lessonEntryPoint} copy={copy} d={d} locale={locale} />
          </div>
        )}
      </main>
    );
  }

  if (items.length === 0) {
    if (hasIncompleteLesson) {
      return (
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="sr-only">{copy.title}</h1>
          <LessonCard lesson={lessonEntryPoint} copy={copy} d={d} locale={locale} />
        </main>
      );
    }
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card className="shadow-soft">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {allLessonsComplete ? copy.allLessonsComplete : copy.empty}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {allLessonsComplete ? (
                <Button asChild>
                  <Link to="/learning-plan">{copy.viewLearningPlan}</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/placement">{copy.takePlacement}</Link>
                </Button>
              )}
              <Button variant="secondary" asChild>
                <Link to="/dashboard">{copy.backToDashboard}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const current = items[index];
  const progress = ((index + (flipped ? 1 : 0)) / items.length) * 100;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="sr-only">{copy.title}</h1>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard">
            <ChevronLeft className="size-4" />
            {copy.back}
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden />
          {formatTime(elapsed)}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {t("learning.daily.itemOf", { current: index + 1, total: items.length })}
      </p>
      <Progress value={progress} className="mt-2" />

      <div className="mt-6">
        {current?.kind === "review" && (
          <ReviewCard
            item={current.item}
            flipped={flipped}
            onFlip={() => setFlipped(true)}
            onAnswer={(correct) => void handleReviewAnswer(current.item, correct)}
            t={t}
            d={d}
          />
        )}
        {current?.kind === "weak_area" && (
          <WeakAreaCard area={current.area} onContinue={handleWeakAreaContinue} t={t} copy={copy} />
        )}
        {current?.kind === "path_preview" && (
          <PathPreviewCard
            step={current.step_key}
            onContinue={handlePathPreviewContinue}
            t={t}
            d={d}
          />
        )}
      </div>
    </main>
  );

  async function handleReviewAnswer(item: ReviewItem, correct: boolean) {
    if (!user) return;
    setAttemptedCount((c) => c + 1);
    if (correct) setCorrectCount((c) => c + 1);
    try {
      await recordPracticeAttempt(user.id, item, correct);
    } catch {
      toast.error(copy.error);
    }
    advance();
  }

  function handleWeakAreaContinue() {
    advance();
  }

  function handlePathPreviewContinue() {
    advance();
  }

  function advance() {
    setFlipped(false);
    if (index >= items.length - 1) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
    }
  }
}

function ReviewCard({
  item,
  flipped,
  onFlip,
  onAnswer,
  t,
  d,
}: {
  item: ReviewItem;
  flipped: boolean;
  onFlip: () => void;
  onAnswer: (correct: boolean) => void;
  t: ReturnType<typeof useI18n>["t"];
  d: ReturnType<typeof useI18n>["d"];
}) {
  const isArabic = /[\u0600-\u06FF]/.test(item.front);
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-10 text-center">
        <div className="min-h-48">
          <p
            className={cn(
              "font-display text-3xl font-semibold text-foreground",
              isArabic && "font-quran text-5xl",
            )}
            dir={isArabic ? "rtl" : "ltr"}
            lang={isArabic ? "ar" : undefined}
          >
            {flipped ? item.back : item.front}
          </p>
          {flipped && item.context && (
            <p className="mt-4 text-sm text-muted-foreground">{item.context}</p>
          )}
          {!flipped && (
            <p className="mt-6 text-sm text-muted-foreground">{d.learning.daily.tapReveal}</p>
          )}
        </div>

        {!flipped ? (
          <Button className="mt-6" onClick={onFlip}>
            {d.learning.daily.reveal}
          </Button>
        ) : (
          <div className="mt-8 flex justify-center gap-4">
            <Button variant="outline" onClick={() => onAnswer(false)}>
              <X className="size-4" />
              {t("common.actions.hard")}
            </Button>
            <Button onClick={() => onAnswer(true)}>
              <Check className="size-4" />
              {t("common.actions.easy")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WeakAreaCard({
  area,
  onContinue,
  t,
  copy,
}: {
  area: { area: string; strength: number };
  onContinue: () => void;
  t: ReturnType<typeof useI18n>["t"];
  copy: (typeof useI18n extends (...args: unknown[]) => infer R
    ? R
    : never)["d"]["learning"]["daily"];
}) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="font-display text-xl">{copy.weakAreaTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg font-semibold text-foreground">{area.area}</p>
        <Progress value={area.strength} />
        <p className="text-sm text-muted-foreground">
          {t("learning.daily.weakAreaStrength", { strength: area.strength })}
        </p>
        <p className="text-sm text-muted-foreground">{copy.weakAreaNote}</p>
        <Button onClick={onContinue}>{copy.markPracticed}</Button>
      </CardContent>
    </Card>
  );
}

/**
 * Unlike every other card here, answering this one means leaving the
 * queue entirely — the click navigates to the real Lesson Player rather
 * than advancing a local index, since actual lesson progress/completion
 * is tracked by that page, not by this queue (Sub-phase 2.7).
 */
function LessonCard({
  lesson,
  copy,
  d,
  locale,
}: {
  lesson: CurriculumEntryPoint;
  copy: ReturnType<typeof useI18n>["d"]["learning"]["daily"];
  d: ReturnType<typeof useI18n>["d"];
  locale: "en" | "fr";
}) {
  const title = pickLocale(lesson.titleEn, lesson.titleFr, locale);
  const inProgress = lesson.completedCount > 0;
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="font-display text-xl">{copy.lessonCardTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">
          {copy.lessonProgress
            .replace("{completed}", String(lesson.completedCount))
            .replace("{total}", String(lesson.totalCount))}
        </p>
        <Button asChild>
          <Link to="/lesson/$lessonId" params={{ lessonId: lesson.lessonId }}>
            {inProgress ? d.learning.path.continueLesson : d.learning.path.openLesson}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PathPreviewCard({
  step,
  onContinue,
  t,
  d,
}: {
  step: string;
  onContinue: () => void;
  t: ReturnType<typeof useI18n>["t"];
  d: ReturnType<typeof useI18n>["d"];
}) {
  const meta = d.learning.path.steps[step as keyof typeof d.learning.path.steps];
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="font-display text-xl">{meta?.label ?? step}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{meta?.blurb}</p>
        <p className="text-sm text-muted-foreground">{t("learning.daily.pathPreviewNote")}</p>
        <Button onClick={onContinue}>{t("common.actions.continue")}</Button>
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

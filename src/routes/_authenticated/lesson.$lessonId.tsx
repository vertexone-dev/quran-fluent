import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { LessonSectionRenderer } from "@/components/learning/LessonSectionRenderer";
import { LessonExerciseRenderer } from "@/components/learning/LessonExerciseRenderer";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  buildPlayerSteps,
  clampStepIndex,
  computeProgressPercent,
  createSerialLatestQueue,
  fetchLessonForPlayer,
  fetchLessonProgress,
  isLastStep,
  upsertLessonProgressCompleted,
  upsertLessonProgressInProgress,
  type PlayerStep,
} from "@/lib/curriculum";
import { seedLessonReviewItems } from "@/lib/study";

export const Route = createFileRoute("/_authenticated/lesson/$lessonId")({
  head: () => ({
    meta: [{ title: "Lesson — QuranRoots" }, { name: "robots", content: "noindex" }],
  }),
  component: LessonPlayerRoute,
});

const PLACEHOLDER_SLUG = "schema-validation-placeholder";

function LessonPlayerRoute() {
  const { lessonId } = Route.useParams();
  const { user } = useAuth();
  const { locale, t, d } = useI18n();
  const copy = d.learning.lesson;

  const {
    data: lesson,
    isLoading: lessonLoading,
    isError: lessonErrored,
  } = useQuery({
    queryKey: ["lesson-player", lessonId, locale],
    queryFn: () => fetchLessonForPlayer(lessonId, locale),
  });

  const {
    data: progress,
    isLoading: progressLoading,
    refetch: refetchProgress,
  } = useQuery({
    queryKey: ["lesson-progress", user?.id, lessonId],
    queryFn: () => fetchLessonProgress(user!.id, lessonId),
    enabled: Boolean(user?.id) && Boolean(lesson),
  });

  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [answeredSteps, setAnsweredSteps] = useState<Set<number>>(new Set());
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const positionQueueRef = useRef<ReturnType<typeof createSerialLatestQueue> | null>(null);
  if (!positionQueueRef.current) positionQueueRef.current = createSerialLatestQueue();

  const steps: PlayerStep[] = lesson ? buildPlayerSteps(lesson.sections, lesson.exercises) : [];
  const totalSteps = steps.length;

  // Resolve initial position exactly once, after both the lesson and its
  // progress row (if any) have loaded — never re-runs on later re-fetches,
  // so it can't fight with the learner's own navigation.
  useEffect(() => {
    if (initializedRef.current || !lesson || progressLoading || !user?.id) return;
    initializedRef.current = true;

    if (progress?.status === "completed") {
      setCompleted(true);
      setStartedAt(progress.started_at);
      return;
    }

    if (progress) {
      setStepIndex(clampStepIndex(progress.last_section_index, totalSteps));
      setStartedAt(progress.started_at);
      return;
    }

    // First meaningful interaction: opening a not-yet-started lesson.
    const now = new Date().toISOString();
    setStartedAt(now);
    positionQueueRef.current!.enqueue(() =>
      upsertLessonProgressInProgress(
        user.id,
        lessonId,
        0,
        computeProgressPercent(0, totalSteps),
        now,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, progress, progressLoading, user?.id]);

  if (lessonLoading || (Boolean(user?.id) && progressLoading && !initializedRef.current)) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-6 h-64 w-full" />
      </main>
    );
  }

  if (lessonErrored) {
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

  if (!lesson) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card className="shadow-soft">
          <CardContent className="space-y-4 py-16 text-center">
            <h1 className="font-display text-xl font-semibold">{copy.notFound.title}</h1>
            <p className="text-muted-foreground">{copy.notFound.body}</p>
            <Button asChild>
              <Link to="/learning-plan">{copy.notFound.backToLearningPlan}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!user) return null;

  const title = lesson.title;
  const moduleTitle = lesson.module.title;
  const isPlaceholder = lesson.slug === PLACEHOLDER_SLUG;

  if (completed) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <PartyPopper className="size-6 text-gold" aria-hidden />
              {copy.completion.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">{copy.completion.body}</p>
            <Button asChild>
              <Link to="/learning-plan">{copy.completion.backToLearningPlan}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (totalSteps === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card className="shadow-soft">
          <CardContent className="py-16 text-center text-muted-foreground">
            {copy.empty}
          </CardContent>
        </Card>
      </main>
    );
  }

  const current = steps[stepIndex]!;
  const progressPercent = computeProgressPercent(stepIndex, totalSteps);
  const onLastStep = isLastStep(stepIndex, totalSteps);
  const currentIsUnansweredExercise = current.type === "exercise" && !answeredSteps.has(stepIndex);
  const canAdvance = !currentIsUnansweredExercise;

  function persistPosition(nextIndex: number) {
    if (!user?.id || !startedAt) return;
    positionQueueRef.current!.enqueue(() =>
      upsertLessonProgressInProgress(
        user.id,
        lessonId,
        nextIndex,
        computeProgressPercent(nextIndex, totalSteps),
        startedAt,
      ),
    );
  }

  function goPrevious() {
    setStepIndex((i) => {
      const next = Math.max(0, i - 1);
      persistPosition(next);
      return next;
    });
  }

  async function goNextOrComplete() {
    if (!canAdvance || !user?.id || !startedAt) return;
    if (onLastStep) {
      // Drain any in-flight/pending position write first -- otherwise a
      // still-settling in-progress write could resolve after this
      // completion upsert and silently revert status back to
      // "in_progress" (both writes replace the same full row).
      await positionQueueRef.current!.idle();
      await upsertLessonProgressCompleted(user.id, lessonId, totalSteps, startedAt);
      await seedLessonReviewItems(user.id, lesson!);
      await refetchProgress();
      setCompleted(true);
      return;
    }
    setStepIndex((i) => {
      const next = Math.min(totalSteps - 1, i + 1);
      persistPosition(next);
      return next;
    });
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/learning-plan">
            <ChevronLeft className="size-4" aria-hidden />
            {copy.exit}
          </Link>
        </Button>
        {isPlaceholder && <Badge variant="outline">{copy.placeholderBadge}</Badge>}
      </div>

      <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{moduleTitle}</p>

      <p className="mt-4 text-sm text-muted-foreground">
        {t("learning.lesson.stepOf", { current: stepIndex + 1, total: totalSteps })}
      </p>
      <Progress value={progressPercent} aria-label={copy.progressLabel} className="mt-2" />

      <div className="mt-6">
        {current.type === "section" && <LessonSectionRenderer section={current.section} />}
        {current.type === "exercise" && (
          <LessonExerciseRenderer
            key={current.exercise.id}
            exercise={current.exercise}
            userId={user.id}
            lessonId={lessonId}
            onAnswered={() => setAnsweredSteps((s) => new Set(s).add(stepIndex))}
          />
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={goPrevious} disabled={stepIndex === 0}>
          <ChevronLeft className="size-4" aria-hidden />
          {copy.previous}
        </Button>
        <Button onClick={() => void goNextOrComplete()} disabled={!canAdvance}>
          {onLastStep ? copy.completeLesson : copy.next}
          {!onLastStep && <ChevronRight className="size-4" aria-hidden />}
        </Button>
      </div>
    </main>
  );
}

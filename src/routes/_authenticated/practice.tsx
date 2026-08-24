import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fetchPracticeQueue, fetchPracticeSummary } from "@/lib/practice";
import {
  recordPracticeAttempt,
  type DailyStudyItem,
  type ReviewItem,
  type WeakArea,
} from "@/lib/study";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({
    meta: [
      { title: "Practice centre — QuranRoots" },
      {
        name: "description",
        content: "Vocabulary, memorization and weak-area review in one session.",
      },
      { property: "og:title", content: "Practice centre — QuranRoots" },
      { property: "og:description", content: "Targeted review that feeds your progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Practice,
});

function Practice() {
  const { user } = useAuth();
  const [inSession, setInSession] = useState(false);

  if (!user) return null;

  return inSession ? (
    <PracticeSession userId={user.id} onExit={() => setInSession(false)} />
  ) : (
    <PracticeHome userId={user.id} onStart={() => setInSession(true)} />
  );
}

function PracticeHome({ userId, onStart }: { userId: string; onStart: () => void }) {
  const { d } = useI18n();
  const p = d.learning.practice;

  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["practice-summary", userId],
    queryFn: () => fetchPracticeSummary(userId),
  });

  const total =
    (summary?.vocabularyDue ?? 0) +
    (summary?.weakAreaCount ?? 0) +
    (summary?.memorizationDue ?? 0) +
    (summary?.lettersDue ?? 0) +
    (summary?.conceptsDue ?? 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{p.title}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{p.intro}</p>

      {isLoading && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {isError && (
        <Card className="mt-8 shadow-soft">
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-muted-foreground">{p.error.title}</p>
            <Button variant="secondary" onClick={() => void refetch()}>
              {p.error.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && summary && (
        <>
          <Card className="mt-8 shadow-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{p.today.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{p.today.vocabulary}</span>
                <span className="font-medium">
                  {p.today.dueCount.replace("{count}", String(summary.vocabularyDue))}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{p.today.weakAreas}</span>
                <span className="font-medium">
                  {p.today.topicsCount.replace("{count}", String(summary.weakAreaCount))}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{p.today.memorization}</span>
                <span className="font-medium">
                  {p.today.ayatCount.replace("{count}", String(summary.memorizationDue))}
                </span>
              </div>

              {total > 0 ? (
                <Button className="mt-2 w-full" onClick={onStart}>
                  {p.today.start}
                </Button>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{p.empty.body}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

type SessionStats = { attempted: number; correct: number };

function PracticeSession({ userId, onExit }: { userId: string; onExit: () => void }) {
  const { d, t } = useI18n();
  const queryClient = useQueryClient();
  const p = d.learning.practice;

  const { data: items, isLoading } = useQuery({
    queryKey: ["practice-queue", userId],
    queryFn: () => fetchPracticeQueue(userId),
  });

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ attempted: 0, correct: 0 });
  const [startTime] = useState(() => Date.now());

  if (isLoading || !items) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (items.length === 0 || finished) {
    const elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000 / 60));
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{p.summary.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label={p.summary.reviewed} value={stats.attempted} />
              <Stat label={p.summary.correct} value={stats.correct} />
              <Stat label={p.summary.time} value={`${elapsed} min`} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/dashboard">{p.summary.backToDashboard}</Link>
              </Button>
              <Button variant="secondary" onClick={onExit}>
                {p.summary.practiceMore}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const current = items[index]!;

  function advance() {
    setFlipped(false);
    if (index >= items!.length - 1) setFinished(true);
    else setIndex((i) => i + 1);
  }

  async function handleAnswer(item: ReviewItem, correct: boolean) {
    setStats((s) => ({ attempted: s.attempted + 1, correct: s.correct + (correct ? 1 : 0) }));
    try {
      await recordPracticeAttempt(userId, item, correct);
    } catch {
      toast.error(d.common.errors.generic);
    }
    void queryClient.invalidateQueries({ queryKey: ["memorization-due-count", userId] });
    advance();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <p className="text-sm text-muted-foreground">
        {index + 1} / {items.length}
      </p>

      <div className="mt-6">
        {current.kind === "review" && (
          <ReviewCard
            item={current.item}
            flipped={flipped}
            onFlip={() => setFlipped(true)}
            onAnswer={(correct) => void handleAnswer(current.item, correct)}
            copy={p.session}
          />
        )}
        {current.kind === "weak_area" && (
          <WeakAreaCard area={current.area} onContinue={advance} copy={p.session} />
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ReviewCard({
  item,
  flipped,
  onFlip,
  onAnswer,
  copy,
}: {
  item: ReviewItem;
  flipped: boolean;
  onFlip: () => void;
  onAnswer: (correct: boolean) => void;
  copy: { reveal: string; hard: string; easy: string };
}) {
  const isArabic = /[؀-ۿ]/.test(item.front);
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-10 text-center">
        <div className="min-h-48">
          <p
            className={`font-display text-3xl font-semibold text-foreground ${isArabic ? "font-quran text-5xl" : ""}`}
            dir={isArabic ? "rtl" : "ltr"}
            lang={isArabic ? "ar" : undefined}
          >
            {flipped ? item.back : item.front}
          </p>
          {flipped && item.context && (
            <p className="mt-4 text-sm text-muted-foreground">{item.context}</p>
          )}
        </div>
        {!flipped ? (
          <Button className="mt-6" onClick={onFlip}>
            {copy.reveal}
          </Button>
        ) : (
          <div className="mt-8 flex justify-center gap-4">
            <Button variant="outline" onClick={() => onAnswer(false)}>
              <X className="size-4" aria-hidden />
              {copy.hard}
            </Button>
            <Button onClick={() => onAnswer(true)}>
              <Check className="size-4" aria-hidden />
              {copy.easy}
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
  copy,
}: {
  area: WeakArea;
  onContinue: () => void;
  copy: { markPracticed: string; weakAreaNote: string };
}) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="font-display text-xl">{area.area}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden />
          {area.strength}%
        </div>
        <p className="text-sm text-muted-foreground">{copy.weakAreaNote}</p>
        <Button onClick={onContinue}>{copy.markPracticed}</Button>
      </CardContent>
    </Card>
  );
}

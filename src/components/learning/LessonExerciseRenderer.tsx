import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import {
  evaluateExerciseAnswer,
  hasCompleteResponse,
  recordExerciseAttempt,
  type ExerciseResponse,
  type LessonExercise,
} from "@/lib/curriculum";
import { cn } from "@/lib/utils";

type Props = {
  exercise: LessonExercise;
  userId: string;
  lessonId: string;
  /** Called once, right after the attempt is recorded, so the player can
   * unlock "Next". Never called again on the same exercise instance. */
  onAnswered: (correct: boolean) => void;
};

const CHOICE_TYPES = new Set<LessonExercise["exercise_type"]>([
  "multiple_choice",
  "letter_recognition",
  "vowel_recognition",
  "reading_check",
]);

/** Deterministic-enough shuffle for a short, small array — fine for a
 * handful of matching-exercise options, not cryptographic. */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function LessonExerciseRenderer({ exercise, userId, lessonId, onAnswered }: Props) {
  const { t, d } = useI18n();
  const copy = d.learning.lesson;
  const [response, setResponse] = useState<ExerciseResponse | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [startTime] = useState(() => Date.now());

  const prompt = exercise.prompt;
  const explanation = exercise.explanation;
  const canSubmit = !submitted && hasCompleteResponse(exercise, response);

  async function handleSubmit() {
    if (!response || saving) return;
    setSaving(true);
    const isCorrect = evaluateExerciseAnswer(exercise, response);
    try {
      await recordExerciseAttempt(userId, lessonId, exercise.id, isCorrect, Date.now() - startTime);
    } finally {
      setSaving(false);
    }
    setCorrect(isCorrect);
    setSubmitted(true);
    onAnswered(isCorrect);
  }

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-5 pt-6">
        <h2 className="font-display text-lg font-semibold text-foreground">{prompt}</h2>

        {CHOICE_TYPES.has(exercise.exercise_type) && (
          <ChoiceControl
            exercise={exercise}
            response={response}
            submitted={submitted}
            onChange={setResponse}
          />
        )}
        {exercise.exercise_type === "true_false" && (
          <TrueFalseControl response={response} submitted={submitted} onChange={setResponse} />
        )}
        {exercise.exercise_type === "matching" && (
          <MatchingControl
            exercise={exercise}
            response={response}
            submitted={submitted}
            onChange={setResponse}
          />
        )}

        {!submitted && (
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit || saving}>
            {copy.exercise.submit}
          </Button>
        )}

        {submitted && (
          <div role="status" aria-live="polite" className="space-y-2">
            <div
              className={cn(
                "flex items-center gap-2 text-sm font-semibold",
                correct ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {correct ? (
                <>
                  <Check className="size-4" aria-hidden />
                  {copy.exercise.correct}
                </>
              ) : (
                <>
                  <X className="size-4" aria-hidden />
                  {copy.exercise.incorrect}
                </>
              )}
            </div>
            {explanation && <p className="text-sm text-muted-foreground">{explanation}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChoiceControl({
  exercise,
  response,
  submitted,
  onChange,
}: {
  exercise: LessonExercise;
  response: ExerciseResponse | null;
  submitted: boolean;
  onChange: (r: ExerciseResponse) => void;
}) {
  const choices = (exercise.resolvedPayload["choices"] as string[] | undefined) ?? [];
  const selectedIndex = response?.kind === "choice" ? response.index : null;

  return (
    <RadioGroup
      value={selectedIndex != null ? String(selectedIndex) : null}
      onValueChange={(v) => onChange({ kind: "choice", index: Number(v) })}
      disabled={submitted}
    >
      {choices.map((choice, index) => {
        const id = `${exercise.id}-choice-${index}`;
        return (
          <div key={id} className="flex items-center gap-2">
            <RadioGroupItem value={String(index)} id={id} />
            <Label htmlFor={id} className="cursor-pointer font-normal">
              {choice}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

function TrueFalseControl({
  response,
  submitted,
  onChange,
}: {
  response: ExerciseResponse | null;
  submitted: boolean;
  onChange: (r: ExerciseResponse) => void;
}) {
  const { d } = useI18n();
  const copy = d.learning.lesson.exercise;
  const selected = response?.kind === "boolean" ? response.value : null;

  return (
    <div className="flex gap-3">
      <Button
        type="button"
        variant={selected === true ? "default" : "outline"}
        disabled={submitted}
        onClick={() => onChange({ kind: "boolean", value: true })}
        aria-pressed={selected === true}
      >
        {copy.true}
      </Button>
      <Button
        type="button"
        variant={selected === false ? "default" : "outline"}
        disabled={submitted}
        onClick={() => onChange({ kind: "boolean", value: false })}
        aria-pressed={selected === false}
      >
        {copy.false}
      </Button>
    </div>
  );
}

function MatchingControl({
  exercise,
  response,
  submitted,
  onChange,
}: {
  exercise: LessonExercise;
  response: ExerciseResponse | null;
  submitted: boolean;
  onChange: (r: ExerciseResponse) => void;
}) {
  const { d } = useI18n();
  const copy = d.learning.lesson.exercise;
  const pairs =
    (exercise.resolvedPayload["pairs"] as { left: string; right: string }[] | undefined) ?? [];
  const options = useMemo(() => shuffled(pairs.map((p) => p.right)), [pairs]);
  const selections = response?.kind === "matching" ? response.selections : pairs.map(() => null);

  function setSelection(index: number, value: string) {
    const next = [...selections];
    next[index] = value;
    onChange({ kind: "matching", selections: next });
  }

  return (
    <div className="space-y-3">
      {pairs.map((pair, index) => (
        <div key={pair.left} className="flex flex-wrap items-center gap-3">
          <span className="min-w-32 font-medium text-foreground">{pair.left}</span>
          <Select
            {...(selections[index] ? { value: selections[index] } : {})}
            onValueChange={(v) => setSelection(index, v)}
            disabled={submitted}
          >
            <SelectTrigger className="w-full max-w-56">
              <SelectValue placeholder={copy.selectAnswer} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

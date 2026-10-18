import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { getLessonForPlayer, getAyah } from "../db";
import {
  buildPlayerSteps,
  computeProgressPercent,
  clampStepIndex,
  evaluateExerciseAnswer,
  hasCompleteResponse,
  type ExerciseResponse,
  type LessonSection,
  type LessonExercise,
} from "../curriculum-render";
import { AppBar } from "../AppBar";

/**
 * Mockup panels 7 (Lesson Content) and 8 (Practice Exercises): production
 * renders both as one linear player (buildPlayerSteps interleaves
 * lesson_sections and lesson_exercises), so this screen does too, matching
 * the real app's own structure rather than the mockup's two separate
 * panels. Step position is in-memory only -- no user_lesson_progress write
 * (no progress sync in Phase 1), so re-opening a lesson always restarts at
 * step 0, by design.
 *
 * `startAtFirstExercise` supports the Practice tab's entry point: jump
 * straight past the lesson's explanatory sections into its graded
 * exercises (production has no standalone "practice bank" distinct from
 * lesson_exercises, so Practice reuses the same real content this way
 * rather than inventing a parallel data model).
 */
export function LessonPlayerScreen({
  lessonId,
  startAtFirstExercise = false,
  onBack,
}: {
  lessonId: string;
  startAtFirstExercise?: boolean;
  onBack: () => void;
}) {
  const { d, locale } = useI18n();
  const { db } = useDb();

  const lesson = useMemo(() => getLessonForPlayer(db, lessonId, locale), [db, lessonId, locale]);
  const steps = useMemo(
    () => (lesson ? buildPlayerSteps(lesson.sections, lesson.exercises) : []),
    [lesson],
  );

  const initialIndex = useMemo(() => {
    if (!startAtFirstExercise) return 0;
    const idx = steps.findIndex((s) => s.type === "exercise");
    return idx >= 0 ? idx : 0;
  }, [steps, startAtFirstExercise]);

  const [stepIndex, setStepIndex] = useState(initialIndex);
  const [response, setResponse] = useState<ExerciseResponse | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  if (!lesson) {
    return (
      <div>
        <AppBar title={d.lessons.lesson} onBack={onBack} />
        <p className="text-muted">—</p>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div>
        <AppBar title={lesson.title} onBack={onBack} />
        <p className="text-muted">—</p>
      </div>
    );
  }

  const index = clampStepIndex(stepIndex, steps.length);
  const step = steps[index]!;
  const progress = computeProgressPercent(index, steps.length);

  function goTo(nextIndex: number) {
    setStepIndex(clampStepIndex(nextIndex, steps.length));
    setResponse(null);
    setSubmitted(false);
    setCorrect(false);
  }

  function handleCheckAnswer() {
    if (step.type !== "exercise" || !response) return;
    const isCorrect = evaluateExerciseAnswer(step.exercise, response);
    setCorrect(isCorrect);
    setSubmitted(true);
  }

  const canAdvance = step.type === "section" || submitted;

  return (
    <div>
      <div className="appbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button className="back-button" onClick={onBack} type="button">
            ←
          </button>
          <h1 className="appbar-title" style={{ fontSize: "1rem" }}>
            {d.lessons.level} {lesson.level.number} · {lesson.title}
          </h1>
        </div>
        <span className="text-muted" style={{ fontSize: "0.85rem", flexShrink: 0 }}>
          {index + 1}/{steps.length}
        </span>
      </div>

      <div className="progress-track" style={{ marginBottom: 20 }}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {step.type === "section" ? (
        <SectionView section={step.section} db={db} />
      ) : (
        <ExerciseView
          exercise={step.exercise}
          response={response}
          submitted={submitted}
          correct={correct}
          onChange={setResponse}
          onCheck={handleCheckAnswer}
          d={d}
        />
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button
          type="button"
          className="btn btn-outline"
          style={{ flex: 1 }}
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
        >
          ← {d.player.previous}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={() => goTo(index + 1)}
          disabled={!canAdvance || index === steps.length - 1}
        >
          {d.player.next} →
        </button>
      </div>
    </div>
  );
}

function SectionView({
  section,
  db,
}: {
  section: LessonSection;
  db: ReturnType<typeof useDb>["db"];
}) {
  if (section.content_type === "quran_example" && section.surah_number && section.ayah_number) {
    const ayah = getAyah(db, section.surah_number, section.ayah_number);
    return (
      <div className="card" style={{ borderLeft: "4px solid var(--gold)" }}>
        {section.body && <p style={{ marginBottom: 10 }}>{section.body}</p>}
        {ayah && (
          <>
            <p className="quran-text" style={{ fontSize: "1.4rem", marginBottom: 6 }}>
              {ayah.arabic_text}
            </p>
            <p className="text-muted" style={{ fontSize: "0.85rem" }}>
              {ayah.english}
            </p>
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
              {section.surah_number}:{section.ayah_number}
            </p>
          </>
        )}
      </div>
    );
  }

  if (section.content_type === "arabic_text") {
    return (
      <div className="card">
        {section.arabic_text && (
          <p className="quran-text" style={{ fontSize: "2rem", marginBottom: 12 }}>
            {section.arabic_text}
          </p>
        )}
        {section.body && <p>{section.body}</p>}
      </div>
    );
  }

  if (["tip", "rule", "summary"].includes(section.content_type)) {
    return (
      <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
        {section.body && <p style={{ whiteSpace: "pre-line" }}>{section.body}</p>}
      </div>
    );
  }

  return (
    <div className="card">
      {section.body && <p style={{ whiteSpace: "pre-line" }}>{section.body}</p>}
    </div>
  );
}

const CHOICE_TYPES = new Set<LessonExercise["exercise_type"]>([
  "multiple_choice",
  "letter_recognition",
  "vowel_recognition",
  "reading_check",
]);

function ExerciseView({
  exercise,
  response,
  submitted,
  correct,
  onChange,
  onCheck,
  d,
}: {
  exercise: LessonExercise;
  response: ExerciseResponse | null;
  submitted: boolean;
  correct: boolean;
  onChange: (r: ExerciseResponse) => void;
  onCheck: () => void;
  d: ReturnType<typeof useI18n>["d"];
}) {
  const canCheck = !submitted && hasCompleteResponse(exercise, response);

  return (
    <div className="card">
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", marginBottom: 16 }}>
        {exercise.prompt}
      </h2>

      {CHOICE_TYPES.has(exercise.exercise_type) && (
        <ChoiceControl
          exercise={exercise}
          response={response}
          submitted={submitted}
          onChange={onChange}
        />
      )}
      {exercise.exercise_type === "true_false" && (
        <TrueFalseControl response={response} submitted={submitted} onChange={onChange} />
      )}
      {exercise.exercise_type === "matching" && (
        <MatchingControl
          exercise={exercise}
          response={response}
          submitted={submitted}
          onChange={onChange}
        />
      )}

      {!submitted && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 16 }}
          disabled={!canCheck}
          onClick={onCheck}
        >
          {d.player.checkAnswer}
        </button>
      )}

      {submitted && (
        <div
          className={`banner ${correct ? "banner-success" : "banner-error"}`}
          style={{ marginTop: 16 }}
        >
          {correct ? `✓ ${d.player.correct}` : `✗ ${d.player.incorrect}`}
          {exercise.explanation && (
            <span style={{ fontWeight: 400, marginLeft: 6 }}>{exercise.explanation}</span>
          )}
        </div>
      )}
    </div>
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
  const correctIndex = exercise.payload["correctIndex"] as number | undefined;
  const selectedIndex = response?.kind === "choice" ? response.index : null;

  return (
    <div>
      {choices.map((choice, idx) => {
        const isSelected = selectedIndex === idx;
        const stateClass = submitted
          ? idx === correctIndex
            ? "correct"
            : isSelected
              ? "incorrect"
              : ""
          : isSelected
            ? "selected"
            : "";
        return (
          <div
            key={idx}
            className={`choice-row ${stateClass}`}
            onClick={() => !submitted && onChange({ kind: "choice", index: idx })}
          >
            <span>{isSelected ? "●" : "○"}</span>
            <span>{choice}</span>
          </div>
        );
      })}
    </div>
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
  const selected = response?.kind === "boolean" ? response.value : null;
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button
        type="button"
        className={selected === true ? "btn btn-primary" : "btn btn-outline"}
        style={{ flex: 1 }}
        disabled={submitted}
        onClick={() => onChange({ kind: "boolean", value: true })}
      >
        True
      </button>
      <button
        type="button"
        className={selected === false ? "btn btn-primary" : "btn btn-outline"}
        style={{ flex: 1 }}
        disabled={submitted}
        onClick={() => onChange({ kind: "boolean", value: false })}
      >
        False
      </button>
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
  const pairs =
    (exercise.resolvedPayload["pairs"] as { left: string; right: string }[] | undefined) ?? [];
  const options = useMemo(() => pairs.map((p) => p.right), [pairs]);
  const selections = response?.kind === "matching" ? response.selections : pairs.map(() => null);

  function setSelection(idx: number, value: string) {
    const next = [...selections];
    next[idx] = value;
    onChange({ kind: "matching", selections: next });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {pairs.map((pair, idx) => (
        <div key={pair.left} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ minWidth: 100, fontWeight: 600 }}>{pair.left}</span>
          <select
            className="input"
            value={selections[idx] ?? ""}
            disabled={submitted}
            onChange={(e) => setSelection(idx, e.target.value)}
          >
            <option value="" disabled>
              …
            </option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

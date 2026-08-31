export const memorization = {
  title: "Memorize",
  intro: "Select a Surah, repeat each Ayah at your own pace, then mark it memorized for review.",
  status: {
    not_started: "Not started",
    learning: "Learning",
    memorized: "Memorized",
    review_due: "Review due",
  },
  overview: {
    continueTitle: "Continue Memorizing",
    continueEmpty: "Choose a Surah and begin memorizing one Ayah at a time.",
    continueCta: "Continue {surah}",
    dueTitle: "Due for Review",
    dueEmpty: "You're caught up. Continue learning or study a Surah.",
    dueCount: "{count} Ayat due",
    memorizedTitle: "Memorized",
    memorizedCount: "{count} Ayat memorized",
    surahProgressTitle: "Surah Progress",
    ayahCount: "{memorized} / {total} memorized",
    startSurah: "Start this Surah",
  },
  selector: {
    label: "Select a Surah",
    ayahRange: "Ayat {from}–{to}",
    start: "Start memorizing",
  },
  controls: {
    repetitionOf: "Playing {current} of {total}",
    previous: "Previous Ayah",
    next: "Next Ayah",
    hideArabic: "Hide Arabic",
    showArabic: "Show Arabic",
    hideTranslation: "Hide translation",
    showTranslation: "Show translation",
    markLearning: "Mark as Learning",
    markMemorized: "Mark as memorized",
    addToReview: "Add to Review",
  },
  toast: {
    memorized: "Marked as memorized.",
    memorizedNoTranslation:
      "Marked as memorized. Review reminders will start once a translation is available for this Ayah.",
    addedToReview: "Added to your review queue.",
    addedToReviewNoTranslation:
      "Marked as learning. Review reminders will start once a translation is available for this Ayah.",
    actionFailed: "That didn't save. Try again.",
  },
  review: {
    title: "Ayat due for review",
    reveal: "Tap to reveal",
    hard: "Needs work",
    easy: "Got it",
  },
  loading: "Loading your memorization progress…",
  empty: {
    title: "No memorization yet.",
    body: "Choose a Surah and begin memorizing one Ayah at a time.",
  },
  error: {
    title: "Couldn't load memorization progress.",
    retry: "Retry",
  },
};

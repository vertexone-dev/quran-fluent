import type { memorization as EnMemorization } from "../en/memorization";

export const memorization: typeof EnMemorization = {
  title: "Mémorisation",
  intro:
    "Choisissez une sourate, répétez chaque verset à votre rythme, puis marquez-le mémorisé pour la révision.",
  status: {
    not_started: "Non commencé",
    learning: "En apprentissage",
    memorized: "Mémorisé",
    review_due: "Révision prévue",
  },
  overview: {
    continueTitle: "Continuer la mémorisation",
    continueEmpty: "Choisissez une sourate et commencez à mémoriser un verset à la fois.",
    continueCta: "Continuer {surah}",
    dueTitle: "À réviser",
    dueEmpty: "Vous êtes à jour. Continuez à apprendre ou étudiez une sourate.",
    dueCount: "{count} versets à réviser",
    memorizedTitle: "Mémorisés",
    memorizedCount: "{count} versets mémorisés",
    surahProgressTitle: "Progression par sourate",
    ayahCount: "{memorized} / {total} mémorisés",
    startSurah: "Commencer cette sourate",
  },
  selector: {
    label: "Choisir une sourate",
    ayahRange: "Versets {from}–{to}",
    start: "Commencer la mémorisation",
  },
  controls: {
    repetitionOf: "Lecture {current} sur {total}",
    previous: "Verset précédent",
    next: "Verset suivant",
    hideArabic: "Masquer l'arabe",
    showArabic: "Afficher l'arabe",
    hideTranslation: "Masquer la traduction",
    showTranslation: "Afficher la traduction",
    markLearning: "Marquer en apprentissage",
    markMemorized: "Marquer comme mémorisé",
    addToReview: "Ajouter à la révision",
  },
  toast: {
    memorized: "Marqué comme mémorisé.",
    memorizedNoTranslation:
      "Marqué comme mémorisé. Les rappels de révision commenceront dès qu'une traduction sera disponible pour ce verset.",
    addedToReview: "Ajouté à votre file de révision.",
    addedToReviewNoTranslation:
      "Marqué en apprentissage. Les rappels de révision commenceront dès qu'une traduction sera disponible pour ce verset.",
    actionFailed: "Échec de l'enregistrement. Réessayez.",
  },
  review: {
    title: "Versets à réviser",
    reveal: "Toucher pour révéler",
    hard: "À retravailler",
    easy: "Acquis",
  },
  loading: "Chargement de votre progression…",
  empty: {
    title: "Aucune mémorisation pour le moment.",
    body: "Choisissez une sourate et commencez à mémoriser un verset à la fois.",
  },
  error: {
    title: "Impossible de charger la progression.",
    retry: "Réessayer",
  },
};

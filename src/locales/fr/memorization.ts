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
    repeatAyah: "Répéter le verset",
    repeatCount1: "1×",
    repeatCount3: "3×",
    repeatCount5: "5×",
    repeatCount10: "10×",
    repetitionOf: "Répétition {current} sur {total}",
    previous: "Verset précédent",
    next: "Verset suivant",
    hideArabic: "Masquer l'arabe",
    showArabic: "Afficher l'arabe",
    hideTranslation: "Masquer la traduction",
    showTranslation: "Afficher la traduction",
    markLearning: "Marquer en apprentissage",
    markMemorized: "Marquer comme mémorisé",
    addToReview: "Ajouter à la révision",
    audioNote:
      "L'audio de récitation arrivera dans une prochaine mise à jour — répétez à votre rythme pour l'instant.",
  },
  toast: {
    memorized: "Marqué comme mémorisé.",
    addedToReview: "Ajouté à votre file de révision.",
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

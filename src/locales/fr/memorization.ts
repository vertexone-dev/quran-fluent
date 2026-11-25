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
    dueCount: "one:{count} verset à réviser|other:{count} versets à réviser",
    memorizedTitle: "Mémorisés",
    memorizedCount: "one:{count} verset mémorisé|other:{count} versets mémorisés",
    surahProgressTitle: "Progression par sourate",
    ayahCount: "{memorized} / {total} mémorisés",
    startSurah: "Commencer cette sourate",
  },
  ring: {
    title: "Progression de la mémorisation",
    surahLine: "{surah}",
    memorizedSummary: "{memorized} versets mémorisés sur {total}",
    legendMemorized: "Mémorisés",
    legendLearning: "En cours",
    legendRevision: "À réviser",
    legendRemaining: "Non commencés",
    aria: "{surah} : {memorized} versets mémorisés sur {total}, {learning} en cours, {due} à réviser.",
    empty:
      "Votre progression apparaîtra ici dès que vous commencerez une sourate. Rien n’est estimé ni prérempli.",
    emptyAria: "Aucune progression de mémorisation pour l’instant.",
    howTitle: "Comment c’est calculé",
    how: "« Mémorisés » et « En cours » comptent les versets que vous marquez dans une sourate. Le pourcentage est le nombre de versets mémorisés divisé par le nombre de versets de la sourate. « À réviser » compte vos révisions programmées pour cette sourate, dues aujourd’hui ou plus tôt ; ce nombre recoupe les autres états, il n’est donc pas dessiné sur l’anneau.",
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

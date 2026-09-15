import type { dashboard as EnDashboard } from "../en/dashboard";

export const dashboard: typeof EnDashboard = {
  greeting: "As-salāmu ʿalaykum, {name}",
  documentTitle: "Tableau de bord — QuranRoots",
  friend: "cher apprenant",
  subtitle: "Poursuivez votre apprentissage du Coran aujourd'hui.",
  streak: "Série de {count} jours",
  longest: "Record {count}",
  continueLearning: "Continuer mon apprentissage",
  todayLesson: "Leçon 1 — L'alphabet arabe",
  lessonBadge: "Niveau 1 · Fondations de l'arabe",
  lessonMeta: "Environ 8 minutes · Apprendre → Exemple → Écouter → S'entraîner → Quiz",
  opensPhase2: "Disponible en phase 2",
  yourPlan: "Mon parcours",
  levelNotSet: "Niveau non défini",
  goalNotSet: "Objectif non défini",
  minutesADay: "{count} minutes par jour",
  todayTitle: "Mon apprentissage du jour",
  startDaily: "Commencer la session du jour",
  reviewsDue: "{count} révisions en attente",
  goalProgress: "{minutes}/{target} minutes",
  today: {
    review: { title: "File de révision", cta: "Réviser maintenant" },
    weak: {
      title: "Point faible",
      cta: "Se concentrer",
      none: "Aucun point faible pour l'instant",
    },
    path: { title: "Prochaine étape", cta: "Continuer", none: "Passer le test de niveau" },
    goal: { title: "Objectif du jour", cta: "Continuer" },
  },
  // Étiquettes de présentation uniquement pour les valeurs brutes de
  // weak_areas.area écrites par SECTION_WEAK_AREAS dans src/lib/study.ts --
  // voir WEAK_AREA_LABEL_KEYS pour la correspondance valeur brute → clé.
  // Jamais utilisées pour modifier ou faire correspondre les données
  // stockées, seulement pour les afficher.
  weakAreas: {
    letterRecognition: "Reconnaissance des lettres",
    letterForms: "Formes des lettres",
    harakat: "Harakat",
    readingWords: "Lecture de mots",
    vocabulary: "Vocabulaire coranique",
    comprehension: "Compréhension des versets",
    grammar: "Fondations grammaticales",
  },
  understandingTitle: "Score de compréhension du Coran",

  awaiting: "En attente de votre activité",
  understandingNote:
    "Ces dimensions restent à zéro tant qu'elles ne peuvent pas être calculées à partir de vos leçons, quiz, récitations et révisions réels. Rien ici n'est estimé ni inventé.",
  dimensions: {
    reading: "Lecture",
    vocabulary: "Vocabulaire",
    grammar: "Grammaire",
    comprehension: "Compréhension",
    tajweed: "Tajwid",
    memorization: "Mémorisation",
  },
  activityLabel: "Votre activité",
  memorizationCard: {
    title: "Mémorisation",
    memorizedCount: "{count} versets mémorisés",
    dueCount: "{count} à réviser",
    empty: "Commencez à mémoriser votre premier verset.",
  },
  bookmarksCard: {
    title: "Favoris",
    empty: "Aucun favori pour le moment.",
  },
  notesCard: {
    title: "Notes",
    empty: "Aucune note pour le moment.",
  },
};

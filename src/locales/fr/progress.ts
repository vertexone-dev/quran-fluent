import type { progress as EnProgress } from "../en/progress";

export const progress: typeof EnProgress = {
  title: "Ma progression",
  phase: "Phases 2 et 5",
  intro:
    "La progression est là pour encourager la régularité, pas pour transformer votre adoration en jeu.",
  planned: [
    "Série d'apprentissage et temps d'étude hebdomadaire",
    "Leçons terminées",
    "Détail de la maîtrise du vocabulaire",
    "Résultats aux quiz dans le temps",
    "Niveau de lecture en arabe",
    "Sourates étudiées et versets mémorisés",
    "Score de compréhension du Coran par sourate",
  ],
  note: "Votre série est déjà enregistrée sur votre compte et alimentera ces graphiques au fil de votre activité.",
  metrics: {
    currentStreak: "Série actuelle",
    studyTime: "Temps d'étude",
    lessonsCompleted: "Leçons terminées",
    wordsLearned: "Mots appris",
    ayatMemorized: "Versets mémorisés",
    surahsStudied: "Sourates étudiées",
  },
  vocabulary: {
    unknown: "Je ne connais pas",
    learning: "J'apprends",
    known: "Je connais",
    mastered: "Maîtrisé",
  },
  weakAreas: "Points faibles",
  weakAreasEmpty: "Aucun point faible pour le moment. Passez le test de placement ou pratiquez pour les faire apparaître.",
  vocabularyTitle: "Force du vocabulaire",
  vocabularyEmpty: "Vous n'avez encore enregistré aucun mot. Visitez la page du Coran pour commencer à construire votre vocabulaire.",
  recentActivity: "Activité récente",
  weeklyMinutes: "7 derniers jours",
  today: "Aujourd'hui",
  level: "Niveau actuel",
  goal: "Objectif quotidien",
  minutes: "{count} min",
};

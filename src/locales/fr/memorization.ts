import type { memorization as EnMemorization } from "../en/memorization";

export const memorization: typeof EnMemorization = {
  title: "Mémorisation (Hifz)",
  phase: "Phase 4",
  intro:
    "Choisir une sourate → choisir les versets → écouter → répéter → masquer → réciter → réviser.",
  planned: [
    "Répéter un verset ou une série de versets",
    "Nombre de répétitions ajustable et avance automatique",
    "Masquer la traduction, masquer l'arabe, masquage progressif des mots",
    "Marquer un verset comme mémorisé",
    "Suivi de la mémorisation et planification des révisions",
    "Architecture prête pour la vérification de la récitation par reconnaissance vocale",
  ],
  note: "Les outils de Hifz dépendent du service de données coraniques vérifiées et de l'audio de récitation livrés en phase 3.",
  controls: {
    repeatAyah: "Répéter le verset",
    repeat3: "Répéter 3 fois",
    repeat5: "Répéter 5 fois",
    repeat10: "Répéter 10 fois",
    previous: "Verset précédent",
    next: "Verset suivant",
    hide: "Masquer le texte",
    show: "Afficher le texte",
    markMemorized: "Marquer comme mémorisé",
  },
  bookmarks: {
    title: "Favoris",
    phase: "Phase 3",
    intro: "Vous n'avez encore rien enregistré.",
    planned: [
      "Mettre en favori n'importe quel verset pendant la lecture",
      "Mettre une leçon en favori pour la reprendre plus tard",
      "Enregistrer du vocabulaire directement depuis le panneau de mot",
      "Organiser vos favoris en collections",
      "Reprendre depuis votre tableau de bord",
    ],
    note: "Les favoris arrivent avec le lecteur du Coran en phase 3.",
  },
  notes: {
    title: "Notes",
    phase: "Phase 3",
    intro: "Vous n'avez encore écrit aucune note.",
    planned: [
      "Notes privées sur n'importe quel verset",
      "Notes sur les leçons et le vocabulaire",
      "Recherche dans toutes vos notes",
      "Vos notes restent privées, liées à votre compte",
    ],
    note: "Les notes sont protégées par une sécurité au niveau des lignes : vous seul pouvez les lire.",
  },
};

import type { quran as EnQuran } from "../en/quran";

export const quran: typeof EnQuran = {
  page: {
    title: "Étude interactive du Coran",
    intro:
      "Parcourez par sourate, verset ou juz', avec traduction, translittération, audio et un panneau d'étude pour chaque mot.",
    typographyBadge: "Aperçu typographique",
    typographyNote:
      "Al-Fatiha 1:1 — affiché pour prévisualiser la typographie et l'espacement de l'arabe.",
    dataTitle: "Comment les données coraniques sont traitées",
    dataIntro:
      "Chaque couche provient d'une source documentée et est stockée séparément. Des traductions ou interprétations divergentes ne sont jamais fusionnées en silence.",
    layers: [
      {
        name: "Texte arabe coranique",
        detail: "Texte Uthmani vérifié, stocké seul et jamais modifié.",
      },
      {
        name: "Traductions",
        detail: "Chaque traduction est attribuée à son traducteur et à son édition.",
      },
      {
        name: "Translittération",
        detail: "Conservée à part, pour pouvoir l'activer, la désactiver ou la remplacer.",
      },
      {
        name: "Données mot à mot",
        detail: "Sens, racine et nature grammaticale issus de corpus documentés.",
      },
      { name: "Audio", detail: "Métadonnées du récitateur et minutage verset par verset." },
      {
        name: "Tafsir",
        detail: "Uniquement des sources savantes identifiables, affichées avec leur référence.",
      },
    ],
    translationsTitle: "Traductions par langue",
    translationsIntro:
      "Chaque langue lit le Coran à travers sa propre traduction vérifiée, affichée avec le nom du traducteur. Aucune traduction n'est générée automatiquement.",
    translationEn: "Anglais — Marmaduke Pickthall (Project Gutenberg eBook #16955)",
    translationFr: "Français — Muhammad Hamidullah",
    searchNote:
      "La recherche acceptera des mots courants dans votre langue d'interface — miséricorde, patience, prière, paradis, jeûne — et les reliera au vocabulaire coranique vérifié, sans se limiter à une correspondance exacte de texte.",
  },
  reader: {
    title: "Lire",
    intro:
      "Une sélection de sourates courtes et couramment mémorisées à lire, mettre en favoris, annoter et mémoriser. Le Mushaf complet arrivera dans une phase ultérieure.",
    selectSurah: "Choisir une sourate",
    ayahLabel: "Verset {number}",
    actions: {
      bookmark: "Ajouter aux favoris",
      removeBookmark: "Retirer des favoris",
      addNote: "Ajouter une note",
      memorize: "Mémoriser",
      more: "Plus d'actions",
    },
    loading: "Chargement de la sourate…",
    error: {
      title: "Impossible de charger cette sourate.",
      retry: "Réessayer",
    },
    translationUnavailable: "Traduction française pas encore disponible pour ce verset.",
    attribution: {
      label: "Traducteur : {translator}",
      detailsAriaLabel: "Détails de la source de traduction",
      details:
        "Marmaduke Pickthall — édition numérique Project Gutenberg eBook #16955. Domaine public aux États-Unis. Non présentée comme une reproduction exacte de la première édition de 1930.",
    },
  },
  audio: {
    play: "Lire la récitation",
    pause: "Mettre en pause",
    restart: "Rejouer depuis le début",
    loading: "Chargement de la récitation…",
    unavailable: "L'audio de récitation n'est pas disponible pour ce verset.",
    error: "Impossible de lire la récitation. Réessayez.",
    reciterLabel: "Récitateur : {reciter}",
  },
  word: {
    meaning: "Signification",
    root: "Racine",
    transliteration: "Translittération",
    type: "Catégorie grammaticale",
    noun: "Nom",
    verb: "Verbe",
    particle: "Particule",
    phrase: "Expression",
  },
  vocabulary: {
    title: "Mots les plus fréquents du Coran",
    intro:
      "Commencez par les mots les plus courants du Coran. Chaque entrée affiche l'arabe, la translittération, le sens, la racine et un verset exemple.",
    searchPlaceholder: "Rechercher des mots…",
    filterAll: "Tous",
    frequencyRank: "Rang n°{rank}",
    occurrences: "{count} occurrences",
    save: "Enregistrer pour réviser",
    saved: "Enregistré",
    remove: "Retirer",
    saveToast: "Mot enregistré pour révision.",
    removeToast: "Mot retiré de la liste de révision.",
    empty: "Aucun mot ne correspond à votre recherche.",
    signInToSave: "Connectez-vous pour enregistrer des mots à réviser.",
  },
};

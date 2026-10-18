/**
 * Minimal, Phase-1-scoped i18n -- en/fr only (matches SUPPORTED_LOCALES in
 * ../../src/locales/index.ts), covering only the strings this mobile app's
 * own chrome needs. Not a port of the web app's full dictionary (hundreds
 * of keys for routes/features this app doesn't have yet); brand strings
 * below are copied verbatim from ../../src/locales/{en,fr}/common.ts so the
 * wordmark/tagline/alt text match exactly.
 */
import { createContext, useContext } from "react";

export type Locale = "en" | "fr";

const dictionaries = {
  en: {
    brand: {
      name: "QuranRoots",
      tagline: "Trace the Language. Uncover the Meaning.",
      logoAlt: "QuranRoots logo: a tree growing from an open book",
    },
    nav: {
      home: "Home",
      quran: "Qur'an",
      lessons: "Lessons",
      practice: "Practice",
      more: "More",
    },
    more: {
      memorization: "Memorization",
      comingSoon: "Coming Soon",
      offlineAccess: "Offline Access",
      settings: "Settings",
    },
    home: {
      greeting: "Welcome back",
      continueReading: "Continue Reading",
      startLearning: "Start Learning",
      yourProgress: "Your Progress",
    },
    reader: {
      surahs: "Surahs",
      search: "Search surahs",
      favoritesOnly: "Favorites",
      filterAll: "All",
      filterMakki: "Makki",
      filterMadani: "Madani",
      tabArabic: "Arabic",
      tabEnglish: "English",
      tabFrench: "French",
      ayah: "Ayah",
      words: "Words",
      tileSubtitle: "Arabic, English & French",
      noResults: "No surahs match your search.",
    },
    word: {
      title: "Word Details",
      root: "Root",
      meaning: "Meaning",
      occurrences: "Occurrences in the Qur'an",
      example: "Example",
      relatedWords: "Related Words",
      transliteration: "Transliteration",
      noResults: "No words match your search.",
    },
    lessons: {
      title: "Lessons",
      level: "Level",
      module: "Module",
      lesson: "Lesson",
      minutes: "min",
    },
    player: {
      step: "Step",
      of: "of",
      next: "Next",
      previous: "Previous",
      finish: "Finish",
      checkAnswer: "Check Answer",
      correct: "Correct!",
      incorrect: "Not quite.",
    },
    practice: {
      title: "Practice",
      subtitle: "Review exercises from your lessons",
      empty: "Complete a lesson to unlock practice exercises.",
    },
    offline: {
      title: "Offline Access",
      upToDate: "All certified content is bundled and available offline.",
      version: "Content version",
      generatedAt: "Exported",
      surahsLabel: "Surahs & Ayahs",
      lessonsLabel: "Lessons & Exercises",
    },
    settings: {
      title: "Settings",
      language: "Language",
      translations: "Translations",
      textSize: "Text Size",
      theme: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      textSizeSmall: "Small",
      textSizeMedium: "Medium",
      textSizeLarge: "Large",
    },
    common: {
      back: "Back",
      loading: "Loading…",
      offlineBadge: "Offline",
    },
  },
  fr: {
    brand: {
      name: "QuranRoots",
      tagline: "Remontez à la langue. Découvrez le sens.",
      logoAlt: "Logo QuranRoots : un arbre qui pousse d'un livre ouvert",
    },
    nav: {
      home: "Accueil",
      quran: "Coran",
      lessons: "Leçons",
      practice: "Pratique",
      more: "Plus",
    },
    more: {
      memorization: "Mémorisation",
      comingSoon: "Bientôt disponible",
      offlineAccess: "Accès hors ligne",
      settings: "Réglages",
    },
    home: {
      greeting: "Bon retour",
      continueReading: "Continuer la lecture",
      startLearning: "Commencer à apprendre",
      yourProgress: "Votre progression",
    },
    reader: {
      surahs: "Sourates",
      search: "Rechercher une sourate",
      favoritesOnly: "Favoris",
      filterAll: "Toutes",
      filterMakki: "Mecquoise",
      filterMadani: "Médinoise",
      tabArabic: "Arabe",
      tabEnglish: "Anglais",
      tabFrench: "Français",
      ayah: "Verset",
      words: "Mots",
      tileSubtitle: "Arabe, anglais et français",
      noResults: "Aucune sourate ne correspond à votre recherche.",
    },
    word: {
      title: "Détails du mot",
      root: "Racine",
      meaning: "Sens",
      occurrences: "Occurrences dans le Coran",
      example: "Exemple",
      relatedWords: "Mots apparentés",
      transliteration: "Transcription",
      noResults: "Aucun mot ne correspond à votre recherche.",
    },
    lessons: {
      title: "Leçons",
      level: "Niveau",
      module: "Module",
      lesson: "Leçon",
      minutes: "min",
    },
    player: {
      step: "Étape",
      of: "sur",
      next: "Suivant",
      previous: "Précédent",
      finish: "Terminer",
      checkAnswer: "Vérifier",
      correct: "Correct !",
      incorrect: "Pas tout à fait.",
    },
    practice: {
      title: "Pratique",
      subtitle: "Révisez les exercices de vos leçons",
      empty: "Terminez une leçon pour débloquer des exercices de pratique.",
    },
    offline: {
      title: "Accès hors ligne",
      upToDate: "Tout le contenu certifié est inclus et disponible hors ligne.",
      version: "Version du contenu",
      generatedAt: "Exporté",
      surahsLabel: "Sourates et versets",
      lessonsLabel: "Leçons et exercices",
    },
    settings: {
      title: "Réglages",
      language: "Langue",
      translations: "Traductions",
      textSize: "Taille du texte",
      theme: "Thème",
      themeLight: "Clair",
      themeDark: "Sombre",
      textSizeSmall: "Petit",
      textSizeMedium: "Moyen",
      textSizeLarge: "Grand",
    },
    common: {
      back: "Retour",
      loading: "Chargement…",
      offlineBadge: "Hors ligne",
    },
  },
} as const;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof dictionaries.en>;

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "fr"];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  d: Dictionary;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

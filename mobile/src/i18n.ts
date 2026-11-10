/**
 * Minimal i18n for the mobile app's own chrome -- en/fr/ar (matches
 * SUPPORTED_LOCALES in ../../src/locales/index.ts). Not a port of the web
 * app's full dictionary. Brand strings and the five primary destination
 * labels are copied verbatim from ../../src/locales/{en,fr,ar}/common.ts so
 * the wordmark, alt text and navigation match the website exactly.
 *
 * Arabic (Milestone D-1) is an interface language only: the offline lesson
 * bundle has English and French content, so `contentLocale` (en/fr) is what
 * lesson/word queries receive -- Arabic UI shows English lesson content and
 * says so. New French/Arabic interface copy is marked NEEDS NATIVE REVIEW.
 */
import { createContext, useContext } from "react";

export type Locale = "en" | "fr" | "ar";
export type ContentLocale = "en" | "fr";

export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export function isRtl(locale: Locale): boolean {
  return locale === "ar";
}

export function toContentLocale(locale: Locale): ContentLocale {
  return locale === "fr" ? "fr" : "en";
}

export function nextLocale(locale: Locale): Locale {
  return locale === "en" ? "fr" : locale === "fr" ? "ar" : "en";
}

const dictionaries = {
  en: {
    brand: {
      name: "QuranRoots",
      tagline: "Trace the Language. Uncover the Meaning.",
      logoAlt:
        "QuranRoots logo: a sprout growing from an open book, framed by a golden mosque archway under a crescent moon",
    },
    nav: {
      home: "Home",
      quran: "Qur'an",
      learn: "Learn",
      reflect: "Reflect",
      memorize: "Memorize",
      lessons: "Lessons",
      practice: "Practice",
      more: "More",
      primary: "Main navigation",
    },
    more: {
      title: "Profile & More",
      open: "Open Profile & More",
      memorization: "Memorization",
      comingSoon: "Coming Soon",
      offlineAccess: "Offline Access",
      settings: "Settings",
      bookmarks: "Bookmarks",
      practice: "Practice",
      study: "Study",
      app: "App",
      planned: "Planned",
      offlineProfile: "Offline profile",
      offlineProfileBody:
        "Your bookmarks, reading position and settings are saved on this device only.",
    },
    planned: {
      badge: "Planned",
      reflectBody:
        "Reflect is planned for a later update. It is not available in this version of the app.",
      memorizeBody:
        "Memorize is planned for a later update. It is not available in this version of the app.",
      availableNow: "Available now",
      openQuran: "Read the Qur'an",
      openLearn: "Open lessons",
    },
    home: {
      greeting: "Welcome back",
      continueReading: "Continue Reading",
      startReading: "Start Reading",
      continueLearning: "Continue Learning",
      startLearning: "Start Learning",
      yourProgress: "Your Progress",
      explore: "Explore",
      shortcuts: "Shortcuts",
    },
    reader: {
      surahs: "Surahs",
      search: "Search surahs",
      favoritesOnly: "Favorites",
      filterAll: "All",
      filterMakki: "Makki",
      filterMadani: "Madani",
      tabEnglish: "English",
      tabFrench: "French",
      ayah: "Ayah",
      words: "Words",
      tileSubtitle: "Arabic, English & French",
      noResults: "No surahs match your search.",
      searchWords: "Search words",
      translation: "Translation",
      arabicOnly: "Arabic only",
      fontSize: "Arabic font size",
      smaller: "Smaller Arabic text",
      larger: "Larger Arabic text",
      progress: "Reading progress",
      of: "of",
      audio: "Audio recitation",
      audioUnavailable: "Not available yet",
      previousVerse: "Previous verse",
      nextVerse: "Next verse",
      favorite: "Add to Favorites",
      unfavorite: "Remove from Favorites",
    },
    bookmarks: {
      title: "Bookmarks",
      empty: "Bookmark an ayah while reading to find it here.",
      add: "Bookmark this ayah",
      remove: "Remove bookmark",
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
      levelsTab: "Levels",
      categoriesTab: "Categories",
      categoriesUnavailable:
        "Categories aren't part of the offline content bundle in this release.",
      contentLanguageNotice: "",
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
      true: "True",
      false: "False",
      selectAnswer: "Select…",
      lessonComplete: "Lesson complete!",
      lessonCompleteBody: "Great work finishing this lesson.",
      backToLessons: "Back to Lessons",
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
      arabicQuranLabel: "Arabic Qur'an",
      unitSurahs: "surahs",
      unitAyahs: "ayahs",
      englishTranslationLabel: "English Translation (Pickthall)",
      frenchTranslationLabel: "French Translation (Kazimirski)",
      unitSegments: "segments",
      unitLessons: "lessons",
      exercisesLabel: "Exercises",
      unitExercises: "exercises",
    },
    settings: {
      title: "Settings",
      language: "Language",
      translations: "Translations",
      textSize: "Text Size",
      theme: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      themeSystem: "System",
      appearance: "Appearance",
      textSizeSmall: "Small",
      textSizeMedium: "Medium",
      textSizeLarge: "Large",
    },
    common: {
      back: "Back",
      loading: "Loading…",
      offlineBadge: "Offline",
      contentLoadError: "Offline content failed to load",
    },
  },
  fr: {
    brand: {
      name: "QuranRoots",
      tagline: "Remontez à la langue. Découvrez le sens.",
      logoAlt:
        "Logo QuranRoots : une jeune pousse sortant d'un livre ouvert, encadrée par une arche dorée en forme de mosquée sous un croissant de lune",
    },
    nav: {
      home: "Accueil",
      quran: "Coran",
      learn: "Apprendre",
      reflect: "Méditer",
      memorize: "Mémoriser",
      lessons: "Leçons",
      practice: "Pratique",
      more: "Plus",
      primary: "Navigation principale",
    },
    // NEEDS NATIVE REVIEW (new D-1 strings below)
    more: {
      title: "Profil et plus",
      open: "Ouvrir Profil et plus",
      memorization: "Mémorisation",
      comingSoon: "Bientôt disponible",
      offlineAccess: "Accès hors ligne",
      settings: "Réglages",
      bookmarks: "Signets",
      practice: "Pratique",
      study: "Étude",
      app: "Application",
      planned: "Prévu",
      offlineProfile: "Profil hors ligne",
      offlineProfileBody:
        "Vos signets, votre position de lecture et vos réglages sont enregistrés uniquement sur cet appareil.",
    },
    planned: {
      badge: "Prévu",
      reflectBody:
        "Méditer est prévu pour une prochaine mise à jour. Cette fonction n'est pas disponible dans cette version de l'application.",
      memorizeBody:
        "Mémoriser est prévu pour une prochaine mise à jour. Cette fonction n'est pas disponible dans cette version de l'application.",
      availableNow: "Disponible maintenant",
      openQuran: "Lire le Coran",
      openLearn: "Ouvrir les leçons",
    },
    home: {
      greeting: "Bon retour",
      continueReading: "Continuer la lecture",
      startReading: "Commencer la lecture",
      continueLearning: "Continuer l'apprentissage",
      startLearning: "Commencer à apprendre",
      yourProgress: "Votre progression",
      explore: "Explorer",
      shortcuts: "Raccourcis",
    },
    reader: {
      surahs: "Sourates",
      search: "Rechercher une sourate",
      favoritesOnly: "Favoris",
      filterAll: "Toutes",
      filterMakki: "Mecquoise",
      filterMadani: "Médinoise",
      tabEnglish: "Anglais",
      tabFrench: "Français",
      ayah: "Verset",
      words: "Mots",
      tileSubtitle: "Arabe, anglais et français",
      noResults: "Aucune sourate ne correspond à votre recherche.",
      searchWords: "Rechercher un mot",
      translation: "Traduction",
      arabicOnly: "Arabe seul",
      fontSize: "Taille de la police arabe",
      smaller: "Texte arabe plus petit",
      larger: "Texte arabe plus grand",
      progress: "Progression de lecture",
      of: "sur",
      audio: "Récitation audio",
      audioUnavailable: "Pas encore disponible",
      previousVerse: "Verset précédent",
      nextVerse: "Verset suivant",
      favorite: "Ajouter aux favoris",
      unfavorite: "Retirer des favoris",
    },
    bookmarks: {
      title: "Signets",
      empty: "Ajoutez un verset aux signets pendant la lecture pour le retrouver ici.",
      add: "Ajouter ce verset aux signets",
      remove: "Retirer des signets",
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
      levelsTab: "Niveaux",
      categoriesTab: "Catégories",
      categoriesUnavailable:
        "Les catégories ne font pas partie du contenu hors ligne de cette version.",
      contentLanguageNotice: "",
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
      true: "Vrai",
      false: "Faux",
      selectAnswer: "Sélectionner…",
      lessonComplete: "Leçon terminée !",
      lessonCompleteBody: "Excellent travail, vous avez terminé cette leçon.",
      backToLessons: "Retour aux leçons",
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
      arabicQuranLabel: "Coran arabe",
      unitSurahs: "sourates",
      unitAyahs: "versets",
      englishTranslationLabel: "Traduction anglaise (Pickthall)",
      frenchTranslationLabel: "Traduction française (Kazimirski)",
      unitSegments: "segments",
      unitLessons: "leçons",
      exercisesLabel: "Exercices",
      unitExercises: "exercices",
    },
    settings: {
      title: "Réglages",
      language: "Langue",
      translations: "Traductions",
      textSize: "Taille du texte",
      theme: "Thème",
      themeLight: "Clair",
      themeDark: "Sombre",
      themeSystem: "Système",
      appearance: "Apparence",
      textSizeSmall: "Petit",
      textSizeMedium: "Moyen",
      textSizeLarge: "Grand",
    },
    common: {
      back: "Retour",
      loading: "Chargement…",
      offlineBadge: "Hors ligne",
      contentLoadError: "Échec du chargement du contenu hors ligne",
    },
  },
  // Arabic interface (Milestone D-1). brand + nav copied verbatim from
  // ../../src/locales/ar/common.ts; everything else NEEDS NATIVE REVIEW.
  ar: {
    brand: {
      name: "QuranRoots",
      tagline: "تتبّع اللغة. اكتشف المعنى.",
      logoAlt: "شعار QuranRoots: برعم ينمو من كتاب مفتوح، ضمن قوس ذهبي على هيئة مسجد تحت هلال",
    },
    nav: {
      home: "الرئيسية",
      quran: "القرآن",
      learn: "التعلّم",
      reflect: "تدبّر",
      memorize: "الحفظ",
      lessons: "الدروس",
      practice: "التمرين",
      more: "المزيد",
      primary: "التنقل الرئيسي",
    },
    more: {
      title: "الملف الشخصي والمزيد",
      open: "فتح الملف الشخصي والمزيد",
      memorization: "الحفظ",
      comingSoon: "قريبًا",
      offlineAccess: "الوصول دون اتصال",
      settings: "الإعدادات",
      bookmarks: "الإشارات المرجعية",
      practice: "التمرين",
      study: "الدراسة",
      app: "التطبيق",
      planned: "مخطّط له",
      offlineProfile: "ملف شخصي دون اتصال",
      offlineProfileBody: "تُحفظ إشاراتك المرجعية وموضع قراءتك وإعداداتك على هذا الجهاز فقط.",
    },
    planned: {
      badge: "مخطّط له",
      reflectBody: "ميزة التدبّر مخطّط لها في تحديث قادم، وهي غير متاحة في هذا الإصدار من التطبيق.",
      memorizeBody: "ميزة الحفظ مخطّط لها في تحديث قادم، وهي غير متاحة في هذا الإصدار من التطبيق.",
      availableNow: "متاح الآن",
      openQuran: "قراءة القرآن",
      openLearn: "فتح الدروس",
    },
    home: {
      greeting: "مرحبًا بعودتك",
      continueReading: "متابعة القراءة",
      startReading: "ابدأ القراءة",
      continueLearning: "متابعة التعلّم",
      startLearning: "ابدأ التعلّم",
      yourProgress: "تقدّمك",
      explore: "استكشف",
      shortcuts: "اختصارات",
    },
    reader: {
      surahs: "السور",
      search: "ابحث عن سورة",
      favoritesOnly: "المفضّلة",
      filterAll: "الكل",
      filterMakki: "مكية",
      filterMadani: "مدنية",
      tabEnglish: "الإنجليزية",
      tabFrench: "الفرنسية",
      ayah: "الآية",
      words: "الكلمات",
      tileSubtitle: "العربية والإنجليزية والفرنسية",
      noResults: "لا توجد سور مطابقة لبحثك.",
      searchWords: "ابحث عن كلمة",
      translation: "الترجمة",
      arabicOnly: "العربية فقط",
      fontSize: "حجم الخط العربي",
      smaller: "تصغير النص العربي",
      larger: "تكبير النص العربي",
      progress: "تقدّم القراءة",
      of: "من",
      audio: "التلاوة الصوتية",
      audioUnavailable: "غير متاحة بعد",
      previousVerse: "الآية السابقة",
      nextVerse: "الآية التالية",
      favorite: "إضافة إلى المفضّلة",
      unfavorite: "إزالة من المفضّلة",
    },
    bookmarks: {
      title: "الإشارات المرجعية",
      empty: "أضف إشارة مرجعية إلى آية أثناء القراءة لتجدها هنا.",
      add: "إضافة إشارة مرجعية لهذه الآية",
      remove: "إزالة الإشارة المرجعية",
    },
    word: {
      title: "تفاصيل الكلمة",
      root: "الجذر",
      meaning: "المعنى",
      occurrences: "مرات الورود في القرآن",
      example: "مثال",
      relatedWords: "كلمات ذات صلة",
      transliteration: "النقحرفة",
      noResults: "لا توجد كلمات مطابقة لبحثك.",
    },
    lessons: {
      title: "الدروس",
      level: "المستوى",
      module: "الوحدة",
      lesson: "الدرس",
      minutes: "د",
      levelsTab: "المستويات",
      categoriesTab: "الفئات",
      categoriesUnavailable: "الفئات ليست جزءًا من المحتوى المتاح دون اتصال في هذا الإصدار.",
      contentLanguageNotice: "محتوى الدروس متاح بالإنجليزية والفرنسية فقط، ويُعرض هنا بالإنجليزية.",
    },
    player: {
      step: "الخطوة",
      of: "من",
      next: "التالي",
      previous: "السابق",
      finish: "إنهاء",
      checkAnswer: "تحقّق من الإجابة",
      correct: "إجابة صحيحة!",
      incorrect: "ليست تمامًا.",
      true: "صح",
      false: "خطأ",
      selectAnswer: "اختر…",
      lessonComplete: "اكتمل الدرس!",
      lessonCompleteBody: "أحسنت، لقد أنهيت هذا الدرس.",
      backToLessons: "العودة إلى الدروس",
    },
    practice: {
      title: "التمرين",
      subtitle: "راجع تمارين دروسك",
      empty: "أكمل درسًا لفتح تمارين التمرين.",
    },
    offline: {
      title: "الوصول دون اتصال",
      upToDate: "كل المحتوى الموثّق مضمّن ومتاح دون اتصال.",
      version: "إصدار المحتوى",
      generatedAt: "تاريخ التصدير",
      surahsLabel: "السور والآيات",
      lessonsLabel: "الدروس والتمارين",
      arabicQuranLabel: "القرآن بالعربية",
      unitSurahs: "سورة",
      unitAyahs: "آية",
      englishTranslationLabel: "الترجمة الإنجليزية (Pickthall)",
      frenchTranslationLabel: "الترجمة الفرنسية (Kazimirski)",
      unitSegments: "مقطع",
      unitLessons: "درس",
      exercisesLabel: "التمارين",
      unitExercises: "تمرين",
    },
    settings: {
      title: "الإعدادات",
      language: "اللغة",
      translations: "الترجمات",
      textSize: "حجم النص",
      theme: "المظهر",
      themeLight: "فاتح",
      themeDark: "داكن",
      themeSystem: "النظام",
      appearance: "المظهر العام",
      textSizeSmall: "صغير",
      textSizeMedium: "متوسط",
      textSizeLarge: "كبير",
    },
    common: {
      back: "رجوع",
      loading: "جارٍ التحميل…",
      offlineBadge: "دون اتصال",
      contentLoadError: "تعذّر تحميل المحتوى دون اتصال",
    },
  },
} as const;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof dictionaries.en>;

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "fr", "ar"];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type I18nContextValue = {
  locale: Locale;
  /** Locale for bundled lesson/word content (en/fr only). */
  contentLocale: ContentLocale;
  setLocale: (locale: Locale) => void;
  d: Dictionary;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

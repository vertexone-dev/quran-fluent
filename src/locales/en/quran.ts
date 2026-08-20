export const quran = {
  page: {
    title: "Interactive Qur'an study",
    intro:
      "Browse by Surah, Ayah or Juz, with translation, transliteration, audio and a word study panel for every word.",
    typographyBadge: "Typography preview",
    typographyNote: "Al-Fatiha 1:1 — displayed to preview Arabic typography and spacing.",
    dataTitle: "How Qur'an data is handled",
    dataIntro:
      "Each layer is imported from a documented source and stored separately. Conflicting translations or interpretations are never silently merged.",
    layers: [
      {
        name: "Qur'anic Arabic",
        detail: "Verified Uthmani text, stored on its own and never modified.",
      },
      {
        name: "Translations",
        detail: "Each translation attributed to its translator and edition.",
      },
      { name: "Transliteration", detail: "Kept separate so it can be toggled or replaced." },
      {
        name: "Word-level data",
        detail: "Word meaning, root and part of speech from documented corpora.",
      },
      { name: "Audio", detail: "Reciter metadata and per-Ayah timing." },
      { name: "Tafsir", detail: "Attributable scholarly sources only, shown with citation." },
    ],
    translationsTitle: "Translations by language",
    translationsIntro:
      "Each language reads the Qur'an through its own verified translation, displayed with the translator's name. Translations are never machine-generated.",
    translationEn: "English — Marmaduke Pickthall (Project Gutenberg eBook #16955)",
    translationFr: "French — Muhammad Hamidullah",
    searchNote:
      "Search will accept everyday words in your interface language — such as mercy, patience or prayer — and map them to verified Qur'anic vocabulary rather than matching raw text.",
  },
  reader: {
    title: "Read",
    intro:
      "A curated set of short, commonly memorized Surahs to read, bookmark, note and memorize. The complete Mushaf arrives in a later phase.",
    selectSurah: "Select a Surah",
    ayahLabel: "Ayah {number}",
    actions: {
      bookmark: "Bookmark Ayah",
      removeBookmark: "Remove Bookmark",
      addNote: "Add Note",
      memorize: "Memorize",
      more: "More actions",
    },
    loading: "Loading Surah…",
    error: {
      title: "Couldn't load this Surah.",
      retry: "Retry",
    },
    translationUnavailable: "English translation not available yet for this Ayah.",
    attribution: {
      label: "Translator: {translator}",
      detailsAriaLabel: "Translation source details",
      details:
        "Marmaduke Pickthall — Project Gutenberg eBook #16955 digital edition. Public domain in the United States. Not represented as an exact reproduction of the 1930 first edition.",
    },
  },
  word: {
    meaning: "Meaning",
    root: "Root",
    transliteration: "Transliteration",
    type: "Word type",
    noun: "Noun",
    verb: "Verb",
    particle: "Particle",
    phrase: "Phrase",
  },
  vocabulary: {
    title: "Most frequent Qur'anic words",
    intro:
      "Start with the most common words in the Qur'an. Each entry shows the Arabic, transliteration, meaning, root and an example Ayah.",
    searchPlaceholder: "Search words…",
    filterAll: "All",
    frequencyRank: "Rank #{rank}",
    occurrences: "{count} occurrences",
    save: "Save for review",
    saved: "Saved",
    remove: "Remove",
    saveToast: "Word saved for review.",
    removeToast: "Word removed from review list.",
    empty: "No words match your search.",
    signInToSave: "Sign in to save words for review.",
  },
};

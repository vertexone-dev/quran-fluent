export const quran = {
  page: {
    title: "Interactive Qur'an study",
    intro:
      "Browse by Surah, Ayah or Juz, with translation, transliteration, audio and a word study panel for every word.",
    typographyBadge: "Typography preview",
    typographyNote: "Al-Fatiha 1:1 — displayed to preview Arabic typography and spacing.",
    // Short tab labels for the vocabulary/data/translations tab strip --
    // deliberately shorter than dataTitle/translationsTitle/vocabulary.title
    // below, which remain the full in-panel headings once a tab is open.
    // "Sources" (not the full "How data is handled") so all three labels
    // fit one row of the tab strip without wrapping at 390px wide.
    // Landmark label for the section wrapping the tab strip below --
    // distinct from the tab labels themselves, read by a screen reader
    // landing on the region before any tab's own content is announced.
    moreTitle: "Vocabulary, sources and translations",
    tabs: {
      vocabulary: "Vocabulary",
      dataHandling: "Sources",
      translations: "Translations",
    },
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
    translationFr: "French — Albin de Kazimirski Biberstein, Le Koran (1869)",
    searchNote:
      "Search will accept everyday words in your interface language — such as mercy, patience or prayer — and map them to verified Qur'anic vocabulary rather than matching raw text.",
  },
  reader: {
    title: "Read",
    intro:
      "The complete Mushaf — all 114 Surahs, 6,236 Ayahs — to read, bookmark, note and memorize.",
    selectSurah: "Select a Surah",
    ayahLabel: "Ayah {number}",
    actions: {
      bookmark: "Bookmark Ayah",
      removeBookmark: "Remove Bookmark",
      addNote: "Add Note",
      reflect: "Reflect",
      memorize: "Memorize",
      more: "More actions",
    },
    loading: "Loading Surah…",
    error: {
      title: "Couldn't load this Surah.",
      retry: "Retry",
    },
    translationUnavailable: "English translation not available yet for this Ayah.",
    translationContinuesFrom: "↳ See Ayah {number} above — one historical verse spans both.",
    attribution: {
      label: "Translator: {translator}",
      detailsAriaLabel: "Translation source details",
      // Keyed by translator (see resolveTranslationAttributionKey in
      // src/lib/quran.ts), not by interface locale -- preferred_translation
      // can diverge from locale (e.g. Kazimirski read under this English
      // interface), so the popover must pick its text by which source is
      // actually active, never by which language the UI chrome is in.
      details: {
        pickthall:
          "Marmaduke Pickthall — Project Gutenberg eBook #16955 digital edition. Public domain in the United States. Not represented as an exact reproduction of the 1930 first edition.",
        kazimirski:
          "Albin de Kazimirski Biberstein — Le Koran, Charpentier, 1869 edition (translation first published in 1840). Public domain. Historical translation: 1869 spelling, punctuation and word choices preserved without modernization. The correspondence between Kazimirski's verse segmentation and today's canonical numbering has undergone dedicated human review; a separate review of the translation's own quality remains open.",
      },
    },
  },
  audio: {
    play: "Play recitation",
    pause: "Pause recitation",
    restart: "Replay from start",
    loading: "Loading recitation…",
    unavailable: "Recitation audio isn't available for this Ayah.",
    error: "Couldn't play the recitation. Try again.",
    reciterLabel: "Reciter: {reciter}",
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
    showMore: "Show more words",
    showLess: "Show fewer words",
  },
  // QR-INT-007 (Milestone C): Reader toolbar, audio mini-player and the
  // Understand This Ayah page. Interface copy only -- never Quran text,
  // translation, tafsir or explanations.
  readerUi: {
    toolbarLabel: "Reader navigation",
    prevSurah: "Previous Surah",
    nextSurah: "Next Surah",
    jumpLabel: "Go to Ayah",
    jumpGo: "Go",
    jumpInvalid: "Enter an Ayah number between 1 and {max}.",
    understand: "Understand this Ayah",
    offline: "You're offline. Reconnect to load this Surah.",
    empty: "No Ayahs are available for this Surah yet.",
  },
  miniPlayer: {
    label: "Recitation player",
    nowPlaying: "{surah} · Ayah {ayah}",
    loading: "Loading…",
    playing: "Playing",
    paused: "Paused",
    ended: "Finished",
    resume: "Resume recitation",
    pause: "Pause recitation",
    replay: "Replay this Ayah",
    next: "Play next Ayah",
    close: "Close player",
    reciter: "Reciter: {reciter}",
    changeReciter: "Change reciter in Settings",
  },
  understand: {
    metaTitle: "Understand this Ayah — QuranRoots",
    metaDescription:
      "Study one Ayah: the Arabic as stored, verified English and French translations side by side with their sources, and honest notes on what is still awaiting a verified source.",
    eyebrow: "Understand",
    title: "Understand this Ayah",
    intro:
      "Read → Understand → Reflect. The Arabic is shown exactly as stored; every translation names its source.",
    selectSurah: "Choose a Surah",
    prev: "Previous Ayah",
    next: "Next Ayah",
    openReader: "Open in the reader",
    reflect: "Reflect on this Ayah",
    tabs: {
      translations: "Translations",
      words: "Words",
      tafsir: "Tafsir",
      context: "Context",
    },
    comparisonTitle: "Translation comparison",
    english: "English",
    french: "French",
    unavailableEn: "English translation not available yet for this Ayah.",
    unavailableFr: "French translation not available yet for this Ayah.",
    wordsUnavailable:
      "Word-by-word meanings are awaiting a verified, licensed source matched to this exact word and Ayah. Nothing is shown until then.",
    tafsirUnavailable:
      "Tafsir is awaiting an approved scholarly source. QuranRoots does not write or generate tafsir.",
    contextUnavailable:
      "Context notes are awaiting an approved scholarly source. Nothing is shown until then.",
    notFound: "This Ayah isn't part of the Surah you chose. Pick another Ayah below.",
    error: "Couldn't load this Ayah.",
    retry: "Retry",
    homeLink: "Study this Ayah in depth",
  },
};

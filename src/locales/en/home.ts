export const home = {
  // QR-INT-006: homepage "Understand This Ayah" and "Guided Learning Journeys"
  // sections. Interface copy only -- the ayah, its translation and translator
  // come from the canonical content tables at runtime, never from here.
  understand: {
    eyebrow: "Understand",
    title: "Understand This Ayah",
    body: "Study one ayah at a time: the Arabic, its meaning, its words, and space to reflect.",
    reference: "{surah} · {surahNumber}:{ayah}",
    tabs: { meaning: "Meaning", words: "Word by Word", tafsir: "Tafsir", reflect: "Reflect" },
    wordsUnavailable: "Word-by-word study for this ayah is awaiting a verified source.",
    wordsCta: "Practise Qur'anic vocabulary",
    tafsirUnavailable:
      "Tafsir will appear here only from a verified, attributed source reviewed by qualified scholars.",
    reflectPrompt: "What is one way this ayah can shape your day?",
    reflectCta: "Write a reflection",
    openReader: "Open in the reader",
    loading: "Loading the ayah…",
    error: "This ayah couldn't be loaded right now. Check your connection and try again.",
    retry: "Try again",
  },
  journeys: {
    eyebrow: "Learn",
    title: "Guided Learning Journeys",
    body: "Step-by-step levels, from the Arabic alphabet to understanding complete ayat.",
    explore: "Explore the course",
    continueLearning: "Continue learning",
  },
  hero: {
    steps: ["Read", "Understand", "Reflect", "Practice", "Grow"],
    titleLine1: "A Deeper Journey",
    titleLine2: "with the Quran",
    subtitle: "Read, understand, reflect upon, and live by the teachings of the Quran.",
    note: "Qur'anic text and translations come from verified sources only.",
    continueReading: "Continue Reading",
    continuingFrom: "Continuing from {surah}, Ayah {ayah}",
    documentTitle: "QuranRoots — Learn Arabic. Understand the Qur'an.",
  },
  journey: {
    title: "Your Journey",
    emptySignedOut: "Create an account to save your place and track real progress.",
    createAccount: "Create account",
    emptySignedIn: "Bookmark an ayah while you read and your place will appear here.",
    openReader: "Open the reader",
    resumeCta: "Resume",
  },
  quickLinks: {
    title: "Explore QuranRoots",
    items: [
      {
        title: "Read the Qur'an",
        body: "Browse by Surah, Ayah or Juz with verified Arabic text.",
      },
      {
        title: "Understand This Ayah",
        body: "Word meanings, roots and types from verified sources.",
      },
      {
        title: "Reflect",
        body: "Guided prompts to connect any ayah to your own life.",
      },
      {
        title: "Memorize",
        body: "Listen, repeat and review with spaced repetition.",
      },
      {
        title: "Guided Learning",
        body: "Six structured levels, from the alphabet to full comprehension.",
      },
    ],
  },
  how: {
    title: "How it works",
    steps: [
      {
        title: "Choose your level",
        body: "Tell us where you are, from the alphabet to fluent reading.",
      },
      {
        title: "Follow your plan",
        body: "Short daily lessons built around real Qur'anic vocabulary.",
      },
      {
        title: "Open the Qur'an",
        body: "Read verified Arabic text with translation and word study.",
      },
      {
        title: "Practice and review",
        body: "Quizzes, memorization and spaced review keep it durable.",
      },
    ],
  },
  pillars: {
    title: "A complete academy, not just a reader",
    items: [
      {
        title: "Learn Qur'anic Arabic",
        body: "Six levels: alphabet and harakat, reading, vocabulary, grammar, roots, and full comprehension.",
      },
      {
        title: "Interactive Qur'an study",
        body: "Browse by Surah, Ayah or Juz with translation, transliteration and comfortable Arabic typography.",
      },
      {
        title: "Memorization (Hifz)",
        body: "Listen, repeat, hide and recite with adjustable repetition and review scheduling.",
      },
      {
        title: "Vocabulary and roots",
        body: "Learn the most frequent Qur'anic words and trace them back to their three-letter roots.",
      },
      {
        title: "Tajweed foundations",
        body: "Structured lessons prepared for expert-reviewed content — never auto-generated rulings.",
      },
      {
        title: "Progress you can trust",
        body: "The Qur'an Understanding Score is computed from your real activity, not from guesses.",
      },
    ],
  },
  wordStudy: {
    title: "Every word, understood",
    body: "Select any word while reading and open a study panel with its meaning, transliteration, root and word type — then add it to your vocabulary and practice it. Linguistic data is only shown when it comes from a verified source.",
    bullets: [
      "Word-by-word mode",
      "Root explorer",
      "Vocabulary trainer",
      "Occurrences in the Qur'an",
    ],
    panelLabel: "Example word panel",
    meaning: "Meaning",
    meaningValue: "Praise",
    transliteration: "Transliteration",
    root: "Root",
    wordType: "Word type",
    wordTypeValue: "Noun",
  },
  testimonials: {
    title: "From our learners",
    note: "Placeholder — real learner stories will be added before launch.",
  },
  cta: {
    title: "Begin your journey today",
    body: "Ten focused minutes a day is enough to start reading and understanding the language of the Qur'an.",
  },
  features: {
    title: "Features and roadmap",
    documentTitle: "Features",
    intro:
      "QuranRoots ships real, working functionality first. Here's what's live today, and what's still being built.",
    groups: [
      {
        phase: "Live now",
        items: [
          "Brand design system with light and dark themes, and a responsive application shell",
          "Accounts, email verification and Google sign-in",
          "Learner onboarding: level, goal, daily target, language",
          "English, French and Arabic interface, with right-to-left layout for Arabic (French and Arabic wording awaiting native-speaker review)",
          "Personalized dashboard with skill tracking across vocabulary, grammar, comprehension, tajweed and memorization",
          "Levels 1–5 of the six-level Arabic course: real lessons, a lesson player, vocabulary trainer, quizzes and progress tracking",
          "Root and grammar foundations built into the curriculum",
          "The complete Qur'an: all 114 Surahs and 6,236 Ayahs",
          "Translation and word-by-word transliteration",
          "Recitation audio",
          "Bookmarks, notes and word-by-word study mode",
          "Hifz (memorization) mode with review scheduling",
        ],
      },
      {
        phase: "Coming later",
        items: [
          "Level 6: Qur'anic comprehension",
          "Contextual AI tutoring in English and French, with grammar explanations and personalized quizzes — sourced answers only, never generated Qur'anic text or rulings",
          "Premium subscription",
        ],
      },
    ],
  },
  about: {
    title: "About QuranRoots",
    intro:
      "A modern, linguistic bridge connecting everyday readers to the foundational Arabic root words of the Qur'an — fostering depth, growth, and understanding.",
    cards: [
      {
        title: "Our method",
        body: "Every lesson follows the same rhythm: learn, see an example, listen, practice, take a short quiz, then review. Vocabulary is drawn from the words that occur most often in the Qur'an, so early effort pays off immediately in your reading.",
      },
      {
        title: "Respect for the text",
        body: "Qur'anic Arabic, translations, transliteration, word-level morphology and audio are stored separately and served from verified, documented sources. We never generate or alter Qur'anic text, and we do not produce tafsir, hadith, fatwas or rulings automatically. Where expert-reviewed content is not yet available, the interface says so plainly.",
      },
      {
        title: "Three languages",
        body: "QuranRoots is available in English, French and Arabic (right-to-left). The French and Arabic interface wording is still being refined and awaits review by qualified native speakers. Qur'an translations are separate from the interface wording: they come only from the attributed sources named next to each verse. Switching language changes the words on screen, never your account, progress, vocabulary, bookmarks or streak.",
      },
      {
        title: "Honest progress",
        body: "The Qur'an Understanding Score is only ever computed from your real activity. Any figure shown before the underlying data exists is clearly labelled as demo data.",
      },
    ],
  },
};

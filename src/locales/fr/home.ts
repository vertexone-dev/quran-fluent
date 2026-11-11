import type { home as EnHome } from "../en/home";

export const home: typeof EnHome = {
  understand: {
    eyebrow: "Comprendre",
    title: "Comprendre ce verset",
    body: "Étudiez un verset à la fois : l’arabe, son sens, ses mots et un espace pour méditer.",
    reference: "{surah} · {surahNumber}:{ayah}",
    tabs: { meaning: "Sens", words: "Mot à mot", tafsir: "Tafsir", reflect: "Méditer" },
    wordsUnavailable: "L’étude mot à mot de ce verset attend une source vérifiée.",
    wordsCta: "Pratiquer le vocabulaire coranique",
    tafsirUnavailable:
      "Le tafsir n’apparaîtra ici qu’à partir d’une source vérifiée et attribuée, revue par des savants qualifiés.",
    reflectPrompt: "De quelle manière ce verset peut-il guider votre journée ?",
    reflectCta: "Écrire une réflexion",
    openReader: "Ouvrir dans le lecteur",
    loading: "Chargement du verset…",
    error: "Ce verset n’a pas pu être chargé. Vérifiez votre connexion et réessayez.",
    retry: "Réessayer",
  },
  journeys: {
    eyebrow: "Apprendre",
    title: "Parcours d’apprentissage guidés",
    body: "Des niveaux progressifs, de l’alphabet arabe à la compréhension de versets complets.",
    explore: "Découvrir le cours",
    continueLearning: "Continuer l’apprentissage",
  },
  hero: {
    steps: ["Lire", "Comprendre", "Méditer", "Pratiquer", "Progresser"],
    titleLine1: "Un voyage plus profond",
    titleLine2: "avec le Coran",
    subtitle: "Lire, comprendre, méditer et vivre selon les enseignements du Coran.",
    note: "Le texte coranique et les traductions proviennent exclusivement de sources vérifiées.",
    continueReading: "Continuer la lecture",
    continuingFrom: "Reprise à {surah}, verset {ayah}",
    documentTitle: "QuranRoots — Apprenez l'arabe. Comprenez le Coran.",
  },
  journey: {
    title: "Votre parcours",
    emptySignedOut: "Créez un compte pour garder votre place et suivre votre progression réelle.",
    createAccount: "Créer un compte",
    emptySignedIn: "Ajoutez un verset aux favoris pendant la lecture : votre place apparaîtra ici.",
    openReader: "Ouvrir le lecteur",
    resumeCta: "Reprendre",
  },
  quickLinks: {
    title: "Découvrir QuranRoots",
    items: [
      {
        title: "Lire le Coran",
        body: "Parcourez par sourate, verset ou juz avec un texte arabe vérifié.",
      },
      {
        title: "Comprendre ce verset",
        body: "Sens, racines et types des mots, issus de sources vérifiées.",
      },
      {
        title: "Méditer",
        body: "Des invites guidées pour relier chaque verset à votre propre vie.",
      },
      {
        title: "Mémoriser",
        body: "Écoutez, répétez et révisez avec une répétition espacée.",
      },
      {
        title: "Apprentissage guidé",
        body: "Six niveaux structurés, de l'alphabet à la compréhension complète.",
      },
    ],
  },
  how: {
    title: "Comment ça marche",
    steps: [
      {
        title: "Choisissez votre niveau",
        body: "Dites-nous où vous en êtes, de l'alphabet à la lecture fluide.",
      },
      {
        title: "Suivez votre plan",
        body: "De courtes leçons quotidiennes bâties sur le vocabulaire réel du Coran.",
      },
      {
        title: "Ouvrez le Coran",
        body: "Lisez un texte arabe vérifié, avec traduction et étude mot à mot.",
      },
      {
        title: "Entraînez-vous et révisez",
        body: "Quiz, mémorisation et révision espacée pour ancrer durablement vos acquis.",
      },
    ],
  },
  pillars: {
    title: "Une véritable académie, pas un simple lecteur",
    items: [
      {
        title: "Apprendre l'arabe coranique",
        body: "Six niveaux : alphabet et harakat, lecture, vocabulaire, grammaire, racines et compréhension complète.",
      },
      {
        title: "Étude interactive du Coran",
        body: "Parcourez par sourate, verset ou juz', avec traduction, translittération et une typographie arabe confortable.",
      },
      {
        title: "Mémorisation (Hifz)",
        body: "Écoutez, répétez, masquez et récitez, avec un nombre de répétitions et un calendrier de révision ajustables.",
      },
      {
        title: "Vocabulaire et racines",
        body: "Apprenez les mots les plus fréquents du Coran et remontez à leurs racines trilitères.",
      },
      {
        title: "Bases du Tajwid",
        body: "Des leçons structurées, prêtes à accueillir un contenu validé par des experts — jamais de règles générées automatiquement.",
      },
      {
        title: "Une progression fiable",
        body: "Le score de compréhension du Coran est calculé à partir de votre activité réelle, jamais estimé.",
      },
    ],
  },
  wordStudy: {
    title: "Chaque mot, compris",
    body: "Touchez un mot pendant votre lecture et ouvrez un panneau d'étude : sens, translittération, racine et nature grammaticale — puis ajoutez-le à votre vocabulaire pour le travailler. Les données linguistiques ne s'affichent que lorsqu'elles proviennent d'une source vérifiée.",
    bullets: [
      "Mode mot à mot",
      "Explorateur de racines",
      "Entraîneur de vocabulaire",
      "Occurrences dans le Coran",
    ],
    panelLabel: "Exemple de panneau de mot",
    meaning: "Signification",
    meaningValue: "La louange",
    transliteration: "Translittération",
    root: "Racine",
    wordType: "Catégorie grammaticale",
    wordTypeValue: "Nom",
  },
  testimonials: {
    title: "Nos apprenants",
    note: "Espace réservé — de véritables témoignages seront ajoutés avant le lancement.",
  },
  cta: {
    title: "Commencez votre parcours dès aujourd'hui",
    body: "Dix minutes attentives par jour suffisent pour commencer à lire et à comprendre la langue du Coran.",
  },
  features: {
    title: "Fonctionnalités et feuille de route",
    documentTitle: "Fonctionnalités",
    intro:
      "QuranRoots livre d'abord de vraies fonctionnalités opérationnelles. Voici ce qui est disponible aujourd'hui, et ce qui reste à construire.",
    groups: [
      {
        phase: "Disponible maintenant",
        items: [
          "Système de design de marque, thèmes clair et sombre, et interface entièrement responsive",
          "Comptes, vérification de l'e-mail et connexion Google",
          "Intégration de l'apprenant : niveau, objectif, temps quotidien, langue",
          "Interface en anglais, en français et en arabe, avec affichage de droite à gauche pour l'arabe (textes français et arabes en attente de relecture par des locuteurs natifs)",
          "Tableau de bord personnalisé avec suivi des compétences en vocabulaire, grammaire, compréhension, tajwid et mémorisation",
          "Niveaux 1 à 5 du cours d'arabe en six niveaux : vraies leçons, lecteur de leçons, entraîneur de vocabulaire, quiz et suivi de la progression",
          "Fondations de racines et de grammaire intégrées au programme",
          "Le Coran complet : les 114 sourates et 6 236 versets",
          "Traduction et translittération mot à mot",
          "Audio de récitation",
          "Favoris, notes et mode d'étude mot à mot",
          "Mode Hifz (mémorisation) avec planification des révisions",
        ],
      },
      {
        phase: "À venir",
        items: [
          "Niveau 6 : compréhension coranique",
          "Tuteur IA contextuel en français et en anglais, avec explications grammaticales et quiz personnalisés — réponses sourcées uniquement, jamais de texte coranique ni d'avis religieux générés",
          "Abonnement premium",
        ],
      },
    ],
  },
  about: {
    title: "À propos de QuranRoots",
    intro:
      "Un pont linguistique moderne entre les lecteurs d'aujourd'hui et les racines arabes qui portent le sens du Coran — pour gagner en profondeur et en compréhension.",
    cards: [
      {
        title: "Notre méthode",
        body: "Chaque leçon suit le même rythme : apprendre, voir un exemple, écouter, s'entraîner, passer un court quiz, puis réviser. Le vocabulaire est tiré des mots les plus fréquents du Coran : vos premiers efforts se ressentent immédiatement dans votre lecture.",
      },
      {
        title: "Respect du texte",
        body: "Le texte arabe, les traductions, la translittération, la morphologie mot à mot et l'audio sont stockés séparément et servis depuis des sources vérifiées et documentées. Nous ne générons ni ne modifions jamais le texte coranique, et nous ne produisons pas automatiquement de tafsir, de hadith ni d'avis juridique. Lorsqu'un contenu validé par des experts n'est pas encore disponible, l'interface le dit clairement.",
      },
      {
        title: "Trois langues",
        body: "QuranRoots est disponible en anglais, en français et en arabe (affichage de droite à gauche). Les textes de l'interface en français et en arabe sont encore en cours d'amélioration et attendent la relecture de locuteurs natifs qualifiés. Les traductions du Coran sont distinctes des textes de l'interface : elles proviennent uniquement des sources attribuées, indiquées à côté de chaque verset. Changer de langue change les mots à l'écran, jamais votre compte, votre progression, votre vocabulaire, vos favoris ni votre série.",
      },
      {
        title: "Une progression honnête",
        body: "Le score de compréhension du Coran est toujours calculé à partir de votre activité réelle. Toute valeur affichée avant l'existence des données sous-jacentes est clairement signalée comme démonstration.",
      },
    ],
  },
};

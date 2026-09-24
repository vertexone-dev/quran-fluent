export const billing = {
  nav: {
    premium: "Premium",
    billing: "Facturation",
  },
  pricing: {
    documentTitle: "Premium",
    title: "Étudiez le programme complet du Coran, à votre rythme.",
    intro:
      "Le lecteur du Coran est toujours gratuit pour tous. Premium débloque le parcours d'apprentissage complet — les niveaux 3 à 6 — ainsi que la pratique et la révision avancées.",
    preparingNotice: {
      title: "Les paiements sont en préparation.",
      body: "QuranRoots Premium n'est pas encore en vente. Le paiement est désactivé le temps de finaliser la facturation — chacun conserve son accès actuel en attendant, et rien ne change pour les apprenants existants.",
    },
    checkoutError: "Impossible de démarrer le paiement. Veuillez réessayer.",
    checkoutSignInRequired: "Veuillez vous reconnecter pour continuer vers le paiement.",
    free: {
      title: "Gratuit",
      price: "0 $",
      period: "pour toujours",
      description: "Tout ce qu'il faut pour commencer à lire, comprendre et réciter le Coran.",
      features: [
        "Le lecteur du Coran complet — les 114 sourates, arabe et traduction",
        "Niveaux 1 à 2 du parcours d'apprentissage",
        "Signets et notes",
        "Suivi de progression de base",
      ],
      cta: "Votre offre actuelle",
    },
    premium: {
      title: "Premium",
      monthlyPrice: "3,99 $",
      monthlyPeriod: "/mois",
      annualPrice: "29,99 $",
      annualPeriod: "/an",
      trialNotice: "Commencez avec un essai gratuit de 7 jours.",
      description:
        "Tout ce qui est inclus dans Gratuit, plus le parcours complet et une pratique plus poussée.",
      features: [
        "Niveaux 3 à 6 du parcours d'apprentissage",
        "Pratique et révision avancées",
        "Le futur Tuteur IA, dès sa disponibilité",
      ],
      monthlyCta: "Choisir Mensuel",
      annualCta: "Choisir Annuel",
      billedMonthly: "Facturé chaque mois",
      billedAnnually: "Facturé une fois par an",
    },
    localCurrency: {
      title: "Tarifs dans votre devise locale",
      body: "Les prix ci-dessus sont affichés en dollars américains. Au moment du paiement, les clients éligibles voient et paient automatiquement dans leur propre devise locale, grâce à Stripe ; lorsque la tarification locale n'est pas disponible, le paiement se fait par défaut en dollars américains.",
    },
    secureBilling: {
      title: "Facturation sécurisée, hébergée par Stripe",
      body: "Le paiement, les reçus, les factures et la gestion de l'abonnement se font tous sur les pages sécurisées et hébergées de Stripe. QuranRoots ne voit ni ne conserve jamais les détails de votre carte.",
    },
    levelsNote:
      "Les niveaux 1 à 2 (Bases de l'écriture arabe, Vocabulaire de base) restent gratuits pour toujours. Les niveaux 3 à 6 (Racines, Grammaire, Compréhension guidée des versets, Maîtrise de sourate) font partie de Premium.",
    faq: {
      title: "Bon à savoir",
      quranNeverPaywalled: {
        question: "Le Coran lui-même sera-t-il un jour payant ?",
        answer:
          "Non. Le lecteur du Coran, son texte arabe et ses traductions ne sont jamais payants, quelle que soit l'offre, à aucun moment.",
      },
      trial: {
        question: "Comment fonctionne l'essai gratuit ?",
        answer:
          "Chaque nouvel abonnement Premium inclut un essai gratuit de 7 jours. Vous ne serez pas facturé avant la fin de l'essai, et vous pouvez annuler à tout moment avant cette date.",
      },
      refund: {
        question: "Et si je souhaite être remboursé ?",
        answer:
          "Votre premier paiement est remboursable dans un délai de 7 jours — contactez-nous simplement et nous vous aiderons.",
      },
    },
  },
  settings: {
    documentTitle: "Facturation",
    title: "Facturation",
    intro: "Gérez votre abonnement QuranRoots.",
    loading: "Chargement de vos informations de facturation…",
    error: {
      title: "Impossible de charger vos informations de facturation.",
      retry: "Réessayer",
    },
    noSubscription: {
      title: "Vous êtes sur l'offre Gratuite.",
      body: "Passez à Premium pour débloquer les niveaux 3 à 6, ainsi que la pratique et la révision avancées.",
      cta: "Voir les offres Premium",
    },
    currentPlan: {
      title: "Offre actuelle",
      statusLabel: "Statut",
      renewsOn: "Renouvellement le {date}",
      trialEndsOn: "L'essai se termine le {date}",
      cancelsOn: "L'accès continue jusqu'au {date}, puis votre offre prend fin",
      manageCta: "Gérer la facturation",
    },
    status: {
      trialing: "Essai gratuit",
      active: "Active",
      past_due: "Paiement en retard",
      canceled: "Annulée",
      unpaid: "Impayée",
      incomplete: "Incomplète",
      incomplete_expired: "Expirée",
      paused: "En pause",
    },
    preparingNotice:
      "La gestion de la facturation est en préparation. Le paiement et les changements d'abonnement ne sont pas encore disponibles.",
  },
};

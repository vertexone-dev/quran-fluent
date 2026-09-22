export const billing = {
  nav: {
    premium: "Premium",
    billing: "Billing",
  },
  pricing: {
    documentTitle: "Premium",
    title: "Study the full Qur'an curriculum, at your own pace.",
    intro:
      "The Qur'an Reader is always free for everyone. Premium unlocks the full learning path — Levels 3 through 6 — plus advanced practice and review.",
    preparingNotice: {
      title: "Payments are being prepared.",
      body: "QuranRoots Premium is not on sale yet. Checkout is disabled while we finish setting up billing — everyone keeps their current access in the meantime, and nothing changes for existing learners.",
    },
    free: {
      title: "Free",
      price: "$0",
      period: "forever",
      description: "Everything you need to start reading, understanding and reciting the Qur'an.",
      features: [
        "The complete Qur'an Reader — all 114 surahs, Arabic and translation",
        "Levels 1–2 of the learning path",
        "Bookmarks and notes",
        "Basic progress tracking",
      ],
      cta: "Your current plan",
    },
    premium: {
      title: "Premium",
      monthlyPrice: "$3.99",
      monthlyPeriod: "/month",
      annualPrice: "$29.99",
      annualPeriod: "/year",
      trialNotice: "Start with a 7-day free trial.",
      description: "Everything in Free, plus the full learning path and deeper practice.",
      features: [
        "Levels 3–6 of the learning path",
        "Advanced practice and review",
        "The future AI Tutor, as it becomes available",
      ],
      monthlyCta: "Choose Monthly",
      annualCta: "Choose Annual",
      billedMonthly: "Billed monthly",
      billedAnnually: "Billed once a year",
    },
    localCurrency: {
      title: "Priced in your local currency",
      body: "Prices above are shown in US dollars. At checkout, eligible customers see and pay in their own local currency automatically, powered by Stripe; where local pricing isn't available, checkout falls back to USD.",
    },
    secureBilling: {
      title: "Secure, Stripe-hosted billing",
      body: "Checkout, receipts, invoices and subscription management all happen on Stripe's own secure, hosted pages. QuranRoots never sees or stores your card details.",
    },
    levelsNote:
      "Levels 1–2 (Foundations of Arabic Script, Basic Vocabulary) stay free forever. Levels 3–6 (Roots, Grammar, Guided Ayah Comprehension, Surah Mastery) are part of Premium.",
    faq: {
      title: "Good to know",
      quranNeverPaywalled: {
        question: "Will the Qur'an itself ever be behind a paywall?",
        answer:
          "No. The Qur'an Reader, its Arabic text and its translations are never paywalled, for any plan, at any time.",
      },
      trial: {
        question: "How does the free trial work?",
        answer:
          "Every new Premium subscription includes a 7-day free trial. You won't be charged until the trial ends, and you can cancel any time before then.",
      },
      refund: {
        question: "What if I want a refund?",
        answer: "Your first payment is refundable within 7 days — just reach out and we'll help.",
      },
    },
  },
  settings: {
    documentTitle: "Billing",
    title: "Billing",
    intro: "Manage your QuranRoots subscription.",
    loading: "Loading your billing details…",
    error: {
      title: "Couldn't load your billing details.",
      retry: "Retry",
    },
    noSubscription: {
      title: "You're on the Free plan.",
      body: "Upgrade to Premium to unlock Levels 3–6, advanced practice and review.",
      cta: "See Premium plans",
    },
    currentPlan: {
      title: "Current plan",
      statusLabel: "Status",
      renewsOn: "Renews on {date}",
      trialEndsOn: "Trial ends {date}",
      cancelsOn: "Access continues until {date}, then your plan ends",
      manageCta: "Manage billing",
    },
    status: {
      trialing: "Free trial",
      active: "Active",
      past_due: "Payment past due",
      canceled: "Canceled",
      unpaid: "Unpaid",
      incomplete: "Incomplete",
      incomplete_expired: "Expired",
      paused: "Paused",
    },
    preparingNotice:
      "Billing management is being prepared. Checkout and subscription changes are not yet available.",
  },
};

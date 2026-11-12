// QR-INT-002: machine-drafted Arabic -- see note in ar/common.ts. Flag for
// native-speaker review before treating as final.
export const memorization = {
  title: "الحفظ",
  intro: "اختر سورة، وكرّر كل آية بالسرعة التي تناسبك، ثم حدّدها كمحفوظة لإضافتها إلى المراجعة.",
  status: {
    not_started: "لم يبدأ",
    learning: "قيد التعلّم",
    memorized: "محفوظة",
    review_due: "تستحق المراجعة",
  },
  overview: {
    continueTitle: "متابعة الحفظ",
    continueEmpty: "اختر سورة وابدأ حفظ آية في كل مرة.",
    continueCta: "متابعة {surah}",
    dueTitle: "تستحق المراجعة",
    dueEmpty: "لقد أنجزت جميع مراجعاتك. استمر في التعلّم أو ادرس سورة.",
    dueCount: "{count} آية مستحقة",
    memorizedTitle: "محفوظة",
    memorizedCount: "{count} آية محفوظة",
    surahProgressTitle: "تقدّم السورة",
    // ⁦/⁩ (LRI/PDI) isolate "3 / 10" as one left-to-right run so
    // the slash-joined numbers can't be bidi-reordered inside this rtl
    // sentence (same fix as dashboard.goalProgress).
    ayahCount: "⁦{memorized} / {total}⁩ محفوظة",
    startSurah: "ابدأ هذه السورة",
  },
  selector: {
    label: "اختر سورة",
    ayahRange: "الآيات ⁦{from}–{to}⁩",
    start: "ابدأ الحفظ",
  },
  controls: {
    repetitionOf: "تشغيل {current} من {total}",
    previous: "الآية السابقة",
    next: "الآية التالية",
    hideArabic: "إخفاء النص العربي",
    showArabic: "إظهار النص العربي",
    hideTranslation: "إخفاء الترجمة",
    showTranslation: "إظهار الترجمة",
    markLearning: "وضع الآية قيد التعلّم",
    markMemorized: "تحديد الآية كمحفوظة",
    addToReview: "إضافة إلى المراجعة",
  },
  toast: {
    memorized: "تم تحديد الآية كمحفوظة.",
    memorizedNoTranslation:
      "تم تحديد الآية كمحفوظة. ستبدأ تذكيرات المراجعة بمجرد توفّر ترجمة لهذه الآية.",
    addedToReview: "تمت الإضافة إلى قائمة المراجعة.",
    addedToReviewNoTranslation:
      "تم وضع الآية قيد التعلّم. ستبدأ تذكيرات المراجعة بمجرد توفّر ترجمة لهذه الآية.",
    actionFailed: "لم يُحفظ ذلك. حاول مرة أخرى.",
  },
  review: {
    title: "آيات تستحق المراجعة",
    reveal: "اضغط للإظهار",
    hard: "تحتاج إلى مزيد من العمل",
    easy: "أعرفها",
  },
  loading: "جارٍ تحميل تقدّم حفظك…",
  empty: {
    title: "لا يوجد حفظ بعد.",
    body: "اختر سورة وابدأ حفظ آية في كل مرة.",
  },
  error: {
    title: "تعذّر تحميل تقدّم الحفظ.",
    retry: "إعادة المحاولة",
  },
};

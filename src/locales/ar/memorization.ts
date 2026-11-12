// QR-INT-002: machine-drafted Arabic -- see note in ar/common.ts. Flag for
// native-speaker review before treating as final.
export const memorization = {
  title: "الحفظ",
  intro: "اختر سورة، وكرّر كل آية بالسرعة التي تناسبك، ثم ضعها علامة محفوظة للمراجعة.",
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
    dueEmpty: "أنت على اطّلاع كامل. استمر في التعلّم أو ادرس سورة.",
    dueCount:
      "one:آية واحدة مستحقة|two:آيتان مستحقتان|few:{count} آيات مستحقة|many:{count} آية مستحقة|other:{count} آية مستحقة",
    memorizedTitle: "محفوظة",
    memorizedCount:
      "one:آية واحدة محفوظة|two:آيتان محفوظتان|few:{count} آيات محفوظة|many:{count} آية محفوظة|other:{count} آية محفوظة",
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
    markLearning: "وضع علامة قيد التعلّم",
    markMemorized: "وضع علامة محفوظة",
    addToReview: "إضافة إلى المراجعة",
  },
  toast: {
    memorized: "تم وضع علامة محفوظة.",
    memorizedNoTranslation:
      "تم وضع علامة محفوظة. ستبدأ تذكيرات المراجعة بمجرد توفّر ترجمة لهذه الآية.",
    addedToReview: "تمت الإضافة إلى قائمة المراجعة.",
    addedToReviewNoTranslation:
      "تم وضع علامة قيد التعلّم. ستبدأ تذكيرات المراجعة بمجرد توفّر ترجمة لهذه الآية.",
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

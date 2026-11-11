// QR-INT-002: machine-drafted Arabic -- see note in ar/common.ts. Flag for
// native-speaker review before treating as final.
export const dashboard = {
  greeting: "السلام عليكم، {name}",
  documentTitle: "لوحة التحكم — QuranRoots",
  friend: "صديقي",
  subtitle: "استمر في رحلتك مع القرآن اليوم.",
  streak: "سلسلة {count} يوم",
  longest: "الأطول {count}",
  continueLearning: "متابعة التعلّم",
  todayLesson: "الدرس 1 — الأبجدية العربية",
  lessonBadge: "المستوى 1 · أساسيات العربية",
  lessonMeta: "نحو 8 دقائق · تعلّم ← مثال ← استمع ← تمرّن ← اختبار",
  opensPhase2: "يُفتح في المرحلة 2",
  yourPlan: "خطتك",
  levelNotSet: "المستوى غير محدد",
  goalNotSet: "الهدف غير محدد",
  minutesADay: "{count} دقيقة يوميًا",
  todayTitle: "تعلّم اليوم",
  startDaily: "ابدأ الجلسة اليومية",
  reviewsDue: "{count} مراجعة مستحقة",
  // ⁦/⁩ (LRI/PDI) isolate "42/100" as one left-to-right run so the
  // slash-joined numbers can't be bidi-reordered inside this rtl sentence.
  goalProgress: "⁦{minutes}/{target}⁩ دقيقة",
  today: {
    review: { title: "قائمة المراجعة", cta: "راجع الآن" },
    weak: { title: "نقطة ضعف", cta: "تركيز", none: "لا توجد نقاط ضعف بعد" },
    path: { title: "الخطوة التالية", cta: "متابعة", none: "أدِّ اختبار تحديد المستوى" },
    goal: { title: "الهدف اليومي", cta: "استمر" },
  },
  weakAreas: {
    letterRecognition: "التعرّف على الحروف",
    letterForms: "أشكال الحروف",
    harakat: "الحركات",
    readingWords: "قراءة الكلمات",
    vocabulary: "المفردات القرآنية",
    comprehension: "فهم الآية",
    grammar: "أساسيات القواعد",
  },
  understandingTitle: "درجة فهم القرآن",

  awaiting: "في انتظار نشاطك",
  understandingNote:
    "تبقى هذه الأبعاد عند الصفر حتى يمكن حسابها من دروسك واختباراتك وتلاوتك وسجل مراجعتك الحقيقية. لا شيء هنا مقدَّر أو مُفترَض.",
  dimensions: {
    reading: "القراءة",
    vocabulary: "المفردات",
    grammar: "القواعد",
    comprehension: "الفهم",
    tajweed: "التجويد",
    memorization: "الحفظ",
  },
  activityLabel: "نشاطك",
  memorizationCard: {
    title: "الحفظ",
    memorizedCount: "{count} آية محفوظة",
    dueCount: "{count} مستحقة للمراجعة",
    empty: "ابدأ بحفظ أول آية لك.",
  },
  bookmarksCard: {
    title: "الإشارات المرجعية",
    empty: "لا توجد إشارات مرجعية بعد.",
  },
  notesCard: {
    title: "الملاحظات",
    empty: "لا توجد ملاحظات بعد.",
  },
};

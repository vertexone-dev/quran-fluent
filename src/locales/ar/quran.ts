// QR-INT-002: machine-drafted Arabic -- see note in ar/common.ts. Flag for
// native-speaker review before treating as final. Translator/edition proper
// nouns (Pickthall, Kazimirski, Gutenberg, Charpentier) are transliterated
// here for readability inside Arabic sentences -- these specific
// transliterations are a judgment call and should be checked by a native
// reviewer; they do not change which translation/edition is actually used
// (src/lib/quran.ts picks the source independently of this display string).
export const quran = {
  page: {
    title: "دراسة القرآن التفاعلية",
    intro:
      "تصفّح حسب السورة أو الآية أو الجزء، مع الترجمة والنقل الصوتي والصوت ولوحة دراسة لكل كلمة.",
    typographyBadge: "معاينة الطباعة",
    typographyNote: "الفاتحة 1:1 — تُعرض لمعاينة الطباعة العربية والتباعد.",
    moreTitle: "المفردات والمصادر والترجمات",
    tabs: {
      vocabulary: "المفردات",
      dataHandling: "المصادر",
      translations: "الترجمات",
    },
    dataTitle: "كيف تُعالَج بيانات القرآن",
    dataIntro:
      "تُستورد كل طبقة من مصدر موثَّق وتُخزَّن بشكل منفصل. لا تُدمَج الترجمات أو التفسيرات المتعارضة أبدًا بصمت.",
    layers: [
      {
        name: "النص العربي القرآني",
        detail: "نص عثماني موثّق، مخزَّن بمفرده ولا يُعدَّل أبدًا.",
      },
      {
        name: "الترجمات",
        detail: "كل ترجمة منسوبة إلى مترجمها وطبعتها.",
      },
      { name: "النقل الصوتي", detail: "يُحفظ بشكل منفصل حتى يمكن تبديله أو استبداله." },
      {
        name: "بيانات الكلمة",
        detail: "معنى الكلمة وجذرها وقسمها اللغوي من مجموعات موثَّقة.",
      },
      { name: "الصوت", detail: "بيانات القارئ وتوقيت كل آية." },
      { name: "التفسير", detail: "مصادر علمية موثّقة فقط، تُعرض مع إشارة إلى مصدرها." },
    ],
    translationsTitle: "الترجمات بحسب اللغة",
    translationsIntro:
      "تقرأ كل لغة القرآن من خلال ترجمتها الموثّقة الخاصة، وتُعرض باسم المترجم. لا تُولَّد الترجمات آليًا أبدًا.",
    translationEn: "الإنجليزية — مارمادوك بيكثال (كتاب مشروع غوتنبرغ الإلكتروني رقم 16955)",
    translationFr: "الفرنسية — ألبين دو كازيمرسكي بيبرستين، لو قرآن (1869)",
    searchNote:
      "يقبل البحث كلمات يومية بلغة واجهتك — مثل الرحمة أو الصبر أو الصلاة — ويطابقها مع مفردات قرآنية موثّقة بدلًا من مطابقة النص الخام.",
  },
  reader: {
    title: "قراءة",
    intro:
      "المصحف الكامل — جميع 114 سورة، و6,236 آية — للقراءة والإشارة المرجعية والملاحظة والحفظ.",
    selectSurah: "اختر سورة",
    ayahLabel: "الآية {number}",
    actions: {
      bookmark: "إشارة مرجعية للآية",
      removeBookmark: "إزالة الإشارة المرجعية",
      addNote: "إضافة ملاحظة",
      memorize: "حفظ",
      more: "إجراءات أخرى",
    },
    loading: "جارٍ تحميل السورة…",
    error: {
      title: "تعذّر تحميل هذه السورة.",
      retry: "إعادة المحاولة",
    },
    translationUnavailable: "الترجمة الإنجليزية لهذه الآية غير متوفرة بعد.",
    translationContinuesFrom: "↳ انظر الآية {number} أعلاه — آية تاريخية واحدة تمتد على الاثنتين.",
    attribution: {
      label: "المترجم: {translator}",
      detailsAriaLabel: "تفاصيل مصدر الترجمة",
      details: {
        pickthall:
          "مارمادوك بيكثال — النسخة الرقمية لكتاب مشروع غوتنبرغ الإلكتروني رقم 16955. ملكية عامة في الولايات المتحدة. لا تُمثَّل كنسخة طبق الأصل من الطبعة الأولى لعام 1930.",
        kazimirski:
          "ألبين دو كازيمرسكي بيبرستين — لو قرآن، طبعة شاربنتييه، 1869 (نُشرت الترجمة أول مرة عام 1840). ملكية عامة. ترجمة تاريخية: حُفظت تهجئة وعلامات ترقيم وصياغة 1869 دون تحديث. خضع التطابق بين تقسيم كازيمرسكي للآيات والترقيم القانوني الحالي لمراجعة بشرية مخصصة؛ وتبقى مراجعة جودة الترجمة نفسها مفتوحة بشكل منفصل.",
      },
    },
  },
  audio: {
    play: "تشغيل التلاوة",
    pause: "إيقاف التلاوة",
    restart: "إعادة التشغيل من البداية",
    loading: "جارٍ تحميل التلاوة…",
    unavailable: "صوت التلاوة غير متوفر لهذه الآية.",
    error: "تعذّر تشغيل التلاوة. حاول مرة أخرى.",
    reciterLabel: "القارئ: {reciter}",
  },
  word: {
    meaning: "المعنى",
    root: "الجذر",
    transliteration: "النقل الصوتي",
    type: "نوع الكلمة",
    noun: "اسم",
    verb: "فعل",
    particle: "حرف",
    phrase: "عبارة",
  },
  vocabulary: {
    title: "أكثر الكلمات القرآنية ورودًا",
    intro:
      "ابدأ بأكثر الكلمات شيوعًا في القرآن. يعرض كل مدخل الكلمة العربية ونقلها الصوتي ومعناها وجذرها وآية توضيحية.",
    searchPlaceholder: "ابحث عن كلمات…",
    filterAll: "الكل",
    frequencyRank: "الترتيب #{rank}",
    occurrences: "{count} مرة ورود",
    save: "حفظ للمراجعة",
    saved: "محفوظة",
    remove: "إزالة",
    saveToast: "تم حفظ الكلمة للمراجعة.",
    removeToast: "تمت إزالة الكلمة من قائمة المراجعة.",
    empty: "لا توجد كلمات مطابقة لبحثك.",
    signInToSave: "سجّل الدخول لحفظ الكلمات للمراجعة.",
    showMore: "عرض كلمات أكثر",
    showLess: "عرض كلمات أقل",
  },
};

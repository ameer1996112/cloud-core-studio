export const HEALTH_FORM_VERSION = "CLOUD-CORE-HEALTH-DRAFT-v1";
export const HEALTH_DOCUMENT_BUCKET = "health-medical-documents";
export const HEALTH_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export type HealthAnswer = "yes" | "no" | "na";
export type HealthAnswers = Record<string, HealthAnswer>;
export type FormQuestion = { id: string; na?: boolean; adult: string; parent: string };
export type FormContent = {
  title: string;
  introduction: string;
  parentIntroduction: string;
  questions: FormQuestion[];
  confirmations: { id: string; text: string }[];
  parentConfirmation: string;
  adultConfirmation: string;
  privacy: string;
};
// Draft translations. Publishing requires approval of this exact version and all locales.
export const healthFormContent: Record<"en" | "he" | "ar", FormContent> = {
  en: {
    title: "Cloud & Core Studio health declaration",
    introduction:
      "Complete this declaration about yourself before participating in studio classes. Answer every question. If you do not understand a medical question, ask your doctor before submitting.",
    parentIntroduction:
      "Complete this declaration about the participant named below. Your own health declaration does not cover her. If you do not understand a medical question, ask her doctor before submitting.",
    questions: [
      {
        id: "heart",
        adult: "Has your doctor told you that you have heart disease?",
        parent: "Has a doctor told you that the participant has heart disease?",
      },
      {
        id: "chest_rest",
        adult: "Do you experience chest pain at rest?",
        parent: "Does the participant experience chest pain at rest?",
      },
      {
        id: "chest_daily",
        adult: "Do you experience chest pain during ordinary daily activities?",
        parent: "Does the participant experience chest pain during ordinary daily activities?",
      },
      {
        id: "chest_exercise",
        adult: "Do you experience chest pain during exercise?",
        parent: "Does the participant experience chest pain during exercise?",
      },
      {
        id: "dizziness",
        adult:
          "In the past year, have you lost your balance because of dizziness? Answer No if it resulted from hyperventilation, including during vigorous exercise.",
        parent:
          "In the past year, has the participant lost her balance because of dizziness? Answer No if it resulted from hyperventilation, including during vigorous exercise.",
      },
      {
        id: "consciousness",
        adult: "In the past year, have you lost consciousness?",
        parent: "In the past year, has the participant lost consciousness?",
      },
      {
        id: "asthma_medication",
        adult:
          "Have you been diagnosed with asthma and needed medication for it in the past three months?",
        parent:
          "Has the participant been diagnosed with asthma and needed medication for it in the past three months?",
      },
      {
        id: "asthma_breathing",
        adult:
          "Have you been diagnosed with asthma and experienced shortness of breath or wheezing because of it in the past three months?",
        parent:
          "Has the participant been diagnosed with asthma and experienced shortness of breath or wheezing because of it in the past three months?",
      },
      {
        id: "family_heart",
        adult: "Has a first-degree relative died from heart disease?",
        parent: "Has a first-degree relative of the participant died from heart disease?",
      },
      {
        id: "family_sudden",
        adult: "Has a first-degree relative died suddenly before age 55 (a man) or 65 (a woman)?",
        parent:
          "Has a first-degree relative of the participant died suddenly before age 55 (a man) or 65 (a woman)?",
      },
      {
        id: "supervision",
        adult:
          "In the past five years, has your doctor told you to exercise only under medical supervision?",
        parent:
          "In the past five years, has a doctor told the participant to exercise only under medical supervision?",
      },
      {
        id: "chronic",
        adult: "Do you have another chronic illness that may prevent or limit physical activity?",
        parent:
          "Does the participant have another chronic illness that may prevent or limit physical activity?",
      },
      {
        id: "pregnancy",
        na: true,
        adult:
          "If currently pregnant: has this or any previous pregnancy been classified as high-risk? Select Not applicable if you are not pregnant.",
        parent:
          "If the participant is currently pregnant: has this or any previous pregnancy been classified as high-risk? Select Not applicable if she is not pregnant.",
      },
    ],
    confirmations: [
      {
        id: "truthful",
        text: "I have read and understood the questionnaire and answered every question fully and truthfully to the best of my knowledge.",
      },
      {
        id: "advice",
        text: "I understand this declaration does not replace medical advice or a required medical certificate and its review.",
      },
      {
        id: "changes",
        text: "I will report a relevant health change before another booking and seek medical advice about continuing exercise where appropriate.",
      },
      { id: "privacy", text: "I have read the health-data privacy notice." },
    ],
    parentConfirmation:
      "I am this participant’s parent or legal guardian, I am at least 18 years old, and I give permission for her participation in the studio activities covered by this declaration.",
    adultConfirmation: "I am at least 18 years old and am completing this declaration for myself.",
    privacy:
      "Cloud & Core Studio uses this declaration to manage participation eligibility and record your submission. Answers are linked to the participant, signer, form version and language. Authorized reviewers can access documents needed for review; routine staff see only necessary eligibility status. Health information is not used for marketing. You can read your submitted copy and report a change. For access, correction or deletion requests, contact Cloud & Core Studio at cloudandcorestudio@gmail.com. Declarations renew every 12 months, or earlier after a relevant health change. Records are reviewed for deletion 24 months after each document is signed; records connected to an incident or claim remain on hold until deletion is cleared. Hosting and storage use Google Cloud and Supabase, including processing outside Israel. This draft notice remains subject to final review.",
  },
  he: {
    title: "הצהרת בריאות — Cloud & Core Studio",
    introduction:
      "יש למלא הצהרה זו על עצמך לפני השתתפות בשיעורי הסטודיו. יש לענות על כל שאלה. אם שאלה רפואית אינה ברורה, יש להתייעץ עם רופא לפני ההגשה.",
    parentIntroduction:
      "יש למלא הצהרה זו על המתאמנת ששמה מופיע בהמשך. הצהרת הבריאות האישית שלך אינה מכסה אותה. אם שאלה רפואית אינה ברורה, יש להתייעץ עם הרופא שלה לפני ההגשה.",
    questions: [
      {
        id: "heart",
        adult: "האם הרופא שלך אמר לך שיש לך מחלת לב?",
        parent: "האם רופא אמר לך שלמתאמנת יש מחלת לב?",
      },
      {
        id: "chest_rest",
        adult: "האם יש לך כאבים בחזה בזמן מנוחה?",
        parent: "האם למתאמנת יש כאבים בחזה בזמן מנוחה?",
      },
      {
        id: "chest_daily",
        adult: "האם יש לך כאבים בחזה במהלך פעילויות שגרה ביום־יום?",
        parent: "האם למתאמנת יש כאבים בחזה במהלך פעילויות שגרה ביום־יום?",
      },
      {
        id: "chest_exercise",
        adult: "האם יש לך כאבים בחזה בזמן ביצוע פעילות גופנית?",
        parent: "האם למתאמנת יש כאבים בחזה בזמן ביצוע פעילות גופנית?",
      },
      {
        id: "dizziness",
        adult:
          "האם במהלך השנה החולפת איבדת שיווי משקל עקב סחרחורת? יש לענות לא אם הסחרחורת נבעה מנשימת יתר, לרבות בזמן פעילות גופנית נמרצת.",
        parent:
          "האם במהלך השנה החולפת המתאמנת איבדה שיווי משקל עקב סחרחורת? יש לענות לא אם הסחרחורת נבעה מנשימת יתר, לרבות בזמן פעילות גופנית נמרצת.",
      },
      {
        id: "consciousness",
        adult: "האם במהלך השנה החולפת איבדת את הכרתך?",
        parent: "האם במהלך השנה החולפת המתאמנת איבדה את הכרתה?",
      },
      {
        id: "asthma_medication",
        adult: "האם אובחנת כחולה באסתמה ונזקקת לטיפול תרופתי בגללה בשלושת החודשים האחרונים?",
        parent:
          "האם המתאמנת אובחנה כחולה באסתמה ונזקקה לטיפול תרופתי בגללה בשלושת החודשים האחרונים?",
      },
      {
        id: "asthma_breathing",
        adult:
          "האם אובחנת כחולה באסתמה וסבלת מקוצר נשימה או מצפצופים בגללה בשלושת החודשים האחרונים?",
        parent:
          "האם המתאמנת אובחנה כחולה באסתמה וסבלה מקוצר נשימה או מצפצופים בגללה בשלושת החודשים האחרונים?",
      },
      {
        id: "family_heart",
        adult: "האם קרוב משפחה מדרגה ראשונה שלך נפטר ממחלת לב?",
        parent: "האם קרוב משפחה מדרגה ראשונה של המתאמנת נפטר ממחלת לב?",
      },
      {
        id: "family_sudden",
        adult: "האם קרוב משפחה מדרגה ראשונה שלך נפטר מוות פתאומי לפני גיל 55 לגבר או 65 לאישה?",
        parent:
          "האם קרוב משפחה מדרגה ראשונה של המתאמנת נפטר מוות פתאומי לפני גיל 55 לגבר או 65 לאישה?",
      },
      {
        id: "supervision",
        adult: "האם בחמש השנים האחרונות הרופא שלך הורה לך לבצע פעילות גופנית רק תחת השגחה רפואית?",
        parent: "האם בחמש השנים האחרונות רופא הורה למתאמנת לבצע פעילות גופנית רק תחת השגחה רפואית?",
      },
      {
        id: "chronic",
        adult: "האם יש לך מחלה כרונית אחרת העלולה למנוע או להגביל ביצוע פעילות גופנית?",
        parent: "האם למתאמנת יש מחלה כרונית אחרת העלולה למנוע או להגביל ביצוע פעילות גופנית?",
      },
      {
        id: "pregnancy",
        na: true,
        adult:
          "אם את בהיריון כעת: האם היריון זה או היריון קודם הוגדר כהיריון בסיכון? אם אינך בהיריון יש לבחור לא רלוונטי.",
        parent:
          "אם המתאמנת בהיריון כעת: האם היריון זה או היריון קודם הוגדר כהיריון בסיכון? אם אינה בהיריון יש לבחור לא רלוונטי.",
      },
    ],
    confirmations: [
      {
        id: "truthful",
        text: "קראתי והבנתי את השאלון ועניתי על כל השאלות באופן מלא ואמיתי למיטב ידיעתי.",
      },
      {
        id: "advice",
        text: "ברור לי שההצהרה אינה מחליפה ייעוץ רפואי או אישור רפואי נדרש ובדיקתו.",
      },
      {
        id: "changes",
        text: "אדווח על שינוי רלוונטי במצב הבריאותי לפני הזמנה נוספת ואתייעץ עם רופא לגבי המשך הפעילות לפי הצורך.",
      },
      { id: "privacy", text: "קראתי את הודעת הפרטיות בנוגע למידע הבריאותי." },
    ],
    parentConfirmation:
      "אני הורה או אפוטרופוס חוקי של המתאמנת, בגיל 18 ומעלה, ומסכים/ה להשתתפותה בפעילויות הסטודיו הכלולות בהצהרה זו.",
    adultConfirmation: "אני בגיל 18 ומעלה וממלא/ת הצהרה זו על עצמי.",
    privacy:
      "Cloud & Core Studio משתמש במידע לצורך קביעת זכאות להשתתפות ותיעוד ההגשה. התשובות מקושרות למתאמנת, לחותם, לגרסת הטופס ולשפה. בודקים מורשים רשאים לגשת למסמכים הנדרשים לבדיקה; צוות רגיל רואה רק סטטוס זכאות נחוץ. מידע בריאותי אינו משמש לשיווק. ניתן לקרוא עותק שנשלח ולדווח על שינוי. לבקשות גישה, תיקון או מחיקה ניתן לפנות אל Cloud & Core Studio בכתובת cloudandcorestudio@gmail.com. ההצהרה מתחדשת מדי 12 חודשים, או מוקדם יותר בעקבות שינוי בריאותי רלוונטי. הרשומות נבדקות למחיקה כעבור 24 חודשים ממועד חתימת כל מסמך; רשומות הקשורות לאירוע או לתביעה נשמרות עד לאישור המחיקה. האחסון והאירוח נעשים באמצעות Google Cloud ו-Supabase, לרבות עיבוד מחוץ לישראל. הודעה זו היא טיוטה הכפופה לבדיקה סופית.",
  },
  ar: {
    title: "الإقرار الصحي — Cloud & Core Studio",
    introduction:
      "أكملي هذا الإقرار عن نفسك قبل المشاركة في حصص الاستوديو. أجيبي عن كل سؤال. إذا لم تفهمي سؤالًا طبيًا، استشيري طبيبك قبل الإرسال.",
    parentIntroduction:
      "أكمل هذا الإقرار عن المشتركة المذكور اسمها أدناه. إقرارك الصحي الشخصي لا يغطيها. إذا لم تفهم سؤالًا طبيًا، استشر طبيبها قبل الإرسال.",
    questions: [
      {
        id: "heart",
        adult: "هل أخبرك طبيبك بأن لديك مرضًا في القلب؟",
        parent: "هل أخبرك طبيب بأن المشتركة لديها مرض في القلب؟",
      },
      {
        id: "chest_rest",
        adult: "هل تشعرين بألم في الصدر أثناء الراحة؟",
        parent: "هل تشعر المشتركة بألم في الصدر أثناء الراحة؟",
      },
      {
        id: "chest_daily",
        adult: "هل تشعرين بألم في الصدر خلال الأنشطة اليومية المعتادة؟",
        parent: "هل تشعر المشتركة بألم في الصدر خلال الأنشطة اليومية المعتادة؟",
      },
      {
        id: "chest_exercise",
        adult: "هل تشعرين بألم في الصدر أثناء ممارسة النشاط البدني؟",
        parent: "هل تشعر المشتركة بألم في الصدر أثناء ممارسة النشاط البدني؟",
      },
      {
        id: "dizziness",
        adult:
          "خلال السنة الماضية، هل فقدتِ توازنك بسبب الدوار؟ أجيبي بلا إذا كان الدوار ناتجًا عن فرط التنفس، بما في ذلك أثناء النشاط البدني الشديد.",
        parent:
          "خلال السنة الماضية، هل فقدت المشتركة توازنها بسبب الدوار؟ أجب بلا إذا كان الدوار ناتجًا عن فرط التنفس، بما في ذلك أثناء النشاط البدني الشديد.",
      },
      {
        id: "consciousness",
        adult: "خلال السنة الماضية، هل فقدتِ الوعي؟",
        parent: "خلال السنة الماضية، هل فقدت المشتركة الوعي؟",
      },
      {
        id: "asthma_medication",
        adult: "هل شُخّصتِ بالربو واحتجتِ إلى دواء بسببه خلال الأشهر الثلاثة الماضية؟",
        parent: "هل شُخّصت المشتركة بالربو واحتاجت إلى دواء بسببه خلال الأشهر الثلاثة الماضية؟",
      },
      {
        id: "asthma_breathing",
        adult:
          "هل شُخّصتِ بالربو وعانيتِ بسببه من ضيق التنفس أو الصفير خلال الأشهر الثلاثة الماضية؟",
        parent:
          "هل شُخّصت المشتركة بالربو وعانت بسببه من ضيق التنفس أو الصفير خلال الأشهر الثلاثة الماضية؟",
      },
      {
        id: "family_heart",
        adult: "هل توفي قريب من الدرجة الأولى بسبب مرض في القلب؟",
        parent: "هل توفي قريب من الدرجة الأولى للمشتركة بسبب مرض في القلب؟",
      },
      {
        id: "family_sudden",
        adult: "هل توفي قريب من الدرجة الأولى فجأة قبل سن 55 للرجل أو 65 للمرأة؟",
        parent: "هل توفي قريب من الدرجة الأولى للمشتركة فجأة قبل سن 55 للرجل أو 65 للمرأة؟",
      },
      {
        id: "supervision",
        adult:
          "خلال السنوات الخمس الماضية، هل طلب منك طبيبك ممارسة النشاط البدني تحت إشراف طبي فقط؟",
        parent:
          "خلال السنوات الخمس الماضية، هل طلب الطبيب من المشتركة ممارسة النشاط البدني تحت إشراف طبي فقط؟",
      },
      {
        id: "chronic",
        adult: "هل لديك مرض مزمن آخر قد يمنع النشاط البدني أو يحدّ منه؟",
        parent: "هل لدى المشتركة مرض مزمن آخر قد يمنع النشاط البدني أو يحدّ منه؟",
      },
      {
        id: "pregnancy",
        na: true,
        adult:
          "إذا كنتِ حاملًا حاليًا: هل صُنّف هذا الحمل أو أي حمل سابق بأنه عالي الخطورة؟ اختاري لا ينطبق إذا لم تكوني حاملًا.",
        parent:
          "إذا كانت المشتركة حاملًا حاليًا: هل صُنّف هذا الحمل أو أي حمل سابق بأنه عالي الخطورة؟ اختر لا ينطبق إذا لم تكن حاملًا.",
      },
    ],
    confirmations: [
      {
        id: "truthful",
        text: "قرأتُ وفهمتُ الاستبيان وأجبتُ عن جميع الأسئلة بشكل كامل وصادق بحسب علمي.",
      },
      {
        id: "advice",
        text: "أفهم أن هذا الإقرار لا يحل محل المشورة الطبية أو الشهادة الطبية المطلوبة ومراجعتها.",
      },
      {
        id: "changes",
        text: "سأبلغ عن أي تغير صحي ذي صلة قبل حجز آخر، وسأطلب المشورة الطبية بشأن مواصلة النشاط عند الحاجة.",
      },
      { id: "privacy", text: "قرأتُ إشعار خصوصية البيانات الصحية." },
    ],
    parentConfirmation:
      "أنا أحد والدي هذه المشتركة أو وصيّها القانوني، وعمري 18 عامًا أو أكثر، وأوافق على مشاركتها في أنشطة الاستوديو المشمولة بهذا الإقرار.",
    adultConfirmation: "عمري 18 عامًا أو أكثر وأكمل هذا الإقرار عن نفسي.",
    privacy:
      "يستخدم Cloud & Core Studio هذا الإقرار لإدارة أهلية المشاركة وتوثيق الإرسال. ترتبط الإجابات بالمشتركة والموقّع وإصدار النموذج واللغة. يمكن للمراجعين المخوّلين الوصول إلى المستندات اللازمة للمراجعة؛ ويرى الموظفون العاديون حالة الأهلية الضرورية فقط. لا تُستخدم المعلومات الصحية للتسويق. يمكنك قراءة النسخة المرسلة والإبلاغ عن تغيير. لطلبات الوصول أو التصحيح أو الحذف، تواصل مع Cloud & Core Studio على cloudandcorestudio@gmail.com. يُجدّد الإقرار كل 12 شهرًا، أو قبل ذلك عند حدوث تغير صحي ذي صلة. تُراجع السجلات للحذف بعد 24 شهرًا من توقيع كل مستند؛ وتبقى السجلات المتعلقة بحادث أو مطالبة محفوظة إلى أن يُسمح بحذفها. تُستخدم Google Cloud وSupabase للاستضافة والتخزين، بما يشمل المعالجة خارج إسرائيل. يبقى هذا الإشعار مسودة خاضعة للمراجعة النهائية.",
  },
};

export function completeHealthAnswers(answers: HealthAnswers): boolean {
  const questions = healthFormContent.en.questions;
  return (
    Object.keys(answers).length === questions.length &&
    questions.every(
      (q) => answers[q.id] === "yes" || answers[q.id] === "no" || (q.na && answers[q.id] === "na"),
    )
  );
}
export function medicalDocumentRequired(answers: HealthAnswers) {
  return Object.values(answers).some((a) => a === "yes");
}

// Small booking-error copy; the questionnaire and its catalog stay route-lazy.
export const healthErrorCopy = {
  en: {
    unavailable: "Eligibility could not be checked. Please retry or contact the studio.",
    required: "Complete your health declaration before booking.",
    pending: "Document review is pending. Upload alone does not approve eligibility.",
  },
  he: {
    unavailable: "לא ניתן לבדוק זכאות כרגע. נסו שוב או פנו לסטודיו.",
    required: "יש להשלים הצהרת בריאות לפני ההזמנה.",
    pending: "ממתין לסקירת מסמך. העלאה לבדה אינה אישור זכאות.",
  },
  ar: {
    unavailable: "تعذر التحقق من الأهلية الآن. حاولوا مجددًا أو تواصلوا مع الاستوديو.",
    required: "يجب إكمال الإقرار الصحي قبل الحجز.",
    pending: "مراجعة المستند معلقة. التحميل وحده لا يمنح الأهلية.",
  },
};

export function healthBookingMessage(lang: keyof typeof healthErrorCopy, code: string) {
  return code === "HEALTH_REVIEW_PENDING"
    ? healthErrorCopy[lang].pending
    : code === "HEALTH_DECLARATION_REQUIRED"
      ? healthErrorCopy[lang].required
      : healthErrorCopy[lang].unavailable;
}

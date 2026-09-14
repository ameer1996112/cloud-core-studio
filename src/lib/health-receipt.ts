import type { ClinicalResponse } from "./health-clinical-contract";
import { clinicalCopy } from "./health-clinical-copy";

export type HealthReceipt = NonNullable<ClinicalResponse["declaration"]>;
export const receiptCopy = {
  en: {
    download: "Download declaration PDF",
    ready: "Save declaration PDF",
    reference: "Declaration reference",
    participant: "Participant account",
    signer: "Signer account",
    role: "Signed by",
    adult: "Adult participant",
    parent: "Parent / legal guardian",
    notice:
      "Submission receipt — this document is not medical clearance or confirmation of booking eligibility.",
  },
  he: {
    download: "הורדת ההצהרה כ־PDF",
    ready: "שמירת ההצהרה כ־PDF",
    reference: "מזהה ההצהרה",
    participant: "חשבון המשתתפת",
    signer: "חשבון החותם",
    role: "נחתם על ידי",
    adult: "משתתפת בגירה",
    parent: "הורה / אפוטרופוס חוקי",
    notice: "אישור הגשה — מסמך זה אינו אישור רפואי או אישור זכאות להזמנה.",
  },
  ar: {
    download: "تنزيل الإقرار بصيغة PDF",
    ready: "حفظ الإقرار بصيغة PDF",
    reference: "مرجع الإقرار",
    participant: "حساب المشتركة",
    signer: "حساب الموقّع",
    role: "تم التوقيع بواسطة",
    adult: "المشتركة البالغة",
    parent: "أحد الوالدين / الوصي القانوني",
    notice: "إيصال تقديم — هذا المستند ليس تصريحًا طبيًا أو تأكيدًا لأهلية الحجز.",
  },
};
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
  );

// Every medical word comes from the immutable submission, never the current template.
export function healthReceiptHtml(receipt: HealthReceipt, fontCss = "") {
  if (!["en", "he", "ar"].includes(receipt.locale)) throw new Error("Invalid receipt locale");
  const lang = receipt.locale as "en" | "he" | "ar";
  const c = clinicalCopy[lang],
    labels = receiptCopy[lang],
    w = receipt.snapshot.wording;
  const text = escapeHtml;
  const answer = (value: unknown) => {
    if (value !== "yes" && value !== "no" && value !== "na") throw new Error("Incomplete receipt");
    return text(c[value]);
  };
  const confirm = (value: unknown) => {
    if (typeof value !== "boolean") throw new Error("Incomplete receipt");
    return text(value ? c.yes : c.no);
  };
  return `<!doctype html><html lang="${lang}" dir="${lang === "en" ? "ltr" : "rtl"}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><title>Cloud &amp; Core Studio</title><style>${fontCss}
  @page { size: A4; margin: 18mm; } body { font-family: Receipt, sans-serif; font-size: 11pt; line-height: 1.65; color: #17283a; } h1 { font-size: 20pt; line-height: 1.3; } h1,h2 { break-after: avoid; } li,.confirmation { break-inside: avoid; margin-block: 12px; } .metadata { background: #f4f5f6; padding: 12px; overflow-wrap: anywhere; } .notice { border-top: 1px solid #aaa; padding-top: 12px; } bdi { unicode-bidi: isolate; }
  </style></head><body><h1>${text(w.title)}</h1><p>${text(receipt.snapshot.signerRole === "parent" ? w.parentIntroduction : w.introduction)}</p><div class="metadata"><div>${text(labels.reference)}: <bdi>${text(receipt.id)}</bdi></div><div>${text(labels.participant)}: <bdi>${text(receipt.participantId)}</bdi></div><div>${text(labels.signer)}: <bdi>${text(receipt.signerId)}</bdi></div><div>${text(c.submitted)}: <bdi>${text(new Date(receipt.submittedAt).toISOString())}</bdi></div><div>${text(c.version)}: <bdi>${text(receipt.templateVersion)}</bdi></div><div>${text(labels.role)}: ${text(labels[receipt.snapshot.signerRole])}</div></div>
  <ol>${w.questions.map((q) => `<li>${text(receipt.snapshot.signerRole === "parent" ? q.parent : q.adult)}<br><strong>${answer(receipt.answers[q.id])}</strong></li>`).join("")}</ol>
  ${w.confirmations.map((q) => `<p class="confirmation">${text(q.text)} — <strong>${confirm(receipt.confirmations[q.id])}</strong></p>`).join("")}
  <p class="confirmation">${text(receipt.snapshot.signerRole === "parent" ? w.parentConfirmation : w.adultConfirmation)} — <strong>${confirm(receipt.confirmations.signer)}</strong></p><p>${text(w.privacy)}</p><p class="notice">${text(labels.notice)}</p></body></html>`;
}

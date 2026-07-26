import type { MessageEventType, MessageLanguage } from "@/lib/messaging.types";

export type TransactionalEmailInput = {
  eventType: MessageEventType;
  language: MessageLanguage;
  subject: string;
  body: string;
  variables: Record<string, unknown>;
  actionUrl?: string | null;
  publicBaseUrl: string;
  replyTo?: string | null;
  messageKey: string;
  presentation?: {
    key: string;
    categoryLabel: string;
    action: { label: string; url: string } | null;
    facts: Array<{ key: string; label: string; value: string; ltr: boolean }>;
  };
};

export type RenderedTransactionalEmail = {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

const BRANDED_SENDER_DISPLAY_NAME = "Cloud & Core Studio";
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates configuration only; provider verification remains an operational prerequisite. */
export function validateTransactionalEmailSenderConfig(input: {
  from?: string | null;
  replyTo?: string | null;
}) {
  const from = input.from?.trim() ?? "";
  const replyTo = input.replyTo?.trim() ?? "";
  const fromMatch = from.match(/^Cloud & Core Studio <([^<>\s]+)>$/);
  if (!fromMatch || !EMAIL_ADDRESS.test(fromMatch[1])) {
    throw new Error("invalid_messaging_email_from");
  }
  if (!replyTo) throw new Error("missing_messaging_email_reply_to");
  if (!EMAIL_ADDRESS.test(replyTo)) throw new Error("invalid_messaging_email_reply_to");
  return { from: `${BRANDED_SENDER_DISPLAY_NAME} <${fromMatch[1]}>`, replyTo };
}

type LocalizedCopy = {
  kicker: string;
  cta: string;
  support: string;
  reason: string;
  closing: string;
  openInBrowser: string;
};

type FactDefinition = {
  key: string;
  labels: Record<MessageLanguage, string>;
  ltr?: boolean;
};

const FACTS: readonly FactDefinition[] = [
  { key: "class_name", labels: { he: "שיעור", ar: "الحصة", en: "Class" } },
  { key: "class_date", labels: { he: "תאריך", ar: "التاريخ", en: "Date" }, ltr: true },
  { key: "class_time", labels: { he: "שעה", ar: "الوقت", en: "Time" }, ltr: true },
  { key: "instructor_name", labels: { he: "מדריכה", ar: "المدربة", en: "Instructor" } },
  { key: "location_name", labels: { he: "מיקום", ar: "المكان", en: "Location" } },
  {
    key: "offer_expires_at",
    labels: { he: "שמירת המקום עד", ar: "المكان محفوظ حتى", en: "Spot held until" },
    ltr: true,
  },
  { key: "package_name", labels: { he: "חבילה", ar: "الباقة", en: "Package" } },
  { key: "amount", labels: { he: "סכום", ar: "المبلغ", en: "Amount" }, ltr: true },
  {
    key: "receipt_number",
    labels: { he: "מספר קבלה", ar: "رقم الإيصال", en: "Receipt" },
    ltr: true,
  },
  {
    key: "renewal_date",
    labels: { he: "מועד חידוש", ar: "موعد التجديد", en: "Renewal date" },
    ltr: true,
  },
  {
    key: "expiry_date",
    labels: { he: "בתוקף עד", ar: "صالح حتى", en: "Valid until" },
    ltr: true,
  },
  {
    key: "credits_remaining",
    labels: { he: "קרדיטים שנותרו", ar: "الرصيد المتبقي", en: "Credits left" },
    ltr: true,
  },
  {
    key: "waitlist_position",
    labels: { he: "מיקום ברשימה", ar: "الموقع في القائمة", en: "Waitlist position" },
    ltr: true,
  },
  {
    key: "spots_available",
    labels: { he: "מקומות פנויים", ar: "الأماكن المتاحة", en: "Open spots" },
    ltr: true,
  },
];

const SUPPORT_COPY: Record<MessageLanguage, Omit<LocalizedCopy, "kicker" | "cta">> = {
  he: {
    support: "יש שאלה? אפשר פשוט להשיב למייל הזה ואנחנו כאן לעזור.",
    reason: "המייל נשלח כחלק מהשירות שלך ב-Cloud & Core.",
    closing: "באהבה,\nירין וצוות Cloud & Core",
    openInBrowser: "אם הכפתור לא עובד, אפשר לפתוח את הקישור:",
  },
  ar: {
    support: "هل لديك سؤال؟ يمكنك الرد مباشرة على هذه الرسالة، نحن هنا للمساعدة.",
    reason: "أُرسلت هذه الرسالة كجزء من خدمتك في Cloud & Core.",
    closing: "بمحبة،\nيارين وفريق Cloud & Core",
    openInBrowser: "إذا لم يعمل الزر، يمكنك فتح الرابط:",
  },
  en: {
    support: "Have a question? Reply to this email and we will be happy to help.",
    reason: "This email is part of your Cloud & Core studio service.",
    closing: "With care,\nYareen & the Cloud & Core team",
    openInBrowser: "If the button does not work, open this link:",
  },
};

const KICKERS = {
  welcome: { he: "ברוכה הבאה לסטודיו", ar: "أهلاً بك في الاستوديو", en: "Welcome to the studio" },
  booking: { he: "פרטי ההזמנה", ar: "تفاصيل الحجز", en: "Booking update" },
  class: { he: "עדכון מהסטודיו", ar: "تحديث من الاستوديو", en: "Studio update" },
  waitlist: { he: "עדכון רשימת המתנה", ar: "تحديث قائمة الانتظار", en: "Waitlist update" },
  payment: { he: "עדכון תשלום", ar: "تحديث الدفع", en: "Payment update" },
  membership: { he: "עדכון חברות", ar: "تحديث الاشتراك", en: "Membership update" },
  concierge: {
    he: "הודעה אישית מהסטודיו",
    ar: "رسالة شخصية من الاستوديو",
    en: "A personal note from the studio",
  },
  chosen: { he: "נבחר בשבילך", ar: "اخترناه لك", en: "Chosen for you" },
  important: { he: "עדכון חשוב", ar: "تحديث مهم", en: "Important update" },
} as const;

const CTA = {
  app: { he: "פתיחה באפליקציה", ar: "فتح التطبيق", en: "Open in app" },
  schedule: { he: "צפייה בלוח השיעורים", ar: "عرض جدول الحصص", en: "View schedule" },
  class: { he: "צפייה בפרטי השיעור", ar: "عرض تفاصيل الحصة", en: "View class" },
  booking: { he: "צפייה בהזמנה", ar: "عرض الحجز", en: "View booking" },
  claim: { he: "שמירת המקום", ar: "احجزي مكانك", en: "Claim your spot" },
  payment: { he: "בדיקת פרטי התשלום", ar: "مراجعة تفاصيل الدفع", en: "Review payment details" },
  membership: { he: "צפייה בפרטי המנוי", ar: "عرض تفاصيل الاشتراك", en: "View membership" },
  receipt: { he: "צפייה בקבלה", ar: "عرض الإيصال", en: "View receipt" },
} as const;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function eventGroup(eventType: MessageEventType): keyof typeof KICKERS {
  if (eventType === "member_welcome") return "welcome";
  if (eventType === "urgent_studio_announcement") return "important";
  if (["class_recommendation", "retention_reminder", "trial_followup"].includes(eventType)) {
    return "chosen";
  }
  if (["human_handoff", "staff_reply", "human_handoff_resolved"].includes(eventType)) {
    return "concierge";
  }
  if (eventType.startsWith("booking_")) return "booking";
  if (eventType.startsWith("class_")) return "class";
  if (eventType.startsWith("waitlist_")) return "waitlist";
  if (
    eventType.startsWith("payment_") ||
    eventType === "receipt_issued" ||
    eventType === "subscription_renewal_failed"
  ) {
    return "payment";
  }
  return "membership";
}

function ctaGroup(eventType: MessageEventType, actionUrl: URL | null): keyof typeof CTA {
  if (eventType === "receipt_issued") return "receipt";
  if (eventType === "waitlist_spot_available") return "claim";
  if (
    [
      "payment_request_received",
      "payment_pending_reminder",
      "payment_failed",
      "subscription_renewal_failed",
    ].includes(eventType)
  ) {
    return "payment";
  }
  if (
    eventType.startsWith("payment_") ||
    eventType.startsWith("membership_") ||
    eventType.startsWith("subscription_") ||
    eventType.startsWith("credits_")
  ) {
    return "membership";
  }
  if (actionUrl?.pathname.includes("/bookings")) return "booking";
  if (actionUrl?.pathname.includes("/schedule")) {
    return eventType.includes("cancelled") || eventType === "member_welcome" ? "schedule" : "class";
  }
  return "app";
}

function safeActionUrl(actionUrl: string | null | undefined, publicBaseUrl: string) {
  let base: URL;
  try {
    base = new URL(publicBaseUrl);
  } catch {
    throw new Error("invalid_messaging_public_base_url");
  }
  if (base.protocol !== "https:") throw new Error("messaging_public_base_url_must_use_https");
  if (!actionUrl?.trim()) return null;
  try {
    const resolved = new URL(actionUrl, base);
    return resolved.protocol === "https:" && resolved.origin === base.origin ? resolved : null;
  } catch {
    return null;
  }
}

function bodyHtml(body: string) {
  return body
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="Margin:0 0 18px 0;color:#26364D;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:17px;line-height:29px;">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
}

function factRows(variables: Record<string, unknown>, language: MessageLanguage, align: string) {
  const present = FACTS.flatMap((definition) => {
    const value = variables[definition.key];
    if (value == null || String(value).trim() === "") return [];
    return [{ definition, value: String(value) }];
  });
  if (!present.length) return "";
  const rows = present
    .map(
      ({ definition, value }, index) => `<tr>
        <td style="padding:${index === 0 ? "0" : "13px"} 0 0;color:#6F7A8C;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:13px;line-height:20px;vertical-align:top;text-align:${align};">${escapeHtml(definition.labels[language])}</td>
        <td style="padding:${index === 0 ? "0" : "13px"} 18px 0 0;color:#0B1D3A;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:22px;vertical-align:top;text-align:${align};"${definition.ltr ? ' dir="ltr"' : ""}>${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="Margin:8px 0 28px;background:#FAF7F2;border:1px solid #E8DFD1;border-radius:12px;">
    <tr><td style="padding:20px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
  </table>`;
}

function presentationFactRows(
  facts: NonNullable<TransactionalEmailInput["presentation"]>["facts"],
  align: string,
) {
  if (!facts.length) return "";
  const rows = facts
    .map(
      (fact, index) => `<tr>
        <td style="padding:${index === 0 ? "0" : "13px"} 0 0;color:#6F7A8C;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:13px;line-height:20px;vertical-align:top;text-align:${align};">${escapeHtml(fact.label)}</td>
        <td style="padding:${index === 0 ? "0" : "13px"} 18px 0 0;color:#0B1D3A;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:22px;vertical-align:top;text-align:${align};"${fact.ltr ? ' dir="ltr"' : ""}>${escapeHtml(fact.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="Margin:8px 0 28px;background:#FAF7F2;border:1px solid #E8DFD1;border-radius:12px;">
    <tr><td style="padding:20px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
  </table>`;
}

function messageRef(messageKey: string) {
  const safe = messageKey
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `cc-${safe || "message"}`.slice(0, 120);
}

export function renderTransactionalEmail(
  input: TransactionalEmailInput,
): RenderedTransactionalEmail {
  const rtl = input.language !== "en";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const actionUrl = input.presentation
    ? safeActionUrl(input.presentation.action?.url, input.publicBaseUrl)
    : safeActionUrl(input.actionUrl, input.publicBaseUrl);
  const kicker =
    input.presentation?.categoryLabel ?? KICKERS[eventGroup(input.eventType)][input.language];
  const cta = input.presentation
    ? (input.presentation.action?.label ?? "")
    : CTA[ctaGroup(input.eventType, actionUrl)][input.language];
  const copy: LocalizedCopy = { ...SUPPORT_COPY[input.language], kicker, cta };
  const escapedUrl = actionUrl ? escapeHtml(actionUrl.toString()) : "";
  const facts = input.presentation
    ? presentationFactRows(input.presentation.facts, align)
    : factRows(input.variables, input.language, align);
  const preheader = `${input.subject} — ${input.body.replace(/\s+/g, " ").trim()}`.slice(0, 150);
  const supportEmail = input.replyTo?.trim() || null;
  const support = supportEmail
    ? `<a href="mailto:${escapeHtml(supportEmail)}" style="color:#0B1D3A;text-decoration:underline;">${escapeHtml(copy.support)}</a>`
    : escapeHtml(copy.support);
  const action = actionUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="Margin:6px auto 28px;"><tr><td align="center" bgcolor="#0B1D3A" style="border-radius:10px;"><a href="${escapedUrl}" style="display:inline-block;padding:15px 28px;color:#FFFFFF;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:20px;text-decoration:none;border-radius:10px;">${escapeHtml(copy.cta)}</a></td></tr></table>
      <p style="Margin:0 0 26px;color:#6F7A8C;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:12px;line-height:19px;text-align:${align};">${escapeHtml(copy.openInBrowser)}<br><a href="${escapedUrl}" dir="ltr" style="color:#53627A;text-decoration:underline;word-break:break-all;">${escapedUrl}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="${input.language}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(input.subject)}</title>
  <style>@media only screen and (max-width:620px){.cc-card{width:100%!important}.cc-pad{padding:30px 22px!important}.cc-title{font-size:27px!important;line-height:37px!important}}</style>
</head>
<body style="Margin:0;padding:0;background:#F4EFE7;word-spacing:normal;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4EFE7" style="width:100%;background:#F4EFE7;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" class="cc-card" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #E8DFD1;border-radius:16px;overflow:hidden;">
        <tr><td height="4" bgcolor="#D4AF6A" style="height:4px;background:#D4AF6A;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td class="cc-pad" style="padding:34px 42px 40px;text-align:${align};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:0 0 22px;text-align:center;">
              <div dir="ltr" style="color:#0B1D3A;font-family:Georgia,'Times New Roman',serif;font-size:29px;font-weight:600;line-height:34px;">Cloud &amp; Core</div>
              <div dir="ltr" style="padding-top:7px;color:#7D6841;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:2px;line-height:15px;">AERIAL · STRENGTH · BALANCE</div>
            </td></tr>
            <tr><td height="1" bgcolor="#E8DFD1" style="height:1px;background:#E8DFD1;font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>
          <p style="Margin:27px 0 9px;color:#7D6841;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:.5px;line-height:18px;text-transform:uppercase;text-align:${align};">${escapeHtml(copy.kicker)}</p>
          <h1 class="cc-title" style="Margin:0 0 22px;color:#0B1D3A;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:32px;font-weight:700;line-height:43px;text-align:${align};">${escapeHtml(input.subject)}</h1>
          ${bodyHtml(input.body)}
          ${facts}
          ${action}
          <p style="Margin:0 0 24px;color:#53627A;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:14px;line-height:23px;text-align:${align};">${support}</p>
          <p style="Margin:0;white-space:pre-line;color:#0B1D3A;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:15px;line-height:24px;text-align:${align};">${escapeHtml(copy.closing)}</p>
        </td></tr>
        <tr><td bgcolor="#FAF7F2" style="padding:20px 26px;background:#FAF7F2;border-top:1px solid #E8DFD1;text-align:center;">
          <p style="Margin:0 0 5px;color:#0B1D3A;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:18px;">Cloud &amp; Core Studio</p>
          <p style="Margin:0;color:#6F7A8C;font-family:Arial,Tahoma,Helvetica,sans-serif;font-size:11px;line-height:18px;">${escapeHtml(copy.reason)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textParts = [
    "Cloud & Core — Aerial · Strength · Balance",
    copy.kicker,
    input.subject,
    input.body.trim(),
    actionUrl ? `${copy.cta}: ${actionUrl.toString()}` : null,
    copy.support,
    copy.closing,
    copy.reason,
  ].filter((value): value is string => Boolean(value));

  return {
    subject: input.subject,
    html,
    text: textParts.join("\n\n"),
    headers: { "X-Entity-Ref-ID": messageRef(input.messageKey) },
  };
}

export function validateTransactionalEmailPresentationCatalog(eventTypes: readonly string[]) {
  const errors: string[] = [];
  for (const eventType of eventTypes) {
    for (const language of ["he", "ar", "en"] as const) {
      const typedEvent = eventType as MessageEventType;
      const kicker = KICKERS[eventGroup(typedEvent)]?.[language];
      const cta = CTA[ctaGroup(typedEvent, null)]?.[language];
      if (!kicker?.trim()) errors.push(`missing_email_kicker:${eventType}:${language}`);
      if (!cta?.trim()) errors.push(`missing_email_cta:${eventType}:${language}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

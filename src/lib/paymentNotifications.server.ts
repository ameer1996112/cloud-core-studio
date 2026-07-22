import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";

export type ConfirmPaymentResult = {
  status: string;
  payment_id: string;
  receipt_id: string;
  receipt_number: string;
  member_plan_id?: string | null;
};

type PaymentWithRelations = {
  id: string;
  amount: number;
  currency: string | null;
  member: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    preferred_language?: string | null;
  } | null;
  plan: { name: string | null } | null;
};

type ReceiptRecord = {
  id: string;
  receipt_number: string | null;
  plan_name_snapshot: string | null;
} | null;

type StudioSettings = {
  studio_name?: string | null;
  contact_email?: string | null;
  default_language?: string | null;
  public_phone?: string | null;
  whatsapp_number?: string | null;
} | null;

type PaymentNotificationData = {
  payment: PaymentWithRelations;
  receipt: ReceiptRecord;
  settings: StudioSettings;
  result: ConfirmPaymentResult;
};

function text(value: unknown, fallback = "-") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function escapeHtml(value: unknown) {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAmount(amount: number, currency: string | null) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: currency || "ILS",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function businessEmailRecipient(settings: StudioSettings) {
  return (
    process.env.PAYMENT_NOTIFICATION_EMAIL?.trim() ||
    settings?.contact_email?.trim() ||
    "cloudandcorestudio@gmail.com"
  );
}

function emailFrom() {
  return process.env.PAYMENT_NOTIFICATION_FROM?.trim() || process.env.EMAIL_FROM?.trim() || "";
}

async function insertNotificationDraftRows(rows: ReturnType<typeof buildNotificationDraftRows>) {
  if (!rows.length) return;
  const { error } = await supabaseAdmin
    .from("notification_logs")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) console.error("hyp_payment_notification_insert_failed", error.message);
}

async function claimBusinessEmail(data: PaymentNotificationData, recipient: string) {
  const idempotencyKey = `payment_confirmed:business_email:${data.payment.id}`;
  const now = new Date().toISOString();
  const payload = {
    event_key: "payment_confirmed",
    audience: "admin",
    recipient_email: recipient,
    payment_id: data.payment.id,
    receipt_id: data.receipt?.id ?? null,
  };

  const { data: existing, error: findError } = await supabaseAdmin
    .from("notification_logs")
    .select("id,status,created_at")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.status === "sent") return null;
  if (existing?.status === "sending") {
    const ageMs = Date.now() - new Date(existing.created_at).getTime();
    if (Number.isFinite(ageMs) && ageMs < 10 * 60 * 1000) return null;
  }

  const packageName =
    data.payment.plan?.name ?? data.receipt?.plan_name_snapshot ?? "תשלום לסטודיו";
  const amount = formatAmount(data.payment.amount, data.payment.currency);
  const subject = `התקבל תשלום חדש · ${packageName}`;
  const body = [
    `התקבל תשלום חדש ב-${data.settings?.studio_name ?? "Cloud & Core"}.`,
    "",
    `לקוחה: ${text(data.payment.member?.name)}`,
    `חבילה: ${packageName}`,
    `סכום: ${amount}`,
    `אמצעי תשלום: כרטיס אשראי`,
    `מספר קבלה: ${text(data.receipt?.receipt_number, data.result.receipt_number)}`,
    `מזהה תשלום: ${data.payment.id}`,
  ].join("\n");

  const row = {
    template_key: "payment_confirmed.business.email",
    channel: "email",
    recipient_member_id: data.payment.member?.id ?? null,
    payload,
    status: "sending",
    trigger_type: "payment_confirmed",
    related_payment_id: data.payment.id,
    related_receipt_id: data.receipt?.id ?? null,
    related_member_plan_id: data.result.member_plan_id ?? null,
    generated_text: body,
    subject,
    language: "he",
    provider: null,
    provider_message_id: null,
    sent_at: null,
    marked_sent_at: null,
    error_message: null,
    idempotency_key: idempotencyKey,
    staff_visibility: "admin_only",
  } as const;

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("notification_logs")
      .update({ ...row, created_at: now } as any)
      .eq("id", existing.id)
      .neq("status", "sent");
    if (error) throw error;
    return { id: existing.id, idempotencyKey, subject, body, packageName, amount };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("notification_logs")
    .insert(row as any)
    .select("id")
    .maybeSingle();
  if (!insertError) {
    return { id: inserted?.id ?? null, idempotencyKey, subject, body, packageName, amount };
  }

  if (String((insertError as any).code) !== "23505") throw insertError;
  return null;
}

async function sendBusinessPaymentEmail(data: PaymentNotificationData) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = emailFrom();
  const recipient = businessEmailRecipient(data.settings);
  if (!apiKey || !from) {
    console.warn("hyp_business_payment_email_not_configured", {
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
      recipient,
    });
    return;
  }

  const claim = await claimBusinessEmail(data, recipient);
  if (!claim) return;

  const paymentId = escapeHtml(data.payment.id);
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#102443;max-width:560px">
      <h2 style="margin:0 0 18px">התקבל תשלום חדש</h2>
      <p style="margin:0 0 18px">בוצע תשלום חדש ב-${escapeHtml(data.settings?.studio_name ?? "Cloud & Core")}.</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#6b7890">לקוחה</td><td style="padding:8px 0;font-weight:700">${escapeHtml(data.payment.member?.name)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7890">חבילה</td><td style="padding:8px 0;font-weight:700">${escapeHtml(claim.packageName)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7890">סכום</td><td style="padding:8px 0;font-weight:700">${escapeHtml(claim.amount)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7890">אמצעי תשלום</td><td style="padding:8px 0">כרטיס אשראי</td></tr>
        <tr><td style="padding:8px 0;color:#6b7890">מספר קבלה</td><td style="padding:8px 0">${escapeHtml(data.receipt?.receipt_number ?? data.result.receipt_number)}</td></tr>
      </table>
      <p style="margin:18px 0 0;color:#6b7890;font-size:12px">מזהה תשלום: ${paymentId}</p>
    </div>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: claim.subject,
        text: claim.body,
        html,
      }),
    });
    const responseBody = await response.text();
    if (!response.ok)
      throw new Error(`resend_http_${response.status}:${responseBody.slice(0, 240)}`);

    let providerMessageId: string | null = null;
    try {
      providerMessageId = JSON.parse(responseBody).id ?? null;
    } catch {
      providerMessageId = null;
    }
    await supabaseAdmin
      .from("notification_logs")
      .update({
        status: "sent",
        provider: "manual",
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
        marked_sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("idempotency_key", claim.idempotencyKey);
  } catch (error) {
    await supabaseAdmin
      .from("notification_logs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("idempotency_key", claim.idempotencyKey);
    throw error;
  }
}

export async function enqueuePaymentConfirmedNotifications(result: ConfirmPaymentResult) {
  if (!result.payment_id || !result.receipt_id) return;

  try {
    const [paymentRes, receiptRes, settingsRes] = await Promise.all([
      supabaseAdmin
        .from("payments")
        .select(
          "id,amount,currency,member:members(id,name,phone,email,preferred_language),plan:plans(name)",
        )
        .eq("id", result.payment_id)
        .maybeSingle(),
      supabaseAdmin
        .from("receipts")
        .select("id,receipt_number,plan_name_snapshot")
        .eq("id", result.receipt_id)
        .maybeSingle(),
      supabaseAdmin.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    if (paymentRes.error) throw paymentRes.error;
    if (receiptRes.error) throw receiptRes.error;
    if (settingsRes.error) throw settingsRes.error;

    const payment = paymentRes.data as PaymentWithRelations | null;
    const receipt = receiptRes.data as ReceiptRecord;
    const settings = settingsRes.data as StudioSettings;
    if (!payment?.member) return;

    const packageName = payment.plan?.name ?? receipt?.plan_name_snapshot ?? "Studio payment";
    const paymentRows = buildNotificationDraftRows({
      eventKey: "payment_confirmed",
      channels: ["whatsapp", "email"],
      audience: "member",
      member: payment.member,
      appLanguage: null,
      studioSettings: settings,
      relatedIds: {
        paymentId: result.payment_id,
        receiptId: result.receipt_id,
        memberPlanId: result.member_plan_id ?? null,
      },
      variables: {
        package_name: packageName,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
    const receiptRows = receipt
      ? buildNotificationDraftRows({
          eventKey: "receipt_issued",
          channels: ["whatsapp", "email"],
          audience: "member",
          member: payment.member,
          appLanguage: null,
          studioSettings: settings,
          relatedIds: {
            paymentId: result.payment_id,
            receiptId: result.receipt_id,
            memberPlanId: result.member_plan_id ?? null,
          },
          variables: {
            package_name: packageName,
            receipt_number: receipt.receipt_number ?? result.receipt_number,
          },
        })
      : [];

    await insertNotificationDraftRows([...paymentRows, ...receiptRows]);
    await sendBusinessPaymentEmail({ payment, receipt, settings, result });
  } catch (error) {
    console.error("hyp_return_notification_prepare_failed", error);
  }
}

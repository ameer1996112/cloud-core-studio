import {
  buildNotificationIdempotencyKey,
  findNotificationTemplate,
  notificationStaffVisibility,
  renderNotificationCopy,
  resolveNotificationLanguage,
  type NotificationAudience,
  type NotificationChannel,
  type NotificationEventKey,
  type NotificationVariables,
} from "@/lib/notificationTemplates";

type DraftMember = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  preferred_language?: string | null;
};

type DraftStudioSettings = {
  default_language?: string | null;
  studio_name?: string | null;
  public_phone?: string | null;
  whatsapp_number?: string | null;
  timezone?: string | null;
};

type RelatedIds = {
  bookingId?: string | null;
  classId?: string | null;
  memberPlanId?: string | null;
  packageRequestId?: string | null;
  paymentId?: string | null;
  receiptId?: string | null;
  waitlistEntryId?: string | null;
};

export type NotificationDraftInput = {
  eventKey: NotificationEventKey;
  channels: NotificationChannel[];
  audience?: NotificationAudience;
  member: DraftMember;
  appLanguage?: string | null;
  studioSettings: DraftStudioSettings | null;
  relatedIds: RelatedIds;
  variables: NotificationVariables;
};

export type NotificationLogInsertRow = {
  template_key: string;
  channel: NotificationChannel;
  recipient_member_id: string;
  payload: NotificationDraftPayload;
  status: "draft" | "skipped";
  trigger_type: NotificationEventKey;
  related_class_id: string | null;
  related_booking_id: string | null;
  related_member_plan_id: string | null;
  related_package_request_id: string | null;
  related_payment_id: string | null;
  related_receipt_id: string | null;
  generated_text: string | null;
  subject: string | null;
  language: string;
  provider: string | null;
  provider_message_id: string | null;
  sent_at: string | null;
  error_message: string | null;
  idempotency_key: string;
  staff_visibility: "operational" | "admin_only";
};

type NotificationDraftPayload = {
  event_key: NotificationEventKey;
  audience: NotificationAudience;
  variables: NotificationVariables;
  related_ids: RelatedIds;
};

function skipReason(channel: NotificationChannel, member: DraftMember): string | null {
  if (channel === "whatsapp" && !member.phone) return "missing_whatsapp_phone";
  if (channel === "email" && !member.email) return "missing_email";
  return null;
}

export function buildNotificationDraftRows(
  input: NotificationDraftInput,
): NotificationLogInsertRow[] {
  const language = resolveNotificationLanguage({
    memberPreferredLanguage: input.member.preferred_language,
    appLanguage: input.appLanguage,
    studioDefaultLanguage: input.studioSettings?.default_language,
  });
  const audience = input.audience ?? "member";
  const variables: NotificationVariables = {
    studio_name: input.studioSettings?.studio_name ?? "Cloud & Core",
    studio_phone: input.studioSettings?.public_phone ?? "",
    studio_whatsapp: input.studioSettings?.whatsapp_number ?? "",
    member_name: input.member.name ?? "",
    ...input.variables,
  };

  return input.channels.map((channel) => {
    const template = findNotificationTemplate({
      eventKey: input.eventKey,
      channel,
      language,
      audience,
    });
    const rendered = renderNotificationCopy(template, variables);
    const reason = skipReason(channel, input.member);

    return {
      template_key: `${input.eventKey}.${channel}.${language}.${audience}`,
      channel,
      recipient_member_id: input.member.id,
      payload: {
        event_key: input.eventKey,
        audience,
        variables,
        related_ids: input.relatedIds,
      },
      status: reason ? "skipped" : "draft",
      trigger_type: input.eventKey,
      related_class_id: input.relatedIds.classId ?? null,
      related_booking_id: input.relatedIds.bookingId ?? null,
      related_member_plan_id: input.relatedIds.memberPlanId ?? null,
      related_package_request_id: input.relatedIds.packageRequestId ?? null,
      related_payment_id: input.relatedIds.paymentId ?? null,
      related_receipt_id: input.relatedIds.receiptId ?? null,
      generated_text: rendered.body,
      subject: rendered.subject,
      language,
      provider: null,
      provider_message_id: null,
      sent_at: null,
      error_message: reason,
      idempotency_key: buildNotificationIdempotencyKey({
        eventKey: input.eventKey,
        channel,
        audience,
        relatedIds: input.relatedIds,
      }),
      staff_visibility: notificationStaffVisibility(input.eventKey),
    };
  });
}

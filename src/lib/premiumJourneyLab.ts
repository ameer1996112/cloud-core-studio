import { renderMessageContent } from "@/lib/messageTemplateCatalog";
import type { MessageChannel, MessageEventType, MessageLanguage } from "@/lib/messaging.types";
import { NOTIFICATION_EVENT_CATALOG } from "@/lib/premiumNotificationCatalog";

const TEST_NAMES: Record<MessageLanguage, string> = {
  he: "נועה",
  ar: "نور",
  en: "Noa",
};

const TEST_CLASS_NAMES: Record<MessageLanguage, string> = {
  he: "פילאטיס מזרן",
  ar: "بيلاتس مات",
  en: "Mat Pilates",
};

const TEST_PACKAGE_NAMES: Record<MessageLanguage, string> = {
  he: "מינוי חודשי",
  ar: "اشتراك شهري",
  en: "Monthly membership",
};

export function premiumJourneyTestVariables(language: MessageLanguage) {
  const recommendationSummary =
    language === "he"
      ? "פילאטיס מזרן ב-24/07/2026 בשעה 18:00 או יוגה ב-26/07/2026 בשעה 19:00"
      : language === "ar"
        ? "بيلاتس مات بتاريخ 24/07/2026 الساعة 18:00 أو يوغا بتاريخ 26/07/2026 الساعة 19:00"
        : "Mat Pilates on 24/07/2026 at 18:00 or Yoga on 26/07/2026 at 19:00";
  return {
    member_name: TEST_NAMES[language],
    class_name: TEST_CLASS_NAMES[language],
    class_date: "24/07/2026",
    class_time: "18:00",
    recommendation_summary: recommendationSummary,
    instructor_name: language === "ar" ? "يارين" : language === "he" ? "ירין" : "Yareen",
    location_name:
      language === "ar" ? "الاستوديو الرئيسي" : language === "he" ? "הסטודיו הראשי" : "Main studio",
    spots_available: "3",
    offer_expires_at: "18:30",
    waitlist_position: "2",
    package_name: TEST_PACKAGE_NAMES[language],
    amount: "₪350",
    receipt_number: "CC-1001",
    receipt_url: "https://cloudandcorestudio.com/member/packages",
    credits_remaining: "2",
    expiry_date: "31/07/2026",
    renewal_date: "31/07/2026",
  } satisfies Record<string, string>;
}

export function buildPremiumJourneyPreviews(language: MessageLanguage) {
  const variables = premiumJourneyTestVariables(language);
  return (
    Object.entries(NOTIFICATION_EVENT_CATALOG) as Array<
      [MessageEventType, (typeof NOTIFICATION_EVENT_CATALOG)[MessageEventType]]
    >
  ).map(([eventType, definition]) => {
    const rendered = renderMessageContent(eventType, language, variables);
    return {
      eventType,
      family: definition.family,
      tier: definition.tier,
      channels: [...definition.channels],
      subject: rendered.subject,
      body: rendered.body,
      immediate: definition.immediate,
      preference: definition.preference,
      allowlistOnly: true as const,
    };
  });
}

export function buildPremiumJourneyTestOutbox(input: {
  eventType: MessageEventType;
  channel: MessageChannel;
  memberId: string;
  language: MessageLanguage;
  runId: string;
  now: Date;
}) {
  const definition = NOTIFICATION_EVENT_CATALOG[input.eventType];
  if (!(definition.channels as readonly MessageChannel[]).includes(input.channel)) {
    throw new Error("event_channel_not_supported");
  }
  const availableAt = input.now.toISOString();
  return {
    event_type: input.eventType,
    aggregate_type: "notification_staff_test",
    aggregate_id: null,
    member_id: input.memberId,
    payload: {
      staff_test: true,
      staff_test_force_now: true,
      test_channels: [input.channel],
      test_variables: premiumJourneyTestVariables(input.language),
    },
    deduplication_key: `staff-test:${input.runId}:${input.eventType}:${input.channel}`,
    available_at: availableAt,
    expires_at: new Date(input.now.getTime() + 24 * 60 * 60_000).toISOString(),
  };
}

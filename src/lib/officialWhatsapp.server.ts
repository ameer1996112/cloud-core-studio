import type { Database } from "@/integrations/supabase/types";

type NotificationLogRow = Database["public"]["Tables"]["notification_logs"]["Row"];
type NotificationPayload = {
  variables?: Record<string, unknown>;
};

export const OFFICIAL_WHATSAPP_PROVIDER = "official_whatsapp";
export const OFFICIAL_WHATSAPP_CHANNEL = "whatsapp";

export const OFFICIAL_WHATSAPP_TEMPLATE_EVENT_TYPES = [
  "payment_confirmed",
  "booking_confirmed",
  "class_reminder_24h",
  "waitlist_spot_available",
  "class_cancelled_by_admin",
  "class_time_changed",
  "payment_pending_reminder",
  "payment_failed",
] as const;

export type OfficialWhatsappTemplateEventType =
  (typeof OFFICIAL_WHATSAPP_TEMPLATE_EVENT_TYPES)[number];

export type OfficialWhatsappTemplatePayload = {
  name: string;
  languageCode: "he" | "ar" | "en_US";
  bodyParameters: string[];
};

export type OfficialWhatsappSendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; retryable: boolean; error: string; providerMessageId?: string | null };

type OfficialWhatsappRuntimeConfig = {
  graphApiVersion: string;
  phoneNumberId: string;
  accessToken: string;
};

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function payloadVariables(row: Pick<NotificationLogRow, "payload">) {
  const payload = isRecord(row.payload) ? (row.payload as NotificationPayload) : {};
  return isRecord(payload.variables) ? payload.variables : {};
}

function textValue(value: unknown, fallback = "-") {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function templateLanguage(language: string | null | undefined) {
  if (language === "ar") return { suffix: "ar", code: "ar" as const };
  if (language === "en") return { suffix: "en", code: "en_US" as const };
  return { suffix: "he", code: "he" as const };
}

function configuredTemplateName(eventType: OfficialWhatsappTemplateEventType, language: string) {
  const languageKey = `WHATSAPP_TEMPLATE_${eventType.toUpperCase()}_${language.toUpperCase()}`;
  const fallbackKey = `WHATSAPP_TEMPLATE_${eventType.toUpperCase()}`;
  return (
    process.env[languageKey]?.trim() ||
    process.env[fallbackKey]?.trim() ||
    `${eventType}_${language}`
  );
}

export function isOfficialWhatsappTemplateEventType(
  value: string | null | undefined,
): value is OfficialWhatsappTemplateEventType {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return OFFICIAL_WHATSAPP_TEMPLATE_EVENT_TYPES.some((eventType) => eventType === normalized);
}

export function buildOfficialWhatsappTemplatePayload(
  row: Pick<NotificationLogRow, "payload" | "trigger_type" | "language">,
): OfficialWhatsappTemplatePayload | null {
  if (!isOfficialWhatsappTemplateEventType(row.trigger_type)) return null;

  const variables = payloadVariables(row);
  const memberName = textValue(variables.member_name, "חברה");
  const className = textValue(variables.class_name, "השיעור שלך");
  const classDate = textValue(variables.class_date);
  const classTime = textValue(variables.class_time);
  const instructorName = textValue(variables.instructor_name, "צוות הסטודיו");
  const packageName = textValue(variables.package_name, "החבילה שלך");
  const creditsAvailable = textValue(
    variables.credits_available ?? variables.credits_remaining ?? variables.credits,
    "עודכן",
  );
  const language = templateLanguage(row.language);
  const name = configuredTemplateName(row.trigger_type, language.suffix);

  switch (row.trigger_type) {
    case "booking_confirmed":
      return {
        name,
        languageCode: language.code,
        bodyParameters: [memberName, className, classDate, classTime, instructorName],
      };
    case "class_cancelled_by_admin":
      return {
        name,
        languageCode: language.code,
        bodyParameters: [memberName, className, classDate, classTime],
      };
    case "class_reminder_24h":
      return {
        name,
        languageCode: language.code,
        bodyParameters: [className, classTime],
      };
    case "class_time_changed":
      return {
        name,
        languageCode: language.code,
        bodyParameters: [memberName, className, classDate, classTime],
      };
    case "payment_confirmed":
      return {
        name,
        languageCode: language.code,
        bodyParameters: [memberName, packageName, creditsAvailable],
      };
    case "payment_pending_reminder":
    case "payment_failed":
      return {
        name,
        languageCode: language.code,
        bodyParameters: [memberName],
      };
    case "waitlist_spot_available":
      return {
        name,
        languageCode: language.code,
        bodyParameters: [memberName, className, classDate, classTime],
      };
    default:
      return null;
  }
}

export function normalizeOfficialWhatsappRecipient(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `972${digits.slice(1)}`;
  if (digits.length >= 10) return digits;
  return null;
}

function getOfficialWhatsappRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): OfficialWhatsappRuntimeConfig {
  const graphApiVersion = env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  const phoneNumberId = env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = env.META_ACCESS_TOKEN?.trim();

  const missing = [
    ...(!phoneNumberId ? ["META_WHATSAPP_PHONE_NUMBER_ID"] : []),
    ...(!accessToken ? ["META_ACCESS_TOKEN"] : []),
  ];
  if (missing.length) {
    throw new Error(`missing_official_whatsapp_runtime_config:${missing.join(",")}`);
  }

  return { graphApiVersion, phoneNumberId, accessToken };
}

function formatMetaError(response: Response, json: unknown) {
  const error = isRecord(json) && isRecord(json.error) ? json.error : null;
  if (!error) return `official_whatsapp_http_${response.status}`;

  return [
    textValue(error.message, `official_whatsapp_http_${response.status}`),
    error.code ? `code=${String(error.code)}` : "",
    error.error_subcode ? `subcode=${String(error.error_subcode)}` : "",
    error.error_user_title ? `title=${String(error.error_user_title)}` : "",
    error.fbtrace_id ? `fbtrace_id=${String(error.fbtrace_id)}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export async function sendOfficialWhatsappTemplateMessage(input: {
  to: string;
  template: OfficialWhatsappTemplatePayload;
  fetchImpl?: FetchLike;
  env?: NodeJS.ProcessEnv;
}): Promise<OfficialWhatsappSendResult> {
  const to = normalizeOfficialWhatsappRecipient(input.to);
  if (!to) return { ok: false, retryable: false, error: "invalid_whatsapp_phone" };

  let config: OfficialWhatsappRuntimeConfig;
  try {
    config = getOfficialWhatsappRuntimeConfig(input.env);
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      error: error instanceof Error ? error.message : "missing_official_whatsapp_runtime_config",
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: input.template.name,
      language: { code: input.template.languageCode },
      components: [
        {
          type: "body",
          parameters: input.template.bodyParameters.map((text) => ({
            type: "text",
            text,
          })),
        },
      ],
    },
  };

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        retryable: isRetryableStatus(response.status),
        error: formatMetaError(response, json),
      };
    }

    const firstMessage =
      isRecord(json) && Array.isArray(json.messages) && isRecord(json.messages[0])
        ? json.messages[0]
        : null;
    return {
      ok: true,
      providerMessageId: textValue(firstMessage?.id, "") || null,
    };
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      error: error instanceof Error ? error.message : "official_whatsapp_network_error",
    };
  }
}

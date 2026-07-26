import type { DeliveryFailureClass } from "@/lib/messaging.types";
import { classifyProviderFailure } from "@/lib/messagingPolicy";

type FetchLike = typeof fetch;

export type WhatsappTemplateComponent =
  | { type: "header"; parameters: [{ type: "image"; image: { link: string } }] }
  | { type: "body"; parameters: Array<{ type: "text"; text: string }> };

export type WhatsappTemplateSendInput = {
  to: string;
  templateName: string;
  languageCode: "he" | "ar" | "en_US";
  components: WhatsappTemplateComponent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function parseWhatsappTemplateComponents(
  value: unknown,
): WhatsappTemplateComponent[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const components: WhatsappTemplateComponent[] = [];
  for (const component of value) {
    if (!isRecord(component) || !Array.isArray(component.parameters)) return null;

    if (component.type === "header") {
      if (component.parameters.length !== 1) return null;
      const parameter = component.parameters[0];
      if (!isRecord(parameter) || parameter.type !== "image" || !isRecord(parameter.image)) {
        return null;
      }
      const link = parameter.image.link;
      if (typeof link !== "string" || !link.trim()) return null;
      components.push({
        type: "header",
        parameters: [{ type: "image", image: { link } }],
      });
      continue;
    }

    if (component.type === "body") {
      const parameters: Array<{ type: "text"; text: string }> = [];
      for (const parameter of component.parameters) {
        if (
          !isRecord(parameter) ||
          parameter.type !== "text" ||
          typeof parameter.text !== "string"
        ) {
          return null;
        }
        parameters.push({ type: "text", text: parameter.text });
      }
      components.push({ type: "body", parameters });
      continue;
    }

    return null;
  }

  const sequence = components.map((component) => component.type).join(",");
  if (sequence !== "body" && sequence !== "header,body") return null;

  return components;
}

export type ProviderSendResult =
  | { ok: true; providerMessageId: string | null; status: "accepted" | "sent" }
  | {
      ok: false;
      failureClass: DeliveryFailureClass;
      error: string;
      httpStatus?: number;
      retryAfterSeconds?: number | null;
    };

function required(env: Record<string, string | undefined>, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`missing_messaging_provider_config:${name}`);
  return value;
}

function errorMessage(value: unknown, fallback: string) {
  return value instanceof Error && value.message ? value.message : fallback;
}

function retryAfter(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.trunc(seconds));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1_000)) : null;
}

export async function sendWhatsappTemplate(
  input: WhatsappTemplateSendInput,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<ProviderSendResult> {
  const components = parseWhatsappTemplateComponents(input.components);
  if (!components) {
    return {
      ok: false,
      failureClass: "configuration",
      error: "whatsapp_template_components_missing_or_invalid",
    };
  }

  let graphVersion: string;
  let phoneNumberId: string;
  let token: string;
  try {
    graphVersion = required(env, "META_GRAPH_API_VERSION");
    phoneNumberId = required(env, "META_WHATSAPP_PHONE_NUMBER_ID");
    token = required(env, "META_ACCESS_TOKEN");
  } catch (error) {
    return { ok: false, failureClass: "configuration", error: errorMessage(error, "config") };
  }

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.languageCode },
      components,
    },
  };

  try {
    const response = await fetchImpl(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: string | number };
    };
    if (!response.ok) {
      return {
        ok: false,
        failureClass: classifyProviderFailure("whatsapp", { status: response.status }),
        error: payload.error?.message ?? `whatsapp_http_${response.status}`,
        httpStatus: response.status,
        retryAfterSeconds: retryAfter(response),
      };
    }
    const providerMessageId = payload.messages?.[0]?.id?.trim();
    if (!providerMessageId) {
      return {
        ok: false,
        failureClass: "ambiguous",
        error: "whatsapp_response_missing_message_id",
      };
    }
    return { ok: true, providerMessageId, status: "accepted" };
  } catch (error) {
    return {
      ok: false,
      // Once fetch has been invoked, a transport rejection cannot prove that Meta did not
      // receive the request. WhatsApp has no client idempotency key, so fail safe.
      failureClass: "ambiguous",
      error: errorMessage(error, "whatsapp_network_error"),
    };
  }
}

export async function sendWhatsappFreeform(
  input: { to: string; text: string },
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<ProviderSendResult> {
  let graphVersion: string;
  let phoneNumberId: string;
  let token: string;
  try {
    graphVersion = required(env, "META_GRAPH_API_VERSION");
    phoneNumberId = required(env, "META_WHATSAPP_PHONE_NUMBER_ID");
    token = required(env, "META_ACCESS_TOKEN");
  } catch (error) {
    return { ok: false, failureClass: "configuration", error: errorMessage(error, "config") };
  }
  try {
    const response = await fetchImpl(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: input.to,
          type: "text",
          text: { preview_url: false, body: input.text },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      return {
        ok: false,
        failureClass: classifyProviderFailure("whatsapp", { status: response.status }),
        error: payload.error?.message ?? `whatsapp_http_${response.status}`,
        httpStatus: response.status,
        retryAfterSeconds: retryAfter(response),
      };
    }
    const providerMessageId = payload.messages?.[0]?.id?.trim();
    if (!providerMessageId) {
      return {
        ok: false,
        failureClass: "ambiguous",
        error: "whatsapp_response_missing_message_id",
      };
    }
    return { ok: true, providerMessageId, status: "accepted" };
  } catch (error) {
    return {
      ok: false,
      failureClass: "ambiguous",
      error: errorMessage(error, "whatsapp_network_error"),
    };
  }
}

export async function sendResendEmail(
  input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    headers?: Record<string, string>;
    idempotencyKey: string;
  },
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<ProviderSendResult> {
  let apiKey: string;
  let from: string;
  try {
    apiKey = required(env, "RESEND_API_KEY");
    from = required(env, "MESSAGING_EMAIL_FROM");
  } catch (error) {
    return { ok: false, failureClass: "configuration", error: errorMessage(error, "config") };
  }
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.headers ? { headers: input.headers } : {}),
        ...(env.MESSAGING_EMAIL_REPLY_TO?.trim()
          ? { reply_to: env.MESSAGING_EMAIL_REPLY_TO.trim() }
          : {}),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!response.ok) {
      return {
        ok: false,
        failureClass: classifyProviderFailure("email", { status: response.status }),
        error: payload.message ?? payload.name ?? `resend_http_${response.status}`,
        httpStatus: response.status,
        retryAfterSeconds: retryAfter(response),
      };
    }
    return { ok: true, providerMessageId: payload.id ?? null, status: "accepted" };
  } catch (error) {
    return {
      ok: false,
      failureClass: "transient",
      error: errorMessage(error, "resend_network_error"),
    };
  }
}

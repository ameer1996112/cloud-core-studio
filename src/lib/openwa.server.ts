import { normalizePhoneForWa } from "@/lib/messageTemplate";

type OpenwaSendInput = { to: string | null | undefined; text: string };

type OpenwaSendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; retryable: boolean; error: string };

export function createOpenwaClient(input: {
  baseUrl: string;
  apiKey: string;
  sessionId: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    async sendText(message: OpenwaSendInput): Promise<OpenwaSendResult> {
      const phone = normalizePhoneForWa(message.to);
      if (!phone) {
        return { ok: false, retryable: false, error: "invalid_whatsapp_phone" };
      }

      const chatId = `${phone}@c.us`;

      const response = await fetchImpl(
        `${input.baseUrl.replace(/\/$/, "")}/api/sessions/${input.sessionId}/messages/send-text`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": input.apiKey,
          },
          body: JSON.stringify({
            chatId,
            text: message.text,
          }),
        },
      ).catch((error: Error) => ({
        ok: false,
        retryable: true,
        error: error.message || "openwa_network_error",
      }));

      if (!(response instanceof Response)) return response as OpenwaSendResult;

      if (!response.ok) {
        const text = await response.text();
        return {
          ok: false,
          retryable: response.status >= 500 || response.status === 429 || response.status === 408,
          error: text || `openwa_http_${response.status}`,
        };
      }

      const body = await response.json().catch(() => ({}));
      return {
        ok: true,
        providerMessageId:
          typeof body?.id === "string"
            ? body.id
            : typeof body?.messageId === "string"
              ? body.messageId
              : null,
      };
    },
  };
}

export function isReachableOpenwaBaseUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    if (
      url.hostname === "localhost" ||
      url.hostname === "0.0.0.0" ||
      url.hostname === "[::1]" ||
      url.hostname === "::1"
    ) {
      return false;
    }

    return !url.hostname.startsWith("127.");
  } catch {
    return false;
  }
}

export function getOpenwaRuntimeConfig(env = process.env) {
  const baseUrl = env.OPENWA_BASE_URL;
  const apiKey = env.OPENWA_API_KEY;
  const sessionId = env.OPENWA_SESSION_ID;

  if (!baseUrl || !apiKey || !sessionId) {
    throw new Error("missing_openwa_runtime_config");
  }

  return { baseUrl, apiKey, sessionId };
}

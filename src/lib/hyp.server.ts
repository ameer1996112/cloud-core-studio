export type HypConfig = {
  payBaseUrl: string;
  user: string;
  password: string;
  terminalNumber: string;
  publicBaseUrl: string;
  mode: "live" | "test";
};

export type HypPaymentPageRequest = {
  paymentId: string;
  amountAgorot: number;
  language?: "HEB" | "ENG";
  description?: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export function getHypConfig(): HypConfig {
  const mode = readEnv("HYP_MODE").toLowerCase() === "test" ? "test" : "live";
  const payBaseUrl = readEnv("HYP_PAY_BASE_URL") || "https://pay.hyp.co.il/p/";
  const user =
    mode === "test"
      ? readEnv("HYP_TEST_API_USER") || readEnv("HYP_TEST_API_KEY")
      : readEnv("HYP_API_USER") || readEnv("HYP_API_KEY");
  const password =
    mode === "test"
      ? readEnv("HYP_TEST_API_PASSWORD") || readEnv("HYP_TEST_PASSP")
      : readEnv("HYP_API_PASSWORD") || readEnv("HYP_PASSP");
  const terminalNumber =
    mode === "test"
      ? readEnv("HYP_TEST_TERMINAL_NUMBER") || readEnv("HYP_TEST_MASOF_NUMBER")
      : readEnv("HYP_TERMINAL_NUMBER") || readEnv("HYP_MASOF_NUMBER");
  const publicBaseUrl =
    readEnv("HYP_PUBLIC_BASE_URL") ||
    readEnv("CLOUD_CORE_BASE_URL") ||
    "https://cloudandcorestudio.com";

  const prefix = mode === "test" ? "HYP_TEST" : "HYP";
  const missing = [
    !user && `${prefix}_API_USER or ${prefix}_API_KEY`,
    !password && `${prefix}_API_PASSWORD or ${prefix}_PASSP`,
    !terminalNumber && `${prefix}_TERMINAL_NUMBER`,
  ].filter(Boolean);

  if (missing.length) throw new Error(`hyp_not_configured:${missing.join(",")}`);
  if (mode === "test" && !terminalNumber.startsWith("00100")) {
    throw new Error("hyp_test_terminal_invalid:HYP_TEST_TERMINAL_NUMBER should start with 00100");
  }

  return {
    payBaseUrl,
    user,
    password,
    terminalNumber,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
    mode,
  };
}

function hypPayBaseUrl(config: HypConfig) {
  const url = new URL(config.payBaseUrl);
  url.search = "";
  return url;
}

function amountFromAgorot(amountAgorot: number) {
  return (amountAgorot / 100)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

export function parseHypPayResponse(body: string, config = getHypConfig()) {
  const trimmed = body.trim();
  const params = new URLSearchParams(trimmed);
  const action = params.get("action");
  const signature = params.get("signature");
  if (action !== "pay" || !signature) {
    throw new Error(`hyp_payment_page_failed:${trimmed.slice(0, 180) || "empty_response"}`);
  }
  const url = hypPayBaseUrl(config);
  url.search = trimmed;
  return {
    result: "000",
    message: "",
    status: action,
    statusText: "",
    paymentUrl: url.toString(),
    token: signature,
    cgUid: params.get("Order") || "",
    raw: body,
  };
}

export async function createHypPaymentPage(input: HypPaymentPageRequest, config = getHypConfig()) {
  const language = input.language ?? "HEB";
  const requestUrl = hypPayBaseUrl(config);
  requestUrl.search = new URLSearchParams({
    action: "APISign",
    What: "SIGN",
    Sign: "True",
    KEY: config.user,
    PassP: config.password,
    Masof: config.terminalNumber,
    Amount: amountFromAgorot(input.amountAgorot),
    Order: input.paymentId,
    Coin: "1",
    PageLang: language,
    Info: input.description ?? "Cloud & Core package",
  }).toString();

  const response = await fetch(requestUrl, {
    method: "GET",
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`hyp_http_${response.status}`);
  }

  return parseHypPayResponse(responseText, config);
}

function pickSearchParam(params: URLSearchParams, ...names: string[]) {
  for (const name of names) {
    const value = params.get(name);
    if (value !== null) return value;
  }
  return "";
}

export async function validateHypRedirect(params: URLSearchParams, config = getHypConfig()) {
  const orderId = pickSearchParam(params, "Order");
  const sign = pickSearchParam(params, "Sign");
  if (!orderId || !sign) return false;

  const verifyParams = new URLSearchParams({
    action: "APISign",
    What: "VERIFY",
    Masof: config.terminalNumber,
    KEY: config.user,
    PassP: config.password,
  });
  for (const [key, value] of params.entries()) {
    if (key === "status") continue;
    verifyParams.append(key, value);
  }

  const verifyUrl = hypPayBaseUrl(config);
  verifyUrl.search = verifyParams.toString();
  const response = await fetch(verifyUrl);
  const body = await response.text();
  if (!response.ok) return false;
  return new URLSearchParams(body.trim()).get("CCode") === "0";
}

export function hypRedirectMetadata(params: URLSearchParams) {
  const keep = [
    "status",
    "Id",
    "CCode",
    "Amount",
    "ACode",
    "Order",
    "Fild1",
    "Fild2",
    "Fild3",
    "Sign",
    "uniqueID",
    "uniqueId",
    "uniqueid",
    "txId",
    "cgUid",
    "authNumber",
    "cardMask",
    "cardExp",
    "numberOfPayments",
    "errorCode",
    "errorText",
  ];
  return Object.fromEntries(keep.map((key) => [key, params.get(key)]).filter(([, value]) => value));
}

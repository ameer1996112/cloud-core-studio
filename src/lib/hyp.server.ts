export type HypConfig = {
  payBaseUrl: string;
  user: string;
  password: string;
  terminalNumber: string;
  recurringTerminalNumber?: string;
  recurringPassword?: string;
  tokenOwnerTerminalNumber?: string;
  recurringMode: "hyp_managed_hk" | "merchant_token";
  publicBaseUrl: string;
  mode: "live" | "test";
};

export type HypPaymentPageRequest = {
  paymentId: string;
  amountAgorot: number;
  language?: "HEB" | "ENG";
  description?: string;
  paymentMethod?: "card" | "bit";
  recurring?: boolean;
  recurringMode?: "hyp_managed_hk" | "merchant_token";
  reconciliationId?: string;
};

export type HypSavedToken = {
  transId: string;
  token: string;
  tokef: string;
  month: string;
  year: string;
  raw: string;
};

export type HypInquiryTransaction = {
  status: string;
  statusText: string;
  financialStatus: string;
  validation: string;
  terminalNumber: string;
  cardMask: string;
  cardExp: string;
  user: string;
  tranId: string;
  cgUid: string;
  authNumber: string;
  total: string;
  amount: string;
  transactionDate: string;
  rawXml: string;
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
  const recurringTerminalNumber =
    mode === "test"
      ? readEnv("HYP_TEST_RECURRING_TERMINAL_NUMBER") ||
        readEnv("HYP_TEST_RENEWAL_TERMINAL_NUMBER") ||
        readEnv("HYP_TEST_SOFT_TERMINAL_NUMBER")
      : readEnv("HYP_RECURRING_TERMINAL_NUMBER") ||
        readEnv("HYP_RENEWAL_TERMINAL_NUMBER") ||
        readEnv("HYP_SOFT_TERMINAL_NUMBER");
  const recurringPassword =
    mode === "test"
      ? readEnv("HYP_TEST_RECURRING_API_PASSWORD") ||
        readEnv("HYP_TEST_RECURRING_PASSP") ||
        readEnv("HYP_TEST_RENEWAL_API_PASSWORD") ||
        readEnv("HYP_TEST_RENEWAL_PASSP")
      : readEnv("HYP_RECURRING_API_PASSWORD") ||
        readEnv("HYP_RECURRING_PASSP") ||
        readEnv("HYP_RENEWAL_API_PASSWORD") ||
        readEnv("HYP_RENEWAL_PASSP");
  const tokenOwnerTerminalNumber =
    mode === "test"
      ? readEnv("HYP_TEST_TOKEN_OWNER_TERMINAL_NUMBER") ||
        readEnv("HYP_TEST_TOKEN_OWNER_TERMINAL") ||
        readEnv("HYP_TEST_TOWNER")
      : readEnv("HYP_TOKEN_OWNER_TERMINAL_NUMBER") ||
        readEnv("HYP_TOKEN_OWNER_TERMINAL") ||
        readEnv("HYP_TOWNER");
  const recurringModeValue =
    mode === "test" ? readEnv("HYP_TEST_RECURRING_MODE") : readEnv("HYP_RECURRING_MODE");
  const recurringMode =
    recurringModeValue === "merchant_token" ? "merchant_token" : "hyp_managed_hk";
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
    recurringTerminalNumber: recurringTerminalNumber || undefined,
    recurringPassword: recurringPassword || undefined,
    tokenOwnerTerminalNumber: tokenOwnerTerminalNumber || undefined,
    recurringMode,
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

function amountFromHypTotal(total: string) {
  const numeric = Number(total);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return amountFromAgorot(numeric);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function xmlText(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function transactionBlocks(xml: string) {
  return [...xml.matchAll(/<transaction>([\s\S]*?)<\/transaction>/gi)].map((match) => match[0]);
}

export function buildHypReconciliationId(paymentId: string) {
  return paymentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 19);
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
  const showWalletButtons = !input.recurring;
  const requestUrl = hypPayBaseUrl(config);
  const params = new URLSearchParams({
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
    user: input.reconciliationId ?? buildHypReconciliationId(input.paymentId),
    MoreData: "True",
    UTF8: "True",
    UTF8out: "True",
    hideBtns: showWalletButtons ? "false" : "true",
  });

  if (input.recurring && input.recurringMode !== "merchant_token") {
    params.set("HK", "True");
    params.set("freq", "1");
    params.set("Tash", "999");
    params.set("OnlyOnApprove", "True");
  }

  requestUrl.search = params.toString();

  const response = await fetch(requestUrl, {
    method: "GET",
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`hyp_http_${response.status}`);
  }

  return parseHypPayResponse(responseText, config);
}

export async function getHypTokenForTransaction(transId: string, config = getHypConfig()) {
  const requestUrl = hypPayBaseUrl(config);
  requestUrl.search = new URLSearchParams({
    action: "getToken",
    Masof: config.terminalNumber,
    PassP: config.password,
    TransId: transId,
  }).toString();

  const response = await fetch(requestUrl);
  const responseText = await response.text();
  if (!response.ok) throw new Error(`hyp_get_token_http_${response.status}`);

  const parsed = new URLSearchParams(responseText.trim());
  const ccode = parsed.get("CCode") ?? "";
  if (ccode !== "0") {
    throw new Error(`hyp_get_token_failed:${ccode || responseText.slice(0, 120)}`);
  }

  const token = parsed.get("Token")?.trim() ?? "";
  const tokef = parsed.get("Tokef")?.trim() ?? "";
  if (!/^\d{19}$/.test(token)) throw new Error("hyp_get_token_missing_token");
  if (!/^\d{4}$/.test(tokef)) throw new Error("hyp_get_token_missing_tokef");

  return {
    transId: parsed.get("Id") || transId,
    token,
    tokef,
    year: tokef.slice(0, 2),
    month: tokef.slice(2, 4),
    raw: responseText,
  } satisfies HypSavedToken;
}

export async function chargeHypSavedToken(
  input: {
    token: string;
    expMonth: string;
    expYear: string;
    amount: number;
    userId?: string | null;
    clientName: string;
    info: string;
  },
  config = getHypConfig(),
) {
  const requestUrl = hypPayBaseUrl(config);
  const recurringTerminalNumber = config.recurringTerminalNumber || config.terminalNumber;
  const tokenOwnerTerminalNumber =
    config.tokenOwnerTerminalNumber ||
    (recurringTerminalNumber !== config.terminalNumber ? config.terminalNumber : "");
  const params = new URLSearchParams({
    action: "soft",
    Masof: recurringTerminalNumber,
    PassP: config.recurringPassword || config.password,
    Amount: String(input.amount),
    CC: input.token,
    Tmonth: input.expMonth.padStart(2, "0").slice(-2),
    Tyear: input.expYear.padStart(2, "0").slice(-2),
    Token: "True",
    UserId: input.userId?.trim() || "000000000",
    ClientName: input.clientName.trim() || "Cloud Core",
    Info: input.info,
    UTF8: "True",
    UTF8out: "True",
  });

  if (tokenOwnerTerminalNumber) {
    params.set("tOwner", tokenOwnerTerminalNumber);
  }

  requestUrl.search = params.toString();

  const response = await fetch(requestUrl);
  const responseText = await response.text();
  if (!response.ok) throw new Error(`hyp_soft_http_${response.status}`);

  const parsed = new URLSearchParams(responseText.trim());
  const ccode = parsed.get("CCode") ?? "";
  if (ccode !== "0") {
    throw new Error(`hyp_soft_failed:${ccode || responseText.slice(0, 120)}`);
  }

  return {
    id: parsed.get("Id") ?? "",
    ccode,
    amount: parsed.get("Amount") ?? String(input.amount),
    acode: parsed.get("ACode") ?? "",
    hesh: parsed.get("Hesh") ?? "",
    raw: responseText,
  };
}

export async function inquireHypTransactionsByUser(user: string, config = getHypConfig()) {
  const relayUrl =
    readEnv("HYP_RELAY_URL") || readEnv("HYP_RELAY_URI") || readEnv("HYP_RELAY_BASE_URL");
  if (!relayUrl) throw new Error("hyp_relay_not_configured:HYP_RELAY_URL");

  const xml = `<ashrait><request><version>2000</version><language>ENG</language><dateTime/><requestId/><command>inquireTransactions</command><inquireTransactions><terminalNumber>${xmlEscape(config.terminalNumber)}</terminalNumber><user>${xmlEscape(user)}</user></inquireTransactions></request></ashrait>`;
  const body = new URLSearchParams({
    user: config.user,
    password: config.password,
    int_in: xml,
  });

  const response = await fetch(relayUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`hyp_inquire_http_${response.status}`);

  const result = xmlText(responseText, "result");
  if (result !== "000") {
    const message = xmlText(responseText, "userMessage") || xmlText(responseText, "message");
    throw new Error(`hyp_inquire_failed:${result || "unknown"}:${message}`);
  }

  return transactionBlocks(responseText).map((block): HypInquiryTransaction => {
    const total = xmlText(block, "total");
    return {
      status: xmlText(block, "status"),
      statusText: xmlText(block, "statusText"),
      financialStatus: xmlText(block, "financialStatus"),
      validation: xmlText(block, "validation"),
      terminalNumber: xmlText(block, "terminalNumber"),
      cardMask: xmlText(block, "cardMask"),
      cardExp: xmlText(block, "cardExpiration"),
      user: xmlText(block, "user"),
      tranId: xmlText(block, "tranId"),
      cgUid: xmlText(block, "cgUid"),
      authNumber: xmlText(block, "authNumber"),
      total,
      amount: amountFromHypTotal(total),
      transactionDate: xmlText(block, "transactionDate"),
      rawXml: block,
    };
  });
}

function pickSearchParam(params: URLSearchParams, ...names: string[]) {
  for (const name of names) {
    const value = params.get(name);
    if (value !== null) return value;
  }
  return "";
}

export async function validateHypRedirect(params: URLSearchParams, config = getHypConfig()) {
  const sign = pickSearchParam(params, "Sign");
  if (!sign) return false;

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

export async function updateHypRecurringAgreementStatus(
  hkId: string,
  newStatus: "terminate" | "resume",
  config = getHypConfig(),
) {
  const requestUrl = hypPayBaseUrl(config);
  requestUrl.search = new URLSearchParams({
    action: "HKStatus",
    Masof: config.terminalNumber,
    PassP: config.password,
    HKId: hkId,
    NewStat: newStatus === "terminate" ? "1" : "2",
  }).toString();

  const response = await fetch(requestUrl);
  const responseText = await response.text();
  if (!response.ok) throw new Error(`hyp_hkstatus_http_${response.status}`);

  const parsed = new URLSearchParams(responseText.trim());
  const ccode = parsed.get("CCode") ?? "";
  if (ccode !== "0") {
    throw new Error(`hyp_hkstatus_failed:${ccode || responseText.slice(0, 120)}`);
  }

  return {
    ok: true,
    hkId: parsed.get("HKId") || hkId,
    ccode,
    raw: responseText,
  };
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
    "L4digit",
    "token_last4",
    "cardExp",
    "keepCCDetails",
    "HKId",
    "numberOfPayments",
    "errorCode",
    "errorText",
  ];
  return Object.fromEntries(keep.map((key) => [key, params.get(key)]).filter(([, value]) => value));
}

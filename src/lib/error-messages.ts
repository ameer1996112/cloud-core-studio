import { toast } from "sonner";

// Map raw Supabase / Postgres / RPC errors to gentle, brand-voice messages.
// Never leak SQL, JWT, or schema names to the user.

const RULES: Array<{ test: (msg: string, code?: string) => boolean; friendly: string }> = [
  {
    test: (m) => /invalid login|invalid credentials|invalid_grant/i.test(m),
    friendly: "Those credentials didn't match. Please try once more.",
  },
  {
    test: (m) => /email not confirmed/i.test(m),
    friendly: "Please confirm your email to continue.",
  },
  {
    test: (m) => /user already registered|already exists/i.test(m),
    friendly: "An account with that email already exists.",
  },
  {
    test: (m) => /password.*(short|6|weak)/i.test(m),
    friendly: "Please choose a longer password.",
  },
  {
    test: (m) => /rate limit|too many requests/i.test(m),
    friendly: "A few too many attempts. Please pause a moment and try again.",
  },
  {
    test: (m) => /jwt|unauthorized|not authenticated|no authorization/i.test(m),
    friendly: "Your session has rested. Please sign in again.",
  },
  {
    test: (m) => /permission denied|rls|not allowed|forbidden/i.test(m),
    friendly: "You don't have access to that just yet.",
  },
  {
    test: (m) => /no.?credits?|insufficient.*credit/i.test(m),
    friendly: "No credits left on this package.",
  },
  {
    test: (m) => /already booked|duplicate booking/i.test(m),
    friendly: "You're already on this class.",
  },
  {
    test: (m) => /class.*full|capacity/i.test(m),
    friendly: "This class is full — you can join the waitlist.",
  },
  {
    test: (m) => /cancellation.*(deadline|window|late)/i.test(m),
    friendly: "The cancellation window for this class has closed.",
  },
  { test: (m) => /expired|past/i.test(m), friendly: "This package or class has already passed." },
  {
    test: (m) => /network|fetch failed|failed to fetch|timeout/i.test(m),
    friendly: "The line went quiet. Please check your connection and try again.",
  },
  {
    test: (_m, c) => c === "PGRST116",
    friendly: "We couldn't find that. It may have been removed.",
  },
  { test: (_m, c) => c === "23505", friendly: "That already exists." },
  {
    test: (_m, c) => c === "23503",
    friendly: "That's still linked to other data — remove the links first.",
  },
  {
    test: (m) => /payment_not_confirmable/i.test(m),
    friendly: "This payment cannot be confirmed in its current state.",
  },
  {
    test: (m) => /invalid_amount/i.test(m),
    friendly: "Enter a valid payment amount before confirming.",
  },
  {
    test: (m) => /provider_not_configured/i.test(m),
    friendly:
      "Online checkout is not connected yet. Please request the package or contact the studio.",
  },
  {
    test: (m) => /already_confirmed/i.test(m),
    friendly: "This payment was already confirmed — its receipt is ready.",
  },
];

const TECHNICAL_ERROR_PATTERN =
  /postgrest|supabase|postgres|relation\s+["']|schema|rpc[_\s-]|jwt|access[_\s-]?token|sqlstate|stack\s*trace|service[_\s-]?role|private\./i;

function errorDetails(err: unknown) {
  const anyErr = err as { message?: string; code?: string; error_description?: string };
  return {
    message: (anyErr.message ?? anyErr.error_description ?? String(err)).toString(),
    code: anyErr.code,
  };
}

function mappedFriendlyMessage(message: string, code?: string): string | null {
  for (const rule of RULES) {
    try {
      if (rule.test(message, code)) return rule.friendly;
    } catch {
      /* ignore malformed provider errors */
    }
  }
  return null;
}

export function friendlyErrorMessage(
  err: unknown,
  fallback = "Something didn't quite land. Please try again.",
): string {
  if (!err) return fallback;
  const { message: msg, code } = errorDetails(err);
  const mapped = mappedFriendlyMessage(msg, code);
  if (mapped) return mapped;
  // Strip SQL-y prefixes
  const clean = msg
    .replace(/^.*violates.*?:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
  if (!clean || clean.length > 180) return fallback;
  return clean;
}

/**
 * Use for persistent UI where provider, database, auth, or RPC diagnostics must never be echoed.
 * Known errors retain the project's friendly mapping; everything else uses caller-owned copy.
 */
export function safeErrorMessage(
  err: unknown,
  fallback = "Something didn't quite land. Please try again.",
): string {
  if (!err) return fallback;
  const { message, code } = errorDetails(err);
  if (TECHNICAL_ERROR_PATTERN.test(message)) return fallback;
  return mappedFriendlyMessage(message, code) ?? fallback;
}

export function showApiError(err: unknown, fallback?: string) {
  toast.error(friendlyErrorMessage(err, fallback));
}

export function showApiSuccess(message: string) {
  toast.success(message);
}

type PasswordResetAuth = {
  exchangeCodeForSession: (code: string) => Promise<{ data?: unknown; error?: unknown }>;
  verifyOtp: (payload: {
    type: "recovery";
    token_hash: string;
  }) => Promise<{ data?: unknown; error?: unknown }>;
  setSession: (payload: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{ data?: unknown; error?: unknown }>;
};

export type PasswordResetRecoveryResult = {
  status: "ready" | "invalid";
};

function hasSession(data: unknown) {
  return Boolean((data as { session?: unknown } | null)?.session);
}

function normalizeHash(hash: string) {
  return hash.startsWith("#") ? hash.slice(1) : hash;
}

export function getPasswordResetRedirectUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}/reset-password`;
}

export function getCanonicalResetUrl(href: string) {
  const url = new URL(href);
  url.pathname = "/reset-password";
  return url.toString();
}

export function clearPasswordResetUrlTokens() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, document.title, window.location.pathname);
}

export async function validatePasswordResetRecovery({
  auth,
  href,
}: {
  auth: PasswordResetAuth;
  href: string;
}): Promise<PasswordResetRecoveryResult> {
  const url = new URL(href);
  const query = url.searchParams;
  const hash = new URLSearchParams(normalizeHash(url.hash));
  const tokenHash = query.get("token_hash");
  const queryType = query.get("type");
  const hashType = hash.get("type");
  const code = query.get("code");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");

  if (tokenHash && queryType === "recovery") {
    const { data, error } = await auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    return !error && hasSession(data) ? { status: "ready" } : { status: "invalid" };
  }

  if (accessToken && refreshToken && hashType === "recovery") {
    const { data, error } = await auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return !error && hasSession(data) ? { status: "ready" } : { status: "invalid" };
  }

  if (code) {
    const { data, error } = await auth.exchangeCodeForSession(code);
    return !error && hasSession(data) ? { status: "ready" } : { status: "invalid" };
  }

  return { status: "invalid" };
}

export function getResetPasswordValidationError(password: string, confirm: string) {
  if (password !== confirm) return "reset.mismatch";
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return "reset.tooShort";
  }
  return null;
}

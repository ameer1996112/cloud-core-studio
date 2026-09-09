/** Only auth transport is bounded here; booking/payment requests are untouched. */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!new URL(url).pathname.startsWith("/auth/v1/")) return fetch(input, init);
  const controller = new AbortController();
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

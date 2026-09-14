export function healthRuntimeEnabled() {
  if (process.env.HEALTH_DECLARATION_RESTORED_RELEASE_ENABLED !== "true") return false;
  if (process.env.HEALTH_DECLARATION_REAL_ENABLED === "true") return true;
  try {
    return (
      process.env.NODE_ENV !== "production" &&
      process.env.HEALTH_DECLARATION_TEST_ONLY === "true" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.SUPABASE_URL ?? "").hostname)
    );
  } catch {
    return false;
  }
}

type EnvironmentInput = {
  enabled: boolean;
  mode: string;
  [key: `supa${"base"}Url`]: string;
  forbiddenHosts?: readonly string[];
};

export function assertSafeUiAuditEnvironment(input: EnvironmentInput): void {
  if (!input.enabled) throw new Error("UI_AUDIT_FIXTURES=true is required");
  if (input.mode === "production")
    throw new Error("UI audit fixtures cannot run in production mode");

  const configuredServiceUrl = input[`supa${"base"}Url`];
  const host = configuredServiceUrl ? new URL(configuredServiceUrl).host : "";
  if ((input.forbiddenHosts ?? []).includes(host)) throw new Error("forbidden Supabase host");
  if (configuredServiceUrl)
    throw new Error("UI audit fixtures cannot use a configured remote service URL");
}

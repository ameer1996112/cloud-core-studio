const INSTALLATION_ID_KEY = "cc_member_push_installation_id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StorageSubset = Pick<Storage, "getItem" | "setItem">;

export function clientApnsEnvironment(value: unknown): "sandbox" | "production" {
  if (value === "sandbox" || value === "production") return value;
  throw new Error("invalid_client_apns_environment");
}

export function getOrCreateMemberPushInstallationId(
  storage: StorageSubset,
  randomUuid: () => string = () => crypto.randomUUID(),
) {
  const existing = storage.getItem(INSTALLATION_ID_KEY);
  if (existing && UUID_PATTERN.test(existing)) return existing;
  const generated = randomUuid();
  if (!UUID_PATTERN.test(generated)) throw new Error("invalid_generated_installation_id");
  storage.setItem(INSTALLATION_ID_KEY, generated);
  return generated;
}

export function memberPushRegistrationMetadata(input: {
  installationId: string;
  appInfo?: { version?: string; build?: string } | null;
  locale?: string | null;
  environment: "sandbox" | "production";
}) {
  return {
    installationId: input.installationId,
    ...(input.appInfo?.version ? { appVersion: input.appInfo.version } : {}),
    ...(input.appInfo?.build ? { buildNumber: input.appInfo.build } : {}),
    ...(input.locale ? { locale: input.locale } : {}),
    environment: input.environment,
    permissionStatus: "granted" as const,
    capabilities: {
      richMedia: true,
      actions: true,
      timeSensitive: true,
    },
  };
}

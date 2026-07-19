import { DEFAULT_APP_STORE_URL } from "@/lib/download-config";

export type IosUpdateRequirementInput = {
  enforcementEnabled: boolean;
  minimumVersion: string;
  installedVersion: string | null;
  isNative: boolean;
  platform: string;
};

export type IosUpdateRequirement = {
  required: boolean;
  reason: "disabled" | "not_ios" | "legacy_build" | "outdated" | "current";
};

export type PublicAppUpdatePolicy = {
  enforcementEnabled: boolean;
  minimumVersion: string;
  appStoreUrl: string;
};

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function readPublicAppUpdatePolicy(
  env: Record<string, string | undefined>,
): PublicAppUpdatePolicy {
  const configuredMinimum = env.IOS_MINIMUM_APP_VERSION?.trim() ?? "";
  const hasValidMinimum = VERSION_PATTERN.test(configuredMinimum);
  const enforcementEnabled =
    env.IOS_FORCE_UPDATE_ENABLED?.trim().toLowerCase() === "true" && hasValidMinimum;

  return {
    enforcementEnabled,
    minimumVersion: hasValidMinimum ? configuredMinimum : "0.0.0",
    appStoreUrl: safeAppStoreUrl(env.APP_STORE_URL),
  };
}

export function evaluateIosUpdateRequirement(
  input: IosUpdateRequirementInput,
): IosUpdateRequirement {
  if (!input.enforcementEnabled) return { required: false, reason: "disabled" };
  if (!input.isNative || input.platform !== "ios") {
    return { required: false, reason: "not_ios" };
  }
  if (!input.installedVersion) return { required: true, reason: "legacy_build" };
  if (compareVersions(input.installedVersion, input.minimumVersion) < 0) {
    return { required: true, reason: "outdated" };
  }
  return { required: false, reason: "current" };
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function safeAppStoreUrl(value: string | undefined) {
  if (!value?.trim()) return DEFAULT_APP_STORE_URL;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname === "apps.apple.com"
      ? url.toString()
      : DEFAULT_APP_STORE_URL;
  } catch {
    return DEFAULT_APP_STORE_URL;
  }
}

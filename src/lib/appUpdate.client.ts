import { Capacitor } from "@capacitor/core";
import { getPublicAppUpdatePolicy } from "@/lib/appUpdate.functions";
import { evaluateIosUpdateRequirement } from "@/lib/appUpdatePolicy";

export type RequiredIosAppUpdate = {
  appStoreUrl: string;
  installedVersion: string | null;
  minimumVersion: string;
};

export async function findRequiredIosAppUpdate(): Promise<RequiredIosAppUpdate | null> {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  if (!isNative || platform !== "ios") return null;

  const policy = await getPublicAppUpdatePolicy();
  if (!policy.enforcementEnabled) return null;

  let installedVersion: string | null = null;
  try {
    const { App } = await import("@capacitor/app");
    installedVersion = (await App.getInfo()).version;
  } catch (error) {
    console.warn("ios_app_version_unavailable", error);
  }

  const requirement = evaluateIosUpdateRequirement({
    enforcementEnabled: policy.enforcementEnabled,
    minimumVersion: policy.minimumVersion,
    installedVersion,
    isNative,
    platform,
  });

  return requirement.required
    ? {
        appStoreUrl: policy.appStoreUrl,
        installedVersion,
        minimumVersion: policy.minimumVersion,
      }
    : null;
}

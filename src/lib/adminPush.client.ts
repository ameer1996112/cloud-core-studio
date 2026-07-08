import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentRole } from "@/lib/auth-redirect";
import { registerAdminPushToken } from "@/lib/adminPush.functions";

type AdminPushRegistrationResult =
  | { ok: true; status: "registration_started" }
  | {
      ok: false;
      skipped:
        | "already_started"
        | "not_native"
        | "no_session"
        | "not_admin"
        | "permission_denied"
        | "permission_not_granted";
      permission?: string;
    };

let registrationStarted = false;

export async function maybeRegisterAdminPushNotifications(): Promise<AdminPushRegistrationResult> {
  if (registrationStarted) return { ok: false, skipped: "already_started" };
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
    return { ok: false, skipped: "not_native" };
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return { ok: false, skipped: "no_session" };

    const role = await getCurrentRole(userId);
    if (role !== "admin") return { ok: false, skipped: "not_admin" };

    registrationStarted = true;

    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.addListener("registration", (token) => {
      const platform = Capacitor.getPlatform() === "android" ? "android" : "ios";
      registerAdminPushToken({ data: { token: token.value, platform } }).catch((error) => {
        console.warn("admin_push_token_register_failed", error);
      });
    });
    await PushNotifications.addListener("registrationError", (error) => {
      console.warn("admin_push_registration_error", error);
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
      const url = event.notification.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        window.location.assign(url);
      }
    });

    let permissions = await PushNotifications.checkPermissions();
    if (permissions.receive === "prompt") {
      permissions = await PushNotifications.requestPermissions();
    }
    if (permissions.receive === "granted") {
      await PushNotifications.register();
      return { ok: true, status: "registration_started" };
    }
    registrationStarted = false;
    return {
      ok: false,
      skipped: permissions.receive === "denied" ? "permission_denied" : "permission_not_granted",
      permission: permissions.receive,
    };
  } catch (error) {
    registrationStarted = false;
    console.warn("admin_push_init_failed", error);
    throw error;
  }
}

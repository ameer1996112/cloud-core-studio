import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentRole } from "@/lib/auth-redirect";
import { safeNotificationActionUrl } from "@/lib/memberNotificationsApi";
import { registerMemberPushToken } from "@/lib/memberNotifications.functions";

export type MemberPushRegistrationResult =
  | { ok: true; status: "registration_started" }
  | {
      ok: false;
      skipped:
        | "already_started"
        | "not_native"
        | "no_session"
        | "not_member"
        | "permission_denied"
        | "permission_not_granted";
      permission?: string;
    };

let registrationStarted = false;

export async function startMemberPushRegistration(): Promise<MemberPushRegistrationResult> {
  if (registrationStarted) return { ok: false, skipped: "already_started" };
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
    return { ok: false, skipped: "not_native" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, skipped: "no_session" };
  if ((await getCurrentRole(userId)) !== "member") {
    return { ok: false, skipped: "not_member" };
  }

  registrationStarted = true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.addListener("registration", (token) => {
      void registerMemberPushToken({ data: { token: token.value, platform: "ios" } })
        .then(() => window.dispatchEvent(new CustomEvent("cc:member-notifications-changed")))
        .catch((error) => console.warn("member_push_token_register_failed", error));
    });
    await PushNotifications.addListener("registrationError", (error) => {
      console.warn("member_push_registration_error", error);
    });
    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      window.dispatchEvent(
        new CustomEvent("cc:member-push-received", {
          detail: {
            title: notification.title,
            body: notification.body,
          },
        }),
      );
      window.dispatchEvent(new CustomEvent("cc:member-notifications-changed"));
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
      const actionUrl = safeNotificationActionUrl(event.notification.data?.url);
      window.dispatchEvent(new CustomEvent("cc:member-notifications-changed"));
      window.location.assign(actionUrl);
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
    throw error;
  }
}

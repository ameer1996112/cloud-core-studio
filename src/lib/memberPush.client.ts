import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentRole } from "@/lib/auth-redirect";
import { safeNotificationActionUrl } from "@/lib/memberNotificationsApi";
import {
  markMemberNotificationRead,
  registerMemberPushToken,
} from "@/lib/memberNotifications.functions";

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
let listenersInstalled = false;

async function initializeMemberPush(input: {
  requestPermission: boolean;
}): Promise<MemberPushRegistrationResult> {
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

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    if (!listenersInstalled) {
      await PushNotifications.addListener("registration", (token) => {
        void registerMemberPushToken({ data: { token: token.value, platform: "ios" } })
          .then(() => window.dispatchEvent(new CustomEvent("cc:member-notifications-changed")))
          .catch((error) => console.warn("member_push_token_register_failed", error));
      });
      await PushNotifications.addListener("registrationError", (error) => {
        registrationStarted = false;
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
      await PushNotifications.addListener("pushNotificationActionPerformed", async (event) => {
        const notificationId = event.notification.data?.notificationId;
        const campaignId = event.notification.data?.campaignId;
        const actionUrl = safeNotificationActionUrl(event.notification.data?.url);
        if (typeof campaignId === "string") {
          window.localStorage.setItem(
            "cc-member-campaign-attribution",
            JSON.stringify({ campaignId, expiresAt: Date.now() + 72 * 60 * 60_000 }),
          );
        }
        if (typeof notificationId === "string") {
          try {
            await markMemberNotificationRead({ data: { notificationId } });
          } catch (error) {
            console.warn("member_push_open_tracking_failed", error);
          }
        }
        window.dispatchEvent(new CustomEvent("cc:member-notifications-changed"));
        window.location.assign(actionUrl);
      });
      listenersInstalled = true;
    }

    let permissions = await PushNotifications.checkPermissions();
    if (permissions.receive === "prompt" && input.requestPermission) {
      permissions = await PushNotifications.requestPermissions();
    }
    if (permissions.receive === "granted") {
      registrationStarted = true;
      await PushNotifications.register();
      return { ok: true, status: "registration_started" };
    }

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

export function startMemberPushRegistration() {
  return initializeMemberPush({ requestPermission: true });
}

export function bootstrapMemberPushRegistration() {
  return initializeMemberPush({ requestPermission: false });
}

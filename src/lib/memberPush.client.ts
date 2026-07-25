import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentRole } from "@/lib/auth-redirect";
import { safeNotificationActionUrl } from "@/lib/memberNotificationsApi";
import {
  markMemberNotificationRead,
  registerMemberPushToken,
} from "@/lib/memberNotifications.functions";
import { MEMBER_PUSH_REGISTRATION_FAILED_EVENT } from "@/lib/memberPushInvite";

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
let registeredUserId: string | null = null;
let initializationPromise: Promise<MemberPushRegistrationResult> | null = null;
const MEMBER_PUSH_TOKEN_KEY = "member_push_token";

async function initializeMemberPush(input: {
  requestPermission: boolean;
}): Promise<MemberPushRegistrationResult> {
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
  if (registrationStarted && registeredUserId === userId) {
    return { ok: false, skipped: "already_started" };
  }
  registrationStarted = false;
  registeredUserId = userId;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    if (!listenersInstalled) {
      await PushNotifications.addListener("registration", (token) => {
        window.localStorage.setItem(MEMBER_PUSH_TOKEN_KEY, token.value);
        void registerMemberPushToken({ data: { token: token.value, platform: "ios" } })
          .then(() => window.dispatchEvent(new CustomEvent("cc:member-notifications-changed")))
          .catch((error) => console.warn("member_push_token_register_failed", error));
      });
      await PushNotifications.addListener("registrationError", (error) => {
        registrationStarted = false;
        registeredUserId = null;
        window.dispatchEvent(new CustomEvent(MEMBER_PUSH_REGISTRATION_FAILED_EVENT));
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
    registeredUserId = null;
    throw error;
  }
}

export function startMemberPushRegistration() {
  return runMemberPushInitialization(true);
}

export function bootstrapMemberPushRegistration() {
  return runMemberPushInitialization(false);
}

function runMemberPushInitialization(requestPermission: boolean) {
  if (initializationPromise) return initializationPromise;
  initializationPromise = initializeMemberPush({ requestPermission }).finally(() => {
    initializationPromise = null;
  });
  return initializationPromise;
}

export function resetMemberPushSession() {
  registrationStarted = false;
  registeredUserId = null;
  initializationPromise = null;
}

export async function disconnectMemberPushSession() {
  resetMemberPushSession();
  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.unregister();
    } catch (error) {
      console.warn("member_push_native_unregister_failed", error);
    }
  }
  window.localStorage.removeItem(MEMBER_PUSH_TOKEN_KEY);
}

export function getCurrentMemberPushToken() {
  return window.localStorage.getItem(MEMBER_PUSH_TOKEN_KEY);
}

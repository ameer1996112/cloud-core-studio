import { supabase } from "@/integrations/supabase/client";
import {
  clearSupabaseAccessTokenCookie,
  syncSupabaseAccessTokenCookie,
} from "@/integrations/supabase/session-cookie";
import { getFreshSupabaseSession } from "@/integrations/supabase/auth-session";

type RootSessionLifecycleHandlers = {
  onSessionAvailable: () => void;
  onSessionChanged: () => void;
  onSignedOut: () => void;
  onError: (error: unknown) => void;
};

export function getFreshRootSession() {
  return getFreshSupabaseSession();
}

export function startRootSessionLifecycle({
  onSessionAvailable,
  onSessionChanged,
  onSignedOut,
  onError,
}: RootSessionLifecycleHandlers) {
  let active = true;
  let nativeAppStateListener: { remove: () => Promise<void> } | undefined;

  const syncCurrentSession = (notifyChange = false) => {
    void getFreshSupabaseSession().then((session) => {
      if (!active || !session) return;
      onSessionAvailable();
      if (notifyChange) onSessionChanged();
    });
  };

  const refreshCurrentSession = () => syncCurrentSession(true);

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") refreshCurrentSession();
  };

  syncCurrentSession();
  window.addEventListener("focus", refreshCurrentSession);
  document.addEventListener("visibilitychange", onVisibilityChange);

  void Promise.all([import("@capacitor/core"), import("@capacitor/app")])
    .then(async ([{ Capacitor }, { App }]) => {
      if (!active || !Capacitor.isNativePlatform()) return;
      nativeAppStateListener = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          supabase.auth.startAutoRefresh();
          refreshCurrentSession();
        } else {
          supabase.auth.stopAutoRefresh();
        }
      });
      if (!active) {
        await nativeAppStateListener.remove();
        nativeAppStateListener = undefined;
        return;
      }
      supabase.auth.startAutoRefresh();
    })
    .catch(onError);

  const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
    if (
      event !== "SIGNED_IN" &&
      event !== "SIGNED_OUT" &&
      event !== "USER_UPDATED" &&
      event !== "TOKEN_REFRESHED"
    ) {
      return;
    }
    if (event === "SIGNED_OUT") {
      clearSupabaseAccessTokenCookie();
      onSignedOut();
      return;
    }
    syncSupabaseAccessTokenCookie(session);
    onSessionAvailable();
    if (event !== "SIGNED_IN") onSessionChanged();
  });

  return () => {
    active = false;
    window.removeEventListener("focus", refreshCurrentSession);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (nativeAppStateListener) void nativeAppStateListener.remove();
    subscription.subscription.unsubscribe();
  };
}

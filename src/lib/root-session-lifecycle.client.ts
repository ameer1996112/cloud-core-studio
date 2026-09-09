import { supabase } from "@/integrations/supabase/client";
import {
  clearSupabaseAccessTokenCookie,
  syncSupabaseAccessTokenCookie,
} from "@/integrations/supabase/session-cookie";
import { getFreshSupabaseSession } from "@/integrations/supabase/auth-session";

type RootSessionLifecycleHandlers = {
  onSessionAvailable: () => void;
  onSessionChanged: () => void;
  onSessionResumed: () => void;
  onSignedOut: () => void;
  onError: (error: unknown) => void;
};

export function getFreshRootSession() {
  return getFreshSupabaseSession();
}

export function startRootSessionLifecycle({
  onSessionAvailable,
  onSessionChanged,
  onSessionResumed,
  onSignedOut,
  onError,
}: RootSessionLifecycleHandlers) {
  let active = true;
  let nativeAppStateListener: { remove: () => Promise<void> } | undefined;

  let refreshInFlight = false;
  let lastResume = 0;
  const syncCurrentSession = (resumed = false) => {
    if (!active || refreshInFlight) return;
    if (resumed && Date.now() - lastResume < 1_000) return;
    if (resumed) lastResume = Date.now();
    refreshInFlight = true;
    void getFreshSupabaseSession()
      .then((session) => {
        if (!active || !session) return;
        onSessionAvailable();
        if (resumed) onSessionResumed();
      })
      .catch((error) => {
        if (active) onError(error);
      })
      .finally(() => {
        refreshInFlight = false;
      });
  };

  const refreshCurrentSession = () => syncCurrentSession(true);

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") refreshCurrentSession();
  };

  syncCurrentSession();
  window.addEventListener("focus", refreshCurrentSession);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", refreshCurrentSession);

  void Promise.all([import("@capacitor/core"), import("@capacitor/app")])
    .then(async ([{ Capacitor }, { App }]) => {
      if (!active || !Capacitor.isNativePlatform()) return;
      nativeAppStateListener = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          void supabase.auth.startAutoRefresh().catch(onError);
          refreshCurrentSession();
        } else {
          void supabase.auth.stopAutoRefresh().catch(onError);
        }
      });
      if (!active) {
        await nativeAppStateListener.remove();
        nativeAppStateListener = undefined;
        return;
      }
      void supabase.auth.startAutoRefresh().catch(onError);
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
    // A new token is not a route/role change. Keep the mounted screen in place.
    if (event === "USER_UPDATED") onSessionChanged();
    else if (event === "TOKEN_REFRESHED") onSessionResumed();
  });

  return () => {
    active = false;
    window.removeEventListener("focus", refreshCurrentSession);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("online", refreshCurrentSession);
    if (nativeAppStateListener) void nativeAppStateListener.remove();
    subscription.subscription.unsubscribe();
  };
}

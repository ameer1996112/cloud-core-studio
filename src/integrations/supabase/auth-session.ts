import type { Session } from "@supabase/supabase-js";
import { supabase } from "./client";
import { clearSupabaseAccessTokenCookie, syncSupabaseAccessTokenCookie } from "./session-cookie";

const REFRESH_MARGIN_SECONDS = 5 * 60;

function secondsUntilSessionExpires(session: Session) {
  if (typeof session.expires_at === "number") {
    return session.expires_at - Math.floor(Date.now() / 1000);
  }
  if (typeof session.expires_in === "number") return session.expires_in;
  return 0;
}

export async function getFreshSupabaseSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    clearSupabaseAccessTokenCookie();
    return null;
  }

  const session = data.session;
  if (!session) {
    clearSupabaseAccessTokenCookie();
    return null;
  }

  if (secondsUntilSessionExpires(session) > REFRESH_MARGIN_SECONDS) {
    syncSupabaseAccessTokenCookie(session);
    return session;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.session) {
    clearSupabaseAccessTokenCookie();
    return null;
  }

  syncSupabaseAccessTokenCookie(refreshed.session);
  return refreshed.session;
}

import { supabase } from "./client";
import { withDeadline } from "@/lib/async-deadline";

// A suspended native connection can leave the SDK waiting for a token refresh.
// Bound each caller's wait; retain the SDK session so a reconnect can recover it.
export function readSupabaseSession() {
  return withDeadline(supabase.auth.getSession());
}

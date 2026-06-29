import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { SUPABASE_ACCESS_TOKEN_COOKIE } from "@/integrations/supabase/session-cookie";
import type { AppRole } from "@/lib/auth-redirect";
import type { AuthRouteContext } from "./route-guards";

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function normalizeRouteRole(role: string | null | undefined): AppRole {
  if (role === "admin" || role === "instructor" || role === "member") return role;
  return "member";
}

export async function getServerAuthRouteContext(): Promise<AuthRouteContext | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  const request = getRequest();
  const token = readCookie(request?.headers.get("cookie") ?? null, SUPABASE_ACCESS_TOKEN_COOKIE);
  if (!token) return null;

  const serverSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: claimsData, error: claimsError } = await serverSupabase.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return null;

  const { data: profile, error: profileError } = await serverSupabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return null;

  return {
    user: { id: userId } as User,
    role: normalizeRouteRole(profile?.role),
  };
}

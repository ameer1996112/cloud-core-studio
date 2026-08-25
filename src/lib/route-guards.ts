import { redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { roleHome, type AppRole } from "@/lib/auth-role-home";
import { buildProtectedRouteAuthHref } from "@/lib/guest-auth-intent";

export type AuthRouteContext = {
  user: User;
  role: AppRole;
};

export function normalizeRouteRole(role: string | null | undefined): AppRole {
  if (role === "admin" || role === "instructor" || role === "member") return role;
  return "member";
}

const getAuthRouteContextForEnv = createIsomorphicFn()
  .server(async (): Promise<AuthRouteContext | null> => {
    const { getServerAuthRouteContext } = await import("./route-guards.server");
    return getServerAuthRouteContext();
  })
  .client(async (): Promise<AuthRouteContext | null> => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (sessionError || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) return null;

    return {
      user,
      role: normalizeRouteRole(profile?.role),
    };
  });

export async function getAuthRouteContext(): Promise<AuthRouteContext | null> {
  return getAuthRouteContextForEnv();
}

export async function requireAuthenticatedRoute(returnTo?: string): Promise<AuthRouteContext> {
  const auth = await getAuthRouteContext();
  if (!auth) throw redirect({ to: buildProtectedRouteAuthHref(returnTo || "/member") });
  return auth;
}

export async function requireRouteRole(
  allowedRoles: AppRole[],
  returnTo?: string,
): Promise<AuthRouteContext> {
  const auth = await requireAuthenticatedRoute(returnTo);
  if (!allowedRoles.includes(auth.role)) {
    throw redirect({ to: roleHome(auth.role), replace: true });
  }
  return auth;
}

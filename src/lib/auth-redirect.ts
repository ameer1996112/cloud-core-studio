import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "instructor" | "member";

// Each role has a distinct home. Instructors get their own landing
// (admin is strictly admin-only and would bounce them in a loop).
export type RoleHome = "/admin" | "/member" | "/instructor";

export function roleHome(role: string | null | undefined): RoleHome {
  if (role === "admin") return "/admin";
  if (role === "instructor") return "/instructor";
  return "/member";
}

export async function getCurrentRole(userId: string): Promise<AppRole> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (data?.role ?? "member") as AppRole;
}

export async function homeForCurrentUser(): Promise<RoleHome> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return "/member";
  const role = await getCurrentRole(user.id);
  return roleHome(role);
}

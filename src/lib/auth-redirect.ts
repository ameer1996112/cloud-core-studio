import { roleHome, type AppRole, type RoleHome } from "@/lib/auth-role-home";

export { roleHome, type AppRole, type RoleHome } from "@/lib/auth-role-home";

export async function getCurrentRole(userId: string): Promise<AppRole> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (data?.role ?? "member") as AppRole;
}

export async function homeForCurrentUser(): Promise<RoleHome> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return "/member";
  const role = await getCurrentRole(user.id);
  return roleHome(role);
}

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { redirect } from "@tanstack/react-router";
import { roleHome } from "@/lib/auth-redirect";

// Instructors land here. Members and admins are sent home.
export const Route = createFileRoute("/_authenticated/instructor")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", u.user.id)
      .maybeSingle();
    const role = p?.role;
    if (role === "admin") throw redirect({ to: "/admin" });
    if (role !== "instructor") throw redirect({ to: roleHome(role) });
    return { role: "instructor" as const };
  },
  component: () => <Outlet />,
});
